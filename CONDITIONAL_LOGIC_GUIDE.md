# Conditional Logic & Sub-Questions - Complete Guide

## Overview

The conditional logic system enables dynamic dialog flows where questions appear or hide based on user responses. This allows for sophisticated, context-aware conversations that adapt to user input in real-time.

## Key Concepts

### Sub-Questions

**SubQuestion** is a special type of question that only appears when certain conditions are met. Sub-questions are linked to a parent question and evaluate conditions based on the parent's answer.

**Use Cases**:
- Follow-up questions based on yes/no answers
- Additional details for specific selections
- Conditional validation and data collection
- Dynamic form fields

### Conditional Logic

Conditions determine when sub-questions should appear. They consist of:
- **Operator**: How to compare values (equals, not_equals, contains, etc.)
- **Value**: The value to compare against
- **Field**: Which answer to check (defaults to parent question)

## Ontology Structure

### SubQuestion Class

```turtle
:SubQuestion a owl:Class ;
    rdfs:subClassOf :Question ;
    rdfs:label "Sub Question" ;
    rdfs:comment "A nested question that appears conditionally based on parent answer" .
```

### Conditional Properties

```turtle
:hasSubQuestion a owl:ObjectProperty ;
    rdfs:label "has sub question" ;
    rdfs:domain :Question ;
    rdfs:range :SubQuestion ;
    rdfs:comment "Links a question to its conditional sub-questions" .

:parentQuestion a owl:ObjectProperty ;
    rdfs:label "parent question" ;
    rdfs:domain :SubQuestion ;
    rdfs:range :Question ;
    rdfs:comment "The parent question this sub-question belongs to" .

:showIf a owl:DatatypeProperty ;
    rdfs:label "show if" ;
    rdfs:domain :SubQuestion ;
    rdfs:range xsd:string ;
    rdfs:comment "Condition for showing this sub-question (e.g., 'answer == yes')" .

:conditionOperator a owl:DatatypeProperty ;
    rdfs:label "condition operator" ;
    rdfs:domain :SubQuestion ;
    rdfs:range xsd:string ;
    rdfs:comment "Operator: equals, not_equals, contains, greater_than, less_than, in, not_in" .

:conditionValue a owl:DatatypeProperty ;
    rdfs:label "condition value" ;
    rdfs:domain :SubQuestion ;
    rdfs:range xsd:string ;
    rdfs:comment "Value to compare against for the condition" .

:conditionField a owl:DatatypeProperty ;
    rdfs:label "condition field" ;
    rdfs:domain :SubQuestion ;
    rdfs:range xsd:string ;
    rdfs:comment "Which field/answer to check (defaults to parent question)" .
```

## Condition Operators

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `has_claims == "yes"` |
| `not_equals` | Not equal to | `claim_type != "other"` |
| `contains` | String contains | `email contains "@gmail"` |
| `greater_than` | Numeric greater | `claim_amount > 5000` |
| `less_than` | Numeric less | `age < 25` |
| `in` | Value in list | `cover_type in ["comprehensive", "tpft"]` |
| `not_in` | Value not in list | `payment_method not_in ["cash", "check"]` |

### Advanced Conditions

You can combine multiple conditions using the `showIf` property with logical expressions:

```turtle
:showIf "has_claims == yes AND claim_amount > 1000" .
:showIf "cover_type == comprehensive OR previous_insurer == none" .
```

## Example: Claims Sub-Questions

This is a complete example showing a parent question with multiple sub-questions that appear conditionally.

### Parent Question: Has Claims

```turtle
:HasClaimsQuestion a :Question ;
    rdfs:label "Has Claims Question" ;
    :questionId "has_claims" ;
    :questionText "Have you had any claims in the last 5 years?" ;
    :slotName "has_claims" ;
    :inputType "select" ;
    :required true ;
    :inSection :ClaimsSection ;
    :order 1 ;
    :hasOption :HasClaimsYes, :HasClaimsNo ;
    :hasSubQuestion :ClaimTypeSubQuestion, :ClaimDateSubQuestion, :ClaimAmountSubQuestion, :ClaimDescriptionSubQuestion .
```

### Sub-Question 1: Claim Type

Only appears when `has_claims == "yes"`

