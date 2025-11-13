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
    "vocabularies": "dialog-vocabularies.ttl",
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
    """List all questions with their TTS/ASR configurations."""
    from dialog_manager import DialogManager

    ontology_paths = [str(ONTOLOGY_DIR / f) for f in ONTOLOGY_FILES.values()]
    dialog_manager = DialogManager(ontology_paths)

    flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")
    questions = []

    for node in flow:
        if "question_id" in node:
            question_id = node["question_id"]
            features = dialog_manager.get_multimodal_features(question_id)
            threshold, priority = dialog_manager.get_confidence_threshold(question_id)

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
                "priority": priority
            })

    return {"questions": questions}


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
