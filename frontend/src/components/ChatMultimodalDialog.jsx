/**
 * ChatMultimodalDialog Component
 *
 * Enhanced multimodal dialog with ChatGPT-style interface
 * Combines the functionality of MultimodalDialog with ChatDialogView
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge, Alert } from 'flowbite-react';
import { Users, AlertTriangle, Settings, HelpCircle, Volume2, VolumeX, Play, Calendar } from 'lucide-react';
import VirtualKeyboard from './VirtualKeyboard';
import SmartSelectWithSearch from './SmartSelectWithSearch';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseDateFromSpeech, parseDateComponent } from '../utils/DateParser';
import { generateDateGrammar, getDateFormatExamples } from '../utils/DateGrammarGenerator';
import DocumentFastTrack from './DocumentFastTrack';
import EmailVoiceKeyboard from './EmailVoiceKeyboard';
import UKDrivingLicenceInput from './UKDrivingLicenceInput';

import { getOptionsByVodflag, vodflagMapping } from '../utils/carInsuranceOptions';

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

  // Memoized registration to avoid repeated logs/registrations on re-render
  const registerVirtualKeyboardProcessor = useCallback((processor) => {
    if (!virtualKeyboardProcessorRef) return;
    if (virtualKeyboardProcessorRef.current !== processor) {
      virtualKeyboardProcessorRef.current = processor;
      console.log('📱 Virtual keyboard processor registered');
    }
  }, [virtualKeyboardProcessorRef]);

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

  // Clear processor when the keyboard hides to prevent stale handlers
  useEffect(() => {
    if (!showVirtualKeyboard && virtualKeyboardProcessorRef) {
      virtualKeyboardProcessorRef.current = null;
    }
  }, [showVirtualKeyboard, virtualKeyboardProcessorRef]);

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
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${isUser ? 'bg-blue-600' : isOperator ? 'bg-green-600' : 'bg-purple-600'
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
            className={`rounded-2xl px-4 py-3 ${isUser
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

            {/* Options for select questions - Use SmartSelectWithSearch for better UX */}
            {message.options && message.options.length > 0 && (
              message.options.length > 5 ? (
                <div className="mt-3">
                  <SmartSelectWithSearch
                    options={message.options}
                    value={null}
                    onChange={(option) => onSendMessage(option.value || option.label)}
                    onVoiceSearch={(callback) => {
                      // Trigger voice search for this select
                      if (onStartSpeechRecognition) {
                        onStartSpeechRecognition();
                        // The speech result will be handled by the main speech handler
                      }
                    }}
                    placeholder="Search or speak to find..."
                    maxInitialDisplay={20}
                    enableVoiceSearch={true}
                    enableKeyboardSearch={true}
                    isDependent={message.cascading?.is_dependent}
                    parentValue={message.cascading?.parent_question_id ? answers[message.cascading.parent_question_id] : null}
                  />
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {message.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(option.value || option.label)}
                      className="w-full text-left px-2 py-1 rounded bg-white hover:bg-gray-50 border border-gray-200 text-sm transition-colors"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )
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
        {/* Documents Fast Track Section - Shows for documents_fast_track section type */}
        {currentQuestion && currentQuestion.section_type === 'documents_fast_track' && (
          <DocumentFastTrack
            documentsRequested={currentQuestion.documents_requested || []}
            onDocumentsExtracted={async (data) => {
              console.log('📄 Documents extracted:', data);

              // Optimistically update answers with extracted data
              setAnswers(prev => ({
                ...prev,
                ...data
              }));

              // Move to next section
              addSystemMessage('✅ Documents processed! Moving to next section...');
              await loadCurrentQuestion(sessionId);
            }}
            onSkip={async () => {
              console.log('⏭️ User skipped document upload');
              addSystemMessage('⏭️ Skipping document upload. You can enter details manually.');
              await loadCurrentQuestion(sessionId);
            }}
            sessionId={sessionId}
          />
        )}

        {/* Date Picker - Shows for date questions */}
        {currentQuestion && currentQuestion.input_type === 'date' && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Select Date</span>
              <span className="text-xs text-blue-600 ml-auto">Or use voice input below</span>
            </div>
            <DatePicker
              selected={(() => {
                if (!inputValue || typeof inputValue !== 'string') return null;
                try {
                  // Try to parse DD/MM/YYYY format
                  const parts = inputValue.split('/');
                  if (parts.length === 3) {
                    const [day, month, year] = parts;
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                  }
                  return new Date(inputValue);
                } catch (e) {
                  return null;
                }
              })()}
              onChange={(date) => {
                if (date && date instanceof Date && !isNaN(date)) {
                  // Format date as DD/MM/YYYY for UK format
                  const formatted = date.toLocaleDateString('en-GB');
                  setInputValue(formatted);
                  console.log('📅 Date selected:', formatted);
                }
              }}
              dateFormat="dd/MM/yyyy"
              showYearDropdown
              showMonthDropdown
              dropdownMode="select"
              placeholderText="Click to select a date"
              className="w-full px-4 py-3 border border-blue-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxDate={new Date()}
              yearDropdownItemNumber={100}
              scrollableYearDropdown
            />

            {/* Date Format Examples */}
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-xs font-semibold text-gray-700 mb-2">💬 Voice Input Examples:</div>
              <div className="text-xs text-gray-600 space-y-1">
                {getDateFormatExamples().slice(0, 5).map((example, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span className="font-mono">{example}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Email Voice Keyboard - Shows for email questions */}
        {currentQuestion && currentQuestion.input_type === 'email' && (
          <div className="mb-4">
            <EmailVoiceKeyboard
              value={inputValue}
              onChange={(email) => setInputValue(email)}
              onComplete={(email) => {
                console.log('📧 Email completed:', email);
                handleSendMessage(email);
              }}
              customTLDs={currentQuestion.custom_tlds || []}
            />
          </div>
        )}

        {/* UK Driving Licence Input - Shows for uk_driving_licence questions */}
        {currentQuestion && currentQuestion.input_type === 'uk_driving_licence' && (
          <div className="mb-4 max-h-[60vh] overflow-y-auto rounded-lg">
            <UKDrivingLicenceInput
              value={inputValue}
              onChange={(licence) => setInputValue(licence)}
              onComplete={(licence) => {
                console.log('🚗 Licence completed:', licence);
                handleSendMessage(licence);
              }}
              dateOfBirth={currentQuestion.auto_fill_dob}
              fullName={currentQuestion.auto_fill_name}
              allowDocumentUpload={currentQuestion.allow_document_upload !== false}
            />
          </div>
        )}

        {/* Select with Search - Shows for select questions with many options */}
        {currentQuestion && currentQuestion.input_type === 'select' && Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-green-900">Choose an option</span>
              <span className="text-xs text-green-600 ml-auto">Or use voice input below</span>
            </div>

            {/* Radio buttons for 5 or fewer options */}
            {currentQuestion.options.length <= 5 ? (
              <div className="space-y-1">
                {currentQuestion.options.map((option, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-2 px-2 py-1.5 bg-white border border-green-200 rounded cursor-pointer hover:bg-green-50 hover:border-green-400 transition-all"
                  >
                    <input
                      type="radio"
                      name="question-option"
                      value={typeof option === 'string' ? option : option.value}
                      checked={inputValue === (typeof option === 'string' ? option : option.value)}
                      onChange={(e) => {
                        const value = e.target.value;
                        setInputValue(value);
                        console.log('📻 Radio selected:', value);
                        // Auto-submit after selection
                        setTimeout(() => {
                          onSendMessage(value);
                          setInputValue('');
                        }, 300);
                      }}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-800">
                      {typeof option === 'string' ? option : option.label}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              /* Select dropdown for more than 4 options */
              <select
                value={inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setInputValue(value);
                  console.log('📋 Select option chosen:', value);
                  // Auto-submit after selection (if not the placeholder)
                  if (value) {
                    setTimeout(() => {
                      onSendMessage(value);
                      setInputValue('');
                    }, 300);
                  }
                }}
                className="w-full px-4 py-3 border-2 border-green-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                <option value="">-- Please select --</option>
                {currentQuestion.options.map((option, index) => (
                  <option key={index} value={typeof option === 'string' ? option : option.value}>
                    {typeof option === 'string' ? option : option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* TTS Toggle Button */}
          <button
            onClick={onToggleTTS}
            className={`flex-shrink-0 p-3 rounded-xl transition-all ${ttsEnabled
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
              className={`px-3 py-4 transition-colors ${isRecording
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
            className={`flex-shrink-0 p-4 rounded-2xl transition-all ${inputValue.trim() && !loading
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
                // Support both direct values and functional updaters
                setInputValue((prev) => {
                  const nextValue = typeof newValue === 'function' ? newValue(prev ?? '') : newValue;
                  console.log('📝 Virtual keyboard input:', nextValue);
                  return nextValue;
                });
                // Stop TTS when user starts typing
                if (speechSynthesis.speaking) {
                  console.log('🔇 Stopping TTS - user is typing');
                  speechSynthesis.cancel();
                }
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
              onSpeechRecognized={registerVirtualKeyboardProcessor}
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
  const [answers, setAnswers] = useState({}); // Track answers for cascading logic
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
  const rephraseCountRef = useRef(0); // Use ref to avoid closure issues
  const variantIndexRef = useRef(0); // Use ref to avoid closure issues
  const lastInputTimeRef = useRef(Date.now());
  const ttsEnabledRef = useRef(ttsEnabled); // Track current TTS state to avoid stale closure
  const isRecordingRef = useRef(isRecording); // Track current recording state to avoid stale closure
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastSpokenQuestionIdRef = useRef(null);
  const virtualKeyboardProcessorRef = useRef(null);
  const lastProcessedTranscriptRef = useRef(null); // Track last processed transcript to avoid duplicates
  const isStartingSessionRef = useRef(false); // Prevent duplicate session starts in React Strict Mode
  const sessionIdRef = useRef(sessionId); // Track current sessionId to avoid stale closure
  const currentQuestionRef = useRef(currentQuestion); // Track current question to avoid stale closure

  // Load existing session or start new one
  useEffect(() => {
    const activeSession = sessions[activeSessionIndex];
    if (!activeSession.id && !isStartingSessionRef.current) {
      startSession();
    } else if (activeSession.id) {
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

  // Keep ttsEnabledRef in sync with ttsEnabled state (avoid stale closure in intervals)
  // Sync refs with state to avoid stale closures
  useEffect(() => {
    console.log('📌 ttsEnabledRef updated:', ttsEnabled);
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  useEffect(() => {
    console.log('📌 isRecordingRef updated:', isRecording);
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(`ws://localhost:8001/ws/operator/${sessionId}`);

        wsRef.current.onopen = () => {
          console.log('WebSocket connected for operator messages.');
        };

        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'operator_message') {
            addOperatorMessage(data.message, data.operator_id);
          } else if (data.type === 'attention_required') {
            markSessionNeedsAttention();
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        wsRef.current.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          // Attempt to reconnect after a delay
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };

    connectWebSocket();

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
      // Note: continuous mode will be set dynamically based on context
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-GB';

      recognitionRef.current.onresult = (event) => {
        // IMPORTANT: In continuous mode, event.results is a growing array
        // Always read the LAST result, not index 0!
        const lastResultIndex = event.results.length - 1;
        const lastResult = event.results[lastResultIndex];
        const transcript = lastResult[0].transcript;
        const confidence = lastResult[0].confidence;
        const isFinal = lastResult.isFinal;

        console.log(`🎤 Speech result [${lastResultIndex}]: "${transcript}" (final: ${isFinal}, confidence: ${confidence})`);

        // Only process final results to avoid duplicates
        if (!isFinal) {
          console.log('⏭ Skipping interim result');
          return;
        }

        // Check if we've already processed this exact transcript
        if (lastProcessedTranscriptRef.current === transcript) {
          console.log('⏭ Skipping duplicate transcript:', transcript);
          return;
        }

        // Store this transcript as processed
        lastProcessedTranscriptRef.current = transcript;

        console.log('🎤 Processing final transcript:', transcript, 'Confidence:', confidence);

        // If virtual keyboard is active, pass to its processor
        if (virtualKeyboardProcessorRef.current) {
          console.log('📱 Passing to virtual keyboard processor:', transcript);
          const handled = virtualKeyboardProcessorRef.current(transcript);
          console.log('📱 Virtual keyboard processor returned:', handled);
          if (handled) {
            console.log('✅ Virtual keyboard handled the speech input');
            // In continuous mode, recognition keeps running automatically - no need to restart
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

        switch (event.error) {
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

    // Chrome loads voices asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Fallback: try again after a delay
    const timeout = setTimeout(loadVoices, 100);

    return () => clearTimeout(timeout);
  }, []);

  // Effect to handle cascading selects
  useEffect(() => {
    const handleCascading = async () => {
      if (currentQuestion && currentQuestion.cascading && currentQuestion.cascading.is_dependent) {
        const parentId = currentQuestion.cascading.parent_question_id;
        const parentValue = answers[parentId];

        console.log('🔄 Cascading check:', {
          currentId: currentQuestion.question_id,
          parentId,
          parentValue,
          answers
        });

        if (parentId) {
          // Fetch options with parent value
          try {
            const url = `${API_BASE_URL}/config/question/${currentQuestion.question_id}/options${parentValue ? `?parent_value=${encodeURIComponent(parentValue)}` : ''}`;
            console.log('🔄 Fetching cascading options from:', url);

            const response = await fetch(url);
            if (response.ok) {
              const options = await response.json();
              console.log('✅ Received cascading options:', options.length);

              // Update current question options
              setCurrentQuestion(prev => ({
                ...prev,
                options: options
              }));

              // Also update the last message if it's the system message for this question
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.type === 'system' && lastMsg.options) {
                  lastMsg.options = options;
                }
                return newMessages;
              });
            }
          } catch (err) {
            console.error('❌ Error fetching cascading options:', err);
          }
        }
      }
    };

    handleCascading();
  }, [currentQuestion?.question_id, answers]);

  // Initial load of answers from session history (if available)
  useEffect(() => {
    const fetchSessionAnswers = async () => {
      if (sessionId) {
        try {
          const response = await fetch(`${API_BASE_URL}/sessions`);
          if (response.ok) {
            const sessions = await response.json();
            const currentSession = sessions.find(s => s.id === sessionId);
            if (currentSession && currentSession.questions) {
              const loadedAnswers = {};
              currentSession.questions.forEach(q => {
                // Extra defensive check for q and q.answer
                if (q && typeof q === 'object' && q.answer) {
                  if (q.id) {
                    loadedAnswers[q.id] = q.answer;
                  }
                }
              });
              setAnswers(prev => ({ ...prev, ...loadedAnswers }));
              console.log('✅ Loaded session answers:', Object.keys(loadedAnswers).length);
            }
          }
        } catch (err) {
          console.error('❌ Error loading session answers:', err);
        }
      }
    };

    fetchSessionAnswers();
  }, [sessionId]);

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
  const speakText = useCallback((text, retryCount = 0) => {
    if (!ttsEnabled || !text) {
      console.log('🔇 TTS disabled or no text');
      return;
    }

    // Don't speak while ASR is recording - prevents TTS/ASR interference
    if (isRecording) {
      console.log('🎤 Skipping TTS - ASR is currently recording');
      return;
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('🎙 speakText called with:', text.substring(0, 50));

    // Get voices directly from speechSynthesis (not from stale state)
    const currentVoices = speechSynthesis.getVoices();
    const targetVoice = currentVoices.find(v => v.name === 'Google UK English Female');

    console.log('📊 Current voices available:', currentVoices.length);
    console.log('📊 Target voice found:', targetVoice?.name || 'NONE');

    // If voices haven't loaded yet, wait and retry (up to 2 seconds)
    if (currentVoices.length === 0 && retryCount < 10) {
      console.log(`⏳ Waiting for voices to load... (retry ${retryCount + 1}/10)`);
      setTimeout(() => {
        speakText(text, retryCount + 1);
      }, 200);
      return;
    }

    if (!targetVoice && currentVoices.length > 0) {
      console.warn('⚠️  WARNING: Target voice not found, using browser default');
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

      console.log('🔍 Setting voice on utterance:');
      console.log('   Target voice:', targetVoice?.name || 'NULL');

      if (targetVoice) {
        utterance.voice = targetVoice;
        console.log('✅ Voice SET on utterance:', targetVoice.name, '(', targetVoice.lang, ')');
        console.log('   Is local service:', targetVoice.localService);
        console.log('   Voice URI:', targetVoice.voiceURI);
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

        // If Google voice fails, try with local voice (only if TTS still enabled)
        if (ttsEnabled && targetVoice && !targetVoice.localService && e.error === 'network') {
          console.log('🔄 Google voice failed, trying local voice...');
          const localVoice = currentVoices.find(v => v.lang === 'en-GB' && v.localService);
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
  }, [ttsEnabled, isRecording]);

  // Auto-rephrase timer (every 60 seconds of no input)
  useEffect(() => {
    if (!currentQuestion || !ttsEnabled || ttsOnHold || isRecording) {
      console.log('Auto-rephrase disabled:', { hasQuestion: !!currentQuestion, ttsEnabled, ttsOnHold, isRecording });
      return;
    }

    console.log('Auto-rephrase timer started for question:', currentQuestion.question_id);

    // Capture the question ID at the time this timer is set up
    const questionIdAtSetup = currentQuestion.question_id;

    const checkRephrase = () => {
      // Don't rephrase if user is actively recording
      if (isRecording) {
        console.log('⏭ Skipping rephrase - user is recording');
        return;
      }

      // CRITICAL FIX: Check if we're still on the same question
      if (currentQuestion?.question_id !== questionIdAtSetup) {
        console.log(`⏭ Skipping rephrase - question changed from ${questionIdAtSetup} to ${currentQuestion?.question_id}`);
        // Clear the timer since we're on a different question now
        if (rephraseTimerRef.current) {
          clearInterval(rephraseTimerRef.current);
          rephraseTimerRef.current = null;
        }
        return;
      }

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
  }, [currentQuestion, ttsEnabled, ttsOnHold, isRecording]);

  // Snore sound timer (plays every 5 minutes when TTS is on hold)
  useEffect(() => {
    // Clear any existing snore timer when TTS is not on hold OR when TTS is disabled (snoozed)
    if (!ttsOnHold || !ttsEnabled) {
      if (snoreTimerRef.current) {
        clearInterval(snoreTimerRef.current);
        snoreTimerRef.current = null;
        console.log('😴 Snore timer cleared' + (!ttsEnabled ? ' (TTS snoozed)' : ''));
      }
      return;
    }

    console.log('😴 Starting snore timer - will play every 5 minutes during autopause');
    addSystemMessage('😴 *SNORE* No response detected... playing snore sound');

    const playSnore = () => {
      try {
        console.log('😴 *SNORE* Attempting to play snore sound from /sounds/snore.wav');
        const snoreAudio = new Audio('/sounds/snore.wav');
        snoreAudio.volume = 0.5; // 50% volume

        snoreAudio.addEventListener('canplaythrough', () => {
          console.log('✅ Snore audio loaded successfully');
        });

        snoreAudio.addEventListener('error', (e) => {
          console.error('❌ Snore audio error:', e);
          addSystemMessage('⚠️ Could not load snore.wav file');
        });

        snoreAudio.play()
          .then(() => {
            console.log('✅ Snore sound playing');
          })
          .catch(err => {
            console.warn('😴 Could not play snore sound:', err.message);
            addSystemMessage(`⚠️ Audio play failed: ${err.message}`);
          });
      } catch (err) {
        console.warn('😴 Error creating snore audio:', err.message);
        addSystemMessage(`⚠️ Could not create audio: ${err.message}`);
      }
    };

    // Play immediately when entering autopause (only if TTS still enabled)
    if (ttsEnabledRef.current) {
      playSnore();
    } else {
      console.log('⏹ Skipping initial snore - TTS disabled (ref:', ttsEnabledRef.current, ')');
    }

    // Then play every 5 minutes (300000ms)
    snoreTimerRef.current = setInterval(() => {
      // Defensive check: use REF to get current TTS state (not stale closure)
      if (!ttsEnabledRef.current) {
        console.log('⏹ Skipping snore - TTS is now disabled (ref:', ttsEnabledRef.current, ')');
        return;
      }

      console.log('⏰ 5 minutes passed - playing snore sound again');
      addSystemMessage('😴 *SNORE* Still waiting... (5 min reminder)');
      playSnore();
    }, 300000);

    return () => {
      if (snoreTimerRef.current) {
        clearInterval(snoreTimerRef.current);
        snoreTimerRef.current = null;
        console.log('😴 Snore timer cleared');
      }
    };
  }, [ttsOnHold, ttsEnabled]);

  const startSpeechRecognition = useCallback(async () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    // Check if already recording - prevent double start (use ref to avoid stale closure)
    if (isRecordingRef.current) {
      console.log('⚠️ Already recording (ref:', isRecordingRef.current, '), ignoring duplicate start request');
      return;
    }

    console.log('✅ Not currently recording (ref:', isRecordingRef.current, '), starting now...');

    try {
      setError(null);
      console.log('Starting speech recognition...');

      // Reset transcript tracking for new recording session
      lastProcessedTranscriptRef.current = null;
      console.log('🔄 Reset transcript tracking');

      // Stop any current TTS and wait for it to fully stop
      if (speechSynthesis.speaking) {
        console.log('🔇 Stopping TTS - user is speaking');
        speechSynthesis.cancel();
        // Wait 500ms for TTS to fully stop before starting ASR
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ TTS stopped, now starting ASR');
      }

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

          // Enable continuous mode AND interim results for virtual keyboard (NATO alphabet input)
          const isVirtualKeyboardMode = currentQuestion?.spelling_required === true;
          recognitionRef.current.continuous = isVirtualKeyboardMode;
          recognitionRef.current.interimResults = isVirtualKeyboardMode; // Enable interim results for faster feedback
          console.log(`🎤 Setting continuous mode: ${isVirtualKeyboardMode}, interimResults: ${isVirtualKeyboardMode} (spelling_required: ${currentQuestion?.spelling_required})`);

          // Start speech recognition AFTER microphone permission is granted
          try {
            recognitionRef.current.start();
            console.log('SpeechRecognition.start() called');
            setIsRecording(true);
          } catch (startErr) {
            // Handle "already started" error gracefully
            if (startErr.message && startErr.message.includes('already started')) {
              console.log('ℹ️ Speech recognition already started, continuing...');
              setIsRecording(true);
            } else {
              throw startErr; // Re-throw if it's a different error
            }
          }
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
  }, [currentQuestion]);

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

    // Check if current question is a date field
    if (currentQuestion && currentQuestion.input_type === 'date') {
      const componentType = currentQuestion.date_component || 'full';
      console.log(`📅 Date field detected (${componentType}), attempting to parse from speech:`, transcript);

      const parsedDate = parseDateComponent(transcript, componentType);

      if (parsedDate) {
        console.log(`✅ Successfully parsed ${componentType}:`, parsedDate);
        // Send the formatted date as the message
        handleSendMessage(parsedDate);
        return;
      } else {
        console.warn(`⚠️ Failed to parse ${componentType}, sending original transcript`);
        // Fall through to send original transcript
      }
    }

    // Check if current question is a select question - prioritize matching against options
    if (currentQuestion && currentQuestion.input_type === 'select' && Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0) {
      console.log('🎯 Select question detected, attempting to match transcript against options');
      console.log('📋 Available options:', currentQuestion.options);

      const normalizedTranscript = transcript.toLowerCase().trim();
      let matchedOption = null;
      let matchType = null;

      // Try to match against each option
      for (const option of currentQuestion.options) {
        const optionLabel = (typeof option === 'string' ? option : option.label || '').toLowerCase();
        const optionValue = (typeof option === 'string' ? option : option.value || '').toLowerCase();
        const aliases = option.aliases || [];
        const phonetics = option.phonetics || [];

        // 1. Exact match on label or value
        if (normalizedTranscript === optionLabel || normalizedTranscript === optionValue) {
          matchedOption = option;
          matchType = 'exact';
          break;
        }

        // 2. Check aliases (semantic equivalents)
        for (const alias of aliases) {
          if (normalizedTranscript === alias.toLowerCase() || normalizedTranscript.includes(alias.toLowerCase())) {
            matchedOption = option;
            matchType = `alias: ${alias}`;
            break;
          }
        }
        if (matchedOption) break;

        // 3. Check phonetics
        for (const phonetic of phonetics) {
          if (normalizedTranscript === phonetic.toLowerCase() || normalizedTranscript.includes(phonetic.toLowerCase())) {
            matchedOption = option;
            matchType = `phonetic: ${phonetic}`;
            break;
          }
        }
        if (matchedOption) break;

        // 4. Fuzzy match - transcript contains option label or vice versa
        if (normalizedTranscript.includes(optionLabel) || optionLabel.includes(normalizedTranscript)) {
          // Only accept if substantial match (more than 3 chars or 50% of transcript)
          if (optionLabel.length > 3 || optionLabel.length >= normalizedTranscript.length * 0.5) {
            matchedOption = option;
            matchType = 'fuzzy';
            break;
          }
        }

        // 5. Word overlap - check if key words from transcript match option
        const transcriptWords = normalizedTranscript.split(/\s+/);
        const optionWords = optionLabel.split(/\s+/);
        const matchingWords = transcriptWords.filter(tw =>
          optionWords.some(ow => ow.includes(tw) || tw.includes(ow))
        );
        // If more than half the words match, consider it a match
        if (matchingWords.length >= Math.ceil(optionWords.length / 2) && matchingWords.length > 0) {
          matchedOption = option;
          matchType = `word-overlap: ${matchingWords.join(', ')}`;
          break;
        }
      }

      if (matchedOption) {
        // Prefer label for display (human-readable), fall back to value
        const matchedLabel = typeof matchedOption === 'string' ? matchedOption : (matchedOption.label || matchedOption.value);
        console.log(`✅ Matched select option: "${matchedLabel}" (match type: ${matchType})`);
        console.log(`   Original transcript: "${transcript}"`);
        // Send the label (original select option text) so it displays correctly in chat
        handleSendMessage(matchedLabel);
        return;
      } else {
        console.warn(`⚠️ No select option match found for: "${transcript}"`);
        console.log('   Available options:', currentQuestion.options.map(o => typeof o === 'string' ? o : o.label));
        // Fall through to send original transcript
      }
    }

    // Send the transcript as a message
    handleSendMessage(transcript);
  };

  const handleRephrase = () => {
    console.log('handleRephrase called');
    console.log('currentQuestion:', currentQuestion);
    console.log('rephraseCountRef.current:', rephraseCountRef.current);

    if (!currentQuestion || !currentQuestion.tts) {
      console.warn('Cannot rephrase: missing question or TTS data');
      return;
    }

    // Check if we've already rephrased 4 times (use ref value)
    if (rephraseCountRef.current >= 4) {
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

    // Use ref values and increment them
    const nextIndex = (variantIndexRef.current + 1) % variants.length;
    variantIndexRef.current = nextIndex;
    setCurrentVariantIndex(nextIndex);

    const newCount = rephraseCountRef.current + 1;
    rephraseCountRef.current = newCount;
    setRephraseCount(newCount);

    const rephraseText = variants[nextIndex];
    console.log(`🔄 Rephrasing with variant ${nextIndex + 1} (attempt ${newCount}/4):`, rephraseText);

    speakText(rephraseText);
    addSystemMessage(`🔄 Let me rephrase (${newCount}/4): ${rephraseText}`);
  };

  const handleResume = () => {
    console.log('▶️ Resume button clicked - restarting TTS');
    rephraseCountRef.current = 0;
    variantIndexRef.current = 0;
    setRephraseCount(0);
    setCurrentVariantIndex(0);
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
    // Prevent duplicate session starts in React Strict Mode
    if (isStartingSessionRef.current) {
      console.log('⏭ Skipping duplicate startSession call (already in progress)');
      return;
    }

    isStartingSessionRef.current = true;
    console.log('🚀 Starting new session...');

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
      isStartingSessionRef.current = false;
      console.log('✅ Session start complete');
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

      // Check for enhanced TTS variants from carInsuranceOptions
      try {
        let enhancedTTS = null;
        // Safe access to vodflagMapping
        if (vodflagMapping && typeof vodflagMapping === 'object') {
          const vodflag = vodflagMapping[data.slot_name] ? Object.keys(vodflagMapping).find(key => vodflagMapping[key] === data.slot_name) : null;

          // Try to find by slot name directly if not found via vodflag mapping
          const optionsKey = Object.keys(vodflagMapping).find(key => vodflagMapping[key] === data.slot_name);

          if (optionsKey || vodflagMapping[data.slot_name]) {
            // Iterate safely
            for (const [vFlag, key] of Object.entries(vodflagMapping)) {
              if (key === data.slot_name || key === data.question_id) {
                const options = getOptionsByVodflag(vFlag);
                if (options && options.length > 0 && options[0].tts) {
                  enhancedTTS = options[0].tts;
                  console.log('✨ Found enhanced TTS for', data.slot_name, enhancedTTS);
                  break;
                }
              }
            }
          }
        }

        // If we found enhanced TTS, merge it into the data
        if (enhancedTTS) {
          data.tts = {
            ...data.tts,
            ...enhancedTTS,
            text: enhancedTTS.variant1 || data.question_text // Use variant1 as primary text if available
          };
        }
      } catch (ttsErr) {
        console.error('⚠️ Error processing enhanced TTS:', ttsErr);
        // Continue without enhanced TTS
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

        // Use enhanced TTS text if available, otherwise fallback to question text
        const textToSpeak = data.tts?.variant1 || data.tts?.text || data.question_text;
        setTimeout(() => speakText(textToSpeak), 500);
      } else if (lastSpokenQuestionIdRef.current === data.question_id) {
        console.log('⏭ Skipping speech - already spoken this question:', data.question_id);
      }

      // Reset input timer and rephrase counter for new question
      lastInputTimeRef.current = Date.now();
      rephraseCountRef.current = 0;
      variantIndexRef.current = 0;
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
    console.log('📤 handleSendMessage called with:', messageText);

    // Use refs to get current values (avoid stale closure)
    const currentSessionId = sessionIdRef.current;
    const currentQuestionData = currentQuestionRef.current;

    console.log('📊 Current state:', {
      sessionId: currentSessionId || 'MISSING',
      currentQuestion: currentQuestionData?.question_id || 'MISSING',
      messageText
    });

    if (!currentSessionId || !currentQuestionData) {
      console.error('❌ CRITICAL: Cannot submit answer - missing required data:', {
        sessionId: currentSessionId || 'MISSING',
        currentQuestion: currentQuestionData || 'MISSING'
      });
      addSystemMessage('❌ Error: Session or question not loaded. Please refresh the page.');
      return;
    }

    console.log('✅ Validation passed - submitting answer to backend');

    // Reset input timer when user sends a message
    lastInputTimeRef.current = Date.now();
    rephraseCountRef.current = 0;
    variantIndexRef.current = 0;
    setRephraseCount(0); // Reset rephrase counter when user responds
    setTtsOnHold(false); // Resume TTS if it was on hold

    // Optimistically update answers for cascading logic
    if (currentQuestionRef.current) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestionRef.current.question_id]: messageText
      }));
    }

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
      console.log(`📡 POST ${API_BASE_URL}/answer/submit`, {
        session_id: currentSessionId,
        question_id: currentQuestionData.question_id,
        answer_text: messageText,
        answer_type: 'text',
        recognition_confidence: null
      });

      const response = await fetch(`${API_BASE_URL}/answer/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          question_id: currentQuestionData.question_id,
          answer_text: messageText,
          answer_type: 'text',
          recognition_confidence: null
        })
      });

      console.log('📡 Response status:', response.status);

      const data = await response.json();
      console.log('📡 Response data:', data);

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
      console.log('🔄 Loading next question...');
      await loadCurrentQuestion(currentSessionId);
    } catch (err) {
      console.error('❌ Error submitting answer:', err);
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
    console.log('═══════════════════════════════════════════════════');
    console.log('🔘 TTS TOGGLE BUTTON CLICKED');
    console.log('   Current ttsEnabled state:', ttsEnabled);
    console.log('   About to toggle to:', !ttsEnabled);
    console.log('   speechSynthesis.speaking:', speechSynthesis.speaking);
    console.log('   speechSynthesis.pending:', speechSynthesis.pending);

    const newState = !ttsEnabled;
    setTtsEnabled(newState);

    if (newState) {
      console.log('✅ ENABLING TTS');
      addSystemMessage('🔊 TTS enabled - questions will be spoken aloud');
    } else {
      console.log('❌ DISABLING TTS');
      console.log('   Calling speechSynthesis.cancel()...');
      speechSynthesis.cancel(); // Stop any current speech
      console.log('   speechSynthesis.cancel() completed');
      addSystemMessage('🔇 TTS disabled');
    }

    console.log('   New ttsEnabled state will be:', newState);
    console.log('═══════════════════════════════════════════════════');
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
