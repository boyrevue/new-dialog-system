"""
TTS Question Variant Generator
Automatically generates multiple rephrased versions of questions for TTS
"""

import re
from typing import List, Dict


def generate_tts_variants(base_question: str, question_type: str = "generic") -> List[str]:
    """
    Generate multiple TTS question variants from a base question

    Args:
        base_question: Original question (e.g., "What is your first name?")
        question_type: Type of question (name, email, phone, etc.)

    Returns:
        List of rephrased question variants
    """
    variants = [base_question]  # Always include the original

    # Extract the subject from the question
    subject = extract_subject_from_question(base_question)

    # Generate variants based on question type
    if question_type == "name":
        variants.extend(generate_name_question_variants(subject))
    elif question_type == "email":
        variants.extend(generate_email_question_variants())
    elif question_type == "phone":
        variants.extend(generate_phone_question_variants())
    elif question_type == "postcode":
        variants.extend(generate_postcode_question_variants())
    elif question_type == "dob":
        variants.extend(generate_dob_question_variants())
    elif question_type == "address":
        variants.extend(generate_address_question_variants())
    elif question_type == "yes_no":
        variants.extend(generate_yes_no_question_variants(subject))
    else:
        variants.extend(generate_generic_question_variants(subject))

    # Remove duplicates while preserving order
    seen = set()
    unique_variants = []
    for variant in variants:
        if variant.lower() not in seen:
            seen.add(variant.lower())
            unique_variants.append(variant)

    return unique_variants


def extract_subject_from_question(question: str) -> str:
    """Extract the main subject being asked about"""
    question_lower = question.lower()

    # Try to find "your X"
    your_match = re.search(r'your\s+([\w\s]+?)(?:\?|$|,|\.)', question_lower)
    if your_match:
        return your_match.group(1).strip()

    # Try to find "the X"
    the_match = re.search(r'the\s+([\w\s]+?)(?:\?|$|,|\.)', question_lower)
    if the_match:
        return the_match.group(1).strip()

    return "answer"


def generate_name_question_variants(subject: str = "first name") -> List[str]:
    """Generate variants for name questions"""
    variants = [
        f"What is your {subject}?",
        f"Could you tell me your {subject}?",
        f"Please provide your {subject}.",
        f"I need your {subject}.",
        f"May I have your {subject}?",
        f"Can you give me your {subject}?",
        f"What should I call you?",
        f"Please state your {subject}.",
        f"Could you please tell me your {subject}?",
        f"I'd like to know your {subject}.",
        f"What name do you go by?",
        f"How do you spell your {subject}?",
        f"Can you spell your {subject} for me?",
        f"Please spell your {subject}.",
    ]

    # Add variants for different name types
    if "first" in subject or "given" in subject or "forename" in subject:
        variants.extend([
            "What's your given name?",
            "What's your first name?",
            "What's your forename?",
            "Could you tell me your given name?",
            "May I have your first name please?",
        ])
    elif "last" in subject or "surname" in subject or "family" in subject:
        variants.extend([
            "What's your surname?",
            "What's your last name?",
            "What's your family name?",
            "Could you tell me your surname?",
            "May I have your last name please?",
        ])

    return variants


def generate_email_question_variants() -> List[str]:
    """Generate variants for email questions"""
    return [
        "What is your email address?",
        "Could you provide your email?",
        "What's your email?",
        "Please provide your email address.",
        "I need your email address.",
        "May I have your email?",
        "Can you give me your email address?",
        "What email address should I use?",
        "Please tell me your email.",
        "Could you spell out your email address?",
        "What's the best email to reach you?",
        "Which email address should we use?",
        "Please share your email with me.",
        "Can you provide an email address?",
    ]


def generate_phone_question_variants() -> List[str]:
    """Generate variants for phone number questions"""
    return [
        "What is your phone number?",
        "Could you provide your phone number?",
        "What's your phone number?",
        "Please provide your telephone number.",
        "I need your contact number.",
        "May I have your phone number?",
        "Can you give me your telephone number?",
        "What number should I call you on?",
        "Please tell me your phone number.",
        "What's the best number to reach you?",
        "Which phone number should we use?",
        "Can you share your mobile number?",
        "What's your mobile number?",
        "Please provide a contact number.",
    ]


