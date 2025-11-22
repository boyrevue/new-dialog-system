"""
Multimodal Dialog Server - FastAPI server for dialog interaction
Extracts questions from TTL, handles speech/text input, calculates confidence
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import json
import logging
from datetime import datetime, timedelta
import numpy as np
import soundfile as sf
import io
from pathlib import Path

from dialog_manager import DialogManager
from document_ocr import extract_from_document
from perspective_transform import perspective_transform_image
from field_state_manager import FieldStateManager
from date_parser import parse_date_natural, validate_date

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Multimodal Dialog API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve debug images (OCR pipeline artifacts)
try:
    app.mount("/debug", StaticFiles(directory="debug_images"), name="debug")
except Exception:
    # Directory may not exist yet; mounting will work after first run creates it
    pass

# Initialize Dialog Manager
ontology_paths = [
    "../ontologies/dialog.ttl",
    "../ontologies/dialog-multimodal.ttl",
    "../ontologies/dialog-insurance-questions.ttl",
    "../ontologies/dialog-insurance-select-options.ttl",  # Select options for UK insurance questions
    "../ontologies/dialog-sections.ttl",
    "../ontologies/dialog-vocabularies.ttl",
    "../ontologies/dialog-documents.ttl",
    "../ontologies/dialog-validation.ttl",
    "../ontologies/dialog-confidence.ttl",
    "../ontologies/dialog-forms.ttl"
]
dialog_manager = DialogManager(ontology_paths)

# In-memory session store (use Redis in production)
sessions = {}

# In-memory field state manager store (one per session)
field_state_managers = {}

# In-memory store for low-confidence audio recordings awaiting operator review
low_confidence_queue = []

# Get TTL configuration from ontology
ttl_config = dialog_manager.get_ttl_configuration()
SESSION_TTL = ttl_config["session"]
ANSWER_TTL = ttl_config["answer"]


class DialogSession(BaseModel):
    session_id: str
    current_node_index: int = 0
    answers: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    last_accessed: datetime = Field(default_factory=datetime.now)
    confidence_scores: Dict[str, float] = Field(default_factory=dict)


class AnswerRequest(BaseModel):
    session_id: str
    question_id: str
    answer_text: Optional[str] = None
    answer_type: str = "text"  # text, speech, select
    recognition_confidence: Optional[float] = None


class ConfidenceScoreRequest(BaseModel):
    recognition_confidence: float
    audio_quality: float
    grammar_match: float
    vocabulary_match: float
    context_match: Optional[float] = None


class AudioQualityMetrics(BaseModel):
    snr: float  # Signal-to-noise ratio in dB
    clipping_percent: float
    spectral_quality: float


# Session Management
def get_or_create_session(session_id: str) -> DialogSession:
    """Get existing session or create new one with TTL management."""
    if session_id in sessions:
        session = sessions[session_id]
        # Check if session has expired
        if datetime.now() - session.last_accessed > SESSION_TTL:
            logger.info(f"Session {session_id} expired, creating new session")
            del sessions[session_id]
            # Also clean up field state manager
            if session_id in field_state_managers:
                del field_state_managers[session_id]
        else:
            session.last_accessed = datetime.now()
            return session

    # Create new session
    session = DialogSession(session_id=session_id)
    sessions[session_id] = session

    # Initialize field state manager for this session
    field_state_manager = FieldStateManager(session_id)
    field_state_managers[session_id] = field_state_manager

    # Initialize fields from dialog flow
    dialog_flow = dialog_manager.get_dialog_flow('InsuranceQuoteDialog')
    for node in dialog_flow:
        if 'question_id' in node:
            field_state_manager.initialize_field(
                field_id=node['question_id'],
                question_id=node['question_id'],
                slot_name=node.get('slot_name', node['question_id'])
            )

    logger.info(f"Created new session: {session_id} with {len(field_state_manager.fields)} fields initialized")
    return session


def cleanup_expired_sessions():
    """Remove expired sessions based on TTL."""
    now = datetime.now()
    expired = [
        sid for sid, session in sessions.items()
        if now - session.last_accessed > SESSION_TTL
    ]
    for sid in expired:
        del sessions[sid]
        # Also clean up field state manager
        if sid in field_state_managers:
            del field_state_managers[sid]
        logger.info(f"Cleaned up expired session: {sid}")


# Confidence Scoring
def calculate_confidence_score(
    factors: ConfidenceScoreRequest,
    question_id: str
) -> float:
    """
    Calculate multi-factor confidence score.
    Weights are loaded from TTL ontology (golden source).
    """
    # Load scoring rule from ontology
    # For now, using the default speech confidence rule
    # In production, this would query the ontology for question-specific rules
    
    weights = {
        "recognition_confidence": 0.4,
        "audio_quality": 0.2,
        "grammar_match": 0.2,
        "vocabulary_match": 0.2
    }
    
    score = (
        factors.recognition_confidence * weights["recognition_confidence"] +
        factors.audio_quality * weights["audio_quality"] +
        factors.grammar_match * weights["grammar_match"] +
        factors.vocabulary_match * weights["vocabulary_match"]
    )
    
    if factors.context_match is not None:
        # Adjust with context if available
        score = 0.9 * score + 0.1 * factors.context_match
    
    return min(1.0, max(0.0, score))


def analyze_audio_quality(audio_data: np.ndarray, sample_rate: int) -> AudioQualityMetrics:
    """
    Analyze audio quality metrics.
    Thresholds loaded from TTL ontology.
    """
    # Signal-to-noise ratio estimation
    # Simple approach: compare RMS of signal to noise floor
    rms = np.sqrt(np.mean(audio_data ** 2))
    noise_floor = np.percentile(np.abs(audio_data), 10)
    snr = 20 * np.log10(rms / (noise_floor + 1e-10))
    
    # Clipping detection
    max_value = np.max(np.abs(audio_data))
    clipping_threshold = 0.95
    clipped_samples = np.sum(np.abs(audio_data) > clipping_threshold)
    clipping_percent = (clipped_samples / len(audio_data)) * 100
    
    # Spectral quality (simplified - checks frequency distribution)
    fft = np.fft.rfft(audio_data)
    magnitude = np.abs(fft)
    # Good speech should have energy across frequency bands
    spectral_quality = min(1.0, np.std(magnitude) / (np.mean(magnitude) + 1e-10))
    
    return AudioQualityMetrics(
        snr=snr,
        clipping_percent=clipping_percent,
        spectral_quality=spectral_quality
    )


# API Endpoints
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_sessions": len(sessions)
    }


@app.post("/api/session/start")
async def start_session(dialog_id: str = "InsuranceQuoteDialog"):
    """Start a new dialog session."""
    import uuid
    session_id = str(uuid.uuid4())
    session = get_or_create_session(session_id)
    
    # Load dialog flow from TTL
    flow = dialog_manager.get_dialog_flow(dialog_id)
    
    return {
        "session_id": session_id,
        "dialog_id": dialog_id,
        "total_questions": len([n for n in flow if "question_id" in n]),
        "ttl_seconds": int(SESSION_TTL.total_seconds())
    }


@app.get("/api/session/{session_id}/current-question")
async def get_current_question(session_id: str):
    """Get the current question for a session."""
    session = get_or_create_session(session_id)

    # Get field state manager for this session
    field_state_manager = field_state_managers.get(session_id)

    # Load dialog flow
    flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")

    # Skip to next unanswered question node
    while session.current_node_index < len(flow):
        current_node = flow[session.current_node_index]

        # Check if current node is a question
        if "question_id" in current_node:
            question_id = current_node["question_id"]

            # Check field state manager first (if available)
            if field_state_manager and field_state_manager.should_skip_field(question_id):
                field = field_state_manager.get_field(question_id)
                logger.info(f"Skipping field {question_id} based on state: {field.state if field else 'unknown'}")
                session.current_node_index += 1
                continue

            # Skip this question if it's already been answered (e.g., by OCR extraction)
            if question_id in session.answers:
                logger.info(f"Skipping already answered question: {question_id} (answer: {session.answers[question_id]})")
                session.current_node_index += 1
                continue

            # This question hasn't been answered yet, return it
            features = dialog_manager.get_multimodal_features(question_id)
            threshold, priority = dialog_manager.get_confidence_threshold(question_id)
            input_mode = dialog_manager.get_input_mode(question_id)
            section_info = dialog_manager.get_section_for_question(question_id)
            document_info = dialog_manager.get_document_fillable(question_id)
            form_definition = dialog_manager.get_form_definition(question_id)

            # Get field state information (if available)
            field_state_info = {}
            if field_state_manager:
                field = field_state_manager.get_field(question_id)
                if field:
                    field_state_info = {
                        "state": field.state,
                        "source": field.source,
                        "confidence": field.meta.confidence
                    }

            # Extract input_type from input_mode for frontend widget selection
            input_type = input_mode.get("input_type") if input_mode else None

            # Auto-detect select type if question has options
            if features["select_options"] and len(features["select_options"]) > 0:
                input_type = "select"

            return {
                "question_id": question_id,
                "question_text": current_node["question_text"],
                "slot_name": current_node["slot_name"],
                "required": current_node["required"],
                "spelling_required": current_node.get("spelling_required", False),
                "input_mode": input_mode,
                "input_type": input_type,  # For frontend widget selection (date, select, etc.)
                "section": section_info,
                "tts": features["tts"],
                "visual_components": features["visual_components"],
                "options": features["select_options"],
                "cascading": features.get("cascading", {}),
                "faqs": features["faqs"],
                "confidence_threshold": threshold,
                "priority": priority,
                "document_fillable": document_info["fillable"],
                "document_name": document_info["document_name"],
                "form": form_definition,
                "field_state": field_state_info  # Include field state for frontend visibility
            }

        # If not a question, skip to next node
        session.current_node_index += 1

    # All nodes processed
    return {"completed": True}


@app.post("/api/answer/submit")
async def submit_answer(answer: AnswerRequest):
    """Submit an answer and calculate confidence."""
    session = get_or_create_session(answer.session_id)

    # Get the question's input mode to determine if date parsing is needed
    input_mode = dialog_manager.get_input_mode(answer.question_id)
    answer_text = answer.answer_text

    # Parse natural language dates if input_mode is 'date' or contains 'Date' in the URI
    input_mode_str = None
    if input_mode:
        if isinstance(input_mode, dict):
            # Extract the URI or label from the dict
            input_mode_str = input_mode.get('uri', '') or input_mode.get('label', '')
        else:
            input_mode_str = str(input_mode)

    if input_mode_str and 'date' in input_mode_str.lower() and answer_text:
        logger.info(f"📅 Attempting to parse date input: '{answer_text}' (input_mode: {input_mode_str})")
        parsed_date = parse_date_natural(answer_text)

        if parsed_date:
            # Validate the parsed date
            is_valid, error = validate_date(parsed_date)
            if is_valid:
                logger.info(f"✅ Date parsed successfully: '{answer_text}' → '{parsed_date}'")
                answer_text = parsed_date
            else:
                logger.warning(f"⚠️ Parsed date failed validation: {error}")
        else:
            logger.warning(f"⚠️ Could not parse date input: '{answer_text}'")

    # Store answer (potentially with parsed date)
    session.answers[answer.question_id] = answer_text

    # Calculate confidence (simplified - would integrate with speech recognition)
    if answer.answer_type == "speech" and answer.recognition_confidence:
        confidence = answer.recognition_confidence
    else:
        # For text input, assume high confidence
        confidence = 0.95

    session.confidence_scores[answer.question_id] = confidence

    # Update field state manager
    if answer.session_id in field_state_managers:
        field_state_manager = field_state_managers[answer.session_id]
        field_state_manager.mark_answered(
            field_id=answer.question_id,
            value=answer.answer_text,
            confidence=confidence
        )
        logger.info(f"Field {answer.question_id} marked as answered in field state manager")
    
    # Get threshold from TTL
    threshold, priority = dialog_manager.get_confidence_threshold(answer.question_id)
    
    needs_review = confidence < threshold
    
    if needs_review:
        logger.warning(
            f"Low confidence answer for {answer.question_id}: "
            f"{confidence:.2f} < {threshold:.2f}"
        )
    
    # Move to next question
    session.current_node_index += 1
    
    return {
        "success": True,
        "confidence": confidence,
        "threshold": threshold,
        "needs_review": needs_review,
        "priority": priority if needs_review else None
    }


@app.post("/api/audio/analyze")
async def analyze_audio(
    file: UploadFile = File(...),
    question_id: str = ""
):
    """
    Analyze uploaded audio file for quality metrics.
    Returns audio quality scores for confidence calculation.
    """
    try:
        # Read audio file
        audio_bytes = await file.read()
        audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes))
        
        # Analyze quality
        quality_metrics = analyze_audio_quality(audio_data, sample_rate)
        
        # Convert quality metrics to normalized scores
        # Load thresholds from TTL ontology
        min_snr = 20.0  # From TTL: qc:MinimumSNR
        max_clipping = 5.0  # From TTL: qc:ClippingThreshold
        
        audio_quality_score = min(1.0, max(0.0, (quality_metrics.snr - 10) / 20))
        if quality_metrics.clipping_percent > max_clipping:
            audio_quality_score *= 0.5
        
        return {
            "audio_quality_score": audio_quality_score,
            "metrics": {
                "snr_db": quality_metrics.snr,
                "clipping_percent": quality_metrics.clipping_percent,
                "spectral_quality": quality_metrics.spectral_quality
            },
            "meets_quality_standards": (
                quality_metrics.snr >= min_snr and
                quality_metrics.clipping_percent <= max_clipping
            )
        }
    except Exception as e:
        logger.error(f"Error analyzing audio: {e}")
        raise HTTPException(status_code=400, detail=f"Audio analysis failed: {e}")


@app.post("/api/confidence/calculate")
async def calculate_confidence(
    factors: ConfidenceScoreRequest,
    question_id: str
):
    """Calculate confidence score from multiple factors."""
    score = calculate_confidence_score(factors, question_id)
    threshold, priority = dialog_manager.get_confidence_threshold(question_id)
    
    return {
        "confidence_score": score,
        "threshold": threshold,
        "needs_review": score < threshold,
        "priority": priority if score < threshold else None
    }


@app.get("/api/vocabulary/match")
async def match_vocabulary(
    input_text: str,
    concept_scheme: str
):
    """
    Match user input against SKOS vocabulary.
    Returns normalized value from controlled vocabulary.
    """
    matched = dialog_manager.validate_vocabulary_match(input_text, concept_scheme)
    
    return {
        "input": input_text,
        "matched": matched,
        "concept_scheme": concept_scheme,
        "valid": matched is not None
    }


@app.get("/api/rephrase-template/{question_id}")
async def get_rephrase_template(question_id: str, template_type: str = "phonetic"):
    """Get rephrase request template from TTL."""
    template = dialog_manager.get_rephrase_template(question_id, template_type)

    return template


@app.get("/api/sessions")
async def get_all_sessions():
    """Get all active sessions with their current state."""
    flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")

    result = []
    for session_id, session in sessions.items():
        questions = []

        for idx, node in enumerate(flow):
            if "question_id" not in node:
                continue

            question_id = node["question_id"]

            # Determine status
            if idx < session.current_node_index:
                status = "completed"
                answer = session.answers.get(question_id, "N/A")
            elif idx == session.current_node_index:
                status = "active"
                answer = None
            else:
                status = "pending"
                answer = None

            questions.append({
                "id": question_id,
                "text": node["question_text"],
                "status": status,
                "answer": answer
            })

        result.append({
            "id": session_id,
            "label": f"Session {len(result) + 1}",
            "active": True,
            "questions": questions,
            "currentIndex": session.current_node_index,
            "totalQuestions": len([n for n in flow if "question_id" in n]),
            "lastAccessed": session.last_accessed.isoformat()
        })

    return result


@app.post("/api/document/upload-and-extract")
async def upload_and_extract_document(
    file: UploadFile = File(...),
    session_id: str = Form(""),
    question_id: str = Form(""),
    template: str = Form(""),
    document_type: str = Form("uk_driving_licence")
):
    """
    Upload a document (UK Driving Licence, V5C, Passport, etc.) and extract data using OCR.
    Returns extracted fields that can be used to auto-fill the dialog form.
    Optional template parameter allows providing custom field coordinates.
    Optional document_type parameter specifies document type ('uk_driving_licence' or 'v5c').
    """
    try:
        # Read file bytes
        file_bytes = await file.read()

        # Parse template if provided
        template_dict = None
        logger.info(f"Template parameter received: {bool(template)}, length: {len(template) if template else 0}")
        if template:
            import json
            try:
                template_dict = json.loads(template)
                logger.info(f"Parsed custom template with {len(template_dict.get('fields', []))} fields")
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid template JSON provided, ignoring: {e}")

        # Log document type
        logger.info(f"Extracting document type: {document_type}")

        # Perform OCR and extraction
        extraction_result = extract_from_document(file_bytes, file.filename, custom_template=template_dict, document_type=document_type)

        if not extraction_result.get('success'):
            # Return debug links with error detail to help troubleshooting in the client
            raise HTTPException(
                status_code=400,
                detail={
                    "error": extraction_result.get('error', 'Document extraction failed'),
                    "debug_urls": extraction_result.get('debug_urls', [])
                }
            )

        # Get extracted fields
        extracted_fields = extraction_result.get('extracted_fields', {})

        # Validate extracted fields and get suggestions
        from ocr_validator import get_validator
        validator = get_validator()
        field_confidences = extraction_result.get('field_confidences', {})
        validations = validator.validate_document(extracted_fields, field_confidences)

        logger.info(f"Field validations: {validations}")

        # Map extracted fields to dialog question IDs (from ontology)
        # Template field names from uk_licence_template.json & v5c_template.json -> question_id mapping
        field_to_question_map = {
            # UK Driving Licence fields (from template extraction)
            'surname': 'q_last_name',
            'given_names': 'q_first_name',
            'licence_number': 'q_licence_number',
            'address': 'q_street_address',
            'issue_date': 'q_issue_date',
            'expiry_date': 'q_expiry_date',
            'dob_place': 'q_date_of_birth',  # Contains DOB + birthplace, needs parsing

            # V5C Log Book fields (from v5c_template.json)
            'registration_number': 'q_vehicle_reg_number',
            'make': 'q_vehicle_make',
            'model': 'q_vehicle_model',
            'vin': 'q_vehicle_vin',
            'fuel_type': 'q_vehicle_fuel_type',
            'colour': 'q_vehicle_colour',
            'date_of_registration': 'q_vehicle_date_first_registered',
            'date_first_uk_registration': 'q_vehicle_date_first_registered',
            'keeper_name': 'q_registered_keeper_name',
            'keeper_address': 'q_registered_keeper_address',
            'keeper_postcode': 'q_registered_keeper_postcode',

            # Legacy OCR fields (fallback for old extraction)
            'date_of_birth': 'q_date_of_birth',
            'dob_from_licence': 'q_date_of_birth',
            'first_names': 'q_first_name',  # Old field name
            'gender': 'q_gender',
        }

        # Create slot mappings for questions that have extracted values
        slot_mappings = {}
        answered_questions = []  # Track which questions we've answered

        for ocr_field, question_id in field_to_question_map.items():
            value = extracted_fields.get(ocr_field)
            if value:
                slot_mappings[question_id] = value
                answered_questions.append(question_id)

        # Update session with extracted data if session_id provided
        if session_id and session_id in sessions:
            session = sessions[session_id]
            ocr_confidence = extraction_result.get('confidence', 0.9)

            # Get field state manager for this session
            field_state_manager = field_state_managers.get(session_id)

            # Notify field state manager that document was uploaded
            if field_state_manager:
                import uuid
                document_id = str(uuid.uuid4())
                mapped_field_ids = list(slot_mappings.keys())
                field_state_manager.on_document_uploaded(document_id, mapped_field_ids)
                logger.info(f"Field state manager notified of document upload: {document_id}")

            for question_id, value in slot_mappings.items():
                # Get field-specific confidence from validations or use default
                field_confidence = field_confidences.get(question_id, ocr_confidence)

                # Store in session answers with high confidence (OCR extracted)
                session.answers[question_id] = value
                session.confidence_scores[question_id] = field_confidence
                logger.info(f"Auto-filled question {question_id} with OCR value: {value} (confidence: {field_confidence})")

                # Update field state manager with extraction result
                if field_state_manager:
                    # Determine if field should be accepted based on validation
                    validation = validations.get(question_id, {})
                    is_valid = validation.get('is_valid', True)
                    status = "accepted" if is_valid and field_confidence >= 0.75 else "rejected"

                    field_state_manager.on_document_field_result(
                        field_id=question_id,
                        value=value,
                        confidence=field_confidence,
                        status=status,
                        document_id=document_id if field_state_manager else None,
                        ocr_raw_text=value  # Store OCR text for audit
                    )

                    if status == "rejected":
                        logger.warning(f"Field {question_id} marked for re-ask: validation={is_valid}, confidence={field_confidence}")

            # Mark session as updated
            session.last_accessed = datetime.now()

        logger.info(f"Document extraction successful. Document type: {extraction_result.get('document_type')}")
        logger.info(f"Extracted fields: {list(extracted_fields.keys())}")
        logger.info(f"Field images keys: {list(extraction_result.get('images', {}).keys())}")
        logger.info(f"Auto-filled questions: {answered_questions}")

        return {
            'success': True,
            'document_type': extraction_result.get('document_type'),
            'confidence': extraction_result.get('confidence'),
            'extracted_fields': extracted_fields,
            'field_confidences': field_confidences,
            'validations': validations,  # Field validation results with suggestions
            'field_images': extraction_result.get('images', {}),  # Field images (for extractionType='image' or 'both')
            'slot_mappings': slot_mappings,  # question_id -> value mappings
            'answered_questions': answered_questions,  # List of question IDs that were auto-filled
            'raw_text_preview': extraction_result.get('raw_text', '')[:500],  # First 500 chars
            'photo': extraction_result.get('photo'),  # Base64-encoded photo
            'signature': extraction_result.get('signature'),  # Base64-encoded signature
            'full_image': extraction_result.get('full_image'),  # Base64-encoded full straightened licence
            'debug_urls': extraction_result.get('debug_urls', []),
            'aligned_image_url': extraction_result.get('aligned_image_url')
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload and extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.post("/api/operator/low-confidence-audio")
async def receive_low_confidence_audio(
    audio: UploadFile = File(...),
    session_id: str = "",
    question_id: str = "",
    transcript: str = "",
    confidence: float = 0.0,
    is_select_question: bool = False
):
    """
    Receive low-confidence audio recording from frontend for operator review.
    Stores audio with metadata for operator to listen, transcribe, and respond.
    """
    try:
        # Read audio file
        audio_bytes = await audio.read()

        # Create a unique ID for this review item
        import uuid
        review_id = str(uuid.uuid4())

        # Get question details
        flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")
        question_node = next((n for n in flow if n.get("question_id") == question_id), None)
        question_text = question_node.get("question_text", "") if question_node else ""

        # Get select options if it's a select question
        select_options = []
        if is_select_question and question_node:
            features = dialog_manager.get_multimodal_features(question_id)
            select_options = features.get("select_options", [])

        # Store in queue
        review_item = {
            "id": review_id,
            "session_id": session_id,
            "question_id": question_id,
            "question_text": question_text,
            "transcript": transcript,
            "confidence": confidence,
            "audio_data": audio_bytes,
            "is_select_question": is_select_question,
            "select_options": select_options,
            "timestamp": datetime.now().isoformat(),
            "status": "pending",  # pending, resolved, rephrased
            "operator_action": None  # Will be "fixed" or "rephrase"
        }

        low_confidence_queue.append(review_item)

        logger.info(f"Received low-confidence audio for session {session_id}, question {question_id}")
        logger.info(f"Transcript: '{transcript}', Confidence: {confidence:.2f}")

        return {
            "success": True,
            "review_id": review_id,
            "message": "Audio sent to operator for review"
        }

    except Exception as e:
        logger.error(f"Error receiving low-confidence audio: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {e}")


@app.get("/api/operator/low-confidence-queue")
async def get_low_confidence_queue():
    """
    Get all pending low-confidence audio recordings awaiting operator review.
    """
    # Return queue items without the audio data (too large for JSON)
    queue_items = [
        {
            "id": item["id"],
            "session_id": item["session_id"],
            "question_id": item["question_id"],
            "question_text": item["question_text"],
            "transcript": item["transcript"],
            "confidence": item["confidence"],
            "is_select_question": item["is_select_question"],
            "select_options": item["select_options"],
            "timestamp": item["timestamp"],
            "status": item["status"]
        }
        for item in low_confidence_queue
    ]

    return queue_items


@app.get("/api/operator/audio/{review_id}")
async def get_review_audio(review_id: str):
    """
    Get the audio file for a specific review item.
    Returns the audio file as a downloadable WAV file.
    """
    from fastapi.responses import Response

    # Find the review item
    review_item = next((item for item in low_confidence_queue if item["id"] == review_id), None)

    if not review_item:
        raise HTTPException(status_code=404, detail="Review item not found")

    # Return audio file
    return Response(
        content=review_item["audio_data"],
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"attachment; filename=review_{review_id}.wav"
        }
    )


@app.post("/api/operator/fix-answer")
async def fix_answer(
    review_id: str,
    corrected_answer: str
):
    """
    Operator fixes the user's answer and updates the session.
    """
    # Find the review item
    review_item = next((item for item in low_confidence_queue if item["id"] == review_id), None)

    if not review_item:
        raise HTTPException(status_code=404, detail="Review item not found")

    session_id = review_item["session_id"]
    question_id = review_item["question_id"]

    # Update session with corrected answer
    session = get_or_create_session(session_id)
    session.answers[question_id] = corrected_answer
    session.confidence_scores[question_id] = 1.0  # Operator-verified = 100% confidence

    # Mark review item as resolved
    review_item["status"] = "resolved"
    review_item["operator_action"] = "fixed"
    review_item["corrected_answer"] = corrected_answer

    logger.info(f"Operator fixed answer for session {session_id}, question {question_id}: '{corrected_answer}'")

    return {
        "success": True,
        "message": "Answer fixed and session updated"
    }


@app.post("/api/operator/request-rephrase")
async def request_rephrase(
    review_id: str,
    rephrase_message: Optional[str] = None
):
    """
    Operator requests the user to rephrase their answer.
    Sends TTS message back to the user's session.
    """
    # Find the review item
    review_item = next((item for item in low_confidence_queue if item["id"] == review_id), None)

    if not review_item:
        raise HTTPException(status_code=404, detail="Review item not found")

    session_id = review_item["session_id"]
    question_id = review_item["question_id"]

    # Get rephrase template from ontology if no custom message provided
    if not rephrase_message:
        template = dialog_manager.get_rephrase_template(question_id, "default")
        rephrase_message = template.get("text", "I'm sorry, I didn't understand that. Please can you rephrase your answer?")

    # Mark review item as rephrased
    review_item["status"] = "rephrased"
    review_item["operator_action"] = "rephrase"
    review_item["rephrase_message"] = rephrase_message

    logger.info(f"Operator requested rephrase for session {session_id}, question {question_id}")

    # TODO: Send rephrase message to user via WebSocket or TTS
    # This will be implemented in the WebSocket handler

    return {
        "success": True,
        "message": "Rephrase request sent to user",
        "rephrase_message": rephrase_message
    }


class PerspectiveTransformRequest(BaseModel):
    image_base64: str
    corners: List[List[float]]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]


@app.post("/api/perspective-transform")
async def perspective_transform(request: PerspectiveTransformRequest):
    """
    Apply perspective transform to straighten a crooked document image.
    Expects 4 corner points in order: top-left, top-right, bottom-right, bottom-left.
    """
    try:
        if len(request.corners) != 4:
            raise HTTPException(status_code=400, detail="Exactly 4 corners required")

        # Perform perspective transform using OpenCV
        straightened_base64 = perspective_transform_image(
            request.image_base64,
            request.corners
        )

        return {
            "success": True,
            "straightened_image": straightened_base64
        }
    except Exception as e:
        logger.error(f"Perspective transform error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transform failed: {str(e)}")


@app.post("/api/template/save")
async def save_template(request: dict):
    """
    Save extraction template to file.
    Accepts template data and filename.
    """
    try:
        template_data = request.get('template')
        filename = request.get('filename')

        if not template_data or not filename:
            raise HTTPException(status_code=400, detail="Missing template or filename")

        # Validate filename
        allowed_filenames = ['uk_licence_template.json', 'v5c_template.json']
        if filename not in allowed_filenames:
            raise HTTPException(status_code=400, detail=f"Invalid filename. Must be one of: {allowed_filenames}")

        # Save to backend directory
        import os
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(backend_dir, filename)

        # Write template file
        import json
        with open(file_path, 'w') as f:
            json.dump(template_data, f, indent=2)

        logger.info(f"Saved template to {file_path}")

        return {
            "success": True,
            "message": f"Template saved to {filename}",
            "path": file_path
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template save error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")


@app.get("/api/template/load")
async def load_template(filename: str):
    """
    Load extraction template from file.
    Returns the template data if it exists.
    """
    try:
        # Validate filename
        allowed_filenames = ['uk_licence_template.json', 'v5c_template.json']
        if filename not in allowed_filenames:
            raise HTTPException(status_code=400, detail=f"Invalid filename. Must be one of: {allowed_filenames}")

        # Load from backend directory
        import os
        import json
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(backend_dir, filename)

        # Check if file exists
        if not os.path.exists(file_path):
            return {
                "success": False,
                "message": f"Template {filename} not found",
                "template": None
            }

        # Read template file
        with open(file_path, 'r') as f:
            template_data = json.load(f)

        logger.info(f"Loaded template from {file_path}")

        return {
            "success": True,
            "message": f"Template loaded from {filename}",
            "template": template_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template load error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Load failed: {str(e)}")


# WebSocket for real-time updates
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket connection for real-time dialog interaction."""
    await websocket.accept()
    
    try:
        session = get_or_create_session(session_id)
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        })
        
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "get_question":
                # Load current question
                flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")
                if session.current_node_index < len(flow):
                    current_node = flow[session.current_node_index]
                    if "question_id" in current_node:
                        features = dialog_manager.get_multimodal_features(
                            current_node["question_id"]
                        )
                        await websocket.send_json({
                            "type": "question",
                            "data": {
                                "question_id": current_node["question_id"],
                                "question_text": current_node["question_text"],
                                **features
                            }
                        })
            
            elif data["type"] == "submit_answer":
                # Process answer
                answer = data["answer"]
                session.answers[data["question_id"]] = answer
                session.current_node_index += 1
                
                await websocket.send_json({
                    "type": "answer_accepted",
                    "next_available": session.current_node_index < len(flow)
                })
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason=str(e))


