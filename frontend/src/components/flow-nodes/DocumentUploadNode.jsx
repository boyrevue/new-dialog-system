import React from 'react';
import { Handle, Position } from 'reactflow';

/**
 * DocumentUploadNode - Represents document upload point in the flow
 * Shows what documents are needed and connects to document-fillable questions
 */
const DocumentUploadNode = ({ data, selected }) => {
  const documentTypes = data.documentTypes || [];
  const fillableQuestionCount = data.fillableQuestionCount || 0;

  return (
    <div
      className={`document-upload-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        border: selected ? '3px solid #b45309' : '2px solid #f59e0b',
        borderRadius: '12px',
        padding: '14px',
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? '0 8px 20px rgba(245, 158, 11, 0.5)'
          : '0 4px 12px rgba(0, 0, 0, 0.2)',
        color: 'white',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
    >
      {/* Upload Icon */}
      <div style={{
        fontSize: '36px',
        textAlign: 'center',
        marginBottom: '10px'
      }}>
        📤
      </div>

      {/* Title */}
      <div style={{
        fontWeight: 'bold',
        fontSize: '14px',
        textAlign: 'center',
        marginBottom: '12px',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        Document Upload
      </div>

      {/* Document Types List */}
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        padding: '10px',
        borderRadius: '6px',
        marginBottom: '10px'
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 'bold',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Required Documents:
        </div>
        {documentTypes.length > 0 ? (
          <ul style={{
            fontSize: '11px',
            margin: 0,
            paddingLeft: '18px',
            lineHeight: '1.6'
          }}>
            {documentTypes.map((docType, idx) => (
              <li key={idx}>{docType}</li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: '11px', opacity: 0.8 }}>
            No document types specified
          </div>
        )}
      </div>

      {/* Fillable Questions Count */}
      <div style={{
        fontSize: '11px',
        background: 'rgba(139, 92, 246, 0.3)',
        padding: '6px 10px',
        borderRadius: '4px',
        textAlign: 'center',
        border: '1px solid rgba(139, 92, 246, 0.5)'
      }}>
        🔗 {fillableQuestionCount} auto-fillable question{fillableQuestionCount !== 1 ? 's' : ''}
      </div>

      {/* Input Handle (from start) */}
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

      {/* Output Handle (to fillable questions) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#8b5cf6',
          width: '12px',
          height: '12px',
          border: '2px solid white'
        }}
      />
    </div>
  );
};

export default DocumentUploadNode;
