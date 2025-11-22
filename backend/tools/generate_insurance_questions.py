"""
Car Insurance Question Generator using OpenAI
Generates comprehensive list of car insurance questions with multiple choice options
"""

import os
import json
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def generate_insurance_questions():
    """
    Generate comprehensive car insurance questions with multiple choice options
    """

    prompt = """You are an expert in UK car insurance underwriting. Generate a comprehensive list of ALL questions typically asked when getting a car insurance quote in the UK.

For EACH question, provide:
1. Question ID (snake_case)
2. Question text
3. Field type (select, text, date, number, etc.)
4. Whether it's required
5. Multiple choice options (if applicable) with:
   - Option value (code)
   - Option label (display text)
   - Option aliases (alternative ways to say it)

Include questions about:
- Personal information (name, DOB, gender, title, marital status, occupation, etc.)
- Vehicle details (make, model, year, fuel type, value, registration, etc.)
- Driving history (licence type, years held, claims, convictions, etc.)
- Usage (annual mileage, overnight parking, main use, etc.)
- Cover details (cover type, voluntary excess, start date, etc.)
- Security (alarm, immobilizer, tracker, etc.)
- Additional drivers (names, relationships, ages, etc.)
- Modifications (performance, cosmetic, etc.)
- No claims bonus (years, protected, etc.)

Return as a JSON array with this structure:
[
  {
    "question_id": "q_gender",
    "question_text": "What is your gender?",
    "field_type": "select",
    "required": true,
    "category": "personal_info",
    "options": [
      {"value": "male", "label": "Male", "aliases": ["man", "m"]},
      {"value": "female", "label": "Female", "aliases": ["woman", "f"]},
      {"value": "non_binary", "label": "Non-binary", "aliases": ["other", "nb"]},
      {"value": "prefer_not_to_say", "label": "Prefer not to say", "aliases": []}
    ]
  },
  ...
]

Generate ALL relevant questions for a complete car insurance application. Be comprehensive!"""

    try:
        print("🤖 Generating car insurance questions using OpenAI...")

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert UK car insurance underwriter. Generate comprehensive insurance questions with multiple choice options in valid JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=16000,
            response_format={"type": "json_object"}
        )

        # Extract JSON response
        content = response.choices[0].message.content
        questions_data = json.loads(content)

        # Handle both direct array and nested structure
        if isinstance(questions_data, dict) and 'questions' in questions_data:
            questions = questions_data['questions']
        else:
            questions = questions_data

        print(f"✅ Generated {len(questions)} insurance questions")

        return questions

    except Exception as e:
        print(f"❌ Error generating questions: {e}")
        return None


