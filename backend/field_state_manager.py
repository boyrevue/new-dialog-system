"""
Field-level state management for document extraction workflow.

This module implements FCA-compliant field-level state tracking with:
- Selective re-ask (only failed fields, not entire documents)
- Audit trail for all state transitions
- Back office controls for field management
- Integration with OCR and dialog manager
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FieldState(str, Enum):
    """Field lifecycle states."""
    NOT_STARTED = "NOT_STARTED"
    ASK_PENDING = "ASK_PENDING"
    DOCUMENT_PROCESSING = "DOCUMENT_PROCESSING"
    COMPLETED = "COMPLETED"
    REASK_PENDING = "REASK_PENDING"
    LOCKED = "LOCKED"


class FieldSource(str, Enum):
    """Source of field value."""
    USER_INPUT = "user_input"
    DOCUMENT = "document"
    BACKOFFICE = "backoffice"
    SYSTEM = "system"


class StateChangeSource(str, Enum):
    """Who/what triggered the state change."""
    OCR = "ocr"
    BACKOFFICE = "backoffice"
    DIALOG = "dialog"
    SYSTEM = "system"


@dataclass
class FieldMeta:
    """Metadata for a field."""
    confidence: Optional[float] = None
    notes: Optional[str] = None
    document_id: Optional[str] = None
    extraction_method: Optional[str] = None
    previous_value: Optional[str] = None
    rejection_reason: Optional[str] = None
    ocr_raw_text: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'confidence': self.confidence,
            'notes': self.notes,
            'document_id': self.document_id,
            'extraction_method': self.extraction_method,
            'previous_value': self.previous_value,
            'rejection_reason': self.rejection_reason,
            'ocr_raw_text': self.ocr_raw_text
        }


@dataclass
class AuditEntry:
    """Audit trail entry for state changes."""
    timestamp: datetime
    from_state: FieldState
    to_state: FieldState
    changed_by: StateChangeSource
    document_id: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'timestamp': self.timestamp.isoformat(),
            'from_state': self.from_state,
            'to_state': self.to_state,
            'changed_by': self.changed_by,
            'document_id': self.document_id,
            'notes': self.notes
        }


@dataclass
class Field:
    """Represents a single field in the dialog."""
    field_id: str
    question_id: str
    slot_name: str
    state: FieldState = FieldState.NOT_STARTED
    value: Optional[str] = None
    source: Optional[FieldSource] = None
    last_updated_at: datetime = field(default_factory=datetime.now)
    meta: FieldMeta = field(default_factory=FieldMeta)
    audit_trail: List[AuditEntry] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'field_id': self.field_id,
            'question_id': self.question_id,
            'slot_name': self.slot_name,
            'state': self.state,
            'value': self.value,
            'source': self.source,
            'last_updated_at': self.last_updated_at.isoformat(),
            'meta': self.meta.to_dict(),
            'audit_trail': [entry.to_dict() for entry in self.audit_trail]
        }


class FieldStateManager:
    """Manages field-level states for a dialog session."""

    def __init__(self, session_id: str):
        """
        Initialize field state manager.

        Args:
            session_id: Unique session identifier
        """
        self.session_id = session_id
        self.fields: Dict[str, Field] = {}
        self.confidence_threshold = 0.75  # Default threshold for accepting OCR results

        logger.info(f"Initialized FieldStateManager for session {session_id}")

    def initialize_field(self, field_id: str, question_id: str, slot_name: str) -> Field:
        """
        Initialize a new field.

        Args:
            field_id: Unique field identifier
            question_id: Associated question ID from ontology
            slot_name: Slot name in data model

        Returns:
            Initialized Field object
        """
        if field_id in self.fields:
            logger.warning(f"Field {field_id} already initialized")
            return self.fields[field_id]

        new_field = Field(
            field_id=field_id,
            question_id=question_id,
            slot_name=slot_name,
            state=FieldState.ASK_PENDING
        )

        # Initial audit entry
        new_field.audit_trail.append(AuditEntry(
            timestamp=datetime.now(),
            from_state=FieldState.NOT_STARTED,
            to_state=FieldState.ASK_PENDING,
            changed_by=StateChangeSource.SYSTEM,
            notes="Field initialized"
        ))

        self.fields[field_id] = new_field
        logger.info(f"Initialized field {field_id} -> {slot_name}")

        return new_field

    def _change_state(
        self,
        field_id: str,
        new_state: FieldState,
        changed_by: StateChangeSource,
        document_id: Optional[str] = None,
        notes: Optional[str] = None
    ) -> bool:
        """
        Internal method to change field state with audit trail.

        Args:
            field_id: Field to update
            new_state: New state
            changed_by: Source of change
            document_id: Optional document ID
            notes: Optional notes about the change

        Returns:
            True if state changed, False otherwise
        """
        if field_id not in self.fields:
            logger.error(f"Field {field_id} not found")
            return False

        field = self.fields[field_id]
        old_state = field.state

        if old_state == new_state:
            logger.debug(f"Field {field_id} already in state {new_state}")
            return False

        # Create audit entry
        audit_entry = AuditEntry(
            timestamp=datetime.now(),
            from_state=old_state,
            to_state=new_state,
            changed_by=changed_by,
            document_id=document_id,
            notes=notes
        )

        # Update field
        field.state = new_state
        field.last_updated_at = datetime.now()
        field.audit_trail.append(audit_entry)

        logger.info(f"Field {field_id} state: {old_state} -> {new_state} (by {changed_by})")

        return True

    def on_document_uploaded(
        self,
        document_id: str,
        mapped_fields: List[str]
    ) -> int:
        """
        Called when a document is uploaded.

        Args:
            document_id: Unique document identifier
            mapped_fields: List of field_ids this document can provide

        Returns:
            Number of fields set to DOCUMENT_PROCESSING
        """
        count = 0

        for field_id in mapped_fields:
            if field_id not in self.fields:
                logger.warning(f"Field {field_id} not initialized, skipping")
                continue

            field = self.fields[field_id]

            # Only process fields that aren't already completed or locked
            if field.state in [FieldState.COMPLETED, FieldState.LOCKED]:
                logger.debug(f"Field {field_id} is {field.state}, skipping document processing")
                continue

            # Set source and state
            field.source = FieldSource.DOCUMENT
            field.meta.document_id = document_id

            self._change_state(
                field_id,
                FieldState.DOCUMENT_PROCESSING,
                StateChangeSource.OCR,
                document_id=document_id,
                notes=f"Document {document_id} uploaded, processing started"
            )

            count += 1

        logger.info(f"Document {document_id} uploaded: {count} fields set to DOCUMENT_PROCESSING")
        return count

    def on_document_field_result(
        self,
        field_id: str,
        value: Optional[str],
        confidence: float,
        status: str,
        document_id: Optional[str] = None,
        ocr_raw_text: Optional[str] = None
    ) -> bool:
        """
        Called when OCR/back-office processing completes for a field.

        Args:
            field_id: Field identifier
            value: Extracted value (if any)
            confidence: Confidence score (0-1)
            status: "accepted" or "rejected"
            document_id: Optional document ID
            ocr_raw_text: Raw OCR text for audit

        Returns:
            True if field accepted, False if rejected/re-ask needed
        """
        if field_id not in self.fields:
            logger.error(f"Field {field_id} not found")
            return False

        field = self.fields[field_id]

        # Update metadata
        field.meta.confidence = confidence
        field.meta.ocr_raw_text = ocr_raw_text
        if document_id:
            field.meta.document_id = document_id

        # Determine if we accept or reject
        accepted = (
            status == "accepted" and
            confidence >= self.confidence_threshold and
            value is not None
        )

        if accepted:
            # Accept: mark as COMPLETED
            field.value = value

            self._change_state(
                field_id,
                FieldState.COMPLETED,
                StateChangeSource.OCR,
                document_id=document_id,
                notes=f"OCR accepted: confidence={confidence:.2f}, value='{value}'"
            )

            logger.info(f"Field {field_id} ACCEPTED from OCR: {value} (confidence={confidence:.2f})")
            return True

        else:
            # Reject: mark for re-ask
            field.meta.previous_value = value  # Store attempted value
            field.meta.rejection_reason = f"Low confidence ({confidence:.2f}) or status={status}"

            self._change_state(
                field_id,
                FieldState.REASK_PENDING,
                StateChangeSource.OCR,
                document_id=document_id,
                notes=f"OCR rejected: {field.meta.rejection_reason}"
            )

            logger.warning(f"Field {field_id} REJECTED from OCR: confidence={confidence:.2f}, marking for re-ask")
            return False

    def release_field_for_reask(
        self,
        field_id: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Back office control: Release a specific field for re-asking.

        Args:
            field_id: Field to release
            reason: Optional reason for release

        Returns:
            True if released, False otherwise
        """
        if field_id not in self.fields:
            logger.error(f"Field {field_id} not found")
            return False

        field = self.fields[field_id]

        # Store current value as previous
        if field.value:
            field.meta.previous_value = field.value
            field.value = None  # Clear for re-ask

        field.meta.notes = reason or "Released by back office for re-ask"

        self._change_state(
            field_id,
            FieldState.REASK_PENDING,
            StateChangeSource.BACKOFFICE,
            notes=field.meta.notes
        )

        logger.info(f"Field {field_id} released for re-ask: {reason}")
        return True

    def lock_field(self, field_id: str, reason: Optional[str] = None) -> bool:
        """
        Lock a field to prevent further changes.

        Args:
            field_id: Field to lock
            reason: Optional reason for locking

        Returns:
            True if locked, False otherwise
        """
        if field_id not in self.fields:
            logger.error(f"Field {field_id} not found")
            return False

        self._change_state(
            field_id,
            FieldState.LOCKED,
            StateChangeSource.BACKOFFICE,
            notes=reason or "Field locked by back office"
        )

        logger.info(f"Field {field_id} LOCKED: {reason}")
        return True

    def unlock_field(self, field_id: str) -> bool:
        """
        Unlock a field (set to ASK_PENDING or REASK_PENDING based on value).

        Args:
            field_id: Field to unlock

        Returns:
            True if unlocked, False otherwise
        """
        if field_id not in self.fields:
            logger.error(f"Field {field_id} not found")
            return False

        field = self.fields[field_id]

        # Choose appropriate state
        new_state = FieldState.REASK_PENDING if field.value else FieldState.ASK_PENDING

        self._change_state(
            field_id,
            new_state,
            StateChangeSource.BACKOFFICE,
            notes="Field unlocked by back office"
        )

        logger.info(f"Field {field_id} UNLOCKED -> {new_state}")
        return True

    def mark_answered(
        self,
        field_id: str,
        value: str,
        confidence: Optional[float] = None
    ) -> bool:
        """
        Mark a field as answered via dialog.

        Args:
            field_id: Field identifier
            value: User-provided value
            confidence: Optional ASR confidence

        Returns:
            True if marked, False otherwise
        """
        if field_id not in self.fields:
            logger.error(f"Field {field_id} not found")
            return False

        field = self.fields[field_id]
        field.value = value
        field.source = FieldSource.USER_INPUT

        if confidence is not None:
            field.meta.confidence = confidence

        self._change_state(
            field_id,
            FieldState.COMPLETED,
            StateChangeSource.DIALOG,
            notes=f"User answered: '{value}' (confidence={confidence})"
        )

        logger.info(f"Field {field_id} answered: {value}")
        return True

    def get_next_question_candidates(self) -> List[Field]:
        """
        Get fields that are candidates for the next question.

        Returns:
            List of fields in ASK_PENDING or REASK_PENDING state
        """
        candidates = [
            field for field in self.fields.values()
            if field.state in [FieldState.ASK_PENDING, FieldState.REASK_PENDING]
        ]

        logger.debug(f"Found {len(candidates)} question candidates")
        return candidates

    def should_skip_field(self, field_id: str) -> bool:
        """
        Check if a field should be skipped in the dialog.

        Args:
            field_id: Field to check

        Returns:
            True if field should be skipped
        """
        if field_id not in self.fields:
            return False

        field = self.fields[field_id]

        # Skip if: DOCUMENT_PROCESSING, COMPLETED, or LOCKED
        skip_states = [
            FieldState.DOCUMENT_PROCESSING,
            FieldState.COMPLETED,
            FieldState.LOCKED
        ]

        return field.state in skip_states

    def get_field(self, field_id: str) -> Optional[Field]:
        """Get a field by ID."""
        return self.fields.get(field_id)

    def get_all_fields(self) -> Dict[str, Field]:
        """Get all fields."""
        return self.fields

    def to_dict(self) -> Dict[str, Any]:
        """Convert entire state to dictionary."""
        return {
            'session_id': self.session_id,
            'confidence_threshold': self.confidence_threshold,
            'fields': {
                field_id: field.to_dict()
                for field_id, field in self.fields.items()
            }
        }
