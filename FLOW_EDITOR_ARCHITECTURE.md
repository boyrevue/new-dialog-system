# Dialog Flow Editor - Architecture & Implementation Plan

## Overview

A Node-RED-style visual flow editor for managing TTL-based dialog flows with sections, questions, conditional sub-questions, and flow logic.

## Architecture

### Hybrid Approach: TTL + Flow JSON

**Rationale**: Keep TTL as source of truth for semantic relationships, use Flow JSON for visual layout and editor state.

```
TTL (Source of Truth)          Flow JSON (UI State)
─────────────────────          ────────────────────
Ontology definitions      ←──→  Node positions
Question metadata         ←──→  Visual layout
Conditional logic         ←──→  Edge connections
Section structure         ←──→  Grouping/styling
```

### Data Flow

```
┌─────────────┐
│  dialog.ttl │  ← Source of Truth (SPARQL queries)
└──────┬──────┘
       │
       ↓ (Load/Parse)
┌──────────────────┐
│  Flow Generator  │  ← Converts TTL → Flow JSON
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│   Flow JSON      │  ← Visual editor format
└────────┬─────────┘
         │
         ↓ (Render)
┌──────────────────┐
│  React Flow UI   │  ← Visual editor
└────────┬─────────┘
         │
         ↓ (Save)
┌──────────────────┐
│  Flow Serializer │  ← Converts Flow JSON → TTL
└────────┬─────────┘
         │
         ↓ (Write)
┌──────────────────┐
│  dialog.ttl      │  ← Updated ontology
└──────────────────┘
```

## Node Types

### 1. Start Node
- Entry point for dialog
- Single output connection
- No configuration needed

```json
{
  "id": "start",
  "type": "start",
  "label": "Start",
  "position": { "x": 100, "y": 100 },
  "data": { "ttl_ref": ":WelcomeNode" }
}
```

### 2. Section Node
- Groups related questions
- Contains icon, title, description
- Multiple question children
- Visual grouping/collapsing

```json
{
  "id": "drivers-section",
  "type": "section",
  "label": "👤 Driver Information",
  "position": { "x": 300, "y": 100 },
  "data": {
    "ttl_ref": ":DriversSection",
    "title": "Driver Information",
    "description": "Driver information and details",
    "icon": "👤",
    "aliases": ["Driver Info", "Driver Details"],
    "phonetics": ["Dryver Info"],
    "order": 2,
    "questions": [
      "first_name",
      "last_name",
      "dob"
    ]
  }
}
```

### 3. Question Node
- Individual question
- Input type (text, select, date, number, etc.)
- Validation rules
- Can have sub-questions

```json
{
  "id": "has-claims-question",
  "type": "question",
  "label": "Has Claims?",
  "position": { "x": 500, "y": 200 },
  "data": {
    "ttl_ref": ":HasClaimsQuestion",
    "question_id": "has_claims",
    "question_text": "Have you had any claims in the last 5 years?",
    "input_type": "select",
    "required": true,
    "options": [
      { "label": "Yes", "value": "yes" },
      { "label": "No", "value": "no" }
    ],
    "has_sub_questions": true,
    "slot_name": "has_claims",
    "section": "claims"
  }
}
```

### 4. Sub-Question Node
- Conditional question
- Linked to parent question
- Condition operator + value
- Visual indicator (dashed border, indented)

```json
{
  "id": "claim-type-subquestion",
  "type": "subQuestion",
  "label": "Claim Type",
  "position": { "x": 700, "y": 250 },
  "data": {
    "ttl_ref": ":ClaimTypeSubQuestion",
    "question_id": "claim_type",
    "question_text": "What type of claim was it?",
    "input_type": "select",
    "parent_question": "has_claims",
    "condition_operator": "equals",
    "condition_value": "yes",
    "show_if": "has_claims == yes",
    "options": [
      { "label": "Accident", "value": "accident" },
      { "label": "Theft", "value": "theft" },
      { "label": "Vandalism", "value": "vandalism" }
    ]
  }
}
```

### 5. End Node
- Terminal node
- Marks completion
- Can trigger summary/submission

```json
{
  "id": "end",
  "type": "end",
  "label": "Summary",
  "position": { "x": 1000, "y": 100 },
  "data": { "ttl_ref": ":SummaryNode" }
}
```

