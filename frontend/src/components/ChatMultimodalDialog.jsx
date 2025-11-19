/**
 * ChatMultimodalDialog Component
 *
 * Enhanced multimodal dialog with ChatGPT-style interface
 * Combines the functionality of MultimodalDialog with ChatDialogView
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge, Alert } from 'flowbite-react';
import { Users, AlertTriangle, Settings, HelpCircle, Volume2, VolumeX, Play } from 'lucide-react';
import VirtualKeyboard from './VirtualKeyboard';

const API_BASE_URL = '/api';

// Inline ChatDialogView component (simplified for integration)
const ChatDialogView = ({
  messages,
  onSendMessage,
  onRequestHelp,
  onDocumentUpload,
  isRecording,
  loading,
  sessionId,
  ttsEnabled,
  ttsOnHold,
  onToggleTTS,
  onResumeTTS,
  onResetTTS,
  onTestTTS,
  selectedVoice,
  availableVoices,
  onVoiceChange,
  onStartSpeechRecognition,
  onStopSpeechRecognition,
  currentQuestion, // Pass the current question to determine input type
  virtualKeyboardProcessorRef // Ref to store the processor callback
}) => {
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState('text');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const settingsMenuRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);

  // Show/hide virtual keyboard based on recording state and question type
  useEffect(() => {
    if (isRecording && currentQuestion) {
      // Determine if this question needs virtual keyboard
      const needsKeyboard = currentQuestion.spelling_required === true ||
                           currentQuestion.input_mode === 'text' ||
                           currentQuestion.input_mode === 'alphanumeric' ||
                           currentQuestion.input_mode === 'numeric' ||
                           currentQuestion.question_type === 'text';

      if (needsKeyboard) {
        console.log('📱 Showing virtual keyboard for question:', currentQuestion.question_id,
                    '(spelling_required:', currentQuestion.spelling_required, ')');
        setShowVirtualKeyboard(true);
      }
    } else {
      setShowVirtualKeyboard(false);
    }
  }, [isRecording, currentQuestion]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onDocumentUpload) {
      await onDocumentUpload(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const renderMessage = (message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const isOperator = message.type === 'operator';

    return (
      <div
        key={message.id}
        className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
            isUser ? 'bg-blue-600' : isOperator ? 'bg-green-600' : 'bg-purple-600'
          }`}>
            {isUser ? 'U' : isOperator ? 'O' : 'S'}
          </div>
        </div>

        {/* Message Bubble */}
        <div className={`flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-600">
              {isUser ? 'You' : isOperator ? 'Operator' : 'System'}
            </span>
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.confidence && (
              <Badge
                color={message.confidence < 0.7 ? 'failure' : message.confidence < 0.85 ? 'warning' : 'success'}
                size="xs"
              >
                {(message.confidence * 100).toFixed(0)}%
              </Badge>
            )}
          </div>

          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : isOperator
                ? 'bg-green-100 text-gray-900 rounded-tl-sm border border-green-300'
                : 'bg-gray-100 text-gray-900 rounded-tl-sm'
            }`}
          >
            {message.htmlContent ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: message.htmlContent }}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}

            {/* Options for select questions */}
            {message.options && message.options.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => onSendMessage(option.value || option.label)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-sm transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Insurance Quote Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          {sessionId && (
            <Badge color="light" size="sm">
              {sessionId.slice(0, 8)}
            </Badge>
          )}
          {/* Resume Button (appears when TTS is on hold after 4 rephrase attempts) */}
          {ttsOnHold && (
            <button
              onClick={onResumeTTS}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 animate-pulse"
              title="Resume TTS"
            >
              <Play className="w-4 h-4 fill-white" />
              <span className="text-sm font-medium">Resume</span>
            </button>
          )}
          {/* Settings Cog Icon with Dropdown */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Settings Dropdown Menu */}
            {showSettingsMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                {/* Voice Selector */}
                <div className="px-4 py-2 border-b border-gray-100">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    TTS Voice
                  </label>
                  <select
                    value={selectedVoice?.name || ''}
                    onChange={(e) => {
                      const voice = availableVoices?.find(v => v.name === e.target.value);
                      if (voice && onVoiceChange) {
                        onVoiceChange(voice);
                        console.log('🎙 Voice changed to:', voice.name, '(', voice.lang, ')');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {availableVoices && availableVoices.length > 0 ? (
                      availableVoices.map((voice, index) => (
                        <option key={index} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))
                    ) : (
                      <option value="">No voices available</option>
                    )}
                  </select>
                  {selectedVoice && (
                    <div className="mt-1 text-xs text-gray-500">
                      {selectedVoice.localService ? '📱 Local' : '☁️ Remote'} • {selectedVoice.lang}
                    </div>
                  )}
                </div>

                {/* Reset Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('🔧 Reset button clicked!');
                    if (onResetTTS) {
                      onResetTTS();
                    } else {
                      console.error('❌ onResetTTS is not defined');
                    }
                    setShowSettingsMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-orange-800 hover:bg-orange-50 transition-colors flex items-center gap-2"
                  title="Reset Speech Synthesis (fixes Chrome bugs)"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Reset TTS
                </button>

                {/* Test Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('🧪 Test button clicked!');
                    if (onTestTTS) {
                      onTestTTS();
                    } else {
                      console.error('❌ onTestTTS is not defined');
                    }
                    setShowSettingsMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-yellow-800 hover:bg-yellow-50 transition-colors flex items-center gap-2"
                  title="Test TTS (for debugging)"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  Test TTS
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">Start a conversation...</p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}

        {loading && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
              S
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          {/* TTS Toggle Button */}
          <button
            onClick={onToggleTTS}
            className={`flex-shrink-0 p-3 rounded-xl transition-all ${
              ttsEnabled
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title={ttsEnabled ? 'TTS enabled - click to disable' : 'TTS disabled - click to enable'}
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Text Input Box with Icons Inside */}
          <div className="flex-1 relative flex items-center bg-gray-50 border border-gray-300 rounded-3xl focus-within:bg-white focus-within:border-gray-400 transition-all">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* File Upload Icon (Inside Left) */}
            <button
              onClick={triggerFileUpload}
              className="pl-5 pr-3 py-4 text-gray-500 hover:text-gray-700 transition-colors"
              title="Upload document"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </button>

            {/* Text Input */}
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="It's faster to upload the (Driving Licence)"
              rows="1"
              className="flex-1 py-4 px-3 bg-transparent resize-none outline-none border-none focus:ring-0 text-base"
              style={{ minHeight: '56px', maxHeight: '150px' }}
            />

            {/* Microphone Icon (Inside Right) - Speech Input Toggle */}
            <button
              onClick={() => {
                console.log('🎤 Microphone button clicked, isRecording:', isRecording);
                if (isRecording) {
                  if (onStopSpeechRecognition) {
                    onStopSpeechRecognition();
                  } else {
                    console.error('❌ onStopSpeechRecognition not provided');
                  }
                } else {
                  if (onStartSpeechRecognition) {
                    onStartSpeechRecognition();
                  } else {
                    console.error('❌ onStartSpeechRecognition not provided');
                  }
                }
              }}
              className={`px-3 py-4 transition-colors ${
                isRecording
                  ? 'text-red-600 hover:text-red-700 animate-pulse'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || loading}
            className={`flex-shrink-0 p-4 rounded-2xl transition-all ${
              inputValue.trim() && !loading
                ? 'bg-gray-800 text-white hover:bg-gray-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Send message"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-2 text-center">
          Press Enter to send • Shift+Enter for new line • Click ? for operator help
        </p>
      </div>

      {/* Virtual Keyboard - Shows when speech recording is active */}
      {showVirtualKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <VirtualKeyboard
              value={inputValue}
              onValueChange={(newValue) => {
                setInputValue(newValue);
                console.log('📝 Virtual keyboard input:', newValue);
              }}
              onClose={() => {
                setShowVirtualKeyboard(false);
                if (onStopSpeechRecognition) {
                  onStopSpeechRecognition();
                }
              }}
              onSubmit={(finalValue) => {
                console.log('✅ Virtual keyboard submit:', finalValue);
                onSendMessage(finalValue);
                setInputValue('');
                setShowVirtualKeyboard(false);
                if (onStopSpeechRecognition) {
                  onStopSpeechRecognition();
                }
              }}
              showPhonetic={true}
              keyboardType={
                currentQuestion?.input_mode === 'numeric' ? 'numeric' : 'alphanumeric'
              }
              placeholder={currentQuestion?.question_text || 'Speak using NATO alphabet...'}
              onSpeechRecognized={(processor) => {
                // Store the processor callback in parent ref
                if (virtualKeyboardProcessorRef) {
                  virtualKeyboardProcessorRef.current = processor;
                  console.log('📱 Virtual keyboard processor registered');
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ChatMultimodalDialog = () => {
  // Session management
  const [sessions, setSessions] = useState([
    { id: null, label: 'Session 1', active: true, messages: [], needsAttention: false },
    { id: null, label: 'Session 2', active: false, messages: [], needsAttention: false },
    { id: null, label: 'Session 3', active: false, messages: [], needsAttention: false },
    { id: null, label: 'Session 4', active: false, messages: [], needsAttention: false },
    { id: null, label: 'Session 5', active: false, messages: [], needsAttention: false }
  ]);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentVariantIndex, setCurrentVariantIndex] = useState(0);
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'speech'
  const [isRecording, setIsRecording] = useState(false);

  // TTS state
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rephraseCount, setRephraseCount] = useState(0);
  const [ttsOnHold, setTtsOnHold] = useState(false);

  const wsRef = useRef(null);
  const rephraseTimerRef = useRef(null);
  const snoreTimerRef = useRef(null);
  const lastInputTimeRef = useRef(Date.now());
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastSpokenQuestionIdRef = useRef(null);
  const virtualKeyboardProcessorRef = useRef(null);

  // Load existing session or start new one
  useEffect(() => {
    const activeSession = sessions[activeSessionIndex];
    if (!activeSession.id) {
      startSession();
    } else {
      setSessionId(activeSession.id);
      setMessages(activeSession.messages || []);
    }
  }, [activeSessionIndex]);

  // WebSocket for operator messages
  useEffect(() => {
    if (!sessionId) return;

    const wsUrl = `ws://localhost:8000/ws/${sessionId}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'operator_message') {
        addOperatorMessage(data.message, data.operator_id);
      } else if (data.type === 'attention_required') {
        markSessionNeedsAttention();
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-GB';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;

        console.log('🎤 Speech recognized:', transcript, 'Confidence:', confidence);

        // If virtual keyboard is active, pass to its processor
        if (virtualKeyboardProcessorRef.current) {
          console.log('📱 Passing to virtual keyboard processor:', transcript);
          const handled = virtualKeyboardProcessorRef.current(transcript);
          console.log('📱 Virtual keyboard processor returned:', handled);
          if (handled) {
            console.log('✅ Virtual keyboard handled the speech input');
            // Continue listening for next word
            if (isRecording && recognitionRef.current) {
              setTimeout(() => {
                try {
                  recognitionRef.current.start();
                } catch (err) {
                  console.log('Recognition already started');
                }
              }, 300);
            }
            return;
          } else {
            console.log('❌ Virtual keyboard did NOT handle:', transcript);
          }
        } else {
          console.log('📱 No virtual keyboard processor registered');
        }

        // Otherwise, handle normally
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
            errorMessage = 'Network error: Speech recognition service temporarily unavailable.';
            break;
          case 'aborted':
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
    }
  }, []);

  // Initialize TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = speechSynthesis.getVoices();
      console.log('📢 Loading TTS voices... Found:', allVoices.length, 'voices');

      if (allVoices.length === 0) {
        console.log('⏳ No voices loaded yet, waiting...');
        return; // Wait for onvoiceschanged event
      }

      console.log('All available voices:', allVoices.map(v => `${v.name} (${v.lang})`));

      const voices = allVoices.filter(v => v.lang.startsWith('en') || v.lang.startsWith('de'));

      setAvailableVoices(voices);

      // Priority 1: Exact match "Google UK English Female"
      let defaultVoice = voices.find(v => v.name === 'Google UK English Female');

      if (defaultVoice) {
        console.log('✓ Found exact match: Google UK English Female');
      }

      // Priority 2: Google + UK + Female + en-GB
      if (!defaultVoice) {
        defaultVoice = voices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes('google') &&
                 name.includes('uk') &&
                 name.includes('female') &&
                 v.lang === 'en-GB';
        });
        if (defaultVoice) console.log('✓ Found Google UK Female voice:', defaultVoice.name);
      }

      // Priority 3: Any Google UK voice
      if (!defaultVoice) {
        defaultVoice = voices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes('google') && v.lang === 'en-GB';
        });
        if (defaultVoice) console.log('✓ Found Google UK voice:', defaultVoice.name);
      }

      // Priority 4: Any en-GB Female voice
      if (!defaultVoice) {
        defaultVoice = voices.find(v => {
          const name = v.name.toLowerCase();
          return v.lang === 'en-GB' && name.includes('female');
        });
        if (defaultVoice) console.log('✓ Found en-GB Female voice:', defaultVoice.name);
      }

      // Priority 5: Any en-GB voice
      if (!defaultVoice) {
        defaultVoice = voices.find(v => v.lang === 'en-GB');
        if (defaultVoice) console.log('✓ Found en-GB voice:', defaultVoice.name);
      }

      // Priority 6: Any en-US voice
      if (!defaultVoice) {
        defaultVoice = voices.find(v => v.lang === 'en-US');
        if (defaultVoice) console.log('⚠ Fallback to en-US voice:', defaultVoice.name);
      }

      // Priority 7: First available voice
      if (!defaultVoice && voices.length > 0) {
        defaultVoice = voices[0];
        console.log('⚠ Using first available voice:', defaultVoice.name);
      }

      if (defaultVoice) {
        setSelectedVoice(defaultVoice);
        console.log('✅ SELECTED TTS VOICE:', defaultVoice.name, '(', defaultVoice.lang, ')');
      } else {
        console.error('❌ No suitable TTS voice found');
      }
    };

    // Initial load
    loadVoices();

    // Also load when voices change (Chrome loads voices asynchronously)
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Fallback: try again after a delay
    const timeout = setTimeout(loadVoices, 100);

    return () => clearTimeout(timeout);
  }, []);

  // Force reset speech synthesis (Chrome bug workaround)
  const resetSpeechSynthesis = useCallback(() => {
    console.log('🔄 Force resetting Speech Synthesis to Google UK English Female...');
    console.log('⚠️ If this doesn\'t work, you need to clear Chrome cache:');
    console.log('1. Close ALL Chrome windows');
    console.log('2. Delete: ~/Library/Caches/Google/Chrome/Default/Code Cache/');
    console.log('3. Delete: ~/Library/Application Support/Google/Chrome/Default/File System/');
    console.log('4. Restart Chrome');

    // Cancel everything
    speechSynthesis.cancel();

    // Force reload voices
    const voices = speechSynthesis.getVoices();
    console.log('Available voices after reset:', voices.length);

    // Multiple dummy utterances to clear the queue
    for (let i = 0; i < 3; i++) {
      const dummy = new SpeechSynthesisUtterance('');
      speechSynthesis.speak(dummy);
    }
    speechSynthesis.cancel();

    // Reset to Google UK English Female (Priority 1)
    if (window.speechSynthesis.getVoices().length > 0) {
      const allVoices = window.speechSynthesis.getVoices();

      // Priority 1: Exact match "Google UK English Female"
      let defaultVoice = allVoices.find(v => v.name === 'Google UK English Female');

      // Priority 2: Google + UK + Female + en-GB
      if (!defaultVoice) {
        defaultVoice = allVoices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes('google') &&
                 name.includes('uk') &&
                 name.includes('female') &&
                 v.lang === 'en-GB';
        });
      }

      // Priority 3: Any Google UK voice
      if (!defaultVoice) {
        defaultVoice = allVoices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes('google') && v.lang === 'en-GB';
        });
      }

      // Priority 4: Local en-GB voice as fallback
      if (!defaultVoice) {
        defaultVoice = allVoices.find(v => v.localService && v.lang === 'en-GB');
      }

      if (defaultVoice) {
        setSelectedVoice(defaultVoice);
        console.log('✅ Reset to voice:', defaultVoice.name, '(', defaultVoice.lang, ')');
      } else {
        console.warn('⚠️ Could not find Google UK English Female voice');
      }
    }

    console.log('✅ Speech Synthesis reset complete');
  }, []);

  // TTS speak function
  const speakText = useCallback((text) => {
    if (!ttsEnabled || !text) {
      console.log('🔇 TTS disabled or no text');
      return;
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('🎙 speakText called with:', text.substring(0, 50));
    console.log('📊 Current selectedVoice state:', selectedVoice?.name || 'NONE');
    console.log('📊 Available voices count:', availableVoices?.length || 0);

    if (!selectedVoice) {
      console.warn('⚠️  WARNING: No voice selected yet, speech may use browser default');
    }

    // Only cancel if currently speaking (not pending)
    if (speechSynthesis.speaking) {
      console.log('⏹ Canceling current speech');
      speechSynthesis.cancel();

      // Wait for cancel to complete
      setTimeout(() => {
        actuallySpeak(text);
      }, 300);
    } else {
      actuallySpeak(text);
    }

    function actuallySpeak(text) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.volume = 1.0;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      console.log('🔍 BEFORE setting voice on utterance:');
      console.log('   selectedVoice from state:', selectedVoice?.name || 'NULL');
      console.log('   selectedVoice object:', selectedVoice);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('✅ Voice SET on utterance:', selectedVoice.name, '(', selectedVoice.lang, ')');
        console.log('   Voice object:', selectedVoice);
        console.log('   Is local service:', selectedVoice.localService);
        console.log('   Voice URI:', selectedVoice.voiceURI);
      } else {
        console.warn('❌ CRITICAL: No voice selected! Using browser default');
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        console.log('▶️ Speech started');
        console.log('   Actually using voice:', utterance.voice?.name || 'DEFAULT BROWSER VOICE');
        console.log('   Voice lang:', utterance.voice?.lang || utterance.lang);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        console.log('⏹ Speech ended normally');
      };
      utterance.onerror = (e) => {
        setIsSpeaking(false);
        console.error('❌ Speech error:', e.error, e);

        // If Google voice fails, try with local voice
        if (selectedVoice && !selectedVoice.localService && e.error === 'network') {
          console.log('🔄 Google voice failed, trying local voice...');
          const localVoice = availableVoices.find(v => v.lang === 'en-GB' && v.localService);
          if (localVoice) {
            const retryUtterance = new SpeechSynthesisUtterance(text);
            retryUtterance.voice = localVoice;
            retryUtterance.lang = 'en-GB';
            speechSynthesis.speak(retryUtterance);
          }
        }
      };

      console.log('🔊 Speaking now...');
      speechSynthesis.speak(utterance);

      // Chrome workaround: Resume if paused (known bug)
      setTimeout(() => {
        if (speechSynthesis.paused) {
          console.log('⏯ Resuming paused speech (Chrome bug)');
          speechSynthesis.resume();
        }
      }, 100);
    }
  }, [ttsEnabled, selectedVoice, availableVoices]);

  // Auto-rephrase timer (every 60 seconds of no input)
  useEffect(() => {
    if (!currentQuestion || !ttsEnabled || ttsOnHold) {
      console.log('Auto-rephrase disabled:', { hasQuestion: !!currentQuestion, ttsEnabled, ttsOnHold });
      return;
    }

    console.log('Auto-rephrase timer started for question:', currentQuestion.question_id);

    const checkRephrase = () => {
      const timeSinceInput = Date.now() - lastInputTimeRef.current;
      console.log('Checking rephrase... Time since input:', Math.round(timeSinceInput / 1000), 'seconds');

      if (timeSinceInput >= 60000) {
        // 60 seconds = rephrase
        console.log('⏰ Triggering auto-rephrase (60 seconds passed)');
        handleRephrase();
        lastInputTimeRef.current = Date.now();
      }
    };

    rephraseTimerRef.current = setInterval(checkRephrase, 10000); // Check every 10 seconds

    return () => {
      if (rephraseTimerRef.current) {
        clearInterval(rephraseTimerRef.current);
        console.log('Auto-rephrase timer cleared');
      }
    };
  }, [currentQuestion, ttsEnabled, ttsOnHold]);

  // Snore sound timer (plays every 5 minutes when TTS is on hold)
  useEffect(() => {
    if (!ttsOnHold) {
      // Clear any existing snore timer when TTS is not on hold
      if (snoreTimerRef.current) {
        clearInterval(snoreTimerRef.current);
        snoreTimerRef.current = null;
        console.log('😴 Snore timer cleared');
      }
      return;
    }

    console.log('😴 Starting snore timer - will play every 5 minutes during autopause');

    const playSnore = () => {
      try {
        const snoreAudio = new Audio('/sounds/snore.wav');
        snoreAudio.volume = 0.5; // 50% volume
        snoreAudio.play().catch(err => {
          console.warn('😴 Could not play snore sound:', err.message);
        });
        console.log('😴 *SNORE* Playing snore sound...');
      } catch (err) {
        console.warn('😴 Error creating snore audio:', err.message);
      }
    };

    // Play immediately when entering autopause
    playSnore();

    // Then play every 5 minutes (300000ms)
    snoreTimerRef.current = setInterval(playSnore, 300000);

    return () => {
      if (snoreTimerRef.current) {
        clearInterval(snoreTimerRef.current);
        snoreTimerRef.current = null;
        console.log('😴 Snore timer cleared');
      }
    };
  }, [ttsOnHold]);

  const startSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    try {
      setError(null);
      console.log('Starting speech recognition...');

      // Stop any current TTS
      speechSynthesis.cancel();

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          console.log('Microphone access granted');
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

  const handleSpeechResult = (transcript, confidence) => {
    setIsRecording(false);

    // Send the transcript as a message
    handleSendMessage(transcript);
  };

  const handleRephrase = () => {
    console.log('handleRephrase called');
    console.log('currentQuestion:', currentQuestion);
    console.log('rephraseCount:', rephraseCount);

    if (!currentQuestion || !currentQuestion.tts) {
      console.warn('Cannot rephrase: missing question or TTS data');
      return;
    }

    // Check if we've already rephrased 4 times
    if (rephraseCount >= 4) {
      console.log('⏸️ Reached 4 rephrase attempts, putting TTS on hold');
      setTtsOnHold(true);
      speechSynthesis.cancel(); // Stop any current speech
      addSystemMessage('⏸️ Waiting for your response... Press "Resume" when ready to continue.');
      return;
    }

    // Build variants array from tts.variant1, variant2, variant3, variant4
    const variants = [];
    if (currentQuestion.tts.variant1) variants.push(currentQuestion.tts.variant1);
    if (currentQuestion.tts.variant2) variants.push(currentQuestion.tts.variant2);
    if (currentQuestion.tts.variant3) variants.push(currentQuestion.tts.variant3);
    if (currentQuestion.tts.variant4) variants.push(currentQuestion.tts.variant4);

    console.log('TTS variants found:', variants);

    // Fallback to main question text if no variants
    if (variants.length === 0 && currentQuestion.question_text) {
      variants.push(currentQuestion.question_text);
      console.log('No variants found, using main question text');
    }

    if (variants.length === 0) {
      console.warn('No variants available for rephrasing');
      return;
    }

    const nextIndex = (currentVariantIndex + 1) % variants.length;
    setCurrentVariantIndex(nextIndex);

    // Calculate new count before updating state
    const newCount = rephraseCount + 1;
    setRephraseCount(newCount);

    const rephraseText = variants[nextIndex];
    console.log(`🔄 Rephrasing with variant ${nextIndex + 1} (attempt ${newCount}/4):`, rephraseText);

    speakText(rephraseText);
    addSystemMessage(`🔄 Let me rephrase (${newCount}/4): ${rephraseText}`);
  };

  const handleResume = () => {
    console.log('▶️ Resume button clicked - restarting TTS');
    setRephraseCount(0);
    setTtsOnHold(false);
    lastInputTimeRef.current = Date.now(); // Reset timer

    // Re-speak the current question
    if (currentQuestion && currentQuestion.tts) {
      const variants = [];
      if (currentQuestion.tts.variant1) variants.push(currentQuestion.tts.variant1);
      if (currentQuestion.tts.variant2) variants.push(currentQuestion.tts.variant2);
      if (currentQuestion.tts.variant3) variants.push(currentQuestion.tts.variant3);
      if (currentQuestion.tts.variant4) variants.push(currentQuestion.tts.variant4);

      const textToSpeak = variants[0] || currentQuestion.question_text;
      speakText(textToSpeak);
      addSystemMessage('▶️ Resuming: ' + textToSpeak);
    }
  };

  const startSession = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/session/start`, {
        method: 'POST',
      });
      const data = await response.json();

      const updatedSessions = [...sessions];
      updatedSessions[activeSessionIndex] = {
        ...updatedSessions[activeSessionIndex],
        id: data.session_id
      };
      setSessions(updatedSessions);
      setSessionId(data.session_id);

      // Add welcome message
      addSystemMessage('Welcome! Let\'s help you get an insurance quote. I\'ll ask you a few questions.');

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
        addSystemMessage('✓ All questions completed! Thank you for providing your information.');
        return;
      }

      setCurrentQuestion(data);
      setCurrentVariantIndex(0);

      // Add question as system message
      const questionMessage = {
        id: Date.now(),
        type: 'system',
        content: data.question_text,
        timestamp: new Date(),
        questionId: data.question_id,
        confidence: null,
        options: data.input_type === 'select' ? data.options : null,
        htmlContent: data.html_content || null
      };

      addMessage(questionMessage);

      // Speak the question if TTS is enabled (only if not already spoken)
      if (ttsEnabled && data.question_text && lastSpokenQuestionIdRef.current !== data.question_id) {
        console.log('🔊 Speaking question:', data.question_id);
        lastSpokenQuestionIdRef.current = data.question_id;
        setTimeout(() => speakText(data.question_text), 500);
      } else if (lastSpokenQuestionIdRef.current === data.question_id) {
        console.log('⏭ Skipping speech - already spoken this question:', data.question_id);
      }

      // Reset input timer and rephrase counter for new question
      lastInputTimeRef.current = Date.now();
      setCurrentVariantIndex(0); // Reset variant index for new question
      setRephraseCount(0); // Reset rephrase counter
      setTtsOnHold(false); // Resume TTS if it was on hold
    } catch (err) {
      setError('Failed to load question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (messageText) => {
    if (!sessionId || !currentQuestion) return;

    // Reset input timer when user sends a message
    lastInputTimeRef.current = Date.now();
    setRephraseCount(0); // Reset rephrase counter when user responds
    setTtsOnHold(false); // Resume TTS if it was on hold

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };
    addMessage(userMessage);

    // Submit answer to backend
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/session/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion.question_id,
          answer: messageText,
          input_mode: 'text'
        })
      });

      const data = await response.json();

      // Add confidence feedback if available
      if (data.confidence !== undefined) {
        const feedbackMessage = {
          id: Date.now() + 1,
          type: 'system',
          content: data.confidence < 0.7
            ? '⚠️ I\'m not very confident about that answer. An operator may review it.'
            : data.confidence < 0.85
            ? '✓ Answer recorded.'
            : '✓ Great, got it!',
          timestamp: new Date(),
          confidence: data.confidence
        };
        addMessage(feedbackMessage);
      }

      // Load next question
      await loadCurrentQuestion(sessionId);
    } catch (err) {
      setError('Failed to submit answer: ' + err.message);
      addSystemMessage('❌ Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestHelp = async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_BASE_URL}/session/${sessionId}/request-help`, {
        method: 'POST'
      });

      addSystemMessage('🆘 Help request sent to operator. They will assist you shortly.');
    } catch (err) {
      setError('Failed to request help: ' + err.message);
    }
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);

    // Update session messages
    const updatedSessions = [...sessions];
    updatedSessions[activeSessionIndex] = {
      ...updatedSessions[activeSessionIndex],
      messages: [...(updatedSessions[activeSessionIndex].messages || []), message]
    };
    setSessions(updatedSessions);
  };

  const addSystemMessage = (content, metadata = {}) => {
    const message = {
      id: Date.now(),
      type: 'system',
      content,
      timestamp: new Date(),
      ...metadata
    };
    addMessage(message);
  };

  const addOperatorMessage = (content, operatorId = 'Operator') => {
    const message = {
      id: Date.now(),
      type: 'operator',
      content,
      operatorId,
      timestamp: new Date()
    };
    addMessage(message);

    // Clear attention flag
    const updatedSessions = [...sessions];
    updatedSessions[activeSessionIndex].needsAttention = false;
    setSessions(updatedSessions);
  };

  const markSessionNeedsAttention = () => {
    const updatedSessions = [...sessions];
    updatedSessions[activeSessionIndex].needsAttention = true;
    setSessions(updatedSessions);
  };

  const handleDocumentUpload = async (file) => {
    if (!file || !sessionId || !currentQuestion) return;

    try {
      setLoading(true);
      addSystemMessage(`📄 Uploading ${file.name}...`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', 'auto'); // Auto-detect document type

      const response = await fetch(`${API_BASE_URL}/document/upload-and-extract`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        addSystemMessage(
          `✓ Document processed! Extracted ${Object.keys(data.extracted_fields || {}).length} fields.`,
          { extractedFields: data.extracted_fields }
        );

        // Auto-fill current question if matching field found
        const questionSlot = currentQuestion.slot_name;
        if (data.extracted_fields && data.extracted_fields[questionSlot]) {
          await handleSendMessage(data.extracted_fields[questionSlot]);
        }
      } else {
        addSystemMessage(`⚠️ Failed to process document: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Failed to upload document: ' + err.message);
      addSystemMessage(`❌ Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTTS = () => {
    setTtsEnabled(!ttsEnabled);
    if (!ttsEnabled) {
      addSystemMessage('🔊 TTS enabled - questions will be spoken aloud');
    } else {
      speechSynthesis.cancel(); // Stop any current speech
      addSystemMessage('🔇 TTS disabled');
    }
  };

  const switchSession = (index) => {
    if (index === activeSessionIndex) return;

    setActiveSessionIndex(index);
    const session = sessions[index];
    setSessionId(session.id);
    setMessages(session.messages || []);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Session Switcher */}
      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Active Sessions</span>
        </div>
        <div className="flex gap-3">
          {sessions.map((session, index) => (
            <div key={index} className="flex-1 relative">
              {session.needsAttention && index !== activeSessionIndex && (
                <div className="absolute -top-2 -right-2 z-10">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                </div>
              )}

              <Button
                color={activeSessionIndex === index ? 'blue' : session.needsAttention ? 'failure' : 'light'}
                size="sm"
                onClick={() => switchSession(index)}
                className="w-full"
              >
                <div className="flex flex-col items-center w-full">
                  <span className="font-semibold">{session.label}</span>
                  {session.id ? (
                    <Badge
                      color={
                        session.needsAttention ? 'failure' :
                        activeSessionIndex === index ? 'success' :
                        'info'
                      }
                      size="xs"
                      className="mt-1"
                    >
                      {session.needsAttention ? 'Needs Attention' : activeSessionIndex === index ? 'Active' : 'Started'}
                    </Badge>
                  ) : (
                    <Badge color="gray" size="xs" className="mt-1">
                      Not Started
                    </Badge>
                  )}
                </div>
              </Button>
            </div>
          ))}
        </div>

        {sessions.some((s, i) => s.needsAttention && i !== activeSessionIndex) && (
          <Alert color="warning" className="mt-3">
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">
                Another session needs operator response. Click to switch.
              </span>
            </div>
          </Alert>
        )}
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      {/* Chat Interface */}
      <ChatDialogView
        messages={messages}
        onSendMessage={handleSendMessage}
        onRequestHelp={handleRequestHelp}
        onDocumentUpload={handleDocumentUpload}
        isRecording={isRecording}
        loading={loading}
        sessionId={sessionId}
        ttsEnabled={ttsEnabled}
        ttsOnHold={ttsOnHold}
        onToggleTTS={handleToggleTTS}
        onResumeTTS={handleResume}
        onResetTTS={resetSpeechSynthesis}
        onTestTTS={() => {
          console.log('🧪 Test TTS button clicked');
          console.log('Selected voice:', selectedVoice);
          speakText('Test. This is a test of the text to speech system.');
        }}
        selectedVoice={selectedVoice}
        availableVoices={availableVoices}
        onVoiceChange={(voice) => {
          console.log('═══════════════════════════════════════════════════');
          console.log('🔧 onVoiceChange callback triggered');
          console.log('   New voice:', voice.name, '(', voice.lang, ')');
          console.log('   Voice object:', voice);
          console.log('   Is local service:', voice.localService);
          console.log('   Voice URI:', voice.voiceURI);
          console.log('   Previous voice:', selectedVoice?.name || 'NONE');
          setSelectedVoice(voice);
          console.log('✅ setSelectedVoice() called - state should update on next render');
          console.log('═══════════════════════════════════════════════════');
        }}
        onStartSpeechRecognition={startSpeechRecognition}
        onStopSpeechRecognition={stopSpeechRecognition}
        currentQuestion={currentQuestion}
        virtualKeyboardProcessorRef={virtualKeyboardProcessorRef}
      />
    </div>
  );
};

export default ChatMultimodalDialog;
