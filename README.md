# Multimodal Dialog System with Confidence Scoring & Operator Review

A comprehensive dialog management system built with TTL ontologies as the golden source of truth. Features multimodal interaction (speech/text), confidence scoring, automatic audio recording for low-confidence responses, and an operator review panel.

## 🎯 Key Features

### 1. TTL-Based Configuration (Golden Source)
- **No hardcoded values** - All configuration in RDF/Turtle ontologies
- Dynamic SPARQL queries for runtime configuration
- TTL-based lifecycle management (session, answer, recording TTLs)
- SHACL validation rules
- SKOS controlled vocabularies
- Confidence thresholds and operator review rules

### 2. Multimodal Dialog Interface
- Text and speech input modes
- Text-to-speech (TTS) prompts with configurable voice, rate, and pitch
- Visual components (images, diagrams, examples)
- Multiple choice questions with descriptions
- Context-sensitive FAQs
- Real-time confidence feedback

### 3. Confidence Scoring System
- Multi-factor confidence calculation:
  - Speech recognition confidence
  - Audio quality (SNR, clipping detection, spectral analysis)
  - Grammar matching
  - Vocabulary matching against SKOS concepts
  - Context validation
- Question-specific thresholds from TTL
- Automatic recording when confidence < threshold

### 4. Operator Review Panel
- Real-time review queue with priority sorting (P1 = highest)
- WebSocket notifications for new items
- Audio playback with waveform visualization
- Manual transcription interface
- Operator confidence scoring
- Rephrase request system with templates from TTL
- Workflow state machine (Pending → In Review → Transcribed → Validated)
- Role-based access control (Junior, Senior, Supervisor)

## 📁 Project Structure

```
dialog-system/
├── ontologies/                    # TTL Ontologies (Golden Source)
│   ├── dialog.ttl                # Core dialog structure and TTL config
│   ├── dialog-multimodal.ttl    # TTS, visual components, FAQs
│   ├── dialog-vocabularies.ttl  # SKOS controlled vocabularies
│   ├── dialog-validation.ttl    # SHACL validation rules
│   └── dialog-confidence.ttl    # Confidence thresholds and review config
│
├── backend/                       # Python FastAPI Backend
│   ├── dialog_manager.py        # Core dialog management with SPARQL
│   ├── multimodal_server.py     # Dialog interaction API
│   ├── admin_panel.py           # Operator review API
│   └── requirements.txt         # Python dependencies
│
├── frontend/                      # React Frontend
│   ├── src/
│   │   └── components/
│   │       ├── MultimodalDialog.jsx   # User dialog interface
│   │       └── OperatorPanel.jsx      # Operator review interface
│   └── package.json             # Node dependencies
│
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the dialog server
python multimodal_server.py
# Server runs on http://localhost:8000

# In another terminal, start the admin panel server
python admin_panel.py
# Admin panel runs on http://localhost:8001
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Frontend runs on http://localhost:5173
```

## 🔧 Configuration

### TTL Ontologies

All system configuration is defined in the TTL ontologies:

#### 1. **dialog.ttl** - Core Configuration
```turtle
:DefaultTTL a :TTLConfiguration ;
    :sessionTTL "PT30M"^^xsd:duration ;  # 30 minutes
    :answerTTL "PT10M"^^xsd:duration ;   # 10 minutes
    :recordingTTL "P7D"^^xsd:duration .  # 7 days
```

#### 2. **dialog-multimodal.ttl** - Multimodal Features
```turtle
:NameQuestionMM a mm:MultimodalQuestion ;
    dialog:questionId "q_name_mm" ;
    dialog:questionText "What is your full name?" ;
    mm:hasTTSPrompt :NameTTS ;
    mm:hasFAQ :NameFAQ1, :NameFAQ2 .
```

#### 3. **dialog-confidence.ttl** - Confidence Rules
```turtle
:VehicleRegConfidenceThreshold a conf:ConfidenceThreshold ;
    dialog:appliesTo :VehicleRegQuestion ;
    conf:thresholdValue 0.90 ;
    qc:reviewPriority 1 ;  # Highest priority
    conf:action "record_and_review" .
```

#### 4. **dialog-vocabularies.ttl** - Controlled Vocabularies
```turtle
vocab:Yes a skos:Concept ;
    skos:prefLabel "Yes"@en ;
    skos:altLabel "Y"@en, "Yeah"@en, "Yep"@en ;
    skos:inScheme vocab:YesNoValues .
```

#### 5. **dialog-validation.ttl** - SHACL Validation
```turtle
val:VehicleRegistrationShape a sh:NodeShape ;
    sh:property [
        sh:pattern "^[A-Z]{2}[0-9]{2}\\s?[A-Z]{3}$" ;
        sh:message "Invalid UK vehicle registration format" ;
    ] .
```

### Modifying Configuration

To change any configuration:

1. Edit the relevant TTL file
2. Restart the backend servers
3. Changes take effect immediately (no code changes needed)

## 📊 System Architecture

### Data Flow

