# Drag-and-Drop Form Builder - Complete Specification

## Overview

A visual form builder where you can create, edit, and manage dynamic forms with field groups, repeatable sections, SHACL validations, and error/response handling - all stored in TTL ontologies and queryable via SPARQL.

## Hierarchy & Relationships (OWL/SPARQL)

```
Section (from dialog.ttl)
  └── Question (belongs to section via :inSection)
      └── Form (linked via :hasForm, triggered by answer value)
          └── FieldGroup (linked via form:hasFieldGroup)
              └── Field (linked via form:hasField)
                  ├── Validation Rules (form:hasValidation)
                  ├── Conditional Logic (form:hasConditional)
                  └── Options (form:hasOption)
```

### Repeatable Groups
- Field groups can be marked as `form:isRepeatable true`
- Control min/max occurrences: `form:minOccurs`, `form:maxOccurs`
- Example: "Add Another Driver" button creates a new instance of the driver details group

### All Relationships Maintained via:
- **OWL Properties**: Type-safe relationships in ontology
- **SPARQL Queries**: Dynamic querying of form structure
- **TTL Storage**: Single source of truth

## UI Components

### 1. Form Builder Canvas (Main Area)

```
┌─────────────────────────────────────────────────────────────┐
│  Form: Vehicle Modifications                        [Save]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ⋮⋮ Modification Category Group                   [⚙] │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ ⋮⋮ Category *                                 │   │   │
│  │  │    [Hierarchical Select ▼]                    │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ ⋮⋮ Description                                │   │   │
│  │  │    [Text Area                               ] │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │  [+ Add Field]        [🗑 Delete Group]              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  [+ Add Field Group]                                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2. Field Palette (Left Sidebar)

```
┌────────────────────┐
│  Field Types       │
├────────────────────┤
│  📝 Text Input     │
│  📄 Text Area      │
│  🔢 Number         │
│  📅 Date           │
│  ☑  Select         │
│  ☑☑ Multi-Select   │
│  ⚪ Radio Group    │
│  ☑  Checkbox Group │
│  🔘 Toggle         │
│  🌳 Hierarchical   │
│                    │
│  Special           │
│  📦 Field Group    │
│  🔁 Repeatable Grp │
└────────────────────┘
```

### 3. Properties Panel (Right Sidebar)

When a field is selected:

```
┌───────────────────────────────┐
│  Field Properties             │
├───────────────────────────────┤
│  Basic                        │
│  ├─ Field ID: modification_cat│
│  ├─ Label: Category           │
│  ├─ Type: [Select ▼]          │
│  ├─ Order: [1]                │
│  └─ Required: [✓]             │
│                               │
│  Appearance                   │
│  ├─ Placeholder: Select...    │
│  ├─ Help Text: Choose the...  │
│  ├─ UI Hint: [full-width ▼]   │
│  ├─ CSS Class: custom-select  │
│  └─ Icon: [🚗 car]            │
│                               │
│  Validation                   │
│  [+ Add Validation Rule]      │
│  ├─ ✓ Required                │
│  │   └─ Message: Required     │
│  └─ □ Pattern                 │
│                               │
│  Conditional Logic            │
│  [+ Add Condition]            │
│  ├─ When: has_modifications   │
│  ├─ Equals: yes               │
│  └─ Action: [show ▼]          │
│                               │
│  Options (for Select)         │
│  [+ Add Option]               │
│  ├─ ⋮⋮ Engine (value: engine) │
│  ├─ ⋮⋮ Body (value: body)     │
│  └─ ⋮⋮ Suspension (susp)      │
└───────────────────────────────┘
```

When a field group is selected:

```
┌───────────────────────────────┐
│  Group Properties             │
├───────────────────────────────┤
│  Basic                        │
│  ├─ Group ID: driver_details  │
│  ├─ Label: Driver {index}     │
│  ├─ Description: Details for  │
│  └─ Order: [1]                │
│                               │
│  Repeatable Settings          │
│  ├─ Is Repeatable: [✓]        │
│  ├─ Min Occurs: [1]           │
│  ├─ Max Occurs: [4]           │
│  ├─ Add Button: [Add Driver]  │
│  └─ Remove Button: [Remove]   │
│                               │
│  Display                      │
│  ├─ Collapsible: [✓]          │
│  ├─ Default Collapsed: [□]    │
│  └─ Icon: [👤 user]           │
└───────────────────────────────┘
```

## Drag-and-Drop Behavior

### Drag Sources
1. **Field Palette → Canvas**: Create new field
2. **Canvas Field → Canvas**: Reorder fields within group
3. **Canvas Field → Different Group**: Move field between groups
4. **Canvas Group → Canvas**: Reorder groups

### Drop Zones
- **Between fields**: Insert field at position
- **Into group**: Add field to group
- **Between groups**: Reorder groups
- **Trash icon**: Delete field/group

### Visual Feedback
- **Dragging**: Semi-transparent field/group follows cursor
- **Valid drop zone**: Green highlight
- **Invalid drop zone**: Red highlight with ⛔
- **Auto-scroll**: Canvas scrolls when dragging near edges

## Field Group Management

### Creating a Repeatable Group

```javascript
// Example: Add Additional Drivers
{
  groupId: "driver_details_group",
  groupLabel: "Driver {index}",  // {index} replaced with 1, 2, 3...
  isRepeatable: true,
  minOccurs: 1,   // At least 1 driver required
  maxOccurs: 4,   // Max 4 additional drivers
  addButtonLabel: "Add Another Driver",
  removeButtonLabel: "Remove Driver",
  fields: [
    {fieldId: "first_name", ...},
    {fieldId: "last_name", ...},
    {fieldId: "dob", ...}
  ]
}
```

### Rendered Output

```
┌────────────────────────────────────────┐
│  Driver 1                          [▼] │
│  ├─ First Name: [John            ]     │
│  ├─ Last Name:  [Smith           ]     │
│  ├─ DOB:        [01/05/1985]           │
│  └─ [Remove Driver]                    │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  Driver 2                          [▼] │
│  ├─ First Name: [Jane            ]     │
│  ├─ Last Name:  [Doe             ]     │
│  ├─ DOB:        [15/08/1990]           │
│  └─ [Remove Driver]                    │
└────────────────────────────────────────┘
[+ Add Another Driver]  (max 4)
```

## SHACL Validation Management

### Validation Rule Builder

```
┌───────────────────────────────────────┐
│  Validation Rules for "email"         │
├───────────────────────────────────────┤
│  ✓ Required                           │
│    └─ Error: Email is required        │
│                                       │
│  ✓ Email Format                       │
│    └─ Error: Invalid email format     │
│                                       │
│  ✓ Pattern (Advanced)                 │
│    ├─ Regex: ^[a-zA-Z0-9._%+-]+@...   │
│    └─ Error: Please enter valid email │
│                                       │
│  [+ Add Validation Rule]              │
│  ┌─────────────────────────────────┐ │
│  │ Type: [Email Format      ▼]     │ │
│  │ Message: [                    ] │ │
│  │ [Add]                [Cancel]   │ │
│  └─────────────────────────────────┘ │
└───────────────────────────────────────┘
```

### SHACL Generation (Automatic)

When you save a form, the system automatically generates SHACL shapes:

```turtle
:EmailFieldShape a sh:PropertyShape ;
    sh:path :email ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;  # From required: true
    sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
    sh:message "Invalid email format" .
