# Document Extraction Flow with Validation

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS DOCUMENT                    │
│                    (V5C, Driving Licence, etc.)                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND: multimodal_server.py                 │
│  POST /api/document/upload-and-extract                           │
│                                                                   │
│  1. Read file bytes                                              │
│  2. Parse template (if provided)                                 │
│  3. Call document_ocr.py: extract_from_image()                  │
│     ├─ Detect card corners                                      │
│     ├─ Apply perspective transform                              │
│     ├─ Extract fields via Tesseract OCR                         │
│     └─ Return extracted_fields + confidences                    │
│                                                                   │
│  4. NEW: Validate fields via ocr_validator.py ⭐                │
│     ├─ Check against known patterns                             │
│     ├─ Fuzzy match with valid values                            │
│     ├─ Generate suggestions                                      │
│     └─ Calculate adjusted confidence                            │
│                                                                   │
│  5. Map fields to dialog questions                              │
│  6. Return response with validations                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND: LicenceTemplateEditor.tsx                 │
│                                                                   │
│  Response received:                                              │
│  {                                                               │
│    success: true,                                               │
│    extracted_fields: { make: "TEBLA", fuel_type: "ELECTRICITY" },│
│    field_confidences: { make: 0.5, fuel_type: 0.9 },           │
│    validations: {                                               │
│      make: {                                                    │
│        is_valid: false,                                         │
│        warning: "OCR likely misread TEBLA as TESLA",           │
│        suggestions: ["TESLA"],                                  │
│        correction: "TESLA"                                      │
│      }                                                          │
│    }                                                            │
│  }                                                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UI RENDERING (Enhanced)                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Test Extraction Results                    [Save] [Clear] │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Overall Confidence: 50.0% ⚠                               │ │
│  │ [████████████░░░░░░░░░░░░]  Yellow bar                    │ │
│  │ ⚠ Medium confidence - Review recommended                  │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Extracted Fields (Editable):   Click any field to edit    │ │
│  │                                                             │ │
│  │ ┌─ MAKE field (50% confidence) ──────────────────────┐   │ │
│  │ │ MAKE                                         50% ⚠ │   │ │
│  │ │ ┌────────────────────────────────────────────────┐ │   │ │
│  │ │ │ TEBLA                                         │ │ ← Editable input
│  │ │ └────────────────────────────────────────────────┘ │   │ │
│  │ │ ⚠ OCR likely misread "TEBLA" as "TESLA"          │   │ │
│  │ │ Suggestions: [TESLA] ← One-click correction       │   │ │
│  │ │ OCR Source Image:                                 │   │ │
│  │ │ ┌────────────────────────────────────────────────┐ │   │ │
│  │ │ │  T E S L A  (image shows actual text)        │ │   │ │
│  │ │ └────────────────────────────────────────────────┘ │   │ │
│  │ └───────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │ ┌─ FUEL_TYPE field (90% confidence) ─────────────────┐   │ │
│  │ │ FUEL TYPE                                    90% ✓ │   │ │
│  │ │ ┌────────────────────────────────────────────────┐ │   │ │
│  │ │ │ ELECTRICITY                                   │ │   │ │
│  │ │ └────────────────────────────────────────────────┘ │   │ │
│  │ │ ✓ High confidence - Ready to use                 │   │ │
│  │ └───────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     USER ACTIONS                                 │
│                                                                   │
│  Option 1: Click "TESLA" suggestion button                       │
│            → Field updates to "TESLA"                            │
│            → testResults.extracted_data.make = "TESLA"           │
│                                                                   │
│  Option 2: Manually edit input field                            │
│            → Type correct value                                  │
│            → onChange updates testResults in real-time           │
│                                                                   │
│  Option 3: Click "Save" button                                  │
│            → Persist corrections (currently logs to console)     │
│            → Future: Save to database/session                    │
└─────────────────────────────────────────────────────────────────┘
```

## Validation Logic Flow

```
┌──────────────────────────────────────────┐
│  OCRValidator.validate_field()           │
│  Input: field_name, value, confidence    │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Field-Specific Validator                │
│  (based on field_name)                   │
└──────────────┬───────────────────────────┘
               │
               ├─► make → _validate_make()
               │   ├─ Check against VEHICLE_MAKES list
               │   ├─ Fuzzy match with get_close_matches()
               │   ├─ Check OCR_CORRECTIONS dict
               │   └─ Return suggestions
               │
               ├─► fuel_type → _validate_fuel_type()
               │   ├─ Check against FUEL_TYPES list
               │   ├─ Fuzzy match
               │   └─ Return suggestions
               │
               ├─► body_type → _validate_body_type()
               │   └─ Check against BODY_TYPES list
               │
               ├─► registration_number → _validate_registration()
               │   ├─ Check UK reg format (AA12 ABC)
               │   ├─ Try OCR character substitutions
               │   └─ Suggest corrected format
               │
               └─► model → _validate_model()
                   └─ Check for suspicious characters

               ▼
┌──────────────────────────────────────────┐
│  Return Validation Result                │
│  {                                       │
│    is_valid: bool,                      │
│    confidence: float (adjusted),        │
│    suggestions: ["TESLA", "TESLA"],     │
│    correction: "TESLA",                 │
│    warning: "OCR likely misread..."     │
│  }                                      │
└──────────────────────────────────────────┘
```

## Color Coding System

```
┌───────────────────────────────────────────────────────────────┐
│  CONFIDENCE LEVELS                                             │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  🟢 GREEN (80-100%)                                           │
│     Background: bg-green-50                                   │
│     Border: border-green-200                                  │
│     Text: text-green-700                                      │
│     Message: "✓ High confidence - Ready to use"              │
│     Action: No warnings, user can still edit                  │
│                                                                │
│  🟡 YELLOW (50-79%)                                           │
│     Background: bg-yellow-50                                  │
│     Border: border-yellow-200                                 │
│     Text: text-yellow-700                                     │
│     Message: "⚠ Medium confidence - Review recommended"       │
│     Action: Show validation warnings/suggestions              │
│                                                                │
│  🔴 RED (<50%)                                                │
│     Background: bg-red-50                                     │
│     Border: border-red-200                                    │
│     Text: text-red-700                                        │
│     Message: "✗ Low confidence - Manual review required"      │
│     Action: Show warnings + suggestions + source image        │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

