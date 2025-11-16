"""
Flow Converter - TTL ↔ Flow JSON Conversion

Converts between TTL ontology format and Flow JSON format for the visual flow editor.
"""

import logging
from typing import Dict, List, Tuple, Optional
from dialog_manager import DialogManager

logger = logging.getLogger(__name__)


class TTLToFlowConverter:
    """
    Converts TTL ontology to Flow JSON format for React Flow editor
    """

    def __init__(self, dialog_manager: DialogManager):
        self.dm = dialog_manager
        self.node_positions = {}  # Track positions for layout
        self.current_y = 100
        self.section_x_offset = 300
        self.question_y_spacing = 150

    def convert(self) -> Dict:
        """
        Convert entire TTL ontology to Flow JSON format

        Returns:
            dict: Flow JSON with nodes, edges, and viewport
        """
        try:
            nodes = []
            edges = []
            seen_node_ids = set()  # Track node IDs to prevent duplicates

            # 1. Add start node
            start_node = self.create_start_node()
            nodes.append(start_node)
            seen_node_ids.add(start_node["id"])

            # 2. Get all sections and their questions
            sections = self.get_all_sections()

            prev_section_id = "start"
            section_x = 300

            for idx, section in enumerate(sections):
                section_node = self.section_to_node(section, section_x, 100)

                # Only add if not already seen
                if section_node["id"] not in seen_node_ids:
                    nodes.append(section_node)
                    seen_node_ids.add(section_node["id"])

                    # Add sequential edge from previous section/start
                    edges.append({
                        "id": f"e-{prev_section_id}-{section['section_id']}",
                        "source": prev_section_id,
                        "target": section['section_id'],
                        "type": "default",
                        "animated": False,
                        "style": {"stroke": "#555", "strokeWidth": 2}
                    })

                # Get questions in this section
                questions = self.get_questions_in_section(section['section_uri'])

                question_y = 300
                for q_idx, question in enumerate(questions):
                    question_node = self.question_to_node(
                        question,
                        section_x,
                        question_y
                    )

                    # Only add if not already seen
                    if question_node["id"] not in seen_node_ids:
                        nodes.append(question_node)
                        seen_node_ids.add(question_node["id"])

                        # Add section → question edge (contains relationship)
                        edges.append({
                            "id": f"e-sec-{section['section_id']}-q-{question['question_id']}",
                            "source": section['section_id'],
                            "target": question['question_id'],
                            "type": "default",
                            "animated": False,
                            "style": {
                                "stroke": "#6366f1",
                                "strokeWidth": 1,
                                "strokeDasharray": "5,5"
                            }
                        })

                        # Get sub-questions for this question
                        sub_questions = self.get_sub_questions(question['question_id'])

                        if sub_questions:
                            sub_q_x = section_x + 350
                            sub_q_y = question_y

                            for sub_q in sub_questions:
                                sub_q_node = self.subquestion_to_node(
                                    sub_q,
                                    sub_q_x,
                                    sub_q_y
                                )

                                # Only add if not already seen
                                if sub_q_node["id"] not in seen_node_ids:
                                    nodes.append(sub_q_node)
                                    seen_node_ids.add(sub_q_node["id"])

                                    # Add conditional edge
                                    edges.append({
                                        "id": f"e-cond-{question['question_id']}-{sub_q['question_id']}",
                                        "source": question['question_id'],
                                        "target": sub_q['question_id'],
                                        "type": "default",
                                        "animated": True,
                                        "label": sub_q.get('show_if', ''),
                                        "style": {
                                            "stroke": "#f59e0b",
                                            "strokeWidth": 2,
                                            "strokeDasharray": "5,5"
                                        },
                                        "data": {
                                            "condition": sub_q.get('show_if', ''),
                                            "operator": sub_q.get('condition_operator', ''),
                                            "value": sub_q.get('condition_value', '')
                                        }
                                    })

                                sub_q_y += self.question_y_spacing

                        question_y += self.question_y_spacing

                prev_section_id = section['section_id']
                section_x += self.section_x_offset

            # 3. Add end node
            end_node = self.create_end_node(section_x, 100)
            nodes.append(end_node)

            # Connect last section to end
            if sections:
                edges.append({
                    "id": f"e-{prev_section_id}-end",
                    "source": prev_section_id,
                    "target": "end",
                    "type": "default",
                    "animated": False,
                    "style": {"stroke": "#555", "strokeWidth": 2}
                })

            return {
                "nodes": nodes,
                "edges": edges,
                "viewport": {"x": 0, "y": 0, "zoom": 0.8}
            }

        except Exception as e:
            logger.error(f"Error converting TTL to Flow: {e}")
            raise

    def create_start_node(self) -> Dict:
        """Create start node"""
        return {
            "id": "start",
            "type": "start",
            "position": {"x": 100, "y": 100},
            "data": {
                "label": "Start",
                "ttl_ref": ":WelcomeNode"
            }
        }

    def create_end_node(self, x: int, y: int) -> Dict:
        """Create end node"""
        return {
            "id": "end",
            "type": "end",
            "position": {"x": x, "y": y},
            "data": {
                "label": "Summary",
                "ttl_ref": ":SummaryNode"
            }
        }

    def get_all_sections(self) -> List[Dict]:
        """
        Query for all sections in order (using golden source: dialog-sections.ttl)
        """
        query = """
        PREFIX : <http://diggi.io/ontology/dialog#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?section ?sectionId ?title ?description ?icon ?order ?alias ?phonetic
        WHERE {
            ?section a :Section ;
                :sectionId ?sectionId ;
                :sectionTitle ?title ;
                :sectionOrder ?order .

            OPTIONAL { ?section :sectionDescription ?description }
            OPTIONAL { ?section :sectionIcon ?icon }
            OPTIONAL { ?section :sectionAlias ?alias }
            OPTIONAL { ?section :sectionPhonetic ?phonetic }
        }
        ORDER BY ?order
        """

        results = self.dm.graph.query(query)

        # Group by section (aggregate aliases and phonetics)
        sections_dict = {}

        for row in results:
            section_id = str(row.sectionId)

            if section_id not in sections_dict:
                # Extract section URI local name (e.g., "PersonalInfoSection" from ":PersonalInfoSection")
                section_uri = str(row.section).split('#')[-1]

                sections_dict[section_id] = {
                    "section_id": section_id,
                    "section_uri": section_uri,  # Add the URI for querying questions
                    "label": str(row.title),  # Use title as label
                    "title": str(row.title),
                    "description": str(row.description) if row.description else "",
                    "icon": str(row.icon) if row.icon else "",
                    "order": int(row.order),
                    "aliases": [],
                    "phonetics": []
                }

            if row.alias and str(row.alias) not in sections_dict[section_id]["aliases"]:
                sections_dict[section_id]["aliases"].append(str(row.alias))

            if row.phonetic and str(row.phonetic) not in sections_dict[section_id]["phonetics"]:
                sections_dict[section_id]["phonetics"].append(str(row.phonetic))

        return sorted(sections_dict.values(), key=lambda x: x['order'])

    def get_questions_in_section(self, section_uri: str) -> List[Dict]:
        """
        Get all questions for a specific section by matching the section URI
        Includes both :Question and mm:MultimodalQuestion types
        """
        # Build the full section URI for filtering
        section_full_uri = f"http://diggi.io/ontology/dialog#{section_uri}"

        query = f"""
        PREFIX : <http://diggi.io/ontology/dialog#>
        PREFIX mm: <http://diggi.io/ontology/multimodal#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?question ?questionId ?questionText ?slotName ?inputType ?required ?order ?sectionRef
        WHERE {{
            ?question :inSection ?sectionRef .

            # Match both Question and MultimodalQuestion types
            {{
                ?question a :Question .
            }} UNION {{
                ?question a mm:MultimodalQuestion .
            }}

            OPTIONAL {{ ?question :questionId ?questionId }}
            OPTIONAL {{ ?question :questionText ?questionText }}
            OPTIONAL {{ ?question :slotName ?slotName }}
            OPTIONAL {{ ?question :order ?order }}
            OPTIONAL {{ ?question :inputType ?inputType }}
            OPTIONAL {{ ?question :required ?required }}

            # Exclude SubQuestions
            FILTER NOT EXISTS {{ ?question a :SubQuestion }}

            # Filter by section URI
            FILTER (?sectionRef = <{section_full_uri}>)
        }}
        ORDER BY ?order
        """

        results = self.dm.graph.query(query)

        questions = []
        seen_question_ids = set()

        for row in results:
            # Skip if missing critical fields or duplicate
            if not row.questionId:
                continue

            question_id = str(row.questionId)
            if question_id in seen_question_ids:
                continue
            seen_question_ids.add(question_id)

            questions.append({
                "question_id": question_id,
                "question_text": str(row.questionText) if row.questionText else question_id,
                "slot_name": str(row.slotName) if row.slotName else question_id,
                "input_type": str(row.inputType) if row.inputType else "text",
                "required": bool(row.required) if row.required else False,
                "order": int(row.order) if row.order else 999,
                "section": section_uri
            })

        return questions

    def get_sub_questions(self, parent_question_id: str) -> List[Dict]:
        """
        Get all sub-questions for a parent question
        """
        query = f"""
        PREFIX : <http://diggi.io/ontology/dialog#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?subQuestion ?questionId ?questionText ?slotName ?inputType ?required
               ?conditionOperator ?conditionValue ?conditionField ?showIf ?order
        WHERE {{
            ?parentQuestion :questionId "{parent_question_id}" ;
                :hasSubQuestion ?subQuestion .

            ?subQuestion a :SubQuestion .

            OPTIONAL {{ ?subQuestion :questionId ?questionId }}
            OPTIONAL {{ ?subQuestion :questionText ?questionText }}
            OPTIONAL {{ ?subQuestion :slotName ?slotName }}
            OPTIONAL {{ ?subQuestion :conditionOperator ?conditionOperator }}
            OPTIONAL {{ ?subQuestion :conditionValue ?conditionValue }}
            OPTIONAL {{ ?subQuestion :order ?order }}
            OPTIONAL {{ ?subQuestion :inputType ?inputType }}
            OPTIONAL {{ ?subQuestion :required ?required }}
            OPTIONAL {{ ?subQuestion :conditionField ?conditionField }}
            OPTIONAL {{ ?subQuestion :showIf ?showIf }}
        }}
        ORDER BY ?order
        """

        results = self.dm.graph.query(query)

        sub_questions = []
        for row in results:
            # Skip if missing critical fields
            if not row.questionId:
                continue

            sub_questions.append({
                "question_id": str(row.questionId),
                "question_text": str(row.questionText) if row.questionText else str(row.questionId),
                "slot_name": str(row.slotName) if row.slotName else str(row.questionId),
                "input_type": str(row.inputType) if row.inputType else "text",
                "required": bool(row.required) if row.required else False,
                "parent_question": parent_question_id,
                "condition_operator": str(row.conditionOperator) if row.conditionOperator else "equals",
                "condition_value": str(row.conditionValue) if row.conditionValue else "",
                "condition_field": str(row.conditionField) if row.conditionField else parent_question_id,
                "show_if": str(row.showIf) if row.showIf else "",
                "order": int(row.order) if row.order else 999
            })

        return sub_questions

    def section_to_node(self, section: Dict, x: int, y: int) -> Dict:
        """
        Convert section data to Flow node
        """
        return {
            "id": section['section_id'],
            "type": "section",
            "position": {"x": x, "y": y},
            "data": {
                "label": section['title'],
                "ttl_ref": f":{section['section_id']}",
                "title": section['title'],
                "description": section['description'],
                "icon": section['icon'],
                "aliases": section['aliases'],
                "phonetics": section['phonetics'],
                "order": section['order']
            }
        }

    def question_to_node(self, question: Dict, x: int, y: int) -> Dict:
        """
        Convert question data to Flow node
        """
        return {
            "id": question['question_id'],
            "type": "question",
            "position": {"x": x, "y": y},
            "data": {
                "label": question['question_id'],
                "ttl_ref": f":{question['question_id'].replace('_', '')}Question",
                "question_id": question['question_id'],
                "question_text": question['question_text'],
                "slot_name": question['slot_name'],
                "input_type": question['input_type'],
                "required": question['required'],
                "section": question['section'],
                "order": question['order']
            }
        }

    def subquestion_to_node(self, sub_question: Dict, x: int, y: int) -> Dict:
        """
        Convert sub-question data to Flow node
        """
        return {
            "id": sub_question['question_id'],
            "type": "subQuestion",
            "position": {"x": x, "y": y},
            "data": {
                "label": sub_question['question_id'],
                "ttl_ref": f":{sub_question['question_id'].replace('_', '')}SubQuestion",
                "question_id": sub_question['question_id'],
                "question_text": sub_question['question_text'],
                "slot_name": sub_question['slot_name'],
                "input_type": sub_question['input_type'],
                "required": sub_question['required'],
                "parent_question": sub_question['parent_question'],
                "condition_operator": sub_question['condition_operator'],
                "condition_value": sub_question['condition_value'],
                "condition_field": sub_question['condition_field'],
                "show_if": sub_question['show_if'],
                "order": sub_question['order']
            }
        }


class FlowToTTLConverter:
    """
    Converts Flow JSON format back to TTL ontology (for Phase 2: Editing)
    """

    def __init__(self):
        pass

    def convert(self, flow_data: Dict) -> str:
        """
        Convert Flow JSON to TTL format

        Args:
            flow_data: Flow JSON with nodes and edges

        Returns:
            str: TTL/RDF content
        """
        # Placeholder for Phase 2
        ttl_lines = []
        ttl_lines.append("# Generated from Flow Editor")
        ttl_lines.append("# TODO: Implement FlowToTTL conversion")

        return "\n".join(ttl_lines)
