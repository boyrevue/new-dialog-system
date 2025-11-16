#!/usr/bin/env python3
"""
Normalize single-value properties for Questions in TTL files using rdflib.

Rules:
- For dialog:Question or mm:MultimodalQuestion subjects:
  - dialog:order → keep the smallest numeric value
  - dialog:inSection → prefer a section URI that exists in dialog-sections.ttl; otherwise keep first
  - dialog:questionId, dialog:questionText, dialog:slotName, dialog:inputType, dialog:required → keep first

Backups:
- For each modified TTL file, writes a .backup beside the file before saving.
"""

import os
import sys
from pathlib import Path
from typing import List, Optional
from rdflib import Graph, Namespace, RDF, URIRef, Literal

BASE_DIR = Path(__file__).resolve().parent
ONTOLOGY_DIR = BASE_DIR.parent / "ontologies"

DIALOG = Namespace("http://diggi.io/ontology/dialog#")
MM = Namespace("http://diggi.io/ontology/multimodal#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")

SINGLE_VALUE_PROPS_KEEP_FIRST = [
    DIALOG.questionId,
    DIALOG.questionText,
    DIALOG.slotName,
    DIALOG.inputType,
    DIALOG.required,
]


def load_valid_sections() -> set:
    """Load valid section URIs from dialog-sections.ttl."""
    sections_file = ONTOLOGY_DIR / "dialog-sections.ttl"
    valid_sections = set()
    if sections_file.exists():
        g = Graph()
        g.parse(str(sections_file), format="turtle")
        for s in g.subjects(RDF.type, DIALOG.Section):
            valid_sections.add(s)
    return valid_sections


def choose_min_int_literal(values: List[Literal]) -> Optional[Literal]:
    """Choose the smallest int-like literal from values; fallback to first if parsing fails."""
    ints = []
    for v in values:
        try:
            ints.append((int(str(v)), v))
        except Exception:
            continue
    if ints:
        ints.sort(key=lambda x: x[0])
        return ints[0][1]
    return values[0] if values else None


def normalize_subject(graph: Graph, subject, valid_sections: set) -> int:
    """Normalize single-value properties for one subject. Returns count of triples changed."""
    changed = 0

    # dialog:order (keep smallest int)
    order_values = list(graph.objects(subject, DIALOG.order))
    if len(order_values) > 1:
        chosen = choose_min_int_literal(order_values)
        if chosen is not None:
            for v in order_values:
                graph.remove((subject, DIALOG.order, v))
            graph.add((subject, DIALOG.order, chosen))
            changed += len(order_values) - 1

    # dialog:inSection (prefer one that exists in dialog-sections.ttl)
    section_values = list(graph.objects(subject, DIALOG.inSection))
    if len(section_values) > 1:
        chosen = None
        for v in section_values:
            if v in valid_sections:
                chosen = v
                break
        if chosen is None:
            chosen = section_values[0]
        for v in section_values:
            graph.remove((subject, DIALOG.inSection, v))
        graph.add((subject, DIALOG.inSection, chosen))
        changed += len(section_values) - 1

    # Properties where we keep the first occurrence
    for prop in SINGLE_VALUE_PROPS_KEEP_FIRST:
        vals = list(graph.objects(subject, prop))
        if len(vals) > 1:
            chosen = vals[0]
            for v in vals:
                graph.remove((subject, prop, v))
            graph.add((subject, prop, chosen))
            changed += len(vals) - 1

    return changed


def normalize_file(ttl_path: Path, valid_sections: set) -> bool:
    """Normalize a single TTL file; returns True if changes were saved."""
    g = Graph()
    g.parse(str(ttl_path), format="turtle")
    before_triples = len(g)

    changed_total = 0
    # Gather all questions (dialog:Question or mm:MultimodalQuestion)
    subjects = set()
    for s in g.subjects(RDF.type, DIALOG.Question):
        subjects.add(s)
    for s in g.subjects(RDF.type, MM.MultimodalQuestion):
        subjects.add(s)

    for s in subjects:
        changed_total += normalize_subject(g, s, valid_sections)

    if changed_total > 0:
        backup_path = ttl_path.with_suffix(".ttl.backup")
        # Write backup
        original = Graph()
        original.parse(str(ttl_path), format="turtle")
        original.serialize(destination=str(backup_path), format="turtle")
        # Save cleaned
        g.serialize(destination=str(ttl_path), format="turtle")
        after_triples = len(g)
        print(f"Normalized {ttl_path.name}: changed={changed_total}, triples {before_triples} -> {after_triples}")
        print(f"Backup written to: {backup_path.name}")
        return True
    else:
        print(f"No changes needed for {ttl_path.name}")
        return False


def main():
    if not ONTOLOGY_DIR.exists():
        print(f"Ontology directory not found: {ONTOLOGY_DIR}")
        sys.exit(1)

    valid_sections = load_valid_sections()
    ttl_files = sorted(ONTOLOGY_DIR.glob("*.ttl"))

    any_changes = False
    for ttl in ttl_files:
        # Skip backups
        if ttl.name.endswith(".ttl.backup"):
            continue
        try:
            changed = normalize_file(ttl, valid_sections)
            any_changes = any_changes or changed
        except Exception as e:
            print(f"Error processing {ttl.name}: {e}")
            sys.exit(1)

    if any_changes:
        print("Normalization finished with changes.")
    else:
        print("Normalization finished with no changes.")


if __name__ == "__main__":
    main()


