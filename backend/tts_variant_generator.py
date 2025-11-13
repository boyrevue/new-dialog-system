"""
TTS Variant Generator using OpenAI
Generates diverse phrasings for TTS prompts to improve user experience
"""

import os
import openai
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TTSVariantGenerator:
    """
    Generates TTS variants using OpenAI API.
    Produces 4 different phrasings of the same question for variety.
    """

    def __init__(self, api_key: str = None):
        """
        Initialize with OpenAI API key.
        If not provided, will try to read from OPENAI_API_KEY environment variable.
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            logger.warning("No OpenAI API key provided. TTS variant generation will not work.")
        else:
            openai.api_key = self.api_key

    def generate_variants(self, original_text: str, question_context: str = None) -> List[str]:
        """
        Generate 4 different phrasings of the same question.

        Args:
            original_text: The original question text
            question_context: Optional context about what the question is asking for

        Returns:
            List of 4 variant phrasings (including the original as variant 1)
        """
        if not self.api_key:
            logger.warning("Cannot generate variants without OpenAI API key")
            return self._generate_fallback_variants(original_text)

        try:
            prompt = self._build_prompt(original_text, question_context)

            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that rephrases questions for text-to-speech systems. "
                                   "You maintain the exact same meaning but vary the phrasing, tone, and structure. "
                                   "Keep responses professional, clear, and suitable for voice interaction."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.8,
                max_tokens=500
            )

            content = response.choices[0].message.content.strip()
            variants = self._parse_variants(content)

            # Ensure we have exactly 4 variants
            if len(variants) < 4:
                logger.warning(f"Only got {len(variants)} variants, padding with fallbacks")
                variants.extend(self._generate_fallback_variants(original_text)[len(variants):])

            return variants[:4]

        except Exception as e:
            logger.error(f"Error generating TTS variants with OpenAI: {e}")
            return self._generate_fallback_variants(original_text)

    def _build_prompt(self, original_text: str, context: str = None) -> str:
        """Build the prompt for OpenAI."""
        context_info = f"\nContext: {context}" if context else ""

        return f"""Rephrase the following question in 4 different ways for a text-to-speech dialog system.
Each variant should:
- Have the exact same meaning
- Use different sentence structures and word choices
- Be natural and conversational
- Be suitable for voice interaction
- Maintain a professional tone
{context_info}

Original question: "{original_text}"

Provide exactly 4 variants, numbered 1-4, one per line.
Format:
1. [First variant - original or very close]
2. [Second variant - different structure]
3. [Third variant - more casual/friendly]
4. [Fourth variant - most concise]"""

    def _parse_variants(self, content: str) -> List[str]:
        """Parse the variants from OpenAI response."""
        variants = []
        lines = content.strip().split('\n')

        for line in lines:
            line = line.strip()
            # Remove numbered prefix (1., 2., etc.)
            if line and line[0].isdigit() and '.' in line:
                variant = line.split('.', 1)[1].strip()
                # Remove quotes if present
                variant = variant.strip('"\'')
                if variant:
                    variants.append(variant)

        return variants

    def _generate_fallback_variants(self, original_text: str) -> List[str]:
        """
        Generate simple fallback variants when OpenAI is not available.
        These are basic transformations.
        """
        variants = [original_text]

        # Variant 2: Replace "What is" with "Could you tell me"
        variant2 = original_text.replace("What is", "Could you tell me")
        variant2 = variant2.replace("what is", "could you tell me")
        if not variant2.endswith("?"):
            variant2 = variant2.rstrip(".") + "?"
        variants.append(variant2)

        # Variant 3: Replace "What is" with "Please provide"
        variant3 = original_text.replace("What is", "Please provide")
        variant3 = variant3.replace("what is", "please provide")
        variant3 = variant3.replace("?", ".")
        variants.append(variant3)

        # Variant 4: Replace "What is" with "I need"
        variant4 = original_text.replace("What is", "I need")
        variant4 = variant4.replace("what is", "I need")
        variant4 = variant4.replace("?", ".")
        variants.append(variant4)

        return variants

    def generate_for_question(self, question_data: Dict) -> Dict[str, str]:
        """
        Generate variants for a question and return in TTL format.

        Args:
            question_data: Dict with 'question_text', 'question_id', 'slot_name'

        Returns:
            Dict with keys: text, variant1, variant2, variant3, variant4
        """
        question_text = question_data.get('question_text', '')
        slot_name = question_data.get('slot_name', '')

        context = f"Asking for: {slot_name}" if slot_name else None
        variants = self.generate_variants(question_text, context)

        return {
            'text': variants[0],
            'variant1': variants[0],
            'variant2': variants[1] if len(variants) > 1 else variants[0],
            'variant3': variants[2] if len(variants) > 2 else variants[0],
            'variant4': variants[3] if len(variants) > 3 else variants[0]
        }


# Example usage
if __name__ == "__main__":
    generator = TTSVariantGenerator()

    # Test with sample question
    test_question = {
        'question_text': 'What is your full name?',
        'question_id': 'q_name',
        'slot_name': 'customer_name'
    }

    print("Generating TTS variants for:", test_question['question_text'])
    variants = generator.generate_for_question(test_question)

    for key, value in variants.items():
        print(f"{key}: {value}")
