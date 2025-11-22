"""
Generate TTL ontology from UK insurance questions data
"""

import os
import json
from uk_insurance_questions_data import UK_INSURANCE_QUESTIONS


def generate_ttl_from_questions(questions):
    """
    Convert questions to TTL ontology format
    """
    ttl_lines = [
        "@prefix : <http://diggi.io/ontology/dialog#> .",
        "@prefix mm: <http://diggi.io/ontology/multimodal#> .",
        "@prefix vocab: <http://diggi.io/ontology/vocabularies#> .",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "# UK Car Insurance Questions with Multiple Choice Options",
        "# Comprehensive question set for car insurance quotes",
        ""
    ]

    for idx, q in enumerate(questions):
        q_id = q['question_id']
        q_class = ''.join(word.capitalize() for word in q_id.split('_'))

        # Question definition
        ttl_lines.append(f":{q_class} a mm:MultimodalQuestion ;")
        ttl_lines.append(f'    rdfs:label "{q.get("question_text", "")}" ;')
        ttl_lines.append(f'    :questionId "{q_id}" ;')
        ttl_lines.append(f'    :questionText "{q.get("question_text", "")}" ;')
        ttl_lines.append(f'    :slotName "{q_id.replace("q_", "")}" ;')
        ttl_lines.append(f'    :required {"true" if q.get("required", False) else "false"} ;')
        ttl_lines.append(f'    :order {(idx + 1) * 10} ;')
        ttl_lines.append(f'    mm:fieldType "{q.get("field_type", "text")}" ;')
        ttl_lines.append(f'    mm:category "{q.get("category", "general")}" .')
        ttl_lines.append("")

        # Option definitions
        if q.get('field_type') == 'select' and q.get('options'):
            for opt_idx, opt in enumerate(q['options']):
                # Clean up value for TTL ID
                opt_value_clean = opt['value'].replace(' ', '_').replace('-', '_').replace('+', 'Plus')
                opt_id = f":{q_class}_{opt_value_clean}"

                ttl_lines.append(f"{opt_id} a :SelectOption ;")
                ttl_lines.append(f'    :optionValue "{opt["value"]}" ;')
                ttl_lines.append(f'    :optionLabel "{opt["label"]}" ;')
                if opt.get('aliases'):
                    aliases = ', '.join(opt['aliases'])
                    ttl_lines.append(f'    :optionAlias "{aliases}" ;')
                ttl_lines.append(f'    :belongsToQuestion :{q_class} ;')
                ttl_lines.append(f'    :optionOrder {opt_idx + 1} .')
                ttl_lines.append("")

    return '\n'.join(ttl_lines)


def save_ttl(ttl_content, filename="dialog-insurance-select-options.ttl"):
    """Save TTL ontology to file"""
    # Save to ontologies folder
    output_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ontologies', filename)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ttl_content)

    print(f"💾 Saved TTL ontology to {output_path}")
    return output_path


def save_json(questions, filename="uk_insurance_questions.json"):
    """Save questions to JSON file"""
    output_path = os.path.join(os.path.dirname(__file__), filename)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved JSON to {output_path}")
    return output_path


if __name__ == "__main__":
    print("=" * 80)
    print("UK Car Insurance Questions → TTL Generator")
    print("=" * 80)

    # Generate TTL
    ttl_content = generate_ttl_from_questions(UK_INSURANCE_QUESTIONS)
    ttl_path = save_ttl(ttl_content)

    # Save JSON
    json_path = save_json(UK_INSURANCE_QUESTIONS)

    # Print summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    print(f"Total questions: {len(UK_INSURANCE_QUESTIONS)}")

    # Count by category
    categories = {}
    select_questions = 0
    total_options = 0

    for q in UK_INSURANCE_QUESTIONS:
        cat = q.get('category', 'general')
        categories[cat] = categories.get(cat, 0) + 1

        if q.get('field_type') == 'select' and q.get('options'):
            select_questions += 1
            total_options += len(q['options'])

    print(f"Select questions: {select_questions}")
    print(f"Total options: {total_options}")
    print(f"\nQuestions by category:")
    for cat, count in sorted(categories.items()):
        print(f"  - {cat}: {count}")

    print(f"\n✅ Files saved:")
    print(f"  - JSON: {json_path}")
    print(f"  - TTL: {ttl_path}")

    # Print sample questions
    print("\n" + "=" * 80)
    print("📋 SAMPLE QUESTIONS WITH OPTIONS")
    print("=" * 80)
    for q in UK_INSURANCE_QUESTIONS[:5]:
        print(f"\n{q['question_id']} ({q.get('field_type', 'text')})")
        print(f"  Q: {q['question_text']}")
        if q.get('options'):
            print(f"  Options ({len(q['options'])}):")
            for opt in q['options'][:5]:
                aliases = f" ({', '.join(opt['aliases'])})" if opt['aliases'] else ""
                print(f"    - {opt['label']}{aliases}")
            if len(q['options']) > 5:
                print(f"    ... and {len(q['options']) - 5} more options")
