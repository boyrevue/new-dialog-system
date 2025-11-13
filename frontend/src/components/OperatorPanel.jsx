/**
 * OperatorPanel Component
 * 
 * Operator interface for reviewing low-confidence answers:
 * - Real-time review queue with priority sorting
 * - Audio playback with waveform visualization
 * - Manual transcription interface
 * - Rephrase request system
 * - WebSocket notifications
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './OperatorPanel.css';

const API_BASE_URL = 'http://localhost:8001/api/admin';
const WS_URL = 'ws://localhost:8001/ws/admin';

const REPHRASE_TEMPLATES = {
  phonetic: 'Phonetic Alphabet',
  slow: 'Slow Repeat',
  confirmation: 'Confirmation',
  example: 'With Example'
};

const OperatorPanel = () => {
  const [operatorId, setOperatorId] = useState(localStorage.getItem('operatorId') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [operatorConfidence, setOperatorConfidence] = useState(0.95);
  const [notes, setNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [filterPriority, setFilterPriority] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [rephraseTemplate, setRephraseTemplate] = useState('phonetic');
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const waveformCanvasRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'ping' }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed, reconnecting...');
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isLoggedIn]);

  // Load review queue periodically
  useEffect(() => {
    if (!isLoggedIn) return;
    
    loadReviewQueue();
    loadStats();
    
    const interval = setInterval(() => {
      loadReviewQueue();
      loadStats();
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, [isLoggedIn, filterStatus, filterPriority]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'new_review_item':
        // Play notification sound
        playNotificationSound();
        // Refresh queue
        loadReviewQueue();
        break;
      
      case 'status_change':
        // Refresh queue
        loadReviewQueue();
        if (selectedReview && selectedReview.review_id === data.review_id) {
          // Reload selected item
          loadReviewDetail(data.review_id);
        }
        break;
      
      case 'pong':
        // Connection alive
        break;
      
      default:
        console.log('Unknown WebSocket message:', data);
    }
  };

  const playNotificationSound = () => {
    // Simple beep notification
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const loadReviewQueue = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority_max', filterPriority);
      
      const response = await fetch(`${API_BASE_URL}/review/queue?${params}`);
      const data = await response.json();
      setReviewQueue(data.items);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadReviewDetail = async (reviewId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/review/${reviewId}`);
      const data = await response.json();
      setSelectedReview(data.review);
      setTranscriptionText(data.review.original_transcription || '');
      setError(null);
      
      // Load audio if available
      if (data.review.audio_path) {
        loadAudioFile(data.review.audio_path);
      }
    } catch (err) {
      setError('Failed to load review details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAudioFile = async (audioPath) => {
    try {
      // In production, fetch the actual audio file
      // For now, simulate audio loading
      console.log('Loading audio from:', audioPath);
      
      // Initialize audio context for waveform visualization
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Set audio player (in production, load actual file)
      setAudioPlayer({ path: audioPath, duration: 5.0 });
      
      // Draw waveform
      drawWaveform();
    } catch (err) {
      console.error('Failed to load audio:', err);
    }
  };

  const drawWaveform = () => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    // Draw simulated waveform (in production, use actual audio data)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const numPoints = 100;
    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * width;
      const amplitude = Math.sin(i * 0.5) * 0.3 + Math.random() * 0.2;
      const y = height / 2 + amplitude * height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
  };

  const claimReview = async (reviewId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/review/${reviewId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operator_id: operatorId })
      });
      
      if (response.ok) {
        await loadReviewDetail(reviewId);
        await loadReviewQueue();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to claim review');
      }
    } catch (err) {
      setError('Failed to claim review: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitTranscription = async () => {
    if (!transcriptionText.trim()) {
      setError('Please enter a transcription');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/review/${selectedReview.review_id}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          review_id: selectedReview.review_id,
          transcribed_text: transcriptionText,
          operator_confidence: operatorConfidence,
          operator_id: operatorId,
          notes: notes
        })
      });
      
      if (response.ok) {
        setError(null);
        alert('Transcription submitted successfully!');
        setSelectedReview(null);
        setTranscriptionText('');
        setNotes('');
        await loadReviewQueue();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to submit transcription');
      }
    } catch (err) {
      setError('Failed to submit transcription: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestRephrase = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/review/${selectedReview.review_id}/rephrase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          review_id: selectedReview.review_id,
          operator_id: operatorId,
          template_type: rephraseTemplate
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Rephrase request sent!\n\nMessage: ${data.rephrase_message}`);
        setSelectedReview(null);
        await loadReviewQueue();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to request rephrase');
      }
    } catch (err) {
      setError('Failed to request rephrase: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateTranscription = async (approved) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/review/${selectedReview.review_id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          review_id: selectedReview.review_id,
          operator_id: operatorId,
          approved: approved,
          notes: notes
        })
      });
      
      if (response.ok) {
        alert(`Transcription ${approved ? 'approved' : 'rejected'}!`);
        setSelectedReview(null);
        setNotes('');
        await loadReviewQueue();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to validate transcription');
      }
    } catch (err) {
      setError('Failed to validate transcription: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (operatorId.trim()) {
      localStorage.setItem('operatorId', operatorId);
      setIsLoggedIn(true);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setOperatorId('');
    localStorage.removeItem('operatorId');
  };

  if (!isLoggedIn) {
    return (
      <div className="operator-panel login-screen">
        <div className="login-container">
          <h2>Operator Login</h2>
          <input
            type="text"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            placeholder="Enter Operator ID"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin} disabled={!operatorId.trim()}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="operator-panel">
      <div className="panel-header">
        <h1>Review Queue - Operator Panel</h1>
        <div className="operator-info">
          <span>👤 {operatorId}</span>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </div>

      {stats && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{stats.total_items}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pending:</span>
            <span className="stat-value pending">{stats.status_distribution.PENDING || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">In Review:</span>
            <span className="stat-value in-review">{stats.status_distribution.IN_REVIEW || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">High Priority:</span>
            <span className="stat-value high-priority">{stats.pending_high_priority || 0}</span>
          </div>
        </div>
      )}

      <div className="panel-content">
        <div className="queue-sidebar">
          <div className="queue-filters">
            <h3>Filters</h3>
            <div className="filter-group">
              <label>Status:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="TRANSCRIBED">Transcribed</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Max Priority:</label>
              <select value={filterPriority || ''} onChange={(e) => setFilterPriority(e.target.value || null)}>
                <option value="">All</option>
                <option value="1">1 (Highest)</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>

          <div className="review-queue-list">
            <h3>Queue ({reviewQueue.length})</h3>
            {reviewQueue.map((item) => (
              <div
                key={item.review_id}
                className={`queue-item priority-${item.priority} ${selectedReview?.review_id === item.review_id ? 'selected' : ''}`}
                onClick={() => loadReviewDetail(item.review_id)}
              >
                <div className="queue-item-header">
                  <span className="priority-badge">P{item.priority}</span>
                  <span className="status-badge">{item.status}</span>
                </div>
                <div className="queue-item-content">
                  <p className="question-text">{item.question_text}</p>
                  <p className="confidence-score">
                    Confidence: {(item.confidence_score * 100).toFixed(0)}%
                  </p>
                  <p className="timestamp">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="review-details">
          {selectedReview ? (
            <>
              <div className="review-header">
                <h2>Review Details</h2>
                <div className="review-meta">
                  <span className={`priority-badge-large priority-${selectedReview.priority}`}>
                    Priority {selectedReview.priority}
                  </span>
                  <span className="status-badge-large">{selectedReview.status}</span>
                </div>
              </div>

              <div className="question-section">
                <h3>Question</h3>
                <p className="question-text-large">{selectedReview.question_text}</p>
                <p className="slot-name">Slot: <code>{selectedReview.slot_name}</code></p>
              </div>

              {selectedReview.original_transcription && (
                <div className="original-transcription">
                  <h3>Original Recognition</h3>
                  <p>{selectedReview.original_transcription}</p>
                  <p className="confidence-info">
                    Confidence: {(selectedReview.confidence_score * 100).toFixed(0)}% 
                    (Threshold: {(selectedReview.threshold * 100).toFixed(0)}%)
                  </p>
                </div>
              )}

              {audioPlayer && (
                <div className="audio-section">
                  <h3>Audio Recording</h3>
                  <canvas
                    ref={waveformCanvasRef}
                    width={600}
                    height={120}
                    className="waveform-canvas"
                  />
                  <div className="audio-controls">
                    <button>▶️ Play</button>
                    <button>⏸️ Pause</button>
                    <button>⏮️ Rewind</button>
                    <span className="audio-duration">{audioPlayer.duration}s</span>
                  </div>
                </div>
              )}

              {selectedReview.status === 'IN_REVIEW' && (
                <div className="transcription-section">
                  <h3>Manual Transcription</h3>
                  <textarea
                    value={transcriptionText}
                    onChange={(e) => setTranscriptionText(e.target.value)}
                    placeholder="Enter the transcribed text..."
                    rows={4}
                  />
                  
                  <div className="confidence-slider">
                    <label>Operator Confidence: {(operatorConfidence * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={operatorConfidence}
                      onChange={(e) => setOperatorConfidence(parseFloat(e.target.value))}
                    />
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)..."
                    rows={2}
                  />

                  <div className="action-buttons">
                    <button
                      className="primary-button"
                      onClick={submitTranscription}
                      disabled={loading || !transcriptionText.trim()}
                    >
                      ✓ Submit Transcription
                    </button>
                    
                    <div className="rephrase-section">
                      <select
                        value={rephraseTemplate}
                        onChange={(e) => setRephraseTemplate(e.target.value)}
                      >
                        {Object.entries(REPHRASE_TEMPLATES).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <button
                        className="secondary-button"
                        onClick={requestRephrase}
                        disabled={loading}
                      >
                        ↩️ Request Rephrase
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selectedReview.status === 'PENDING' && (
                <div className="action-buttons">
                  <button
                    className="primary-button"
                    onClick={() => claimReview(selectedReview.review_id)}
                    disabled={loading}
                  >
                    📋 Claim for Review
                  </button>
                </div>
              )}

              {selectedReview.status === 'TRANSCRIBED' && (
                <div className="validation-section">
                  <h3>Transcription</h3>
                  <p className="transcribed-text">{selectedReview.transcribed_text}</p>
                  <p className="operator-confidence">
                    Operator Confidence: {(selectedReview.operator_confidence * 100).toFixed(0)}%
                  </p>
                  
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Validation notes (optional)..."
                    rows={2}
                  />

                  <div className="action-buttons">
                    <button
                      className="approve-button"
                      onClick={() => validateTranscription(true)}
                      disabled={loading}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="reject-button"
                      onClick={() => validateTranscription(false)}
                      disabled={loading}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <p>Select an item from the queue to review</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default OperatorPanel;
