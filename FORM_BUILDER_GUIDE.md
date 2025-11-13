# Dynamic Form Builder System - Implementation Guide

## Overview

The Dynamic Form Builder allows you to create complex, conditional forms that can be injected into modals during the dialog flow. This is essential for scenarios like collecting detailed vehicle modifications when a user answers "Yes" to "Does your vehicle have any modifications?"

## Architecture

### Ontologies Created

1. **`dialog-forms.ttl`** - Form builder schema
   - Form definitions with fields, validation, and conditional logic
   - Field types: text, number, select, multiselect, radio, checkbox, toggle, hierarchical
   - Conditional logic for showing/hiding fields based on answers
   - Validation rules (required, minLength, pattern, etc.)

2. **`dialog-vehicle-modifications.ttl`** - Vehicle modifications hierarchy
   - 7 major categories with 60+ specific modifications
   - 3-level hierarchy: Category → Subcategory → Modification
   - Insurance impact levels (low, medium, high, very-high)
   - Safety impact indicators
   - Declaration requirements

### Vehicle Modifications Hierarchy

#### Level 1: Categories (7)
1. **Engine & Performance**
2. **Body & Exterior**
3. **Suspension & Handling**
4. **Wheels & Tyres**
5. **Interior & Electronics**
6. **Security & Tracking**
7. **Other Modifications**

#### Example: Engine Category Structure

```
Engine & Performance
├── Engine Tuning
│   ├── ECU Remapping / Chip Tuning (HIGH impact, requires declaration)
│   └── Performance Chip (HIGH impact, requires declaration)
├── Air Intake System
│   ├── Induction Kit / Cold Air Intake (MEDIUM impact)
│   └── High-Flow Air Filter (LOW impact)
├── Exhaust System
│   ├── Full Exhaust System (MEDIUM impact)
│   ├── Back Box / Rear Silencer (LOW impact)
│   └── De-Cat / Cat Delete (VERY HIGH impact - may be illegal)
├── Forced Induction
    ├── Turbocharger Upgrade (VERY HIGH impact)
    └── Supercharger Installation (VERY HIGH impact)
```

## Form Builder Concepts

### 1. Form Definition

A form is a collection of fields that can be displayed in a modal. Forms are linked to questions via `:hasForm` property and triggered by specific answer values.

**Example: Vehicle Modifications Form**
```turtle
:VehicleModificationsForm a form:Form ;
    form:formId "vehicle_modifications_form" ;
    form:formTitle "Vehicle Modifications Details" ;
    form:formDescription "Please select all modifications made to your vehicle" ;
    form:triggeredBy :HasModificationsQuestion ;
    form:triggerCondition "answer=yes" ;
    form:hasField :ModificationCategoryField, :SpecificModsField .
```

### 2. Field Types

#### Hierarchical Select (Cascading Dropdown)
Perfect for vehicle modifications with 3 levels:
- **Level 1**: Category (Engine, Body, Suspension, etc.)
- **Level 2**: Subcategory (Engine Tuning, Exhaust System, etc.)
- **Level 3**: Specific Modification (ECU Remap, Back Box, etc.)

```turtle
:ModificationCategoryField a form:FormField ;
    form:fieldId "modification_category" ;
    form:fieldLabel "Select Modification Category" ;
    form:fieldType form:HierarchicalSelect ;
    form:fieldOrder 1 ;
    form:required true ;
    form:hasOption mod:EngineCategory, mod:BodyCategory, mod:SuspensionCategory .
```

#### Multi-Select
Allows selecting multiple modifications:

```turtle
:SpecificModsField a form:FormField ;
    form:fieldId "specific_modifications" ;
    form:fieldLabel "Select All Modifications" ;
    form:fieldType form:MultiSelect ;
    form:fieldOrder 2 ;
    form:required true .
```

### 3. Conditional Logic

Fields can be shown/hidden based on other field values:

