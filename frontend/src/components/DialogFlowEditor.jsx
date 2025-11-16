import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

// Import custom node components
import StartNode from './flow-nodes/StartNode';
import EndNode from './flow-nodes/EndNode';
import SectionNode from './flow-nodes/SectionNode';
import QuestionNode from './flow-nodes/QuestionNode';
import SubQuestionNode from './flow-nodes/SubQuestionNode';
import DocumentUploadNode from './flow-nodes/DocumentUploadNode';

// Define custom node types
const nodeTypes = {
  start: StartNode,
  end: EndNode,
  section: SectionNode,
  question: QuestionNode,
  subQuestion: SubQuestionNode,
  documentUpload: DocumentUploadNode
};

/**
 * DialogFlowEditor - Node-RED-style visual flow editor for dialog configuration
 *
 * Features:
 * - Read-only view in Phase 1 (load TTL → display flow)
 * - Node-RED-style appearance with sections as parents
 * - Questions as children nodes
 * - SubQuestions with conditional logic indicators
 * - Pan, zoom, minimap controls
 */
const DialogFlowEditor = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDocumentHints, setShowDocumentHints] = useState(false);

  // Store original unfiltered data
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);

  // Load flow data from backend
  const loadFlow = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:8002/api/flow/load');
      const data = await response.json();

      if (data.success) {
        // Store the original unfiltered data
        const originalNodes = (data.flow.nodes || []).map(node => ({
          ...node,
          data: {
            ...node.data,
            showDocumentHints: showDocumentHints
          }
        }));
        const originalEdges = data.flow.edges || [];

        setAllNodes(originalNodes);
        setAllEdges(originalEdges);

        // Filter and set display nodes/edges based on showDocumentHints
        const filteredNodes = originalNodes.filter(
          node => showDocumentHints || node.type !== 'documentUpload'
        );
        const filteredEdges = originalEdges.filter(
          edge => showDocumentHints || edge.source !== 'document_upload'
        );

        setNodes(filteredNodes);
        setEdges(filteredEdges);
      } else {
        setError(data.error || 'Failed to load flow');
      }
    } catch (err) {
      console.error('Error loading flow:', err);
      setError(`Error loading flow: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load flow on mount
  useEffect(() => {
    loadFlow();
  }, []);

  // Update all nodes when showDocumentHints changes
  // Filter from the original unfiltered data stored in allNodes/allEdges
  useEffect(() => {
    if (allNodes.length === 0) return; // Skip if data not loaded yet

    // Update showDocumentHints in node data and filter
    const filteredNodes = allNodes
      .map((node) => ({
        ...node,
        data: {
          ...node.data,
          showDocumentHints
        }
      }))
      .filter(node => showDocumentHints || node.type !== 'documentUpload');

    // Filter edges based on showDocumentHints
    const filteredEdges = allEdges.filter(
      edge => showDocumentHints || edge.source !== 'document_upload'
    );

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [showDocumentHints, allNodes, allEdges, setNodes, setEdges]);

  // Handle edge connections (for future editing)
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Reload button handler
  const handleReload = () => {
    loadFlow();
  };

  // Node click handler (for future editing)
  const onNodeClick = useCallback((event, node) => {
    console.log('Node clicked:', node);
    // TODO Phase 2: Show edit panel
  }, []);

  // Edge click handler (for future editing)
  const onEdgeClick = useCallback((event, edge) => {
    console.log('Edge clicked:', edge);
    // TODO Phase 2: Show condition editor
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1f2937'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>
          🔄 Loading dialog flow from TTL...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1f2937',
        flexDirection: 'column'
      }}>
        <div style={{ color: '#ef4444', fontSize: '18px', marginBottom: '20px' }}>
          ❌ {error}
        </div>
        <button
          onClick={handleReload}
          style={{
            background: '#3b82f6',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: '#111827' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        style={{ background: '#111827' }}
      >
        {/* Control Panel */}
        <Panel position="top-left" style={{
          background: 'rgba(31, 41, 55, 0.95)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #374151',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              📊 Dialog Flow Editor
            </h2>
            <button
              onClick={handleReload}
              style={{
                background: '#3b82f6',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔄 Reload
            </button>
            <button
              onClick={() => setShowDocumentHints(!showDocumentHints)}
              style={{
                background: showDocumentHints ? '#10b981' : '#6b7280',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'background 0.3s ease'
              }}
            >
              📄 {showDocumentHints ? 'Hide' : 'Show'} Doc Fields
            </button>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
              {nodes.length} nodes, {edges.length} edges
            </div>
          </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="top-right" style={{
          background: 'rgba(31, 41, 55, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #374151',
          color: 'white',
          fontSize: '11px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Legend</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              }}></div>
              <span>Start</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}></div>
              <span>Section</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
              }}></div>
              <span>Question</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                border: '1px dashed #d97706'
              }}></div>
              <span>Sub-Question</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              }}></div>
              <span>End</span>
            </div>
          </div>
        </Panel>

        {/* Controls (zoom, fit view, etc.) */}
        <Controls
          style={{
            background: 'rgba(31, 41, 55, 0.95)',
            border: '1px solid #374151',
            borderRadius: '8px'
          }}
        />

        {/* MiniMap for navigation */}
        <MiniMap
          style={{
            background: 'rgba(31, 41, 55, 0.95)',
            border: '1px solid #374151',
            borderRadius: '8px'
          }}
          nodeColor={(node) => {
            switch (node.type) {
              case 'start':
                return '#10b981';
              case 'documentUpload':
                return '#f59e0b';
              case 'section':
                return '#667eea';
              case 'question':
                return '#06b6d4';
              case 'subQuestion':
                return '#fbbf24';
              case 'end':
                return '#ef4444';
              default:
                return '#6b7280';
            }
          }}
        />

        {/* Grid background */}
        <Background
          color="#374151"
          gap={16}
          size={1}
          variant="dots"
        />
      </ReactFlow>
    </div>
  );
};

export default DialogFlowEditor;