# Background task to cleanup expired sessions
# Field State Management API Endpoints (Back Office)
@app.get("/api/session/{session_id}/fields")
async def get_session_fields(session_id: str):
    """Get all fields and their states for a session."""
    if session_id not in field_state_managers:
        raise HTTPException(status_code=404, detail="Session not found")

    field_state_manager = field_state_managers[session_id]
    all_fields = field_state_manager.get_all_fields()

    return {
        "session_id": session_id,
        "fields": {
            field_id: field.to_dict()
            for field_id, field in all_fields.items()
        },
        "total_fields": len(all_fields),
        "completed_fields": sum(1 for f in all_fields.values() if f.state == "COMPLETED"),
        "pending_fields": sum(1 for f in all_fields.values() if f.state in ["ASK_PENDING", "REASK_PENDING"])
    }


@app.get("/api/session/{session_id}/field/{field_id}")
async def get_field_details(session_id: str, field_id: str):
    """Get detailed information about a specific field."""
    if session_id not in field_state_managers:
        raise HTTPException(status_code=404, detail="Session not found")

    field_state_manager = field_state_managers[session_id]
    field = field_state_manager.get_field(field_id)

    if not field:
        raise HTTPException(status_code=404, detail=f"Field {field_id} not found")

    return field.to_dict()


