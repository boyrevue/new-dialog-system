/**
 * MultimodalDialog Component
 * 
 * React component for multimodal dialog interaction supporting:
 * - Text-to-speech prompts
 * - Speech recognition
 * - Visual components
 * - Multiple choice options
 * - FAQ display
 * - Confidence-based feedback
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MultimodalDialog.css';

const API_BASE_URL = 'http://localhost:8000/api';

const MultimodalDialog = () => {
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'speech'
  const [isRecording, setIsRecording] = useState(false);
  const [confidence, setConfidence] = useState(null);
  const [showFAQ, setShowFAQ] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Initialize session on mount
  useEffect(() => {
    startSession();
    
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-GB';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        setUserInput(transcript);
        handleSpeechResult(transcript, confidence);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startSession = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/session/start`, {
        method: 'POST',
      });
      const data = await response.json();
      setSessionId(data.session_id);
      
      // Load first question
      await loadCurrentQuestion(data.session_id);
    } catch (err) {
      setError('Failed to start session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentQuestion = async (sid = sessionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/session/${sid}/current-question`);
      const data = await response.json();
      
      if (data.completed) {
        setCompleted(true);
        return;
      }
      
      setCurrentQuestion(data);
      setUserInput('');
      setConfidence(null);
      
      // Play TTS if available
      if (data.tts && data.tts.text) {
        speakText(data.tts.text, data.tts);
      }
    } catch (err) {
      setError('Failed to load question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text, ttsConfig = {}) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = ttsConfig.rate || 1.0;
      utterance.pitch = ttsConfig.pitch || 1.0;
      
      // Try to select a specific voice
      const voices = speechSynthesis.getVoices();
      if (ttsConfig.voice && voices.length > 0) {
        const voice = voices.find(v => v.name.includes(ttsConfig.voice));
        if (voice) {
          utterance.voice = voice;
        }
      }
      
      speechSynthesis.speak(utterance);
    }
  };

  const startSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    
    try {
      setIsRecording(true);
      setError(null);
      
      // Start audio recording for quality analysis
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = [];
          
          mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
          };
          
          mediaRecorderRef.current.start();
        });
      
      recognitionRef.current.start();
    } catch (err) {
      setError('Failed to start speech recognition: ' + err.message);
      setIsRecording(false);
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    }
  }, [isRecording]);

  const handleSpeechResult = async (transcript, recognitionConfidence) => {
    setIsRecording(false);
    
    // Stop media recorder and get audio blob
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      
      // Wait for audio data
      await new Promise(resolve => {
        mediaRecorderRef.current.onstop = resolve;
      });
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      
      // Analyze audio quality
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('question_id', currentQuestion.question_id);
      
      try {
        const qualityResponse = await fetch(`${API_BASE_URL}/audio/analyze`, {
          method: 'POST',
          body: formData
        });
        const qualityData = await qualityResponse.json();
        
        // Submit answer with audio quality metrics
        await submitAnswer(transcript, 'speech', recognitionConfidence, qualityData);
      } catch (err) {
        console.error('Audio analysis failed:', err);
        // Submit without audio metrics
        await submitAnswer(transcript, 'speech', recognitionConfidence);
      }
    } else {
      await submitAnswer(transcript, 'speech', recognitionConfidence);
    }
  };

  const submitAnswer = async (answerText, answerType = 'text', recognitionConf = null, audioMetrics = null) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/answer/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: currentQuestion.question_id,
          answer_text: answerText,
          answer_type: answerType,
          recognition_confidence: recognitionConf
        })
      });
      
      const data = await response.json();
      setConfidence(data.confidence);
      
      if (data.needs_review) {
        setError(`Your answer has been flagged for review (confidence: ${(data.confidence * 100).toFixed(0)}%). An operator will verify it shortly.`);
        
        // Wait a moment before moving to next question
        setTimeout(() => {
          loadCurrentQuestion();
        }, 3000);
      } else {
        // Move to next question immediately
        await loadCurrentQuestion();
      }
    } catch (err) {
      setError('Failed to submit answer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (userInput.trim()) {
      submitAnswer(userInput.trim(), 'text');
    }
  };

  const handleSelectOption = (optionValue) => {
    setUserInput(optionValue);
    submitAnswer(optionValue, 'select');
  };

  const repeatQuestion = () => {
    if (currentQuestion && currentQuestion.tts) {
      speakText(currentQuestion.tts.text, currentQuestion.tts);
    }
  };

  if (loading && !currentQuestion) {
    return (
      <div className="multimodal-dialog loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="multimodal-dialog completed">
        <h2>✓ Dialog Completed</h2>
        <p>Thank you for providing your information.</p>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="multimodal-dialog">
      <div className="dialog-header">
        <h2>Insurance Quote Application</h2>
        {sessionId && <p className="session-id">Session: {sessionId.slice(0, 8)}</p>}
      </div>

      <div className="question-container">
        <div className="question-header">
          <h3>{currentQuestion.question_text}</h3>
          {currentQuestion.required && <span className="required">*</span>}
        </div>

        {/* Visual Components */}
        {currentQuestion.visual_components && currentQuestion.visual_components.length > 0 && (
          <div className="visual-components">
            {currentQuestion.visual_components.map((visual, index) => (
              <div key={index} className={`visual-component visual-${visual.type}`}>
                {visual.type === 'image' && visual.image_url && (
                  <img src={visual.image_url} alt={visual.data || 'Visual aid'} />
                )}
                {visual.data && <p className="visual-description">{visual.data}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Select Options */}
        {currentQuestion.select_options && currentQuestion.select_options.length > 0 ? (
          <div className="select-options">
            {currentQuestion.select_options.map((option, index) => (
              <button
                key={index}
                className={`option-button ${userInput === option.value ? 'selected' : ''}`}
                onClick={() => handleSelectOption(option.value)}
                disabled={loading}
              >
                <div className="option-label">{option.label}</div>
                {option.description && (
                  <div className="option-description">{option.description}</div>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Text/Speech Input */
          <div className="input-container">
            <div className="input-mode-toggle">
              <button
                className={inputMode === 'text' ? 'active' : ''}
                onClick={() => setInputMode('text')}
              >
                ⌨️ Type
              </button>
              <button
                className={inputMode === 'speech' ? 'active' : ''}
                onClick={() => setInputMode('speech')}
                disabled={!recognitionRef.current}
              >
                🎤 Speak
              </button>
            </div>

            {inputMode === 'text' ? (
              <form onSubmit={handleTextSubmit}>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={loading}
                  autoFocus
                />
                <button type="submit" disabled={loading || !userInput.trim()}>
                  Submit
                </button>
              </form>
            ) : (
              <div className="speech-input">
                <button
                  className={`record-button ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? stopSpeechRecognition : startSpeechRecognition}
                  disabled={loading}
                >
                  {isRecording ? '⏹️ Stop' : '🎤 Start Recording'}
                </button>
                {userInput && (
                  <div className="transcript">
                    <p><strong>Recognized:</strong> {userInput}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Confidence Indicator */}
        {confidence !== null && (
          <div className={`confidence-indicator ${confidence < currentQuestion.confidence_threshold ? 'low' : 'high'}`}>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{ width: `${confidence * 100}%` }}
              ></div>
            </div>
            <p>Confidence: {(confidence * 100).toFixed(0)}%</p>
          </div>
        )}

        {/* Controls */}
        <div className="question-controls">
          <button onClick={repeatQuestion} className="secondary-button">
            🔊 Repeat Question
          </button>
          {currentQuestion.faqs && currentQuestion.faqs.length > 0 && (
            <button
              onClick={() => setShowFAQ(!showFAQ)}
              className="secondary-button"
            >
              ❓ Help ({currentQuestion.faqs.length})
            </button>
          )}
        </div>

        {/* FAQs */}
        {showFAQ && currentQuestion.faqs && currentQuestion.faqs.length > 0 && (
          <div className="faq-section">
            <h4>Frequently Asked Questions</h4>
            {currentQuestion.faqs.map((faq, index) => (
              <div key={index} className="faq-item">
                <p className="faq-question"><strong>Q:</strong> {faq.question}</p>
                <p className="faq-answer"><strong>A:</strong> {faq.answer}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className={`error-message ${error.includes('flagged') ? 'warning' : ''}`}>
          {error}
        </div>
      )}
    </div>
  );
};

export default MultimodalDialog;
