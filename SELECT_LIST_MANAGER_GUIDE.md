# Select List Manager - Complete Guide

## Overview

The Select List Manager is a comprehensive system for managing dropdown/select options in your dialog questions. It supports both flat (1D) and hierarchical (2D) select lists with full CSV import/export capabilities.

## Features

- **CSV Upload**: Import select options from CSV files
- **1D & 2D Lists**: Support for both flat and hierarchical dropdowns
- **Aliases & Phonetics**: Enhanced voice recognition with alternative names
- **TTL Generation**: Automatic RDF/OWL ontology generation
- **Preview Before Save**: Review generated TTL before committing
- **Template Download**: Get pre-formatted CSV templates

## System Architecture

### Backend Components

1. **csv_select_parser.py** - Core CSV parsing logic
   - Parses 1D and 2D CSV formats
   - Validates data structure
   - Generates TTL/RDF ontology
   - Provides example templates

2. **config_panel_api.py** - REST API Endpoints
   - `POST /api/config/select-list/upload-csv` - Parse and preview CSV
   - `GET /api/config/select-list/csv-template/{list_type}` - Download templates
   - `POST /api/config/select-list/save` - Save to TTL ontology
   - `GET /api/config/select-list/{question_id}` - Get existing options

### Frontend Component

**SelectListManager.jsx** - React UI Component
   - File upload and text paste
   - CSV validation with error display
   - Option preview (1D flat view, 2D hierarchical view)
   - TTL preview before saving
   - Integration with DialogEditor

## CSV Formats

### 1D Select List (Flat Dropdown)

**Format:** `label,value,aliases,phonetics`

**Use Cases:**
- Cover types (Comprehensive, Third Party, etc.)
- Payment frequencies (Monthly, Annually)
- Yes/No options
- Single-tier lists

**Example:**

```csv
label,value,aliases,phonetics
Comprehensive,comprehensive,"Comprehensive|Comp|Fully Comp","Comp|Fully Comprehensive"
Third Party Fire and Theft,third_party_fire_theft,"TPFT|Third Party Fire Theft","Tee Pee Eff Tee"
Third Party Only,third_party,"Third Party|TP|TPO","Tee Pee Oh"
```

**Generated TTL:**

```turtle
# Select options for CoverTypeQuestion

:CoverTypeQuestionOption1 a :SelectOption ;
    rdfs:label "Comprehensive" ;
    :optionValue "comprehensive" ;
    :optionLabel "Comprehensive" ;
    :optionAlias "Comprehensive", "Comp", "Fully Comp" ;
    :optionPhonetic "Comp", "Fully Comprehensive" ;
    :forQuestion :CoverTypeQuestion .

:CoverTypeQuestion
    :hasOption :CoverTypeQuestionOption1 ;
    :hasOption :CoverTypeQuestionOption2 ;
    :hasOption :CoverTypeQuestionOption3 .
```

### 2D Select List (Hierarchical Dropdown)

**Format:** `category,label,value,aliases,phonetics`

**Use Cases:**
- Car manufacturer & model
- Country & city
- Category & subcategory
- Two-tier hierarchies

**Example:**

```csv
category,label,value,aliases,phonetics
Toyota,Corolla,toyota_corolla,"Toyota Corolla|Corolla",""
Toyota,Camry,toyota_camry,"Toyota Camry|Camry",""
BMW,3 Series,bmw_3_series,"BMW 3|3 Series","Bee Em Double You Three"
BMW,X5,bmw_x5,"BMW X5|X Five","Bee Em Double You Ex Five"
Mercedes,C-Class,mercedes_c_class,"Mercedes C|C-Class","Mercedes See Class"
```

**Generated TTL:**

```turtle
# Hierarchical select options for CarModelQuestion

:CarModelQuestionOptGroup1 a :SelectOptGroup ;
    rdfs:label "Toyota" ;
    :groupLabel "Toyota" ;
    :hasOption :CarModelQuestionOptGroup1Option1 ;
    :hasOption :CarModelQuestionOptGroup1Option2 .

:CarModelQuestionOptGroup1Option1 a :SelectOption ;
    rdfs:label "Corolla" ;
    :optionValue "toyota_corolla" ;
    :optionLabel "Corolla" ;
    :optionCategory "Toyota" ;
    :optionAlias "Toyota Corolla", "Corolla" ;
    :inOptGroup :CarModelQuestionOptGroup1 .

:CarModelQuestion
    :hasOptGroup :CarModelQuestionOptGroup1 ;
    :hasOptGroup :CarModelQuestionOptGroup2 .
```

## Field Descriptions

### Common Fields (1D & 2D)

- **label** *(required)*: Display text shown to the user
- **value** *(required)*: Internal value stored in database
- **aliases** *(optional)*: Pipe-separated alternative names for fuzzy matching
  - Used for voice recognition variations
  - Example: `"BMW|Bee Em Double You|Beamer"`
- **phonetics** *(optional)*: Pipe-separated phonetic spellings
  - Helps ASR understand spelled-out words
  - Example: `"Bee Em Double You Three"`