@app.get("/api/session/{session_id}/field/{field_id}/audit")
async def get_field_audit_trail(session_id: str, field_id: str):
    """Get complete audit trail for a specific field."""
    if session_id not in field_state_managers:
        raise HTTPException(status_code=404, detail="Session not found")

    field_state_manager = field_state_managers[session_id]
    field = field_state_manager.get_field(field_id)

    if not field:
        raise HTTPException(status_code=404, detail=f"Field {field_id} not found")

    return {
        "field_id": field_id,
        "question_id": field.question_id,
        "current_state": field.state,
        "audit_trail": [entry.to_dict() for entry in field.audit_trail]
    }


@app.post("/api/field/release-for-reask")
async def release_field_for_reask(
    session_id: str,
    field_id: str,
    reason: Optional[str] = None
):
    """Release a specific field for re-asking (back office control)."""
    if session_id not in field_state_managers:
        raise HTTPException(status_code=404, detail="Session not found")

    field_state_manager = field_state_managers[session_id]

    success = field_state_manager.release_field_for_reask(field_id, reason)

    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to release field {field_id}")

    logger.info(f"Back office released field {field_id} for re-ask in session {session_id}")

    return {
        "success": True,
        "field_id": field_id,
        "new_state": "REASK_PENDING",
        "reason": reason
    }


