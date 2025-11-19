/**
 * Operator Review Queue Component
 *
 * Displays low-confidence ASR recordings for operator review
 * - Shows pending review items with audio playback
 * - Allows operators to correct transcriptions
 * - Marks items as resolved
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, TextInput, Badge, Alert } from 'flowbite-react';
import {
  Volume2,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  RefreshCw,
  Play,
  Pause
} from 'lucide-react';

const API_BASE_URL = '/api/config';

const OperatorReviewQueue = () => {
  const [reviewItems, setReviewItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [corrections, setCorrections] = useState({});
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioRefs = useRef({});

  // Fetch review queue items
  const fetchReviewQueue = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/review-queue?status=pending`);
      if (!response.ok) throw new Error('Failed to fetch review queue');

      const data = await response.json();
      setReviewItems(data.items || []);

      // Initialize corrections state
      const initialCorrections = {};
      data.items.forEach(item => {
        initialCorrections[item.review_id] = item.user_answer || '';
      });
      setCorrections(initialCorrections);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resolve a review item
  const resolveItem = async (reviewId) => {
    try {
      const correction = corrections[reviewId];

      const response = await fetch(`${API_BASE_URL}/review-queue/${reviewId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_correction: correction,
          reviewed_by: 'operator'
        })
      });

      if (!response.ok) throw new Error('Failed to resolve item');

      setSuccess(`✅ Review item resolved successfully!`);

      // Remove from pending list
      setReviewItems(items => items.filter(item => item.review_id !== reviewId));

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err.message);
    }
  };

  // Play/pause audio
  const toggleAudio = (reviewId) => {
    const audio = audioRefs.current[reviewId];
    if (!audio) return;

    if (playingAudio === reviewId) {
      audio.pause();
      setPlayingAudio(null);
    } else {
      // Pause any currently playing audio
      Object.values(audioRefs.current).forEach(a => a?.pause());

      audio.play();
      setPlayingAudio(reviewId);
    }
  };

  // Create audio element for WAV data
  const createAudioElement = (reviewId, audioData) => {
    if (!audioData || audioRefs.current[reviewId]) return;

    const audio = new Audio(`data:audio/wav;base64,${audioData}`);
    audio.onended = () => setPlayingAudio(null);
    audioRefs.current[reviewId] = audio;
  };

  // Load queue on mount
  useEffect(() => {
    fetchReviewQueue();

    // Poll for new items every 30 seconds
    const interval = setInterval(fetchReviewQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  // Create audio elements when items load
  useEffect(() => {
    reviewItems.forEach(item => {
      if (item.audio_data) {
        createAudioElement(item.review_id, item.audio_data);
      }
    });
  }, [reviewItems]);

  // Get confidence badge color
  const getConfidenceBadgeColor = (score) => {
    if (score >= 0.7) return 'warning';
    if (score >= 0.5) return 'failure';
    return 'failure';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            Operator Review Queue
          </h1>
          <p className="text-gray-600 mt-2">
            Review low-confidence ASR transcriptions and provide corrections
          </p>
        </div>

        <Button
          color="light"
          onClick={fetchReviewQueue}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Reviews</p>
              <p className="text-3xl font-bold text-orange-600">{reviewItems.length}</p>
            </div>
            <Clock className="w-10 h-10 text-orange-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Confidence</p>
              <p className="text-3xl font-bold text-gray-900">
                {reviewItems.length > 0
                  ? (reviewItems.reduce((sum, item) => sum + (item.confidence_score || 0), 0) / reviewItems.length * 100).toFixed(0)
                  : 0
                }%
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-yellow-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Oldest Item</p>
              <p className="text-xl font-bold text-gray-900">
                {reviewItems.length > 0 && reviewItems[reviewItems.length - 1]?.timestamp
                  ? new Date(reviewItems[reviewItems.length - 1].timestamp).toLocaleTimeString()
                  : 'N/A'
                }
              </p>
            </div>
            <Clock className="w-10 h-10 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Alerts */}
      {error && (
        <Alert color="failure" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" className="mb-4" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Review Items */}
      {reviewItems.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">All Clear!</h3>
            <p className="text-gray-600">No pending review items at the moment.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviewItems.map((item) => (
            <Card key={item.review_id} className="border-l-4 border-orange-400">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Question Info */}
                <div className="lg:col-span-1">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-orange-500 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">
                        {item.question_text}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Question ID: <code className="text-xs bg-gray-100 px-2 py-1 rounded">{item.question_id}</code>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Confidence Score:</span>
                      <Badge color={getConfidenceBadgeColor(item.confidence_score)}>
                        {(item.confidence_score * 100).toFixed(0)}%
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Recorded:</span>
                      <span className="text-sm text-gray-900">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {item.session_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Session:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {item.session_id.substring(0, 8)}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Audio Playback */}
                  <div className="mt-4">
                    <Button
                      color="light"
                      size="sm"
                      onClick={() => toggleAudio(item.review_id)}
                      className="w-full"
                    >
                      {playingAudio === item.review_id ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause Recording
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Play Recording
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Right Column - Transcription & Correction */}
                <div className="lg:col-span-2">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ASR Transcription (Low Confidence):
                    </label>
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                      <p className="text-red-900 font-mono">
                        "{item.user_answer}"
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operator Correction:
                    </label>
                    <TextInput
                      value={corrections[item.review_id] || ''}
                      onChange={(e) => setCorrections({
                        ...corrections,
                        [item.review_id]: e.target.value
                      })}
                      placeholder="Enter the correct transcription..."
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Listen to the recording and type the correct answer above
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      color="success"
                      onClick={() => resolveItem(item.review_id)}
                      disabled={!corrections[item.review_id] || corrections[item.review_id].trim() === ''}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Resolve & Save Correction
                    </Button>

                    <Button
                      color="light"
                      onClick={() => setCorrections({
                        ...corrections,
                        [item.review_id]: item.user_answer
                      })}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset to Original
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OperatorReviewQueue;
