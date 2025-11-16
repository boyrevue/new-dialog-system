# Section Alias Manager - Complete Guide

## Overview

The Section Alias Manager provides a comprehensive UI for managing semantic aliases, phonetic spellings, and metadata for dialog sections. This enables better voice recognition, natural language understanding, and improved user navigation through the dialog flow.

## Features

- Edit section titles, descriptions, and icons
- Add/remove semantic aliases for voice recognition
- Add/remove phonetic spellings for ASR (Automatic Speech Recognition)
- Quick icon selector with common options
- Real-time preview of changes
- TTL/RDF preview before saving
- Validation and error handling

## Architecture

### Frontend Component

**SectionAliasManager.jsx** - React UI Component (470 lines)
- Location: `frontend/src/components/SectionAliasManager.jsx`
- Manages section metadata and aliases
- Provides visual editor with instant preview
- Generates TTL output for ontology storage

### Backend API

**config_panel_api.py** - Section Management Endpoints (200+ lines)
- `GET /api/config/section/{section_id}` - Get section data
- `POST /api/config/section/save` - Save section with aliases
- `GET /api/config/sections` - Get all sections

### Ontology Storage

**dialog.ttl** - Core Dialog Ontology
- Section definitions with aliases and phonetics
- Properties: `:sectionAlias`, `:sectionPhonetic`, `:sectionIcon`
- Stored in the core ontology for centralized management

## Section Properties

### Core Properties

- **section_id** (String, CamelCase): Unique identifier (e.g., `DriversSection`)
- **title** (String): Display title (e.g., "Driver Information")
- **description** (String): Brief description of what the section collects
- **icon** (String): Emoji/icon for visual identification (e.g., "👤")
- **order** (Integer): Display order in dialog flow (1, 2, 3...)

### Semantic Aliases

**Purpose**: Alternative names users might use to refer to this section

**Use Cases**:
- Voice navigation ("Go to driver details" → DriversSection)
- Natural language understanding ("Tell me about the car" → VehicleSection)
- Fuzzy matching for ASR variations

**Examples**:
```
DriversSection:
  - "Driver Info"
  - "Driver Details"
  - "About the Driver"
  - "Personal Information"
  - "Who's Driving"

VehicleSection:
  - "Car Details"
  - "Vehicle Info"
  - "About the Car"
  - "Car Information"
  - "My Vehicle"
```

### Phonetic Spellings

**Purpose**: Help ASR understand spelled-out or mispronounced words

**Use Cases**:
- Spelling corrections for uncommon words
- Phonetic variations ASR might recognize
- Alternative pronunciations

**Examples**:
```
DriversSection:
  - "Driver Information"
  - "Dryver Info"

VehicleSection:
  - "Vee Hickle Details"
  - "Car Details"
```

## Usage Workflow

### Step 1: Open Section Alias Manager

From the Dialog Editor or Config Panel:

```jsx
import SectionAliasManager from './components/SectionAliasManager';

<SectionAliasManager
  sectionId="DriversSection"
  onSave={(data) => {
    console.log('Section saved!', data);
    reloadSections();
  }}
  onCancel={() => closeSectionManager()}
/>
```

### Step 2: Edit Section Metadata

1. **Section ID**: Unique identifier (CamelCase, no spaces)
   - Cannot be changed if editing existing section
   - Example: `DriversSection`, `VehicleSection`

2. **Title**: Display title shown to users
   - Example: "Driver Information"

3. **Description**: Brief explanation
   - Example: "Driver information and details"

4. **Icon**: Select from common icons or enter custom emoji
   - Click quick-select buttons for common icons
   - Or type emoji directly in the input field

5. **Order**: Sequence in dialog flow
   - Lower numbers appear first
   - Example: 1, 2, 3...

### Step 3: Add Semantic Aliases

1. Type an alias in the input field
2. Press Enter or click "Add Alias"
3. Repeat for all variations users might say
4. Remove unwanted aliases with the "Remove" button

**Tips**:
- Add common abbreviations (e.g., "Driver Info")
- Include natural language variations (e.g., "About the Driver")
- Think about how users might refer to the section verbally

### Step 4: Add Phonetic Spellings

1. Type a phonetic spelling in the input field
2. Press Enter or click "Add Phonetic"
3. Add multiple variations for better ASR accuracy
4. Remove unwanted phonetics with the "Remove" button

**Tips**:
- Spell out complex words phonetically
- Include common mispronunciations
- Add spelled-out versions of abbreviations

### Step 5: Preview Changes

The preview section shows:
- Icon and title combination
- Description
- List of aliases
- List of phonetic spellings

This gives you a visual representation of how the section will appear.

### Step 6: Generate TTL Preview

Click "Generate TTL Preview" to see the RDF/OWL output:

