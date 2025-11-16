"""
TTL Validator and Cleaner

Validates and cleans TTL files to:
- Remove duplicate questions (same questionId)
- Preserve semantic alternatives (different questionId, same semantic meaning)
- Ensure data integrity
"""

import logging
from typing import Dict, List, Set, Tuple
from rdflib import Graph, Namespace, RDF, RDFS, Literal
from collections import defaultdict

logger = logging.getLogger(__name__)

# Define namespaces
DIALOG = Namespace("http://diggi.io/ontology/dialog#")
XSD = Namespace("http://www.w3.org/2001/XMLSchema#")


class TTLValidator:
    """
    Validates TTL ontology files for duplicates and data integrity
    """

    def __init__(self, graph: Graph):
        self.graph = graph

    def find_duplicate_questions(self) -> Dict[str, List[str]]:
        """
        Find duplicate questions (same questionId appearing multiple times)

        Returns:
            dict: {question_id: [list of URIs with this questionId]}
        """
        query = """
        PREFIX : <http://diggi.io/ontology/dialog#>

        SELECT ?question ?questionId
        WHERE {
            ?question a :Question ;
                :questionId ?questionId .
        }
        """

        results = self.graph.query(query)

        # Group by questionId
        question_ids = defaultdict(list)
        for row in results:
            question_id = str(row.questionId)
            question_uri = str(row.question)
            question_ids[question_id].append(question_uri)

        # Filter to only duplicates (more than one URI for same questionId)
        duplicates = {qid: uris for qid, uris in question_ids.items() if len(uris) > 1}

        return duplicates

    def find_duplicate_subquestions(self) -> Dict[str, List[str]]:
        """
        Find duplicate sub-questions (same questionId appearing multiple times)

        Returns:
            dict: {question_id: [list of URIs with this questionId]}
        """
        query = """
        PREFIX : <http://diggi.io/ontology/dialog#>

        SELECT ?subQuestion ?questionId
        WHERE {
            ?subQuestion a :SubQuestion ;
                :questionId ?questionId .
        }
        """

        results = self.graph.query(query)

        # Group by questionId
        question_ids = defaultdict(list)
        for row in results:
            question_id = str(row.questionId)
            question_uri = str(row.subQuestion)
            question_ids[question_id].append(question_uri)

        # Filter to only duplicates
        duplicates = {qid: uris for qid, uris in question_ids.items() if len(uris) > 1}

        return duplicates

    def find_duplicate_sections(self) -> Dict[str, List[str]]:
        """
        Find duplicate sections (same section appearing multiple times)

        Returns:
            dict: {section_id: [list of URIs]}
        """
        query = """
        PREFIX : <http://diggi.io/ontology/dialog#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?section ?label
        WHERE {
            ?section a :Section ;
                rdfs:label ?label .
        }
        """

        results = self.graph.query(query)

        # Group by section URI (extract ID from URI)
        section_ids = defaultdict(list)
        for row in results:
            section_uri = str(row.section)
            section_id = section_uri.split('#')[-1]
            section_ids[section_id].append(section_uri)

        # Filter to only duplicates
        duplicates = {sid: uris for sid, uris in section_ids.items() if len(uris) > 1}

        return duplicates

    def validate(self) -> Tuple[bool, Dict[str, any]]:
        """
        Validate the entire TTL file for duplicates and issues

        Returns:
            tuple: (is_valid, issues_dict)
        """
        issues = {
            "duplicate_questions": {},
            "duplicate_subquestions": {},
            "duplicate_sections": {}
        }

        # Find all duplicates
        issues["duplicate_questions"] = self.find_duplicate_questions()
        issues["duplicate_subquestions"] = self.find_duplicate_subquestions()
        issues["duplicate_sections"] = self.find_duplicate_sections()

        # Check if valid (no duplicates)
        is_valid = (
            len(issues["duplicate_questions"]) == 0 and
            len(issues["duplicate_subquestions"]) == 0 and
            len(issues["duplicate_sections"]) == 0
        )

        return is_valid, issues