```turtle
:ClaimTypeSubQuestion a :SubQuestion ;
    rdfs:label "Claim Type" ;
    :questionId "claim_type" ;
    :questionText "What type of claim was it?" ;
    :slotName "claim_type" ;
    :inputType "select" ;
    :required true ;
    :parentQuestion :HasClaimsQuestion ;
    :conditionOperator "equals" ;
    :conditionValue "yes" ;
    :conditionField "has_claims" ;
    :showIf "has_claims == yes" ;
    :order 2 ;
    :hasOption :ClaimTypeAccident, :ClaimTypeTheft, :ClaimTypeVandalism, :ClaimTypeWindscreen, :ClaimTypeOther .
```

### Sub-Question 2: Claim Date

```turtle
:ClaimDateSubQuestion a :SubQuestion ;
    rdfs:label "Claim Date" ;
    :questionId "claim_date" ;
    :questionText "When did the claim occur?" ;
    :slotName "claim_date" ;
    :inputType "date" ;
    :required true ;
    :parentQuestion :HasClaimsQuestion ;
    :conditionOperator "equals" ;
    :conditionValue "yes" ;
    :conditionField "has_claims" ;
    :showIf "has_claims == yes" ;
    :order 3 .
```

### Sub-Question 3: Claim Amount

```turtle
:ClaimAmountSubQuestion a :SubQuestion ;
    rdfs:label "Claim Amount" ;
    :questionId "claim_amount" ;
    :questionText "What was the approximate claim amount?" ;
    :slotName "claim_amount" ;
    :inputType "number" ;
    :required true ;
    :parentQuestion :HasClaimsQuestion ;
    :conditionOperator "equals" ;
    :conditionValue "yes" ;
    :conditionField "has_claims" ;
    :showIf "has_claims == yes" ;
    :order 4 ;
    :validationMin "0" ;
    :validationMax "100000" .
```

### Sub-Question 4: Claim Description

```turtle
:ClaimDescriptionSubQuestion a :SubQuestion ;
    rdfs:label "Claim Description" ;
    :questionId "claim_description" ;
    :questionText "Please provide a brief description of the claim" ;
    :slotName "claim_description" ;
    :inputType "textarea" ;
    :required false ;
    :parentQuestion :HasClaimsQuestion ;
    :conditionOperator "equals" ;
    :conditionValue "yes" ;
    :conditionField "has_claims" ;
    :showIf "has_claims == yes" ;
    :order 5 ;
    :validationMaxLength "500" .
```

## Dialog Flow

### User Journey

1. **User sees parent question**: "Have you had any claims in the last 5 years?"
2. **User selects "Yes"**
3. **System evaluates conditions**: All sub-questions have `has_claims == yes`
4. **Sub-questions appear**:
   - "What type of claim was it?" (select)
   - "When did the claim occur?" (date)
   - "What was the approximate claim amount?" (number)
   - "Please provide a brief description" (textarea)
5. **User answers sub-questions**
6. **System validates and continues**

### Condition Evaluation

When a parent question is answered:

1. **Retrieve all sub-questions** linked via `:hasSubQuestion`
2. **For each sub-question**:
   - Get `:conditionOperator`, `:conditionValue`, `:conditionField`
   - Evaluate condition against parent answer
   - Show or hide sub-question based on result
3. **Update UI** to display visible sub-questions
4. **Validate answers** when moving to next question

## Implementation

### Backend: Condition Evaluator

```python
class ConditionEvaluator:
    @staticmethod
    def evaluate(operator: str, field_value: str, condition_value: str) -> bool:
        """
        Evaluate a conditional expression
        """
        if operator == "equals":
            return field_value == condition_value
        elif operator == "not_equals":
            return field_value != condition_value
        elif operator == "contains":
            return condition_value in field_value
        elif operator == "greater_than":
            return float(field_value) > float(condition_value)
        elif operator == "less_than":
            return float(field_value) < float(condition_value)
        elif operator == "in":
            values = [v.strip() for v in condition_value.split(',')]
            return field_value in values
        elif operator == "not_in":
            values = [v.strip() for v in condition_value.split(',')]
            return field_value not in values
        else:
            return False
```

### Backend: SPARQL Query for Sub-Questions

