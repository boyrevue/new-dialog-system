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
  ArrowRight
} from 'lucide-react';

const API_BASE_URL = '/api/config';

const DialogEditor = () => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [editedQuestion, setEditedQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // TTS Variants
  const [ttsVariants, setTtsVariants] = useState(['', '', '', '']);

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

  const renderFlowVisualization = () => {
    return (
      <div className="space-y-2">
        {questions.map((question, index) => {
          const isSelected = selectedQuestion?.question_id === question.question_id;
          const isEditing = editedQuestion?.question_id === question.question_id;

          return (
            <div
              key={question.question_id}
              onClick={() => handleSelectQuestion(question)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
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
                      {index + 1}. {question.question_text}
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
      <div className="space-y-6">
        {/* Basic Question Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Question Details</h3>

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
                label="Spelling Required"
              />
              <Badge color="purple" size="xs">Uses Phonetic Alphabet</Badge>
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
            <Label>TTS Variants (for Rephrase)</Label>
            <p className="text-xs text-gray-600">
              When user clicks "Rephrase Question", the system will cycle through these variants
            </p>
            {ttsVariants.map((variant, index) => (
              <div key={index}>
                <Label htmlFor={`variant-${index}`} className="text-sm">
                  Variant {index + 1} {index === 0 && '(Main)'}
                </Label>
                <Textarea
                  id={`variant-${index}`}
                  value={variant}
                  onChange={(e) => handleVariantChange(index, e.target.value)}
                  rows={2}
                  placeholder={`Variant ${index + 1}...`}
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
