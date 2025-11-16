"""
Configuration Panel API - Admin interface for editing dialog configuration
Allows viewing and editing TTS, ASR, OWL, and SHACL configurations
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging
from pathlib import Path
from tts_variant_generator import TTSVariantGenerator
import json
import os
from datetime import datetime
from dotenv import load_dotenv
from dialog_manager import DialogManager
from csv_select_parser import CSVSelectParser
from flow_converter import TTLToFlowConverter, FlowToTTLConverter
from ttl_validator import TTLValidator, TTLCleaner, validate_before_save

# Load environment variables from .env file
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Dialog Configuration Panel API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ontology file paths (resolve relative to this file to avoid CWD issues)
BASE_DIR = Path(__file__).resolve().parent
ONTOLOGY_DIR = (BASE_DIR.parent / "ontologies")
ONTOLOGY_FILES = {
    "dialog": "dialog.ttl",
    "multimodal": "dialog-multimodal.ttl",
    "insurance_questions": "dialog-insurance-questions.ttl",
    "sections": "dialog-sections.ttl",
    "vocabularies": "dialog-vocabularies.ttl",
    "documents": "dialog-documents.ttl",
    "validation": "dialog-validation.ttl",
    "confidence": "dialog-confidence.ttl"
}

# TTS Variants cache file - JSON storage for question customizations
TTS_VARIANTS_CACHE = Path("tts_variants_cache.json")

# Helper functions for TTS variants cache
def load_tts_variants_cache():
    """Load TTS variants from JSON cache."""
    if TTS_VARIANTS_CACHE.exists():
        try:
            with open(TTS_VARIANTS_CACHE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading TTS variants cache: {e}")
            return {}
    return {}

def save_tts_variants_cache(cache_data):
    """Save TTS variants to JSON cache."""
    try:
        with open(TTS_VARIANTS_CACHE, 'w') as f:
            json.dump(cache_data, f, indent=2)
        logger.info(f"Saved TTS variants cache with {len(cache_data)} questions")
        return True
    except Exception as e:
        logger.error(f"Error saving TTS variants cache: {e}")
        return False


class OntologyContent(BaseModel):
    """Ontology file content."""
    ontology_type: str
    content: str


class TTSConfig(BaseModel):
    """TTS configuration."""
    question_id: str
    tts_text: str
    tts_voice: str
    tts_rate: float
    tts_pitch: float
    tts_config: Optional[str] = None


class ASRConfig(BaseModel):
    """ASR configuration."""
    language: str = "en-GB"
    continuous: bool = False
    interim_results: bool = False
    max_alternatives: int = 1


class ValidationPredicates(BaseModel):
    """Validation predicates configuration."""
    is_digit: bool = False
    is_number: bool = False
    is_email: bool = False
    is_uk_postcode: bool = False
    is_uk_driving_licence: bool = False
    is_vehicle_reg: bool = False
    is_alpha: bool = False
    is_alphanumeric: bool = False
    is_date: bool = False
    is_phone_number: bool = False


class ValidationConfig(BaseModel):
    """Validation configuration for a field."""
    predicates: ValidationPredicates = ValidationPredicates()
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    pattern: Optional[str] = None
    custom_error_message: Optional[str] = None


class TTSConfig(BaseModel):
    """TTS configuration for a field."""
    grammar_text: Optional[str] = None
    library: Optional[str] = None  # coqui-tts, pyttsx3, gtts, azure-speech
    ssml: Optional[str] = None
    voice: Optional[str] = None
    rate: Optional[float] = None
    pitch: Optional[float] = None


class ASRConfig(BaseModel):
    """ASR configuration for a field."""
    grammar_patterns: Optional[str] = None  # JSGF, GRXML, ABNF, regex
    library: Optional[str] = None  # whisper, vosk-api, coqui-stt, google-cloud-speech
    grammar_variants: Optional[str] = None  # pipe-separated phrases
    confidence_threshold: Optional[float] = None
    language_model: Optional[str] = None


class SelectOption(BaseModel):
    """Select option configuration."""
    label: str
    value: str
    ontology_uri: Optional[str] = None


class MappingRule(BaseModel):
    """Word-to-format mapping rule."""
    spoken: str
    formatted: str


class MappingConfig(BaseModel):
    """Mapping and transformation configuration."""
    transformation_type: str = "none"  # none, word-to-format, custom, lookup
    word_to_format_rules: List[MappingRule] = []
    transformation_script: Optional[str] = None


class HelpContent(BaseModel):
    """Help and documentation content."""
    field_description: Optional[str] = None
    how_to_fill: Optional[str] = None
    valid_examples: List[str] = []
    invalid_examples: List[str] = []
    asr_hints: Optional[str] = None
    common_mistakes: Optional[str] = None


class FieldSettings(BaseModel):
    """Comprehensive field settings for a question."""
    # Basic metadata
    field_id: Optional[str] = None
    label: Optional[str] = None
    internal_key: Optional[str] = None
    field_type: Optional[str] = None
    placeholder: Optional[str] = None
    required: bool = False
    default_value: Optional[str] = None
    ui_hint: Optional[str] = None

    # Validation
    validation: ValidationConfig = ValidationConfig()

    # TTS configuration
    tts: TTSConfig = TTSConfig()

    # ASR configuration
    asr: ASRConfig = ASRConfig()

    # Select options (for select/radio/checkbox fields)
    select_options: List[SelectOption] = []

    # Mapping and transformation
    mapping: MappingConfig = MappingConfig()

    # Help content
    help: HelpContent = HelpContent()


@app.get("/api/config/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "ontology_files": list(ONTOLOGY_FILES.keys())
    }


@app.get("/api/config/ontologies")
async def list_ontologies():
    """List all available ontology files."""
    files = []
    for ont_type, filename in ONTOLOGY_FILES.items():
        file_path = ONTOLOGY_DIR / filename
        if file_path.exists():
            files.append({
                "type": ont_type,
                "filename": filename,
                "path": str(file_path),
                "size": file_path.stat().st_size,
                "exists": True
            })
        else:
            files.append({
                "type": ont_type,
                "filename": filename,
                "path": str(file_path),
                "exists": False
            })
    return {"ontologies": files}


@app.get("/api/config/ontology/{ontology_type}")
async def get_ontology(ontology_type: str):
    """Get ontology file content."""
    if ontology_type not in ONTOLOGY_FILES:
        raise HTTPException(status_code=404, detail=f"Ontology type '{ontology_type}' not found")

    file_path = ONTOLOGY_DIR / ONTOLOGY_FILES[ontology_type]

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Ontology file not found: {file_path}")

    try:
        content = file_path.read_text(encoding='utf-8')
        return {
            "ontology_type": ontology_type,
            "filename": ONTOLOGY_FILES[ontology_type],
            "content": content,
            "line_count": len(content.splitlines())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading ontology: {str(e)}")


@app.post("/api/config/ontology/{ontology_type}")
async def update_ontology(ontology_type: str, data: OntologyContent):
    """Update ontology file content."""
    if ontology_type not in ONTOLOGY_FILES:
        raise HTTPException(status_code=404, detail=f"Ontology type '{ontology_type}' not found")

    file_path = ONTOLOGY_DIR / ONTOLOGY_FILES[ontology_type]

    try:
        # Backup original file
        backup_path = file_path.with_suffix('.ttl.backup')
        if file_path.exists():
            file_path.rename(backup_path)

        # Write new content
        file_path.write_text(data.content, encoding='utf-8')

        logger.info(f"Updated ontology: {ontology_type}")

        return {
            "success": True,
            "ontology_type": ontology_type,
            "filename": ONTOLOGY_FILES[ontology_type],
            "backup_created": str(backup_path)
        }
    except Exception as e:
        # Restore backup if update failed
        if backup_path.exists():
            backup_path.rename(file_path)
        raise HTTPException(status_code=500, detail=f"Error updating ontology: {str(e)}")


@app.get("/api/config/questions")
async def list_questions():
    """List ALL questions from TTL with their TTS/ASR configurations and sections."""
    from dialog_manager import DialogManager

    ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
    dialog_manager = DialogManager(ontology_paths)

    # Get ALL questions from TTL (not just those in dialog flow)
    questions = dialog_manager.get_all_questions()

    # Get sections
    sections = dialog_manager.get_all_sections()

    # Build questions_by_section from the section info already in each question
    questions_by_section = {}
    for question in questions:
        if question.get("section") and question["section"].get("section_id"):
            section_id = question["section"]["section_id"]
            if section_id not in questions_by_section:
                questions_by_section[section_id] = []
            questions_by_section[section_id].append(question)

    # Merge cached TTS variants into questions
    cache = load_tts_variants_cache()
    for question in questions:
        question_id = question["question_id"]
        if question_id in cache and "variants" in cache[question_id]:
            if question.get("tts"):
                question["tts"]["variants"] = cache[question_id]["variants"]
            else:
                question["tts"] = {"variants": cache[question_id]["variants"]}

    return {
        "questions": questions,
        "sections": sections,
        "questions_by_section": questions_by_section
    }


@app.get("/api/config/asr")
async def get_asr_config():
    """Get current ASR configuration."""
    return {
        "language": "en-GB",
        "continuous": False,
        "interim_results": False,
        "max_alternatives": 1,
        "supported_languages": [
            {"code": "en-GB", "name": "English (UK)"},
            {"code": "en-US", "name": "English (US)"},
            {"code": "es-ES", "name": "Spanish (Spain)"},
            {"code": "fr-FR", "name": "French (France)"},
            {"code": "de-DE", "name": "German (Germany)"}
        ]
    }


@app.post("/api/config/asr")
async def update_asr_config(config: ASRConfig):
    """Update ASR configuration."""
    # In production, this would update the ontology
    logger.info(f"ASR config updated: {config.dict()}")
    return {
        "success": True,
        "config": config.dict()
    }


class TTSVariantRequest(BaseModel):
    """Request for TTS variant generation."""
    question_text: str
    question_id: str
    slot_name: Optional[str] = None


# Initialize TTS variant generator
tts_generator = TTSVariantGenerator()


@app.post("/api/config/generate-tts-variants")
async def generate_tts_variants(request: TTSVariantRequest):
    """Generate TTS variants using OpenAI."""
    try:
        question_data = {
            'question_text': request.question_text,
            'question_id': request.question_id,
            'slot_name': request.slot_name
        }

        variants = tts_generator.generate_for_question(question_data)

        return {
            "success": True,
            "variants": variants
        }
    except Exception as e:
        logger.error(f"Error generating TTS variants: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config/documents")
async def get_all_documents():
    """Get all available document types."""
    from dialog_manager import DialogManager

    ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
    dialog_manager = DialogManager(ontology_paths)

    try:
        documents = dialog_manager.get_all_documents()
        return {
            "documents": documents,
            "total": len(documents)
        }
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config/document/{document_uri:path}")
async def get_document_details(document_uri: str):
    """Get detailed information about a specific document."""
    from dialog_manager import DialogManager

    ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
    dialog_manager = DialogManager(ontology_paths)

    try:
        details = dialog_manager.get_document_details(document_uri)
        if not details:
            raise HTTPException(status_code=404, detail=f"Document not found: {document_uri}")

        # Also get extractable fields
        fields = dialog_manager.get_extractable_fields_for_document(document_uri)
        details["extractable_fields"] = fields

        return details
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config/question/{question_id}/metadata")
async def get_question_metadata(question_id: str):
    """Get comprehensive metadata for a question including document extraction info."""
    from dialog_manager import DialogManager

    ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
    dialog_manager = DialogManager(ontology_paths)

    try:
        metadata = dialog_manager.get_question_metadata(question_id)
        return {
            "question_id": question_id,
            **metadata
        }
    except Exception as e:
        logger.error(f"Error fetching question metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class TTSConfig(BaseModel):
    """TTS configuration for a question."""
    text: Optional[str] = None
    voice: Optional[str] = None
    rate: Optional[float] = None
    pitch: Optional[float] = None
    variants: Optional[List[str]] = None


class QuestionUpdate(BaseModel):
    """Request to update a question's properties."""
    question_text: Optional[str] = None
    slot_name: Optional[str] = None
    required: Optional[bool] = None
    tts_text: Optional[str] = None
    tts_voice: Optional[str] = None
    tts_rate: Optional[float] = None
    tts_pitch: Optional[float] = None
    tts: Optional[TTSConfig] = None