```python
def get_sub_questions(parent_question_id: str):
    """
    Query for all sub-questions of a parent question
    """
    query = f"""
    PREFIX : <http://diggi.io/ontology/dialog#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?subQuestion ?questionId ?questionText ?inputType ?required
           ?conditionOperator ?conditionValue ?conditionField ?showIf ?order
    WHERE {{
        :{parent_question_id} :hasSubQuestion ?subQuestion .

        ?subQuestion a :SubQuestion ;
            :questionId ?questionId ;
            :questionText ?questionText ;
            :inputType ?inputType ;
            :required ?required ;
            :conditionOperator ?conditionOperator ;
            :conditionValue ?conditionValue ;
            :order ?order .

        OPTIONAL {{ ?subQuestion :conditionField ?conditionField }}
        OPTIONAL {{ ?subQuestion :showIf ?showIf }}
    }}
    ORDER BY ?order
    """

    results = dialog_manager.graph.query(query)

    sub_questions = []
    for row in results:
        sub_questions.append({
            "question_id": str(row.questionId),
            "question_text": str(row.questionText),
            "input_type": str(row.inputType),
            "required": bool(row.required),
            "condition_operator": str(row.conditionOperator),
            "condition_value": str(row.conditionValue),
            "condition_field": str(row.conditionField) if row.conditionField else parent_question_id,
            "show_if": str(row.showIf) if row.showIf else None,
            "order": int(row.order)
        })

    return sub_questions
```

### Frontend: React Component

```jsx
import React, { useState, useEffect } from 'react';

function ConditionalQuestion({ question, parentAnswer }) {
  const [subQuestions, setSubQuestions] = useState([]);
  const [visibleSubQuestions, setVisibleSubQuestions] = useState([]);

  useEffect(() => {
    // Load sub-questions when parent answer changes
    if (parentAnswer && question.has_sub_questions) {
      loadSubQuestions(question.question_id);
    }
  }, [parentAnswer, question]);

  const loadSubQuestions = async (parentQuestionId) => {
    const response = await fetch(`/api/questions/${parentQuestionId}/sub-questions`);
    const data = await response.json();
    setSubQuestions(data.sub_questions);
    evaluateConditions(data.sub_questions, parentAnswer);
  };

  const evaluateConditions = (subQs, answer) => {
    const visible = subQs.filter(sq => {
      return evaluateCondition(
        sq.condition_operator,
        answer,
        sq.condition_value
      );
    });
    setVisibleSubQuestions(visible);
  };

  const evaluateCondition = (operator, fieldValue, conditionValue) => {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'contains':
        return fieldValue.includes(conditionValue);
      case 'greater_than':
        return parseFloat(fieldValue) > parseFloat(conditionValue);
      case 'less_than':
        return parseFloat(fieldValue) < parseFloat(conditionValue);
      default:
        return false;
    }
  };

  return (
    <div>
      {/* Parent question */}
      <QuestionField question={question} />

      {/* Conditional sub-questions */}
      {visibleSubQuestions.map(subQ => (
        <div key={subQ.question_id} className="ml-6 mt-4 border-l-2 border-blue-300 pl-4">
          <QuestionField question={subQ} />
        </div>
      ))}
    </div>
  );
}
```

## Common Patterns

### Yes/No Follow-Up

```turtle
:HasModificationsQuestion a :Question ;
    :questionText "Does your vehicle have any modifications?" ;
    :inputType "select" ;
    :hasOption :Yes, :No ;
    :hasSubQuestion :ModificationsListSubQuestion .

:ModificationsListSubQuestion a :SubQuestion ;
    :questionText "Please list the modifications" ;
    :inputType "textarea" ;
    :parentQuestion :HasModificationsQuestion ;
    :conditionOperator "equals" ;
    :conditionValue "yes" ;
    :showIf "has_modifications == yes" .
```

### Multi-Level Conditions

```turtle
:CoverTypeQuestion a :Question ;
    :questionText "What type of cover do you need?" ;
    :inputType "select" ;
    :hasOption :Comprehensive, :ThirdParty ;
    :hasSubQuestion :VoluntaryExcessSubQuestion .

:VoluntaryExcessSubQuestion a :SubQuestion ;
    :questionText "What voluntary excess would you like?" ;
    :inputType "number" ;
    :parentQuestion :CoverTypeQuestion ;
    :conditionOperator "equals" ;
    :conditionValue "comprehensive" ;
    :showIf "cover_type == comprehensive" ;
    :hasSubQuestion :ExcessReasonSubQuestion .

:ExcessReasonSubQuestion a :SubQuestion ;
    :questionText "Why choose this excess level?" ;
    :inputType "textarea" ;
    :parentQuestion :VoluntaryExcessSubQuestion ;
    :conditionOperator "greater_than" ;
    :conditionValue "500" ;
    :showIf "voluntary_excess > 500" .
```

### Multiple Conditions

