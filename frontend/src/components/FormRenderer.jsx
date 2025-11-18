/**
 * FormRenderer Component
 *
 * Dynamically renders forms based on ontology definitions
 * with Zod validation and value transformers
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, TextInput, Label, Textarea, Select, Checkbox, Badge, Alert } from 'flowbite-react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { generateSchemaFromForm, validateForm, validateField, applyTransformers } from '../utils/zodSchemaGenerator';

const FormRenderer = ({ formDefinition, onSubmit, initialData = {} }) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitStatus, setSubmitStatus] = useState(null);

  // Initialize form data with default values
  useEffect(() => {
    if (formDefinition && formDefinition.field_groups) {
      const defaults = {};
      formDefinition.field_groups.forEach((group) => {
        group.fields.forEach((field) => {
          if (field.default_value && !formData[field.field_id]) {
            defaults[field.field_id] = field.default_value;
          }
        });
      });
      if (Object.keys(defaults).length > 0) {
        setFormData((prev) => ({ ...prev, ...defaults }));
      }
    }
  }, [formDefinition]);

  const handleFieldChange = (field, value) => {
    // Apply transformers before storing
    const transformedValue = applyTransformers(value, field.transformers || []);

    setFormData((prev) => ({
      ...prev,
      [field.field_id]: transformedValue
    }));

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [field.field_id]: true
    }));

    // Validate field immediately
    const validation = validateField(field, transformedValue);
    if (validation.success) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field.field_id];
        return newErrors;
      });
    } else {
      setErrors((prev) => ({
        ...prev,
        [field.field_id]: validation.error
      }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({
      ...prev,
      [field.field_id]: true
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate entire form
    const validation = validateForm(formDefinition, formData);

    if (validation.success) {
      setErrors({});
      setSubmitStatus('success');
      onSubmit && onSubmit(formData);
    } else {
      setErrors(validation.errors);
      setSubmitStatus('error');

      // Mark all fields as touched to show errors
      const allTouched = {};
      formDefinition.field_groups.forEach((group) => {
        group.fields.forEach((field) => {
          allTouched[field.field_id] = true;
        });
      });
      setTouched(allTouched);
    }
  };

  const renderField = (field) => {
    const value = formData[field.field_id] || '';
    const error = touched[field.field_id] ? errors[field.field_id] : null;
    const hasError = Boolean(error);
    const isValid = touched[field.field_id] && !hasError && value;

    const fieldClasses = `${hasError ? 'border-red-500' : ''} ${isValid ? 'border-green-500' : ''}`;

    switch (field.field_type) {
      case 'TextInput':
        return (
          <div key={field.field_id} className={field.ui_hint || ''}>
            <div className="mb-2">
              <Label htmlFor={field.field_id} value={field.field_label} />
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </div>
            <TextInput
              id={field.field_id}
              name={field.field_id}
              type="text"
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              onBlur={() => handleBlur(field)}
              className={fieldClasses}
              color={hasError ? 'failure' : isValid ? 'success' : 'gray'}
            />
            {field.help_text && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{field.help_text}</p>
            )}
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500 flex items-center gap-1">
                <XCircle size={14} />
                {error}
              </p>
            )}
            {isValid && (
              <p className="mt-1 text-sm text-green-600 dark:text-green-500 flex items-center gap-1">
                <CheckCircle2 size={14} />
                Looks good!
              </p>
            )}
          </div>
        );

      case 'TextArea':
        return (
          <div key={field.field_id} className={field.ui_hint || ''}>
            <div className="mb-2">
              <Label htmlFor={field.field_id} value={field.field_label} />
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </div>
            <Textarea
              id={field.field_id}
              name={field.field_id}
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              onBlur={() => handleBlur(field)}
              rows={4}
              className={fieldClasses}
            />
            {field.help_text && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{field.help_text}</p>
            )}
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>
            )}
          </div>
        );

      case 'NumberInput':
        return (
          <div key={field.field_id} className={field.ui_hint || ''}>
            <div className="mb-2">
              <Label htmlFor={field.field_id} value={field.field_label} />
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </div>
            <TextInput
              id={field.field_id}
              name={field.field_id}
              type="number"
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleFieldChange(field, parseFloat(e.target.value))}
              onBlur={() => handleBlur(field)}
              className={fieldClasses}
            />
            {field.help_text && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{field.help_text}</p>
            )}
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>
            )}
          </div>
        );

      case 'EmailInput':
        return (
          <div key={field.field_id} className={field.ui_hint || ''}>
            <div className="mb-2">
              <Label htmlFor={field.field_id} value={field.field_label} />
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </div>
            <TextInput
              id={field.field_id}
              name={field.field_id}
              type="email"
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              onBlur={() => handleBlur(field)}
              className={fieldClasses}
              color={hasError ? 'failure' : isValid ? 'success' : 'gray'}
            />
            {field.help_text && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{field.help_text}</p>
            )}
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>
            )}
            {isValid && (
              <p className="mt-1 text-sm text-green-600 dark:text-green-500 flex items-center gap-1">
                <CheckCircle2 size={14} />
                Valid email address
              </p>
            )}
          </div>
        );

      case 'Checkbox':
        return (
          <div key={field.field_id} className={`flex items-center gap-2 ${field.ui_hint || ''}`}>
            <Checkbox
              id={field.field_id}
              name={field.field_id}
              checked={value || false}
              onChange={(e) => handleFieldChange(field, e.target.checked)}
            />
            <Label htmlFor={field.field_id}>
              {field.field_label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.help_text && (
              <p className="text-sm text-gray-500 dark:text-gray-400">({field.help_text})</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.field_id} className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded">
            <p className="text-sm">Unsupported field type: {field.field_type}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{field.field_label}</p>
          </div>
        );
    }
  };

  const renderFieldGroup = (group) => {
    return (
      <Card key={group.group_id} className="mb-4">
        <h3 className="text-lg font-semibold mb-4">{group.group_title}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {group.fields.map((field) => renderField(field))}
        </div>
      </Card>
    );
  };

  if (!formDefinition) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formDefinition.form_description && (
        <Alert color="info">
          <p>{formDefinition.form_description}</p>
        </Alert>
      )}

      {formDefinition.field_groups.map((group) => renderFieldGroup(group))}

      {submitStatus === 'error' && (
        <Alert color="failure">
          <p className="font-semibold">Please fix the errors above before submitting</p>
        </Alert>
      )}

      {submitStatus === 'success' && formDefinition.success_message && (
        <Alert color="success">
          <p>{formDefinition.success_message}</p>
        </Alert>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <Button type="submit" color="blue">
          Submit
        </Button>
      </div>
    </form>
  );
};

export default FormRenderer;
