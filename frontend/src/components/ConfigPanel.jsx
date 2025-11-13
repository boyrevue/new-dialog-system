/**
 * Configuration Panel Component
 *
 * Admin panel for viewing and editing:
 * - Dialog questions with TTS/ASR settings
 * - OWL/SHACL ontologies
 * - System configuration
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, TextInput, Textarea, Label, Select, Badge, Alert } from 'flowbite-react';
import {
  Settings,
  FileText,
  Mic,
  Volume2,
  Code,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const API_BASE_URL = '/api/config';

const ConfigPanel = () => {
  const [activeTab, setActiveTab] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [ontologies, setOntologies] = useState([]);
  const [selectedOntology, setSelectedOntology] = useState(null);
  const [ontologyContent, setOntologyContent] = useState('');
  const [asrConfig, setAsrConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadQuestions();
    loadOntologies();
    loadASRConfig();
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

  const loadOntologies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/ontologies`);
      const data = await response.json();
      setOntologies(data.ontologies || []);
    } catch (err) {
      setError('Failed to load ontologies: ' + err.message);
    }
  };

  const loadOntologyContent = async (ontologyType) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/ontology/${ontologyType}`);
      const data = await response.json();
      setOntologyContent(data.content);
      setSelectedOntology(data);
    } catch (err) {
      setError('Failed to load ontology content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveOntology = async () => {
    if (!selectedOntology) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/ontology/${selectedOntology.ontology_type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ontology_type: selectedOntology.ontology_type,
          content: ontologyContent
        })
      });

      if (!response.ok) throw new Error('Failed to save ontology');

      const data = await response.json();
      setSuccess('Ontology saved successfully! Backup created at: ' + data.backup_created);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to save ontology: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadASRConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/asr`);
      const data = await response.json();
      setAsrConfig(data);
    } catch (err) {
      setError('Failed to load ASR config: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dialog Configuration</h1>
          <p className="text-gray-600 mt-1">Manage TTS, ASR, and ontology configurations</p>
        </div>
        <Button color="light" onClick={() => {
          loadQuestions();
          loadOntologies();
          loadASRConfig();
        }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

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

      <Card>
        {/* Simple Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('questions')}
              className={`${
                activeTab === 'questions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Volume2 className="w-4 h-4" />
              Questions & TTS
            </button>
            <button
              onClick={() => setActiveTab('asr')}
              className={`${
                activeTab === 'asr'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Mic className="w-4 h-4" />
              ASR Settings
            </button>
            <button
              onClick={() => setActiveTab('ontologies')}
              className={`${
                activeTab === 'ontologies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Code className="w-4 h-4" />
              Ontologies
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`${
                activeTab === 'system'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Settings className="w-4 h-4" />
              System
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'questions' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Dialog Questions</h2>
              {loading && <p>Loading...</p>}
              {questions.map((q, idx) => (
                <Card key={idx}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{q.question_text}</h3>
                        <div className="flex gap-2 mt-2">
                          <Badge color="info">{q.question_id}</Badge>
                          <Badge color="gray">{q.slot_name}</Badge>
                          {q.required && <Badge color="failure">Required</Badge>}
                        </div>
                      </div>
                      <Badge color={q.confidence_threshold < 0.7 ? 'failure' : q.confidence_threshold < 0.85 ? 'warning' : 'success'}>
                        Threshold: {(q.confidence_threshold * 100).toFixed(0)}%
                      </Badge>
                    </div>

                    {q.tts && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-blue-900">TTS Configuration</span>
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p><strong>Text:</strong> {q.tts.text}</p>
                          <p><strong>Voice:</strong> {q.tts.voice || 'Default'}</p>
                          <p><strong>Rate:</strong> {q.tts.rate || 1.0}x | <strong>Pitch:</strong> {q.tts.pitch || 1.0}</p>
                        </div>
                      </div>
                    )}

                    {q.faqs && q.faqs.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="font-semibold text-sm mb-2">FAQs ({q.faqs.length})</p>
                        {q.faqs.map((faq, i) => (
                          <div key={i} className="text-sm bg-gray-50 p-2 rounded mb-2">
                            <p className="font-semibold">Q: {faq.question}</p>
                            <p className="text-gray-600">A: {faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'asr' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Speech Recognition Configuration</h2>
              {asrConfig && (
                <Card>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="asr-lang">Language</Label>
                      <Select id="asr-lang" value={asrConfig.language}>
                        {asrConfig.supported_languages?.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={asrConfig.continuous}
                          className="rounded"
                        />
                        <span>Continuous Recognition</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={asrConfig.interim_results}
                          className="rounded"
                        />
                        <span>Show Interim Results</span>
                      </label>
                    </div>

                    <div>
                      <Label>Max Alternatives: {asrConfig.max_alternatives}</Label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={asrConfig.max_alternatives}
                        className="w-full"
                      />
                    </div>

                    <Button color="blue">
                      <Save className="w-4 h-4 mr-2" />
                      Save ASR Configuration
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'ontologies' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Ontology Files</h3>
                <div className="space-y-2">
                  {ontologies.map((ont) => (
                    <Button
                      key={ont.type}
                      color={selectedOntology?.ontology_type === ont.type ? 'blue' : 'light'}
                      onClick={() => ont.exists && loadOntologyContent(ont.type)}
                      className="w-full justify-start"
                      disabled={!ont.exists}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{ont.type}</div>
                        <div className="text-xs opacity-75">{ont.filename}</div>
                      </div>
                      {!ont.exists && <Badge color="failure">Missing</Badge>}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                {selectedOntology ? (
                  <Card>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedOntology.filename}</h3>
                          <p className="text-sm text-gray-600">
                            {selectedOntology.line_count} lines
                          </p>
                        </div>
                        <Button color="success" onClick={saveOntology} disabled={loading}>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>

                      <Textarea
                        value={ontologyContent}
                        onChange={(e) => setOntologyContent(e.target.value)}
                        rows={20}
                        className="font-mono text-sm"
                      />

                      <Alert color="info">
                        <p className="text-sm">
                          <strong>Note:</strong> A backup will be created before saving.
                          Changes will take effect after server restart.
                        </p>
                      </Alert>
                    </div>
                  </Card>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    Select an ontology file to view and edit
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">System Information</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Dialog Server:</strong> http://localhost:8000</p>
                <p><strong>Admin Panel:</strong> http://localhost:8001</p>
                <p><strong>Config Panel:</strong> http://localhost:8002</p>
                <p><strong>Ontologies:</strong> {ontologies.length} files</p>
                <p><strong>Questions:</strong> {questions.length} configured</p>
              </div>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ConfigPanel;
