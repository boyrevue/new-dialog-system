# Multimodal Dialog System - Feature Overview

## System Architecture

The system consists of:
- **Frontend (React + Vite)** - Port 3000
- **Dialog Server (FastAPI)** - Port 8000
- **Admin Panel API (FastAPI)** - Port 8001
- **Config Panel API (FastAPI)** - Port 8002
- **TTL Ontologies** - Semantic dialog configuration

## Core Components

### 1. Dialog Interface (`/`)

**Features:**
- Real-time speech recognition (ASR) with Web Speech API
- Text-to-speech (TTS) with customizable voice, rate, and pitch
- Voice settings modal with live preview
- Help button with real-time operator communication
- Confidence scoring with visual feedback
- FAQ popups for context-sensitive help
- Progress tracking with session resumption

**TTS Variants:**
- Each question can have 4 TTS variants
- "Rephrase Question" button cycles through variants sequentially
- Variants defined in TTL: `mm:ttsVariant1`, `mm:ttsVariant2`, `mm:ttsVariant3`, `mm:ttsVariant4`

**SKOS Integration:**
- Questions marked with `spelling_required` property use phonetic alphabet
- NATO phonetic alphabet available from `vocab:PhoneticAlphabet` SKOS scheme
- Alt labels in SKOS provide alternative phrasings for better recognition

### 2. Operator Panel (`/operator`)

**Enhanced Features (NEW):**
- **Multi-Session View**: See all active dialog sessions in real-time
- **Session Switching**: Click any session to view detailed flow
- **Flow Visualization**: Visual representation showing:
  - Completed questions (green)
  - Current question (blue highlight)
  - Upcoming questions (gray)
  - Answer values and confidence scores
- **Intervention Queue**: Two types of interventions:
  - **Help Requests**: User clicked help button
  - **Low Confidence**: Answer below threshold
- **Operator Actions**:
  - Send help messages to users in real-time
  - Fix slot values with operator confidence
  - Add notes for audit trail
- **Real-time Notifications**: WebSocket alerts for new sessions, help requests, low confidence
- **Stats Dashboard**: Active sessions, pending help, low confidence, completed today

**WebSocket Endpoints:**
- `/ws/operator/{operator_id}` - Receive real-time notifications
- `/ws/admin/help` - User-operator help dialog

**API Endpoints:**
- `GET /api/admin/sessions/active` - List all active sessions
- `GET /api/admin/session/{session_id}/details` - Get session flow and answers
- `GET /api/admin/interventions/queue` - Get pending interventions
- `POST /api/admin/intervention/respond` - Send help message to user
- `POST /api/admin/intervention/fix-slot` - Fix slot value and continue dialog

### 3. Configuration Panel (`/config`)

**Features:**
- **Questions & TTS Tab**:
  - View all questions with TTS configuration
  - See voice, rate, pitch settings
  - View FAQs attached to each question
  - Confidence threshold badges
- **ASR Settings Tab**:
  - Configure speech recognition language
  - Toggle continuous recognition
  - Set max alternatives
  - Show/hide interim results
- **Ontologies Tab**:
  - View and edit TTL ontology files
  - Automatic backups before saving
  - Syntax highlighting for Turtle format
  - Line counts and file metadata
- **System Tab**:
  - Server status and ports
  - Question counts
  - Ontology file counts

### 4. Dialog Editor (`/editor`) (NEW)

**Features:**
- **Flow Visualization**: Reuses operator panel flow component
- **Question Editing**:
  - Edit question text, slot name, question ID
  - Toggle required/optional
  - Toggle spelling required (phonetic alphabet)
  - Adjust confidence threshold with slider
- **TTS Configuration**:
  - Edit main TTS text
  - Create/edit 4 TTS variants for rephrase
  - Configure voice, rate, pitch
  - Test voice settings
- **SKOS Integration**:
  - `spelling_required` toggle indicates phonetic spelling
  - Uses `vocab:PhoneticAlphabet` from SKOS
  - Display badges for spelling-required fields
