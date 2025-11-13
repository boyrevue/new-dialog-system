"""
Batch TTS Variant Generator
Generates TTS variants for all questions in the insurance dialog
"""

import os
import sys
from pathlib import Path
from tts_variant_generator import TTSVariantGenerator
from dialog_manager import DialogManager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Insurance questions list
INSURANCE_QUESTIONS = [
    # Driver Questions
    {"question_id": "q_first_name", "question_text": "What is your first name?", "slot_name": "firstName"},
    {"question_id": "q_last_name", "question_text": "What is your last name?", "slot_name": "lastName"},
    {"question_id": "q_date_of_birth", "question_text": "What is your date of birth?", "slot_name": "dateOfBirth"},
    {"question_id": "q_email", "question_text": "What is your email address?", "slot_name": "email"},
    {"question_id": "q_phone", "question_text": "What is your phone number?", "slot_name": "phone"},
    {"question_id": "q_address", "question_text": "What is your home address?", "slot_name": "address"},
    {"question_id": "q_postcode", "question_text": "What is your postcode?", "slot_name": "postcode"},
    {"question_id": "q_licence_type", "question_text": "What type of driving licence do you have?", "slot_name": "licenceType"},
    {"question_id": "q_licence_number", "question_text": "What is your driving licence number?", "slot_name": "licenceNumber"},
    {"question_id": "q_years_held", "question_text": "How many years have you held your licence?", "slot_name": "yearsHeld"},

    # Vehicle Questions
    {"question_id": "q_vehicle_reg", "question_text": "What is your vehicle registration number?", "slot_name": "vehicleRegistration"},
    {"question_id": "q_car_make", "question_text": "What is the make of your vehicle?", "slot_name": "carMake"},
    {"question_id": "q_car_model", "question_text": "What is the model of your vehicle?", "slot_name": "carModel"},
    {"question_id": "q_car_year", "question_text": "What year was your vehicle manufactured?", "slot_name": "carYear"},
    {"question_id": "q_mileage", "question_text": "What is the current mileage of your vehicle?", "slot_name": "mileage"},
    {"question_id": "q_vehicle_value", "question_text": "What is the estimated value of your vehicle?", "slot_name": "vehicleValue"},
    {"question_id": "q_overnight_location", "question_text": "Where is your vehicle kept overnight?", "slot_name": "overnightLocation"},
    {"question_id": "q_has_modifications", "question_text": "Does your vehicle have any modifications?", "slot_name": "hasModifications"},

    # Policy Questions
    {"question_id": "q_cover_type", "question_text": "What type of cover do you require?", "slot_name": "coverType"},
    {"question_id": "q_start_date", "question_text": "When would you like the policy to start?", "slot_name": "startDate"},
    {"question_id": "q_voluntary_excess", "question_text": "What voluntary excess would you like?", "slot_name": "voluntaryExcess"},
    {"question_id": "q_ncd_years", "question_text": "How many years of no claims discount do you have?", "slot_name": "ncdYears"},
    {"question_id": "q_protect_ncd", "question_text": "Would you like to protect your no claims discount?", "slot_name": "protectNCD"},

    # Claims Questions
    {"question_id": "q_has_claims", "question_text": "Have you made any insurance claims in the last 5 years?", "slot_name": "hasClaims"},
    {"question_id": "q_has_convictions", "question_text": "Do you have any motoring convictions?", "slot_name": "hasConvictions"},

    # Payment Questions
    {"question_id": "q_payment_frequency", "question_text": "How would you like to pay?", "slot_name": "paymentFrequency"},
    {"question_id": "q_payment_method", "question_text": "What payment method would you like to use?", "slot_name": "paymentMethod"},

    # Extras Questions
    {"question_id": "q_breakdown_cover", "question_text": "Would you like breakdown cover?", "slot_name": "breakdownCover"},
    {"question_id": "q_legal_expenses", "question_text": "Would you like legal expenses cover?", "slot_name": "legalExpenses"},
    {"question_id": "q_courtesy_car", "question_text": "Would you like courtesy car cover?", "slot_name": "courtesyCar"},

    # Marketing Questions
    {"question_id": "q_email_marketing", "question_text": "May we contact you by email with offers?", "slot_name": "emailMarketing"},
    {"question_id": "q_sms_marketing", "question_text": "May we contact you by SMS with offers?", "slot_name": "smsMarketing"},
    {"question_id": "q_post_marketing", "question_text": "May we contact you by post with offers?", "slot_name": "postMarketing"},
]


def generate_all_variants():
    """Generate TTS variants for all insurance questions."""
    generator = TTSVariantGenerator()

    results = {}
    total = len(INSURANCE_QUESTIONS)

    logger.info(f"Generating TTS variants for {total} questions...")

    for idx, question in enumerate(INSURANCE_QUESTIONS, 1):
        question_id = question['question_id']
        logger.info(f"[{idx}/{total}] Generating variants for {question_id}...")

        try:
            variants = generator.generate_for_question(question)
            results[question_id] = variants

            logger.info(f"  ✓ Generated {len(variants)} variants")
            logger.info(f"    Variant 1: {variants['variant1']}")
            logger.info(f"    Variant 2: {variants['variant2']}")
            logger.info(f"    Variant 3: {variants['variant3']}")
            logger.info(f"    Variant 4: {variants['variant4']}")

        except Exception as e:
            logger.error(f"  ✗ Failed to generate variants for {question_id}: {e}")
            results[question_id] = None

    # Print summary
    logger.info("\n" + "="*80)
    logger.info("GENERATION SUMMARY")
    logger.info("="*80)

    successful = sum(1 for v in results.values() if v is not None)
    failed = total - successful

    logger.info(f"Total questions: {total}")
    logger.info(f"Successful: {successful}")
    logger.info(f"Failed: {failed}")

    if failed > 0:
        logger.warning("\nFailed questions:")
        for qid, result in results.items():
            if result is None:
                logger.warning(f"  - {qid}")

    return results


def generate_ttl_output(results):
    """Generate TTL triples for the variants."""
    logger.info("\n" + "="*80)
    logger.info("TTL OUTPUT")
    logger.info("="*80)
    logger.info("\n# TTS Prompt Variants")
    logger.info("# Copy these into dialog-insurance-questions.ttl\n")

    for question_id, variants in results.items():
        if variants is None:
            continue

        # Extract base name from question_id (e.g., q_first_name -> FirstName)
        base_name = ''.join(word.capitalize() for word in question_id.replace('q_', '').split('_'))

        print(f""":{base_name}TTS a mm:TTSPrompt ;
    mm:ttsText "{variants['text']}" ;
    mm:ttsVariant1 "{variants['variant1']}" ;
    mm:ttsVariant2 "{variants['variant2']}" ;
    mm:ttsVariant3 "{variants['variant3']}" ;
    mm:ttsVariant4 "{variants['variant4']}" ;
    mm:ttsVoice "en-GB-Neural2-A" ;
    mm:ttsRate 1.0 ;
    mm:ttsPitch 1.0 .
""")


if __name__ == "__main__":
    logger.info("Starting batch TTS variant generation...")
    logger.info("="*80)

    # Check for OpenAI API key
    if not os.getenv('OPENAI_API_KEY'):
        logger.error("ERROR: OPENAI_API_KEY environment variable not set!")
        logger.error("Please set it before running this script:")
        logger.error("  export OPENAI_API_KEY='your-key-here'")
        sys.exit(1)

    results = generate_all_variants()

    # Generate TTL output
    generate_ttl_output(results)

    logger.info("\n" + "="*80)
    logger.info("Batch generation complete!")
    logger.info("="*80)