```

### Validation Types Available

| Type | SHACL Property | UI Input |
|------|----------------|----------|
| Required | `sh:minCount 1` | Checkbox |
| Min Length | `sh:minLength` | Number input |
| Max Length | `sh:maxLength` | Number input |
| Pattern (Regex) | `sh:pattern` | Text input |
| Min Value | `sh:minInclusive` | Number input |
| Max Value | `sh:maxInclusive` | Number input |
| Email | `sh:pattern` (preset) | - |
| URL | `sh:pattern` (preset) | - |
| Phone (UK) | `sh:pattern` (preset) | - |
| Postcode (UK) | `sh:pattern` (preset) | - |

## Error Handling & Responses

### Form-Level Configuration

```
┌─────────────────────────────────────┐
│  Form Settings                      │
├─────────────────────────────────────┤
│  Success                            │
│  ├─ Message: Drivers added!         │
│  └─ Action: [close_modal ▼]         │
│     Options:                        │
│     • close_modal                   │
│     • next_question                 │
│     • custom_endpoint               │
│                                     │
│  Loading                            │
│  └─ Message: Saving drivers...      │
│                                     │
│  Submit                             │
│  └─ Endpoint: /api/drivers/add      │
└─────────────────────────────────────┘
```

### Field-Level Error Messages

Each validation rule has custom error message:
```turtle
:EmailValidation a form:ValidationRule ;
    form:validationType "email" ;
    form:validationMessage "Please enter a valid email address" .