@app.post("/api/field/lock")
async def lock_field(
    session_id: str,
    field_id: str,
    reason: Optional[str] = None
):
    """Lock a field to prevent further changes (back office control)."""
    if session_id not in field_state_managers:
        raise HTTPException(status_code=404, detail="Session not found")

    field_state_manager = field_state_managers[session_id]

    success = field_state_manager.lock_field(field_id, reason)

    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to lock field {field_id}")

    logger.info(f"Back office locked field {field_id} in session {session_id}")

    return {
        "success": True,
        "field_id": field_id,
        "new_state": "LOCKED",
        "reason": reason
    }


@app.post("/api/field/unlock")
async def unlock_field(session_id: str, field_id: str):
    """Unlock a previously locked field (back office control)."""
    if session_id not in field_state_managers:
        raise HTTPException(status_code=404, detail="Session not found")

    field_state_manager = field_state_managers[session_id]

    success = field_state_manager.unlock_field(field_id)

    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to unlock field {field_id}")

    field = field_state_manager.get_field(field_id)
    new_state = field.state if field else "unknown"

    logger.info(f"Back office unlocked field {field_id} in session {session_id}")

    return {
        "success": True,
        "field_id": field_id,
        "new_state": new_state
    }


@app.on_event("startup")
async def startup_event():
    """Startup tasks."""
    logger.info("Starting multimodal dialog server")
    logger.info(f"Session TTL: {SESSION_TTL}")
    logger.info(f"Answer TTL: {ANSWER_TTL}")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown tasks."""
    logger.info("Shutting down multimodal dialog server")
    cleanup_expired_sessions()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
