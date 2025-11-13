"""
Admin Panel API - Operator review system for low-confidence answers
Handles review queue, audio playback, manual transcription, and rephrase requests
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
import uuid
from pathlib import Path

from dialog_manager import DialogManager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Dialog Admin Panel API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# Get TTL configuration
ttl_config = dialog_manager.get_ttl_configuration()
RECORDING_TTL = ttl_config["recording"]


class ReviewStatus(str, Enum):
    """Review workflow states from TTL ontology."""
    PENDING = "PENDING"
    IN_REVIEW = "IN_REVIEW"
    TRANSCRIBED = "TRANSCRIBED"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"
    REPHRASE_REQUESTED = "REPHRASE_REQUESTED"


class ReviewItem(BaseModel):
    """Item in the operator review queue."""
    review_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    question_id: str
    question_text: str
    slot_name: str
    original_transcription: Optional[str] = None
    confidence_score: float
    threshold: float
    priority: int  # From TTL (1 = highest)
    audio_path: Optional[str] = None
    audio_metrics: Optional[Dict] = None
    status: ReviewStatus = ReviewStatus.PENDING
    operator_id: Optional[str] = None
    transcribed_text: Optional[str] = None
    operator_confidence: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.now)
    reviewed_at: Optional[datetime] = None
    notes: Optional[str] = None


class TranscriptionRequest(BaseModel):
    """Operator manual transcription."""
    review_id: str
    transcribed_text: str
    operator_confidence: float
    operator_id: str
    notes: Optional[str] = None


class RephraseRequest(BaseModel):
    """Request to send rephrase prompt back to user."""
    review_id: str
    operator_id: str
    template_type: str = "phonetic"  # phonetic, slow, confirmation, example
    custom_message: Optional[str] = None


class ValidationRequest(BaseModel):
    """Validate or reject a transcription."""
    review_id: str
    operator_id: str
    approved: bool
    notes: Optional[str] = None


# In-memory review queue (use database in production)
review_queue: Dict[str, ReviewItem] = {}

# Active WebSocket connections for real-time notifications
active_connections: List[WebSocket] = []


# WebSocket Connection Manager
class ConnectionManager:
    """Manages WebSocket connections for real-time notifications."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")


manager = ConnectionManager()


# Helper Functions
def get_review_item(review_id: str) -> ReviewItem:
    """Get review item or raise 404."""
    if review_id not in review_queue:
        raise HTTPException(status_code=404, detail="Review item not found")
    return review_queue[review_id]


def check_workflow_transition(current_status: ReviewStatus, new_status: ReviewStatus) -> bool:
    """
    Validate workflow state transitions based on TTL ontology.
    This would query the ontology in production.
    """
    allowed_transitions = {
        ReviewStatus.PENDING: [ReviewStatus.IN_REVIEW, ReviewStatus.REPHRASE_REQUESTED],
        ReviewStatus.IN_REVIEW: [ReviewStatus.TRANSCRIBED, ReviewStatus.REJECTED, ReviewStatus.REPHRASE_REQUESTED],
        ReviewStatus.TRANSCRIBED: [ReviewStatus.VALIDATED, ReviewStatus.REJECTED],
        ReviewStatus.REPHRASE_REQUESTED: [ReviewStatus.PENDING],
    }
    
    return new_status in allowed_transitions.get(current_status, [])


async def notify_new_review_item(item: ReviewItem):
    """Send real-time notification about new review item."""
    await manager.broadcast({
        "type": "new_review_item",
        "data": item.dict(),
        "timestamp": datetime.now().isoformat()
    })


async def notify_status_change(review_id: str, old_status: str, new_status: str):
    """Notify about status change."""
    await manager.broadcast({
        "type": "status_change",
        "review_id": review_id,
        "old_status": old_status,
        "new_status": new_status,
        "timestamp": datetime.now().isoformat()
    })


# API Endpoints
@app.get("/api/admin/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "queue_size": len(review_queue),
        "active_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/admin/review/create")
