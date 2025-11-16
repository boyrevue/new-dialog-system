#!/usr/bin/env python3
"""
Ontology Structure Analysis Tool

Analyzes the dialog system ontologies to identify:
- Duplicate question definitions across files
- Unused ontology files
- Questions in dialog-sections.ttl vs dialog-insurance-questions.ttl
- Safe candidates for archiving
- Structural issues (multi-valued properties, orphan questions, etc.)

Usage:
    python analyze_ontology_structure.py
"""

import sys
from pathlib import Path
from collections import defaultdict
from rdflib import Graph, Namespace, RDF, RDFS, URIRef
from typing import Dict, List, Set, Tuple
import json

# Set up paths
SCRIPT_DIR = Path(__file__).parent
ONTOLOGY_DIR = SCRIPT_DIR.parent / "ontologies"

# Namespaces
DIALOG = Namespace("http://example.org/dialog#")
MM = Namespace("http://example.org/multimodal#")

# Files loaded at runtime (from multimodal_server.py)
LOADED_FILES = {
    "dialog.ttl",
    "dialog-multimodal.ttl",
    "dialog-insurance-questions.ttl",
    "dialog-sections.ttl",
    "dialog-vocabularies.ttl",
    "dialog-documents.ttl",
    "dialog-validation.ttl",
}

# Files that should be archived (not loaded at runtime)
ARCHIVABLE_FILES = {
    "dialog-forms.ttl",
    "dialog-claims-repeatable.ttl",
    "dialog-vehicle-modifications.ttl",
    "dialog-tts-asr-index.ttl",
    "dialog-confidence.ttl",  # Not in multimodal_server.py!
}

BACKUP_FILES = {
    "dialog-sections.ttl.backup",
    "dialog-validation.ttl.backup",
    "dialog.ttl.backup",
}