```turtle
# Section: Driver Information
:DriversSection a :Section ;
    rdfs:label "Driver Information" ;
    :sectionTitle "👤 Driver Information" ;
    :sectionDescription "Driver information and details" ;
    :sectionAlias "Driver Info", "Driver Details", "About the Driver" ;
    :sectionPhonetic "Driver Information", "Dryver Info" ;
    :sectionIcon "👤" ;
    :order 2 .
```

Review the TTL to ensure:
- Aliases are properly quoted and separated
- Phonetics are correct
- Icon is preserved
- Order is correct

### Step 7: Save to Ontology

Click "Save Section" to:
1. Validate the section data
2. Create a backup of dialog.ttl
3. Update or append the section definition
4. Reload the ontology

Success message confirms the save.

## API Reference

### Get Section Data

```http
GET /api/config/section/{section_id}
```

**Response:**
```json
{
  "section_id": "DriversSection",
  "section": {
    "section_id": "DriversSection",
    "title": "Driver Information",
    "description": "Driver information and details",
    "icon": "👤",
    "aliases": [
      "Driver Info",
      "Driver Details",
      "About the Driver"
    ],
    "phonetics": [
      "Driver Information",
      "Dryver Info"
    ],
    "order": 2
  }
}
```

### Save Section

```http
POST /api/config/section/save
Content-Type: application/json

{
  "section_id": "DriversSection",
  "title": "Driver Information",
  "description": "Driver information and details",
  "icon": "👤",
  "aliases": ["Driver Info", "Driver Details"],
  "phonetics": ["Dryver Info"],
  "order": 2,
  "ttl_content": ":DriversSection a :Section ; ..."
}
```

**Response:**
```json
{
  "success": true,
  "section_id": "DriversSection",
  "ontology_file": "dialog.ttl",
  "backup_created": "/path/to/dialog.ttl.backup",
  "message": "Section DriversSection saved successfully"
}
```

### Get All Sections

```http
GET /api/config/sections
```

**Response:**
```json
{
  "sections": [
    {
      "section_id": "DriversSection",
      "title": "👤 Driver Information",
      "description": "Driver information and details",
      "icon": "👤",
      "order": 2
    },
    {
      "section_id": "VehicleSection",
      "title": "🚗 Vehicle Details",
      "description": "Vehicle details and specifications",
      "icon": "🚗",
      "order": 3
    }
  ],
  "count": 2
}
```

## Integration Examples

### In Dialog Editor

```jsx
import { useState } from 'react';
import SectionAliasManager from './components/SectionAliasManager';

function DialogEditor() {
  const [showSectionManager, setShowSectionManager] = useState(false);
  const [currentSection, setCurrentSection] = useState(null);

  const handleEditSection = (sectionId) => {
    setCurrentSection(sectionId);
    setShowSectionManager(true);
  };

  const handleSectionSaved = (data) => {
    console.log('Section saved:', data);
    setShowSectionManager(false);
    reloadSections(); // Reload sections from API
  };

  return (
    <div>
      {/* Section list */}
      <button onClick={() => handleEditSection('DriversSection')}>
        Edit Driver Section
      </button>

      {/* Section Alias Manager Modal */}
      {showSectionManager && (
        <SectionAliasManager
          sectionId={currentSection}
          onSave={handleSectionSaved}
          onCancel={() => setShowSectionManager(false)}
        />
      )}
    </div>
  );
}
```

### Standalone Usage

```jsx
import SectionAliasManager from './components/SectionAliasManager';

function App() {
  return (
    <SectionAliasManager
      sectionId="VehicleSection"
      onSave={(data) => console.log('Saved!', data)}
    />
  );
}
```

## Common Icons

The component provides quick-select buttons for common icons:

| Icon | Label | Use Case |
|------|-------|----------|
| 👤 | Person | Driver, Personal Info |
| 🚗 | Car | Vehicle Details |
| 📄 | Document | Policy, Forms |
| 📋 | Clipboard | Claims, Lists |
| 💳 | Payment | Payment Info |
| ➕ | Plus | Extras, Add-ons |
| 📧 | Email | Marketing, Contact |
| 🏠 | Home | Address, Location |
| 📞 | Phone | Contact Info |
| ⚙️ | Settings | Configuration |
| 📊 | Chart | Analytics, Stats |
| 🔒 | Lock | Security, Privacy |
| ✅ | Check | Confirmation |
| ❌ | Cross | Errors, Cancel |
| ⚠️ | Warning | Alerts |
| 💡 | Idea | Tips, Help |

## Best Practices

### Aliases

1. **Include Natural Variations**
   - Formal: "Driver Information"
   - Informal: "Driver Info"
   - Casual: "About the Driver"

2. **Add Common Abbreviations**
   - "Driver Info" (abbreviated)
   - "Driver Details" (alternative)

3. **Think Voice-First**
   - How would users say it verbally?
   - Include conversational phrases

4. **Avoid Duplicates**
   - System validates against existing aliases
   - Each alias should be unique within the section

### Phonetics