class TTLCleaner:
    """
    Cleans TTL ontology files by removing duplicates
    """

    def __init__(self, graph: Graph):
        self.graph = graph

    def remove_duplicate_questions(self, duplicates: Dict[str, List[str]]) -> int:
        """
        Remove duplicate questions, keeping only the first occurrence

        Args:
            duplicates: {question_id: [list of URIs]}

        Returns:
            int: Number of duplicate triples removed
        """
        removed_count = 0

        for question_id, uris in duplicates.items():
            if len(uris) <= 1:
                continue

            # Keep the first, remove the rest
            keep_uri = uris[0]
            remove_uris = uris[1:]

            logger.info(f"Keeping {keep_uri} for questionId '{question_id}'")

            for uri in remove_uris:
                logger.info(f"Removing duplicate: {uri}")

                # Remove all triples where this URI is the subject
                for s, p, o in list(self.graph.triples((None, None, None))):
                    if str(s) == uri or str(o) == uri:
                        self.graph.remove((s, p, o))
                        removed_count += 1

        return removed_count

    def remove_duplicate_subquestions(self, duplicates: Dict[str, List[str]]) -> int:
        """
        Remove duplicate sub-questions, keeping only the first occurrence

        Args:
            duplicates: {question_id: [list of URIs]}

        Returns:
            int: Number of duplicate triples removed
        """
        removed_count = 0

        for question_id, uris in duplicates.items():
            if len(uris) <= 1:
                continue

            # Keep the first, remove the rest
            keep_uri = uris[0]
            remove_uris = uris[1:]

            logger.info(f"Keeping {keep_uri} for subQuestion '{question_id}'")

            for uri in remove_uris:
                logger.info(f"Removing duplicate: {uri}")

                # Remove all triples where this URI is the subject or object
                for s, p, o in list(self.graph.triples((None, None, None))):
                    if str(s) == uri or str(o) == uri:
                        self.graph.remove((s, p, o))
                        removed_count += 1

        return removed_count

    def clean(self) -> Dict[str, int]:
        """
        Clean the entire TTL graph by removing all duplicates

        Returns:
            dict: {entity_type: count_removed}
        """
        # First validate to find duplicates
        validator = TTLValidator(self.graph)
        is_valid, issues = validator.validate()

        results = {
            "questions_removed": 0,
            "subquestions_removed": 0,
            "total_triples_removed": 0
        }

        if is_valid:
            logger.info("TTL is valid, no duplicates found")
            return results

        # Remove duplicates
        logger.info(f"Found duplicates, cleaning...")

        if issues["duplicate_questions"]:
            count = self.remove_duplicate_questions(issues["duplicate_questions"])
            results["questions_removed"] = len(issues["duplicate_questions"])
            results["total_triples_removed"] += count
            logger.info(f"Removed {len(issues['duplicate_questions'])} duplicate questions ({count} triples)")

        if issues["duplicate_subquestions"]:
            count = self.remove_duplicate_subquestions(issues["duplicate_subquestions"])
            results["subquestions_removed"] = len(issues["duplicate_subquestions"])
            results["total_triples_removed"] += count
            logger.info(f"Removed {len(issues['duplicate_subquestions'])} duplicate sub-questions ({count} triples)")

        return results

    def save_cleaned(self, output_path: str, format: str = "turtle") -> bool:
        """
        Save cleaned graph to file

        Args:
            output_path: Path to save cleaned TTL
            format: RDF serialization format (default: turtle)

        Returns:
            bool: Success status
        """
        try:
            self.graph.serialize(destination=output_path, format=format)
            logger.info(f"Saved cleaned TTL to {output_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving cleaned TTL: {e}")
            return False


def validate_before_save(graph: Graph, entity_type: str, entity_id: str) -> Tuple[bool, str]:
    """
    Validate that adding a new entity won't create duplicates

    Args:
        graph: RDF graph
        entity_type: "Question", "SubQuestion", or "Section"
        entity_id: The questionId or section identifier

    Returns:
        tuple: (is_valid, error_message)
    """
    validator = TTLValidator(graph)

    if entity_type == "Question":
        duplicates = validator.find_duplicate_questions()
        if entity_id in duplicates:
            return False, f"Question with ID '{entity_id}' already exists"

    elif entity_type == "SubQuestion":
        duplicates = validator.find_duplicate_subquestions()
        if entity_id in duplicates:
            return False, f"SubQuestion with ID '{entity_id}' already exists"

    elif entity_type == "Section":
        duplicates = validator.find_duplicate_sections()
        if entity_id in duplicates:
            return False, f"Section with ID '{entity_id}' already exists"

    return True, ""
