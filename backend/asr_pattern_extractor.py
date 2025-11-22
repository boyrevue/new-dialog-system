"""
ASR Pattern Extractor
Analyzes TTS question variants to extract all possible ASR response patterns
"""

import re
from typing import List, Set, Dict


def extract_response_patterns_from_questions(tts_variants: List[str]) -> List[str]:
    """
    Extract potential response patterns from question variants

    ENHANCED: Generates LOTS MORE response variant alternatives for comprehensive ASR coverage

    Example:
        Questions:
        - "What is your first name?"
        - "Could you tell me your first name?"
        - "Please provide your first name."
        - "I need your first name."

        Extracted patterns (50+ variants):
        - "my first name is <answer>"
        - "my name is <answer>"
        - "it's <answer>"
        - "the name is <answer>"
        - "<answer>"
        - ... LOTS MORE
    """
    patterns = set()

    for variant in tts_variants:
        variant_lower = variant.lower().strip().rstrip('?').rstrip('.')

        # Extract the subject being asked about
        # "What is YOUR first name?" → "first name"
        # "Could you tell me YOUR first name?" → "first name"

        # Pattern 1: "your X" → "my X is/was/will be/etc"
        your_match = re.search(r'your\s+([\w\s]+?)(?:\?|$|,)', variant_lower)
        if your_match:
            subject = your_match.group(1).strip()
            # Core patterns
            patterns.add(f"my {subject} is <answer>")
            patterns.add(f"my {subject} <answer>")
            patterns.add(f"the {subject} is <answer>")

            # Extended possessive variants
            patterns.add(f"my {subject}'s <answer>")
            patterns.add(f"my {subject} would be <answer>")
            patterns.add(f"my {subject} will be <answer>")
            patterns.add(f"my {subject} was <answer>")

            # Shortened forms
            if "first name" in subject or "given name" in subject or "forename" in subject:
                patterns.add(f"my name is <answer>")
                patterns.add(f"my name's <answer>")
                patterns.add(f"name is <answer>")
                patterns.add(f"name's <answer>")
                patterns.add(f"i'm <answer>")
                patterns.add(f"i am <answer>")
                patterns.add(f"i'm called <answer>")
                patterns.add(f"i am called <answer>")
                patterns.add(f"call me <answer>")
                patterns.add(f"people call me <answer>")
                patterns.add(f"they call me <answer>")
                patterns.add(f"everyone calls me <answer>")

            if "last name" in subject or "surname" in subject or "family name" in subject:
                patterns.add(f"my surname is <answer>")
                patterns.add(f"my surname's <answer>")
                patterns.add(f"surname is <answer>")
                patterns.add(f"surname's <answer>")
                patterns.add(f"my family name is <answer>")

            # The X pattern variants
            patterns.add(f"the {subject}'s <answer>")
            patterns.add(f"the {subject} would be <answer>")

        # Pattern 2: "what is" → "it's/it is/that's/that is/etc"
        if 'what' in variant_lower or 'which' in variant_lower:
            patterns.add("it's <answer>")
            patterns.add("it is <answer>")
            patterns.add("that's <answer>")
            patterns.add("that is <answer>")
            patterns.add("that'd be <answer>")
            patterns.add("that would be <answer>")
            patterns.add("this is <answer>")
            patterns.add("this would be <answer>")

        # Pattern 3: "tell me" → implicit "X" with variants
        if 'tell me' in variant_lower or 'provide' in variant_lower:
            patterns.add("<answer>")
            patterns.add("sure <answer>")
            patterns.add("yes <answer>")
            patterns.add("okay <answer>")
            patterns.add("ok <answer>")
            patterns.add("yeah <answer>")
            patterns.add("yep <answer>")
            patterns.add("alright <answer>")

        # Pattern 4: "I need" → "here is/here's/etc"
        if 'i need' in variant_lower or 'we need' in variant_lower:
            patterns.add("here is <answer>")
            patterns.add("here's <answer>")
            patterns.add("here you go <answer>")
            patterns.add("there you go <answer>")

    # ALWAYS INCLUDE: Comprehensive common response patterns
    # Direct answers
    patterns.add("<answer>")

    # It/That variants
    patterns.add("it's <answer>")
    patterns.add("it is <answer>")
    patterns.add("that's <answer>")
    patterns.add("that is <answer>")
    patterns.add("that would be <answer>")
    patterns.add("that'd be <answer>")
    patterns.add("this is <answer>")

    # The answer variants
    patterns.add("the answer is <answer>")
    patterns.add("the answer's <answer>")
    patterns.add("answer is <answer>")
    patterns.add("answer's <answer>")

    # Conversational affirmations
    patterns.add("sure it's <answer>")
    patterns.add("yes it's <answer>")
    patterns.add("yeah it's <answer>")
    patterns.add("yep it's <answer>")
    patterns.add("okay it's <answer>")
    patterns.add("ok it's <answer>")
    patterns.add("alright it's <answer>")

    # Polite/formal responses
    patterns.add("certainly <answer>")
    patterns.add("of course <answer>")
    patterns.add("absolutely <answer>")
    patterns.add("definitely <answer>")
    patterns.add("sure <answer>")

    # Uncertain/hedging responses
    patterns.add("i think it's <answer>")
    patterns.add("i think <answer>")
    patterns.add("i believe it's <answer>")
    patterns.add("i believe <answer>")
    patterns.add("probably <answer>")
    patterns.add("maybe <answer>")
    patterns.add("possibly <answer>")
    patterns.add("i'm pretty sure it's <answer>")

    # Temporal responses
    patterns.add("right now it's <answer>")
    patterns.add("currently it's <answer>")
    patterns.add("at the moment it's <answer>")
    patterns.add("as of now it's <answer>")

    return sorted(list(patterns))