1. **Spell Out Complex Words**
   - "Vehicle" → "Vee Hickle"
   - "Driver" → "Dryver"

2. **Include Common Mishearings**
   - What might ASR confuse this with?
   - Add phonetic variations

3. **Keep It Simple**
   - Don't over-complicate
   - Focus on likely pronunciation variations

### Icons

1. **Be Consistent**
   - Use similar icons for related sections
   - Maintain a cohesive visual language

2. **Choose Recognizable Symbols**
   - Universal meanings
   - Clear visual metaphors

3. **Test Visibility**
   - Ensure icons are visible at different sizes
   - Check contrast and readability

### Order

1. **Logical Flow**
   - Start with personal info (Drivers)
   - Move to specifics (Vehicle)
   - End with preferences (Marketing)

2. **User Journey**
   - Match natural conversation flow
   - Guide users through the process

3. **Leave Gaps**
   - Use 1, 2, 3... for initial sections
   - Leave room for future insertions (e.g., 1, 5, 10)

## Ontology Structure

### Section Class

```turtle
:Section a owl:Class ;
    rdfs:label "Section" ;
    rdfs:comment "A grouping of related questions in the dialog" .
```

### Properties

```turtle
:sectionTitle a owl:DatatypeProperty ;
    rdfs:label "section title" ;
    rdfs:domain :Section ;
    rdfs:range xsd:string .

:sectionDescription a owl:DatatypeProperty ;
    rdfs:label "section description" ;
    rdfs:domain :Section ;
    rdfs:range xsd:string .

:sectionAlias a owl:DatatypeProperty ;
    rdfs:label "section alias" ;
    rdfs:domain :Section ;
    rdfs:range xsd:string ;
    rdfs:comment "Alternative names for voice recognition" .

:sectionPhonetic a owl:DatatypeProperty ;
    rdfs:label "section phonetic" ;
    rdfs:domain :Section ;
    rdfs:range xsd:string ;
    rdfs:comment "Phonetic spellings for ASR" .

:sectionIcon a owl:DatatypeProperty ;
    rdfs:label "section icon" ;
    rdfs:domain :Section ;
    rdfs:range xsd:string .

:order a owl:DatatypeProperty ;
    rdfs:label "order" ;
    rdfs:domain :DialogNode ;
    rdfs:range xsd:integer .
```

### Example Instance

```turtle
:DriversSection a :Section ;
    rdfs:label "Drivers" ;
    :sectionTitle "👤 Driver Information" ;
    :sectionDescription "Driver information and details" ;
    :sectionAlias "Driver Info", "Driver Details", "About the Driver", "Personal Information", "Who's Driving" ;
    :sectionPhonetic "Driver Information", "Dryver Info" ;
    :sectionIcon "👤" ;
    :order 2 ;
    :nextNode :VehicleSection .
```

## Troubleshooting

### Section Not Found

**Problem**: API returns "Section not found"

**Solutions**:
1. Check section_id spelling (case-sensitive)
2. Ensure section exists in dialog.ttl
3. Verify ontology file is loaded correctly

### Save Fails

**Problem**: Section save returns an error

**Solutions**:
1. Check file permissions on dialog.ttl
2. Ensure backup directory is writable
3. Validate TTL syntax
4. Check for special characters in values

### Aliases Not Appearing

**Problem**: Aliases don't show in SPARQL queries

**Solutions**:
1. Reload the ontology after save
2. Check TTL syntax (commas between aliases)
3. Verify SPARQL query includes OPTIONAL clause

### Icons Not Displaying

**Problem**: Emoji icons don't show correctly

**Solutions**:
1. Ensure UTF-8 encoding
2. Check browser emoji support
3. Use system emojis (not custom fonts)

## Future Enhancements

- [ ] Bulk import sections from CSV
- [ ] Auto-generate aliases using AI/NLP
- [ ] Section templates for common use cases
- [ ] Alias usage analytics (which aliases are used most)
- [ ] Visual section flow editor (drag-and-drop reordering)
- [ ] Section grouping and nesting
- [ ] Conditional section visibility
- [ ] Multi-language support for aliases
- [ ] Voice testing tool (test ASR recognition)
- [ ] Integration with NLU for alias suggestions

## Support

For issues or questions:
1. Check this documentation
2. Review the SELECT_LIST_MANAGER_GUIDE.md for related features
3. Inspect the TTL output for syntax errors
4. Check API endpoint responses
5. Review ontology file structure

## Summary

The Section Alias Manager provides:

- ✅ Visual editor for section metadata
- ✅ Semantic aliases for voice recognition
- ✅ Phonetic spellings for ASR
- ✅ Icon management with quick-select
- ✅ Real-time preview
- ✅ TTL/RDF generation
- ✅ REST API endpoints
- ✅ Ontology integration
- ✅ Validation and error handling

This enables better voice-first experiences, natural language understanding, and improved user navigation through the dialog system.

Happy section managing! 📋