## Edge Types

### 1. Sequential Edge (Next)
- Standard flow progression
- Solid line
- Represents `:nextNode` in TTL

```json
{
  "id": "e1",
  "source": "drivers-section",
  "target": "vehicle-section",
  "type": "next",
  "animated": false,
  "style": { "stroke": "#555" }
}
```

### 2. Conditional Edge
- Appears based on condition
- Dashed line
- Label shows condition
- Represents `:hasSubQuestion` + conditions

```json
{
  "id": "e2",
  "source": "has-claims-question",
  "target": "claim-type-subquestion",
  "type": "conditional",
  "animated": true,
  "label": "if yes",
  "style": { "stroke": "#f59e0b", "strokeDasharray": "5,5" },
  "data": {
    "condition": "has_claims == yes",
    "operator": "equals",
    "value": "yes",
    "field": "has_claims"
  }
}
```

### 3. Parent-Child Edge (Section → Question)
- Links section to its questions
- Dotted line
- Represents `:inSection` in TTL

```json
{
  "id": "e3",
  "source": "drivers-section",
  "target": "first-name-question",
  "type": "contains",
  "animated": false,
  "style": { "stroke": "#6366f1", "strokeDasharray": "2,2" }
}
```

## UI Components

### 1. Canvas (React Flow)

```jsx
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

function DialogFlowCanvas({ flowData, onSave }) {
  const [nodes, setNodes] = useState(flowData.nodes);
  const [edges, setEdges] = useState(flowData.edges);

  const nodeTypes = {
    start: StartNode,
    section: SectionNode,
    question: QuestionNode,
    subQuestion: SubQuestionNode,
    end: EndNode
  };

  const edgeTypes = {
    next: NextEdge,
    conditional: ConditionalEdge,
    contains: ContainsEdge
  };

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background variant="dots" gap={12} size={1} />
        <Controls />
        <MiniMap />
        <Panel position="top-right">
          <button onClick={onSave}>Save Flow</button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
```

### 2. Custom Node Components

