#!/usr/bin/env python
"""Debug script to check question order from dialog manager"""

from dialog_manager import DialogManager

ontology_paths = [
    "../ontologies/dialog.ttl",
    "../ontologies/dialog-multimodal.ttl",
    "../ontologies/dialog-insurance-questions.ttl",
    "../ontologies/dialog-sections.ttl",
    "../ontologies/dialog-vocabularies.ttl",
    "../ontologies/dialog-documents.ttl",
    "../ontologies/dialog-validation.ttl",
    "../ontologies/dialog-confidence.ttl",
    "../ontologies/dialog-forms.ttl"
]

dm = DialogManager(ontology_paths)
flow = dm.get_dialog_flow('InsuranceQuoteDialog')

print(f"\n{'='*80}")
print("DIALOG FLOW QUESTION ORDER")
print(f"{'='*80}\n")

questions = [node for node in flow if 'question_id' in node]
print(f"Total questions in flow: {len(questions)}\n")
print(f"{'#':<4} {'Order':<8} {'Question ID':<25} {'Question Text':<50}")
print("-" * 90)

for i, q in enumerate(questions[:10]):  # Show first 10
    order = q.get('order', 'N/A')
    qid = q['question_id']
    text = q['question_text']

    # Highlight first_name and last_name
    marker = ""
    if qid == "q_first_name":
        marker = " <<<< SHOULD BE FIRST"
    elif qid == "q_last_name":
        marker = " <<<< SHOULD BE SECOND"

    print(f"{i+1:<4} {str(order):<8} {qid:<25} {text:<50}{marker}")

print(f"\n{'='*80}\n")