def generate_select_options_for_question(question_text, context=""):
    """
    Generate multiple choice options for a specific question using OpenAI
    """

    prompt = f"""Generate comprehensive multiple choice options for this UK car insurance question:

Question: "{question_text}"
{f"Context: {context}" if context else ""}

Provide ALL realistic options that users might select. Include:
- Common options
- Edge cases
- UK-specific options

Return as JSON array:
[
  {{"value": "option_code", "label": "Display Label", "aliases": ["alternative 1", "alt 2"]}},
  ...
]

Be thorough and comprehensive!"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert in UK car insurance. Generate comprehensive multiple choice options in valid JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        options_data = json.loads(content)

        # Handle both direct array and nested structure
        if isinstance(options_data, dict) and 'options' in options_data:
            options = options_data['options']
        else:
            options = options_data

        return options

    except Exception as e:
        print(f"❌ Error generating options: {e}")
        return []


def save_questions_to_json(questions, filename="insurance_questions.json"):
    """Save generated questions to JSON file"""
    output_path = os.path.join(os.path.dirname(__file__), filename)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved questions to {output_path}")
    return output_path


def generate_ttl_from_questions(questions):
    """
    Convert generated questions to TTL ontology format
    """
    ttl_lines = [
        "@prefix : <http://diggi.io/ontology/dialog#> .",
        "@prefix mm: <http://diggi.io/ontology/multimodal#> .",
        "@prefix vocab: <http://diggi.io/ontology/vocabularies#> .",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "# Generated Car Insurance Questions",
        "# Auto-generated from OpenAI",
        ""
    ]

    for idx, q in enumerate(questions):
        q_id = q['question_id']
        q_class = ''.join(word.capitalize() for word in q_id.split('_')) + "Question"

        # Question definition
        ttl_lines.append(f":{q_class} a mm:MultimodalQuestion ;")
        ttl_lines.append(f'    rdfs:label "{q.get("question_text", "")}" ;')
        ttl_lines.append(f'    :questionId "{q_id}" ;')
        ttl_lines.append(f'    :questionText "{q.get("question_text", "")}" ;')
        ttl_lines.append(f'    :slotName "{q_id.replace("q_", "")}" ;')
        ttl_lines.append(f'    :required {"true" if q.get("required", False) else "false"} ;')
        ttl_lines.append(f'    :order {(idx + 1) * 10} ;')
        ttl_lines.append(f'    mm:fieldType "{q.get("field_type", "text")}" ;')

        # Add options if select field
        if q.get('field_type') == 'select' and q.get('options'):
            ttl_lines.append(f'    mm:hasOptions (')
            for opt in q['options']:
                opt_id = f":{q_class}_{opt['value'].replace(' ', '_').replace('-', '_')}"
                ttl_lines.append(f'        {opt_id}')
            ttl_lines.append(f'    ) ;')

        ttl_lines.append(f'    mm:category "{q.get("category", "general")}" .')
        ttl_lines.append("")

        # Option definitions
        if q.get('field_type') == 'select' and q.get('options'):
            for opt in q['options']:
                opt_id = f":{q_class}_{opt['value'].replace(' ', '_').replace('-', '_')}"
                ttl_lines.append(f"{opt_id} a :SelectOption ;")
                ttl_lines.append(f'    :optionValue "{opt["value"]}" ;')
                ttl_lines.append(f'    :optionLabel "{opt["label"]}" ;')
                if opt.get('aliases'):
                    aliases = ', '.join(opt['aliases'])
                    ttl_lines.append(f'    :optionAlias "{aliases}" ;')
                ttl_lines.append(f'    :optionOrder {q["options"].index(opt) + 1} .')
                ttl_lines.append("")

    return '\n'.join(ttl_lines)


def save_ttl(ttl_content, filename="dialog-insurance-generated.ttl"):
    """Save TTL ontology to file"""
    output_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ontologies', filename)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ttl_content)

    print(f"💾 Saved TTL ontology to {output_path}")
    return output_path


if __name__ == "__main__":
    print("=" * 80)
    print("Car Insurance Question Generator")
    print("=" * 80)

    # Check for OpenAI API key
    if not os.environ.get("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY environment variable not set!")
        print("Please set it with: export OPENAI_API_KEY='your-key-here'")
        exit(1)

    # Generate questions
    questions = generate_insurance_questions()

    if questions:
        # Save to JSON
        json_path = save_questions_to_json(questions)

        # Generate and save TTL
        ttl_content = generate_ttl_from_questions(questions)
        ttl_path = save_ttl(ttl_content)

        # Print summary
        print("\n" + "=" * 80)
        print("📊 SUMMARY")
        print("=" * 80)
        print(f"Total questions generated: {len(questions)}")

        # Count by category
        categories = {}
        select_questions = 0
        total_options = 0

        for q in questions:
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
        print("📋 SAMPLE QUESTIONS")
        print("=" * 80)
        for q in questions[:5]:
            print(f"\n{q['question_id']} ({q.get('field_type', 'text')})")
            print(f"  Q: {q['question_text']}")
            if q.get('options'):
                print(f"  Options: {', '.join([opt['label'] for opt in q['options'][:5]])}")
                if len(q['options']) > 5:
                    print(f"  ... and {len(q['options']) - 5} more")
    else:
        print("❌ Failed to generate questions")
