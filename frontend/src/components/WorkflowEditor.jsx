/**
 * Workflow Editor Component - Node-RED style visual workflow builder
 *
 * Features:
 * - Drag-and-drop nodes (questions, conditions, actions)
 * - Visual connections between nodes
 * - If/Then conditional logic
 * - Real-time flow validation
 */

import React, { useState, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, Button, Badge } from 'flowbite-react';
import {
  MessageSquare,
  GitBranch,
  Play,
  Save,
  Plus,
  Trash2,
  Settings,
  Check,
  X
} from 'lucide-react';

// Custom Node Types - Node-RED style
const QuestionNode = ({ data }) => {
  return (
    <div className="px-4 py-2 rounded-md bg-[#c7e9c0] border border-[#8bc98a] shadow-md min-w-[150px]">
      <div className="flex items-center gap-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-[#5a8a5a]">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-700">Question</div>
          <div className="text-sm font-bold text-gray-900">{data.label}</div>
        </div>
      </div>
      {data.required && (
        <Badge color="failure" size="xs" className="mt-2">Required</Badge>
      )}
    </div>
  );
};

const ConditionNode = ({ data }) => {
  return (
    <div className="px-4 py-2 rounded-md bg-[#f9e79f] border border-[#f5b041] shadow-md min-w-[150px]">
      <div className="flex items-center gap-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-[#d68910]">
          <GitBranch className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-700">Condition</div>
          <div className="text-sm font-bold text-gray-900">{data.label}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-700">
        If: {data.condition || 'Not set'}
      </div>
    </div>
  );
};

const ActionNode = ({ data }) => {
  return (
    <div className="px-4 py-2 rounded-md bg-[#aed6f1] border border-[#5dade2] shadow-md min-w-[150px]">
      <div className="flex items-center gap-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-[#2874a6]">
          <Play className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-700">Action</div>
          <div className="text-sm font-bold text-gray-900">{data.label}</div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  question: QuestionNode,
  condition: ConditionNode,
  action: ActionNode,
};

const WorkflowEditor = ({ droppedFields = [] }) => {
  // Initial nodes - convert dropped form fields to nodes
  const initialNodes = droppedFields.map((field, index) => ({
    id: field.id,
    type: 'question',
    position: { x: 50, y: index * 150 },
    data: {
      label: field.label || field.type,
      required: field.required || false,
      fieldType: field.type
    },
  }));

  const initialEdges = [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#999', strokeWidth: 2 }
    }, eds)),
    [setEdges],
  );

  const addQuestionNode = () => {
    const newNode = {
      id: `question-${Date.now()}`,
      type: 'question',
      position: { x: Math.random() * 300, y: Math.random() * 300 },
      data: { label: 'New Question', required: false },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addConditionNode = () => {
    const newNode = {
      id: `condition-${Date.now()}`,
      type: 'condition',
      position: { x: Math.random() * 300, y: Math.random() * 300 },
      data: { label: 'If/Then', condition: 'value > 0' },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addActionNode = () => {
    const newNode = {
      id: `action-${Date.now()}`,
      type: 'action',
      position: { x: Math.random() * 300, y: Math.random() * 300 },
      data: { label: 'Execute Action' },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const deleteSelected = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  };

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const saveWorkflow = () => {
    const workflow = {
      nodes,
      edges,
      timestamp: new Date().toISOString()
    };
    console.log('Saving workflow:', workflow);
    // TODO: Save to backend API
  };

  return (
    <div className="h-screen w-full">
      <div className="h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#1a1a1a]"
          style={{
            background: 'linear-gradient(to bottom, #1a1a1a 0%, #2d2d2d 100%)'
          }}
        >
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'question':
                  return '#3b82f6';
                case 'condition':
                  return '#f59e0b';
                case 'action':
                  return '#10b981';
                default:
                  return '#6b7280';
              }
            }}
          />
          <Background
            variant="dots"
            gap={16}
            size={1}
            color="#444"
            style={{ backgroundColor: '#1a1a1a' }}
          />

          {/* Toolbar Panel - Compact with tooltip on hover */}
          <Panel position="top-left" className="space-y-2">
            <Card className="p-2">
              <div className="flex flex-col gap-2">
                <button
                  onClick={addQuestionNode}
                  className="group relative p-2 rounded-lg bg-[#c7e9c0] hover:bg-[#b0d9a7] border border-[#8bc98a] transition-all"
                  title="Add Question Node"
                >
                  <MessageSquare className="w-5 h-5 text-[#5a8a5a]" />
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Question
                  </span>
                </button>
                <button
                  onClick={addConditionNode}
                  className="group relative p-2 rounded-lg bg-[#f9e79f] hover:bg-[#f5d76e] border border-[#f5b041] transition-all"
                  title="Add Condition Node"
                >
                  <GitBranch className="w-5 h-5 text-[#d68910]" />
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Condition
                  </span>
                </button>
                <button
                  onClick={addActionNode}
                  className="group relative p-2 rounded-lg bg-[#aed6f1] hover:bg-[#85c1e9] border border-[#5dade2] transition-all"
                  title="Add Action Node"
                >
                  <Play className="w-5 h-5 text-[#2874a6]" />
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Action
                  </span>
                </button>
              </div>
            </Card>
          </Panel>

          {/* Action Panel */}
          <Panel position="top-right" className="space-y-2">
            <Card className="p-4">
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600"
                  onClick={saveWorkflow}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Workflow
                </Button>
                {selectedNode && (
                  <Button
                    size="sm"
                    color="failure"
                    onClick={deleteSelected}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Node
                  </Button>
                )}
              </div>
            </Card>
          </Panel>

          {/* Node Properties Panel */}
          {selectedNode && (
            <Panel position="bottom-right">
              <Card className="w-64 p-4">
                <div className="text-sm font-bold mb-2">Node Properties</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">ID:</span> {selectedNode.id}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedNode.type}
                  </div>
                  <div>
                    <span className="font-medium">Label:</span> {selectedNode.data.label}
                  </div>
                  {selectedNode.data.condition && (
                    <div>
                      <span className="font-medium">Condition:</span> {selectedNode.data.condition}
                    </div>
                  )}
                </div>
              </Card>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
};

export default WorkflowEditor;
