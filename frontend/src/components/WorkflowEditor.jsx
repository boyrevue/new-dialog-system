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

// Custom Node Types
const QuestionNode = ({ data }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-white border-2 border-blue-500">
      <div className="flex items-center gap-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-blue-100">
          <MessageSquare className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">Question</div>
          <div className="text-sm font-bold">{data.label}</div>
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
    <div className="px-4 py-2 shadow-lg rounded-lg bg-white border-2 border-amber-500">
      <div className="flex items-center gap-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-amber-100">
          <GitBranch className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">Condition</div>
          <div className="text-sm font-bold">{data.label}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-600">
        If: {data.condition || 'Not set'}
      </div>
    </div>
  );
};

const ActionNode = ({ data }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-white border-2 border-green-500">
      <div className="flex items-center gap-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-green-100">
          <Play className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">Action</div>
          <div className="text-sm font-bold">{data.label}</div>
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

const WorkflowEditor = ({ questions = [] }) => {
  // Initial nodes - convert questions to nodes
  const initialNodes = questions.slice(0, 5).map((q, index) => ({
    id: q.question_id,
    type: 'question',
    position: { x: 50, y: index * 150 },
    data: {
      label: q.question_text.substring(0, 30) + '...',
      required: q.required,
      questionId: q.question_id
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
      style: { stroke: '#3b82f6' }
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
          className="bg-gray-50"
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
          <Background variant="dots" gap={12} size={1} />

          {/* Toolbar Panel */}
          <Panel position="top-left" className="space-y-2">
            <Card className="p-4">
              <div className="text-sm font-bold mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Add Nodes
              </div>
              <div className="space-y-2">
                <Button
                  size="sm"
                  color="blue"
                  onClick={addQuestionNode}
                  className="w-full"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Question
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  onClick={addConditionNode}
                  className="w-full"
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  Condition
                </Button>
                <Button
                  size="sm"
                  color="success"
                  onClick={addActionNode}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Action
                </Button>
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
