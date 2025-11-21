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
  CheckCircle,
  TestTube2
} from 'lucide-react';
import FormASRTester from './FormASRTester';

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
            <button
              onClick={() => setActiveTab('field-asr')}
              className={`${
                activeTab === 'field-asr'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <TestTube2 className="w-4 h-4" />
              Field ASR Tester
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
            <div className="space-y-6">
              {!selectedOntology ? (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Ontology Files</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {ontologies.map((ont) => (
                      <Card
                        key={ont.type}
                        className={`cursor-pointer transition-all hover:shadow-lg ${
                          !ont.exists ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                        }`}
                        onClick={() => ont.exists && loadOntologyContent(ont.type)}
                      >
                        <div className="flex flex-col items-center text-center space-y-3 p-2">
                          <div className={`p-4 rounded-full ${
                            ont.exists ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <FileText className={`w-8 h-8 ${
                              ont.exists ? 'text-blue-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1 w-full">
                            <h4 className="font-semibold text-gray-900 mb-1 capitalize">
                              {ont.type.replace('_', ' ')}
                            </h4>
                            <p className="text-xs text-gray-500 font-mono break-all">
                              {ont.filename}
                            </p>
                          </div>
                          {ont.exists ? (
                            <Badge color="success" className="w-full">
                              Available
                            </Badge>
                          ) : (
                            <Badge color="failure" className="w-full">
                              Missing
                            </Badge>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setSelectedOntology(null)}
                      >
                        ← Back to Files
                      </Button>
                      <div>
                        <h3 className="text-xl font-semibold">{selectedOntology.filename}</h3>
                        <p className="text-sm text-gray-600">
                          {selectedOntology.line_count} lines
                        </p>
                      </div>
                    </div>
                    <Button color="success" onClick={saveOntology} disabled={loading}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>

                  <Card>
                    <Textarea
                      value={ontologyContent}
                      onChange={(e) => setOntologyContent(e.target.value)}
                      rows={24}
                      className="font-mono text-sm"
                    />
                  </Card>

                  <Alert color="info" className="mt-4">
                    <p className="text-sm">
                      <strong>Note:</strong> A backup will be created before saving.
                      Changes will take effect after server restart.
                    </p>
                  </Alert>
                </div>
              )}
            </div>
          )}

          {activeTab === 'system' && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">System Information</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Dialog Server:</strong>{' '}
                  <a
                    href="http://localhost:8000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    http://localhost:8000
                  </a>
                </p>
                <p>
                  <strong>Admin Panel:</strong>{' '}
                  <a
                    href="http://localhost:8001"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    http://localhost:8001
                  </a>
                </p>
                <p>
                  <strong>Config Panel:</strong>{' '}
                  <a
                    href="http://localhost:8002"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    http://localhost:8002
                  </a>
                </p>
                <p><strong>Ontologies:</strong> {ontologies.length} files</p>
                <p><strong>Questions:</strong> {questions.length} configured</p>
              </div>
            </Card>
          )}

          {activeTab === 'field-asr' && (
            <div className="-m-6">
              <FormASRTester />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ConfigPanel;
