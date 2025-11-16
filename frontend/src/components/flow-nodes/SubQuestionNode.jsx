import React from 'react';
import { Handle, Position } from 'reactflow';

/**
 * SubQuestionNode - Represents a conditional sub-question
 * Orange/amber theme with dashed border to indicate conditional nature
 */
const SubQuestionNode = ({ data, selected }) => {
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

  // Operator display mapping
  const operatorDisplay = {
    'equals': '==',
    'not_equals': '!=',
    'contains': '⊃',
    'greater_than': '>',
    'less_than': '<',
    'in': '∈',
    'not_in': '∉'
  };

  const operator = operatorDisplay[data.condition_operator] || data.condition_operator;

  return (
    <div
      className={`subquestion-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        border: selected ? '2px dashed #ea580c' : '2px dashed #d97706',
        borderRadius: '6px',
        padding: '10px',
        minWidth: '200px',
        maxWidth: '250px',
        boxShadow: selected
          ? '0 6px 12px rgba(251, 191, 36, 0.4)'
          : '0 3px 6px rgba(0, 0, 0, 0.15)',
        color: '#78350f',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Input Handle (left) - connects from parent question */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#f59e0b',
          width: '10px',
          height: '10px',
          border: '2px solid white'
        }}
      />

      {/* Conditional Badge */}
      <div style={{
        fontSize: '9px',
        background: 'rgba(120, 53, 15, 0.2)',
        padding: '3px 6px',
        borderRadius: '3px',
        marginBottom: '6px',
        fontWeight: 'bold',
        textAlign: 'center'
      }}>
        🔀 CONDITIONAL
      </div>

      {/* Condition Display */}
      <div style={{
        fontSize: '10px',
        background: 'rgba(255, 255, 255, 0.6)',
        padding: '4px 6px',
        borderRadius: '3px',
        marginBottom: '6px',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        textAlign: 'center',
        border: '1px solid rgba(120, 53, 15, 0.3)'
      }}>
        IF: {data.condition_field || data.parent_question} {operator} {data.condition_value}
      </div>

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
                color: '#dc2626',
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
        background: 'rgba(255,255,255,0.5)',
        padding: '6px 8px',
        borderRadius: '4px',
        color: '#78350f',
        textShadow: '0 1px 2px rgba(255,255,255,0.5)'
      }}>
        {data.question_text}
      </div>

      {/* Question ID (secondary) */}
      <div style={{
        fontSize: '9px',
        opacity: 0.8,
        marginBottom: '6px',
        color: '#78350f',
        fontFamily: 'monospace'
      }}>
        ID: {data.question_id}
      </div>

      {/* Slot name badge */}
      <div style={{
        fontSize: '9px',
        background: 'rgba(255,255,255,0.5)',
        padding: '3px 6px',
        borderRadius: '3px',
        display: 'inline-block'
      }}>
        🎯 {data.slot_name}
      </div>

      {/* Output Handle (bottom) - sequential flow */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#f59e0b',
          width: '10px',
          height: '10px',
          border: '2px solid white',
          left: '50%'
        }}
      />
    </div>
  );
};

export default SubQuestionNode;
