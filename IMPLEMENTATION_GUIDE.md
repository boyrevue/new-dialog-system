# Multimodal Dialog System - Complete Implementation Guide

## System Overview

This is a comprehensive multimodal dialog system for insurance quote collection using TTL ontologies (OWL, SKOS, SHACL) with React frontend and FastAPI backend.

## Architecture

### Frontend (Port 5174)
- **Framework**: React 18.2 + Vite 5.4.21
- **UI**: Tailwind CSS + Flowbite React
- **Location**: `/frontend`
- **Main Components**:
  - `DialogEditor.jsx` - Visual ontology editor
  - `SelectWithASR.jsx` - Voice-enabled select component
  - `PhoneticKeyboard.jsx` - NATO alphabet input

### Backend APIs
- **Multimodal Server (Port 8000)**: Dialog interaction API
  - File: `/backend/multimodal_server.py`
  - Purpose: Session management, confidence scoring, audio analysis
- **Config Panel API (Port 8002)**: Configuration/editor API
  - File: `/backend/config_panel_api.py`
  - Purpose: Ontology management, question editing, TTS generation

### Ontology Structure (TTL/Turtle Format)

#### Core Ontologies (`/ontologies`)

1. **dialog.ttl** - Core dialog structure
   - Dialog definitions
   - Section definitions
   - Question references via `:hasQuestion`
   - Node ordering

2. **dialog-multimodal.ttl** - Multimodal features
   - TTS configurations
   - Visual components
   - Select options with aliases/phonetics
   - FAQ definitions
   - Input modes (spelling, word)

3. **dialog-insurance-questions.ttl** - All 33 insurance questions
   - Question definitions
   - TTS prompts and variants
   - Validation rules
   - Section membership via `:inSection`

4. **dialog-vocabularies.ttl** - SKOS vocabularies
   - Controlled vocabularies (cover types, payment methods, etc.)
   - Aliases and alternative labels
   - Concept schemes

5. **dialog-documents.ttl** - Document extraction ontology ✨ NEW
   - Document types (Passport, Driving Licence, V5C, etc.)
   - Extraction mappings
   - Field properties:
     - `:extractableFrom` - Documents that can provide the data
     - `:inputType` - "spelling" or "word"
     - `:dataType` - "alphanumeric", "numeric", "alpha", "date", "email", "phone"
     - `:mandatoryField` - Legally/business mandated fields

6. **dialog-validation.ttl** - SHACL validation shapes
   - Data type constraints
   - Format validation (email, phone, postcode)
   - Required field rules

7. **dialog-confidence.ttl** - Confidence scoring rules
   - Threshold definitions per question
   - Priority levels
   - Multi-factor scoring weights

## Key Features

### 1. Dialog Flow Management
- **File**: `/backend/dialog_manager.py`
- **Key Method**: `get_dialog_flow(dialog_id)`
- **SPARQL Query**: Uses UNION pattern to find:
  - Direct nodes via `:hasNode`
  - Questions in sections via `:inSection`

### 2. TTS Variant Generation
- **Batch Script**: `/backend/batch_generate_tts_variants.py`
- **API Method**: `TTSVariantGenerator.generate_for_question()`
- **Uses**: OpenAI GPT-4 to generate 4 natural variants
- **Output**: TTL triples ready to paste into ontology

### 3. Document Extraction System ✨ NEW
- **Ontology**: `/ontologies/dialog-documents.ttl`
- **Document Types**:
  - **Identity**: Passport, Driving Licence, National ID, Birth Certificate
  - **Address**: Utility Bill, Bank Statement, Council Tax Bill
  - **Vehicle**: V5C Log Book, Insurance Certificate, MOT Certificate
- **Extraction Confidence**: 0.90-0.98 depending on document/field

### 4. Confidence Scoring
- Multi-factor calculation:
  - Recognition confidence (40%)
  - Audio quality (20%)
  - Grammar match (20%)
  - Vocabulary match (20%)
  - Context match (optional 10%)
- Thresholds defined per question in TTL

## Current Status

### ✅ Completed
1. Core dialog system with 7 sections, 33 questions
2. TTS variant generation system
3. Document ontology with extraction mappings
4. Batch TTS generation script
5. Server configurations updated with document ontology
6. SPARQL query fix for hierarchical questions
7. AttributeError fixes for optional properties

### ⏳ Pending Implementation

#### Phase 1: Backend Extensions
- [ ] Extend `dialog_manager.py` with document extraction methods:
  ```python
  def get_question_documents(self, question_id: str) -> List[Dict]
  def get_document_details(self, document_uri: str) -> Dict
  def get_question_metadata(self, question_id: str) -> Dict
      # Returns: mandatoryField, inputType, dataType, extractableFrom
  ```

- [ ] Add API endpoints to `config_panel_api.py`:
  ```python
  GET  /api/config/documents              # List all documents
  GET  /api/config/question/{id}/metadata # Get question metadata
  POST /api/config/question/{id}/metadata # Update question metadata
  GET  /api/config/shacl                  # Get SHACL validation rules
  POST /api/config/shacl                  # Update SHACL rules
  ```

#### Phase 2: Ontology Updates
- [ ] Run TTS batch generation:
  ```bash
  cd /Users/vincentpower/UNIVERSX/dialog-system/backend
  export OPENAI_API_KEY='your-key-here'
  source venv/bin/activate
  python batch_generate_tts_variants.py > tts_output.txt
  ```

- [ ] Update all 33 questions in `dialog-insurance-questions.ttl` with:
  - `:mandatoryField` true/false
  - `:extractableFrom` document references
  - `:inputType` "spelling" or "word"
  - `:dataType` appropriate type
  - Generated TTS variants

