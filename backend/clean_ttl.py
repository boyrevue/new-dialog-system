#!/usr/bin/env python3
"""
TTL Cleaner CLI Script

Cleans TTL files by removing duplicates while preserving semantic alternatives.

Usage:
    python clean_ttl.py --file ../ontologies/dialog-insurance-questions.ttl
    python clean_ttl.py --all  # Clean all ontology files
"""

import argparse
import sys
import os
from pathlib import Path
from rdflib import Graph
from ttl_validator import TTLValidator, TTLCleaner
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def clean_ttl_file(file_path: str, backup: bool = True, dry_run: bool = False):
    """
    Clean a single TTL file

    Args:
        file_path: Path to TTL file
        backup: Whether to create backup before cleaning
        dry_run: If True, only report issues without cleaning
    """
    logger.info(f"\n{'='*70}")
    logger.info(f"Processing: {file_path}")
    logger.info(f"{'='*70}")

    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return False

    # Load graph
    try:
        graph = Graph()
        graph.parse(file_path, format="turtle")
        logger.info(f"Loaded {len(graph)} triples from {file_path}")
    except Exception as e:
        logger.error(f"Error loading TTL file: {e}")
        return False

    # Validate
    validator = TTLValidator(graph)
    is_valid, issues = validator.validate()

    if is_valid:
        logger.info("✓ TTL is valid - no duplicates found")
        return True

    # Report issues
    logger.warning(f"\n⚠ Found issues:")

    if issues["duplicate_questions"]:
        logger.warning(f"\nDuplicate Questions ({len(issues['duplicate_questions'])}):")
        for qid, uris in issues["duplicate_questions"].items():
            logger.warning(f"  - questionId '{qid}': {len(uris)} occurrences")
            for uri in uris:
                logger.warning(f"    • {uri}")

    if issues["duplicate_subquestions"]:
        logger.warning(f"\nDuplicate SubQuestions ({len(issues['duplicate_subquestions'])}):")
        for qid, uris in issues["duplicate_subquestions"].items():
            logger.warning(f"  - questionId '{qid}': {len(uris)} occurrences")
            for uri in uris:
                logger.warning(f"    • {uri}")

    if issues["duplicate_sections"]:
        logger.warning(f"\nDuplicate Sections ({len(issues['duplicate_sections'])}):")
        for sid, uris in issues["duplicate_sections"].items():
            logger.warning(f"  - sectionId '{sid}': {len(uris)} occurrences")
            for uri in uris:
                logger.warning(f"    • {uri}")

    if dry_run:
        logger.info("\n[DRY RUN] Would clean these duplicates")
        return False

    # Create backup
    if backup:
        backup_path = f"{file_path}.backup"
        try:
            graph.serialize(destination=backup_path, format="turtle")
            logger.info(f"✓ Created backup: {backup_path}")
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            return False

    # Clean
    logger.info("\nCleaning duplicates...")
    cleaner = TTLCleaner(graph)
    results = cleaner.clean()

    logger.info(f"\n✓ Cleaning complete:")
    logger.info(f"  - Duplicate questions removed: {results['questions_removed']}")
    logger.info(f"  - Duplicate sub-questions removed: {results['subquestions_removed']}")
    logger.info(f"  - Total triples removed: {results['total_triples_removed']}")

    # Save cleaned file
    try:
        cleaner.save_cleaned(file_path, format="turtle")
        logger.info(f"✓ Saved cleaned TTL to {file_path}")
        return True
    except Exception as e:
        logger.error(f"Error saving cleaned file: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Clean TTL files by removing duplicates")
    parser.add_argument("--file", "-f", help="Path to single TTL file to clean")
    parser.add_argument("--all", "-a", action="store_true", help="Clean all ontology files")
    parser.add_argument("--no-backup", action="store_true", help="Skip creating backups")
    parser.add_argument("--dry-run", action="store_true", help="Report issues without cleaning")

    args = parser.parse_args()

    if not args.file and not args.all:
        parser.print_help()
        sys.exit(1)

    backup = not args.no_backup
    dry_run = args.dry_run

    if args.file:
        # Clean single file
        success = clean_ttl_file(args.file, backup=backup, dry_run=dry_run)
        sys.exit(0 if success else 1)

    elif args.all:
        # Clean all ontology files
        ontology_dir = Path(__file__).parent.parent / "ontologies"

        if not ontology_dir.exists():
            logger.error(f"Ontology directory not found: {ontology_dir}")
            sys.exit(1)

        ttl_files = list(ontology_dir.glob("*.ttl"))

        if not ttl_files:
            logger.warning(f"No TTL files found in {ontology_dir}")
            sys.exit(1)

        logger.info(f"Found {len(ttl_files)} TTL files to process\n")

        results = []
        for ttl_file in ttl_files:
            success = clean_ttl_file(str(ttl_file), backup=backup, dry_run=dry_run)
            results.append((ttl_file.name, success))

        # Summary
        logger.info(f"\n{'='*70}")
        logger.info("SUMMARY")
        logger.info(f"{'='*70}")

        for filename, success in results:
            status = "✓ CLEAN" if success else "✗ ISSUES" if dry_run else "✗ FAILED"
            logger.info(f"{status:12} {filename}")

        total = len(results)
        clean = sum(1 for _, success in results if success)
        logger.info(f"\nTotal: {total} files, Clean: {clean}, Issues: {total - clean}")

        sys.exit(0 if clean == total else 1)


if __name__ == "__main__":
    main()