async def create_review_item(
    session_id: str,
    question_id: str,
    confidence_score: float,
    original_transcription: Optional[str] = None,
    audio_path: Optional[str] = None
):
    """
    Create a new review item for operator review.
    Called when confidence score is below threshold.
    """
    # Get question details and threshold from TTL
    flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")
    question = next((q for q in flow if q.get("question_id") == question_id), None)
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    threshold, priority = dialog_manager.get_confidence_threshold(question_id)
    
    item = ReviewItem(
        session_id=session_id,
        question_id=question_id,
        question_text=question["question_text"],
        slot_name=question["slot_name"],
        original_transcription=original_transcription,
        confidence_score=confidence_score,
        threshold=threshold,
        priority=priority,
        audio_path=audio_path
    )
    
    review_queue[item.review_id] = item
    
    # Notify connected operators
    await notify_new_review_item(item)
    
    logger.info(
        f"Created review item {item.review_id} for question {question_id} "
        f"(confidence: {confidence_score:.2f}, threshold: {threshold:.2f}, priority: {priority})"
    )
    
    return {
        "review_id": item.review_id,
        "priority": priority,
        "requires_review": True
    }


@app.get("/api/admin/review/queue")
async def get_review_queue(
    status: Optional[ReviewStatus] = None,
    priority_min: Optional[int] = None,
    priority_max: Optional[int] = None,
    limit: int = 50
):
    """
    Get review queue with filtering and priority sorting.
    Priority 1 = highest priority (from TTL).
    """
    items = list(review_queue.values())
    
    # Filter by status
    if status:
        items = [item for item in items if item.status == status]
    
    # Filter by priority
    if priority_min is not None:
        items = [item for item in items if item.priority >= priority_min]
    if priority_max is not None:
        items = [item for item in items if item.priority <= priority_max]
    
    # Sort by priority (1 = highest) then by creation time
    items.sort(key=lambda x: (x.priority, x.created_at))
    
    return {
        "total": len(items),
        "items": [item.dict() for item in items[:limit]]
    }


@app.get("/api/admin/review/{review_id}")
async def get_review_item_detail(review_id: str):
    """Get detailed information about a review item."""
    item = get_review_item(review_id)
    
    # Get multimodal features for context
    features = dialog_manager.get_multimodal_features(item.question_id)
    
    return {
        "review": item.dict(),
        "multimodal_features": features,
        "allowed_transitions": [
            status.value for status in [ReviewStatus.IN_REVIEW, ReviewStatus.REPHRASE_REQUESTED]
            if check_workflow_transition(item.status, status)
        ]
    }


@app.post("/api/admin/review/{review_id}/claim")
async def claim_review_item(review_id: str, operator_id: str):
    """Operator claims a review item to work on it."""
    item = get_review_item(review_id)
    
    if item.status != ReviewStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Item not in PENDING status (current: {item.status})"
        )
    
    old_status = item.status
    item.status = ReviewStatus.IN_REVIEW
    item.operator_id = operator_id
    
    await notify_status_change(review_id, old_status.value, item.status.value)
    
    return {"success": True, "status": item.status}


@app.post("/api/admin/review/{review_id}/transcribe")
async def submit_transcription(request: TranscriptionRequest):
    """Submit manual transcription with operator confidence score."""
    item = get_review_item(request.review_id)
    
    if item.status != ReviewStatus.IN_REVIEW:
        raise HTTPException(
            status_code=400,
            detail=f"Item not in IN_REVIEW status (current: {item.status})"
        )
    
    # Validate operator confidence
    if not 0.0 <= request.operator_confidence <= 1.0:
        raise HTTPException(
            status_code=400,
            detail="Operator confidence must be between 0.0 and 1.0"
        )
    
    old_status = item.status
    item.status = ReviewStatus.TRANSCRIBED
    item.transcribed_text = request.transcribed_text
    item.operator_confidence = request.operator_confidence
    item.operator_id = request.operator_id
    item.notes = request.notes
    item.reviewed_at = datetime.now()
    
    await notify_status_change(request.review_id, old_status.value, item.status.value)
    
    logger.info(
        f"Transcription submitted for {request.review_id} by operator {request.operator_id} "
        f"(confidence: {request.operator_confidence:.2f})"
    )
    
    return {
        "success": True,
        "transcribed_text": item.transcribed_text,
        "operator_confidence": item.operator_confidence,
        "status": item.status
    }