#### Section Node
```jsx
import { Handle, Position } from 'reactflow';

function SectionNode({ data }) {
  return (
    <div className="section-node">
      <Handle type="target" position={Position.Left} />

      <div className="node-header">
        <span className="icon">{data.icon}</span>
        <span className="title">{data.title}</span>
      </div>

      <div className="node-body">
        <p className="description">{data.description}</p>
        <div className="questions-count">
          {data.questions.length} questions
        </div>
      </div>

      <div className="node-footer">
        <button onClick={() => editSection(data)}>Edit</button>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

#### Question Node
```jsx
function QuestionNode({ data }) {
  return (
    <div className={`question-node ${data.has_sub_questions ? 'has-children' : ''}`}>
      <Handle type="target" position={Position.Top} />

      <div className="node-header">
        <span className="question-id">{data.question_id}</span>
        {data.required && <span className="required">*</span>}
      </div>

      <div className="node-body">
        <p className="question-text">{data.question_text}</p>
        <span className="input-type">{data.input_type}</span>
      </div>

      <div className="node-footer">
        <button onClick={() => editQuestion(data)}>Edit</button>
        {data.has_sub_questions && (
          <span className="sub-q-indicator">Has sub-questions</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} id="next" />
      {data.has_sub_questions && (
        <Handle type="source" position={Position.Right} id="conditional" />
      )}
    </div>
  );
}
```

#### Sub-Question Node
```jsx
function SubQuestionNode({ data }) {
  return (
    <div className="subquestion-node">
      <Handle type="target" position={Position.Left} />

      <div className="condition-badge">
        {data.show_if}
      </div>

      <div className="node-body">
        <p className="question-text">{data.question_text}</p>
        <span className="input-type">{data.input_type}</span>
      </div>

      <div className="node-footer">
        <button onClick={() => editSubQuestion(data)}>Edit</button>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### 3. Toolbar (Node Palette)

```jsx
function NodePalette({ onAddNode }) {
  const nodeTemplates = [
    { type: 'section', label: 'Section', icon: '📋' },
    { type: 'question', label: 'Question', icon: '❓' },
    { type: 'subQuestion', label: 'Sub-Question', icon: '❔' }
  ];

  return (
    <div className="node-palette">
      <h3>Add Nodes</h3>
      {nodeTemplates.map(template => (
        <div
          key={template.type}
          className="palette-item"
          draggable
          onDragStart={(e) => onDragStart(e, template.type)}
        >
          <span className="icon">{template.icon}</span>
          <span className="label">{template.label}</span>
        </div>
      ))}
    </div>
  );
}
```

### 4. Properties Panel

```jsx
function PropertiesPanel({ selectedNode, onUpdate }) {
  if (!selectedNode) {
    return <div className="properties-panel">No node selected</div>;
  }

  return (
    <div className="properties-panel">
      <h3>Properties: {selectedNode.label}</h3>

      {selectedNode.type === 'section' && (
        <SectionProperties node={selectedNode} onUpdate={onUpdate} />
      )}

      {selectedNode.type === 'question' && (
        <QuestionProperties node={selectedNode} onUpdate={onUpdate} />
      )}

      {selectedNode.type === 'subQuestion' && (
        <SubQuestionProperties node={selectedNode} onUpdate={onUpdate} />
      )}
    </div>
  );
}
```

## Backend: TTL ↔ Flow JSON Conversion

### TTL → Flow JSON Converter

```python
class TTLToFlowConverter:
    def __init__(self, dialog_manager):
        self.dm = dialog_manager

    def convert(self) -> dict:
        """
        Convert TTL ontology to Flow JSON format
        """
        nodes = []
        edges = []

        # 1. Get all sections
        sections = self.get_sections()
        for section in sections:
            nodes.append(self.section_to_node(section))

            # Get questions in section
            questions = self.get_questions_in_section(section['id'])
            for question in questions:
                nodes.append(self.question_to_node(question))

                # Add section → question edge
                edges.append({
                    "id": f"e-{section['id']}-{question['id']}",
                    "source": section['id'],
                    "target": question['id'],
                    "type": "contains"
                })

                # Get sub-questions
                sub_questions = self.get_sub_questions(question['id'])
                for sub_q in sub_questions:
                    nodes.append(self.subquestion_to_node(sub_q))

                    # Add conditional edge
                    edges.append({
                        "id": f"e-{question['id']}-{sub_q['id']}",
                        "source": question['id'],
                        "target": sub_q['id'],
                        "type": "conditional",
                        "label": sub_q['show_if'],
                        "data": {
                            "operator": sub_q['condition_operator'],
                            "value": sub_q['condition_value']
                        }
                    })

        # 2. Get sequential edges (nextNode relationships)
        sequential_edges = self.get_sequential_edges()
        edges.extend(sequential_edges)

        return {
            "nodes": nodes,
            "edges": edges,
            "viewport": { "x": 0, "y": 0, "zoom": 1 }
        }

    def section_to_node(self, section):
        return {
            "id": section['section_id'],
            "type": "section",
            "label": section['title'],
            "position": self.calculate_position(section),
            "data": {
                "ttl_ref": f":{section['section_id']}",
                "title": section['title'],
                "description": section.get('description', ''),
                "icon": section.get('icon', ''),
                "aliases": section.get('aliases', []),
                "phonetics": section.get('phonetics', []),
                "order": section.get('order', 0)
            }
        }

    def calculate_position(self, node):
        """
        Auto-layout algorithm (left-to-right based on order)
        """
        order = node.get('order', 0)
        return {
            "x": 100 + (order * 300),
            "y": 100
        }
```

### Flow JSON → TTL Converter

```python
class FlowToTTLConverter:
    def convert(self, flow_data: dict) -> str:
        """
        Convert Flow JSON back to TTL format
        """
        ttl_lines = []

        # Process nodes
        for node in flow_data['nodes']:
            if node['type'] == 'section':
                ttl_lines.append(self.node_to_section_ttl(node))
            elif node['type'] == 'question':
                ttl_lines.append(self.node_to_question_ttl(node))
            elif node['type'] == 'subQuestion':
                ttl_lines.append(self.node_to_subquestion_ttl(node))

        # Process edges
        for edge in flow_data['edges']:
            if edge['type'] == 'next':
                # Add :nextNode relationship
                ttl_lines.append(f":{edge['source']} :nextNode :{edge['target']} .")
            elif edge['type'] == 'conditional':
                # Already handled in sub-question node
                pass

        return "\n".join(ttl_lines)

    def node_to_section_ttl(self, node):
        data = node['data']
        aliases_str = ', '.join([f'"{a}"' for a in data.get('aliases', [])])
        phonetics_str = ', '.join([f'"{p}"' for p in data.get('phonetics', [])])

        ttl = f"""
:{node['id']} a :Section ;
    rdfs:label "{data['title']}" ;
    :sectionTitle "{data.get('icon', '')}{data['title']}" ;
    :sectionDescription "{data.get('description', '')}" ;
"""
        if aliases_str:
            ttl += f"    :sectionAlias {aliases_str} ;\n"
        if phonetics_str:
            ttl += f"    :sectionPhonetic {phonetics_str} ;\n"

        ttl += f"    :order {data.get('order', 1)} .\n"

        return ttl
```

## API Endpoints

### GET /api/flow/load
Load flow from TTL and convert to JSON

```python
@app.get("/api/flow/load")
async def load_flow():
    """
    Load dialog flow from TTL and convert to Flow JSON
    """
    ontology_paths = [
        os.path.join(ONTOLOGY_DIR, "dialog.ttl"),
        os.path.join(ONTOLOGY_DIR, "dialog-insurance-questions.ttl")
    ]

    dialog_manager = DialogManager(ontology_paths)
    converter = TTLToFlowConverter(dialog_manager)

    flow_data = converter.convert()

    return {
        "success": True,
        "flow": flow_data
    }
```

### POST /api/flow/save
Save flow JSON back to TTL

```python
@app.post("/api/flow/save")
async def save_flow(request: FlowSaveRequest):
    """
    Convert Flow JSON to TTL and save to ontology
    """
    converter = FlowToTTLConverter()
    ttl_content = converter.convert(request.flow_data)

    # Backup existing file
    ontology_file = os.path.join(ONTOLOGY_DIR, "dialog.ttl")
    backup_file = f"{ontology_file}.backup"

    with open(ontology_file, 'r') as f:
        existing = f.read()

    with open(backup_file, 'w') as f:
        f.write(existing)

    # Write new TTL
    with open(ontology_file, 'w') as f:
        f.write(ttl_content)

    return {
        "success": True,
        "backup_created": backup_file
    }
```

## Layout Algorithm

### Auto-Layout (Dagre)

Use Dagre for automatic graph layout:

```bash
npm install dagre
```

```javascript
import dagre from 'dagre';

function getLayoutedElements(nodes, edges, direction = 'LR') {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

## Implementation Phases

### Phase 1: Basic Flow Viewer (Read-Only)
- [ ] Install React Flow
- [ ] Create TTL → Flow JSON converter
- [ ] Implement custom node components
- [ ] Display existing dialog flow
- [ ] Add zoom, pan, minimap

### Phase 2: Basic Editing
- [ ] Node drag-and-drop
- [ ] Edge connections
- [ ] Add/delete nodes
- [ ] Flow JSON → TTL converter
- [ ] Save flow to TTL

### Phase 3: Advanced Editing
- [ ] Properties panel for nodes
- [ ] Inline editing
- [ ] Conditional edge configuration
- [ ] Sub-question creation
- [ ] Validation (detect cycles, orphans)

### Phase 4: Advanced Features
- [ ] Auto-layout with Dagre
- [ ] Section grouping/collapsing
- [ ] Undo/redo
- [ ] Copy/paste nodes
- [ ] Flow validation
- [ ] Preview/test mode

### Phase 5: Integration
- [ ] Connect to SectionAliasManager
- [ ] Connect to SelectListManager
- [ ] Integrate with dialog runtime
- [ ] Export to multiple formats

## Summary

This architecture provides:

✅ Visual node-based editor (Node-RED style)
✅ TTL as source of truth
✅ Flow JSON for UI state
✅ Custom node types (Section, Question, SubQuestion)
✅ Conditional edges
✅ Bidirectional TTL ↔ Flow conversion
✅ React Flow for rendering
✅ Auto-layout with Dagre
✅ Full CRUD operations
✅ Integration with existing components

Next step: Implement Phase 1 (Basic Flow Viewer)?
