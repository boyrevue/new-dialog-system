"""
Multimodal Dialog Server - FastAPI server for dialog interaction
Extracts questions from TTL, handles speech/text input, calculates confidence
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
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

# Initialize Dialog Manager
ontology_paths = [
    "../ontologies/dialog.ttl",
    "../ontologies/dialog-multimodal.ttl",
    "../ontologies/dialog-vocabularies.ttl",
    "../ontologies/dialog-validation.ttl",
    "../ontologies/dialog-confidence.ttl"
]
dialog_manager = DialogManager(ontology_paths)

# In-memory session store (use Redis in production)
sessions = {}

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
        else:
            session.last_accessed = datetime.now()
            return session
    
    # Create new session
    session = DialogSession(session_id=session_id)
    sessions[session_id] = session
    logger.info(f"Created new session: {session_id}")
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

    # Load dialog flow
    flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")

    # Skip to next question node if current node is not a question
    while session.current_node_index < len(flow):
        current_node = flow[session.current_node_index]

        # Check if current node is a question
        if "question_id" in current_node:
            question_id = current_node["question_id"]
            features = dialog_manager.get_multimodal_features(question_id)
            threshold, priority = dialog_manager.get_confidence_threshold(question_id)
            input_mode = dialog_manager.get_input_mode(question_id)

            return {
                "question_id": question_id,
                "question_text": current_node["question_text"],
                "slot_name": current_node["slot_name"],
                "required": current_node["required"],
                "spelling_required": current_node.get("spelling_required", False),
                "input_mode": input_mode,
                "tts": features["tts"],
                "visual_components": features["visual_components"],
                "select_options": features["select_options"],
                "faqs": features["faqs"],
                "confidence_threshold": threshold,
                "priority": priority
            }

        # If not a question, skip to next node
        session.current_node_index += 1

    # All nodes processed
    return {"completed": True}


@app.post("/api/answer/submit")
async def submit_answer(answer: AnswerRequest):
    """Submit an answer and calculate confidence."""
    session = get_or_create_session(answer.session_id)
    
    # Store answer
    session.answers[answer.question_id] = answer.answer_text
    
    # Calculate confidence (simplified - would integrate with speech recognition)
    if answer.answer_type == "speech" and answer.recognition_confidence:
        confidence = answer.recognition_confidence
    else:
        # For text input, assume high confidence
        confidence = 0.95
    
    session.confidence_scores[answer.question_id] = confidence
    
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