def generate_postcode_question_variants() -> List[str]:
    """Generate variants for postcode questions"""
    return [
        "What is your postcode?",
        "Could you provide your postcode?",
        "What's your postcode?",
        "Please provide your postal code.",
        "I need your postcode.",
        "May I have your postcode?",
        "Can you give me your postcode?",
        "What postcode are you in?",
        "Please tell me your postcode.",
        "What's your postal code?",
        "Could you spell out your postcode?",
        "What area code are you in?",
        "Please share your postcode.",
        "What's your zip code?",
    ]


def generate_dob_question_variants() -> List[str]:
    """Generate variants for date of birth questions"""
    return [
        "What is your date of birth?",
        "When were you born?",
        "What's your date of birth?",
        "Please provide your date of birth.",
        "I need your date of birth.",
        "May I have your date of birth?",
        "Can you give me your date of birth?",
        "When is your birthday?",
        "What's your birthday?",
        "Could you tell me when you were born?",
        "Please tell me your date of birth.",
        "What date were you born?",
        "When did you come into the world?",
        "What's your birth date?",
    ]


def generate_address_question_variants() -> List[str]:
    """Generate variants for address questions"""
    return [
        "What is your address?",
        "Where do you live?",
        "What's your address?",
        "Please provide your address.",
        "I need your address.",
        "May I have your address?",
        "Can you give me your address?",
        "What's your home address?",
        "Please tell me your address.",
        "Where are you located?",
        "What's your residential address?",
        "Could you provide your postal address?",
        "Where do you reside?",
        "What address should we use?",
    ]


def generate_yes_no_question_variants(subject: str) -> List[str]:
    """Generate variants for yes/no questions"""
    return [
        f"Do you {subject}?",
        f"Have you {subject}?",
        f"Are you {subject}?",
        f"Is it {subject}?",
        f"Would you {subject}?",
        f"Can you confirm {subject}?",
        f"Could you confirm {subject}?",
        f"Is this {subject}?",
        f"Do you agree with {subject}?",
    ]


def generate_generic_question_variants(subject: str) -> List[str]:
    """Generate variants for generic questions"""
    return [
        f"What is your {subject}?",
        f"Could you provide your {subject}?",
        f"What's your {subject}?",
        f"Please provide your {subject}.",
        f"I need your {subject}.",
        f"May I have your {subject}?",
        f"Can you give me your {subject}?",
        f"Please tell me your {subject}.",
        f"Could you tell me your {subject}?",
        f"What {subject} should I use?",
    ]


def auto_detect_question_type(question: str) -> str:
    """
    Automatically detect question type from the question text

    Returns:
        Question type: name, email, phone, postcode, dob, address, yes_no, or generic
    """
    question_lower = question.lower()

    # Name questions
    if any(word in question_lower for word in ["first name", "given name", "forename", "christian name", "name", "called", "surname", "last name", "family name"]):
        return "name"

    # Email questions
    if any(word in question_lower for word in ["email", "e-mail", "mail address"]):
        return "email"

    # Phone questions
    if any(word in question_lower for word in ["phone", "telephone", "mobile", "contact number"]):
        return "phone"

    # Postcode questions
    if any(word in question_lower for word in ["postcode", "postal code", "zip", "zip code"]):
        return "postcode"

    # Date of birth questions
    if any(word in question_lower for word in ["date of birth", "birthday", "born", "dob", "birth date"]):
        return "dob"

    # Address questions
    if any(word in question_lower for word in ["address", "street", "where do you live", "residence"]):
        return "address"

    # Yes/No questions
    if any(word in question_lower for word in ["do you", "have you", "are you", "is it"]):
        return "yes_no"

    return "generic"


def generate_all_tts_variants(base_question: str) -> List[str]:
    """
    Main entry point: Generate all TTS variants automatically

    Args:
        base_question: Original question

    Returns:
        List of all generated variants (15-20 variations)
    """
    # Auto-detect question type
    question_type = auto_detect_question_type(base_question)

    # Generate variants
    variants = generate_tts_variants(base_question, question_type)

    return variants[:20]  # Limit to 20 variants max