### 2D-Specific Fields

- **category** *(required)*: Parent category for hierarchical grouping
  - Creates optgroup in HTML select
  - Example: `"Toyota"`, `"BMW"`, `"Mercedes"`

## Usage Workflow

### Step 1: Choose List Type

**1D List** - For simple dropdowns without categories
**2D List** - For hierarchical dropdowns with parent categories

### Step 2: Prepare CSV

Option A: Download template
```bash
GET /api/config/select-list/csv-template/1d
GET /api/config/select-list/csv-template/2d
```

Option B: Create from scratch following the format above

### Step 3: Upload CSV

You can either:
- Upload a `.csv` file using the file picker
- Paste CSV content directly into the text area

### Step 4: Parse & Preview

Click "Parse CSV" to:
- Validate format and required fields
- Check for errors (missing values, incorrect structure)
- Preview options in a readable format
- Generate TTL preview

### Step 5: Review TTL

Click "TTL Preview" to see the generated RDF/OWL:
- Verify URIs and property names
- Check aliases and phonetics are correct
- Ensure hierarchical structure (for 2D lists)

### Step 6: Save to Ontology

Click "Save to TTL Ontology" to:
- Backup existing ontology file
- Append new select options
- Update the ontology file
- Trigger ontology reload

## API Reference

### Upload CSV

```http
POST /api/config/select-list/upload-csv
Content-Type: application/json

{
  "csv_content": "label,value,aliases,phonetics\nOption1,opt1,\"A|B\",\"Phonetic\"",
  "question_id": "CoverTypeQuestion",
  "list_type": "1d"
}
```

**Response (Success):**
```json
{
  "success": true,
  "list_type": "1d",
  "options": [
    {
      "label": "Option1",
      "value": "opt1",
      "aliases": ["A", "B"],
      "phonetics": ["Phonetic"]
    }
  ],
  "ttl_preview": "# Select options for CoverTypeQuestion\n...",
  "count": 1
}
```

**Response (Errors):**
```json
{
  "success": false,
  "errors": [
    "Row 2: Label and value are required",
    "Row 5: Missing required headers"
  ],
  "options": []
}
```

### Get Template

```http
GET /api/config/select-list/csv-template/1d
```

**Response:**
```json
{
  "list_type": "1d",
  "description": "1D Select List - Flat dropdown (label, value, aliases, phonetics)",
  "template": "label,value,aliases,phonetics\n...",
  "example_use_cases": {
    "1d": ["Cover types", "Payment frequencies", ...],
    "2d": ["Car manufacturer & model", "Country & city", ...]
  }
}
```

### Save to TTL

```http
POST /api/config/select-list/save
Content-Type: application/json

{
  "question_id": "CoverTypeQuestion",
  "list_type": "1d",
  "ttl_content": ":CoverTypeQuestionOption1 a :SelectOption ; ...",
  "ontology_file": "insurance_questions"
}
```

**Response:**
```json
{
  "success": true,
  "question_id": "CoverTypeQuestion",
  "ontology_file": "insurance_questions",
  "backup_created": "/path/to/ontologies/dialog-insurance-questions.ttl.backup",
  "message": "Select list saved successfully for CoverTypeQuestion"
}
```

### Get Existing Options

```http
GET /api/config/select-list/CoverTypeQuestion
```

**Response:**
```json
{
  "question_id": "CoverTypeQuestion",
  "has_options": true,
  "options": [
    {
      "label": "Comprehensive",
      "value": "comprehensive",
      "aliases": ["Comp", "Fully Comp"],
      ...
    }
  ],
  "count": 3
}
```

## React Component Integration

### Basic Usage

