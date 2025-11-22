/**
 * ChatDialogView Component
 *
 * ChatGPT-style scrollable dialog interface for multimodal interactions
 * Features:
 * - Scrollable message history
 * - Message bubbles (system, user, operator)
 * - HTML content rendering
 * - Integrated operator assistance
 * - Document upload integration
 * - Voice input/output
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button, Badge, TextInput, Spinner, Avatar } from 'flowbite-react';
import {
  Send,
  Mic,
  MicOff,
  HelpCircle,
  Bot,
  User as UserIcon,
  Shield,
  Upload,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  Paperclip
} from 'lucide-react';
import DOMPurify from 'dompurify';

const ChatDialogView = ({
  sessionId,
  onSendMessage,
  onRequestHelp,
  onVoiceInput,
  isRecording,
  loading
}) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'speech'
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Call parent callback
    if (onSendMessage) {
      onSendMessage(inputValue);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      // Stop recording
      if (onVoiceInput) {
        onVoiceInput(false);
      }
    } else {
      // Start recording
      if (onVoiceInput) {
        onVoiceInput(true);
      }
    }
  };

  const addSystemMessage = (content, metadata = {}) => {
    const systemMessage = {
      id: Date.now(),
      type: 'system',
      content,
      timestamp: new Date(),
      ...metadata
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const addOperatorMessage = (content, operatorId = 'Operator') => {
    const operatorMessage = {
      id: Date.now(),
      type: 'operator',
      content,
      operatorId,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, operatorMessage]);
  };

  // Expose methods to parent component
  useEffect(() => {
    if (window.chatDialogAPI) {
      window.chatDialogAPI.addSystemMessage = addSystemMessage;
      window.chatDialogAPI.addOperatorMessage = addOperatorMessage;
    }
  }, []);

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
          {isUser && (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
          )}
          {isSystem && (
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
          )}
          {isOperator && (
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Message Bubble */}
        <div className={`flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Sender Label */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-600">
              {isUser ? 'You' : isOperator ? message.operatorId || 'Operator' : 'System'}
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

          {/* Message Content */}
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
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(message.htmlContent)
                }}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}

            {/* Question metadata */}
            {message.questionId && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">Question ID: {message.questionId}</p>
              </div>
            )}

            {/* Options for select questions */}
            {message.options && message.options.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputValue(option.label);
                      handleSend();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-sm transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* Document fields */}
            {message.extractedFields && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 space-y-1">
                <p className="text-xs font-semibold text-gray-700 mb-2">Extracted Information:</p>
                {Object.entries(message.extractedFields).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-medium text-gray-600">{key}:</span>{' '}
                    <span className="text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Audio playback */}
            {message.audioUrl && (
              <button className="mt-2 flex items-center gap-2 text-xs hover:underline">
                <Volume2 className="w-3 h-3" />
                Play Audio
              </button>
            )}
          </div>

          {/* Message Actions */}
          {message.needsReview && (
            <div className="mt-1 flex gap-2">
              <button className="text-xs text-orange-600 hover:underline flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Needs Review
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[700px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h3 className="font-semibold">Insurance Quote Assistant</h3>
        </div>
        {sessionId && (
          <Badge color="light" size="sm">
            Session: {sessionId.slice(0, 8)}
          </Badge>
        )}
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-sm">Start a conversation...</p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        {/* Input Mode Toggle */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setInputMode('text')}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              inputMode === 'text'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            Text
          </button>
          <button
            onClick={() => setInputMode('speech')}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              inputMode === 'speech'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            Speech
          </button>
        </div>

        {/* Input Row */}
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <button
            className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Attach document"
          >
            <Paperclip className="w-5 h-5 text-gray-500" />
          </button>

          {/* Text Input */}
          {inputMode === 'text' ? (
            <div className="flex-1">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                rows="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                style={{ minHeight: '42px', maxHeight: '120px' }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-2">
              <button
                onClick={toggleVoiceInput}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isRecording
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </>
                )}
              </button>
            </div>
          )}

          {/* Send Button */}
          {inputMode === 'text' && (
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                inputValue.trim() && !loading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          )}

          {/* Request Help Button */}
          <button
            onClick={onRequestHelp}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-orange-100 transition-colors"
            title="Request operator assistance"
          >
            <HelpCircle className="w-5 h-5 text-orange-600" />
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ChatDialogView;