class OntologyAnalyzer:
    def __init__(self):
        self.graphs = {}
        self.combined_graph = Graph()
        self.question_locations = defaultdict(list)  # question_uri -> [file1, file2, ...]
        self.section_locations = defaultdict(list)
        self.issues = []

    def load_ontologies(self):
        """Load all TTL files from the ontologies directory."""
        print("Loading ontologies...")
        for ttl_file in ONTOLOGY_DIR.glob("*.ttl"):
            if ttl_file.name in BACKUP_FILES:
                continue

            try:
                g = Graph()
                g.parse(ttl_file, format="turtle")
                self.graphs[ttl_file.name] = g
                print(f"  ✓ Loaded {ttl_file.name} ({len(g)} triples)")
            except Exception as e:
                print(f"  ✗ Error loading {ttl_file.name}: {e}")

    def analyze_question_duplication(self):
        """Find questions defined in multiple files."""
        print("\n" + "="*80)
        print("ANALYZING QUESTION DUPLICATION")
        print("="*80)

        # Find all questions
        for filename, graph in self.graphs.items():
            for s in graph.subjects(RDF.type, MM.MultimodalQuestion):
                self.question_locations[str(s)].append(filename)

        # Report duplicates
        duplicates = {q: files for q, files in self.question_locations.items() if len(files) > 1}

        if duplicates:
            print(f"\n⚠️  Found {len(duplicates)} questions defined in multiple files:")
            for question_uri, files in sorted(duplicates.items()):
                print(f"\n  Question: {question_uri}")
                print(f"  Files: {', '.join(files)}")
                self.issues.append({
                    "type": "duplicate_question",
                    "question": question_uri,
                    "files": files
                })
        else:
            print("\n✓ No duplicate question definitions found!")

    def analyze_sections_file(self):
        """Analyze what's in dialog-sections.ttl."""
        print("\n" + "="*80)
        print("ANALYZING dialog-sections.ttl CONTENTS")
        print("="*80)

        if "dialog-sections.ttl" not in self.graphs:
            print("  ✗ dialog-sections.ttl not found!")
            return

        sections_graph = self.graphs["dialog-sections.ttl"]

        # Count sections
        sections = list(sections_graph.subjects(RDF.type, DIALOG.Section))
        print(f"\n  Sections defined: {len(sections)}")

        # Count questions in this file
        questions = list(sections_graph.subjects(RDF.type, MM.MultimodalQuestion))
        print(f"  Questions defined: {len(questions)}")

        if questions:
            print(f"\n  ⚠️  WARNING: dialog-sections.ttl contains {len(questions)} question definitions!")
            print("  This file should ONLY contain section metadata (ID, title, order)")
            print(f"  File size: {(ONTOLOGY_DIR / 'dialog-sections.ttl').stat().st_size / 1024:.1f} KB")

            self.issues.append({
                "type": "questions_in_sections_file",
                "count": len(questions),
                "questions": [str(q) for q in questions[:5]]  # Sample
            })
        else:
            print("\n  ✓ Good! No questions in dialog-sections.ttl")

    def analyze_multi_valued_properties(self):
        """Find questions with multiple :inSection or :order values."""
        print("\n" + "="*80)
        print("ANALYZING MULTI-VALUED PROPERTIES")
        print("="*80)

        multi_section = []
        multi_order = []

        for filename, graph in self.graphs.items():
            for question in graph.subjects(RDF.type, MM.MultimodalQuestion):
                # Check :inSection
                sections = list(graph.objects(question, DIALOG.inSection))
                if len(sections) > 1:
                    multi_section.append((str(question), filename, len(sections)))

                # Check :order
                orders = list(graph.objects(question, DIALOG.order))
                if len(orders) > 1:
                    multi_order.append((str(question), filename, len(orders)))

        if multi_section:
            print(f"\n  ⚠️  Found {len(multi_section)} questions with multiple :inSection values:")
            for q, file, count in multi_section[:10]:
                print(f"    {q} in {file} ({count} values)")
            self.issues.append({
                "type": "multi_valued_inSection",
                "count": len(multi_section)
            })
        else:
            print("\n  ✓ No questions with multiple :inSection values")

        if multi_order:
            print(f"\n  ⚠️  Found {len(multi_order)} questions with multiple :order values:")
            for q, file, count in multi_order[:10]:
                print(f"    {q} in {file} ({count} values)")
            self.issues.append({
                "type": "multi_valued_order",
                "count": len(multi_order)
            })
        else:
            print("\n  ✓ No questions with multiple :order values")

    def analyze_archivable_files(self):
        """Identify files that can be archived."""
        print("\n" + "="*80)
        print("ARCHIVABLE FILES ANALYSIS")
        print("="*80)

        print("\n📦 Files NOT loaded at runtime (safe to archive):")
        for filename in sorted(ARCHIVABLE_FILES):
            if filename in self.graphs:
                triples = len(self.graphs[filename])
                size = (ONTOLOGY_DIR / filename).stat().st_size / 1024
                print(f"  • {filename} ({triples} triples, {size:.1f} KB)")

        print("\n🗑️  Backup files (safe to delete):")
        for filename in sorted(BACKUP_FILES):
            filepath = ONTOLOGY_DIR / filename
            if filepath.exists():
                size = filepath.stat().st_size / 1024
                print(f"  • {filename} ({size:.1f} KB)")

    def analyze_orphan_questions(self):
        """Find questions not in any section."""
        print("\n" + "="*80)
        print("ANALYZING ORPHAN QUESTIONS")
        print("="*80)

        orphans = []
        for filename, graph in self.graphs.items():
            for question in graph.subjects(RDF.type, MM.MultimodalQuestion):
                sections = list(graph.objects(question, DIALOG.inSection))
                if not sections:
                    orphans.append((str(question), filename))

        if orphans:
            print(f"\n  ⚠️  Found {len(orphans)} questions without :inSection:")
            for q, file in orphans[:10]:
                print(f"    {q} in {file}")
            self.issues.append({
                "type": "orphan_questions",
                "count": len(orphans)
            })
        else:
            print("\n  ✓ All questions have a section assignment")

    def generate_summary(self):
        """Generate executive summary."""
        print("\n" + "="*80)
        print("EXECUTIVE SUMMARY")
        print("="*80)

        total_questions = len(self.question_locations)
        print(f"\n📊 Statistics:")
        print(f"  Total questions found: {total_questions}")
        print(f"  Loaded ontologies: {len([f for f in self.graphs.keys() if f in LOADED_FILES])}")
        print(f"  Archivable ontologies: {len([f for f in self.graphs.keys() if f in ARCHIVABLE_FILES])}")
        print(f"  Issues found: {len(self.issues)}")

        if self.issues:
            print(f"\n⚠️  Issues Summary:")
            issue_types = defaultdict(int)
            for issue in self.issues:
                issue_types[issue['type']] += 1
            for issue_type, count in sorted(issue_types.items()):
                print(f"    • {issue_type}: {count}")
        else:
            print(f"\n✅ No issues found! Ontologies are clean.")

    def generate_recommendations(self):
        """Generate action recommendations."""
        print("\n" + "="*80)
        print("RECOMMENDATIONS")
        print("="*80)

        recommendations = []

        # Check if dialog-sections.ttl has questions
        if any(i['type'] == 'questions_in_sections_file' for i in self.issues):
            recommendations.append({
                "priority": "HIGH",
                "action": "Restructure dialog-sections.ttl",
                "details": "Remove all question definitions, keep only section metadata (ID, title, order)"
            })

        # Check for duplicate questions
        if any(i['type'] == 'duplicate_question' for i in self.issues):
            recommendations.append({
                "priority": "HIGH",
                "action": "Remove duplicate question definitions",
                "details": "Keep questions in dialog-insurance-questions.ttl only, remove from dialog-sections.ttl"
            })

        # Archive unused files
        if ARCHIVABLE_FILES:
            recommendations.append({
                "priority": "MEDIUM",
                "action": "Archive unused ontology files",
                "details": f"Move {len(ARCHIVABLE_FILES)} unused files to ontologies/archive/"
            })

        # Delete backup files
        recommendations.append({
            "priority": "LOW",
            "action": "Delete backup files",
            "details": f"Remove {len(BACKUP_FILES)} .backup files"
        })

        # Add SHACL validation
        recommendations.append({
            "priority": "MEDIUM",
            "action": "Add SHACL validation rules",
            "details": "Enforce single :inSection and :order per question"
        })

        for i, rec in enumerate(recommendations, 1):
            print(f"\n{i}. [{rec['priority']}] {rec['action']}")
            print(f"   {rec['details']}")

    def save_report(self):
        """Save detailed report to JSON."""
        report = {
            "summary": {
                "total_questions": len(self.question_locations),
                "loaded_files": len([f for f in self.graphs.keys() if f in LOADED_FILES]),
                "archivable_files": len([f for f in self.graphs.keys() if f in ARCHIVABLE_FILES]),
                "issues_count": len(self.issues)
            },
            "issues": self.issues,
            "question_locations": dict(self.question_locations),
            "files": {
                "loaded": sorted(LOADED_FILES),
                "archivable": sorted(ARCHIVABLE_FILES),
                "backups": sorted(BACKUP_FILES)
            }
        }

        report_path = SCRIPT_DIR / "ontology_analysis_report.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Detailed report saved to: {report_path}")

    def run_analysis(self):
        """Run complete analysis."""
        self.load_ontologies()
        self.analyze_question_duplication()
        self.analyze_sections_file()
        self.analyze_multi_valued_properties()
        self.analyze_orphan_questions()
        self.analyze_archivable_files()
        self.generate_summary()
        self.generate_recommendations()
        self.save_report()


if __name__ == "__main__":
    analyzer = OntologyAnalyzer()
    analyzer.run_analysis()
