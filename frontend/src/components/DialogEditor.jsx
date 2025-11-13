/**
 * Dialog Editor Component
 *
 * Visual editor for dialog questions with:
 * - Flow visualization (reused from OperatorPanel)
 * - Question editing with TTS variants
 * - SKOS-based spelling/speaking configuration
 * - Live preview of changes
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, TextInput, Textarea, Label, Select, Badge, Alert, ToggleSwitch } from 'flowbite-react';
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Edit,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Volume2,
  Mic,
  FileText,
  CheckCircle2,
  ArrowRight,
  List,
  LayoutGrid,
  Type,
  Hash,
  Mail,
  Phone,
  Calendar,
  Clock,
  ToggleLeft,
  CheckSquare,
  Circle,
  ChevronDown,
  List as ListIcon,
  AlignLeft,
  Link,
  Image,
  File,
  MapPin,
  DollarSign,
  Percent,
  GitBranch,
  Layers,
  Move,
  Copy,
  Settings
} from 'lucide-react';
import WorkflowEditor from './WorkflowEditor';

const API_BASE_URL = '/api/config';

const DialogEditor = () => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [editedQuestion, setEditedQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'forms', or 'workflow'

  // TTS Variants
  const [ttsVariants, setTtsVariants] = useState(['', '', '', '']);

  // Form Builder - Dropped Fields
  const [droppedFields, setDroppedFields] = useState([]);
  const [draggedField, setDraggedField] = useState(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/questions`);
      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (err) {
      setError('Failed to load questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuestion = (question) => {
    setSelectedQuestion(question);
    setEditedQuestion({...question});

    // Load TTS variants if available
    if (question.tts && question.tts.variants) {
      setTtsVariants(question.tts.variants);
    } else {
      // Generate default variants from the main TTS text
      const mainText = question.tts?.text || question.question_text;
      setTtsVariants([
        mainText,
        generateVariant(mainText, 1),
        generateVariant(mainText, 2),
        generateVariant(mainText, 3)
      ]);
    }
  };

  const generateVariant = (text, variantIndex) => {
    // Simple rephrase logic - in production, use AI or predefined templates
    const variants = {
      1: text.replace(/What is/g, 'Could you tell me').replace(/\?$/, ', please?'),
      2: text.replace(/What is/g, 'Please provide').replace(/\?$/, '.'),
      3: text.replace(/What is/g, 'I need').replace(/\?$/, '.')
    };
    return variants[variantIndex] || text;
  };

  const handleSaveQuestion = async () => {
    if (!editedQuestion) return;

    try {
      setLoading(true);

      // Include TTS variants in the save
      const questionToSave = {
        ...editedQuestion,
        tts: {
          ...editedQuestion.tts,
          variants: ttsVariants
        }
      };

      const response = await fetch(`${API_BASE_URL}/question/${editedQuestion.question_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionToSave)
      });

      if (!response.ok) throw new Error('Failed to save question');

      setSuccess('Question saved successfully!');
      await loadQuestions();
      setSelectedQuestion(null);
      setEditedQuestion(null);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedQuestion(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTTSChange = (field, value) => {
    setEditedQuestion(prev => ({
      ...prev,
      tts: {
        ...prev.tts,
        [field]: value
      }
    }));
  };

  const handleVariantChange = (index, value) => {
    const newVariants = [...ttsVariants];
    newVariants[index] = value;
    setTtsVariants(newVariants);
  };

  const deleteVariant = (index) => {
    const newVariants = [...ttsVariants];
    newVariants[index] = '';
    setTtsVariants(newVariants);
  };

  const duplicateVariant = (index) => {
    // Find next empty slot
    const emptyIndex = ttsVariants.findIndex((v, i) => i > index && !v);
    if (emptyIndex !== -1) {
      const newVariants = [...ttsVariants];
      newVariants[emptyIndex] = ttsVariants[index];
      setTtsVariants(newVariants);
      setSuccess(`Variant ${index + 1} duplicated to Variant ${emptyIndex + 1}`);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const generateTTSVariants = async () => {
    if (!editedQuestion) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/generate-tts-variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_text: editedQuestion.question_text,
          question_id: editedQuestion.question_id,
          slot_name: editedQuestion.slot_name
        }),
      });

      const data = await response.json();

      if (data.success && data.variants) {
        const newVariants = [
          data.variants.variant1 || data.variants.text,
          data.variants.variant2 || data.variants.text,
          data.variants.variant3 || data.variants.text,
          data.variants.variant4 || data.variants.text
        ];
        setTtsVariants(newVariants);
        setSuccess('TTS variants generated successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error('Failed to generate variants');
      }
    } catch (err) {
      setError('Failed to generate TTS variants: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderFlowVisualization = () => {
    // Group questions by section
    const groupedQuestions = questions.reduce((acc, question) => {
      const sectionTitle = question.section?.section_title || 'Unsectioned Questions';
      if (!acc[sectionTitle]) {
        acc[sectionTitle] = {
          section: question.section,
          questions: []
        };
      }
      acc[sectionTitle].questions.push(question);
      return acc;
    }, {});

    // Sort sections by order
    const sortedSections = Object.entries(groupedQuestions).sort((a, b) => {
      const orderA = a[1].section?.section_order || 999;
      const orderB = b[1].section?.section_order || 999;
      return orderA - orderB;
    });

    let questionIndex = 0;

    return (
      <div className="space-y-6">
        {sortedSections.map(([sectionTitle, { section, questions: sectionQuestions }]) => (
          <div key={sectionTitle} className="space-y-2">
            {/* Section Heading */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-3 rounded-lg shadow-md">
              <h4 className="text-lg font-bold">{sectionTitle}</h4>
              {section?.section_description && (
                <p className="text-sm text-blue-100 mt-1">{section.section_description}</p>
              )}
            </div>

            {/* Questions in this section */}
            {sectionQuestions.map((question) => {
              const currentIndex = questionIndex++;
              const isSelected = selectedQuestion?.question_id === question.question_id;
              const isEditing = editedQuestion?.question_id === question.question_id;

              return (
                <div
                  key={question.question_id}
                  onClick={() => handleSelectQuestion(question)}
                  className={`ml-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    isEditing
                      ? 'border-blue-500 bg-blue-50'
                      : isSelected
                      ? 'border-blue-300 bg-blue-25'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {currentIndex + 1}. {question.question_text}
                        </span>
                        {isEditing && (
                          <Badge color="blue" size="xs">Editing</Badge>
                        )}
                        {question.required && (
                          <Badge color="failure" size="xs">Required</Badge>
                        )}
                        {question.spelling_required && (
                          <Badge color="purple" size="xs">Spelling</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                        <span className="font-medium">Slot:</span> {question.slot_name}
                        {question.tts && (
                          <Badge color="info" size="xs">
                            <Volume2 className="w-3 h-3 inline mr-1" />
                            TTS
                          </Badge>
                        )}
                        {question.faqs && question.faqs.length > 0 && (
                          <Badge color="gray" size="xs">
                            {question.faqs.length} FAQs
                          </Badge>
                        )}
                      </div>
                      {question.confidence_threshold && (
                        <Badge
                          color={question.confidence_threshold < 0.7 ? 'failure' : question.confidence_threshold < 0.85 ? 'warning' : 'success'}
                          size="xs"
                          className="mt-2"
                        >
                          Confidence: {(question.confidence_threshold * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderFormsEditor = () => {
    const formFields = [
      { id: 'text', label: 'Text Input', icon: Type, iconName: 'Type', color: 'bg-blue-500', desc: 'Single line text' },
      { id: 'textarea', label: 'Text Area', icon: AlignLeft, iconName: 'AlignLeft', color: 'bg-blue-600', desc: 'Multi-line text' },
      { id: 'number', label: 'Number', icon: Hash, iconName: 'Hash', color: 'bg-green-500', desc: 'Numeric input' },
      { id: 'email', label: 'Email', icon: Mail, iconName: 'Mail', color: 'bg-purple-500', desc: 'Email address' },
      { id: 'phone', label: 'Phone', icon: Phone, iconName: 'Phone', color: 'bg-purple-600', desc: 'Phone number' },
      { id: 'date', label: 'Date', icon: Calendar, iconName: 'Calendar', color: 'bg-indigo-500', desc: 'Date picker' },
      { id: 'time', label: 'Time', icon: Clock, iconName: 'Clock', color: 'bg-indigo-600', desc: 'Time picker' },
      { id: 'toggle', label: 'Toggle', icon: ToggleLeft, iconName: 'ToggleLeft', color: 'bg-amber-500', desc: 'On/off switch' },
      { id: 'checkbox', label: 'Checkbox', icon: CheckSquare, iconName: 'CheckSquare', color: 'bg-amber-600', desc: 'Multiple choice' },
      { id: 'radio', label: 'Radio', icon: Circle, iconName: 'Circle', color: 'bg-orange-500', desc: 'Single choice' },
      { id: 'select', label: 'Dropdown', icon: ChevronDown, iconName: 'ChevronDown', color: 'bg-cyan-500', desc: 'Select menu' },
      { id: 'multiselect', label: 'Multi-Select', icon: ListIcon, iconName: 'ListIcon', color: 'bg-cyan-600', desc: 'Multiple options' },
      { id: 'url', label: 'URL', icon: Link, iconName: 'Link', color: 'bg-rose-500', desc: 'Web address' },
      { id: 'file', label: 'File Upload', icon: File, iconName: 'File', color: 'bg-rose-600', desc: 'File picker' },
      { id: 'image', label: 'Image', icon: Image, iconName: 'Image', color: 'bg-pink-500', desc: 'Image upload' },
      { id: 'address', label: 'Address', icon: MapPin, iconName: 'MapPin', color: 'bg-teal-500', desc: 'Location input' },
      { id: 'currency', label: 'Currency', icon: DollarSign, iconName: 'DollarSign', color: 'bg-emerald-500', desc: 'Money amount' },
      { id: 'percentage', label: 'Percentage', icon: Percent, iconName: 'Percent', color: 'bg-emerald-600', desc: 'Percent value' },
    ];

    // Icon map for rendering dropped fields
    const iconMap = {
      Type, AlignLeft, Hash, Mail, Phone, Calendar, Clock, ToggleLeft,
      CheckSquare, Circle, ChevronDown, ListIcon, Link, File, Image,
      MapPin, DollarSign, Percent
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <LayoutGrid className="w-8 h-8" />
                Drag & Drop Form Builder
              </h3>
              <p className="text-blue-100">
                Create dynamic forms with field groups, validations, and conditional logic
              </p>
            </div>
            <Button className="bg-white text-blue-600 hover:bg-blue-50">
              <Plus className="w-4 h-4 mr-2" />
              Create New Form
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Field Palette */}
          <div className="col-span-3">
            <Card className="sticky top-4">
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
                <Layers className="w-5 h-5 text-blue-600" />
                Field Palette
              </h4>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {formFields.map((field) => {
                  const Icon = field.icon;
                  return (
                    <div
                      key={field.id}
                      className="group relative p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-move bg-white"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('field', JSON.stringify(field));
                        e.dataTransfer.effectAllowed = 'copy';
                        setDraggedField(field);
                      }}
                      onDragEnd={() => setDraggedField(null)}
                      title={`${field.label} - ${field.desc}`}
                    >
                      {/* Icon Only */}
                      <div className="flex items-center justify-center">
                        <div className={`${field.color} p-3 rounded-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      {/* Tooltip on Hover */}
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        <div className="font-semibold">{field.label}</div>
                        <div className="text-gray-300 text-xs mt-0.5">{field.desc}</div>
                        {/* Arrow */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Center Panel - Form Canvas (Node-RED Style) */}
          <div className="col-span-6">
            <div className="rounded-lg overflow-hidden shadow-lg border border-gray-700">
              {/* Header with dark background */}
              <div className="bg-[#2d2d2d] px-4 py-3 flex items-center justify-between border-b border-gray-700">
                <h4 className="font-bold text-lg text-gray-200">Form Canvas</h4>
                <div className="flex gap-2">
                  <Button size="sm" color="dark">
                    <Copy className="w-4 h-4 mr-1" />
                    Duplicate
                  </Button>
                  <Button size="sm" color="dark">
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </Button>
                </div>
              </div>

              {/* Canvas Area with Grid Pattern */}
              <div
                className="min-h-[600px] p-6 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(to bottom, #1a1a1a 0%, #2d2d2d 100%)',
                  backgroundImage: `
                    radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fieldData = e.dataTransfer.getData('field');
                  if (fieldData) {
                    const field = JSON.parse(fieldData);
                    const newField = {
                      ...field,
                      id: `${field.id}-${Date.now()}`,
                      label: field.label,
                      required: false
                    };
                    setDroppedFields([...droppedFields, newField]);
                  }
                }}
              >
                {droppedFields.length === 0 ? (
                  <div className="text-center py-20">
                    <LayoutGrid className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg font-medium mb-2">Drop fields here</p>
                    <p className="text-gray-500 text-sm">Drag fields from the palette to build your form</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {droppedFields.map((field, index) => {
                      const Icon = iconMap[field.iconName] || Type;
                      return (
                        <div
                          key={field.id}
                          className="flex items-center gap-3 p-4 rounded-md bg-[#3a3a3a] border border-[#555] shadow-lg hover:border-[#777] transition-colors"
                        >
                          <div className={`${field.color} p-2 rounded-lg flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-100">{field.label}</div>
                            <div className="text-xs text-gray-400">{field.id}</div>
                          </div>
                          <button
                            onClick={() => {
                              setDroppedFields(droppedFields.filter((_, i) => i !== index));
                            }}
                            className="p-2 hover:bg-red-900/30 rounded transition-colors"
                            title="Remove field"
                          >
                            <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Properties & Features */}
          <div className="col-span-3">
            <div className="space-y-4 sticky top-4">
              {/* Workflow Editor */}
              <Card className="group relative bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-purple-900">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                  Workflow Editor
                </h4>
                <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Condition
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Define conditional logic and field dependencies
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </Card>

              {/* Field Groups */}
              <Card className="group relative bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-blue-900">
                  <Layers className="w-5 h-5 text-blue-600" />
                  Field Groups
                </h4>
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-3 h-3 mr-1" />
                  New Group
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Create repeatable groups (e.g., additional drivers)
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </Card>

              {/* Validation Rules */}
              <Card className="group relative bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-green-900">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Validation Rules
                </h4>
                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Rule
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  SHACL-based validation for form fields
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </Card>

              {/* Hierarchical Selects */}
              <Card className="group relative bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-amber-900">
                  <GitBranch className="w-5 h-5 text-amber-600" />
                  Hierarchical Selects
                </h4>
                <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700">
                  <Plus className="w-3 h-3 mr-1" />
                  Configure
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Multi-level cascading dropdowns
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionEditor = () => {
    if (!editedQuestion) {
      return (
        <div className="text-center text-gray-500 py-12">
          Select a question from the flow to edit
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Custom Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <List className="w-4 h-4" />
              Question Details
            </button>
            <button
              onClick={() => setActiveTab('forms')}
              className={`py-2 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'forms'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Forms Editor
            </button>
            <button
              onClick={() => setActiveTab('workflow')}
              className={`py-2 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'workflow'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Workflow Editor
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-6 pt-4">
            {/* Basic Question Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="question-text">Question Text</Label>
                <Textarea
                  id="question-text"
                  value={editedQuestion.question_text}
                  onChange={(e) => handleFieldChange('question_text', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="question-id">Question ID</Label>
                  <TextInput
                    id="question-id"
                    value={editedQuestion.question_id}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label htmlFor="slot-name">Slot Name</Label>
                  <TextInput
                    id="slot-name"
                    value={editedQuestion.slot_name}
                    onChange={(e) => handleFieldChange('slot_name', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={editedQuestion.required || false}
                    onChange={(checked) => handleFieldChange('required', checked)}
                    label="Required"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={editedQuestion.spelling_required || false}
                    onChange={(checked) => handleFieldChange('spelling_required', checked)}
                    label="Spelling Required (Uses Phonetic Alphabet)"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="confidence-threshold">Confidence Threshold</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    id="confidence-threshold"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={editedQuestion.confidence_threshold || 0.85}
                    onChange={(e) => handleFieldChange('confidence_threshold', parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <Badge color="info">{((editedQuestion.confidence_threshold || 0.85) * 100).toFixed(0)}%</Badge>
                </div>
              </div>
            </div>

            {/* TTS Configuration */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                Text-to-Speech Configuration
              </h3>

              <div>
                <Label htmlFor="tts-text">Main TTS Text</Label>
                <Textarea
                  id="tts-text"
                  value={editedQuestion.tts?.text || ''}
                  onChange={(e) => handleTTSChange('text', e.target.value)}
                  rows={2}
                  placeholder="Text to be spoken..."
                />
              </div>

              {/* TTS Variants */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>TTS Variants (for Rephrase)</Label>
                    <p className="text-xs text-gray-600">
                      When user clicks "Rephrase Question", the system will cycle through these variants
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    onClick={generateTTSVariants}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Generate with AI
                  </Button>
                </div>
                {ttsVariants.map((variant, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`variant-${index}`} className="text-sm font-medium">
                        Variant {index + 1} {index === 0 && <Badge color="blue" className="ml-2">Main</Badge>}
                      </Label>
                      <div className="flex items-center gap-2">
                        {variant && (
                          <>
                            <button
                              onClick={() => duplicateVariant(index)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Duplicate this variant"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteVariant(index)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete this variant"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <Textarea
                      id={`variant-${index}`}
                      value={variant}
                      onChange={(e) => handleVariantChange(index, e.target.value)}
                      rows={2}
                      placeholder={`Variant ${index + 1}...`}
                      className="resize-none"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tts-voice">Voice</Label>
                  <Select
                    id="tts-voice"
                    value={editedQuestion.tts?.voice || 'en-GB-Neural2-A'}
                    onChange={(e) => handleTTSChange('voice', e.target.value)}
                  >
                    <option value="en-GB-Neural2-A">UK English Female</option>
                    <option value="en-GB-Neural2-B">UK English Male</option>
                    <option value="en-GB-Neural2-C">UK English Clear</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tts-rate">Rate</Label>
                  <TextInput
                    id="tts-rate"
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="2.0"
                    value={editedQuestion.tts?.rate || 1.0}
                    onChange={(e) => handleTTSChange('rate', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="tts-pitch">Pitch</Label>
                  <TextInput
                    id="tts-pitch"
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="2.0"
                    value={editedQuestion.tts?.pitch || 1.0}
                    onChange={(e) => handleTTSChange('pitch', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'forms' && (
          <div className="pt-4">
            {renderFormsEditor()}
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="pt-4" style={{ height: '800px' }}>
            <WorkflowEditor droppedFields={droppedFields} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            color="success"
            onClick={handleSaveQuestion}
            disabled={loading}
            className="flex-1"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button
            color="light"
            onClick={() => {
              setEditedQuestion(null);
              setSelectedQuestion(null);
            }}
          >
            Cancel
          </Button>
          <Button
            color="light"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="border-t pt-6">
            <h4 className="font-semibold text-gray-900 mb-3">Preview</h4>
            <Card>
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-medium text-gray-900">{editedQuestion.question_text}</p>
                  <p className="text-sm text-gray-600 mt-1">Slot: {editedQuestion.slot_name}</p>
                </div>
                {editedQuestion.tts && (
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm font-semibold text-blue-900 mb-1">TTS will say:</p>
                    <p className="text-sm text-gray-700">"{editedQuestion.tts.text}"</p>
                  </div>
                )}
                {editedQuestion.spelling_required && (
                  <Badge color="purple">
                    <Mic className="w-3 h-3 inline mr-1" />
                    User can spell using phonetic alphabet
                  </Badge>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dialog Editor</h1>
          <p className="text-gray-600 mt-1">Visual editor for dialog questions and TTS configuration</p>
        </div>
        <div className="flex gap-2">
          <Button color="light" onClick={loadQuestions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button color="blue">
            <Plus className="w-4 h-4 mr-2" />
            New Question
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {success && (
        <Alert color="success" onDismiss={() => setSuccess(null)}>
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{success}</span>
          </div>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Questions</p>
              <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Required Questions</p>
              <p className="text-2xl font-bold text-red-600">
                {questions.filter(q => q.required).length}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-red-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With TTS</p>
              <p className="text-2xl font-bold text-purple-600">
                {questions.filter(q => q.tts).length}
              </p>
            </div>
            <Volume2 className="w-8 h-8 text-purple-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Spelling Required</p>
              <p className="text-2xl font-bold text-green-600">
                {questions.filter(q => q.spelling_required).length}
              </p>
            </div>
            <Mic className="w-8 h-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Main Editor Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flow Visualization */}
        <Card>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Dialog Flow</h3>
          {loading ? (
            <div className="text-center text-gray-500 py-12">Loading...</div>
          ) : (
            <div className="max-h-[700px] overflow-y-auto">
              {renderFlowVisualization()}
            </div>
          )}
        </Card>

        {/* Question Editor */}
        <Card>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Question Editor</h3>
          <div className="max-h-[700px] overflow-y-auto pr-2">
            {renderQuestionEditor()}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DialogEditor;
