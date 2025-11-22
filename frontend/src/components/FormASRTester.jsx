/**
 * Form ASR Tester Component
 *
 * Live testing canvas for form fields with ASR grammar generation
 * - Drag & drop form fields
 * - Auto-generate ASR grammars
 * - Test speech recognition in real-time
 * - Visual pattern display
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, TextInput, Textarea, Label, Select, Badge, Alert, ToggleSwitch } from 'flowbite-react';
import {
  Play,
  Pause,
  Mic,
  Volume2,
  RefreshCw,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Type,
  Hash,
  Mail,
  Phone,
  Calendar,
  List,
  Plus,
  Trash2,
  Code,
  Save,
  Edit3,
  Copy
} from 'lucide-react';

const API_BASE_URL = '/api/config';

const FIELD_TYPES = [
  { icon: Type, label: 'Text Input', type: 'text', color: 'blue' },
  { icon: Hash, label: 'Number', type: 'number', color: 'green' },
  { icon: Mail, label: 'Email', type: 'email', color: 'purple' },
  { icon: Phone, label: 'Phone', type: 'tel', color: 'orange' },
  { icon: Calendar, label: 'Date', type: 'date', color: 'red' },
  { icon: List, label: 'Select List', type: 'select', color: 'indigo' }
];

const FormASRTester = () => {
  const [canvasFields, setCanvasFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [asrGrammars, setAsrGrammars] = useState({});
  const [selectedPatterns, setSelectedPatterns] = useState({}); // { fieldId: { patternIndex: boolean } }
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidenceScore] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [jsgfEditing, setJsgfEditing] = useState({}); // { fieldId: { isEditing: boolean, content: string } }

  // Generate JSGF format from patterns
  const generateJSGF = (fieldId, fieldLabel, patterns) => {
    const grammarName = fieldLabel.replace(/\s+/g, '_').toLowerCase();
    const selectedPats = patterns.filter((_, idx) => selectedPatterns[fieldId]?.[idx] !== false);

    let jsgf = `#JSGF V1.0;\n\n`;
    jsgf += `grammar ${grammarName};\n\n`;
    jsgf += `// Generated JSGF Grammar for: ${fieldLabel}\n`;
    jsgf += `// Patterns: ${selectedPats.length}\n\n`;

    // Convert patterns to JSGF rules
    selectedPats.forEach((pattern, idx) => {
      // Convert <answer> placeholder to JSGF syntax
      const jsgfPattern = pattern
        .replace(/<answer>/g, '<ANSWER>')
        .replace(/\?/g, '')
        .replace(/\./g, '');
      jsgf += `public <rule_${idx + 1}> = ${jsgfPattern};\n`;
    });

    jsgf += `\n// Main entry point\n`;
    jsgf += `public <${grammarName}> = ${selectedPats.map((_, idx) => `<rule_${idx + 1}>`).join(' | ')};\n`;

    return jsgf;
  };

  // Copy JSGF to clipboard
  const copyJSGF = (jsgfContent) => {
    navigator.clipboard.writeText(jsgfContent);
    setSuccess('JSGF grammar copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  // Toggle JSGF editing mode
  const toggleJsgfEditing = (fieldId, patterns, fieldLabel) => {
    if (jsgfEditing[fieldId]?.isEditing) {
      setJsgfEditing({ ...jsgfEditing, [fieldId]: { isEditing: false, content: '' } });
    } else {
      const jsgf = generateJSGF(fieldId, fieldLabel, patterns);
      setJsgfEditing({ ...jsgfEditing, [fieldId]: { isEditing: true, content: jsgf } });
    }
  };

  // Update JSGF content
  const updateJsgfContent = (fieldId, content) => {
    setJsgfEditing({ ...jsgfEditing, [fieldId]: { ...jsgfEditing[fieldId], content } });
  };

  // Save JSGF grammar
  const saveJsgfGrammar = async (field) => {
    const jsgfContent = jsgfEditing[field.id]?.content;
    if (!jsgfContent) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/save-jsgf-grammar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_id: field.id.toString(),
          field_label: field.label,
          jsgf_content: jsgfContent
        })
      });

      if (!response.ok) throw new Error('Failed to save JSGF grammar');

      const data = await response.json();
      setSuccess(`JSGF grammar saved to ${data.file_path}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Speech recognition
  const recognitionRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';

      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcriptText = result[0].transcript;
        const confidenceScore = result[0].confidence;

        setTranscript(transcriptText);
        setConfidenceScore(confidenceScore);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setError('Speech recognition not supported in this browser');
    }
  }, []);

  // Load saved grammars on mount
  useEffect(() => {
    loadSavedGrammars();
  }, []);

  const loadSavedGrammars = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/asr-grammars`);
      if (!response.ok) return;

      const data = await response.json();
      console.log('📥 Loaded saved grammars:', data.count);

      // Auto-restore saved grammars
      if (data.grammars && data.grammars.length > 0) {
        setSuccess(`📥 Found ${data.grammars.length} saved grammar(s). Click fields to reload them.`);
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.log('No saved grammars found:', err);
    }
  };

  // Load saved grammar for a field
  const loadSavedGrammarForField = async (fieldId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/asr-grammar/${fieldId}`);
      if (!response.ok) return null;

      const grammarData = await response.json();
      console.log('📖 Loaded saved grammar for field:', grammarData.field_label);

      return grammarData;
    } catch (err) {
      console.log('No saved grammar for field:', fieldId);
      return null;
    }
  };

  // Add field to canvas
  const addField = async (fieldType) => {
    const fieldId = Date.now();
    const newField = {
      id: fieldId,
      type: fieldType.type,
      label: fieldType.label,
      questionText: `What is your ${fieldType.label.toLowerCase()}?`,
      ttsVariants: [
        `What is your ${fieldType.label.toLowerCase()}?`,
        `Please provide your ${fieldType.label.toLowerCase()}.`,
        `I need your ${fieldType.label.toLowerCase()}.`
      ],
      required: true,
      hasGrammar: false
    };

    setCanvasFields([...canvasFields, newField]);
    setSelectedField(fieldId);

    // Try to load saved grammar for this field
    const savedGrammar = await loadSavedGrammarForField(fieldId.toString());
    if (savedGrammar) {
      // Restore the grammar
      const grammarObj = {
        patterns: savedGrammar.selected_patterns,
        confidence: savedGrammar.confidence,
        grammar: savedGrammar.grammar
      };

      setAsrGrammars({
        ...asrGrammars,
        [fieldId]: grammarObj
      });

      // Restore pattern selections
      const patternSelection = {};
      savedGrammar.selected_patterns.forEach((_, index) => {
        patternSelection[index] = true;
      });
      setSelectedPatterns({
        ...selectedPatterns,
        [fieldId]: patternSelection
      });

      // Update field with saved grammar info
      setCanvasFields(prev => prev.map(f =>
        f.id === fieldId ? {
          ...f,
          hasGrammar: true,
          savedGrammar: grammarObj,
          lastSaved: savedGrammar.saved_at,
          questionText: savedGrammar.question_text,
          ttsVariants: savedGrammar.tts_variants
        } : f
      ));

      setSuccess(`✅ Restored saved grammar for ${fieldType.label} (${savedGrammar.selected_count} patterns)`);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Generate ASR grammar for a field
  const generateGrammarForField = async (field) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/generate-asr-grammar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: field.questionText,
          ttsVariants: field.ttsVariants,
          fieldLabel: field.label
        })
      });

      if (!response.ok) throw new Error('Failed to generate ASR grammar');

      const data = await response.json();

      setAsrGrammars({
        ...asrGrammars,
        [field.id]: data
      });

      // Initialize all patterns as selected by default
      const patternSelection = {};
      data.patterns?.forEach((_, index) => {
        patternSelection[index] = true;
      });
      setSelectedPatterns({
        ...selectedPatterns,
        [field.id]: patternSelection
      });

      // Update field to mark it has grammar
      setCanvasFields(canvasFields.map(f =>
        f.id === field.id ? { ...f, hasGrammar: true } : f
      ));

      setSuccess(`✅ Generated ${data.patterns?.length || 0} ASR patterns for ${field.label}`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate grammars for all fields
  const generateAllGrammars = async () => {
    for (const field of canvasFields) {
      await generateGrammarForField(field);
    }
  };

  // Start/stop listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not available');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setConfidenceScore(0);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Toggle pattern selection
  const togglePattern = (fieldId, patternIndex) => {
    setSelectedPatterns({
      ...selectedPatterns,
      [fieldId]: {
        ...selectedPatterns[fieldId],
        [patternIndex]: !selectedPatterns[fieldId]?.[patternIndex]
      }
    });
  };

  // Select/deselect all patterns for a field
  const toggleAllPatterns = (fieldId, selectAll) => {
    const grammar = asrGrammars[fieldId];
    if (!grammar) return;

    const patternSelection = {};
    grammar.patterns?.forEach((_, index) => {
      patternSelection[index] = selectAll;
    });

    setSelectedPatterns({
      ...selectedPatterns,
      [fieldId]: patternSelection
    });
  };

  // Get selected pattern count
  const getSelectedCount = (fieldId) => {
    const selections = selectedPatterns[fieldId] || {};
    return Object.values(selections).filter(Boolean).length;
  };

  // Save grammar for a field
  const saveGrammar = async (field) => {
    setIsSaving(true);
    setError(null);

    try {
      const grammar = asrGrammars[field.id];
      const selections = selectedPatterns[field.id] || {};

      // Get only selected patterns
      const selectedPatternsList = grammar.patterns?.filter((_, idx) => selections[idx]) || [];

      if (selectedPatternsList.length === 0) {
        throw new Error('Please select at least one pattern to save');
      }

      console.log('💾 Saving grammar for field:', field.label);
      console.log('📊 Selected patterns:', selectedPatternsList.length, '/', grammar.patterns?.length);
      console.log('📝 Patterns:', selectedPatternsList);

      // Save to backend
      const response = await fetch(`${API_BASE_URL}/save-asr-grammar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_id: field.id.toString(),
          field_label: field.label,
          field_type: field.type,
          question_text: field.questionText,
          tts_variants: field.ttsVariants,
          selected_patterns: selectedPatternsList,
          total_patterns: grammar.patterns?.length || 0,
          confidence: grammar.confidence,
          grammar: grammar.grammar
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save grammar');
      }

      const savedData = await response.json();

      // Build final grammar with only selected patterns
      const finalGrammar = {
        ...grammar,
        patterns: selectedPatternsList,
        selectedCount: selectedPatternsList.length,
        totalCount: grammar.patterns?.length || 0,
        savedAt: savedData.saved_at,
        filePath: savedData.file_path
      };

      // Update field with saved grammar info
      setCanvasFields(canvasFields.map(f =>
        f.id === field.id ? {
          ...f,
          hasGrammar: true,
          savedGrammar: finalGrammar,
          lastSaved: savedData.saved_at
        } : f
      ));

      setSuccess(`✅ Saved ${selectedPatternsList.length} patterns for ${field.label} to backend`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete field
  const deleteField = (fieldId) => {
    setCanvasFields(canvasFields.filter(f => f.id !== fieldId));
    if (selectedField === fieldId) {
      setSelectedField(null);
    }
    // Remove grammar
    const newGrammars = { ...asrGrammars };
    delete newGrammars[fieldId];
    setAsrGrammars(newGrammars);

    // Remove pattern selections
    const newSelections = { ...selectedPatterns };
    delete newSelections[fieldId];
    setSelectedPatterns(newSelections);
  };

  // Update field
  const updateField = (fieldId, updates) => {
    setCanvasFields(canvasFields.map(f =>
      f.id === fieldId ? { ...f, ...updates, hasGrammar: false } : f
    ));
  };

  const getFieldIcon = (type) => {
    const fieldType = FIELD_TYPES.find(ft => ft.type === type);
    return fieldType ? fieldType.icon : Type;
  };

  const getFieldColor = (type) => {
    const fieldType = FIELD_TYPES.find(ft => ft.type === type);
    return fieldType ? fieldType.color : 'gray';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Field Palette */}
      <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Fields</h2>
          <p className="text-sm text-gray-600">Drag fields to canvas or click to add</p>
        </div>

        <div className="space-y-3">
          {FIELD_TYPES.map((fieldType) => {
            const Icon = fieldType.icon;
            return (
              <button
                key={fieldType.type}
                onClick={() => addField(fieldType)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 border-${fieldType.color}-200 bg-${fieldType.color}-50 hover:bg-${fieldType.color}-100 hover:border-${fieldType.color}-300 transition-all cursor-pointer`}
              >
                <Icon className={`w-6 h-6 text-${fieldType.color}-600`} />
                <div className="flex-1 text-left">
                  <p className={`font-semibold text-${fieldType.color}-900`}>{fieldType.label}</p>
                  <p className="text-xs text-gray-600">{fieldType.type}</p>
                </div>
                <Plus className="w-5 h-5 text-gray-400" />
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 space-y-2">
          <Button
            onClick={generateAllGrammars}
            disabled={canvasFields.length === 0 || isGenerating}
            className="w-full"
            color="purple"
          >
            <Sparkles className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Generate All ASR Grammars
          </Button>
          <Button
            onClick={loadSavedGrammars}
            className="w-full"
            color="light"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Saved Grammars
          </Button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Form ASR Testing Canvas</h1>
              <p className="text-sm text-gray-600">Build forms and test ASR grammar generation</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="info">{canvasFields.length} fields</Badge>
              <Badge color="success">
                {Object.keys(asrGrammars).length} with ASR
              </Badge>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="p-4">
          {error && (
            <Alert color="failure" className="mb-2" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert color="success" className="mb-2" onDismiss={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {canvasFields.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Fields Yet</h3>
                <p className="text-gray-600 mb-4">
                  Click a field type from the left sidebar to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {canvasFields.map((field) => {
                const Icon = getFieldIcon(field.type);
                const color = getFieldColor(field.type);
                const grammar = asrGrammars[field.id];

                return (
                  <Card
                    key={field.id}
                    className={`border-2 ${selectedField === field.id ? `border-${color}-400` : 'border-gray-200'}`}
                  >
                    {/* Field Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-${color}-100`}>
                          <Icon className={`w-5 h-5 text-${color}-600`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{field.label}</h4>
                          <p className="text-xs text-gray-500">{field.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {field.hasGrammar && (
                          <Badge color="success" size="sm">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            ASR Ready
                          </Badge>
                        )}
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => deleteField(field.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="mb-3">
                      <Label className="text-xs">Question Text</Label>
                      <TextInput
                        value={field.questionText}
                        onChange={(e) => updateField(field.id, { questionText: e.target.value })}
                        size="sm"
                      />
                    </div>

                    {/* TTS Variants */}
                    <div className="mb-3">
                      <Label className="text-xs">TTS Variants ({field.ttsVariants.length})</Label>
                      <div className="space-y-1">
                        {field.ttsVariants.map((variant, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Volume2 className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-700">{variant}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="xs"
                        color="purple"
                        onClick={() => generateGrammarForField(field)}
                        disabled={isGenerating}
                      >
                        <Sparkles className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                        Generate ASR
                      </Button>
                    </div>

                    {/* Grammar Preview with Checkboxes */}
                    {grammar && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-green-700">
                            ASR Patterns ({getSelectedCount(field.id)}/{grammar.patterns?.length || 0} selected)
                          </span>
                          <Badge color="success" size="xs">
                            {(grammar.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>

                        {/* Select All / Deselect All */}
                        <div className="flex gap-2 mb-2">
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => toggleAllPatterns(field.id, true)}
                          >
                            Select All
                          </Button>
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => toggleAllPatterns(field.id, false)}
                          >
                            Deselect All
                          </Button>
                          <Button
                            size="xs"
                            color="success"
                            onClick={() => saveGrammar(field)}
                            disabled={isSaving || getSelectedCount(field.id) === 0}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Save Grammar
                          </Button>
                        </div>

                        <div className="max-h-64 overflow-y-auto bg-gray-50 rounded p-2 space-y-1">
                          {grammar.patterns?.map((pattern, idx) => {
                            const isSelected = selectedPatterns[field.id]?.[idx] !== false;
                            return (
                              <label
                                key={idx}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-green-100 border border-green-300'
                                    : 'bg-white border border-gray-200 opacity-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePattern(field.id, idx)}
                                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                />
                                <code className={`text-xs flex-1 ${
                                  isSelected ? 'text-green-900 font-medium' : 'text-gray-500'
                                }`}>
                                  {pattern}
                                </code>
                              </label>
                            );
                          })}
                        </div>

                        {/* Generated JSGF Grammar Section */}
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Code className="w-4 h-4 text-purple-600" />
                              <span className="text-xs font-semibold text-purple-700">Generated JSGF Grammar</span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="xs"
                                color="purple"
                                onClick={() => toggleJsgfEditing(field.id, grammar.patterns, field.label)}
                              >
                                {jsgfEditing[field.id]?.isEditing ? (
                                  <>Hide JSGF</>
                                ) : (
                                  <><Code className="w-3 h-3 mr-1" />View/Edit JSGF</>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* JSGF Editor */}
                          {jsgfEditing[field.id]?.isEditing && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1 mb-1">
                                <Badge color="purple" size="xs">JSGF Format</Badge>
                                <Badge color="gray" size="xs">Editable</Badge>
                              </div>
                              <Textarea
                                value={jsgfEditing[field.id]?.content || ''}
                                onChange={(e) => updateJsgfContent(field.id, e.target.value)}
                                rows={10}
                                className="font-mono text-xs bg-gray-900 text-green-400"
                                style={{ fontFamily: 'monospace' }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="xs"
                                  color="success"
                                  onClick={() => saveJsgfGrammar(field)}
                                  disabled={isSaving}
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  Save JSGF
                                </Button>
                                <Button
                                  size="xs"
                                  color="light"
                                  onClick={() => copyJSGF(jsgfEditing[field.id]?.content)}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                                <Button
                                  size="xs"
                                  color="light"
                                  onClick={() => {
                                    const jsgf = generateJSGF(field.id, field.label, grammar.patterns);
                                    updateJsgfContent(field.id, jsgf);
                                  }}
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Regenerate
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Saved Info */}
                        {field.savedGrammar && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-blue-600" />
                                <span className="text-xs text-blue-700">
                                  Saved {field.savedGrammar.selectedCount} patterns at{' '}
                                  {new Date(field.lastSaved).toLocaleTimeString()}
                                </span>
                              </div>
                              <Badge color="info" size="xs">Persisted</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Live ASR Testing */}
      <div className="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Live ASR Testing</h2>
          <p className="text-sm text-gray-600">Test speech recognition in real-time</p>
        </div>

        {/* Microphone Button */}
        <div className="mb-6">
          <Button
            onClick={toggleListening}
            className="w-full h-32"
            color={isListening ? 'failure' : 'success'}
            size="xl"
          >
            <div className="flex flex-col items-center gap-2">
              <Mic className={`w-12 h-12 ${isListening ? 'animate-pulse' : ''}`} />
              <span className="text-lg font-bold">
                {isListening ? 'Stop Listening' : 'Start Listening'}
              </span>
            </div>
          </Button>
        </div>

        {/* Transcript Display */}
        <Card className={isListening ? 'border-2 border-green-400' : ''}>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <Label>Transcript</Label>
              {isListening && (
                <Badge color="success" size="sm">
                  <Mic className="w-3 h-3 mr-1 animate-pulse" />
                  Listening...
                </Badge>
              )}
            </div>
            <Textarea
              value={transcript}
              readOnly
              rows={4}
              placeholder="Your speech will appear here..."
              className="font-mono"
            />
          </div>

          {/* Confidence Score */}
          {confidence > 0 && (
            <div className="mb-3">
              <Label>Confidence Score</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      confidence > 0.7 ? 'bg-green-500' :
                      confidence > 0.5 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Pattern Matching - Only shows selected patterns */}
        {transcript && Object.keys(asrGrammars).length > 0 && (
          <Card className="mt-4 border-2 border-blue-200">
            <h4 className="font-bold text-gray-900 mb-3">Pattern Matching (Selected Patterns Only)</h4>
            {canvasFields.map((field) => {
              const grammar = asrGrammars[field.id];
              const selections = selectedPatterns[field.id] || {};
              if (!grammar) return null;

              // Only check selected patterns
              const selectedPatternsList = grammar.patterns?.filter((_, idx) => selections[idx] !== false) || [];

              const transcriptLower = transcript.toLowerCase();
              const matchingPatterns = selectedPatternsList.filter(pattern => {
                const patternRegex = pattern.replace('<answer>', '(.+)');
                return new RegExp(patternRegex, 'i').test(transcriptLower);
              });

              return (
                <div key={field.id} className="mb-3 pb-3 border-b border-gray-200 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{field.label}</span>
                    {matchingPatterns.length > 0 ? (
                      <Badge color="success" size="sm">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {matchingPatterns.length} matches
                      </Badge>
                    ) : (
                      <Badge color="gray" size="sm">
                        No match
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    Testing against {selectedPatternsList.length} selected patterns
                  </div>
                  {matchingPatterns.length > 0 && (
                    <div className="space-y-1">
                      {matchingPatterns.slice(0, 3).map((pattern, idx) => (
                        <div key={idx} className="text-xs font-mono text-green-700 bg-green-50 rounded px-2 py-1">
                          ✓ {pattern}
                        </div>
                      ))}
                      {matchingPatterns.length > 3 && (
                        <div className="text-xs text-gray-500 italic px-2">
                          + {matchingPatterns.length - 3} more matches
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
};

export default FormASRTester;