```turtle
:EngineDetailsField a form:FormField ;
    form:fieldId "engine_details" ;
    form:fieldLabel "Describe Engine Modifications" ;
    form:fieldType form:TextArea ;
    form:hasConditional :ShowIfEngineSelected .

:ShowIfEngineSelected a form:ConditionalLogic ;
    form:condition "modification_category=cat_engine" ;
    form:action "show" .
```

### 4. Validation Rules

```turtle
:ModificationDateField a form:FormField ;
    form:fieldId "modification_date" ;
    form:fieldLabel "Date of Modification" ;
    form:fieldType form:DateInput ;
    form:required true ;
    form:hasValidation :DateNotFutureValidation .

:DateNotFutureValidation a form:ValidationRule ;
    form:validationType "max" ;
    form:validationValue "today" ;
    form:validationMessage "Modification date cannot be in the future" .
```

## Example Use Case: Vehicle Modifications

### Dialog Flow

1. **Question**: "Does your vehicle have any modifications?"
   - Options: Yes / No
2. **If Yes**: Trigger `VehicleModificationsForm` modal
3. **Form displays**:
   - Hierarchical selector with all modification categories
   - User selects: Engine → Engine Tuning → ECU Remapping
   - Form dynamically shows additional fields:
     - Date of modification
     - Installer details (professional/DIY)
     - Cost of modification
     - Documentation upload (optional)
4. **Result**: All modification data collected and stored

### Insurance Impact Display

The system can display insurance impact indicators:
- ✅ LOW: Minor impact, easy to insure
- ⚠️ MEDIUM: Moderate impact, may increase premium
- 🔴 HIGH: Significant impact, requires specialist quote
- 🚫 VERY HIGH: Major impact, may be difficult to insure

### Complete Modifications List

#### Engine & Performance (14 modifications)
- ECU Remapping, Performance Chip
- Induction Kit, High-Flow Air Filter
- Full Exhaust, Back Box, De-Cat
- Turbo Upgrade, Supercharger

#### Body & Exterior (11 modifications)
- Body Kit, Spoiler, Front Splitter, Modified Bonnet
- Full Respray, Vinyl Wrap, Decals
- HID/LED Lights, Underglow
- Window Tint, Sunroof

#### Suspension & Handling (6 modifications)
- Lowering Springs, Coilovers, Air Suspension, Anti-Roll Bars
- Upgraded Brakes, Big Brake Kit

#### Wheels & Tyres (5 modifications)
- Alloy Wheels, Larger Wheels, Wheel Spacers
- Performance Tyres, Low Profile Tyres

#### Interior & Electronics (5 modifications)
- Sports Seats, Aftermarket Steering Wheel, Additional Gauges
- Upgraded Stereo, Subwoofer/Amplifier

#### Security & Tracking (4 modifications) ⭐ May REDUCE premium
- Upgraded Alarm, Immobiliser
- GPS Tracker, Dash Camera

#### Other (4 modifications)
- Rear Seat Removal
- LPG Conversion, Electric Conversion

**Total: 60+ specific modifications across 7 categories**

## API Endpoints (To Be Implemented)

### Form Management

```bash
# List all forms
GET /api/config/forms

# Get form definition
GET /api/config/form/{form_id}

# Create/update form
POST /api/config/form

# Delete form
DELETE /api/config/form/{form_id}
```

### Field Management

```bash
# Get form fields
GET /api/config/form/{form_id}/fields

# Add field to form
POST /api/config/form/{form_id}/fields

# Update field
PUT /api/config/form/{form_id}/field/{field_id}

# Delete field
DELETE /api/config/form/{form_id}/field/{field_id}
```

### Modifications Hierarchy

```bash
# Get all modification categories
GET /api/modifications/categories

# Get subcategories for a category
GET /api/modifications/category/{category_id}/subcategories

# Get modifications for a subcategory
GET /api/modifications/subcategory/{subcategory_id}/modifications

# Search modifications
GET /api/modifications/search?q=exhaust

# Get modification details
GET /api/modifications/modification/{modification_id}
```

## Frontend Components (To Be Built)

