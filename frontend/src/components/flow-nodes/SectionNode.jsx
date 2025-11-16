import React from 'react';
import { Handle, Position } from 'reactflow';

/**
 * SectionNode - Parent node representing a dialog section
 * Similar to Node-RED function nodes with icon, title, and description
 */
const SectionNode = ({ data, selected }) => {
  return (
    <div
      className={`section-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: selected ? '2px solid #4f46e5' : '2px solid #6366f1',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '220px',
        boxShadow: selected
          ? '0 8px 16px rgba(99, 102, 241, 0.4)'
          : '0 4px 8px rgba(0, 0, 0, 0.15)',
        color: 'white',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Input Handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#10b981',
          width: '12px',
          height: '12px',
          border: '2px solid white'
        }}
      />

      {/* Header with icon and title */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '24px', marginRight: '8px' }}>
          {data.icon || '📋'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '14px',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}>
            {data.title || 'Section'}
          </div>
          <div style={{
            fontSize: '10px',
            opacity: 0.9,
            marginTop: '2px'
          }}>
            Section {data.order}
          </div>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div style={{
          fontSize: '11px',
          opacity: 0.95,
          marginBottom: '8px',
          lineHeight: '1.4',
          background: 'rgba(255,255,255,0.15)',
          padding: '6px 8px',
          borderRadius: '4px'
        }}>
          {data.description}
        </div>
      )}

      {/* Aliases badge */}
      {data.aliases && data.aliases.length > 0 && (
        <div style={{
          fontSize: '10px',
          background: 'rgba(255,255,255,0.2)',
          padding: '4px 8px',
          borderRadius: '4px',
          marginBottom: '4px'
        }}>
          🎤 {data.aliases.length} alias{data.aliases.length !== 1 ? 'es' : ''}
        </div>
      )}

      {/* Output Handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#3b82f6',
          width: '12px',
          height: '12px',
          border: '2px solid white'
        }}
      />

      {/* Bottom Handle for questions */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="questions"
        style={{
          background: '#8b5cf6',
          width: '12px',
          height: '12px',
          border: '2px solid white',
          left: '50%'
        }}
      />
    </div>
  );
};

export default SectionNode;
