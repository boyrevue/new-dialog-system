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
import { Card, Button, TextInput, Textarea, Label, Select, Badge, Alert, ToggleSwitch, Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
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
  ChevronRight,
  List as ListIcon,
  AlignLeft,
  Link as LinkIcon,
  Image,
  File,
  MapPin,
  DollarSign,
  Percent,
  GitBranch,
  GitMerge,
  Layers,
  Move,
  Settings,
  Info,
  Sparkles,
  Code,
  Copy,
  TestTube2,
  GripVertical,
  FolderPlus,
  Tag,
  Loader2,
  Edit3,
  Pencil
} from 'lucide-react';
import WorkflowEditor from './WorkflowEditor';
import ASRGrammarPalette from './ASRGrammarPalette';
import FormASRTester from './FormASRTester';

const API_BASE_URL = '/api/config';

// Voice ASR Tab - Unified view combining Forms, Workflow, and ASR Testing
const VoiceASRTab = ({ droppedFields, renderFormsEditor }) => {
  const [voiceSubTab, setVoiceSubTab] = useState('forms');

  return (
    <div className="pt-4 space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setVoiceSubTab('forms')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
            voiceSubTab === 'forms'
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Form Builder
        </button>
        <button
          onClick={() => setVoiceSubTab('workflow')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
            voiceSubTab === 'workflow'
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          Workflow
        </button>
        <button
          onClick={() => setVoiceSubTab('asr')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
            voiceSubTab === 'asr'
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Mic className="w-4 h-4" />
          ASR Testing
        </button>
      </div>

      {/* Sub-tab content */}
      {voiceSubTab === 'forms' && (
        <div>
          {renderFormsEditor()}
        </div>
      )}

      {voiceSubTab === 'workflow' && (
        <div style={{ height: '800px' }}>
          <WorkflowEditor droppedFields={droppedFields} />
        </div>
      )}

      {voiceSubTab === 'asr' && (
        <div className="-mx-6 -mb-6 overflow-y-auto" style={{ height: 'calc(100vh - 280px)' }}>
          <FormASRTester />
        </div>
      )}
    </div>
  );
};

const DialogEditor = () => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [editedQuestion, setEditedQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'voice-asr'

  // TTS Variants
  const [ttsVariants, setTtsVariants] = useState(['', '', '', '']);

  // Form Builder - Dropped Fields
  const [droppedFields, setDroppedFields] = useState([]);
  const [draggedField, setDraggedField] = useState(null);

  // Section Management State (integrated from SectionManager)
  const [sections, setSections] = useState([]);
  const [questionsBySection, setQuestionsBySection] = useState({});
  const [draggedQuestion, setDraggedQuestion] = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editingSectionData, setEditingSectionData] = useState(null);
  const [generatedAliases, setGeneratedAliases] = useState([]);
  const [selectedAliases, setSelectedAliases] = useState({});
  const [generatingAliases, setGeneratingAliases] = useState(false);
  const [newSection, setNewSection] = useState({
    sectionId: '',
    sectionTitle: '',
    sectionDescription: '',
    sectionOrder: 1,
    sectionType: 'standard',
    semanticAliases: '',
    skosLabels: ''
  });

  // Field Settings Modal
  const [selectedFieldForSettings, setSelectedFieldForSettings] = useState(null);
  const [showFieldSettings, setShowFieldSettings] = useState(false);
  const [showFieldHelp, setShowFieldHelp] = useState(false);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  const [currentFieldType, setCurrentFieldType] = useState('text');

  // Word-to-Format Mappings for ASR
  const [wordMappings, setWordMappings] = useState([{ spokenWord: '', format: '' }]);

  // Select List Options
  const [selectOptions, setSelectOptions] = useState([]);
  const [cascadingConfig, setCascadingConfig] = useState({
    isDependent: false,
    parentQuestionId: ""
  });

  // Configuration Editor State
  const [configTab, setConfigTab] = useState('json'); // 'json' or 'ttl'
  const [jsonConfig, setJsonConfig] = useState('');

  // ASR Pattern Generation State
  const [generatedPatterns, setGeneratedPatterns] = useState([]);
  const [ttlConfig, setTtlConfig] = useState('');

  useEffect(() => {
    loadQuestions();
  }, []);

  // Debug: Log when field settings modal state changes
  useEffect(() => {
    if (showFieldSettings) {
      console.log('🔍 Field Settings Modal OPENED');
      console.log('🔍 selectedFieldForSettings:', selectedFieldForSettings);
      console.log('🔍 selectedFieldIndex:', selectedFieldIndex);
      console.log('🔍 droppedFields:', droppedFields);
    }
  }, [showFieldSettings, selectedFieldForSettings, selectedFieldIndex]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/questions`);
      const data = await response.json();
      setQuestions(data.questions || []);
      setSections(data.sections || []);
      setQuestionsBySection(data.questions_by_section || {});

      // Auto-expand all sections on first load
      if (data.sections && Object.keys(expandedSections).length === 0) {
        const expanded = {};
        data.sections.forEach(s => { expanded[s.section_id] = true; });
        setExpandedSections(expanded);
      }
    } catch (err) {
      setError('Failed to load questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuestion = async (question) => {
    setSelectedQuestion(question);
    setEditedQuestion({ ...question });

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

    // Load saved form fields if available
    try {
      const response = await fetch(`${API_BASE_URL}/question/${question.question_id}/form-fields`);
      if (response.ok) {
        const data = await response.json();
        if (data.fields && data.fields.length > 0) {
          console.log('📥 Loaded', data.fields.length, 'saved form fields for question', question.question_id);
          setDroppedFields(data.fields);
        } else {
          console.log('📭 No saved form fields found for question', question.question_id);
          setDroppedFields([]);
        }
      } else {
        console.log('⚠️ Could not load form fields, starting with empty canvas');
        setDroppedFields([]);
      }
    } catch (err) {
      console.error('Error loading form fields:', err);
      setDroppedFields([]);
    }

    // Auto-load select options from TTL ontology for context-aware editing
    try {
      const selectResponse = await fetch(`${API_BASE_URL}/question/${question.question_id}/select-options`);
      if (selectResponse.ok) {
        const selectData = await selectResponse.json();
        if (selectData.select_options && selectData.select_options.length > 0) {
          console.log('📋 Loaded', selectData.select_options.length, 'select options from TTL for question', question.question_id);
          setSelectOptions(selectData.select_options);
        } else {
          console.log('📭 No select options found in TTL for question', question.question_id);
          setSelectOptions([{ label: '', value: '', ontologyUri: '' }]);
        }
      } else {
        console.log('⚠️ Could not load select options from TTL');
        setSelectOptions([{ label: '', value: '', ontologyUri: '' }]);
      }
    } catch (err) {
      console.error('Error loading select options from TTL:', err);
      setSelectOptions([{ label: '', value: '', ontologyUri: '' }]);
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

  // Section Management Functions (integrated from SectionManager)
  const handleQuestionDragStart = (e, question) => {
    setDraggedQuestion(question);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleSectionDragOver = (e, sectionId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(sectionId);
  };

  const handleSectionDragLeave = () => {
    setDragOverSection(null);
  };

  const handleQuestionDrop = async (e, targetSectionId) => {
    e.preventDefault();
    setDragOverSection(null);

    if (!draggedQuestion) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/question/${draggedQuestion.question_id}/section`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: targetSectionId,
          update_owl: true
        })
      });

      if (!response.ok) throw new Error('Failed to update section');

      setSuccess(`Moved "${draggedQuestion.question_text}" to section. OWL relationships updated.`);
      await loadQuestions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to move question: ' + err.message);
    } finally {
      setLoading(false);
      setDraggedQuestion(null);
    }
  };

  const toggleSectionExpansion = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleCreateSection = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/section/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: newSection.sectionId,
          section_title: newSection.sectionTitle,
          section_description: newSection.sectionDescription,
          section_order: newSection.sectionOrder,
          section_type: newSection.sectionType || 'standard',
          semantic_aliases: newSection.semanticAliases.split(',').map(s => s.trim()).filter(Boolean),
          skos_labels: newSection.skosLabels.split(',').map(s => s.trim()).filter(Boolean)
        })
      });

      if (!response.ok) throw new Error('Failed to create section');

      setSuccess('Section created successfully with OWL/SKOS relationships');
      setShowNewSectionModal(false);
      setNewSection({
        sectionId: '',
        sectionTitle: '',
        sectionDescription: '',
        sectionOrder: 1,
        sectionType: 'standard',
        semanticAliases: '',
        skosLabels: ''
      });

      await loadQuestions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to create section: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSection = (section) => {
    setEditingSection(section);
    setEditingSectionData({
      section_title: section.section_title || '',
      section_description: section.section_description || '',
      section_order: section.section_order || 1,
      semantic_aliases: section.semantic_aliases || []
    });
    setGeneratedAliases([]);
    const selected = {};
    (section.semantic_aliases || []).forEach(alias => {
      selected[alias] = true;
    });
    setSelectedAliases(selected);
  };

  const handleSaveEditedSection = async () => {
    if (!editingSection || !editingSectionData) return;

    try {
      setLoading(true);
      const finalAliases = Object.keys(selectedAliases).filter(alias => selectedAliases[alias]);

      const response = await fetch(`${API_BASE_URL}/section/${editingSection.section_id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_title: editingSectionData.section_title,
          section_description: editingSectionData.section_description,
          section_order: editingSectionData.section_order,
          semantic_aliases: finalAliases
        })
      });

      if (!response.ok) throw new Error('Failed to update section');

      setSuccess('Section updated successfully with ' + finalAliases.length + ' aliases');
      setEditingSection(null);
      setEditingSectionData(null);
      setGeneratedAliases([]);
      setSelectedAliases({});
      await loadQuestions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update section: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this section? Questions will be unassigned.')) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/section/${sectionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete section');

      setSuccess('Section deleted successfully');
      await loadQuestions();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to delete section: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAliases = async () => {
    if (!editingSectionData) return;

    try {
      setGeneratingAliases(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/section/generate-aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_title: editingSectionData.section_title,
          section_description: editingSectionData.section_description
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate aliases');
      }

      const data = await response.json();
      setGeneratedAliases(data.aliases || []);
      setSuccess(`Generated ${data.count} semantic aliases using AI`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to generate aliases: ' + err.message);
    } finally {
      setGeneratingAliases(false);
    }
  };

  const toggleAlias = (alias) => {
    setSelectedAliases(prev => ({
      ...prev,
      [alias]: !prev[alias]
    }));
  };

  const handleSaveQuestion = async () => {
    if (!editedQuestion) return;

    try {
      setLoading(true);

      // Include TTS variants and form fields in the save
      const questionToSave = {
        ...editedQuestion,
        tts: {
          ...editedQuestion.tts,
          variants: ttsVariants
        },
        // Include dropped form fields
        formFields: droppedFields
      };

      console.log('💾 Saving question with data:', questionToSave);

      const response = await fetch(`${API_BASE_URL}/question/${editedQuestion.question_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionToSave)
      });

      if (!response.ok) throw new Error('Failed to save question');

      const result = await response.json();

      setSuccess('Question saved successfully!');
      setTimeout(() => setSuccess(null), 3000);

      await loadQuestions();
      setSelectedQuestion(null);
      setEditedQuestion(null);
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
    // Use sections from state (populated from API) or fall back to grouping
    const sortedSections = sections.length > 0
      ? sections.sort((a, b) => (a.section_order || 0) - (b.section_order || 0))
      : [];

    let questionIndex = 0;

    return (
      <div className="space-y-4">
        {/* New Section Button */}
        <div className="flex justify-end">
          <Button
            size="sm"
            color="blue"
            onClick={() => setShowNewSectionModal(true)}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Section
          </Button>
        </div>

        {sortedSections.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <FolderPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No sections created yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first section to organize questions</p>
          </div>
        ) : (
          sortedSections.map((section) => {
            const sectionQuestions = questionsBySection[section.section_id] || [];
            const isExpanded = expandedSections[section.section_id] !== false;
            const isDragOver = dragOverSection === section.section_id;

            return (
              <div
                key={section.section_id}
                className={`bg-white border-2 rounded-lg transition-all ${isDragOver
                  ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                  : 'border-gray-200'
                  }`}
                onDragOver={(e) => handleSectionDragOver(e, section.section_id)}
                onDragLeave={handleSectionDragLeave}
                onDrop={(e) => handleQuestionDrop(e, section.section_id)}
              >
                {/* Section Header */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => toggleSectionExpansion(section.section_id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-blue-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-blue-600" />
                      )}
                      <Badge color="info" size="sm">Order: {section.section_order}</Badge>
                      <h4 className="text-lg font-bold text-gray-900">{section.section_title}</h4>
                      <Badge color="gray" size="sm">{sectionQuestions.length} questions</Badge>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditSection(section); }}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Edit section"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.section_id); }}
                        className="p-1.5 hover:bg-red-100 rounded transition-colors"
                        title="Delete section"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                  {section.section_description && (
                    <p className="text-sm text-gray-600 mt-2 ml-8">{section.section_description}</p>
                  )}
                  {section.semantic_aliases && section.semantic_aliases.length > 0 && (
                    <div className="flex gap-1 mt-2 ml-8">
                      <Tag className="w-3 h-3 text-purple-500" />
                      <span className="text-xs text-purple-600">{section.semantic_aliases.length} aliases</span>
                    </div>
                  )}
                </div>

                {/* Questions in this section - only show when expanded */}
                {isExpanded && (
                  <div className="p-4 space-y-2">
                    {sectionQuestions.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <Move className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">Drop questions here</p>
                      </div>
                    ) : (
                      sectionQuestions
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((question) => {
                          const currentIndex = questionIndex++;
                          const isSelected = selectedQuestion?.question_id === question.question_id;
                          const isEditing = editedQuestion?.question_id === question.question_id;

                          return (
                            <div
                              key={question.question_id}
                              draggable
                              onDragStart={(e) => handleQuestionDragStart(e, question)}
                              onClick={() => handleSelectQuestion(question)}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all group ${isEditing
                                ? 'border-gray-900 bg-gray-100'
                                : isSelected
                                  ? 'border-gray-500 bg-gray-50'
                                  : 'border-gray-200 hover:border-blue-400 hover:shadow-md'
                                }`}
                            >
                              <GripVertical className="w-5 h-5 text-gray-400 group-hover:text-blue-500 cursor-move" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge color="gray" size="xs">{currentIndex + 1}</Badge>
                                  <span className="font-semibold text-sm text-gray-900">
                                    {question.question_text}
                                  </span>
                                  {isEditing && <Badge color="blue" size="xs">Editing</Badge>}
                                  {question.required && <Badge color="failure" size="xs">Required</Badge>}
                                  {question.spelling_required && <Badge color="purple" size="xs">Spelling</Badge>}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge color="info" size="xs">{question.question_id}</Badge>
                                  <span className="text-xs text-gray-500">Slot: {question.slot_name}</span>
                                  {question.tts && (
                                    <Badge color="info" size="xs">
                                      <Volume2 className="w-3 h-3 inline mr-1" />
                                      TTS
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderFormsEditor = () => {
    const formFields = [
      { id: 'text', label: 'Text Input', icon: Type, iconName: 'Type', color: 'bg-gray-600', desc: 'Single line text' },
      { id: 'textarea', label: 'Text Area', icon: AlignLeft, iconName: 'AlignLeft', color: 'bg-gray-700', desc: 'Multi-line text' },
      { id: 'number', label: 'Number', icon: Hash, iconName: 'Hash', color: 'bg-gray-600', desc: 'Numeric input' },
      { id: 'email', label: 'Email', icon: Mail, iconName: 'Mail', color: 'bg-gray-700', desc: 'Email address' },
      { id: 'phone', label: 'Phone', icon: Phone, iconName: 'Phone', color: 'bg-gray-600', desc: 'Phone number' },
      { id: 'date', label: 'Date', icon: Calendar, iconName: 'Calendar', color: 'bg-gray-700', desc: 'Date picker' },
      { id: 'time', label: 'Time', icon: Clock, iconName: 'Clock', color: 'bg-gray-600', desc: 'Time picker' },
      { id: 'toggle', label: 'Toggle', icon: ToggleLeft, iconName: 'ToggleLeft', color: 'bg-gray-700', desc: 'On/off switch' },
      { id: 'checkbox', label: 'Checkbox', icon: CheckSquare, iconName: 'CheckSquare', color: 'bg-gray-600', desc: 'Multiple choice' },
      { id: 'radio', label: 'Radio', icon: Circle, iconName: 'Circle', color: 'bg-gray-700', desc: 'Single choice' },
      { id: 'select', label: 'Dropdown', icon: ChevronDown, iconName: 'ChevronDown', color: 'bg-gray-600', desc: 'Select menu' },
      { id: 'multiselect', label: 'Multi-Select', icon: ListIcon, iconName: 'ListIcon', color: 'bg-gray-700', desc: 'Multiple options' },
      { id: 'url', label: 'URL', icon: LinkIcon, iconName: 'Link', color: 'bg-gray-600', desc: 'Web address' },
      { id: 'file', label: 'File Upload', icon: File, iconName: 'File', color: 'bg-gray-700', desc: 'File picker' },
      { id: 'image', label: 'Image', icon: Image, iconName: 'Image', color: 'bg-gray-600', desc: 'Image upload' },
      { id: 'address', label: 'Address', icon: MapPin, iconName: 'MapPin', color: 'bg-gray-700', desc: 'Location input' },
      { id: 'currency', label: 'Currency', icon: DollarSign, iconName: 'DollarSign', color: 'bg-gray-600', desc: 'Money amount' },
      { id: 'percentage', label: 'Percentage', icon: Percent, iconName: 'Percent', color: 'bg-gray-700', desc: 'Percent value' },
    ];

    // Icon map for rendering dropped fields
    const iconMap = {
      Type, AlignLeft, Hash, Mail, Phone, Calendar, Clock, ToggleLeft,
      CheckSquare, Circle, ChevronDown, ListIcon, LinkIcon, File, Image,
      MapPin, DollarSign, Percent
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
          <div className="flex items-center justify-between text-gray-900">
            <div>
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <LayoutGrid className="w-8 h-8" />
                Drag & Drop Form Builder
              </h3>
              <p className="text-gray-600">
                Create dynamic forms with field groups, validations, and conditional logic
              </p>
            </div>
            <Button className="bg-white text-gray-900 hover:bg-gray-50">
              <Plus className="w-4 h-4 mr-2" />
              Create New Form
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Field Palettes */}
          <div className="col-span-3 space-y-4">
            {/* Standard Field Palette */}
            <Card className="sticky top-4 bg-white border-gray-200">
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
                <Layers className="w-5 h-5 text-gray-700" />
                Field Palette
              </h4>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {formFields.map((field) => {
                  const Icon = field.icon;
                  return (
                    <div
                      key={field.id}
                      className="group relative p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-move bg-white select-none"
                      draggable={true}
                      onDragStart={(e) => {
                        console.log('🎯 Drag started:', field.label);
                        e.dataTransfer.setData('field', JSON.stringify(field));
                        e.dataTransfer.setData('text/plain', field.label); // Fallback for some browsers
                        e.dataTransfer.effectAllowed = 'copy';
                        setDraggedField(field);
                      }}
                      onDragEnd={() => {
                        console.log('🎯 Drag ended');
                        setDraggedField(null);
                      }}
                      title={`${field.label} - ${field.desc}`}
                    >
                      {/* Icon Only */}
                      <div className="flex items-center justify-center">
                        <div className={`${field.color} p-3 rounded-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      {/* Tooltip on Hover */}
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        <div className="font-semibold">{field.label}</div>
                        <div className="text-gray-300 text-xs mt-0.5">{field.desc}</div>
                        {/* Arrow */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ASR Grammar Palette */}
            <div className="max-h-[600px] overflow-y-auto">
              <ASRGrammarPalette />
            </div>
          </div>

          {/* Center Panel - Form Canvas */}
          <div className="col-span-6">
            <div className="rounded-lg overflow-hidden shadow-lg border border-gray-300">
              {/* Header with white background */}
              <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-300">
                <h4 className="font-bold text-lg text-gray-900">Form Canvas</h4>
              </div>

              {/* Canvas Area with Light Grid Pattern */}
              <div
                className="min-h-[600px] p-6 relative overflow-hidden bg-white"
                style={{
                  backgroundImage: `
                    radial-gradient(circle, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  console.log('📦 Drop event received on canvas');
                  e.preventDefault();
                  e.stopPropagation();

                  // Check if it's a standard field
                  const fieldData = e.dataTransfer.getData('field');
                  console.log('📦 Field data from drop:', fieldData ? 'Found' : 'Not found');
                  if (fieldData) {
                    const field = JSON.parse(fieldData);
                    const newField = {
                      ...field,
                      id: `${field.id}-${Date.now()}`,
                      label: field.label,
                      required: false
                    };
                    console.log('✅ Adding field to canvas:', newField.label);
                    setDroppedFields([...droppedFields, newField]);
                    return;
                  }

                  // Check if it's an ASR template
                  const asrTemplateData = e.dataTransfer.getData('asrTemplate');
                  if (asrTemplateData) {
                    const template = JSON.parse(asrTemplateData);
                    console.log('🎤 Dropped ASR template:', template);

                    // Create field from ASR template
                    const newField = {
                      id: `${template.id}_${Date.now()}`,
                      label: template.label,
                      type: template.id,
                      icon: template.icon,
                      iconName: 'User', // Default icon name
                      color: template.color,
                      desc: template.description,
                      required: false,

                      // Copy ASR configuration
                      asr: { ...template.asr },

                      // Copy validation rules
                      validation: { ...template.validation },

                      // Copy UI hints
                      ui: { ...template.ui }
                    };

                    setDroppedFields([...droppedFields, newField]);
                    console.log('✅ Added ASR grammar field:', newField);
                  }
                }}
              >
                {droppedFields.length === 0 ? (
                  <div className="text-center py-20">
                    <LayoutGrid className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700 text-lg font-medium mb-2">Drop fields here</p>
                    <p className="text-gray-600 text-sm">Drag fields from the palette to build your form</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {droppedFields.map((field, index) => {
                      const Icon = iconMap[field.iconName] || Type;
                      return (
                        <div
                          key={field.id}
                          className="flex items-center gap-3 p-4 rounded-md bg-white border-2 border-gray-300 shadow-md hover:border-gray-400 transition-colors"
                        >
                          <div className={`${field.color} p-2 rounded-lg flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-900">{field.label}</div>
                            <div className="text-xs text-gray-600">{field.id}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedFieldForSettings(field);
                                setSelectedFieldIndex(index);
                                setCurrentFieldType(field.type || 'text');
                                setShowFieldSettings(true);
                              }}
                              className="p-2 hover:bg-gray-100 rounded transition-colors"
                              title="Field settings"
                            >
                              <Settings className="w-4 h-4 text-gray-700 hover:text-gray-900" />
                            </button>
                            <button
                              onClick={() => {
                                setDroppedFields(droppedFields.filter((_, i) => i !== index));
                              }}
                              className="p-2 hover:bg-red-100 rounded transition-colors"
                              title="Remove field"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 hover:text-red-700" />
                            </button>
                          </div>
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
              <Card className="group relative bg-white border-gray-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-900">
                  <GitBranch className="w-5 h-5 text-gray-700" />
                  Workflow Editor
                </h4>
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Condition
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Define conditional logic and field dependencies
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                </div>
              </Card>

              {/* Field Groups */}
              <Card className="group relative bg-white border-gray-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-900">
                  <Layers className="w-5 h-5 text-gray-700" />
                  Field Groups
                </h4>
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-3 h-3 mr-1" />
                  New Group
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Create repeatable groups (e.g., additional drivers)
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                </div>
              </Card>

              {/* Validation Rules */}
              <Card className="group relative bg-white border-gray-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-900">
                  <CheckCircle className="w-5 h-5 text-gray-700" />
                  Validation Rules
                </h4>
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Rule
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  SHACL-based validation for form fields
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                </div>
              </Card>

              {/* Hierarchical Selects */}
              <Card className="group relative bg-white border-gray-200 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-900">
                  <GitBranch className="w-5 h-5 text-gray-700" />
                  Hierarchical Selects
                </h4>
                <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700">
                  <Plus className="w-3 h-3 mr-1" />
                  Configure
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-0 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Multi-level cascading dropdowns
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
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
              className={`py-2 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'details'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <ListIcon className="w-4 h-4" />
              Question Details
            </button>
            <button
              onClick={() => setActiveTab('voice-asr')}
              className={`py-2 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'voice-asr'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Mic className="w-4 h-4" />
              Voice ASR
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
                <label htmlFor="toggle-required" className="flex items-center gap-2 cursor-pointer">
                  <ToggleSwitch
                    id="toggle-required"
                    checked={editedQuestion.required || false}
                    onChange={(checked) => handleFieldChange('required', checked)}
                    label="Required"
                  />
                </label>
                <label htmlFor="toggle-spelling-required" className="flex items-center gap-2 cursor-pointer">
                  <ToggleSwitch
                    id="toggle-spelling-required"
                    checked={editedQuestion.spelling_required || false}
                    onChange={(checked) => handleFieldChange('spelling_required', checked)}
                    label="Spelling Required (Uses Phonetic Alphabet)"
                  />
                </label>
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

              <Alert color="info">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Best Maintained TTS Libraries</h4>
                    <ul className="text-sm space-y-1">
                      <li><strong>Coqui TTS</strong> (https://github.com/coqui-ai/TTS) - 34k+ stars, actively maintained, supports 1100+ languages</li>
                      <li><strong>Mozilla TTS</strong> - Original project (archived, use Coqui TTS instead)</li>
                      <li><strong>pyttsx3</strong> - Offline TTS, cross-platform</li>
                      <li><strong>gTTS</strong> (Google TTS) - Simple cloud-based TTS</li>
                      <li><strong>Azure Speech SDK</strong> - Enterprise-grade with neural voices</li>
                    </ul>
                  </div>
                </div>
              </Alert>

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
                              className="text-gray-700 hover:text-gray-900 transition-colors"
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

            {/* ASR Word Mapping Configuration */}
          </div>
        )}

        {activeTab === 'voice-asr' && (
          <VoiceASRTab
            droppedFields={droppedFields}
            renderFormsEditor={renderFormsEditor}
          />
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
            <Card className="bg-white border-gray-200">
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-medium text-gray-900">{editedQuestion.question_text}</p>
                  <p className="text-sm text-gray-600 mt-1">Slot: {editedQuestion.slot_name}</p>
                </div>
                {editedQuestion.tts && (
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm font-semibold text-gray-900 mb-1">TTS will say:</p>
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
        <Card className="bg-white border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Questions</p>
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
            </div>
            <FileText className="w-8 h-8 text-gray-700" />
          </div>
        </Card>
        <Card className="bg-white border-gray-200">
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
        <Card className="bg-white border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With TTS</p>
              <p className="text-2xl font-bold text-gray-900">
                {questions.filter(q => q.tts).length}
              </p>
            </div>
            <Volume2 className="w-8 h-8 text-gray-700" />
          </div>
        </Card>
        <Card className="bg-white border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Spelling Required</p>
              <p className="text-2xl font-bold text-gray-900">
                {questions.filter(q => q.spelling_required).length}
              </p>
            </div>
            <Mic className="w-8 h-8 text-gray-700" />
          </div>
        </Card>
      </div>

      {/* Main Editor Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flow Visualization */}
        <Card className="bg-white border-gray-200">
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
        <Card className="bg-white border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Question Editor</h3>
          <div className="max-h-[700px] overflow-y-auto pr-2">
            {renderQuestionEditor()}
          </div>
        </Card>
      </div>

      {/* Field Help/FAQ Modal */}
      <Modal
        show={showFieldHelp}
        onClose={() => setShowFieldHelp(false)}
        size="lg"
      >
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Field Help & FAQ - {selectedFieldForSettings?.label}
          </h3>
          <div className="space-y-4">
            <Alert color="info">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold mb-2">How to fill this field correctly</h4>
                  <p className="text-sm mb-3">
                    This section provides helpful information about what data is expected in this field
                    and how to provide it accurately.
                  </p>

                  <h5 className="font-semibold text-sm mb-2">Examples of valid answers:</h5>
                  <ul className="list-disc list-inside text-sm space-y-1 mb-3">
                    <li>For text fields: Enter alphanumeric characters</li>
                    <li>For date fields: Use DD/MM/YYYY format or speak naturally</li>
                    <li>For number fields: Enter digits only</li>
                  </ul>

                  <h5 className="font-semibold text-sm mb-2">Speech Recognition Tips:</h5>
                  <div className="bg-white p-3 rounded-lg text-sm">
                    <p className="mb-2">When using voice input, try these phrases:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      <li>"Type the value" - for spelling out answers</li>
                      <li>"Use numbers" - for numerical values</li>
                      <li>"Say the date as..." - for date inputs</li>
                    </ul>
                  </div>

                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-700">
                      <strong>Note:</strong> All help content is editable in the Field Settings panel.
                      These are placeholder instructions that will be customized per field.
                    </p>
                  </div>
                </div>
              </div>
            </Alert>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button color="light" onClick={() => setShowFieldHelp(false)}>
              Close
            </Button>
            <Button
              color="blue"
              onClick={() => {
                setShowFieldHelp(false);
                setShowFieldSettings(true);
              }}
            >
              Edit Help Content
            </Button>
          </div>
        </div>
      </Modal>

      {/* Field Settings Modal - Comprehensive Configuration */}
      <Modal
        show={showFieldSettings}
        onClose={() => setShowFieldSettings(false)}
        size="6xl"
      >
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
            <Settings className="w-6 h-6" />
            Field Settings - {selectedFieldForSettings?.label}
          </h3>
          {selectedFieldForSettings && (
            <div className="space-y-6">
              {/* Basic Metadata Section */}
              <Card className="bg-white border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-700" />
                  Basic Metadata
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="field-label">Field Label</Label>
                    <TextInput
                      id="field-label"
                      defaultValue={selectedFieldForSettings.label}
                      placeholder="Enter field label"
                    />
                  </div>
                  <div>
                    <Label htmlFor="field-key">Internal Key</Label>
                    <TextInput
                      id="field-key"
                      defaultValue={selectedFieldForSettings.id}
                      placeholder="field_key"
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="field-type">Field Type</Label>
                    <Select
                      id="field-type"
                      defaultValue={selectedFieldForSettings.type || 'text'}
                      onChange={(e) => setCurrentFieldType(e.target.value)}
                    >
                      <option value="text">Text Input</option>
                      <option value="textarea">Text Area</option>
                      <option value="number">Number</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="date">Date</option>
                      <option value="select">Select/Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="radio">Radio</option>
                      <option value="uk_driving_licence">UK Driving Licence</option>
                    </Select>
                  </div>

                  {/* Date Component Type Selector - Shows only for date fields */}
                  {currentFieldType === 'date' && (
                    <div>
                      <Label htmlFor="date-component">Date Component Type</Label>
                      <Select
                        id="date-component"
                        defaultValue={selectedFieldForSettings.date_component || 'full'}
                      >
                        <option value="full">Full Date (DD/MM/YYYY)</option>
                        <option value="month_year">Month & Year (MM/YYYY)</option>
                        <option value="day">Day Only (DD)</option>
                        <option value="month">Month Only (MM)</option>
                        <option value="year">Year Only (YYYY)</option>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Choose which date components to collect. Each type has optimized ASR grammar.
                      </p>
                    </div>
                  )}

                  {/* Email Settings */}
                  {currentFieldType === 'email' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Label htmlFor="custom-tlds">Custom TLD Shortcuts (comma separated)</Label>
                      <TextInput
                        id="custom-tlds"
                        defaultValue={(selectedFieldForSettings.custom_tlds || []).join(', ')}
                        placeholder=".com, .co.uk, .net, .org"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        These will appear as quick-select buttons on the voice keyboard.
                      </p>
                    </div>
                  )}

                  {/* UK Driving Licence Settings */}
                  {currentFieldType === 'uk_driving_licence' && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                      <h4 className="text-sm font-semibold text-purple-900">Licence Input Configuration</h4>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-fill-dob" className="cursor-pointer">Auto-fill from DOB?</Label>
                        <ToggleSwitch
                          id="auto-fill-dob"
                          checked={selectedFieldForSettings.auto_fill_dob !== false}
                          onChange={(checked) => {
                            setSelectedFieldForSettings(prev => ({ ...prev, auto_fill_dob: checked }));
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-fill-name" className="cursor-pointer">Auto-fill from Name?</Label>
                        <ToggleSwitch
                          id="auto-fill-name"
                          checked={selectedFieldForSettings.auto_fill_name !== false}
                          onChange={(checked) => {
                            setSelectedFieldForSettings(prev => ({ ...prev, auto_fill_name: checked }));
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-upload" className="cursor-pointer">Allow Document Upload?</Label>
                        <ToggleSwitch
                          id="allow-upload"
                          checked={selectedFieldForSettings.allow_document_upload !== false}
                          onChange={(checked) => {
                            setSelectedFieldForSettings(prev => ({ ...prev, allow_document_upload: checked }));
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="field-placeholder">Placeholder</Label>
                    <TextInput
                      id="field-placeholder"
                      defaultValue={selectedFieldForSettings.placeholder || ''}
                      placeholder="enter the question"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <ToggleSwitch
                      id="toggle-field-required"
                      label="Required Field"
                      defaultChecked={selectedFieldForSettings.required || false}
                    />
                  </div>
                </div>
              </Card>

              {/* Validation Rules Section - Zod Powered */}
              <Card className="bg-white border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-gray-700" />
                    Validation Rules (Zod-Powered)
                  </h3>
                  <Badge color="success">Recommended: Zod</Badge>
                </div>

                <Alert color="info" className="mb-4">
                  <p className="text-sm">
                    <strong>Using Zod:</strong> The fastest, most secure validation library for 2025.
                    TypeScript-first with automatic type inference. Perfect for both frontend and backend validation.
                  </p>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label>Validation Library Predicates</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['isString', 'isAlphanumeric', 'isAlpha', 'isNumeric', 'isDigit', 'isNumber', 'isInteger', 'isFloat', 'isDate', 'isPastDate', 'isFutureDate', 'isMonth', 'isMonthOfYear', 'isDayOfMonth', 'isYear', 'isLeapYear', 'isPostcode', 'isEmail', 'isPhone', 'isUKPostcode', 'isUKDrivingLicence', 'isUKDrivingLicenceCategory', 'isUKDrivingOffenceCode', 'isUKCarRegistration', 'isSelect'].map((pred) => {
                        const isChecked = selectedFieldForSettings.validation?.validators?.includes(pred) || false;
                        return (
                          <label key={pred} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" className="rounded" defaultChecked={isChecked} />
                            <span className="text-sm font-mono text-gray-700">{pred}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-700 font-semibold mb-2">String Validators:</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li><span className="font-mono text-gray-700">isString</span>: Validates if value is a string</li>
                        <li><span className="font-mono text-gray-700">isAlphanumeric</span>: Validates string contains only letters and numbers (no spaces or special characters)</li>
                        <li><span className="font-mono text-gray-700">isAlpha</span>: Validates string contains only alphabetic characters (letters only, no numbers or special characters)</li>
                        <li><span className="font-mono text-gray-700">isNumeric</span>: Validates string contains only numeric characters (digits 0-9, spaces, and hyphens allowed)</li>
                      </ul>
                    </div>
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-700 font-semibold mb-2">Date/Time Validators:</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li><span className="font-mono text-gray-700">isMonth</span>: Validates month number (1-12)</li>
                        <li><span className="font-mono text-gray-700">isMonthOfYear</span>: Validates month in MM or MM/YYYY format</li>
                        <li><span className="font-mono text-gray-700">isDayOfMonth</span>: Validates day (1-31) based on month and leap year</li>
                        <li><span className="font-mono text-gray-700">isYear</span>: Validates year (1900-2099)</li>
                        <li><span className="font-mono text-gray-700">isLeapYear</span>: Validates if a year is a leap year</li>
                      </ul>
                    </div>
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-700 font-semibold mb-2">UK-Specific Validators:</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li><span className="font-mono text-gray-700">isUKPostcode</span>: Validates UK postcode format (e.g., SW1A 1AA, M1 1AE, CR2 6XH)</li>
                        <li><span className="font-mono text-gray-700">isUKDrivingLicence</span>: Validates UK driving licence number (16-character format)</li>
                        <li><span className="font-mono text-gray-700">isUKDrivingLicenceCategory</span>: Validates licence categories (A, A1, A2, AM, B, BE, C, C1, C1E, CE, D, D1, D1E, DE, f, g, h, k, l, n, p, q)</li>
                        <li><span className="font-mono text-gray-700">isUKDrivingOffenceCode</span>: Validates UK driving offence codes (e.g., SP30, CD10, DR10, IN10, MS50, TT99)</li>
                        <li><span className="font-mono text-gray-700">isUKCarRegistration</span>: Validates UK vehicle registration (e.g., AB12 CDE, AB12CDE)</li>
                      </ul>
                    </div>
                    <div className="mt-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                      <p className="text-xs text-gray-700 font-semibold mb-2">Select Option Validators:</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li><span className="font-mono text-gray-700">isSelect</span>: Validates value against TTL ontology select options with 6-phase matching (exact, label, alias, phonetic exact, fuzzy phonetic, partial). Supports semantic alternatives like "Benzine" → "Petrol"</li>
                      </ul>
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-gray-700 cursor-pointer hover:text-gray-900">View UK Driving Offence Codes</summary>
                        <div className="mt-2 p-2 bg-white rounded text-xs space-y-1">
                          <p><strong>Accident Offences (AC):</strong> AC10-AC30 (Fail to stop, report, give info)</p>
                          <p><strong>Disqualified Driver (BA):</strong> BA10-BA60 (Driving whilst disqualified)</p>
                          <p><strong>Careless Driving (CD):</strong> CD10-CD99 (Careless/inconsiderate driving, death by careless)</p>
                          <p><strong>Construction & Use (CU):</strong> CU10-CU80 (Unsafe vehicle, weight/load issues)</p>
                          <p><strong>Reckless/Dangerous (DD):</strong> DD10-DD90 (Dangerous driving, causing death)</p>
                          <p><strong>Drink/Drugs (DR):</strong> DR10-DR90 (Drink/drug driving, refusal to provide specimen)</p>
                          <p><strong>Insurance (IN):</strong> IN10 (No insurance)</p>
                          <p><strong>Licence (LC):</strong> LC20-LC50 (No/invalid licence)</p>
                          <p><strong>Misc (MS):</strong> MS10-MS90 (Traffic light, no MOT, mobile phone)</p>
                          <p><strong>Motorway (MW):</strong> MW10 (Motorway offences)</p>
                          <p><strong>Pedestrian Crossing (PC):</strong> PC10-PC30 (Pedestrian crossing offences)</p>
                          <p><strong>Speed Limits (SP):</strong> SP10-SP60 (Speeding offences)</p>
                          <p><strong>Traffic Direction (TS):</strong> TS10-TS70 (Traffic sign/light offences)</p>
                          <p><strong>Theft (UT):</strong> UT50 (Aggravated vehicle taking)</p>
                          <p><strong>Totting Up (TT):</strong> TT99 (Disqualified under totting up)</p>
                        </div>
                      </details>
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-gray-700 cursor-pointer hover:text-gray-900">View Marital Status Options</summary>
                        <div className="mt-2 p-2 bg-white rounded text-xs space-y-1">
                          <p><strong>Single:</strong> single, unmarried, bachelor, bachelorette, not married</p>
                          <p><strong>Married:</strong> married, wed, wedded, hitched</p>
                          <p><strong>Civil Partnership:</strong> civil partnership, civil partner, CP, registered partnership</p>
                          <p><strong>Divorced:</strong> divorced, ex-married, formerly married</p>
                          <p><strong>Separated:</strong> separated, living apart, estranged</p>
                          <p><strong>Widowed:</strong> widowed, widow, widower</p>
                          <p><strong>Cohabiting:</strong> cohabiting, living together, common law, partner</p>
                        </div>
                      </details>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="min-length">Min Length</Label>
                    <TextInput
                      id="min-length"
                      type="number"
                      defaultValue={selectedFieldForSettings.validation?.minLength || 0}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-length">Max Length</Label>
                    <TextInput
                      id="max-length"
                      type="number"
                      defaultValue={selectedFieldForSettings.validation?.maxLength || 255}
                      placeholder="255"
                    />
                  </div>

                  <div>
                    <Label htmlFor="number-range">Number Range (min - max)</Label>
                    <div className="flex gap-2">
                      <TextInput
                        id="range-min"
                        type="number"
                        placeholder="Min"
                      />
                      <span className="flex items-center px-2">-</span>
                      <TextInput
                        id="range-max"
                        type="number"
                        placeholder="Max"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="custom-regex">Custom Regex Pattern</Label>
                    <TextInput
                      id="custom-regex"
                      placeholder="^[A-Z]{2}\d{2}\s?\d{3}$"
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Add custom regex for complex validation patterns
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="error-message">Custom Error Message</Label>
                    <TextInput
                      id="error-message"
                      placeholder="Please enter a valid value"
                    />
                  </div>
                </div>
              </Card>

              {/* TTS Grammar & Configuration Section */}
              <Card className="bg-white border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-gray-700" />
                  TTS Grammar & Configuration
                </h3>

                <Alert color="info" className="mb-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Best Maintained TTS Libraries</h4>
                      <ul className="text-xs space-y-1">
                        <li><strong>Coqui TTS</strong> (https://github.com/coqui-ai/TTS) - 34k+ stars, actively maintained, supports 1100+ languages</li>
                        <li><strong>Mozilla TTS</strong> - Original project (archived, use Coqui TTS instead)</li>
                        <li><strong>pyttsx3</strong> - Offline TTS, cross-platform</li>
                        <li><strong>gTTS</strong> (Google TTS) - Simple cloud-based TTS</li>
                        <li><strong>Azure Speech SDK</strong> - Enterprise-grade with neural voices</li>
                      </ul>
                    </div>
                  </div>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tts-text">Text-to-Speech Prompt</Label>
                    <Textarea
                      id="tts-text"
                      rows={2}
                      placeholder="Please provide your answer..."
                    />
                  </div>
                </div>
              </Card>

              {/* ASR Configuration Section */}
              <Card className="bg-white border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-gray-700" />
                  ASR Configuration
                </h3>

                <Alert color="info" className="mb-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Best Maintained ASR Libraries</h4>
                      <ul className="text-xs space-y-1">
                        <li><strong>Whisper (OpenAI)</strong> (https://github.com/openai/whisper) - 70k+ stars, SOTA accuracy, multilingual</li>
                        <li><strong>vosk-api</strong> - Offline ASR, lightweight, 20+ languages</li>
                        <li><strong>DeepSpeech (Mozilla)</strong> - Archived, use Coqui STT instead</li>
                        <li><strong>Coqui STT</strong> (https://github.com/coqui-ai/STT) - Fork of DeepSpeech, actively maintained</li>
                        <li><strong>Google Cloud Speech-to-Text</strong> - Enterprise-grade cloud ASR</li>
                        <li><strong>Azure Speech SDK</strong> - Enterprise with real-time streaming</li>
                      </ul>
                    </div>
                  </div>
                </Alert>

                <div className="space-y-4">
                  {/* Prominent AI Generate Button */}
                  <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-lg">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-4 bg-gray-200 rounded-xl shadow-md">
                        <Sparkles className="w-8 h-8 text-gray-900" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-gray-900 mb-3 flex items-center gap-2">
                          <span className="animate-pulse">✨</span>
                          AI-Powered Grammar Generator
                        </h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          <strong className="text-gray-900">Automatically generate ASR grammar patterns</strong> from your TTS question variants.
                          Includes response patterns like <code className="bg-gray-200 px-2 py-1 rounded text-gray-900">"my first name is"</code>,
                          <code className="bg-gray-200 px-2 py-1 rounded text-gray-900 ml-1">"my name is"</code>,
                          <code className="bg-gray-200 px-2 py-1 rounded text-gray-900 ml-1">"I'm Vincent"</code>.
                        </p>
                        <Button
                          size="xl"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
                          onClick={async () => {
                            setLoading(true);
                            try {
                              // Get the current question and its TTS variants
                              const questionText = selectedFieldForSettings?.label || '';
                              const variants = ttsVariants || [];

                              console.log('🤖 Generating ASR grammar for question:', questionText);
                              console.log('📝 Using TTS variants:', variants);

                              // Call backend API to generate ASR grammar
                              const response = await fetch(`${API_BASE_URL}/generate-asr-grammar`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  questionText,
                                  ttsVariants: variants,
                                  fieldLabel: questionText
                                })
                              });

                              if (!response.ok) {
                                throw new Error('Failed to generate ASR grammar');
                              }

                              const data = await response.json();
                              console.log('✅ Generated ASR grammar:', data);
                              console.log('📊 Response patterns:', data.patterns);

                              // Store the generated patterns for checklist display
                              if (data.patterns && Array.isArray(data.patterns)) {
                                setGeneratedPatterns(data.patterns.map((pattern, idx) => ({
                                  id: idx,
                                  pattern: pattern,
                                  selected: true // All patterns selected by default
                                })));
                              }

                              // Update the ASR grammar textarea
                              const grammarTextarea = document.getElementById('asr-grammar');
                              if (grammarTextarea && data.grammar) {
                                grammarTextarea.value = data.grammar;
                                setSuccess(`✅ Generated ${data.patterns?.length || 0} ASR response patterns! Review and select patterns below.`);
                              }

                              setLoading(false);
                              setTimeout(() => setSuccess(null), 8000);
                            } catch (err) {
                              console.error('❌ Error generating ASR grammar:', err);
                              setError(`Failed to generate ASR grammar: ${err.message}`);
                              setLoading(false);
                              setTimeout(() => setError(null), 3000);
                            }
                          }}
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Generate ASR Grammar from TTS Variants
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* ASR Grammar Patterns - Enhanced Textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="asr-grammar" className="text-base font-semibold">Generated JSGF Grammar</Label>
                      <Badge color="purple">JSGF Format</Badge>
                    </div>
                    <Textarea
                      id="asr-grammar"
                      rows={12}
                      placeholder="Click 'Generate ASR Grammar' above to auto-generate JSGF patterns...

Or enter manually:
yes | no
accept | decline
{month} {day} {year}"
                      className="font-mono text-sm bg-gray-50 border-2 border-indigo-200"
                    />
                    <div className="flex items-start gap-2 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <Info className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-700">
                        Supports JSGF, GRXML, ABNF, and regex formats. Generated grammars include response patterns,
                        NATO phonetic alphabet, and parameter variations.
                      </p>
                    </div>
                  </div>

                  {/* Generated Response Patterns Checklist */}
                  {generatedPatterns.length > 0 && (
                    <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Generated Response Patterns ({generatedPatterns.filter(p => p.selected).length}/{generatedPatterns.length} selected)
                          </h4>
                          <p className="text-sm text-gray-700 mt-1">
                            Review and select which patterns to include in your ASR grammar
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="xs"
                            color="success"
                            onClick={() => setGeneratedPatterns(generatedPatterns.map(p => ({ ...p, selected: true })))}
                          >
                            Select All
                          </Button>
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => setGeneratedPatterns(generatedPatterns.map(p => ({ ...p, selected: false })))}
                          >
                            Deselect All
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto p-2 bg-white rounded-lg border border-green-200">
                        {generatedPatterns.map((item) => (
                          <label
                            key={item.id}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${item.selected
                              ? 'bg-gray-200 border-gray-500 shadow-sm'
                              : 'bg-gray-50 border-gray-200 hover:border-green-300'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => {
                                const updated = generatedPatterns.map(p =>
                                  p.id === item.id ? { ...p, selected: e.target.checked } : p
                                );
                                setGeneratedPatterns(updated);
                              }}
                              className="w-4 h-4 text-gray-700 rounded"
                            />
                            <code className={`text-sm flex-1 ${item.selected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                              {item.pattern}
                            </code>
                          </label>
                        ))}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          color="success"
                          onClick={async () => {
                            // Regenerate grammar with only selected patterns
                            const selectedPatterns = generatedPatterns.filter(p => p.selected).map(p => p.pattern);
                            setSuccess(`✅ Applied ${selectedPatterns.length} selected patterns to grammar`);
                            setTimeout(() => setSuccess(null), 3000);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Apply Selected Patterns
                        </Button>
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => setGeneratedPatterns([])}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Select List Data Management - Only show for select/dropdown fields */}
              {currentFieldType === 'select' && (
                <Card className="bg-white border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ListIcon className="w-5 h-5 text-gray-700" />
                    Select List Options
                  </h3>

                  <Alert color="info" className="mb-4">
                    <p className="text-sm">
                      Configure dropdown/select options. Load from TTL ontology or define manually.
                    </p>
                  </Alert>

                  {/* Load from TTL Ontology */}
                  <div className="mb-4 p-3 bg-white rounded-lg border border-blue-300">
                    <Label htmlFor="ontology-question">Load Options from TTL Ontology</Label>
                    <div className="flex gap-2 mt-2">
                      <Select
                        id="ontology-question"
                        className="flex-1"
                        onChange={(e) => {
                          // Load options from the selected question
                          const questionId = e.target.value;
                          if (questionId) {
                            // Fetch options for this question from the API
                            fetch(`${API_BASE_URL}/select-list/${questionId}`)
                              .then(res => res.json())
                              .then(data => {
                                if (data.options) {
                                  const loadedOptions = data.options.map(opt => ({
                                    label: opt.label || opt.optionLabel,
                                    value: opt.value || opt.optionValue,
                                    ontologyUri: opt.uri || opt.option_uri
                                  }));
                                  setSelectOptions(loadedOptions);
                                  setSuccess(`Loaded ${loadedOptions.length} options from ${questionId}`);
                                  setTimeout(() => setSuccess(null), 3000);
                                }
                              })
                              .catch(err => {
                                setError(`Failed to load options: ${err.message}`);
                              });
                          }
                        }}
                      >
                        <option value="">-- Select a question with options --</option>
                        <option value="q_vehicle_make">Vehicle Manufacturer (Toyota, BMW, Mercedes...)</option>
                        <option value="q_vehicle_fuel_type">Vehicle Fuel Type (Petrol, Diesel, Electric...)</option>
                        <option value="q_vehicle_type">Vehicle Type</option>
                        <option value="q_cover_type">Cover Type</option>
                        <option value="q_driving_licence_type">Licence Type</option>
                      </Select>
                      <Button
                        size="sm"
                        color="blue"
                        onClick={() => {
                          setSuccess('Select a question from the dropdown to load its options');
                          setTimeout(() => setSuccess(null), 2000);
                        }}
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Load from TTL
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Select a question to automatically load its options from the TTL ontology with aliases and phonetics
                    </p>
                  </div>

                  <div className="space-y-3">
                    {selectOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <TextInput
                          placeholder="Display Label"
                          className="flex-1"
                          value={option.label}
                          onChange={(e) => {
                            const newOptions = [...selectOptions];
                            newOptions[index].label = e.target.value;
                            setSelectOptions(newOptions);
                          }}
                        />
                        <TextInput
                          placeholder="Internal Value"
                          className="flex-1 font-mono"
                          value={option.value}
                          onChange={(e) => {
                            const newOptions = [...selectOptions];
                            newOptions[index].value = e.target.value;
                            setSelectOptions(newOptions);
                          }}
                        />
                        <TextInput
                          placeholder="Ontology URI (optional)"
                          className="flex-1 font-mono text-xs"
                          value={option.ontologyUri}
                          onChange={(e) => {
                            const newOptions = [...selectOptions];
                            newOptions[index].ontologyUri = e.target.value;
                            setSelectOptions(newOptions);
                          }}
                        />
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => {
                            if (selectOptions.length > 1) {
                              setSelectOptions(selectOptions.filter((_, i) => i !== index));
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      color="light"
                      className="w-full mt-2 border-dashed border-gray-300 text-gray-500 hover:text-gray-700"
                      onClick={() => setSelectOptions([...selectOptions, { label: '', value: '', ontologyUri: '' }])}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </Button>
                  </div>

                  {/* Cascading Configuration */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                      <GitMerge className="w-4 h-4 text-gray-700" />
                      Cascading Logic
                    </h4>
                    <div className="space-y-4">
                      <ToggleSwitch
                        label="Is Dependent Question?"
                        checked={cascadingConfig.isDependent}
                        onChange={(e) => setCascadingConfig({ ...cascadingConfig, isDependent: e.target.checked })}
                      />

                      {cascadingConfig.isDependent && (
                        <div>
                          <Label htmlFor="parent-question">Parent Question ID</Label>
                          <Select
                            id="parent-question"
                            value={cascadingConfig.parentQuestionId}
                            onChange={(e) => setCascadingConfig({ ...cascadingConfig, parentQuestionId: e.target.value })}
                          >
                            <option value="">-- Select Parent Question --</option>
                            {/* Ideally this list should be dynamic, but for now we hardcode common parents or use text input if needed */}
                            <option value="q_vehicle_make">Vehicle Make (q_vehicle_make)</option>
                            <option value="q_claim_type">Claim Type (q_claim_type)</option>
                            <option value="q_conviction_type">Conviction Type (q_conviction_type)</option>
                          </Select>
                          <p className="text-xs text-gray-500 mt-1">
                            The options for this question will be filtered based on the answer to the parent question.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Mapping & Transformation Rules */}
              <Card className="bg-white border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-gray-700" />
                  Mapping & Transformation Rules
                </h3>

                <p className="text-sm text-gray-700 mb-4">
                  Define how raw form values are transformed into internal representations.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label>Transformation Type</Label>
                    <Select>
                      <option>No transformation</option>
                      <option>Date format conversion (DD/MM/YYYY → YYYY-MM-DD)</option>
                      <option>Case conversion (uppercase/lowercase)</option>
                      <option>Whitespace normalization</option>
                      <option>Boolean mapping ("Yes"/"No" → true/false)</option>
                      <option>Custom mapping (editable below)</option>
                    </Select>
                  </div>

                  <div>
                    <Label>Word-to-Format Mappings (ASR Support)</Label>
                    <div className="bg-white p-4 rounded-lg border border-amber-200 space-y-2">
                      {wordMappings.map((mapping, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <TextInput
                            placeholder="Spoken word (e.g., 'march')"
                            className="flex-1"
                            value={mapping.spokenWord}
                            onChange={(e) => {
                              const newMappings = [...wordMappings];
                              newMappings[index].spokenWord = e.target.value;
                              setWordMappings(newMappings);
                            }}
                          />
                          <span className="text-gray-500">→</span>
                          <TextInput
                            placeholder="Format (e.g., '03')"
                            className="flex-1"
                            value={mapping.format}
                            onChange={(e) => {
                              const newMappings = [...wordMappings];
                              newMappings[index].format = e.target.value;
                              setWordMappings(newMappings);
                            }}
                          />
                          <Button
                            size="sm"
                            color="light"
                            onClick={() => {
                              if (wordMappings.length > 1) {
                                setWordMappings(wordMappings.filter((_, i) => i !== index));
                              }
                            }}
                            disabled={wordMappings.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        color="amber"
                        onClick={() => {
                          setWordMappings([...wordMappings, { spokenWord: '', format: '' }]);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Mapping
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Examples: "march" → "03", "third" → "3", "nineteen sixty one" → "1961"
                    </p>
                  </div>
                </div>
              </Card>

              {/* FAQ/Help Content Editor */}
              <Card className="bg-white border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-gray-700" />
                  Field Help & FAQ Content
                </h3>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="help-description">Field Description</Label>
                    <Textarea
                      id="help-description"
                      rows={2}
                      placeholder="Explain what this field is for..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="help-how-to-fill">How to Fill Correctly</Label>
                    <Textarea
                      id="help-how-to-fill"
                      rows={3}
                      placeholder="Provide instructions on how to fill this field correctly..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="help-examples">Valid Examples</Label>
                    <Textarea
                      id="help-examples"
                      rows={3}
                      placeholder="Example 1: ...
Example 2: ...
Example 3: ..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="help-asr-hints">ASR/TTS Hints</Label>
                    <Textarea
                      id="help-asr-hints"
                      rows={2}
                      placeholder="Voice input tips, e.g., 'Say the date as twenty-third of April twenty twenty-four'"
                    />
                  </div>
                </div>
              </Card>

              {/* Editable Configuration Tabs - JSON Schema & TTL */}
              <Card className="bg-gray-50 border-gray-300">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Code className="w-5 h-5 text-gray-600" />
                  Field Configuration (Editable)
                </h3>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-4 border-b border-gray-300">
                  <button
                    onClick={() => setConfigTab('json')}
                    className={`px-4 py-2 font-medium transition-colors ${configTab === 'json'
                      ? 'text-gray-900 border-b-2 border-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    JSON Schema
                  </button>
                  <button
                    onClick={() => setConfigTab('ttl')}
                    className={`px-4 py-2 font-medium transition-colors ${configTab === 'ttl'
                      ? 'text-gray-900 border-b-2 border-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    TTL (Turtle)
                  </button>
                </div>

                {/* JSON Schema Tab */}
                {configTab === 'json' && (
                  <div>
                    <Textarea
                      rows={12}
                      className="font-mono text-xs bg-gray-100 text-gray-900"
                      value={jsonConfig || JSON.stringify({
                        fieldId: selectedFieldForSettings.id,
                        label: selectedFieldForSettings.label,
                        type: selectedFieldForSettings.id,
                        required: selectedFieldForSettings.required || false,
                        validation: {
                          library: "zod",
                          predicates: {
                            isDigit: false,
                            isNumber: false,
                            isEmail: false,
                            isUKPostcode: false,
                            isUKDrivingLicence: false,
                            isVehicleReg: false,
                            isAlpha: false,
                            isAlphanumeric: false,
                            isDate: false,
                            isPhoneNumber: false
                          },
                          minLength: null,
                          maxLength: null,
                          minValue: null,
                          maxValue: null,
                          pattern: null,
                          customErrorMessage: null
                        },
                        tts: {
                          grammarText: "",
                          library: "coqui-tts",
                          ssml: null,
                          voice: "en-GB-Neural2-A",
                          rate: 1.0,
                          pitch: 1.0
                        },
                        asr: {
                          grammarPatterns: "",
                          library: "whisper",
                          grammarVariants: "",
                          confidenceThreshold: 0.85,
                          languageModel: null
                        },
                        selectOptions: selectOptions,
                        cascading: cascadingConfig,
                        mapping: {
                          transformationType: "none",
                          wordToFormatRules: wordMappings.map(m => ({
                            spoken: m.spokenWord,
                            formatted: m.format
                          })),
                          transformationScript: null
                        },
                        help: {
                          fieldDescription: "",
                          howToFill: "",
                          validExamples: [],
                          invalidExamples: [],
                          asrHints: "",
                          commonMistakes: ""
                        }
                      }, null, 2)}
                      onChange={(e) => setJsonConfig(e.target.value)}
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Edit the JSON schema directly. Changes will be synced to the UI and TTL format.
                    </p>
                  </div>
                )}

                {/* TTL Tab */}
                {configTab === 'ttl' && (
                  <div>
                    <Textarea
                      rows={12}
                      className="font-mono text-xs bg-gray-100 text-gray-900"
                      value={ttlConfig || `@prefix : <http://diggi.io/ontology/dialog#> .
@prefix mm: <http://diggi.io/ontology/multimodal#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:${selectedFieldForSettings.id} a mm:MultimodalQuestion ;
    rdfs:label "${selectedFieldForSettings.label}" ;
    :questionId "${selectedFieldForSettings.id}" ;
    :required ${selectedFieldForSettings.required || false} ;

    # Basic Field Properties
    mm:fieldType "text" ;
    mm:placeholder "enter the question" ;
    mm:helpText "" ;
    mm:defaultValue "" ;
    mm:uiHint "full-width" ;
    
    # Cascading Select Configuration
    mm:isDependent ${cascadingConfig?.isDependent || false} ;
    mm:parentQuestion "${cascadingConfig?.parentQuestionId || ''}" ;

    # Validation
    mm:validationRule "" ;
    mm:validationMessage "" ;
    mm:minLength 0 ;
    mm:maxLength 255 ;
    mm:pattern "" ;

    # Validation Predicates
    mm:isDigit false ;
    mm:isNumber false ;
    mm:isEmail false ;
    mm:isUKPostcode false ;
    mm:isUKDrivingLicence false ;
    mm:isVehicleReg false ;
    mm:isAlpha false ;
    mm:isAlphanumeric false ;
    mm:isDate false ;
    mm:isPhoneNumber false ;

    # TTS Configuration
    mm:ttsGrammarText "" ;
    mm:ttsLibrary "coqui-tts" ;
    mm:ttsSSML "" ;

    # ASR Configuration
    mm:asrGrammarPatterns "" ;
    mm:asrLibrary "whisper" ;
    mm:asrGrammarVariants "" ;
    mm:asrConfidenceThreshold 0.85 ;
    mm:asrLanguageModel "" ;

    # Mapping and Transformation
    mm:transformationType "none" ;
    mm:wordToFormatMapping "[]" ;
    mm:transformationScript "" ;

    # Help Content
    mm:fieldDescription "" ;
    mm:howToFill "" ;
    mm:validExamples "[]" ;
    mm:invalidExamples "[]" ;
    mm:asrHints "" ;
    mm:commonMistakes "" .
`}
                      onChange={(e) => setTtlConfig(e.target.value)}
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Edit the TTL (Turtle) format directly. Changes will be synced to the UI and JSON schema.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button color="light" onClick={() => setShowFieldSettings(false)}>
              Cancel
            </Button>
            <Button
              color="success"
              onClick={() => {
                console.log('🔍 Save Field Settings button clicked');
                console.log('🔍 selectedFieldIndex:', selectedFieldIndex);
                console.log('🔍 selectedFieldForSettings:', selectedFieldForSettings);
                console.log('🔍 Current droppedFields:', droppedFields);

                // Get updated values from form inputs
                const labelInput = document.getElementById('field-label');
                const keyInput = document.getElementById('field-key');
                const typeInput = document.getElementById('field-type');
                const placeholderInput = document.getElementById('field-placeholder');
                const requiredInput = document.getElementById('toggle-field-required');
                const minLengthInput = document.getElementById('min-length');
                const maxLengthInput = document.getElementById('max-length');

                console.log('🔍 Found DOM elements:', {
                  labelInput,
                  keyInput,
                  typeInput,
                  placeholderInput,
                  requiredInput,
                  minLengthInput,
                  maxLengthInput
                });

                const label = labelInput?.value || selectedFieldForSettings.label;
                const key = keyInput?.value || selectedFieldForSettings.id;
                const fieldType = typeInput?.value || selectedFieldForSettings.id;
                const placeholder = placeholderInput?.value || '';
                const required = requiredInput?.checked || false;
                const minLength = parseInt(minLengthInput?.value || '0');
                const maxLength = parseInt(maxLengthInput?.value || '999');

                console.log('🔍 Extracted values:', {
                  label,
                  key,
                  fieldType,
                  placeholder,
                  required,
                  minLength,
                  maxLength
                });

                // Get selected validators
                const validators = [];
                const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
                console.log('🔍 Found', checkboxes.length, 'checked checkboxes');

                checkboxes.forEach(checkbox => {
                  const labelText = checkbox.nextElementSibling?.textContent;
                  console.log('🔍 Checkbox label text:', labelText);
                  if (labelText && labelText.startsWith('is')) {
                    validators.push(labelText);
                  }
                });

                console.log('🔍 Collected validators:', validators);

                // Update the field in droppedFields array
                const updatedFields = [...droppedFields];
                if (selectedFieldIndex !== null && updatedFields[selectedFieldIndex]) {
                  console.log('🔍 Updating field at index:', selectedFieldIndex);
                  console.log('🔍 Original field:', updatedFields[selectedFieldIndex]);

                  updatedFields[selectedFieldIndex] = {
                    ...updatedFields[selectedFieldIndex],
                    id: key,
                    label: label,
                    type: fieldType,
                    placeholder: placeholder,
                    required: required,
                    validation: {
                      ...updatedFields[selectedFieldIndex].validation,
                      validators: validators,
                      minLength: minLength,
                      maxLength: maxLength
                    },
                    // Persist select options and cascading config
                    selectOptions: selectOptions,
                    cascading: cascadingConfig,
                    // Persist date component type
                    date_component: selectedFieldForSettings.date_component,
                    // Persist Email settings
                    custom_tlds: selectedFieldForSettings.type === 'email'
                      ? (document.getElementById('custom-tlds')?.value || '').split(',').map(s => s.trim()).filter(Boolean)
                      : undefined,
                    // Persist UK Licence settings
                    auto_fill_dob: selectedFieldForSettings.auto_fill_dob,
                    auto_fill_name: selectedFieldForSettings.auto_fill_name,
                    allow_document_upload: selectedFieldForSettings.allow_document_upload
                  };
                  console.log('🔍 Updated field:', updatedFields[selectedFieldIndex]);
                  setDroppedFields(updatedFields);
                  console.log('✅ Field settings saved:', updatedFields[selectedFieldIndex]);
                } else {
                  console.error('❌ Cannot save: selectedFieldIndex is null or field not found');
                  console.error('selectedFieldIndex:', selectedFieldIndex);
                  console.error('updatedFields length:', updatedFields.length);
                }

                setSuccess('Field settings saved successfully!');
                setShowFieldSettings(false);
              }}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Field Settings
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Section Modal */}
      <Modal show={showNewSectionModal} onClose={() => setShowNewSectionModal(false)} size="lg">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-blue-600" />
            Create New Section
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-section-id">Section ID</Label>
                <TextInput
                  id="new-section-id"
                  value={newSection.sectionId}
                  onChange={(e) => setNewSection({ ...newSection, sectionId: e.target.value })}
                  placeholder="e.g., personal_details"
                />
              </div>
              <div>
                <Label htmlFor="new-section-order">Order</Label>
                <TextInput
                  id="new-section-order"
                  type="number"
                  value={newSection.sectionOrder}
                  onChange={(e) => setNewSection({ ...newSection, sectionOrder: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-section-title">Title</Label>
              <TextInput
                id="new-section-title"
                value={newSection.sectionTitle}
                onChange={(e) => setNewSection({ ...newSection, sectionTitle: e.target.value })}
                placeholder="e.g., Personal Details"
              />
            </div>
            <div>
              <Label htmlFor="new-section-description">Description</Label>
              <Textarea
                id="new-section-description"
                value={newSection.sectionDescription}
                onChange={(e) => setNewSection({ ...newSection, sectionDescription: e.target.value })}
                placeholder="Describe what this section covers..."
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="new-section-type">Section Type</Label>
              <Select
                id="new-section-type"
                value={newSection.sectionType}
                onChange={(e) => setNewSection({ ...newSection, sectionType: e.target.value })}
              >
                <option value="standard">Standard</option>
                <option value="conditional">Conditional</option>
                <option value="repeatable">Repeatable</option>
                <option value="summary">Summary</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-section-aliases">Semantic Aliases (comma-separated)</Label>
              <Textarea
                id="new-section-aliases"
                value={newSection.semanticAliases}
                onChange={(e) => setNewSection({ ...newSection, semanticAliases: e.target.value })}
                placeholder="e.g., personal info, user details, about me"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="new-section-skos">SKOS Labels</Label>
              <TextInput
                id="new-section-skos"
                value={newSection.skosLabels}
                onChange={(e) => setNewSection({ ...newSection, skosLabels: e.target.value })}
                placeholder="e.g., skos:prefLabel, skos:altLabel"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-2 w-full">
            <Button color="gray" onClick={() => setShowNewSectionModal(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleCreateSection}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Create Section
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Edit Section Modal */}
      <Modal show={editingSection !== null} onClose={() => { setEditingSection(null); setEditingSectionData(null); }} size="xl">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" />
            Edit Section: {editingSectionData?.section_title || ''}
          </div>
        </ModalHeader>
        <ModalBody>
          {editingSectionData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-section-id">Section ID</Label>
                  <TextInput
                    id="edit-section-id"
                    value={editingSectionData.section_id}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Section ID cannot be changed</p>
                </div>
                <div>
                  <Label htmlFor="edit-section-order">Order</Label>
                  <TextInput
                    id="edit-section-order"
                    type="number"
                    value={editingSectionData.section_order || 1}
                    onChange={(e) => setEditingSectionData({ ...editingSectionData, section_order: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-section-title">Title</Label>
                <TextInput
                  id="edit-section-title"
                  value={editingSectionData.section_title}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, section_title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-section-description">Description</Label>
                <Textarea
                  id="edit-section-description"
                  value={editingSectionData.section_description || ''}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, section_description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="edit-section-type">Section Type</Label>
                <Select
                  id="edit-section-type"
                  value={editingSectionData.section_type || 'standard'}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, section_type: e.target.value })}
                >
                  <option value="standard">Standard</option>
                  <option value="conditional">Conditional</option>
                  <option value="repeatable">Repeatable</option>
                  <option value="summary">Summary</option>
                </Select>
              </div>

              {/* Semantic Aliases with AI Generation */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Semantic Aliases</Label>
                  <Button
                    size="xs"
                    color="purple"
                    onClick={() => handleGenerateAliases(editingSectionData.section_title, editingSectionData.section_description)}
                    disabled={generatingAliases}
                  >
                    {generatingAliases ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Tag className="w-3 h-3 mr-1" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>

                {/* Generated Aliases Selection */}
                {generatedAliases.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-2">Select aliases to include:</p>
                    <div className="flex flex-wrap gap-2">
                      {generatedAliases.map((alias, idx) => (
                        <Badge
                          key={idx}
                          color={selectedAliases[alias] ? 'success' : 'gray'}
                          className="cursor-pointer hover:opacity-80"
                          onClick={() => toggleAlias(alias)}
                        >
                          {selectedAliases[alias] ? '✓' : '+'} {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Textarea
                  id="edit-section-aliases"
                  value={editingSectionData.semantic_aliases || ''}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, semantic_aliases: e.target.value })}
                  placeholder="Enter comma-separated aliases or generate with AI"
                  rows={2}
                />
              </div>

              {/* SKOS Labels */}
              <div>
                <Label htmlFor="edit-section-skos">SKOS Labels</Label>
                <TextInput
                  id="edit-section-skos"
                  value={editingSectionData.skos_labels || ''}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, skos_labels: e.target.value })}
                  placeholder="e.g., skos:prefLabel, skos:altLabel"
                />
              </div>

              {/* OWL Relationship Info */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">OWL/SKOS Relationships</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>rdf:type:</strong> dialog:Section</p>
                  <p><strong>skos:prefLabel:</strong> {editingSectionData.section_title}</p>
                  <p><strong>dialog:hasOrder:</strong> {editingSectionData.section_order || 1}</p>
                  <p><strong>Questions in section:</strong> {questionsBySection[editingSectionData.section_id]?.length || 0}</p>
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-between w-full">
            <Button color="failure" onClick={() => handleDeleteSection(editingSectionData?.section_id)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Section
            </Button>
            <div className="flex gap-2">
              <Button color="gray" onClick={() => { setEditingSection(null); setEditingSectionData(null); }}>
                Cancel
              </Button>
              <Button color="blue" onClick={handleSaveEditedSection}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default DialogEditor;