@app.post("/api/admin/review/{review_id}/rephrase")
async def request_rephrase(request: RephraseRequest):
    """Send rephrase request back to user in the dialog."""
    item = get_review_item(request.review_id)
    
    if not check_workflow_transition(item.status, ReviewStatus.REPHRASE_REQUESTED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot request rephrase from status {item.status}"
        )
    
    # Get rephrase template from TTL
    template = dialog_manager.get_rephrase_template(
        item.question_id,
        request.template_type
    )
    
    message = request.custom_message or template["template"].format(
        field_name=item.slot_name
    )
    
    old_status = item.status
    item.status = ReviewStatus.REPHRASE_REQUESTED
    item.operator_id = request.operator_id
    
    await notify_status_change(request.review_id, old_status.value, item.status.value)
    
    # In production, this would send the rephrase request back to the dialog session
    logger.info(
        f"Rephrase requested for {request.review_id} by operator {request.operator_id}"
    )
    
    return {
        "success": True,
        "rephrase_message": message,
        "tts_config": template["tts_config"],
        "status": item.status
    }


@app.post("/api/admin/review/{review_id}/validate")
async def validate_transcription(request: ValidationRequest):
    """Validate or reject a transcription (supervisor action)."""
    item = get_review_item(request.review_id)
    
    if item.status != ReviewStatus.TRANSCRIBED:
        raise HTTPException(
            status_code=400,
            detail=f"Item not in TRANSCRIBED status (current: {item.status})"
        )
    
    old_status = item.status
    if request.approved:
        item.status = ReviewStatus.VALIDATED
    else:
        item.status = ReviewStatus.REJECTED
        item.notes = request.notes
    
    await notify_status_change(request.review_id, old_status.value, item.status.value)
    
    logger.info(
        f"Transcription {'validated' if request.approved else 'rejected'} "
        f"for {request.review_id} by operator {request.operator_id}"
    )
    
    return {
        "success": True,
        "approved": request.approved,
        "status": item.status
    }


@app.get("/api/admin/stats")
async def get_statistics():
    """Get statistics about the review queue."""
    items = list(review_queue.values())
    
    status_counts = {}
    for status in ReviewStatus:
        status_counts[status.value] = len([i for i in items if i.status == status])
    
    priority_distribution = {}
    for i in range(1, 6):
        priority_distribution[i] = len([item for item in items if item.priority == i])
    
    avg_confidence = sum(item.confidence_score for item in items) / len(items) if items else 0
    
    return {
        "total_items": len(items),
        "status_distribution": status_counts,
        "priority_distribution": priority_distribution,
        "average_confidence": avg_confidence,
        "pending_high_priority": len([
            i for i in items 
            if i.status == ReviewStatus.PENDING and i.priority <= 2
        ])
    }


@app.get("/api/admin/operator/workload/{operator_id}")
async def get_operator_workload(operator_id: str):
    """Get operator's current workload and statistics."""
    items = [item for item in review_queue.values() if item.operator_id == operator_id]
    
    return {
        "operator_id": operator_id,
        "active_items": len([i for i in items if i.status == ReviewStatus.IN_REVIEW]),
        "completed_today": len([
            i for i in items 
            if i.status in [ReviewStatus.VALIDATED, ReviewStatus.TRANSCRIBED]
            and i.reviewed_at and i.reviewed_at.date() == datetime.now().date()
        ]),
        "total_handled": len(items)
    }


# WebSocket for real-time notifications
@app.websocket("/ws/admin")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket connection for real-time operator notifications."""
    await manager.connect(websocket)
    
    try:
        # Send initial queue state
        items = list(review_queue.values())
        await websocket.send_json({
            "type": "initial_state",
            "queue_size": len(items),
            "pending_items": len([i for i in items if i.status == ReviewStatus.PENDING]),
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# Cleanup expired recordings
@app.on_event("startup")
async def startup_event():
    """Startup tasks."""
    logger.info("Starting admin panel API")
    logger.info(f"Recording TTL: {RECORDING_TTL}")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown tasks."""
    logger.info("Shutting down admin panel API")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
