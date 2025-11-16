import React from 'react';
import { Handle, Position } from 'reactflow';

/**
 * StartNode - Beginning of the dialog flow
 * Green theme to indicate start
 */
const StartNode = ({ data, selected }) => {
  return (
    <div
      className={`start-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        border: selected ? '3px solid #047857' : '2px solid #059669',
        borderRadius: '50%',
        padding: '20px',
        width: '120px',
        height: '120px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: selected
          ? '0 8px 20px rgba(16, 185, 129, 0.5)'
          : '0 4px 10px rgba(0, 0, 0, 0.2)',
        color: 'white',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Start Icon */}
      <div style={{
        fontSize: '36px',
        marginBottom: '4px'
      }}>
        ▶️
      </div>

      {/* Label */}
      <div style={{
        fontWeight: 'bold',
        fontSize: '14px',
        textAlign: 'center',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {data.label || 'Start'}
      </div>

      {/* Output Handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#10b981',
          width: '14px',
          height: '14px',
          border: '3px solid white'
        }}
      />
    </div>
  );
};

export default StartNode;