- **Live Preview**:
  - See question as user will see it
  - Preview TTS text
  - Visualize spelling requirements
- **Stats Dashboard**:
  - Total questions
  - Required questions count
  - Questions with TTS
  - Questions requiring spelling

## Node-RED Integration

### Export Dialog Flow

**Endpoint:** `GET /api/admin/export/node-red`

**Features:**
- Exports dialog flow as Node-RED JSON format
- Auto-generates visual flow with proper positioning
- Each question becomes a function node
- Includes metadata:
  - Question text
  - Slot name
  - Required flag
  - Confidence threshold
- Start node (inject) triggers dialog
- Completion node (debug) at end

**Usage:**
```bash
curl http://localhost:8001/api/admin/export/node-red > dialog-flow.json
```

Then import `dialog-flow.json` into Node-RED.

**Node Structure:**
```javascript
{
  "id": "question_q_name_mm",
  "type": "function",
  "name": "Q1: What is your full name?...",
  "func": "msg.question_id = \"q_name_mm\";\nmsg.slot_name = \"customer_name\";\nmsg.required = true;\nmsg.confidence_threshold = 0.85;\nreturn msg;",
  "x": 400,
  "y": 100,
  "wires": [["question_q_vehicle_reg_mm"]]
}
```

**Benefits:**
- Visual debugging of dialog flow
- Monitor real-time dialog progress
- Integrate with Node-RED dashboards
- Add custom nodes for business logic
- Connect to external systems (CRM, databases)

## TTL Ontology Structure

### Core Properties

**Question Properties:**
- `:questionText` - The question shown to user
- `:questionId` - Unique identifier
- `:slotName` - Variable name for answer
- `:required` - Boolean flag
- `:order` - Question sequence number
- `:confidenceThreshold` - Minimum confidence (0.0-1.0)
- `:spelling_required` - Uses phonetic alphabet (NEW)

**TTS Properties:**
- `mm:ttsText` - Main TTS text
- `mm:ttsVariant1` - First rephrase variant
- `mm:ttsVariant2` - Second rephrase variant
- `mm:ttsVariant3` - Third rephrase variant
- `mm:ttsVariant4` - Fourth rephrase variant
- `mm:ttsVoice` - Voice identifier
- `mm:ttsRate` - Speech rate (0.5-2.0)
- `mm:ttsPitch` - Voice pitch (0.5-2.0)
- `mm:ttsConfig` - Named preset (e.g., "slow_clear_phonetic")

**SKOS Vocabularies:**
- `vocab:VehicleTypes` - Car, Van, Motorbike, Taxi
- `vocab:CoverTypes` - Third Party, TPFT, Comprehensive
- `vocab:YesNoValues` - Yes/No with alt labels
- `vocab:UKRegions` - England, Scotland, Wales, NI
- `vocab:PhoneticAlphabet` - NATO alphabet (Alpha, Bravo, Charlie...)

### Example TTL with TTS Variants

```turtle
:NameTTS a mm:TTSPrompt ;
    mm:ttsText "Please tell me your full name, including both first name and surname." ;
    mm:ttsVariant1 "Could you tell me your full name, including first and last name, please?" ;
    mm:ttsVariant2 "Please provide your complete name with first name and surname." ;
    mm:ttsVariant3 "I need your full name - both first name and surname." ;
    mm:ttsVoice "en-GB-Neural2-A" ;
    mm:ttsRate 1.0 ;
    mm:ttsPitch 1.0 .

:NameQuestionMM a mm:MultimodalQuestion ;
    :questionId "q_name_mm" ;
    :questionText "What is your full name?" ;
    :slotName "customer_name" ;
    :required true ;
    :spelling_required false ;
    :confidenceThreshold 0.85 ;
    mm:hasTTSPrompt :NameTTS ;
    mm:hasFAQ :NameFAQ1, :NameFAQ2 .
```

### Example with Spelling Required

