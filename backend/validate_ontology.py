#!/usr/bin/env python3
"""
Ontology Validation Script
Detects duplicate question definitions and property value duplications in TTL files.
Run this before committing changes to ensure data quality.
"""

import os
import sys
from collections import defaultdict
from rdflib import Graph, Namespace, RDF
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Namespaces
DIALOG = Namespace("http://diggi.io/ontology/dialog#")
MM = Namespace("http://diggi.io/ontology/multimodal#")


def load_ontology_files(ontology_dir):
    """Load all TTL files into a single RDF graph"""
    graph = Graph()
    ttl_files = []

    for file in os.listdir(ontology_dir):
        if file.endswith('.ttl'):
            file_path = os.path.join(ontology_dir, file)
            ttl_files.append(file)
            try:
                graph.parse(file_path, format='turtle')
                logger.info(f"Loaded: {file}")
            except Exception as e:
                logger.error(f"Error loading {file}: {e}")
                sys.exit(1)

    return graph, ttl_files


def check_duplicate_questions(graph):
    """Check for duplicate question definitions (same questionId)"""
    logger.info("\n=== Checking for Duplicate Question Definitions ===")

    # Query for all questions with their IDs
    query = """
    PREFIX : <http://diggi.io/ontology/dialog#>
    PREFIX mm: <http://diggi.io/ontology/multimodal#>

    SELECT DISTINCT ?question ?questionId
    WHERE {
        {
            ?question a :Question .
        } UNION {
            ?question a mm:MultimodalQuestion .
        }
        ?question :questionId ?questionId .
    }
    """

    results = graph.query(query)

    # Track question IDs and their URIs
    question_ids = defaultdict(list)

    for row in results:
        question_uri = str(row.question)
        question_id = str(row.questionId)
        question_ids[question_id].append(question_uri)

    # Report duplicates
    duplicates_found = False
    for question_id, uris in question_ids.items():
        if len(uris) > 1:
            duplicates_found = True
            logger.error(f"DUPLICATE questionId '{question_id}' found in {len(uris)} definitions:")
            for uri in uris:
                logger.error(f"  - {uri}")

    if not duplicates_found:
        logger.info("✓ No duplicate question IDs found")

    return duplicates_found


def check_multiple_property_values(graph):
    """
    Check for questions with multiple values for single-value properties.
    This causes SPARQL query result multiplication (cartesian product effect).
    """
    logger.info("\n=== Checking for Multiple Property Values ===")

    # Properties that should only have ONE value per question
    single_value_properties = [
        DIALOG.questionId,
        DIALOG.questionText,
        DIALOG.slotName,
        DIALOG.order,
        DIALOG.inputType,
        DIALOG.required
    ]

    query_template = """
    PREFIX : <http://diggi.io/ontology/dialog#>
    PREFIX mm: <http://diggi.io/ontology/multimodal#>

    SELECT ?question (COUNT(DISTINCT ?value) as ?count)
    WHERE {{
        {{
            ?question a :Question .
        }} UNION {{
            ?question a mm:MultimodalQuestion .
        }}
        ?question <{property}> ?value .
    }}
    GROUP BY ?question
    HAVING (COUNT(DISTINCT ?value) > 1)
    """

    issues_found = False

    for prop in single_value_properties:
        query = query_template.format(property=str(prop))
        results = graph.query(query)

        for row in results:
            issues_found = True
            question_uri = str(row.question)
            count = int(row['count'])

            # Get the label for better readability
            label_query = f"""
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?label WHERE {{
                <{question_uri}> rdfs:label ?label .
            }}
            LIMIT 1
            """
            label_results = graph.query(label_query)
            label = next((str(r.label) for r in label_results), question_uri)

            logger.error(f"MULTIPLE VALUES for {prop.split('#')[-1]}: {label} ({question_uri}) has {count} values")

    if not issues_found:
        logger.info("✓ No multiple property value issues found")

    return issues_found


def check_orphaned_subquestions(graph):
    """Check for sub-questions without parent questions"""
    logger.info("\n=== Checking for Orphaned Sub-Questions ===")

    query = """
    PREFIX : <http://diggi.io/ontology/dialog#>

    SELECT ?subQuestion ?questionId
    WHERE {
        ?subQuestion a :SubQuestion ;
                     :questionId ?questionId .

        FILTER NOT EXISTS {
            ?parent :hasSubQuestion ?subQuestion .
        }
    }
    """

    results = graph.query(query)
    orphans_found = False

    for row in results:
        orphans_found = True
        logger.warning(f"ORPHANED SubQuestion: {row.questionId} ({row.subQuestion})")

    if not orphans_found:
        logger.info("✓ No orphaned sub-questions found")

    return orphans_found


def check_missing_question_ids(graph):
    """Check for questions without questionId property"""
    logger.info("\n=== Checking for Missing Question IDs ===")

    query = """
    PREFIX : <http://diggi.io/ontology/dialog#>
    PREFIX mm: <http://diggi.io/ontology/multimodal#>

    SELECT DISTINCT ?question
    WHERE {
        {
            ?question a :Question .
        } UNION {
            ?question a mm:MultimodalQuestion .
        }
        FILTER NOT EXISTS { ?question :questionId ?id }
    }
    """

    results = graph.query(query)
    missing_found = False

    for row in results:
        missing_found = True
        logger.error(f"MISSING questionId: {row.question}")

    if not missing_found:
        logger.info("✓ All questions have questionId")

    return missing_found


def main():
    """Run all validation checks"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ontology_dir = os.path.join(script_dir, '..', 'ontologies')
    ontology_dir = os.path.abspath(ontology_dir)

    if not os.path.exists(ontology_dir):
        logger.error(f"Ontology directory not found: {ontology_dir}")
        sys.exit(1)

    logger.info(f"Validating ontology files in: {ontology_dir}\n")

    # Load all TTL files
    graph, ttl_files = load_ontology_files(ontology_dir)
    logger.info(f"\nLoaded {len(ttl_files)} TTL files with {len(graph)} triples\n")

    # Run all checks
    has_errors = False

    has_errors |= check_duplicate_questions(graph)
    has_errors |= check_multiple_property_values(graph)
    has_errors |= check_orphaned_subquestions(graph)
    has_errors |= check_missing_question_ids(graph)

    # Summary
    print("\n" + "="*60)
    if has_errors:
        logger.error("❌ VALIDATION FAILED - Issues found!")
        sys.exit(1)
    else:
        logger.info("✅ VALIDATION PASSED - No issues found!")
        sys.exit(0)


if __name__ == "__main__":
    main()
