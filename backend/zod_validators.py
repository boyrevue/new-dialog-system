"""
Zod-Powered Validation Rules for Dialog System
Validates OCR-extracted and user-entered data against TTL ontology definitions
"""

from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
import re
from datetime import datetime
from dialog_manager import DialogManager
import logging

logger = logging.getLogger(__name__)


class ValidationResult:
    """Result of a validation check"""

    def __init__(self, success: bool, value: Any = None, error: Optional[str] = None,
                 matched_option: Optional[Dict] = None):
        self.success = success
        self.value = value
        self.error = error
        self.matched_option = matched_option  # For select options, store the matched option details

    def __bool__(self):
        return self.success

    def __repr__(self):
        if self.success:
            return f"ValidationResult(success=True, value={self.value})"
        return f"ValidationResult(success=False, error={self.error})"


class ZodValidators:
    """
    Zod-powered validation library for 2025.
    TypeScript-first philosophy with automatic type inference.
    Perfect for both frontend and backend validation.
    """

    def __init__(self, dialog_manager: DialogManager):
        """
        Initialize validators with dialog manager to access TTL ontology.

        Args:
            dialog_manager: DialogManager instance with loaded TTL ontologies
        """
        self.dialog_manager = dialog_manager
        self._option_cache: Dict[str, List[Dict]] = {}  # Cache select options by question_id

    # ==================== Basic Type Validators ====================

    @staticmethod
    def is_digit(value: str) -> ValidationResult:
        """Validate that value contains only digits"""
        if isinstance(value, str) and value.isdigit():
            return ValidationResult(success=True, value=value)
        return ValidationResult(success=False, error="Value must contain only digits")

    @staticmethod
    def is_integer(value: Any) -> ValidationResult:
        """Validate that value is an integer"""
        try:
            int_val = int(value)
            return ValidationResult(success=True, value=int_val)
        except (ValueError, TypeError):
            return ValidationResult(success=False, error="Value must be an integer")

    @staticmethod
    def is_number(value: Any) -> ValidationResult:
        """Validate that value is a number (int or float)"""
        try:
            num_val = float(value)
            return ValidationResult(success=True, value=num_val)
        except (ValueError, TypeError):
            return ValidationResult(success=False, error="Value must be a number")

    @staticmethod
    def is_float(value: Any) -> ValidationResult:
        """Validate that value is a float"""
        try:
            float_val = float(value)
            return ValidationResult(success=True, value=float_val)
        except (ValueError, TypeError):
            return ValidationResult(success=False, error="Value must be a float")

    # ==================== Date/Time Validators ====================

    @staticmethod
    def is_date(value: str, format: str = "%Y-%m-%d") -> ValidationResult:
        """Validate that value is a valid date"""
        try:
            date_obj = datetime.strptime(value, format)
            return ValidationResult(success=True, value=date_obj)
        except ValueError:
            return ValidationResult(success=False, error=f"Invalid date format. Expected {format}")

    @staticmethod
    def is_past_date(value: str, format: str = "%Y-%m-%d") -> ValidationResult:
        """Validate that value is a date in the past"""
        date_result = ZodValidators.is_date(value, format)
        if not date_result:
            return date_result

        if date_result.value <= datetime.now():
            return ValidationResult(success=True, value=date_result.value)
        return ValidationResult(success=False, error="Date must be in the past")

    @staticmethod
    def is_future_date(value: str, format: str = "%Y-%m-%d") -> ValidationResult:
        """Validate that value is a date in the future"""
        date_result = ZodValidators.is_date(value, format)
        if not date_result:
            return date_result

        if date_result.value >= datetime.now():
            return ValidationResult(success=True, value=date_result.value)
        return ValidationResult(success=False, error="Date must be in the future")

    @staticmethod
    def is_month(value: Any) -> ValidationResult:
        """Validate that value is a valid month (1-12)"""
        try:
            month = int(value)
            if 1 <= month <= 12:
                return ValidationResult(success=True, value=month)
            return ValidationResult(success=False, error="Month must be between 1 and 12")
        except (ValueError, TypeError):
            return ValidationResult(success=False, error="Month must be an integer")

    @staticmethod
    def is_leap_year(year: int) -> bool:
        """Check if year is a leap year"""
        return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

    @staticmethod
    def is_day_of_month(value: Any, month: int, year: int) -> ValidationResult:
        """Validate that value is a valid day for the given month/year"""
        try:
            day = int(value)

            # Days in each month
            days_in_month = [31, 29 if ZodValidators.is_leap_year(year) else 28, 31, 30, 31, 30,
                           31, 31, 30, 31, 30, 31]

            if 1 <= day <= days_in_month[month - 1]:
                return ValidationResult(success=True, value=day)
            return ValidationResult(success=False, error=f"Day must be between 1 and {days_in_month[month - 1]} for month {month}")
        except (ValueError, TypeError, IndexError):
            return ValidationResult(success=False, error="Invalid day value")

    # ==================== UK-Specific Validators ====================

    @staticmethod
    def is_postcode(value: str) -> ValidationResult:
        """Validate UK postcode format"""
        # UK postcode pattern: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA, AA99 9AA
        pattern = r'^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$'

        value = value.strip().upper()
        if re.match(pattern, value):
            return ValidationResult(success=True, value=value)
        return ValidationResult(success=False, error="Invalid UK postcode format")

    @staticmethod
    def is_email(value: str) -> ValidationResult:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

        value = value.strip()
        if re.match(pattern, value):
            return ValidationResult(success=True, value=value.lower())
        return ValidationResult(success=False, error="Invalid email format")

    @staticmethod
    def is_phone(value: str) -> ValidationResult:
        """Validate UK phone number"""
        # Remove spaces, hyphens, and parentheses
        cleaned = re.sub(r'[\s\-\(\)]', '', value)

        # UK phone number patterns
        patterns = [
            r'^(\+44|0044|0)\d{10}$',  # Standard UK format
            r'^07\d{9}$',  # Mobile
            r'^01\d{9}$',  # Landline
            r'^02\d{9}$',  # London/Cardiff/other cities
        ]

        for pattern in patterns:
            if re.match(pattern, cleaned):
                return ValidationResult(success=True, value=cleaned)

        return ValidationResult(success=False, error="Invalid UK phone number")

    @staticmethod
    def is_uk_postcode(value: str) -> ValidationResult:
        """Alias for is_postcode"""
        return ZodValidators.is_postcode(value)

    @staticmethod
    def is_uk_driving_licence(value: str) -> ValidationResult:
        """Validate UK driving licence number format: SSSSS-DDMMYY-IN-XXX"""
        # Remove spaces and hyphens
        cleaned = value.replace(' ', '').replace('-', '').upper()

        # UK licence pattern: 5 letters + 6 digits (DDMMYY) + 2 letters + 3 digits
        pattern = r'^[A-Z]{5}\d{6}[A-Z]{2}\d{3}$'

        if re.match(pattern, cleaned):
            # Format as SSSSS-DDMMYY-IN-XXX
            formatted = f"{cleaned[:5]}-{cleaned[5:11]}-{cleaned[11:13]}-{cleaned[13:16]}"
            return ValidationResult(success=True, value=formatted)
        return ValidationResult(success=False, error="Invalid UK driving licence format")

    @staticmethod
    def is_uk_driving_licence_category(value: str) -> ValidationResult:
        """Validate UK driving licence category (A, A1, A2, AM, B, B1, BE, C, C1, CE, C1E, D, D1, DE, D1E)"""
        valid_categories = ['AM', 'A1', 'A2', 'A', 'B1', 'BE', 'B', 'C1E', 'C1', 'CE', 'C', 'D1E', 'D1', 'DE', 'D']

        value = value.strip().upper()
        if value in valid_categories:
            return ValidationResult(success=True, value=value)
        return ValidationResult(success=False, error=f"Invalid UK driving licence category. Valid: {', '.join(valid_categories)}")

    @staticmethod
    def is_uk_driving_offence_code(value: str) -> ValidationResult:
        """Validate UK driving offence code format (e.g., SP30, DR10, CD40)"""
        # UK offence codes: 2 letters + 2-3 digits
        pattern = r'^[A-Z]{2}\d{2,3}$'

        value = value.strip().upper()
        if re.match(pattern, value):
            return ValidationResult(success=True, value=value)
        return ValidationResult(success=False, error="Invalid UK driving offence code format")

    @staticmethod
    def is_uk_car_registration(value: str) -> ValidationResult:
        """
        Validate UK vehicle registration number.
        Formats: AB12 CDE (current), A123 BCD (prefix), ABC 123D (suffix)
        """
        # Remove spaces
        cleaned = value.replace(' ', '').upper()

        patterns = [
            r'^[A-Z]{2}\d{2}[A-Z]{3}$',  # Current format (2001+): AB12 CDE
            r'^[A-Z]\d{1,3}[A-Z]{3}$',    # Prefix format (1983-2001): A123 BCD
            r'^[A-Z]{3}\d{1,3}[A-Z]$',    # Suffix format (1963-1983): ABC 123D
            r'^[A-Z]{1,3}\d{1,4}$',       # Dateless format (pre-1963): ABC 1234
        ]

        for pattern in patterns:
            if re.match(pattern, cleaned):
                # Format as XX## XXX for current format
                if re.match(r'^[A-Z]{2}\d{2}[A-Z]{3}$', cleaned):
                    formatted = f"{cleaned[:4]} {cleaned[4:]}"
                else:
                    formatted = cleaned
                return ValidationResult(success=True, value=formatted)

        return ValidationResult(success=False, error="Invalid UK vehicle registration format")

    # ==================== Select Option Validator (TTL-Based) ====================

    def get_select_options(self, question_id: str) -> List[Dict]:
        """
        Retrieve all valid select options for a question from TTL ontology.

        Args:
            question_id: Question identifier (e.g., 'q_vehicle_fuel_type')

        Returns:
            List of option dictionaries with value, label, aliases, and phonetics
        """
        # Check cache first
        if question_id in self._option_cache:
            return self._option_cache[question_id]

        # Query TTL ontology for options
        query_result = self.dialog_manager.get_question_by_id(question_id)

        if not query_result or 'select_options' not in query_result:
            logger.warning(f"No select options found for question: {question_id}")
            return []

        options = query_result['select_options']

        # Cache the options
        self._option_cache[question_id] = options

        logger.info(f"Loaded {len(options)} select options for question {question_id}")
        return options

    @staticmethod
    def _phonetic_distance(str1: str, str2: str) -> int:
        """
        Calculate phonetic distance between two strings using Levenshtein distance.
        Used for fuzzy phonetic matching of spoken TTS output.

        Args:
            str1: First string
            str2: Second string

        Returns:
            Edit distance between the two strings
        """
        # Simple Levenshtein distance implementation
        if len(str1) < len(str2):
            return ZodValidators._phonetic_distance(str2, str1)

        if len(str2) == 0:
            return len(str1)

        previous_row = range(len(str2) + 1)
        for i, c1 in enumerate(str1):
            current_row = [i + 1]
            for j, c2 in enumerate(str2):
                # Cost of insertions, deletions, or substitutions
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    @staticmethod
    def _normalize_phonetic(text: str) -> str:
        """
        Normalize text for phonetic comparison.
        Removes hyphens, spaces, punctuation, and converts to lowercase.

        Args:
            text: Text to normalize

        Returns:
            Normalized phonetic string
        """
        # Remove common phonetic separators and punctuation
        normalized = text.lower()
        normalized = normalized.replace('-', '').replace(' ', '').replace('_', '')
        normalized = re.sub(r'[^\w]', '', normalized)
        return normalized

    def is_select_option(self, value: str, question_id: str,
                        fuzzy_match: bool = True,
                        phonetic_threshold: int = 2) -> ValidationResult:
        """
        Validate that value matches one of the valid select options from TTL ontology.
        Supports exact matching, alias matching, semantic alternatives, and fuzzy phonetic matching.

        Args:
            value: The value to validate (e.g., "ELECTRICITY", "elect", "diesel", "benzine")
            question_id: Question identifier to get valid options from
            fuzzy_match: Enable fuzzy matching via aliases, phonetics, and semantic alternatives
            phonetic_threshold: Maximum edit distance for phonetic fuzzy matching (default: 2)

        Returns:
            ValidationResult with matched option details

        Example:
            >>> # Exact match
            >>> validator.is_select_option("electric", "q_vehicle_fuel_type")
            ValidationResult(success=True, value="electric")

            >>> # Alias match (from ontology)
            >>> validator.is_select_option("ELECTRICITY", "q_vehicle_fuel_type")
            ValidationResult(success=True, value="electric", matched_via="alias")

            >>> # Semantic alternative match (e.g., "Benzine" → "Petrol")
            >>> validator.is_select_option("benzine", "q_vehicle_fuel_type")
            ValidationResult(success=True, value="petrol", matched_via="alias")

            >>> # Phonetic match from TTS output
            >>> validator.is_select_option("ee-lek-trik", "q_vehicle_fuel_type")
            ValidationResult(success=True, value="electric", matched_via="phonetic")

            >>> # Fuzzy phonetic match with small typo
            >>> validator.is_select_option("electrik", "q_vehicle_fuel_type")
            ValidationResult(success=True, value="electric", matched_via="fuzzy_phonetic")
        """
        options = self.get_select_options(question_id)

        if not options:
            return ValidationResult(success=False,
                                  error=f"No valid options defined for question {question_id}")

        value_normalized = value.strip().lower()

        # Phase 1: Exact match (optionValue)
        for option in options:
            option_value = option.get('value', '').lower()
            if value_normalized == option_value:
                logger.info(f"✓ Exact match: '{value}' → '{option_value}'")
                return ValidationResult(success=True, value=option_value, matched_option=option)

        # Phase 2: Label match
        for option in options:
            option_label = option.get('label', '').lower()
            if value_normalized == option_label:
                logger.info(f"✓ Label match: '{value}' → '{option.get('value')}'")
                return ValidationResult(success=True, value=option.get('value'), matched_option=option)

        if fuzzy_match:
            # Phase 3: Alias match (includes semantic alternatives like "Benzine" → "Petrol")
            for option in options:
                aliases = option.get('aliases', [])
                for alias in aliases:
                    if value_normalized == alias.lower():
                        logger.info(f"✓ Alias/Semantic match: '{value}' → '{option.get('value')}' (via alias '{alias}')")
                        return ValidationResult(success=True, value=option.get('value'), matched_option=option)

            # Phase 4: Phonetic exact match (for TTS output like "ee-lek-trik")
            value_phonetic = self._normalize_phonetic(value_normalized)
            for option in options:
                phonetics = option.get('phonetics', [])
                for phonetic in phonetics:
                    phonetic_normalized = self._normalize_phonetic(phonetic)

                    if value_phonetic == phonetic_normalized:
                        logger.info(f"✓ Phonetic exact match: '{value}' → '{option.get('value')}' (via phonetic '{phonetic}')")
                        return ValidationResult(success=True, value=option.get('value'), matched_option=option)

            # Phase 5: Fuzzy phonetic match (for ASR errors like "electrik" → "electric")
            # Compare against all phonetic representations with Levenshtein distance
            best_match = None
            best_distance = float('inf')

            for option in options:
                # Check against option value
                option_phonetic = self._normalize_phonetic(option.get('value', ''))
                distance = self._phonetic_distance(value_phonetic, option_phonetic)

                if distance <= phonetic_threshold and distance < best_distance:
                    best_match = option
                    best_distance = distance

                # Check against option label
                label_phonetic = self._normalize_phonetic(option.get('label', ''))
                distance = self._phonetic_distance(value_phonetic, label_phonetic)

                if distance <= phonetic_threshold and distance < best_distance:
                    best_match = option
                    best_distance = distance

                # Check against phonetic spellings
                phonetics = option.get('phonetics', [])
                for phonetic in phonetics:
                    phonetic_normalized = self._normalize_phonetic(phonetic)
                    distance = self._phonetic_distance(value_phonetic, phonetic_normalized)

                    if distance <= phonetic_threshold and distance < best_distance:
                        best_match = option
                        best_distance = distance

                # Check against aliases (semantic alternatives)
                aliases = option.get('aliases', [])
                for alias in aliases:
                    alias_phonetic = self._normalize_phonetic(alias)
                    distance = self._phonetic_distance(value_phonetic, alias_phonetic)

                    if distance <= phonetic_threshold and distance < best_distance:
                        best_match = option
                        best_distance = distance

            if best_match:
                logger.info(f"✓ Fuzzy phonetic match: '{value}' → '{best_match.get('value')}' (distance={best_distance})")
                return ValidationResult(success=True, value=best_match.get('value'), matched_option=best_match)

            # Phase 6: Partial substring match (fallback)
            for option in options:
                option_value = option.get('value', '').lower()
                option_label = option.get('label', '').lower()

                # Check if value is a substring of option or vice versa
                if (value_normalized in option_value or option_value in value_normalized or
                    value_normalized in option_label or option_label in value_normalized):
                    logger.info(f"✓ Partial match: '{value}' → '{option.get('value')}'")
                    return ValidationResult(success=True, value=option.get('value'), matched_option=option)

        # No match found
        valid_options_str = ', '.join([opt.get('label', opt.get('value')) for opt in options])
        return ValidationResult(success=False,
                              error=f"Invalid option. Valid options: {valid_options_str}")

    def validate_select_with_ttl(self, value: str, question_id: str) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate select option and return tuple for backward compatibility.

        Returns:
            Tuple of (is_valid, normalized_value, matched_option)
        """
        result = self.is_select_option(value, question_id, fuzzy_match=True)

        if result.success:
            return (True, result.value, result.matched_option)
        else:
            return (False, None, None)


# ==================== Validation Predicates Library ====================

# Export all validators as module-level functions for easy import
is_digit = ZodValidators.is_digit
is_integer = ZodValidators.is_integer
is_number = ZodValidators.is_number
is_float = ZodValidators.is_float
is_date = ZodValidators.is_date
is_past_date = ZodValidators.is_past_date
is_future_date = ZodValidators.is_future_date
is_month = ZodValidators.is_month
is_day_of_month = ZodValidators.is_day_of_month
is_postcode = ZodValidators.is_postcode
is_email = ZodValidators.is_email
is_phone = ZodValidators.is_phone
is_uk_postcode = ZodValidators.is_uk_postcode
is_uk_driving_licence = ZodValidators.is_uk_driving_licence
is_uk_driving_licence_category = ZodValidators.is_uk_driving_licence_category
is_uk_driving_offence_code = ZodValidators.is_uk_driving_offence_code
is_uk_car_registration = ZodValidators.is_uk_car_registration


if __name__ == "__main__":
    # Example usage
    from pathlib import Path

    # Initialize dialog manager
    ontology_dir = Path(__file__).parent.parent / "ontologies"
    ontology_paths = [
        str(ontology_dir / "dialog-multimodal.ttl"),
        str(ontology_dir / "dialog-insurance-questions.ttl"),
    ]

    dm = DialogManager(ontology_paths)
    validators = ZodValidators(dm)

    print("=== Testing Select Option Validator ===")

    # Test fuel type validation
    test_cases = [
        ("ELECTRICITY", "q_vehicle_fuel_type"),
        ("elect", "q_vehicle_fuel_type"),
        ("diesel", "q_vehicle_fuel_type"),
        ("PETROL", "q_vehicle_fuel_type"),
        ("hybrid", "q_vehicle_fuel_type"),
        ("TSLA", "q_vehicle_make"),  # Tesla alias
        ("BMW", "q_vehicle_make"),
    ]

    for value, question_id in test_cases:
        result = validators.is_select_option(value, question_id)
        print(f"\nInput: '{value}' for {question_id}")
        print(f"Result: {result}")
        if result.success:
            print(f"Matched: {result.matched_option.get('label')} ({result.value})")

    print("\n=== Testing UK Validators ===")

    # Test UK car registration
    reg_tests = ["AB12CDE", "AB12 CDE", "A123BCD", "ABC123D"]
    for reg in reg_tests:
        result = is_uk_car_registration(reg)
        print(f"Registration '{reg}': {result}")

    # Test UK postcode
    postcode_tests = ["SW1A 1AA", "M1 1AE", "B33 8TH"]
    for pc in postcode_tests:
        result = is_postcode(pc)
        print(f"Postcode '{pc}': {result}")
