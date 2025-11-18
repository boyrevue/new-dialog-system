import { z } from 'zod';

/**
 * Generate Zod schema from ontology form definition
 * Converts TTL validation rules to Zod validation schemas
 */

export function generateSchemaFromForm(formDefinition) {
  if (!formDefinition || !formDefinition.field_groups) {
    return null;
  }

  const schemas = {};

  formDefinition.field_groups.forEach((fieldGroup) => {
    fieldGroup.fields.forEach((field) => {
      const fieldSchema = generateFieldSchema(field);
      schemas[field.field_id] = fieldSchema;
    });
  });

  return z.object(schemas);
}

export function generateFieldSchema(field) {
  let schema;

  // Start with base type
  switch (field.field_type) {
    case 'TextInput':
    case 'TextArea':
      schema = z.string();
      break;
    case 'NumberInput':
      schema = z.number();
      break;
    case 'EmailInput':
      schema = z.string().email('Invalid email address');
      break;
    case 'Select':
    case 'RadioGroup':
      schema = z.string();
      break;
    case 'Checkbox':
      schema = z.boolean();
      break;
    case 'DateInput':
      schema = z.string(); // or z.date() depending on requirements
      break;
    default:
      schema = z.string();
  }

  // Apply validations from ontology
  if (field.validations && field.validations.length > 0) {
    field.validations.forEach((validation) => {
      schema = applyValidation(schema, validation, field.field_type);
    });
  }

  // Handle required
  if (!field.required) {
    schema = schema.optional();
  }

  return schema;
}

function applyValidation(schema, validation, fieldType) {
  const { type, value, message } = validation;

  switch (type) {
    case 'minLength':
      if (fieldType === 'NumberInput') {
        schema = schema.gte(parseInt(value), message || `Must be at least ${value}`);
      } else {
        schema = schema.min(parseInt(value), message || `Must be at least ${value} characters`);
      }
      break;

    case 'maxLength':
      if (fieldType === 'NumberInput') {
        schema = schema.lte(parseInt(value), message || `Must be at most ${value}`);
      } else {
        schema = schema.max(parseInt(value), message || `Must be at most ${value} characters`);
      }
      break;

    case 'pattern':
      try {
        const regex = new RegExp(value);
        schema = schema.regex(regex, message || 'Invalid format');
      } catch (e) {
        console.error('Invalid regex pattern:', value, e);
      }
      break;

    case 'email':
      schema = schema.email(message || 'Invalid email address');
      break;

    case 'minValue':
      schema = schema.gte(parseFloat(value), message || `Must be at least ${value}`);
      break;

    case 'maxValue':
      schema = schema.lte(parseFloat(value), message || `Must be at most ${value}`);
      break;

    case 'url':
      schema = schema.url(message || 'Invalid URL');
      break;

    case 'uuid':
      schema = schema.uuid(message || 'Invalid UUID');
      break;

    default:
      console.warn('Unknown validation type:', type);
  }

  return schema;
}

/**
 * Apply transformers to input value before validation
 * Transformers map spoken/input values to normalized values
 */
export function applyTransformers(value, transformers) {
  if (!transformers || transformers.length === 0) {
    return value;
  }

  // Sort by order
  const sortedTransformers = [...transformers].sort((a, b) => a.order - b.order);

  let transformedValue = value;

  for (const transformer of sortedTransformers) {
    if (transformer.type === 'map') {
      const input = transformer.case_insensitive
        ? transformedValue?.toString().toLowerCase()
        : transformedValue?.toString();

      const pattern = transformer.case_insensitive
        ? transformer.input_pattern.toLowerCase()
        : transformer.input_pattern;

      if (input === pattern) {
        transformedValue = transformer.output_value;
        break; // Found a match, stop processing
      }
    } else if (transformer.type === 'regex') {
      try {
        const regex = new RegExp(transformer.input_pattern, transformer.case_insensitive ? 'i' : '');
        if (regex.test(transformedValue)) {
          transformedValue = transformedValue.replace(regex, transformer.output_value);
        }
      } catch (e) {
        console.error('Invalid transformer regex:', transformer.input_pattern, e);
      }
    } else if (transformer.type === 'normalize') {
      // Normalization transformations (trim, lowercase, etc.)
      if (transformer.input_pattern === 'trim') {
        transformedValue = transformedValue?.toString().trim();
      } else if (transformer.input_pattern === 'lowercase') {
        transformedValue = transformedValue?.toString().toLowerCase();
      } else if (transformer.input_pattern === 'uppercase') {
        transformedValue = transformedValue?.toString().toUpperCase();
      }
    }
  }

  return transformedValue;
}

/**
 * Validate a single field value
 */
export function validateField(field, value) {
  const schema = generateFieldSchema(field);

  try {
    schema.parse(value);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error.errors[0]?.message || 'Validation failed'
    };
  }
}

/**
 * Validate entire form
 */
export function validateForm(formDefinition, formData) {
  const schema = generateSchemaFromForm(formDefinition);

  if (!schema) {
    return { success: false, errors: { _form: 'Invalid form definition' } };
  }

  try {
    schema.parse(formData);
    return { success: true, errors: null };
  } catch (error) {
    const errors = {};
    error.errors.forEach((err) => {
      const field = err.path[0];
      errors[field] = err.message;
    });
    return { success: false, errors };
  }
}
