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

# Ontology file paths
ONTOLOGY_DIR = Path("../ontologies")
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
    """List all questions with their TTS/ASR configurations and sections."""
    from dialog_manager import DialogManager

    ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
    dialog_manager = DialogManager(ontology_paths)

    flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")
    sections = dialog_manager.get_all_sections()
    questions_by_section = dialog_manager.get_questions_by_section()

    questions = []

    for node in flow:
        if "question_id" in node:
            question_id = node["question_id"]
            features = dialog_manager.get_multimodal_features(question_id)
            threshold, priority = dialog_manager.get_confidence_threshold(question_id)

            # Get section for this question
            section_info = dialog_manager.get_section_for_question(question_id)

            questions.append({
                "question_id": question_id,
                "question_text": node["question_text"],
                "slot_name": node["slot_name"],
                "required": node["required"],
                "tts": features["tts"],
                "visual_components": features["visual_components"],
                "select_options": features["select_options"],
                "faqs": features["faqs"],
                "confidence_threshold": threshold,
                "priority": priority,
                "section": section_info
            })

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