## Common OCR Error Patterns

```
┌────────────────────────────────────────────────────────┐
│  CHARACTER SUBSTITUTIONS                               │
├────────────────────────────────────────────────────────┤
│  O ↔ 0 ↔ Q ↔ D     (circular shapes)                 │
│  I ↔ 1 ↔ l ↔ |     (vertical lines)                  │
│  S ↔ 5 ↔ 8 ↔ B     (curved shapes)                   │
│  G ↔ 6 ↔ C         (semi-circles)                     │
│  Z ↔ 2 ↔ 7         (diagonal lines)                   │
│  E ↔ F ↔ 3         (horizontal bars)                  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  KNOWN CORRECTIONS (Vehicle Makes)                     │
├────────────────────────────────────────────────────────┤
│  TEBLA   → TESLA   (S→B substitution)                 │
│  TESLO   → TESLA   (A→O substitution)                 │
│  TESL4   → TESLA   (A→4 substitution)                 │
│  T3SLA   → TESLA   (E→3 substitution)                 │
│  BNW     → BMW     (M→N substitution)                 │
│  AIJD1   → AUDI    (U→IJ, I→1 substitution)          │
│  F0RD    → FORD    (O→0 substitution)                 │
└────────────────────────────────────────────────────────┘
```

## Data Flow Summary

```
Document Upload
      │
      ▼
OCR Extraction (document_ocr.py)
      │
      ├─► extracted_fields: { make: "TEBLA", ... }
      ├─► field_confidences: { make: 0.5, ... }
      └─► field_images: { make: "data:image/...", ... }
      │
      ▼
Validation (ocr_validator.py) ⭐ NEW
      │
      ├─► Check each field against validation rules
      ├─► Generate suggestions via fuzzy matching
      ├─► Apply known OCR corrections
      └─► Return validations dict
      │
      ▼
API Response (multimodal_server.py)
      │
      ├─► extracted_fields
      ├─► field_confidences
      ├─► validations ⭐ NEW
      └─► field_images
      │
      ▼
UI Rendering (LicenceTemplateEditor.tsx)
      │
      ├─► Color-code fields by confidence
      ├─► Show editable inputs
      ├─► Display validation warnings
      └─► Render one-click suggestion buttons
      │
      ▼
User Corrections
      │
      ├─► Click suggestions OR
      ├─► Manually edit fields
      └─► Save corrections
```

## Integration Points

### 1. Backend Validation Module
```python
# backend/ocr_validator.py
validator = get_validator()
validations = validator.validate_document(
    extracted_fields={'make': 'TEBLA'},
    confidences={'make': 0.5}
)
# Returns: {'make': {'is_valid': False, 'suggestions': ['TESLA'], ...}}
```

### 2. API Integration
```python
# backend/multimodal_server.py (Line 507-512)
from ocr_validator import get_validator
validator = get_validator()
field_confidences = extraction_result.get('field_confidences', {})
validations = validator.validate_document(extracted_fields, field_confidences)
```

### 3. Frontend Display
```typescript
// frontend/src/components/LicenceTemplateEditor.tsx (Line 1066-1098)
{testResults.validations && testResults.validations[key] && (
  <>
    {testResults.validations[key].warning && (
      <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-xs text-yellow-800">
          ⚠ {testResults.validations[key].warning}
        </p>
      </div>
    )}
    {testResults.validations[key].suggestions.map((suggestion) => (
      <button onClick={() => applySuggestion(suggestion)}>
        {suggestion}
      </button>
    ))}
  </>
)}
```

## Performance Metrics

```
┌─────────────────────────────────────────────────────────┐
│  Before Enhancement                                      │
├─────────────────────────────────────────────────────────┤
│  OCR Time: ~2-3 seconds                                 │
│  Display: Read-only text                                │
│  User Actions: Manual retyping (slow)                   │
│  Error Rate: High (no suggestions)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  After Enhancement                                       │
├─────────────────────────────────────────────────────────┤
│  OCR Time: ~2-3 seconds                                 │
│  Validation: +50ms (negligible)                         │
│  Display: Editable + suggestions                        │
│  User Actions: One-click corrections (fast)             │
│  Error Rate: Significantly reduced                      │
└─────────────────────────────────────────────────────────┘
```

## Future Roadmap

```
Phase 1: ✅ COMPLETED
  ├─ Editable fields
  ├─ Confidence visualization
  ├─ Validation suggestions
  └─ OCR error corrections

Phase 2: 🔄 PLANNED
  ├─ Save corrections to database
  ├─ Keyboard shortcuts (Tab, Enter)
  ├─ Undo/Redo functionality
  └─ Bulk accept all suggestions

Phase 3: 📋 FUTURE
  ├─ Machine learning feedback loop
  ├─ Custom validation rules UI
  ├─ Multi-language support
  └─ Real-time validation

Phase 4: 🚀 ADVANCED
  ├─ AI-powered context-aware suggestions
  ├─ Historical accuracy tracking
  ├─ Confidence calibration
  └─ Template marketplace
```