```

Displayed in UI:
```
┌──────────────────────────────┐
│  Email *                     │
│  [john@example           ]   │
│  ❌ Please enter a valid     │
│     email address            │
└──────────────────────────────┘
```

## Conditional Logic Builder

### Visual Condition Builder

```
┌────────────────────────────────────────┐
│  Show/Hide Logic                       │
├────────────────────────────────────────┤
│  Show this field when:                 │
│                                        │
│  [has_modifications ▼] [equals ▼]     │
│  [yes              ▼]                  │
│                                        │
│  [+ Add Condition (AND)]               │
│  [+ Add Condition (OR)]                │
│                                        │
│  Action: [Show ▼]                      │
│  Options:                              │
│  • Show                                │
│  • Hide                                │
│  • Enable                              │
│  • Disable                             │
│  • Require                             │
└────────────────────────────────────────┘
```

### Generated TTL

```turtle
:ModificationDetailsField a form:FormField ;
    form:fieldId "modification_details" ;
    form:hasConditional :ShowIfModifications .

:ShowIfModifications a form:ConditionalLogic ;
    form:condition "has_modifications=yes" ;
    form:action "show" .
```

### Complex Conditions

```
# AND condition
form:condition "has_modifications=yes AND category=engine"

# OR condition
form:condition "relationship=spouse OR relationship=partner"

# Complex
form:condition "(age>=25 AND experience>=5) OR (age>=30)"
```

## SPARQL Query Examples

### Get Full Form Structure

```sparql
PREFIX form: <http://diggi.io/ontology/forms#>
PREFIX : <http://diggi.io/ontology/dialog#>

SELECT ?form ?formTitle ?group ?groupLabel ?field ?fieldLabel ?fieldType ?fieldOrder
WHERE {
  ?question :hasForm ?form .
  ?form form:formTitle ?formTitle .

  OPTIONAL {
    ?form form:hasFieldGroup ?group .
    ?group form:groupLabel ?groupLabel ;
           form:groupOrder ?groupOrder ;
           form:hasField ?field .

    ?field form:fieldLabel ?fieldLabel ;
           form:fieldType ?fieldType ;
           form:fieldOrder ?fieldOrder .
  }

  OPTIONAL {
    ?form form:hasField ?field .
    ?field form:fieldLabel ?fieldLabel ;
           form:fieldType ?fieldType ;
           form:fieldOrder ?fieldOrder .
  }
}
ORDER BY ?groupOrder ?fieldOrder
```

### Get Repeatable Groups for a Form

```sparql
PREFIX form: <http://diggi.io/ontology/forms#>

SELECT ?group ?groupLabel ?minOccurs ?maxOccurs ?addButtonLabel
WHERE {
  ?form form:formId "additional_drivers_form" ;
        form:hasFieldGroup ?group .

  ?group form:isRepeatable true ;
         form:groupLabel ?groupLabel ;
         form:minOccurs ?minOccurs ;
         form:maxOccurs ?maxOccurs ;
         form:addButtonLabel ?addButtonLabel .
}
```

### Get Validation Rules for a Field

```sparql
PREFIX form: <http://diggi.io/ontology/forms#>

SELECT ?field ?validationType ?validationValue ?validationMessage
WHERE {
  ?field form:fieldId "email" ;
         form:hasValidation ?validation .

  ?validation form:validationType ?validationType ;
              form:validationMessage ?validationMessage .

  OPTIONAL { ?validation form:validationValue ?validationValue . }
}
```

## API Endpoints (To Implement)

### Form CRUD

```bash
# List all forms
GET /api/forms
Response: {forms: [{formId, formTitle, questionId, ...}]}

# Get form with full structure (groups, fields, validations)
GET /api/forms/{form_id}
Response: {form: {id, title, groups: [{fields: [...]}]}}

# Create form
POST /api/forms
Body: {formId, formTitle, groups: [...]}

# Update form structure
PUT /api/forms/{form_id}
Body: {groups: [...], fields: [...]}

