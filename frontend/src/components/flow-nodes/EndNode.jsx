import React from 'react';
import { Handle, Position } from 'reactflow';

/**
 * EndNode - End of the dialog flow (Summary)
 * Red theme to indicate completion
 */
const EndNode = ({ data, selected }) => {
  return (
    <div
      className={`end-node ${selected ? 'selected' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        border: selected ? '3px solid #b91c1c' : '2px solid #dc2626',
        borderRadius: '50%',
        padding: '20px',
        width: '120px',
        height: '120px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: selected
          ? '0 8px 20px rgba(239, 68, 68, 0.5)'
          : '0 4px 10px rgba(0, 0, 0, 0.2)',
        color: 'white',
        transition: 'all 0.2s ease'
      }}
    >
      {/* End Icon */}
      <div style={{
        fontSize: '36px',
        marginBottom: '4px'
      }}>
        🏁
      </div>

      {/* Label */}
      <div style={{
        fontWeight: 'bold',
        fontSize: '14px',
        textAlign: 'center',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {data.label || 'Summary'}
      </div>

      {/* Input Handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#ef4444',
          width: '14px',
          height: '14px',
          border: '3px solid white'
        }}
      />
    </div>
  );
};

export default EndNode;