def extract_subject_from_questions(tts_variants: List[str]) -> str:
    """
    Extract the main subject being asked about

    Example:
        "What is your first name?" → "first name"
        "Tell me your email address" → "email address"
    """
    for variant in tts_variants:
        variant_lower = variant.lower()

        # Try to find "your X"
        your_match = re.search(r'your\s+([\w\s]+?)(?:\?|$|,|\.)', variant_lower)
        if your_match:
            return your_match.group(1).strip()

        # Try to find "the X"
        the_match = re.search(r'the\s+([\w\s]+?)(?:\?|$|,|\.)', variant_lower)
        if the_match:
            return the_match.group(1).strip()

    return "answer"


def generate_all_permutations(
    response_patterns: List[str],
    question_subject: str,
    field_type: str = "generic"
) -> Dict:
    """
    Generate all permutations of ASR patterns

    Returns:
        {
            "prefixes": [...],  # All possible response prefixes
            "patterns": [...],   # All pattern variations
            "examples": [...]    # Example utterances
        }
    """
    prefixes = set()
    examples = set()

    # Extract prefixes from patterns
    for pattern in response_patterns:
        # Extract prefix before <answer>
        prefix_match = re.search(r'^(.+?)\s*<answer>', pattern)
        if prefix_match:
            prefix = prefix_match.group(1).strip()
            prefixes.add(prefix)
        else:
            prefixes.add("")  # No prefix (direct answer)

    # Generate example utterances
    example_values = {
        "name": ["John", "Sarah", "Michael"],
        "email": ["john@example.com", "sarah.smith@gmail.com"],
        "phone": ["07700 900123", "01234 567890"],
        "postcode": ["SW1A 1AA", "M1 1AE"],
        "date": ["15th January 1990", "March 3rd 1985"],
        "address": ["123 Main Street", "45 Oak Avenue"],
        "number": ["5", "ten", "twenty-three"],
        "yes_no": ["yes", "no", "yeah", "nope"]
    }

    # Determine appropriate examples based on field type
    example_set = example_values.get(field_type, ["sample answer"])

    # Generate example utterances with all prefix permutations
    for prefix in prefixes:
        for example in example_set[:2]:  # Limit to 2 examples per prefix
            if prefix:
                examples.add(f"{prefix} {example}")
            else:
                examples.add(example)

    return {
        "prefixes": sorted(list(prefixes)),
        "patterns": response_patterns,
        "examples": sorted(list(examples))
    }


def build_jsgf_from_permutations(
    patterns: List[str],
    question_subject: str,
    field_type: str,
    token_definition: str
) -> str:
    """
    Build JSGF grammar from pattern permutations

    Args:
        patterns: List of response patterns like ["my name is <answer>", "<answer>"]
        question_subject: The subject being asked (e.g., "first name")
        field_type: Type of field (name, email, phone, etc.)
        token_definition: JSGF definition for the <answer> token

    Returns:
        Complete JSGF grammar string
    """
    # Build grammar name from subject
    grammar_name = question_subject.replace(" ", "_")

    # Build public rule alternatives
    alternatives = []
    for pattern in patterns:
        # Convert pattern to JSGF format
        # "my name is <answer>" → "[my name is] <answer>"
        prefix_match = re.search(r'^(.+?)\s*<answer>', pattern)
        if prefix_match:
            prefix = prefix_match.group(1).strip()
            alternatives.append(f"[{prefix}] <answer>")
        else:
            alternatives.append("<answer>")

    # Remove duplicates and join
    alternatives = list(dict.fromkeys(alternatives))  # Preserve order, remove dupes
    alternatives_str = " |\n                   ".join(alternatives)

    # Build complete grammar
    grammar = f"""#JSGF V1.0;
grammar {grammar_name}_response;

public <response> = {alternatives_str};

{token_definition}
"""

    return grammar