# Delete form
DELETE /api/forms/{form_id}

# Reorder fields/groups
PATCH /api/forms/{form_id}/reorder
Body: {groupId, fieldOrders: [{fieldId, newOrder}]}
```

### Field/Group Operations

```bash
# Add field to group
POST /api/forms/{form_id}/groups/{group_id}/fields
Body: {fieldId, fieldLabel, fieldType, ...}

# Update field
PUT /api/forms/{form_id}/fields/{field_id}
Body: {fieldLabel, required, ...}

# Delete field
DELETE /api/forms/{form_id}/fields/{field_id}

# Add field group
POST /api/forms/{form_id}/groups
Body: {groupId, groupLabel, isRepeatable, ...}

# Update group
PUT /api/forms/{form_id}/groups/{group_id}
Body: {groupLabel, maxOccurs, ...}
```

### Validation Management

```bash
# Add validation rule to field
POST /api/forms/{form_id}/fields/{field_id}/validations
Body: {validationType, validationValue, validationMessage}

# Update validation
PUT /api/forms/{form_id}/validations/{validation_id}

# Delete validation
DELETE /api/forms/{form_id}/validations/{validation_id}

# Generate SHACL shapes from form
POST /api/forms/{form_id}/generate-shacl
Response: {shacl_ttl: "..."}
```

## Technology Stack

### Frontend
- **React 18** with hooks
- **@dnd-kit** for drag-and-drop
- **Tailwind CSS** + **Flowbite React** for UI
- **React Hook Form** for form state management
- **Zod** for client-side validation

### Backend
- **FastAPI** with Python 3.11
- **RDFLib** for TTL manipulation
- **SPARQL** for querying ontologies
- **Pydantic** for data validation

## Implementation Steps

### Phase 1: Backend API ✅ (Ontology Complete)
- [x] Extended `dialog-forms.ttl` with field groups
- [x] Added repeatable group properties
- [x] Added validation, error handling properties
- [x] Created example repeatable form

### Phase 2: Backend API Methods (IN PROGRESS)
- [ ] Extend `dialog_manager.py` with form query methods
- [ ] Add CRUD endpoints to `config_panel_api.py`
- [ ] Implement SPARQL queries for full form structure
- [ ] Add validation rule management endpoints
- [ ] Create SHACL generation utility

### Phase 3: Frontend Components
- [ ] `FormBuilderCanvas.jsx` - Main drag-drop canvas
- [ ] `FieldPalette.jsx` - Draggable field types
- [ ] `PropertiesPanel.jsx` - Field/group configuration
- [ ] `ValidationBuilder.jsx` - Visual validation editor
- [ ] `ConditionalLogicBuilder.jsx` - Visual condition editor
- [ ] `FieldGroupEditor.jsx` - Group settings with repeat options

### Phase 4: Integration
- [ ] Add "Edit Form" tab to Question Editor
- [ ] Connect forms to questions via `:hasForm`
- [ ] Test drag-drop reordering
- [ ] Test repeatable groups in dialog runtime
- [ ] Add form preview mode

## Example: Complete Workflow

1. **Create Form**: User creates "Vehicle Modifications Form"
2. **Add Group**: Drag "Repeatable Group" from palette
3. **Configure Group**: Set max 3 modifications, add button label
4. **Add Fields to Group**: Drag fields into group (category, description, date)
5. **Set Validation**: Email field gets email validation + custom error message
6. **Add Conditional**: "Installer details" field shows only if "Professional" selected
7. **Link to Question**: Connect form to "Has Modifications?" question with trigger value "yes"
8. **Save**: System generates TTL and SHACL automatically
9. **Runtime**: User answers "yes" → modal appears with form → can add multiple modifications

## Benefits

1. **No Code Required**: Build complex forms visually
2. **Repeatable Groups**: Collect multiple sets of data (drivers, modifications, claims)
3. **TTL Storage**: Single source of truth, version controllable
4. **SPARQL Querying**: Flexible data retrieval
5. **Auto SHACL**: Validation rules automatically converted to SHACL
6. **Reusable**: Forms can be linked to multiple questions
7. **Maintainable**: Edit forms without touching code

## Next Steps

Begin implementing backend API methods for form management with SPARQL queries, then proceed to frontend drag-drop components.