```jsx
import SelectListManager from './components/SelectListManager';

function MyComponent() {
  const handleSave = (data) => {
    console.log('Saved!', data);
    // Reload questions or update UI
  };

  return (
    <SelectListManager
      questionId="CoverTypeQuestion"
      onSave={handleSave}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

### In DialogEditor

```jsx
{showSelectListManager && (
  <SelectListManager
    questionId={currentQuestion.question_id}
    onSave={(data) => {
      setShowSelectListManager(false);
      reloadQuestions();
    }}
    onCancel={() => setShowSelectListManager(false)}
  />
)}
```

## Ontology Structure

### Classes

- `:SelectOption` - Individual option in a select list
- `:SelectOptGroup` - Category grouping for hierarchical lists

### Properties

**For Options:**
- `:optionLabel` - Display text
- `:optionValue` - Internal value
- `:optionAlias` - Alternative names (multiple)
- `:optionPhonetic` - Phonetic spellings (multiple)
- `:optionCategory` - Parent category (2D only)
- `:forQuestion` - Question this option belongs to
- `:inOptGroup` - Parent optgroup (2D only)

**For OptGroups:**
- `:groupLabel` - Category name
- `:hasOption` - Child options in this group

**For Questions:**
- `:hasOption` - Direct options (1D)
- `:hasOptGroup` - Option groups (2D)

## Best Practices

### Aliases

1. **Include Common Variations**
   ```
   "BMW|Bee Em Double You|Beamer|Bimmer"
   ```

2. **Add Abbreviations**
   ```
   "Third Party Fire and Theft|TPFT|Third Party Fire & Theft"
   ```

3. **Include Spelling Variations**
   ```
   "Volkswagen|VW|Volks Wagen"
   ```

### Phonetics

1. **Spell Out Acronyms**
   ```
   "BMW" → "Bee Em Double You"
   ```

2. **Phonetic Numbers**
   ```
   "3 Series" → "Three Series"
   "X5" → "Ex Five"
   ```

3. **Common Mishearings**
   ```
   "RAV4" → "Rav Four|Are Ay Vee Four"
   ```

### Values

1. **Use Lowercase with Underscores**
   ```
   "third_party_fire_theft"
   ```

2. **Be Descriptive but Concise**
   ```
   "toyota_corolla" not "tc" or "toyota_corolla_2024_model"
   ```

3. **Match Database Schema**
   Ensure values align with your data model

## Error Handling

### Common Errors

**"Missing required headers"**
- Ensure CSV has correct column names
- Check for typos (label vs Label)

**"Label and value are required"**
- Every row must have both label and value
- Check for empty cells

**"CSV parsing error"**
- Check CSV formatting (commas, quotes)
- Ensure proper escaping of special characters

### Validation

The parser validates:
- Required headers present
- Non-empty label and value
- Proper CSV structure
- Alias/phonetic formatting

## Examples

### Example 1: Insurance Cover Types

```csv
label,value,aliases,phonetics
Comprehensive,comprehensive,"Comp|Fully Comp|Comprehensive Cover",""
Third Party Fire & Theft,tpft,"TPFT|Third Party Fire and Theft|TP Fire Theft","Tee Pee Eff Tee"
Third Party Only,third_party,"TP|TPO|Third Party","Tee Pee|Tee Pee Oh"
```

### Example 2: UK Car Manufacturers

```csv
category,label,value,aliases,phonetics
British,Aston Martin,aston_martin,"Aston|Aston Martin",""
British,Jaguar,jaguar,"Jag|Jaguar",""
British,Land Rover,land_rover,"Land Rover|LR",""
German,BMW,bmw,"BMW|Beamer|Bimmer","Bee Em Double You"
German,Mercedes,mercedes,"Mercedes|Mercedes Benz|Merc",""
German,Audi,audi,"Audi",""
Japanese,Toyota,toyota,"Toyota",""
Japanese,Honda,honda,"Honda",""
Japanese,Nissan,nissan,"Nissan",""
```

### Example 3: Payment Frequencies

```csv
label,value,aliases,phonetics
Monthly,monthly,"Monthly|Per Month|Every Month",""
Quarterly,quarterly,"Quarterly|Every 3 Months|3 Monthly",""
Annually,annually,"Annually|Yearly|Per Year|Annual Payment",""
```

## Testing

### Test the CSV Parser

```bash
cd backend
python csv_select_parser.py
```

This will output:
- Example 1D CSV and parsed options
- Example 2D CSV and parsed options
- Generated TTL for both

### Test the API

```bash
# Get 1D template
curl http://localhost:8002/api/config/select-list/csv-template/1d

# Get 2D template
curl http://localhost:8002/api/config/select-list/csv-template/2d

# Upload CSV
curl -X POST http://localhost:8002/api/config/select-list/upload-csv \
  -H "Content-Type: application/json" \
  -d '{"csv_content": "label,value\nTest,test", "question_id": "TestQuestion", "list_type": "1d"}'
```

## Troubleshooting

### CSV Not Parsing

1. Check file encoding (should be UTF-8)
2. Verify comma delimiters
3. Check for unescaped quotes
4. Ensure CRLF or LF line endings

### TTL Generation Issues

1. Verify question_id is valid
2. Check for special characters in values
3. Ensure proper quote escaping

### Save Failures

1. Check ontology file permissions
2. Verify ontology file exists
3. Check backup file creation
4. Review server logs

## Future Enhancements

- [ ] Bulk import multiple questions
- [ ] Edit existing options inline
- [ ] Auto-generate aliases using AI
- [ ] Import from JSON/Excel
- [ ] Visual option editor (drag-and-drop)
- [ ] Validation against SHACL shapes
- [ ] Option usage analytics
- [ ] Deprecation/archival of options

## Support

For issues or questions:
1. Check this documentation
2. Review example CSV templates
3. Test with the CSV parser directly
4. Check API endpoint responses
5. Review ontology TTL files

## Summary

The Select List Manager provides a complete solution for managing dropdown options:

- ✅ CSV import/export
- ✅ 1D and 2D hierarchical lists
- ✅ Aliases and phonetics for voice
- ✅ TTL/RDF generation
- ✅ Preview before save
- ✅ Template download
- ✅ React UI component
- ✅ REST API endpoints

Happy select list managing! 🚀