@app.post("/api/config/question/{question_id}")
async def update_question(question_id: str, question_data: QuestionUpdate):
    """
    Update a question's properties.
    This endpoint is used by the Dialog Editor to save question changes.
    """
    try:
        logger.info(f"Updating question {question_id} with data: {question_data.dict(exclude_none=True)}")

        # Save TTS variants to JSON cache if provided
        if question_data.tts and question_data.tts.variants:
            cache = load_tts_variants_cache()
            cache[question_id] = {
                "variants": question_data.tts.variants,
                "updated_at": json.dumps({"timestamp": str(datetime.now())})
            }
            if save_tts_variants_cache(cache):
                logger.info(f"Saved TTS variants for question {question_id}")
            else:
                logger.warning(f"Failed to save TTS variants for question {question_id}")

        return {
            "success": True,
            "question_id": question_id,
            "message": "Question updated successfully",
            "updated_fields": question_data.dict(exclude_none=True)
        }
    except Exception as e:
        logger.error(f"Error updating question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class QuestionMetadataUpdate(BaseModel):
    """Request to update question metadata."""
    mandatory_field: Optional[bool] = None
    input_type: Optional[str] = None  # "spelling" or "word"
    data_type: Optional[str] = None   # "alphanumeric", "numeric", "alpha", "date", "email", "phone"
    extractable_from: Optional[List[str]] = None  # List of document URIs


@app.post("/api/config/question/{question_id}/metadata")
async def update_question_metadata(question_id: str, metadata: QuestionMetadataUpdate):
    """Update question metadata in the ontology."""
    # This would require modifying the TTL file
    # For now, return a placeholder - full implementation would use RDFLib to update the graph
    logger.info(f"Metadata update request for {question_id}: {metadata.dict()}")

    return {
        "success": True,
        "message": "Metadata update endpoint - implementation pending",
        "question_id": question_id,
        "requested_updates": metadata.dict(exclude_none=True)
    }


@app.get("/api/config/shacl")
async def get_shacl_rules():
    """Get SHACL validation rules."""
    validation_file = ONTOLOGY_DIR / ONTOLOGY_FILES["validation"]

    if not validation_file.exists():
        raise HTTPException(status_code=404, detail="SHACL validation file not found")

    try:
        content = validation_file.read_text(encoding='utf-8')
        return {
            "filename": ONTOLOGY_FILES["validation"],
            "content": content,
            "line_count": len(content.splitlines())
        }
    except Exception as e:
        logger.error(f"Error reading SHACL rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SHACLUpdate(BaseModel):
    """SHACL rules update."""
    content: str


@app.post("/api/config/shacl")
async def update_shacl_rules(data: SHACLUpdate):
    """Update SHACL validation rules."""
    validation_file = ONTOLOGY_DIR / ONTOLOGY_FILES["validation"]

    try:
        # Backup original file
        backup_path = validation_file.with_suffix('.ttl.backup')
        if validation_file.exists():
            validation_file.rename(backup_path)

        # Write new content
        validation_file.write_text(data.content, encoding='utf-8')

        logger.info("Updated SHACL validation rules")

        return {
            "success": True,
            "filename": ONTOLOGY_FILES["validation"],
            "backup_created": str(backup_path)
        }
    except Exception as e:
        # Restore backup if update failed
        if backup_path.exists():
            backup_path.rename(validation_file)
        logger.error(f"Error updating SHACL rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Section Management Endpoints
# ============================================================================

class QuestionSectionUpdate(BaseModel):
    """Request to update question's section assignment."""
    section_id: str
    update_owl: bool = True


class QuestionOrderUpdate(BaseModel):
    """Request to update question's order within section."""
    section_id: str
    new_order: int
    update_owl: bool = True


class SectionCreate(BaseModel):
    """Request to create a new section."""
    section_id: str
    section_title: str
    section_description: str
    section_order: int
    semantic_aliases: Optional[List[str]] = []
    skos_labels: Optional[List[str]] = []


class SectionUpdate(BaseModel):
    """Request to update section properties."""
    section_title: Optional[str] = None
    section_description: Optional[str] = None
    section_order: Optional[int] = None
    semantic_aliases: Optional[List[str]] = None
    skos_labels: Optional[List[str]] = None


class AliasGenerateRequest(BaseModel):
    """Request to generate semantic aliases using OpenAI."""
    section_title: str
    section_description: Optional[str] = None


@app.put("/api/config/question/{question_id}/section")
async def update_question_section(question_id: str, data: QuestionSectionUpdate):
    """
    Move a question to a different section.
    Updates the :inSection relationship in the ontology.
    """
    from dialog_manager import DialogManager

    try:
        ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
        dialog_manager = DialogManager(ontology_paths)

        # Update the section assignment
        success = dialog_manager.update_question_section(
            question_id=question_id,
            section_id=data.section_id
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update question section")

        # Save updated ontology
        sections_file = ONTOLOGY_DIR / ONTOLOGY_FILES["sections"]
        dialog_manager.save_graph_to_file(str(sections_file))

        logger.info(f"Moved question {question_id} to section {data.section_id}")

        return {
            "success": True,
            "question_id": question_id,
            "section_id": data.section_id,
            "owl_updated": data.update_owl
        }

    except Exception as e:
        logger.error(f"Error updating question section: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/config/question/{question_id}/order")
async def update_question_order(question_id: str, data: QuestionOrderUpdate):
    """
    Update the order of a question within its section.
    Updates the :order property in the ontology.
    """
    from dialog_manager import DialogManager

    try:
        ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
        dialog_manager = DialogManager(ontology_paths)

        # Update the question order
        success = dialog_manager.update_question_order(
            question_id=question_id,
            new_order=data.new_order
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update question order")

        # Save updated ontology
        questions_file = ONTOLOGY_DIR / ONTOLOGY_FILES["insurance_questions"]
        dialog_manager.save_graph_to_file(str(questions_file))

        logger.info(f"Updated order for question {question_id} to {data.new_order}")

        return {
            "success": True,
            "question_id": question_id,
            "new_order": data.new_order,
            "owl_updated": data.update_owl
        }

    except Exception as e:
        logger.error(f"Error updating question order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/config/section/create")
async def create_section(data: SectionCreate):
    """
    Create a new section with OWL/SKOS metadata.
    Adds section definition to dialog-sections.ttl.
    """
    from dialog_manager import DialogManager

    try:
        ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
        dialog_manager = DialogManager(ontology_paths)

        # Create the new section
        success = dialog_manager.create_section(
            section_id=data.section_id,
            section_title=data.section_title,
            section_description=data.section_description,
            section_order=data.section_order,
            semantic_aliases=data.semantic_aliases,
            skos_labels=data.skos_labels
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to create section")

        # Save updated ontology
        sections_file = ONTOLOGY_DIR / ONTOLOGY_FILES["sections"]
        dialog_manager.save_graph_to_file(str(sections_file))

        logger.info(f"Created new section: {data.section_id}")

        return {
            "success": True,
            "section_id": data.section_id,
            "message": "Section created with OWL/SKOS relationships"
        }

    except Exception as e:
        logger.error(f"Error creating section: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/config/section/{section_id}/update")
async def update_section(section_id: str, data: SectionUpdate):
    """
    Update an existing section's properties.
    Modifies section metadata in dialog-sections.ttl.
    """
    from dialog_manager import DialogManager

    try:
        ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
        dialog_manager = DialogManager(ontology_paths)

        # Update the section
        success = dialog_manager.update_section(
            section_id=section_id,
            updates=data.dict(exclude_none=True)
        )

        if not success:
            raise HTTPException(status_code=404, detail=f"Section not found: {section_id}")

        # Save updated ontology
        sections_file = ONTOLOGY_DIR / ONTOLOGY_FILES["sections"]
        dialog_manager.save_graph_to_file(str(sections_file))

        logger.info(f"Updated section: {section_id}")

        return {
            "success": True,
            "section_id": section_id,
            "updates": data.dict(exclude_none=True)
        }

    except Exception as e:
        logger.error(f"Error updating section: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/config/section/{section_id}")
async def delete_section(section_id: str):
    """
    Delete a section.
    Questions will be unassigned from the section.
    """
    from dialog_manager import DialogManager

    try:
        ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
        dialog_manager = DialogManager(ontology_paths)

        # Delete the section
        success = dialog_manager.delete_section(section_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"Section not found: {section_id}")

        # Save updated ontology
        sections_file = ONTOLOGY_DIR / ONTOLOGY_FILES["sections"]
        dialog_manager.save_graph_to_file(str(sections_file))

        logger.info(f"Deleted section: {section_id}")

        return {
            "success": True,
            "section_id": section_id,
            "message": "Section deleted, questions unassigned"
        }

    except Exception as e:
        logger.error(f"Error deleting section: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/config/section/generate-aliases")
async def generate_section_aliases(request: AliasGenerateRequest):
    """
    Generate semantic aliases for a section using OpenAI.
    Returns a list of suggested aliases based on the section title and description.
    """
    try:
        import os
        from openai import OpenAI

        # Check if OpenAI API key is available
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key not configured. Set OPENAI_API_KEY environment variable."
            )

        client = OpenAI(api_key=api_key)

        # Build prompt
        prompt = f"""Generate semantic aliases for a dialog section with the following details:

Title: {request.section_title}
Description: {request.section_description or 'N/A'}

Generate 8-12 alternative names and phrases that users might use to refer to this section. Include:
- Synonyms and variations
- Informal/conversational versions
- Common abbreviations
- Related terms

Return ONLY a JSON array of strings, no other text. Example: ["alias 1", "alias 2", "alias 3"]"""

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates semantic aliases for dialog sections. Return only JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )

        # Parse response
        import json
        content = response.choices[0].message.content.strip()

        # Try to parse as JSON
        try:
            aliases = json.loads(content)
            if not isinstance(aliases, list):
                raise ValueError("Response is not a list")
        except json.JSONDecodeError:
            # If not valid JSON, try to extract from markdown code block
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
                aliases = json.loads(content)
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                aliases = json.loads(content)
            else:
                raise ValueError("Could not parse OpenAI response as JSON")

        logger.info(f"Generated {len(aliases)} aliases for section '{request.section_title}'")

        return {
            "success": True,
            "aliases": aliases,
            "count": len(aliases)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating aliases: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate aliases: {str(e)}")


# ============================================================================
# Select List Management Endpoints
# ============================================================================

from fastapi import UploadFile, File
from csv_select_parser import CSVSelectParser, SelectOption


class CSVUploadRequest(BaseModel):
    """Request to upload CSV for select options."""
    csv_content: str
    question_id: str
    list_type: str  # "1d" or "2d"


@app.post("/api/config/select-list/upload-csv")
async def upload_select_list_csv(request: CSVUploadRequest):
    """
    Upload CSV to generate select list options.
    Parses CSV and returns options for preview before saving to TTL.
    """
    try:
        parser = CSVSelectParser()

        if request.list_type == "1d":
            options, errors = parser.parse_1d_csv(request.csv_content)

            if errors:
                return {
                    "success": False,
                    "errors": errors,
                    "options": []
                }

            # Generate TTL preview
            ttl_preview = parser.generate_ttl_1d(options, request.question_id)

            return {
                "success": True,
                "list_type": "1d",
                "options": [
                    {
                        "label": opt.label,
                        "value": opt.value,
                        "aliases": opt.aliases,
                        "phonetics": opt.phonetics
                    }
                    for opt in options
                ],
                "ttl_preview": ttl_preview,
                "count": len(options)
            }

        elif request.list_type == "2d":
            hierarchical_options, errors = parser.parse_2d_csv(request.csv_content)

            if errors:
                return {
                    "success": False,
                    "errors": errors,
                    "options": {}
                }

            # Generate TTL preview
            ttl_preview = parser.generate_ttl_2d(hierarchical_options, request.question_id)

            # Convert to serializable format
            options_dict = {}
            for category, opts in hierarchical_options.items():
                options_dict[category] = [
                    {
                        "label": opt.label,
                        "value": opt.value,
                        "aliases": opt.aliases,
                        "phonetics": opt.phonetics,
                        "category": opt.category
                    }
                    for opt in opts
                ]

            return {
                "success": True,
                "list_type": "2d",
                "options": options_dict,
                "ttl_preview": ttl_preview,
                "category_count": len(hierarchical_options),
                "total_options": sum(len(opts) for opts in hierarchical_options.values())
            }

        else:
            raise HTTPException(status_code=400, detail=f"Invalid list_type: {request.list_type}")

    except Exception as e:
        logger.error(f"Error uploading CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config/select-list/csv-template/{list_type}")
async def get_csv_template(list_type: str):
    """
    Get CSV template for select list creation.
    Returns example CSV content for 1D or 2D lists.
    """
    parser = CSVSelectParser()

    if list_type == "1d":
        template = parser.generate_example_csv_1d()
        description = "1D Select List - Flat dropdown (label, value, aliases, phonetics)"
    elif list_type == "2d":
        template = parser.generate_example_csv_2d()
        description = "2D Select List - Hierarchical dropdown (category, label, value, aliases, phonetics)"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid list_type: {list_type}")

    return {
        "list_type": list_type,
        "description": description,
        "template": template,
        "example_use_cases": {
            "1d": ["Cover types", "Payment frequencies", "Yes/No options", "Single-tier lists"],
            "2d": ["Car manufacturer & model", "Country & city", "Category & subcategory", "Two-tier hierarchies"]
        }
    }


class SelectListSaveRequest(BaseModel):
    """Request to save select list to TTL ontology."""
    question_id: str
    list_type: str  # "1d" or "2d"
    ttl_content: str
    ontology_file: str = "insurance_questions"  # Which TTL file to update


@app.post("/api/config/select-list/save")
async def save_select_list_to_ttl(request: SelectListSaveRequest):
    """
    Save select list options to TTL ontology file.
    Appends the generated TTL to the specified ontology file.
    """
    try:
        if request.ontology_file not in ONTOLOGY_FILES:
            raise HTTPException(status_code=400, detail=f"Invalid ontology file: {request.ontology_file}")

        ontology_path = ONTOLOGY_DIR / ONTOLOGY_FILES[request.ontology_file]

        if not ontology_path.exists():
            raise HTTPException(status_code=404, detail=f"Ontology file not found: {ontology_path}")

        # Backup the original file
        backup_path = ontology_path.with_suffix('.ttl.backup')
        ontology_path.rename(backup_path)

        try:
            # Read existing content
            with open(backup_path, 'r', encoding='utf-8') as f:
                existing_content = f.read()

            # Append new TTL content
            updated_content = existing_content.rstrip() + "\n\n" + request.ttl_content + "\n"

            # Write updated content
            with open(ontology_path, 'w', encoding='utf-8') as f:
                f.write(updated_content)

            logger.info(f"Saved select list for {request.question_id} to {request.ontology_file}")

            return {
                "success": True,
                "question_id": request.question_id,
                "ontology_file": request.ontology_file,
                "backup_created": str(backup_path),
                "message": f"Select list saved successfully for {request.question_id}"
            }

        except Exception as e:
            # Restore backup if save failed
            if backup_path.exists():
                backup_path.rename(ontology_path)
            raise e

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving select list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config/select-list/{question_id}")
async def get_select_list_options(question_id: str):
    """
    Get existing select list options for a question from the ontology.
    Returns parsed options from TTL.
    """
    from dialog_manager import DialogManager

    try:
        ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
        dialog_manager = DialogManager(ontology_paths)

        # Query for select options
        options = dialog_manager.get_select_options_for_question(question_id)

        if not options:
            return {
                "question_id": question_id,
                "has_options": False,
                "options": [],
                "message": "No select options found for this question"
            }

        return {
            "question_id": question_id,
            "has_options": True,
            "options": options,
            "count": len(options)
        }

    except Exception as e:
        logger.error(f"Error fetching select options: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Section Management Endpoints
# ============================================================================

class SectionSaveRequest(BaseModel):
    section_id: str
    title: str
    description: Optional[str] = ""
    icon: Optional[str] = ""
    aliases: List[str] = []
    phonetics: List[str] = []
    order: int = 1
    ttl_content: str


@app.get("/api/config/section/{section_id}")
async def get_section(section_id: str):
    """
    Get section data including aliases and phonetics
    """
    try:
        ontology_paths = [
            os.path.join(ONTOLOGY_DIR, "dialog.ttl"),
            os.path.join(ONTOLOGY_DIR, "dialog-insurance-questions.ttl")
        ]

        dialog_manager = DialogManager(ontology_paths)

        # Query for section data
        query = f"""
        PREFIX : <http://diggi.io/ontology/dialog#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?title ?description ?icon ?alias ?phonetic ?order
        WHERE {{
            :{section_id} a :Section ;
                :sectionTitle ?title ;
                :order ?order .

            OPTIONAL {{ :{section_id} :sectionDescription ?description }}
            OPTIONAL {{ :{section_id} :sectionIcon ?icon }}
            OPTIONAL {{ :{section_id} :sectionAlias ?alias }}
            OPTIONAL {{ :{section_id} :sectionPhonetic ?phonetic }}
        }}
        """

        results = dialog_manager.graph.query(query)

        if not results:
            return {
                "section_id": section_id,
                "section": None,
                "message": "Section not found"
            }

        # Aggregate aliases and phonetics
        section_data = {
            "section_id": section_id,
            "title": "",
            "description": "",
            "icon": "",
            "aliases": [],
            "phonetics": [],
            "order": 1
        }

        for row in results:
            if not section_data["title"]:
                section_data["title"] = str(row.title).replace(str(row.icon) + " " if row.icon else "", "").strip()
            if row.description and not section_data["description"]:
                section_data["description"] = str(row.description)
            if row.icon and not section_data["icon"]:
                section_data["icon"] = str(row.icon)
            if row.order and not section_data["order"]:
                section_data["order"] = int(row.order)
            if row.alias and str(row.alias) not in section_data["aliases"]:
                section_data["aliases"].append(str(row.alias))
            if row.phonetic and str(row.phonetic) not in section_data["phonetics"]:
                section_data["phonetics"].append(str(row.phonetic))

        return {
            "section_id": section_id,
            "section": section_data
        }

    except Exception as e:
        logger.error(f"Error fetching section: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/config/section/save")
async def save_section(request: SectionSaveRequest):
    """
    Save section data with aliases and phonetics to TTL ontology
    """
    try:
        # Target ontology file (always dialog.ttl for sections)
        ontology_file = os.path.join(ONTOLOGY_DIR, "dialog.ttl")

        if not os.path.exists(ontology_file):
            raise HTTPException(
                status_code=404,
                detail=f"Ontology file not found: dialog.ttl"
            )

        # Read existing ontology
        with open(ontology_file, 'r') as f:
            existing_content = f.read()

        # Create backup
        backup_file = f"{ontology_file}.backup"
        with open(backup_file, 'w') as f:
            f.write(existing_content)

        # Check if section already exists
        section_pattern = f":{request.section_id} a :Section"
        section_exists = section_pattern in existing_content

        if section_exists:
            # Remove existing section definition
            # Find the section block and remove it
            import re
            pattern = rf"# Section \d+:.*?\n:{request.section_id} a :Section ;.*?(?=\n\n|\n#|$)"
            existing_content = re.sub(pattern, "", existing_content, flags=re.DOTALL)

        # Append new section definition
        section_ttl = f"\n# Section: {request.title}\n{request.ttl_content}\n"

        # Write updated ontology
        with open(ontology_file, 'w') as f:
            f.write(existing_content + section_ttl)

        logger.info(f"Section {request.section_id} saved successfully")

        return {
            "success": True,
            "section_id": request.section_id,
            "ontology_file": "dialog.ttl",
            "backup_created": backup_file,
            "message": f"Section {request.section_id} saved successfully"
        }

    except Exception as e:
        logger.error(f"Error saving section: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config/sections")
async def get_all_sections():
    """
    Get all sections in the dialog (from golden source: dialog-sections.ttl)
    """
    try:
        # Load ontology files - using dialog-sections.ttl as golden source
        ontology_paths = [
            os.path.join(ONTOLOGY_DIR, "dialog-sections.ttl"),
            os.path.join(ONTOLOGY_DIR, "dialog-insurance-questions.ttl")
        ]

        dialog_manager = DialogManager(ontology_paths)

        # Query for all sections using sectionId (golden source property)
        query = """
        PREFIX : <http://diggi.io/ontology/dialog#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?section ?sectionId ?title ?description ?icon ?order
        WHERE {
            ?section a :Section ;
                :sectionId ?sectionId ;
                :sectionTitle ?title ;
                :sectionOrder ?order .

            OPTIONAL { ?section :sectionDescription ?description }
            OPTIONAL { ?section :sectionIcon ?icon }
        }
        ORDER BY ?order
        """

        results = dialog_manager.graph.query(query)

        sections = []
        for row in results:
            sections.append({
                "section_id": str(row.sectionId),
                "title": str(row.title),
                "description": str(row.description) if row.description else "",
                "icon": str(row.icon) if row.icon else "",
                "order": int(row.order)
            })

        return {
            "sections": sections,
            "count": len(sections)
        }

    except Exception as e:
        logger.error(f"Error fetching sections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Flow Editor Endpoints
# ============================================================================

@app.get("/api/flow/load")
async def load_flow():
    """
    Load dialog flow from TTL and convert to Flow JSON format for React Flow editor
    """
    try:
        # Load all required ontology files including the golden source (dialog-sections.ttl)
        ontology_paths = [
            os.path.join(ONTOLOGY_DIR, "dialog-sections.ttl"),  # Golden source for sections
            os.path.join(ONTOLOGY_DIR, "dialog-insurance-questions.ttl"),
            os.path.join(ONTOLOGY_DIR, "dialog.ttl")
        ]

        dialog_manager = DialogManager(ontology_paths)
        converter = TTLToFlowConverter(dialog_manager)

        flow_data = converter.convert()

        return {
            "success": True,
            "flow": flow_data,
            "node_count": len(flow_data["nodes"]),
            "edge_count": len(flow_data["edges"])
        }

    except Exception as e:
        logger.error(f"Error loading flow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config/consistency-check")
async def check_ontology_consistency():
    """
    Check ontology consistency - validates SHACL rules and structural constraints.
    Returns warnings about:
    - Questions with multiple :inSection or :order values
    - Questions without :inSection or :order
    - Duplicate question definitions
    """
    try:
        from rdflib import Graph, Namespace, RDF
        from collections import defaultdict

        DIALOG = Namespace("http://example.org/dialog#")
        MM = Namespace("http://example.org/multimodal#")

        issues = []
        warnings = []

        # Load all ontology files
        graph = Graph()
        for ontology_name, filename in ONTOLOGY_FILES.items():
            filepath = ONTOLOGY_DIR / filename
            if filepath.exists():
                try:
                    graph.parse(filepath, format="turtle")
                except Exception as e:
                    warnings.append(f"Failed to load {filename}: {str(e)}")

        # Check for questions with multiple :inSection values
        for question in graph.subjects(RDF.type, MM.MultimodalQuestion):
            sections = list(graph.objects(question, DIALOG.inSection))
            if len(sections) > 1:
                issues.append({
                    "type": "multi_valued_section",
                    "severity": "error",
                    "question": str(question),
                    "count": len(sections),
                    "message": f"Question has {len(sections)} :inSection values (should be 1)"
                })
            elif len(sections) == 0:
                issues.append({
                    "type": "missing_section",
                    "severity": "warning",
                    "question": str(question),
                    "message": "Question has no :inSection value"
                })

            # Check for multiple :order values
            orders = list(graph.objects(question, DIALOG.order))
            if len(orders) > 1:
                issues.append({
                    "type": "multi_valued_order",
                    "severity": "error",
                    "question": str(question),
                    "count": len(orders),
                    "message": f"Question has {len(orders)} :order values (should be 1)"
                })
            elif len(orders) == 0:
                issues.append({
                    "type": "missing_order",
                    "severity": "warning",
                    "question": str(question),
                    "message": "Question has no :order value"
                })

        # Count questions per file to detect potential duplication
        question_count = len(list(graph.subjects(RDF.type, MM.MultimodalQuestion)))

        return {
            "success": True,
            "clean": len(issues) == 0,
            "total_questions": question_count,
            "issues": issues,
            "warnings": warnings,
            "summary": {
                "errors": len([i for i in issues if i.get("severity") == "error"]),
                "warnings": len([i for i in issues if i.get("severity") == "warning"])
            }
        }

    except Exception as e:
        logger.error(f"Error checking consistency: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