```turtle
:AgeQuestion a :Question ;
    :questionText "What is your age?" ;
    :inputType "number" ;
    :hasSubQuestion :YoungDriverExcessSubQuestion .

:YoungDriverExcessSubQuestion a :SubQuestion ;
    :questionText "Due to your age, an additional excess applies. Do you accept?" ;
    :inputType "select" ;
    :parentQuestion :AgeQuestion ;
    :conditionOperator "less_than" ;
    :conditionValue "25" ;
    :showIf "age < 25" .
```

## Best Practices

### Design Principles

1. **Keep It Simple**
   - Avoid deeply nested sub-questions (max 2-3 levels)
   - Use clear, simple conditions
   - Group related sub-questions together

2. **User Experience**
   - Show sub-questions immediately when condition is met
   - Provide visual hierarchy (indentation, borders)
   - Clear labels indicating conditional nature

3. **Validation**
   - Validate parent answer before showing sub-questions
   - Mark required sub-questions clearly
   - Validate all visible sub-questions before proceeding

4. **Performance**
   - Cache sub-question definitions
   - Evaluate conditions client-side when possible
   - Only query visible sub-questions

### Naming Conventions

- **Parent Question ID**: Descriptive name (e.g., `HasClaimsQuestion`)
- **Sub-Question ID**: Prefix with parent + specific name (e.g., `ClaimTypeSubQuestion`)
- **Condition Field**: Use slot names (e.g., `has_claims`, `claim_amount`)

### Order Management

- **Parent**: Use main section order (e.g., 1)
- **Sub-Questions**: Use decimal or sequential (e.g., 2, 3, 4)
- **Leave Gaps**: Allow for future insertions

## Testing

### Test Scenarios

1. **Condition Met**: Parent answer triggers sub-questions
2. **Condition Not Met**: Sub-questions remain hidden
3. **Change Parent Answer**: Sub-questions appear/disappear dynamically
4. **Validation**: Required sub-questions validate correctly
5. **Multi-Level**: Nested sub-questions work correctly
6. **Data Persistence**: Sub-question answers saved correctly

### Example Test Cases

```javascript
describe('Conditional Logic', () => {
  it('shows sub-questions when condition is met', () => {
    // Given a parent question with sub-questions
    const parent = { question_id: 'has_claims', input_type: 'select' };

    // When user selects "yes"
    const answer = 'yes';

    // Then sub-questions should appear
    const visible = evaluateConditions(subQuestions, answer);
    expect(visible).toHaveLength(4);
  });

  it('hides sub-questions when condition is not met', () => {
    // Given a parent question with sub-questions
    const parent = { question_id: 'has_claims', input_type: 'select' };

    // When user selects "no"
    const answer = 'no';

    // Then sub-questions should be hidden
    const visible = evaluateConditions(subQuestions, answer);
    expect(visible).toHaveLength(0);
  });
});
```

## Troubleshooting

### Sub-Questions Not Appearing

**Problem**: Sub-questions don't show when condition is met

**Solutions**:
1. Check `:hasSubQuestion` link exists
2. Verify `:conditionOperator` and `:conditionValue` are correct
3. Ensure parent answer matches exactly (case-sensitive)
4. Check `:conditionField` matches parent slot name

### Incorrect Condition Evaluation

**Problem**: Conditions evaluate incorrectly

**Solutions**:
1. Verify operator spelling (e.g., "equals" not "equal")
2. Check data types (string vs. number)
3. Review `:showIf` syntax
4. Test with simple conditions first

### Performance Issues

**Problem**: Slow loading of sub-questions

**Solutions**:
1. Cache sub-question definitions
2. Limit depth of nesting
3. Optimize SPARQL queries
4. Load sub-questions asynchronously

## Future Enhancements

- [ ] Visual conditional flow editor (drag-and-drop)
- [ ] Complex logical expressions (AND/OR/NOT)
- [ ] Conditional validation rules
- [ ] Sub-question templates
- [ ] Condition testing tool
- [ ] Analytics on condition usage
- [ ] Cross-question conditions (e.g., age + cover_type)
- [ ] Time-based conditions (e.g., show after 5 seconds)
- [ ] Context-aware conditions (e.g., based on session data)

## Summary

The conditional logic system provides:

- ✅ SubQuestion class for nested questions
- ✅ Comprehensive condition operators
- ✅ Parent-child question relationships
- ✅ Dynamic show/hide based on answers
- ✅ Multi-level nesting support
- ✅ Flexible condition expressions
- ✅ Complete ontology integration
- ✅ SPARQL query support
- ✅ Frontend evaluation logic

This enables sophisticated, adaptive dialog flows that respond intelligently to user input.

Happy conditional dialog building! 🔀