### 1. Form Builder UI (`FormBuilder.jsx`)
- Drag-and-drop interface
- Field palette (all field types)
- Property editor for fields
- Conditional logic builder
- Validation rule editor
- Preview mode

### 2. Hierarchical Select Component (`HierarchicalSelect.jsx`)
- 3-level cascading dropdowns
- Search/filter functionality
- Breadcrumb navigation
- Multi-select support with checkboxes
- Insurance impact badges
- Safety warnings for high-impact modifications

### 3. Form Renderer (`DynamicForm.jsx`)
- Renders forms from ontology definitions
- Handles conditional logic
- Real-time validation
- Progress indicator for multi-step forms
- Submit handler that posts data back to API

### 4. Modifications Browser (`ModificationsBrowser.jsx`)
- Tree view of all categories
- Expandable/collapsible categories
- Quick search
- Filter by insurance impact
- Filter by declaration requirement
- Export selected modifications

## Database Schema (Extended)

The form submissions will be stored alongside dialog answers:

```python
{
  "session_id": "uuid",
  "question_id": "q_has_modifications",
  "answer": "yes",
  "form_data": {
    "form_id": "vehicle_modifications_form",
    "submitted_at": "2025-11-13T12:00:00Z",
    "fields": {
      "modification_category": "cat_engine",
      "modification_subcategory": "subcat_engine_tuning",
      "specific_modifications": ["mod_ecu_remap"],
      "modification_date": "2024-06-15",
      "installer_type": "professional",
      "installer_name": "ABC Tuning Ltd",
      "modification_cost": 500,
      "documentation": ["invoice_url", "certificate_url"]
    },
    "modifications_summary": [
      {
        "id": "mod_ecu_remap",
        "label": "ECU Remapping / Chip Tuning",
        "category": "Engine & Performance",
        "subcategory": "Engine Tuning",
        "insurance_impact": "high",
        "requires_declaration": true
      }
    ]
  }
}
```

## Implementation Roadmap

### Phase 1: Backend ✅ COMPLETED
- [x] Create form builder ontology (`dialog-forms.ttl`)
- [x] Create vehicle modifications ontology (`dialog-vehicle-modifications.ttl`)
- [x] Document API endpoints (this guide)

### Phase 2: Backend API (IN PROGRESS)
- [ ] Extend `dialog_manager.py` with form query methods
- [ ] Add form CRUD endpoints to `config_panel_api.py`
- [ ] Add modifications hierarchy endpoints
- [ ] Add form submission endpoint to `multimodal_server.py`

### Phase 3: Frontend Components
- [ ] Build `FormBuilder.jsx` with drag-drop
- [ ] Build `HierarchicalSelect.jsx` component
- [ ] Build `DynamicForm.jsx` renderer
- [ ] Build `ModificationsBrowser.jsx` explorer
- [ ] Integrate with DialogEditor

### Phase 4: Integration
- [ ] Add "Edit Form" tab to Question Editor
- [ ] Connect form triggers to questions
- [ ] Test end-to-end flow
- [ ] Add form preview in dialog tester

## Benefits

1. **Flexibility**: Create unlimited forms without code changes
2. **Reusability**: Forms defined once, used across multiple questions
3. **Maintainability**: All logic in ontology, easy to update
4. **Insurance Compliance**: Comprehensive modification list ensures accurate declarations
5. **User Experience**: Hierarchical selects make complex data entry simple
6. **Data Quality**: Conditional logic and validation ensure accurate data

## Next Steps

1. Complete backend API implementation
2. Build frontend components
3. Create example forms for common use cases:
   - Vehicle modifications (done in ontology)
   - Claims history details
   - Additional drivers information
   - Previous insurance details

## References

- Form Builder Ontology: `/ontologies/dialog-forms.ttl`
- Vehicle Modifications: `/ontologies/dialog-vehicle-modifications.ttl`
- Implementation Guide: This document
- Main Guide: `IMPLEMENTATION_GUIDE.md`
