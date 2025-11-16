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
import { Card, Button, TextInput, Badge, Progress, Spinner, Alert, Select, Label, Modal } from 'flowbite-react';
import { Mic, MicOff, Send, Volume2, HelpCircle, CheckCircle2, AlertTriangle, Settings as SettingsIcon, MessageSquare, Keyboard, Users } from 'lucide-react';
import PhoneticKeyboard from './PhoneticKeyboard';
import SelectWithASR from './SelectWithASR';

const API_BASE_URL = '/api';

const MultimodalDialog = () => {
  // Session management for multi-user support (up to 2 sessions)
  const [sessions, setSessions] = useState([
    { id: null, label: 'Session 1', active: true, data: null },
    { id: null, label: 'Session 2', active: false, data: null }
  ]);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);

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
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [operatorMessages, setOperatorMessages] = useState([]);
  const [helpMessage, setHelpMessage] = useState('');
  const [currentVariantIndex, setCurrentVariantIndex] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const wsRef = useRef(null);

  // Initialize TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = speechSynthesis.getVoices();

      // Filter to only English and German voices
      const voices = allVoices.filter(v =>
        v.lang.startsWith('en') || v.lang.startsWith('de')
      );

      console.log('Available English & German voices:', voices.map(v => `${v.name} (${v.lang})`));
      setAvailableVoices(voices);

      // Load saved preferences
      const savedVoiceName = localStorage.getItem('preferredVoice');
      const savedRate = localStorage.getItem('ttsRate');
      const savedPitch = localStorage.getItem('ttsPitch');

      if (savedRate) setTtsRate(parseFloat(savedRate));
      if (savedPitch) setTtsPitch(parseFloat(savedPitch));

      if (savedVoiceName) {
        const voice = voices.find(v => v.name === savedVoiceName);
        if (voice) {
          setSelectedVoice(voice);
          return;
        }
      }

      if (voices.length > 0) {
        // Try to find Google UK English Female voice specifically
        let defaultVoice = voices.find(v =>
          v.name.toLowerCase().includes('google') &&
          v.name.toLowerCase().includes('uk') &&
          v.name.toLowerCase().includes('female') &&
          v.lang === 'en-GB'
        );

        // Fallback to any Google UK English voice
        if (!defaultVoice) {
          defaultVoice = voices.find(v =>
            v.name.toLowerCase().includes('google') &&
            v.lang === 'en-GB'
          );
        }

        // Fallback to any Google English Female voice
        if (!defaultVoice) {
          defaultVoice = voices.find(v =>
            v.name.toLowerCase().includes('google') &&
            v.name.toLowerCase().includes('female') &&
            v.lang.startsWith('en')
          );
        }

        // Fallback to any Google English voice
        if (!defaultVoice) {
          defaultVoice = voices.find(v =>
            v.name.toLowerCase().includes('google') &&
            v.lang.startsWith('en')
          );
        }

        // Fallback to first English voice
        if (!defaultVoice) {
          defaultVoice = voices.find(v => v.lang.startsWith('en'));
        }

        // Fallback to first German voice
        if (!defaultVoice) {
          defaultVoice = voices.find(v => v.lang.startsWith('de'));
        }

        // Final fallback
        if (!defaultVoice && voices.length > 0) {
          defaultVoice = voices[0];
        }

        if (defaultVoice) {
          setSelectedVoice(defaultVoice);
          console.log('Selected default voice:', defaultVoice.name, '(lang:', defaultVoice.lang + ')');
        }
      }
    };

    // Chrome loads voices asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();

    // Try loading again after a delay for browser compatibility
    setTimeout(loadVoices, 100);
  }, []);

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

        console.log('Speech recognized:', transcript, 'Confidence:', confidence);
        setUserInput(transcript);
        handleSpeechResult(transcript, confidence);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = 'Speech recognition error: ';

        switch(event.error) {
          case 'not-allowed':
          case 'permission-denied':
            errorMessage += 'Microphone permission denied. Please allow microphone access.';
            break;
          case 'no-speech':
            errorMessage += 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage += 'No microphone found. Please connect a microphone.';
            break;
          case 'network':
            errorMessage = 'Network error: Speech recognition service temporarily unavailable. You can use Type mode or try again.';
            break;
          case 'aborted':
            // Don't show error for aborted - user likely stopped it
            setIsRecording(false);
            return;
          default:
            errorMessage += event.error;
        }

        setError(errorMessage);
        setIsRecording(false);
      };

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setIsRecording(true);
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
      };
    } else {
      console.warn('Speech recognition not supported in this browser');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Error stopping recognition:', e);
        }
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Switch between sessions
  const switchSession = useCallback(async (index) => {
    const session = sessions[index];

    // Save current session state before switching
    if (sessionId) {
      const updatedSessions = [...sessions];
      updatedSessions[activeSessionIndex] = {
        ...updatedSessions[activeSessionIndex],
        id: sessionId,
        data: {
          currentQuestion,
          completed,
          confidence,
          currentVariantIndex
        }
      };
      setSessions(updatedSessions);
    }

    setActiveSessionIndex(index);

    // If session doesn't exist yet, start a new one
    if (!session.id) {
      await startSessionForSlot(index);
    } else {
      // Restore session state
      setSessionId(session.id);
      if (session.data) {
        setCurrentQuestion(session.data.currentQuestion);
        setCompleted(session.data.completed);
        setConfidence(session.data.confidence);
        setCurrentVariantIndex(session.data.currentVariantIndex || 0);
      } else {
        await loadCurrentQuestion(session.id);
      }
    }

    // Reset input state
    setUserInput('');
    setInputMode('text');
    setError(null);
  }, [sessions, activeSessionIndex, sessionId, currentQuestion, completed, confidence, currentVariantIndex]);

  const startSessionForSlot = async (slotIndex) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/session/start`, {
        method: 'POST',
      });
      const data = await response.json();

      // Update the session slot with new ID
      const updatedSessions = [...sessions];
      updatedSessions[slotIndex] = {
        ...updatedSessions[slotIndex],
        id: data.session_id,
        active: true
      };
      setSessions(updatedSessions);
      setSessionId(data.session_id);

      // Load first question
      await loadCurrentQuestion(data.session_id);
    } catch (err) {
      setError('Failed to start session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    await startSessionForSlot(activeSessionIndex);
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
      setCurrentVariantIndex(0); // Reset variant index for new question

      // AUTOPLAY DISABLED - TTS will only play on demand via Test Voice or Rephrase buttons
      // Play TTS if available - wait for voices to load first
      // if (data.tts && data.tts.text) {
      //   console.log('Question loaded with TTS:', data.tts);

      //   // Wait for voices AND selectedVoice state to be ready
      //   const waitForVoicesAndState = () => {
      //     const voices = speechSynthesis.getVoices().filter(v =>
      //       v.lang.startsWith('en') || v.lang.startsWith('de')
      //     );

      //     if (voices.length > 0) {
      //       // Find the default voice (same logic as loadVoices)
      //       let voiceToUse = voices.find(v =>
      //         v.name.toLowerCase().includes('google') &&
      //         v.name.toLowerCase().includes('uk') &&
      //         v.name.toLowerCase().includes('female') &&
      //         v.lang === 'en-GB'
      //       );

      //       if (!voiceToUse) {
      //         voiceToUse = voices.find(v =>
      //           v.name.toLowerCase().includes('google') &&
      //           v.lang === 'en-GB'
      //         );
      //       }

      //       if (voiceToUse) {
      //         // Set state and pass voice object directly to bypass state timing issues
      //         setSelectedVoice(voiceToUse);
      //         setTimeout(() => {
      //           speakText(data.tts.text, data.tts, voiceToUse);
      //         }, 50);
      //       } else {
      //         speakText(data.tts.text, data.tts);
      //       }
      //     } else {
      //       // Voices not loaded yet, wait a bit and try again
      //       setTimeout(waitForVoicesAndState, 100);
      //     }
      //   };
      //   waitForVoicesAndState();
      // } else {
      //   // Fallback: Speak the question text if no TTS configured
      //   console.log('No TTS data configured, speaking question text:', data.question_text);
      //
      //   const waitForVoicesAndState = () => {
      //     const voices = speechSynthesis.getVoices().filter(v =>
      //       v.lang.startsWith('en') || v.lang.startsWith('de')
      //     );
      //
      //     if (voices.length > 0) {
      //       let voiceToUse = voices.find(v =>
      //         v.name.toLowerCase().includes('google') &&
      //         v.name.toLowerCase().includes('uk') &&
      //         v.name.toLowerCase().includes('female') &&
      //         v.lang === 'en-GB'
      //       );
      //
      //       if (voiceToUse) {
      //         setSelectedVoice(voiceToUse);
      //         setTimeout(() => {
      //           speakText(data.question_text, {}, voiceToUse);
      //         }, 50);
      //       } else {
      //         speakText(data.question_text, {});
      //       }
      //     } else {
      //       setTimeout(waitForVoicesAndState, 100);
      //     }
      //   };
      //   waitForVoicesAndState();
      // }
    } catch (err) {
      setError('Failed to load question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text, ttsConfig = {}, voiceObject = null) => {
    if ('speechSynthesis' in window) {
      // Chrome bug workaround: only cancel if something is actually queued/playing
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
      }

      // Wait a moment for cancel to complete, then proceed
      setTimeout(() => {
        // Chrome bug workaround: wake up the speech synthesis engine
        if (speechSynthesis.paused) {
          speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-GB';
        utterance.volume = 1.0; // Ensure full volume

        // Use configured rate and pitch, with TTS config override
        utterance.rate = ttsConfig.rate !== undefined ? ttsConfig.rate : ttsRate;
        utterance.pitch = ttsConfig.pitch !== undefined ? ttsConfig.pitch : ttsPitch;

        // Use voice in this priority: voiceObject param > selectedVoice state > TTS config
        if (voiceObject) {
          utterance.voice = voiceObject;
        } else if (selectedVoice) {
          utterance.voice = selectedVoice;
        } else if (ttsConfig.voice && availableVoices.length > 0) {
          const voice = availableVoices.find(v => v.name.includes(ttsConfig.voice));
          if (voice) {
            utterance.voice = voice;
          }
        }

        utterance.onstart = () => {
          console.log('TTS started:', text.substring(0, 50) + '...');
          console.log('Voice:', utterance.voice?.name, 'Rate:', utterance.rate, 'Pitch:', utterance.pitch);
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          console.log('TTS ended');
          setIsSpeaking(false);
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          if (event.error === 'not-allowed') {
            setShowAudioPrompt(true);
            setError(null); // Don't show error, show the audio prompt instead
          } else if (event.error !== 'canceled') {
            // Log and show only actual errors (not "canceled" which is expected)
            console.error('TTS error:', event.error);
            setError(`Text-to-speech error: ${event.error}`);
          }
          // Silently ignore "canceled" errors - they're expected when stopping TTS
        };

        console.log('Speaking:', {
          text: text.substring(0, 50) + '...',
          voice: utterance.voice?.name || 'default',
          rate: utterance.rate,
          pitch: utterance.pitch
        });

        console.log('speechSynthesis state:', {
          speaking: speechSynthesis.speaking,
          pending: speechSynthesis.pending,
          paused: speechSynthesis.paused
        });

        speechSynthesis.speak(utterance);

        // Chrome bug workaround: check if speech started after a short delay
        setTimeout(() => {
          if (!speechSynthesis.speaking && !speechSynthesis.pending) {
            console.warn('TTS failed to start, retrying with fresh utterance and default voice...');
            // Retry once with fresh utterance and no explicit voice (let Chrome pick a safe default)
            const fallback = new SpeechSynthesisUtterance(text);
            fallback.lang = navigator.language || 'en-GB';
            fallback.rate = ttsConfig.rate !== undefined ? ttsConfig.rate : ttsRate;
            fallback.pitch = ttsConfig.pitch !== undefined ? ttsConfig.pitch : ttsPitch;
            fallback.volume = 1.0;
            fallback.onstart = () => setIsSpeaking(true);
            fallback.onend = () => setIsSpeaking(false);
            fallback.onerror = () => {
              setIsSpeaking(false);
              // As a last resort, show the enable audio prompt to request a user gesture
              setShowAudioPrompt(true);
            };
            // Ensure no stale queue remains before retry
            if (speechSynthesis.speaking || speechSynthesis.pending) {
              speechSynthesis.cancel();
            }
            setTimeout(() => speechSynthesis.speak(fallback), 120);
          }
        }, 250);
      }, 120); // slightly longer delay after cancel for Chrome stability
    } else {
      console.warn('Speech synthesis not supported');
      setError('Text-to-speech not supported in this browser');
    }
  };

  const connectToOperatorHelp = useCallback(() => {
    if (!sessionId || !currentQuestion) return;

    const wsUrl = `ws://localhost:8001/ws/admin/help`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Connected to operator help');
      wsRef.current.send(JSON.stringify({
        type: 'help_request',
        session_id: sessionId,
        question_id: currentQuestion.question_id,
        question_text: currentQuestion.question_text
      }));
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Operator message:', message);

      if (message.type === 'operator_response') {
        setOperatorMessages(prev => [...prev, {
          text: message.text,
          timestamp: new Date().toISOString(),
          from: 'operator'
        }]);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Failed to connect to operator help');
    };

    wsRef.current.onclose = () => {
      console.log('Operator help connection closed');
    };
  }, [sessionId, currentQuestion]);

  const sendHelpMessage = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && helpMessage.trim()) {
      wsRef.current.send(JSON.stringify({
        type: 'user_message',
        text: helpMessage,
        session_id: sessionId,
        question_id: currentQuestion.question_id
      }));

      setOperatorMessages(prev => [...prev, {
        text: helpMessage,
        timestamp: new Date().toISOString(),
        from: 'user'
      }]);

      setHelpMessage('');
    }
  };

  const handleVoiceChange = (voiceName) => {
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
      localStorage.setItem('preferredVoice', voiceName);
      console.log('Voice changed to:', voiceName);
    }
  };

  const handleRateChange = (newRate) => {
    console.log('handleRateChange called with:', newRate, 'type:', typeof newRate);
    setTtsRate(newRate);
    localStorage.setItem('ttsRate', newRate.toString());
    console.log('TTS rate state updated to:', newRate);
  };

  const handlePitchChange = (newPitch) => {
    console.log('handlePitchChange called with:', newPitch, 'type:', typeof newPitch);
    setTtsPitch(newPitch);
    localStorage.setItem('ttsPitch', newPitch.toString());
    console.log('TTS pitch state updated to:', newPitch);
  };

  const testVoice = () => {
    console.log('Testing voice with current settings:', {
      rate: ttsRate,
      pitch: ttsPitch,
      voice: selectedVoice?.name
    });
    const testText = `Hello! This is a test of the text to speech system using ${selectedVoice ? selectedVoice.name : 'the default voice'}.`;
    speakText(testText, {}, selectedVoice);
  };

  const startSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    try {
      setError(null);
      console.log('Starting speech recognition...');

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          console.log('Microphone access granted');
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = [];

          mediaRecorderRef.current.ondataavailable = (event) => {
            console.log('Audio data available:', event.data.size, 'bytes');
            audioChunksRef.current.push(event.data);
          };

          mediaRecorderRef.current.start();
          console.log('MediaRecorder started');

          // Start speech recognition AFTER microphone permission is granted
          recognitionRef.current.start();
          console.log('SpeechRecognition.start() called');
          setIsRecording(true);
        })
        .catch(err => {
          console.error('Microphone access error:', err);
          setError('Microphone access denied: ' + err.message);
          setIsRecording(false);
        });
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
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

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();

      await new Promise(resolve => {
        mediaRecorderRef.current.onstop = resolve;
      });

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('question_id', currentQuestion.question_id);

      try {
        const qualityResponse = await fetch(`${API_BASE_URL}/audio/analyze`, {
          method: 'POST',
          body: formData
        });
        const qualityData = await qualityResponse.json();

        await submitAnswer(transcript, 'speech', recognitionConfidence, qualityData);
      } catch (err) {
        console.error('Audio analysis failed:', err);
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

        setTimeout(() => {
          loadCurrentQuestion();
        }, 3000);
      } else {
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
    console.log('Repeat/Rephrase question clicked');
    if (!currentQuestion) {
      console.warn('No current question to speak');
      return;
    }

    // Cancel any ongoing speech first
    if (speechSynthesis.speaking) {
      console.log('Canceling ongoing speech');
      speechSynthesis.cancel();
    }

    // Get TTS variants if available
    const tts = currentQuestion.tts;
    console.log('Current question TTS data:', tts);

    if (tts) {
      const variants = [];

      // Collect all available variants
      if (tts.text) variants.push(tts.text);
      if (tts.variant1) variants.push(tts.variant1);
      if (tts.variant2) variants.push(tts.variant2);
      if (tts.variant3) variants.push(tts.variant3);
      if (tts.variant4) variants.push(tts.variant4);

      console.log('TTS variants found:', variants.length, variants);

      if (variants.length > 0) {
        // Cycle to next variant
        const nextIndex = (currentVariantIndex + 1) % variants.length;
        setCurrentVariantIndex(nextIndex);

        const variantToSpeak = variants[nextIndex];
        console.log(`Speaking variant ${nextIndex + 1}/${variants.length}:`, variantToSpeak);

        // Small delay to ensure previous speech is canceled
        setTimeout(() => {
          speakText(variantToSpeak, tts);
        }, 100);
      } else {
        // No variants, use question text
        console.log('No TTS variants found, speaking question text:', currentQuestion.question_text);
        setTimeout(() => {
          speakText(currentQuestion.question_text, {});
        }, 100);
      }
    } else {
      // Fallback to question text if no TTS configured
      console.log('No TTS configured, speaking question text:', currentQuestion.question_text);
      setTimeout(() => {
        speakText(currentQuestion.question_text, {});
      }, 100);
    }
  };

  if (loading && !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="xl" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <Card className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dialog Completed</h2>
          <p className="text-gray-600">Thank you for providing your information.</p>
        </div>
      </Card>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        {/* Session Switcher */}
        <div className="border-b pb-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Active Sessions</span>
          </div>
          <div className="flex gap-2">
            {sessions.map((session, index) => (
              <Button
                key={index}
                color={activeSessionIndex === index ? 'blue' : 'light'}
                size="sm"
                onClick={() => switchSession(index)}
                className="flex-1"
              >
                <div className="flex flex-col items-center">
                  <span className="font-semibold">{session.label}</span>
                  {session.id ? (
                    <Badge color={activeSessionIndex === index ? 'success' : 'gray'} size="xs" className="mt-1">
                      {session.data?.completed ? 'Completed' : 'In Progress'}
                    </Badge>
                  ) : (
                    <Badge color="gray" size="xs" className="mt-1">
                      Not Started
                    </Badge>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="border-b pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Insurance Quote Application</h2>
          {sessionId && (
            <Badge color="info" className="mt-2">
              Session: {sessionId.slice(0, 8)}
            </Badge>
          )}
        </div>

        {/* Question */}
        <div className="mb-6">
          {/* TTS Play Button */}
          <div className="mb-3">
            <button
              onClick={() => {
                const text = currentQuestion.tts?.text || currentQuestion.question_text;
                const ttsConfig = currentQuestion.tts || {};
                speakText(text, ttsConfig, selectedVoice);
              }}
              disabled={isSpeaking}
              style={{
                padding: '8px 16px',
                backgroundColor: isSpeaking ? '#9ca3af' : '#2563eb',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: '500',
                border: 'none',
                cursor: isSpeaking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSpeaking ? 0.6 : 1
              }}
              onMouseOver={(e) => {
                if (!isSpeaking) e.target.style.backgroundColor = '#1d4ed8';
              }}
              onMouseOut={(e) => {
                if (!isSpeaking) e.target.style.backgroundColor = '#2563eb';
              }}
            >
              <Volume2 style={{ width: '16px', height: '16px' }} />
              {isSpeaking ? 'Speaking...' : 'Play Question'}
            </button>
          </div>

          <div className="flex items-start gap-2 mb-4">
            <h3 className="text-xl font-semibold text-gray-900">{currentQuestion.question_text}</h3>
            {currentQuestion.required && (
              <Badge color="failure" className="text-xs">Required</Badge>
            )}
          </div>

          {/* TTS Speaking Indicator */}
          {isSpeaking && (
            <div className="mb-4 flex items-center gap-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
              <Volume2 className="w-5 h-5 text-blue-600 animate-pulse" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 text-sm">Speaking Prompt</p>
                <p className="text-xs text-blue-700">The system is reading the question aloud</p>
              </div>
              <button
                onClick={() => {
                  speechSynthesis.cancel();
                  setIsSpeaking(false);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Stop
              </button>
            </div>
          )}

          {/* Visual Components */}
          {currentQuestion.visual_components && currentQuestion.visual_components.length > 0 && (
            <div className="space-y-4 mb-6">
              {currentQuestion.visual_components.map((visual, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4">
                  {visual.type === 'image' && visual.image_url && (
                    <img
                      src={visual.image_url}
                      alt={visual.data || 'Visual aid'}
                      className="max-w-full h-auto rounded"
                    />
                  )}
                  {visual.data && <p className="text-gray-700 mt-2">{visual.data}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Select Options */}
          {currentQuestion.select_options && currentQuestion.select_options.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.select_options.map((option, index) => (
                <Button
                  key={index}
                  color={userInput === option.value ? 'blue' : 'light'}
                  onClick={() => handleSelectOption(option.value)}
                  disabled={loading}
                  className="w-full"
                >
                  <div className="text-left w-full">
                    <div className="font-semibold">{option.label}</div>
                    {option.description && (
                      <div className="text-sm opacity-80">{option.description}</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            /* Text/Speech Input */
            <div className="space-y-4">
              {/* Select Options (if available) */}
              {currentQuestion?.select_options && currentQuestion.select_options.length > 0 ? (
                <SelectWithASR
                  options={currentQuestion.select_options}
                  value={userInput}
                  onChange={(value) => {
                    setUserInput(value);
                    // Auto-submit on selection
                    setTimeout(() => submitAnswer(value, 'select'), 100);
                  }}
                  placeholder={`Select or speak ${currentQuestion.slot_name}`}
                  isRecording={isRecording}
                  onStartRecording={startSpeechRecognition}
                  onStopRecording={stopSpeechRecognition}
                />
              ) : inputMode === 'keyboard' ? (
                <div className="space-y-3">
                  {/* Back button above keyboard */}
                  <div className="flex justify-start">
                    <Button
                      color="light"
                      onClick={() => setInputMode('text')}
                      size="sm"
                    >
                      <Keyboard className="w-4 h-4 mr-2" />
                      Back to Type/Speak
                    </Button>
                  </div>
                  <PhoneticKeyboard
                    value={userInput}
                    onChange={setUserInput}
                    onSubmit={() => submitAnswer(userInput.trim(), 'text')}
                    placeholder={`Spell ${currentQuestion?.slot_name || 'answer'} here (NATO/Letter/Number)`}
                    inputMode={currentQuestion?.input_mode}
                  />
                  <Alert color="info">
                    <p className="text-sm">
                      <strong>Spelling Mode:</strong> Use NATO phonetic alphabet (Alpha, Bravo, Charlie),
                      single letters (A, B, C), or numbers for precise input.
                    </p>
                  </Alert>
                </div>
              ) : (
                /* Combined text/speech input with icons inside */
                <form onSubmit={handleTextSubmit} className="space-y-4">
                  <div className="flex gap-2">
                    {/* Spell button (if supported) */}
                    {currentQuestion?.input_mode?.supports_letter_by_letter && (
                      <Button
                        color="light"
                        onClick={() => setInputMode('keyboard')}
                        size="lg"
                        className="flex-shrink-0"
                      >
                        <Keyboard className="w-5 h-5" />
                      </Button>
                    )}

                    {/* Text input with mic icon */}
                    <div className="flex-1 relative">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
                        {/* Microphone button on the left */}
                        <button
                          type="button"
                          onClick={isRecording ? stopSpeechRecognition : startSpeechRecognition}
                          disabled={loading || !recognitionRef.current}
                          className={`
                            flex-shrink-0 px-3 py-3 transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${isRecording
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }
                          `}
                          aria-label={isRecording ? "Stop recording" : "Start recording"}
                        >
                          {isRecording ? (
                            <MicOff className="w-5 h-5" />
                          ) : (
                            <Mic className="w-5 h-5" />
                          )}
                        </button>

                        {/* Text input */}
                        <input
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          placeholder={isRecording ? "Listening..." : "Type or speak your answer..."}
                          disabled={loading}
                          className="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0"
                        />

                        {/* Submit button */}
                        <button
                          type="submit"
                          disabled={loading || !userInput.trim()}
                          className="flex-shrink-0 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white transition-colors"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recording indicator */}
                  {isRecording && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <div className="flex-1">
                          <p className="font-semibold text-red-900 text-sm">Recording Active</p>
                          <p className="text-xs text-red-700">Speak clearly into your microphone</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recognized text display */}
                  {userInput && !isRecording && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-green-900 text-sm">Recognized:</p>
                          <p className="text-gray-900 text-sm">{userInput}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* Remove the old speech mode section since it's now integrated */}
              {false && (
                <div className="space-y-4">
                  {/* Round Voice Button with Glow Effect */}
                  <div className="flex flex-col items-center gap-4 py-6">
                    <button
                      onClick={isRecording ? stopSpeechRecognition : startSpeechRecognition}
                      disabled={loading || !recognitionRef.current}
                      className={`
                        relative rounded-full w-32 h-32 flex items-center justify-center
                        transition-all duration-300 transform hover:scale-105
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${isRecording
                          ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse'
                          : 'bg-blue-500 hover:bg-blue-600 shadow-lg hover:shadow-blue-500/50'
                        }
                      `}
                      aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                      {/* Glow effect when recording */}
                      {isRecording && (
                        <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75"></div>
                      )}

                      {/* Icon */}
                      <div className="relative z-10">
                        {isRecording ? (
                          <MicOff className="w-12 h-12 text-white" />
                        ) : (
                          <Mic className="w-12 h-12 text-white" />
                        )}
                      </div>
                    </button>

                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">
                        {isRecording ? 'Listening...' : 'Tap to Speak'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isRecording ? 'Speak your answer now' : 'Click the microphone to start'}
                      </p>
                    </div>
                  </div>

                  {/* Recording Status */}
                  {isRecording && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                        <div className="flex-1">
                          <p className="font-semibold text-red-900">Recording Active</p>
                          <p className="text-sm text-red-700">Speak clearly into your microphone</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recognized Text */}
                  {userInput && !isRecording && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-green-900 mb-1">Recognized:</p>
                          <p className="text-gray-900">{userInput}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ASR Grammar Info (if available) */}
                  {currentQuestion?.input_mode?.asr_grammar && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-900">
                        <strong>Tip:</strong> Say your answer clearly.
                        {currentQuestion.input_mode.supports_letter_by_letter &&
                          ' You can also spell it letter by letter.'
                        }
                      </p>
                    </div>
                  )}

                  {/* Browser Not Supported */}
                  {!recognitionRef.current && (
                    <Alert color="failure">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      <div>
                        <p className="font-semibold">Speech recognition not available</p>
                        <p className="text-sm mt-1">Please use Chrome, Edge, or Safari for voice input.</p>
                      </div>
                    </Alert>
                  )}

                  {/* Retry Button (shown after timeout or error) */}
                  {!isRecording && error && error.includes('No speech') && (
                    <Button
                      color="blue"
                      onClick={startSpeechRecognition}
                      className="w-full"
                    >
                      <Mic className="w-5 h-5 mr-2" />
                      Try Again
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Confidence Indicator */}
          {confidence !== null && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Confidence</span>
                <span className="text-sm font-semibold">{(confidence * 100).toFixed(0)}%</span>
              </div>
              <Progress
                progress={confidence * 100}
                color={confidence < (currentQuestion.confidence_threshold || 0.7) ? 'red' : 'green'}
              />
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 mt-6 flex-wrap justify-center">
            <Button
              color="light"
              onClick={repeatQuestion}
              className="flex-1 min-w-[140px] max-w-[180px] justify-center"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Rephrase Question
            </Button>
            <Button
              color="blue"
              onClick={testVoice}
              className="flex-1 min-w-[140px] max-w-[180px] justify-center"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Test Voice
            </Button>
            <Button
              color="light"
              onClick={() => setShowVoiceSettings(true)}
              className="flex-1 min-w-[140px] max-w-[180px] justify-center"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Voice Settings
            </Button>
            <Button
              color="light"
              onClick={() => {
                setShowHelpDialog(true);
                connectToOperatorHelp();
              }}
              className="flex-1 min-w-[160px] max-w-[200px] justify-center"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask Operator
            </Button>
            {currentQuestion.faqs && currentQuestion.faqs.length > 0 && (
              <Button color="light" onClick={() => setShowFAQ(!showFAQ)}>
                <HelpCircle className="w-4 h-4 mr-2" />
                FAQ ({currentQuestion.faqs.length})
              </Button>
            )}
          </div>

          {/* FAQs */}
          {showFAQ && currentQuestion.faqs && currentQuestion.faqs.length > 0 && (
            <div className="mt-6 space-y-4 border-t pt-6">
              <h4 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h4>
              {currentQuestion.faqs.map((faq, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <p className="font-semibold text-gray-900 mb-2">Q: {faq.question}</p>
                  <p className="text-gray-700">A: {faq.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert color={error.includes('flagged') ? 'warning' : 'failure'} className="mt-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </Alert>
        )}
      </Card>

      {/* Voice Settings Modal */}
      <Modal show={showVoiceSettings} onClose={() => setShowVoiceSettings(false)} size="lg">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Voice Settings</h3>
          <div className="space-y-6">
            <div>
              <Label htmlFor="voice-select">Select TTS Voice</Label>
              <Select
                id="voice-select"
                value={selectedVoice?.name || ''}
                onChange={(e) => handleVoiceChange(e.target.value)}
              >
                {availableVoices.length === 0 ? (
                  <option>Loading voices...</option>
                ) : (
                  availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))
                )}
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {availableVoices.length} voices available
              </p>

              {/* Test Voice button - UPDATED */}
              <button
                onClick={testVoice}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
              >
                <Volume2 style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                Test Voice
              </button>
            </div>

            {selectedVoice && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Current Voice</h4>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><strong>Name:</strong> {selectedVoice.name}</p>
                  <p><strong>Language:</strong> {selectedVoice.lang}</p>
                  <p><strong>Local Service:</strong> {selectedVoice.localService ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="rate-slider">Speed (Rate)</Label>
                  <span className="text-sm font-semibold text-gray-700">{ttsRate.toFixed(1)}x</span>
                </div>
                <input
                  id="rate-slider"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={ttsRate}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.5x (Slow)</span>
                  <span>1.0x (Normal)</span>
                  <span>2.0x (Fast)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="pitch-slider">Pitch (Tone)</Label>
                  <span className="text-sm font-semibold text-gray-700">{ttsPitch.toFixed(1)}</span>
                </div>
                <input
                  id="pitch-slider"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={ttsPitch}
                  onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.5 (Low)</span>
                  <span>1.0 (Normal)</span>
                  <span>2.0 (High)</span>
                </div>
              </div>
            </div>

            {/* Test Voice and Reset buttons */}
            <div className="flex gap-2">
              <button
                onClick={testVoice}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
              >
                <Volume2 style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                Test Voice
              </button>
              <button
                onClick={() => {
                  handleRateChange(1.0);
                  handlePitchChange(1.0);
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#6b7280',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
              >
                Reset to Default
              </button>
            </div>

            <Alert color="info">
              <p className="text-sm">
                Voice settings are saved locally and will be used for all text-to-speech playback.
                Try different voices and adjust speed and pitch to find what works best for you.
              </p>
            </Alert>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button color="gray" onClick={() => setShowVoiceSettings(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Operator Help Dialog Modal */}
      <Modal show={showHelpDialog} onClose={() => {
        setShowHelpDialog(false);
        if (wsRef.current) {
          wsRef.current.close();
        }
      }} size="lg">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5" />
            <h3 className="text-xl font-semibold text-gray-900">Ask Operator for Help</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Current Question:</strong> {currentQuestion?.question_text}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Slot:</strong> {currentQuestion?.slot_name}
              </p>
            </div>

            {/* Chat Messages */}
            <div className="border rounded-lg p-4 h-64 overflow-y-auto bg-gray-50 space-y-3">
              {operatorMessages.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">
                  No messages yet. An operator will respond shortly...
                </p>
              ) : (
                operatorMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.from === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border'
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.from === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <TextInput
                type="text"
                value={helpMessage}
                onChange={(e) => setHelpMessage(e.target.value)}
                placeholder="Type your question..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendHelpMessage();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={sendHelpMessage}
                disabled={!helpMessage.trim()}
                color="blue"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <Alert color="info">
              <p className="text-sm">
                An operator will see your question and the current dialog slot you're working on.
                They can provide guidance or clarification about what information is needed.
              </p>
            </Alert>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button color="gray" onClick={() => {
              setShowHelpDialog(false);
              if (wsRef.current) {
                wsRef.current.close();
              }
            }}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Enable Audio Prompt Modal */}
      {showAudioPrompt && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '500px',
          width: '90%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Volume2 style={{ width: '32px', height: '32px', color: '#3b82f6' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0, color: '#111827' }}>Enable Audio</h2>
          </div>
          <p style={{ color: '#4b5563', marginBottom: '16px', lineHeight: '1.6' }}>
            This application uses text-to-speech to read questions aloud.
            Click the button below to enable audio playback.
          </p>
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '14px', color: '#1e40af', margin: 0 }}>
              Your browser requires user interaction before playing audio.
              This is a security feature to prevent websites from auto-playing sounds.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAudioPrompt(false);
              setAudioEnabled(true);
              speakText("Audio enabled. I will now read questions aloud.", {});
            }}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Volume2 style={{ width: '20px', height: '20px' }} />
            Enable Audio & Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default MultimodalDialog;
