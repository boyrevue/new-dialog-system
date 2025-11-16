import React from 'react';
import { Handle, Position } from 'reactflow';

/**
 * QuestionNode - Represents a dialog question in the flow
 * Blue/cyan theme to differentiate from sections
 */
const QuestionNode = ({ data, selected }) => {
  const hasSubQuestions = data.has_sub_questions || false;

  // Input type icon mapping
  const inputTypeIcons = {
    'text': '📝',
    'select': '📋',
    'date': '📅',
    'number': '🔢',
    'email': '✉️',
    'tel': '📞',
    'textarea': '📄'
  };

  const icon = inputTypeIcons[data.input_type] || '❓';

  return (
    <div
      className={`question-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
        border: selected ? '2px solid #0ea5e9' : '2px solid #0284c7',
        borderRadius: '6px',
        padding: '10px',
        minWidth: '200px',
        maxWidth: '250px',
        boxShadow: selected
          ? '0 6px 12px rgba(6, 182, 212, 0.4)'
          : '0 3px 6px rgba(0, 0, 0, 0.15)',
        color: 'white',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Input Handle (top) - connects to parent section */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#8b5cf6',
          width: '10px',
          height: '10px',
          border: '2px solid white'
        }}
      />

      {/* Header with icon and input type */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px', marginRight: '6px' }}>
          {icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '9px',
            opacity: 0.9,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {data.input_type}
            {data.required && (
              <span style={{
                color: '#fef3c7',
                marginLeft: '4px',
                fontSize: '12px'
              }}>*</span>
            )}
          </div>
        </div>
      </div>

      {/* Question Text (PRIMARY) */}
      <div style={{
        fontSize: '12px',
        fontWeight: 'bold',
        opacity: 1,
        marginBottom: '8px',
        lineHeight: '1.4',
        background: 'rgba(255,255,255,0.15)',
        padding: '6px 8px',
        borderRadius: '4px',
        textShadow: '0 1px 2px rgba(0,0,0,0.2)'
      }}>
        {data.question_text}
      </div>

      {/* Question ID (secondary) */}
      <div style={{
        fontSize: '9px',
        opacity: 0.8,
        marginBottom: '6px',
        color: '#e0f2fe',
        fontFamily: 'monospace'
      }}>
        ID: {data.question_id}
      </div>

      {/* Slot name badge */}
      <div style={{
        fontSize: '9px',
        background: 'rgba(255,255,255,0.2)',
        padding: '3px 6px',
        borderRadius: '3px',
        display: 'inline-block'
      }}>
        🎯 {data.slot_name}
      </div>

      {/* Sub-questions indicator */}
      {hasSubQuestions && (
        <div style={{
          fontSize: '9px',
          background: 'rgba(251, 191, 36, 0.3)',
          padding: '3px 6px',
          borderRadius: '3px',
          marginTop: '4px',
          display: 'inline-block',
          marginLeft: '4px'
        }}>
          🔀 Has conditions
        </div>
      )}

      {/* Output Handle (bottom) - sequential flow */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#3b82f6',
          width: '10px',
          height: '10px',
          border: '2px solid white',
          left: '50%'
        }}
      />

      {/* Conditional Output Handle (right) - for sub-questions */}
      {hasSubQuestions && (
        <Handle
          type="source"
          position={Position.Right}
          id="conditional"
          style={{
            background: '#f59e0b',
            width: '10px',
            height: '10px',
            border: '2px solid white'
          }}
        />
      )}
    </div>
  );
};

export default QuestionNode;