#### Phase 3: Frontend Extensions
- [ ] Update `DialogEditor.jsx` with new fields:
  - Mandatory/Optional toggle
  - Document extraction multi-select
  - Input type selector (spelling/word)
  - Data type dropdown
  - Batch "Generate All Variants" button

- [ ] Create `SHACLEditor.jsx` component:
  - Syntax-highlighted TTL editor
  - Validation error display
  - Save/revert functionality

## Running the System

### Start Backend Servers
```bash
cd /Users/vincentpower/UNIVERSX/dialog-system/backend
source venv/bin/activate

# Terminal 1: Multimodal server (port 8000)
python multimodal_server.py

# Terminal 2: Config panel API (port 8002)
python config_panel_api.py
```

### Start Frontend
```bash
cd /Users/vincentpower/UNIVERSX/dialog-system/frontend
npm run dev
# Opens on http://localhost:5174
```

### Access Points
- **Dialog Editor**: http://localhost:5174
- **Main Dialog**: http://localhost:5174/dialog
- **Config Panel**: http://localhost:3000/config (if separate config UI exists)

### API Testing
```bash
# Health checks
curl http://localhost:8000/api/health
curl http://localhost:8002/api/config/health

# Get all questions
curl http://localhost:8002/api/config/questions | jq

# Get specific ontology
curl http://localhost:8002/api/config/ontology/documents | jq

# Get all ontologies
curl http://localhost:8002/api/config/ontologies | jq
```

## Development Workflow

### Adding a New Question
1. Add question to `/ontologies/dialog-insurance-questions.ttl`
2. Link to section via `:inSection`
3. Add to dialog via `:hasQuestion` in `/ontologies/dialog.ttl`
4. Define TTS variants (or use batch script)
5. Add document extraction mappings if applicable
6. Define validation rules in `dialog-validation.ttl`
7. Set confidence threshold in `dialog-confidence.ttl`
8. Restart backend servers to reload ontologies

### Editing Ontologies
- **Recommended**: Use Dialog Editor at http://localhost:5174
- **Manual**: Edit `.ttl` files directly (requires server restart)
- **Validation**: Check TTL syntax with RDFLib:
  ```python
  from rdflib import Graph
  g = Graph()
  g.parse("ontologies/dialog.ttl", format="turtle")
  print(f"Loaded {len(g)} triples")
  ```

### Generating TTS Variants
```bash
# For a single question (via API)
curl -X POST http://localhost:8002/api/config/generate-tts-variants \
  -H "Content-Type: application/json" \
  -d '{
    "question_text": "What is your first name?",
    "question_id": "q_first_name",
    "slot_name": "firstName"
  }'

# For all questions (batch script)
python batch_generate_tts_variants.py > output.txt
```

## Troubleshooting

### Questions Not Appearing in Editor
- **Check**: Ontology loaded in server config
- **Check**: Question has `:hasQuestion` link in dialog.ttl
- **Check**: Question has proper `:inSection` link
- **Check**: `dialog_manager.py` SPARQL query includes UNION pattern

### AttributeError in API
- **Issue**: Optional properties accessed without `hasattr()` check
- **Fix**: Add defensive checks:
  ```python
  if hasattr(row, 'propertyName') and row.propertyName:
      # use property
  ```

### Blank Config Screen
- **Check**: Backend server running on correct port
- **Check**: CORS middleware configured
- **Check**: Browser console for errors
- **Check**: `/api/config/health` endpoint responds

### TTS Generation Fails
- **Check**: `OPENAI_API_KEY` environment variable set
- **Check**: OpenAI API quota/billing
- **Check**: Network connectivity to OpenAI API
- **Error Logs**: Check `tts_variant_generator.py` logs

## File Reference

### Backend Python Files
- `multimodal_server.py` - Main dialog API (port 8000)
- `config_panel_api.py` - Configuration API (port 8002)
- `dialog_manager.py` - Core SPARQL queries and dialog logic
- `tts_variant_generator.py` - OpenAI TTS generation
- `batch_generate_tts_variants.py` - Batch processing script

### Frontend React Files
- `src/pages/DialogEditor.jsx` - Main editor interface
- `src/components/SelectWithASR.jsx` - Voice select component
- `src/components/PhoneticKeyboard.jsx` - NATO alphabet input

### Ontology TTL Files
- `dialog.ttl` - Core dialog structure
- `dialog-multimodal.ttl` - Multimodal features
- `dialog-insurance-questions.ttl` - 33 questions
- `dialog-vocabularies.ttl` - SKOS vocabularies
- `dialog-documents.ttl` - Document extraction (NEW)
- `dialog-validation.ttl` - SHACL validation
- `dialog-confidence.ttl` - Confidence scoring

## Next Steps

1. **Immediate**: Extend backend APIs with document extraction endpoints
2. **Next**: Update all 33 questions with new properties
3. **Then**: Run batch TTS generation
4. **Finally**: Update frontend with new UI fields and SHACL editor

## Technical Decisions

### Why TTL/RDF Ontologies?
- Semantic relationships (`:inSection`, `:extractableFrom`)
- SPARQL querying for complex relationships
- SKOS for controlled vocabularies
- SHACL for validation rules
- Single source of truth (Golden Source)

### Why UNION Pattern in SPARQL?
- Questions can be direct nodes OR belong to sections
- Captures both hierarchical structures
- Maintains backward compatibility

### Why Separate Document Ontology?
- Reusable across different dialog types
- Clear separation of concerns
- Extensible for new document types
- Explicit extraction confidence levels

## Contact & Support

For issues or questions, refer to this guide and the ontology comments in TTL files.
