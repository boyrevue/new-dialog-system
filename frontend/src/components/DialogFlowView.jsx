/**
 * DialogFlowView Component
 *
 * Visual representation of dialog flow showing:
 * - All questions in the dialog
 * - Answered questions (green checkmark)
 * - Current active question (blue highlight)
 * - Pending questions (gray)
 * - Progress bar
 */

import React, { useState, useEffect } from 'react';
import { Card, Badge, Progress } from 'flowbite-react';
import { CheckCircle2, Circle, Clock, AlertCircle, Users } from 'lucide-react';

const API_BASE_URL = '/api';

const DialogFlowView = ({ embedded = false }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    // Poll for active sessions from backend
    const pollSessions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/sessions`);
        if (!response.ok) {
          throw new Error('Failed to fetch sessions');
        }

        const data = await response.json();
        setSessions(data);

        // Set first session as selected if none selected
        if (!selectedSession && data.length > 0) {
          setSelectedSession(data[0].id);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching sessions:', err);
        setError(err.message || 'Failed to load sessions');
        setLoading(false);
      }
    };

    pollSessions();
    const interval = setInterval(pollSessions, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [selectedSession]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'active':
        return <Clock className="w-6 h-6 text-blue-500 animate-pulse" />;
      case 'pending':
        return <Circle className="w-6 h-6 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Circle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'active':
        return 'bg-blue-50 border-blue-400 ring-2 ring-blue-400';
      case 'pending':
        return 'bg-gray-50 border-gray-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const calculateProgress = (session) => {
    if (!session || !session.questions) return 0;
    const completed = session.questions.filter(q => q.status === 'completed').length;
    return (completed / session.totalQuestions) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dialog flow...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === selectedSession);

  const containerClass = embedded ? "" : "min-h-screen bg-gray-50 p-6";
  const wrapperClass = embedded ? "" : "max-w-7xl mx-auto";

  return (
    <div className={containerClass}>
      <div className={wrapperClass}>
        {/* Header - only show when not embedded */}
        {!embedded && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dialog Flow Overview</h1>
            <p className="text-gray-600">Visual representation of all active dialog sessions</p>
          </div>
        )}

        {/* Session Selector - hide label when embedded */}
        <div className="mb-6">
          {!embedded && (
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Active Sessions</span>
            </div>
          )}
          {sessions.length > 0 ? (
            <div className="flex gap-3">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.id)}
                  className={`
                    flex-1 px-4 py-3 rounded-lg border-2 transition-all
                    ${selectedSession === session.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{session.label}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {session.currentIndex} of {session.totalQuestions} questions
                    </div>
                    <div className="mt-2">
                      <Progress
                        progress={calculateProgress(session)}
                        size="sm"
                        color={calculateProgress(session) === 100 ? 'green' : 'blue'}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No active sessions. Start a dialog at the main page to see session flow.
            </div>
          )}
        </div>

        {/* Flow Visualization */}
        {currentSession && (
          <Card>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{currentSession.label}</h2>
                  <p className="text-gray-600 mt-1">
                    Progress: {currentSession.currentIndex} / {currentSession.totalQuestions} completed
                  </p>
                </div>
                <Badge color={calculateProgress(currentSession) === 100 ? 'success' : 'info'} size="lg">
                  {calculateProgress(currentSession).toFixed(0)}% Complete
                </Badge>
              </div>

              {/* Overall Progress */}
              <Progress
                progress={calculateProgress(currentSession)}
                size="lg"
                color={calculateProgress(currentSession) === 100 ? 'green' : 'blue'}
              />
            </div>

            {/* Question List */}
            <div className="space-y-3">
              {currentSession.questions.map((question, index) => (
                <div
                  key={`${question.id}-${index}`}
                  className={`
                    border-2 rounded-lg p-4 transition-all
                    ${getStatusColor(question.status)}
                  `}
                >
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(question.status)}
                    </div>

                    {/* Question Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge color="gray" size="sm">
                          Question {index + 1}
                        </Badge>
                        <Badge
                          color={
                            question.status === 'completed' ? 'success' :
                            question.status === 'active' ? 'info' :
                            question.status === 'error' ? 'failure' :
                            'gray'
                          }
                          size="sm"
                        >
                          {question.status.toUpperCase()}
                        </Badge>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {question.text}
                      </h3>

                      {question.status === 'completed' && question.answer && (
                        <div className="mt-3 bg-white border border-green-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-900">Answer:</span>
                          </div>
                          <p className="text-gray-900 font-medium">{question.answer}</p>
                        </div>
                      )}

                      {question.status === 'active' && (
                        <div className="mt-3 bg-blue-100 border border-blue-300 rounded-lg p-3">
                          <p className="text-sm text-blue-900 font-medium">
                            🔵 Currently answering this question...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DialogFlowView;