```turtle
:VehicleRegQuestionMM a mm:MultimodalQuestion ;
    :questionId "q_vehicle_reg_mm" ;
    :questionText "What is your vehicle registration number?" ;
    :slotName "vehicle_registration" ;
    :required true ;
    :spelling_required true ;  # User can spell with phonetic alphabet
    :confidenceThreshold 0.90 ;
    mm:hasTTSPrompt :VehicleRegTTS ;
    mm:hasVisualComponent :VehicleRegVisual .
```

## Confidence Scoring

Multi-factor confidence calculation:

```python
confidence = (
    recognition_confidence * 0.4 +
    audio_quality * 0.2 +
    grammar_match * 0.2 +
    vocabulary_match * 0.1 +
    context_match * 0.1
)
```

**Thresholds:**
- **High (≥85%)**: Green, auto-proceed
- **Medium (70-84%)**: Yellow, show warning
- **Low (<70%)**: Red, operator review required

## Session Management

**TTL-Configured Timeouts:**
- Session TTL: 30 minutes (configurable in `dialog.ttl`)
- Answer TTL: 15 minutes
- Recording TTL: 7 days

**Session Data:**
```json
{
  "session_id": "abc123",
  "current_question_index": 2,
  "total_questions": 8,
  "answers": {
    "customer_name": "John Smith",
    "vehicle_registration": "AB12CDE"
  },
  "confidence_scores": {
    "customer_name": 0.92,
    "vehicle_registration": 0.67
  },
  "needs_help": false,
  "has_low_confidence": true
}
```

## Deployment

### Development

```bash
# Backend
cd backend
source venv/bin/activate
python multimodal_server.py &  # Port 8000
python admin_panel.py &         # Port 8001
python config_panel_api.py &    # Port 8002

# Frontend
cd frontend
npm run dev  # Port 3000
```

### Production

1. Update CORS origins in FastAPI apps
2. Use production WSGI server (gunicorn/uvicorn)
3. Configure reverse proxy (nginx/Apache)
4. Set up Redis for session sharing
5. Enable authentication on operator/config panels
6. Set up TLS/SSL certificates
7. Configure backup schedule for ontology files

## Future Enhancements

- [ ] Visual ontology editor with drag-and-drop
- [ ] Real-time Node-RED dashboard integration
- [ ] Multi-language support with SKOS translations
- [ ] A/B testing for TTS variants
- [ ] Analytics dashboard for dialog performance
- [ ] AI-powered variant generation
- [ ] Voice biometrics for security
- [ ] Integration with telephony systems
- [ ] Advanced SHACL validation in UI
- [ ] Version control for ontology changes

## API Reference

### Main Dialog API (Port 8000)

- `POST /session/start` - Start new dialog session
- `GET /session/{session_id}/current-question` - Get current question
- `POST /session/submit-answer` - Submit answer
- `POST /calculate-confidence` - Calculate confidence score
- `POST /upload-audio` - Upload audio for analysis
- `GET /session/{session_id}/complete` - Mark session complete

### Admin Panel API (Port 8001)

- `GET /review/queue` - Get review queue
- `POST /review/transcribe` - Submit transcription
- `POST /review/validate` - Validate answer
- `POST /review/rephrase` - Request rephrase
- `GET /sessions/active` - List active sessions (NEW)
- `GET /session/{id}/details` - Get session details (NEW)
- `GET /interventions/queue` - Get intervention queue (NEW)
- `POST /intervention/respond` - Send help message (NEW)
- `POST /intervention/fix-slot` - Fix slot value (NEW)
- `GET /export/node-red` - Export to Node-RED (NEW)
- `WS /ws/operator/{id}` - Operator notifications (NEW)
- `WS /ws/admin/help` - Help dialog (NEW)

### Config Panel API (Port 8002)

- `GET /questions` - List all questions
- `POST /question/{id}` - Update question (NEW)
- `GET /ontologies` - List ontology files
- `GET /ontology/{type}` - Get ontology content
- `POST /ontology/{type}` - Save ontology (creates backup)
- `GET /asr` - Get ASR configuration

## License

Copyright © 2025. All rights reserved.