```
User Input (Speech/Text)
    ↓
Speech Recognition / Text Input
    ↓
Confidence Calculation (multi-factor)
    ↓
Compare with Threshold (from TTL)
    ↓
IF confidence < threshold:
    → Record Audio (WAV, 16kHz, 16-bit)
    → Create Review Item (with priority from TTL)
    → Queue for Operator
    ↓
Operator Review:
    → Listen to Audio
    → Manual Transcription
    → Or Request Rephrase (template from TTL)
    ↓
Validation
    → Supervisor Approval
    → Update Dialog State
```

### Confidence Scoring

```python
confidence = (
    recognition_confidence * 0.4 +
    audio_quality * 0.2 +
    grammar_match * 0.2 +
    vocabulary_match * 0.2
)
```

Weights loaded from TTL:
```turtle
:SpeechConfidenceRule a conf:ConfidenceScoringRule ;
    qc:factor "recognition_confidence" ; qc:weight 0.4 ;
    qc:factor "audio_quality" ; qc:weight 0.2 ;
    qc:factor "grammar_match" ; qc:weight 0.2 ;
    qc:factor "vocabulary_match" ; qc:weight 0.2 .
```

### Audio Quality Analysis

- **SNR (Signal-to-Noise Ratio)**: Minimum 20dB (from TTL)
- **Clipping Detection**: Maximum 5% clipped samples (from TTL)
- **Spectral Quality**: Frequency distribution analysis

## 🎤 API Endpoints

### Dialog Server (Port 8000)

```
POST   /api/session/start
GET    /api/session/{session_id}/current-question
POST   /api/answer/submit
POST   /api/audio/analyze
POST   /api/confidence/calculate
GET    /api/vocabulary/match
GET    /api/rephrase-template/{question_id}
WS     /ws/{session_id}
```

### Admin Panel Server (Port 8001)

```
POST   /api/admin/review/create
GET    /api/admin/review/queue
GET    /api/admin/review/{review_id}
POST   /api/admin/review/{review_id}/claim
POST   /api/admin/review/{review_id}/transcribe
POST   /api/admin/review/{review_id}/rephrase
POST   /api/admin/review/{review_id}/validate
GET    /api/admin/stats
WS     /ws/admin
```

## 🔐 Security Considerations

For production deployment:

1. **Authentication**: Add JWT-based auth for operators
2. **Audio Storage**: Use encrypted S3/cloud storage
3. **PII Protection**: Encrypt sensitive fields
4. **Rate Limiting**: Add rate limits to API endpoints
5. **CORS**: Configure CORS properly for production domains
6. **WebSocket Security**: Add authentication to WebSocket connections

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📈 Monitoring & Observability

### Key Metrics to Track

1. **Dialog Metrics**
   - Average confidence scores per question
   - Review rate (% of answers requiring review)
   - Session completion rate

2. **Operator Metrics**
   - Average review time
   - Transcription accuracy
   - Items per operator per day

3. **Audio Quality Metrics**
   - Average SNR
   - Clipping percentage
   - Speech recognition accuracy

4. **System Metrics**
   - API response times
   - WebSocket connection stability
   - Queue depth

## 🔄 Workflow States

```
PENDING → IN_REVIEW → TRANSCRIBED → VALIDATED ✓
    ↓         ↓            ↓
    └─────→ REJECTED ✗
    ↓         ↓
    └─────→ REPHRASE_REQUESTED → (back to dialog)
```

State transitions defined in TTL:
```turtle
qc:PendingState a qc:WorkflowState ;
    qc:allowedTransition qc:InReviewState, qc:RephraseRequestedState .
```

## 🛠️ Development

### Adding a New Question

1. Add question definition to `dialog.ttl`:
```turtle
:NewQuestion a :Question ;
    :questionId "q_new" ;
    :questionText "Your question?" ;
    :slotName "slot_name" ;
    :required true .
```

2. Add multimodal features to `dialog-multimodal.ttl`:
```turtle
:NewQuestionMM a mm:MultimodalQuestion ;
    :questionId "q_new" ;
    mm:hasTTSPrompt :NewTTS .
```

3. Add confidence threshold to `dialog-confidence.ttl`:
```turtle
:NewConfidenceThreshold a conf:ConfidenceThreshold ;
    :appliesTo :NewQuestion ;
    conf:thresholdValue 0.80 ;
    qc:reviewPriority 3 .
```

4. Add validation to `dialog-validation.ttl`:
```turtle
val:NewShape a sh:NodeShape ;
    sh:property [
        sh:pattern "^regex$" ;
        sh:message "Validation error message" ;
    ] .
```

5. Restart servers - no code changes needed!

## 📝 License

MIT License - see LICENSE file

## 🤝 Contributing

1. Follow the architectural principle: **TTL is the golden source**
2. Never hardcode configuration values
3. Use SPARQL queries to load configuration
4. Add comprehensive tests
5. Update TTL ontologies for any new features

## 📞 Support

For issues or questions, please open a GitHub issue.

---

**Built with TTL ontologies as the golden source of truth. No hardcoded values. Production-ready.**
