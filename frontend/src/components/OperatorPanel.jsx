/**
 * Enhanced Operator Panel Component
 *
 * Features:
 * - Multi-session view with user switching
 * - Flow visualization showing question progression
 * - Intervention queue for help requests and confidence errors
 * - Real-time WebSocket notifications
 * - Operator response interface for fixing slot values
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, TextInput, Badge, Table, Textarea, Label, Select, Alert } from 'flowbite-react';
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  AlertTriangle,
  User,
  Filter,
  Users,
  HelpCircle,
  Send,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Volume2,
  Headphones,
  Database
} from 'lucide-react';
import DialogFlowView from './DialogFlowView';
import FieldStatusPanel from './FieldStatusPanel';

const API_BASE_URL = '/api/admin';

const PRIORITY_COLORS = {
  CRITICAL: 'failure',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'gray'
};

const STATUS_COLORS = {
  PENDING: 'warning',
  IN_REVIEW: 'info',
  TRANSCRIBED: 'success',
  VALIDATED: 'success',
  REJECTED: 'failure',
  HELP_REQUESTED: 'purple',
  LOW_CONFIDENCE: 'warning'
};

const OperatorPanel = () => {
  const [operatorId, setOperatorId] = useState(localStorage.getItem('operatorId') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Session Management
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);

  // Intervention Queue
  const [interventionQueue, setInterventionQueue] = useState([]);
  const [selectedIntervention, setSelectedIntervention] = useState(null);

  // Review Queue (existing)
  const [reviewQueue, setReviewQueue] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);

  // Low Confidence Audio Queue
  const [audioReviewQueue, setAudioReviewQueue] = useState([]);
  const [selectedAudioReview, setSelectedAudioReview] = useState(null);
  const [audioElement, setAudioElement] = useState(null);

  // UI State
  const [activeTab, setActiveTab] = useState('sessions'); // sessions, interventions, reviews, flow
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState({
    active_sessions: 0,
    pending_interventions: 0,
    pending_reviews: 0,
    completed_today: 0
  });

  // Operator Response
  const [operatorResponse, setOperatorResponse] = useState('');
  const [correctedValue, setCorrectedValue] = useState('');
  const [operatorConfidence, setOperatorConfidence] = useState(0.95);
  const [notes, setNotes] = useState('');

  // WebSocket
  const wsRef = useRef(null);

  useEffect(() => {
    if (isLoggedIn) {
      loadStats();
      loadActiveSessions();
      loadInterventionQueue();
      loadAudioReviewQueue();
      connectWebSocket();

      const interval = setInterval(() => {
        loadStats();
        loadActiveSessions();
        loadInterventionQueue();
        loadAudioReviewQueue();
      }, 5000);

      return () => {
        clearInterval(interval);
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    }
  }, [isLoggedIn]);

  const connectWebSocket = () => {
    const wsUrl = `ws://localhost:8001/ws/operator/${operatorId}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Operator WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Operator notification:', data);

      if (data.type === 'help_request') {
        setSuccess(`Help requested by session ${data.session_id}`);
        loadInterventionQueue();
        loadStats();
      } else if (data.type === 'low_confidence') {
        setSuccess(`Low confidence detected for session ${data.session_id}`);
        loadInterventionQueue();
        loadStats();
      } else if (data.type === 'new_session') {
        loadActiveSessions();
        loadStats();
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket closed, reconnecting in 3s...');
      setTimeout(connectWebSocket, 3000);
    };
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (operatorId.trim()) {
      localStorage.setItem('operatorId', operatorId);
      setIsLoggedIn(true);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      const data = await response.json();
      setStats({
        active_sessions: data.active_sessions || 0,
        pending_interventions: data.pending_interventions || 0,
        pending_reviews: data.pending || 0,
        completed_today: data.completed_today || 0
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadActiveSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/active`);
      const data = await response.json();
      setActiveSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    }
  };

  const loadSessionDetails = async (sessionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/session/${sessionId}/details`);
      const data = await response.json();
      setSessionDetails(data);
      setSelectedSession(sessionId);
    } catch (err) {
      setError('Failed to load session details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInterventionQueue = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/interventions/queue`);
      const data = await response.json();
      setInterventionQueue(data.interventions || []);
    } catch (err) {
      console.error('Failed to load intervention queue:', err);
    }
  };

  const loadAudioReviewQueue = async () => {
    try {
      const response = await fetch('/api/operator/low-confidence-queue');
      const data = await response.json();
      setAudioReviewQueue(data || []);
    } catch (err) {
      console.error('Failed to load audio review queue:', err);
    }
  };

  const handleSelectIntervention = async (intervention) => {
    setSelectedIntervention(intervention);
    setCorrectedValue(intervention.current_value || '');
    setOperatorResponse('');
    setNotes('');

    // Load full session context
    await loadSessionDetails(intervention.session_id);
  };

  const handleSendHelp = async () => {
    if (!selectedIntervention || !operatorResponse.trim()) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/intervention/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervention_id: selectedIntervention.id,
          session_id: selectedIntervention.session_id,
          operator_id: operatorId,
          response_type: 'help',
          message: operatorResponse
        })
      });

      if (!response.ok) throw new Error('Failed to send help');

      setSuccess('Help message sent to user');
      setOperatorResponse('');
      await loadInterventionQueue();
    } catch (err) {
      setError('Failed to send help: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFixSlot = async () => {
    if (!selectedIntervention || !correctedValue.trim()) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/intervention/fix-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervention_id: selectedIntervention.id,
          session_id: selectedIntervention.session_id,
          question_id: selectedIntervention.question_id,
          slot_name: selectedIntervention.slot_name,
          corrected_value: correctedValue,
          operator_confidence: operatorConfidence,
          operator_id: operatorId,
          notes: notes
        })
      });

      if (!response.ok) throw new Error('Failed to fix slot');

      setSuccess('Slot value corrected and session updated');
      setSelectedIntervention(null);
      setCorrectedValue('');
      setNotes('');
      await loadInterventionQueue();
      await loadActiveSessions();
    } catch (err) {
      setError('Failed to fix slot: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Audio Review Handlers
  const handleSelectAudioReview = (review) => {
    setSelectedAudioReview(review);
    setCorrectedValue(review.transcript || '');
  };

  const handlePlayAudio = async (reviewId) => {
    try {
      // Pause any currently playing audio
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      // Fetch and play the audio file
      const response = await fetch(`/api/operator/audio/${reviewId}`);
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audio.play();
      setAudioElement(audio);

      // Clean up URL when audio finishes
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError('Failed to play audio recording');
    }
  };

  const handleFixAudioAnswer = async () => {
    if (!selectedAudioReview || !correctedValue.trim()) return;

    try {
      setLoading(true);

      const response = await fetch('/api/operator/fix-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: selectedAudioReview.id,
          corrected_answer: correctedValue
        })
      });

      if (!response.ok) throw new Error('Failed to fix answer');

      setSuccess('Answer corrected and session updated');
      setSelectedAudioReview(null);
      setCorrectedValue('');
      await loadAudioReviewQueue();
    } catch (err) {
      setError('Failed to fix answer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRephrase = async () => {
    if (!selectedAudioReview) return;

    try {
      setLoading(true);

      const response = await fetch('/api/operator/request-rephrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: selectedAudioReview.id,
          rephrase_message: null // Will use default template from ontology
        })
      });

      if (!response.ok) throw new Error('Failed to request rephrase');

      const data = await response.json();
      setSuccess(`Rephrase request sent: "${data.rephrase_message}"`);
      setSelectedAudioReview(null);
      await loadAudioReviewQueue();
    } catch (err) {
      setError('Failed to send rephrase request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderFlowVisualization = (session) => {
    if (!sessionDetails || !sessionDetails.flow) {
      return <p className="text-sm text-gray-500">Loading flow...</p>;
    }

    const { questions, current_index, answers } = sessionDetails.flow;

    return (
      <div className="space-y-2">
        {questions.map((question, index) => {
          const isActive = index === current_index;
          const isCompleted = index < current_index;
          const answer = answers[question.slot_name];
          const confidence = sessionDetails.confidence_scores?.[question.slot_name];

          return (
            <div
              key={question.question_id}
              className={`p-3 rounded-lg border-2 ${
                isActive
                  ? 'border-blue-500 bg-blue-50'
                  : isCompleted
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {index + 1}. {question.question_text}
                    </span>
                    {isActive && (
                      <Badge color="info" size="xs">Current</Badge>
                    )}
                    {isCompleted && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Slot: {question.slot_name}
                    {question.required && <span className="text-red-600 ml-1">*</span>}
                  </p>
                  {answer && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Answer:</span> {answer}
                      {confidence !== undefined && (
                        <Badge
                          color={confidence < 0.7 ? 'failure' : confidence < 0.85 ? 'warning' : 'success'}
                          size="xs"
                          className="ml-2"
                        >
                          {(confidence * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Operator Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="operatorId">Operator ID</Label>
              <TextInput
                id="operatorId"
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                placeholder="Enter your operator ID"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              <User className="w-4 h-4 mr-2" />
              Login
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Operator Panel</h1>
          <p className="text-gray-600 mt-1">Logged in as: {operatorId}</p>
        </div>
        <Button color="light" onClick={() => {
          loadStats();
          loadActiveSessions();
          loadInterventionQueue();
        }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          <AlertTriangle className="w-5 h-5 mr-2" />
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" onDismiss={() => setSuccess(null)}>
          <CheckCircle className="w-5 h-5 mr-2" />
          {success}
        </Alert>
      )}

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Sessions</p>
              <p className="text-2xl font-bold text-blue-600">{stats.active_sessions}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Help</p>
              <p className="text-2xl font-bold text-purple-600">{stats.pending_interventions}</p>
            </div>
            <HelpCircle className="w-8 h-8 text-purple-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Confidence</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending_reviews}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed Today</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed_today}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'sessions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Active Sessions ({activeSessions.length})
        </button>
        <button
          onClick={() => setActiveTab('interventions')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'interventions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <HelpCircle className="w-4 h-4 inline mr-2" />
          Interventions ({interventionQueue.length})
        </button>
        <button
          onClick={() => setActiveTab('audioReviews')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'audioReviews'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Headphones className="w-4 h-4 inline mr-2" />
          Audio Reviews ({audioReviewQueue.length})
        </button>
        <button
          onClick={() => setActiveTab('flow')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'flow'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Session Flow
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'fields'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Database className="w-4 h-4 inline mr-2" />
          Field States
        </button>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Session List */}
          <Card>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Active Sessions</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {activeSessions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No active sessions</p>
              ) : (
                activeSessions.map((session) => (
                  <div
                    key={session.session_id}
                    onClick={() => loadSessionDetails(session.session_id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedSession === session.session_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Session {session.session_id.substring(0, 8)}</span>
                          {session.needs_help && (
                            <Badge color="purple" size="xs">Help Requested</Badge>
                          )}
                          {session.has_low_confidence && (
                            <Badge color="warning" size="xs">Low Confidence</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Progress: {session.current_question_index + 1} of {session.total_questions}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Current: {session.current_question_text?.substring(0, 50)}...
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Started: {new Date(session.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Session Flow Visualization */}
          <Card>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Session Flow</h3>
            {!selectedSession ? (
              <div className="text-center text-gray-500 py-12">
                Select a session to view flow visualization
              </div>
            ) : sessionDetails ? (
              <div className="max-h-[600px] overflow-y-auto">
                {renderFlowVisualization(sessionDetails)}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                Loading session details...
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Interventions Tab */}
      {activeTab === 'interventions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Intervention Queue */}
          <Card>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Intervention Queue</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {interventionQueue.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No pending interventions</p>
              ) : (
                interventionQueue.map((intervention) => (
                  <div
                    key={intervention.id}
                    onClick={() => handleSelectIntervention(intervention)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedIntervention?.id === intervention.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge color={STATUS_COLORS[intervention.type]} size="xs">
                            {intervention.type === 'HELP_REQUESTED' ? 'Help' : 'Low Confidence'}
                          </Badge>
                          <span className="text-sm font-semibold">
                            Session {intervention.session_id.substring(0, 8)}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-2">{intervention.question_text}</p>
                        {intervention.current_value && (
                          <p className="text-sm text-gray-600 mt-1">
                            Answer: {intervention.current_value}
                          </p>
                        )}
                        {intervention.confidence && (
                          <Badge
                            color={intervention.confidence < 0.7 ? 'failure' : 'warning'}
                            size="xs"
                            className="mt-2"
                          >
                            Confidence: {(intervention.confidence * 100).toFixed(0)}%
                          </Badge>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(intervention.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Intervention Detail */}
          <Card>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Intervention Detail</h3>
            {!selectedIntervention ? (
              <div className="text-center text-gray-500 py-12">
                Select an intervention to respond
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Session ID</Label>
                  <p className="text-gray-700 mt-1">{selectedIntervention.session_id}</p>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Question</Label>
                  <p className="text-gray-700 mt-1">{selectedIntervention.question_text}</p>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Slot</Label>
                  <p className="text-gray-700 mt-1">{selectedIntervention.slot_name}</p>
                </div>

                {selectedIntervention.current_value && (
                  <div>
                    <Label className="text-sm font-semibold">Current Answer</Label>
                    <p className="text-gray-700 mt-1 bg-gray-100 p-2 rounded">
                      {selectedIntervention.current_value}
                    </p>
                    {selectedIntervention.confidence && (
                      <Badge
                        color={selectedIntervention.confidence < 0.7 ? 'failure' : 'warning'}
                        size="xs"
                        className="mt-2"
                      >
                        Confidence: {(selectedIntervention.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                )}

                {selectedIntervention.type === 'HELP_REQUESTED' && (
                  <div>
                    <Label htmlFor="help-response">Send Help Message</Label>
                    <Textarea
                      id="help-response"
                      value={operatorResponse}
                      onChange={(e) => setOperatorResponse(e.target.value)}
                      rows={4}
                      placeholder="Type your help message to the user..."
                    />
                    <Button
                      color="blue"
                      onClick={handleSendHelp}
                      disabled={!operatorResponse.trim() || loading}
                      className="mt-2 w-full"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Help Message
                    </Button>
                  </div>
                )}

                {selectedIntervention.type === 'LOW_CONFIDENCE' && (
                  <>
                    <div>
                      <Label htmlFor="corrected-value">Corrected Value</Label>
                      <TextInput
                        id="corrected-value"
                        value={correctedValue}
                        onChange={(e) => setCorrectedValue(e.target.value)}
                        placeholder="Enter the correct value..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="op-confidence">Operator Confidence</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <input
                          type="range"
                          id="op-confidence"
                          min="0"
                          max="1"
                          step="0.05"
                          value={operatorConfidence}
                          onChange={(e) => setOperatorConfidence(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <Badge color="info">{(operatorConfidence * 100).toFixed(0)}%</Badge>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Add any notes..."
                      />
                    </div>

                    <Button
                      color="success"
                      onClick={handleFixSlot}
                      disabled={!correctedValue.trim() || loading}
                      className="w-full"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Fix Slot & Continue Dialog
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Audio Reviews Tab */}
      {activeTab === 'audioReviews' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audio Review Queue */}
          <Card>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Low Confidence Audio Queue</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {audioReviewQueue.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No audio reviews pending</p>
              ) : (
                audioReviewQueue.map((review) => (
                  <div
                    key={review.id}
                    onClick={() => handleSelectAudioReview(review)}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedAudioReview?.id === review.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge color={review.status === 'pending' ? 'warning' : 'success'}>
                        {review.status.toUpperCase()}
                      </Badge>
                      <Badge color="info">
                        {(review.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">
                      {review.question_text}
                    </p>
                    <p className="text-sm text-gray-600">
                      Transcript: <span className="italic">"{review.transcript}"</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Session: {review.session_id.substring(0, 8)}...
                    </p>
                    {review.is_select_question && (
                      <Badge color="purple" size="sm" className="mt-2">
                        Select Question
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Audio Review Details */}
          <Card>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Review Details</h3>
            {!selectedAudioReview ? (
              <p className="text-center text-gray-500 py-8">
                Select an audio review to view details
              </p>
            ) : (
              <div className="space-y-4">
                {/* Question */}
                <div>
                  <Label className="text-gray-700 font-semibold">Question</Label>
                  <p className="text-gray-900 mt-1">{selectedAudioReview.question_text}</p>
                </div>

                {/* Audio Playback */}
                <div>
                  <Label className="text-gray-700 font-semibold mb-2">Audio Recording</Label>
                  <Button
                    color="info"
                    onClick={() => handlePlayAudio(selectedAudioReview.id)}
                    className="w-full"
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    Play Audio Recording
                  </Button>
                </div>

                {/* Transcript */}
                <div>
                  <Label className="text-gray-700 font-semibold">Speech Recognition Transcript</Label>
                  <p className="text-gray-600 italic mt-1">"{selectedAudioReview.transcript}"</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Confidence: {(selectedAudioReview.confidence * 100).toFixed(0)}%
                  </p>
                </div>

                {/* Select Options (if applicable) */}
                {selectedAudioReview.is_select_question && selectedAudioReview.select_options.length > 0 && (
                  <div>
                    <Label className="text-gray-700 font-semibold">Available Options</Label>
                    <Select
                      value={correctedValue}
                      onChange={(e) => setCorrectedValue(e.target.value)}
                      className="mt-1"
                    >
                      <option value="">Select the correct option...</option>
                      {selectedAudioReview.select_options.map((option, index) => (
                        <option key={index} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                {/* Corrected Answer */}
                <div>
                  <Label htmlFor="correctedAnswer" className="text-gray-700 font-semibold">
                    Corrected Answer
                  </Label>
                  <TextInput
                    id="correctedAnswer"
                    value={correctedValue}
                    onChange={(e) => setCorrectedValue(e.target.value)}
                    placeholder="Type or select the correct answer..."
                    className="mt-1"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-4">
                  <Button
                    color="success"
                    onClick={handleFixAudioAnswer}
                    disabled={!correctedValue.trim() || loading}
                    className="w-full"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Fix Answer & Update Session
                  </Button>

                  <Button
                    color="warning"
                    onClick={handleRequestRephrase}
                    disabled={loading}
                    className="w-full"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Request User to Rephrase
                  </Button>
                </div>

                {/* Session Info */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    <strong>Session ID:</strong> {selectedAudioReview.session_id}
                  </p>
                  <p className="text-xs text-gray-500">
                    <strong>Question ID:</strong> {selectedAudioReview.question_id}
                  </p>
                  <p className="text-xs text-gray-500">
                    <strong>Timestamp:</strong> {new Date(selectedAudioReview.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Session Flow Tab */}
      {activeTab === 'flow' && (
        <div className="mt-6">
          <DialogFlowView embedded={true} />
        </div>
      )}

      {/* Field States Tab */}
      {activeTab === 'fields' && (
        <div className="mt-6">
          <FieldStatusPanel sessionId={selectedSession} />
        </div>
      )}
    </div>
  );
};

export default OperatorPanel;
