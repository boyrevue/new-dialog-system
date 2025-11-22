/**
 * ASR Grammar Palette Component
 *
 * Drag-and-drop pre-built ASR grammar templates
 * Including: First Name, Last Name, Date of Birth, UK Postcode, etc.
 */

import React, { useState, useEffect } from 'react';
import { Card, Badge, Alert } from 'flowbite-react';
import {
  User, Calendar, MapPin, CreditCard, Car, Mail, Phone, CheckCircle,
  Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8002';

// Icon mapping for ASR templates
const iconMap = {
  '👤': User,
  '📅': Calendar,
  '🇬🇧': MapPin,
  '🪪': CreditCard,
  '🚗': Car,
  '📧': Mail,
  '📱': Phone,
  '✓': CheckCircle,
};

const ASRGrammarPalette = ({ onDrop }) => {
  const [templates, setTemplates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({
    name_fields: true,
    date_time: true,
    uk_specific: true,
    contact: true,
    boolean: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/asr-templates`);
      const data = await response.json();
      setTemplates(data.templates);
      setLoading(false);
    } catch (error) {
      console.error('Error loading ASR templates:', error);
      setLoading(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleDragStart = (e, template) => {
    e.dataTransfer.setData('asrTemplate', JSON.stringify(template));
    console.log('🎤 Dragging ASR template:', template.label);
  };

  const getCategoryTitle = (category) => {
    const titles = {
      name_fields: '👤 Name Fields',
      date_time: '📅 Date/Time Fields',
      uk_specific: '🇬🇧 UK-Specific Fields',
      contact: '📧 Contact Fields',
      boolean: '✓ Boolean Fields'
    };
    return titles[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      name_fields: 'blue',
      date_time: 'purple',
      uk_specific: 'red',
      contact: 'green',
      boolean: 'indigo'
    };
    return colors[category] || 'gray';
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading ASR templates...</span>
        </div>
      </Card>
    );
  }

  if (!templates) {
    return (
      <Alert color="failure">
        Failed to load ASR templates. Make sure the backend is running.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h3 className="text-xl font-bold text-gray-900">ASR Grammar Templates</h3>
      </div>

      <Alert color="info" className="mb-4">
        <p className="text-sm">
          <strong>Drag & Drop</strong> these pre-built ASR grammar templates onto your form.
          Each template includes speech recognition patterns and validators.
        </p>
      </Alert>

      {/* Template Categories */}
      {Object.entries(templates).map(([category, categoryTemplates]) => (
        <Card key={category} className="overflow-hidden">
          {/* Category Header */}
          <div
            className="flex items-center justify-between cursor-pointer p-2 hover:bg-gray-50 rounded-lg"
            onClick={() => toggleCategory(category)}
          >
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-800">{getCategoryTitle(category)}</h4>
              <Badge color={getCategoryColor(category)}>
                {categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {expandedCategories[category] ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {/* Template List */}
          {expandedCategories[category] && (
            <div className="mt-3 space-y-2">
              {categoryTemplates.map((template) => {
                const Icon = iconMap[template.icon] || User;

                return (
                  <div
                    key={template.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, template)}
                    className="flex items-center gap-3 p-3 bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg cursor-grab active:cursor-grabbing transition-all group"
                  >
                    {/* Icon */}
                    <div className={`${template.color} p-2 rounded-lg flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{template.label}</div>
                      <div className="text-xs text-gray-600 truncate">{template.description}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge color="purple" size="xs">{template.asr.mode}</Badge>
                        {template.asr.phonetic && (
                          <Badge color="blue" size="xs">Phonetic</Badge>
                        )}
                        {template.validation?.validators && (
                          <Badge color="green" size="xs">
                            {template.validation.validators.length} validator{template.validation.validators.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Drag Indicator */}
                    <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}

      {/* Usage Instructions */}
      <Card>
        <h4 className="font-semibold text-gray-800 mb-2">📖 How to Use</h4>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Drag an ASR template from above</li>
          <li>Drop it onto the Form Canvas</li>
          <li>The field will include pre-configured:
            <ul className="ml-6 mt-1 list-disc list-inside text-xs">
              <li>ASR grammar (JSGF format)</li>
              <li>Input mode (phonetic/conversational/digit-by-digit)</li>
              <li>Validators (isUKPostcode, isEmail, etc.)</li>
              <li>UI hints (placeholder, keyboard type)</li>
            </ul>
          </li>
          <li>Customize the field settings if needed</li>
        </ol>
      </Card>

      {/* Template Details */}
      <Card>
        <h4 className="font-semibold text-gray-800 mb-3">🔍 Template Details</h4>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2 font-semibold text-gray-700 border-b pb-2">
            <div>Mode</div>
            <div>Description</div>
            <div>Example</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-gray-600">
            <div>Letter-by-letter</div>
            <div>Phonetic alphabet</div>
            <div>"Alpha-Bravo-Charlie"</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-gray-600">
            <div>Conversational</div>
            <div>Natural speech</div>
            <div>"January 15th, 1990"</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-gray-600">
            <div>Digit-by-digit</div>
            <div>Number spelling</div>
            <div>"1-5-0-1-1-9-9-0"</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-gray-600">
            <div>Segmented</div>
            <div>Multi-part format</div>
            <div>"MORGA-657054-SM9IJ"</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ASRGrammarPalette;
