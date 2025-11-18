"""
OCR Validation and Correction Utilities
Provides validation and correction suggestions for common OCR errors
"""

from typing import Dict, List, Optional, Tuple
import re
from difflib import get_close_matches


class OCRValidator:
    """
    Validates OCR results and suggests corrections for common errors.
    """

    # Common OCR character substitution errors
    OCR_SUBSTITUTIONS = {
        'O': ['0', 'Q', 'D'],
        '0': ['O', 'Q', 'D'],
        'I': ['1', 'l', '|', 'L'],
        '1': ['I', 'l', '|', 'L'],
        'l': ['1', 'I', '|', 'L'],
        'S': ['5', '8', 'B'],
        '5': ['S', '8'],
        '8': ['B', 'S', '5'],
        'B': ['8', 'S', '3'],
        'G': ['6', 'C'],
        '6': ['G', 'b'],
        'Z': ['2', '7'],
        '2': ['Z'],
        'T': ['7', '1'],
        'E': ['F', '3'],
        'A': ['4'],
        'q': ['g', '9'],
    }

    # Common vehicle makes (for auto-correction)
    VEHICLE_MAKES = [
        'TESLA', 'BMW', 'MERCEDES', 'AUDI', 'VOLKSWAGEN', 'FORD', 'TOYOTA',
        'HONDA', 'NISSAN', 'MAZDA', 'HYUNDAI', 'KIA', 'VOLVO', 'JAGUAR',
        'LAND ROVER', 'RANGE ROVER', 'PORSCHE', 'FERRARI', 'LAMBORGHINI',
        'BENTLEY', 'ROLLS ROYCE', 'ASTON MARTIN', 'MCLAREN', 'LOTUS',
        'MINI', 'CITROEN', 'PEUGEOT', 'RENAULT', 'FIAT', 'ALFA ROMEO',
        'SEAT', 'SKODA', 'VAUXHALL', 'CHEVROLET', 'CHRYSLER', 'DODGE',
        'JEEP', 'LEXUS', 'INFINITI', 'ACURA', 'GENESIS', 'SUBARU',
        'MITSUBISHI', 'SUZUKI', 'ISUZU', 'DACIA', 'MG', 'SSANGYONG'
    ]

    # Common UK fuel types
    FUEL_TYPES = [
        'PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUG-IN HYBRID',
        'HYBRID ELECTRIC', 'PETROL/ELECTRIC', 'DIESEL/ELECTRIC',
        'GAS', 'LPG', 'HYDROGEN', 'ELECTRICITY'
    ]

    # Common UK body types
    BODY_TYPES = [
        'SALOON', 'HATCHBACK', 'ESTATE', 'COUPE', 'CONVERTIBLE',
        'SUV', 'MPV', 'VAN', 'PICKUP', '4X4', 'SPORTS',
        '2-AXLE RIGID BODY', '3-AXLE RIGID BODY', 'RIGID BODY'
    ]

    def __init__(self):
        self.field_validators = {
            'make': self._validate_make,
            'fuel_type': self._validate_fuel_type,
            'body_type': self._validate_body_type,
            'registration_number': self._validate_registration,
            'model': self._validate_model,
        }

    def validate_field(self, field_name: str, value: str, confidence: float = 1.0) -> Dict:
        """
        Validate a single field and return corrections if needed.

        Args:
            field_name: Name of the field
            value: Extracted value
            confidence: OCR confidence score (0-1)

        Returns:
            Dictionary with validation results:
            {
                'is_valid': bool,
                'confidence': float,
                'suggestions': List[str],
                'correction': Optional[str],
                'warning': Optional[str]
            }
        """
        result = {
            'is_valid': True,
            'confidence': confidence,
            'suggestions': [],
            'correction': None,
            'warning': None
        }

        if not value or not value.strip():
            result['is_valid'] = False
            result['warning'] = 'Field is empty'
            return result

        # Run field-specific validator if available
        validator = self.field_validators.get(field_name)
        if validator:
            validation = validator(value, confidence)
            result.update(validation)

        return result

    def _validate_make(self, value: str, confidence: float) -> Dict:
        """Validate vehicle make."""
        value_upper = value.upper().strip()

        # Check for exact match
        if value_upper in self.VEHICLE_MAKES:
            return {
                'is_valid': True,
                'confidence': confidence,
                'suggestions': [],
                'correction': None
            }

        # Find close matches
        matches = get_close_matches(value_upper, self.VEHICLE_MAKES, n=3, cutoff=0.6)

        result = {
            'is_valid': len(matches) == 0,  # Invalid if we have suggestions
            'confidence': confidence if len(matches) == 0 else confidence * 0.7,
            'suggestions': matches,
            'correction': matches[0] if matches else None,
            'warning': f'"{value}" may be incorrect. Did you mean {matches[0]}?' if matches else None
        }

        # Special case: Common OCR errors
        ocr_corrections = {
            'TEBLA': 'TESLA',
            'TESLO': 'TESLA',
            'TESL4': 'TESLA',
            'T3SLA': 'TESLA',
            'BMW': 'BMW',
            'BNW': 'BMW',
            'B MW': 'BMW',
            'AIJD1': 'AUDI',
            'AUD1': 'AUDI',
            'FORD': 'FORD',
            'F0RD': 'FORD',
        }

        if value_upper in ocr_corrections:
            result['correction'] = ocr_corrections[value_upper]
            result['is_valid'] = False
            result['warning'] = f'OCR likely misread "{value}" as "{ocr_corrections[value_upper]}"'
            result['suggestions'] = [ocr_corrections[value_upper]]

        return result

    def _validate_fuel_type(self, value: str, confidence: float) -> Dict:
        """Validate fuel type."""
        value_upper = value.upper().strip()

        if value_upper in self.FUEL_TYPES:
            return {
                'is_valid': True,
                'confidence': confidence,
                'suggestions': [],
                'correction': None
            }

        matches = get_close_matches(value_upper, self.FUEL_TYPES, n=3, cutoff=0.6)

        # Common OCR errors for fuel types
        ocr_corrections = {
            'ELECTR1CITY': 'ELECTRICITY',
            'ELECTR!CITY': 'ELECTRICITY',
            'ELECTRIC1TY': 'ELECTRICITY',
            'PETR0L': 'PETROL',
            'DIESE1': 'DIESEL',
            'D1ESEL': 'DIESEL',
        }

        if value_upper in ocr_corrections:
            matches = [ocr_corrections[value_upper]]

        return {
            'is_valid': len(matches) == 0,
            'confidence': confidence if len(matches) == 0 else confidence * 0.8,
            'suggestions': matches,
            'correction': matches[0] if matches else None,
            'warning': f'"{value}" may be incorrect. Suggested: {matches[0]}' if matches else None
        }

    def _validate_body_type(self, value: str, confidence: float) -> Dict:
        """Validate body type."""
        value_upper = value.upper().strip()

        if value_upper in self.BODY_TYPES:
            return {
                'is_valid': True,
                'confidence': confidence,
                'suggestions': [],
                'correction': None
            }

        matches = get_close_matches(value_upper, self.BODY_TYPES, n=3, cutoff=0.6)

        return {
            'is_valid': len(matches) == 0,
            'confidence': confidence if len(matches) == 0 else confidence * 0.8,
            'suggestions': matches,
            'correction': matches[0] if matches else None,
            'warning': f'"{value}" may be incorrect. Suggested: {matches[0]}' if matches else None
        }

    def _validate_registration(self, value: str, confidence: float) -> Dict:
        """Validate UK registration number format."""
        # UK registration formats:
        # Current: AA## AAA (e.g., AB12 CDE)
        # Old style: A### AAA or AAA ###A

        value_clean = value.upper().strip().replace(' ', '')

        # Current format: 2 letters, 2 digits, 3 letters
        current_format = re.match(r'^[A-Z]{2}\d{2}[A-Z]{3}$', value_clean)

        # Old format patterns
        old_format_1 = re.match(r'^[A-Z]\d{3}[A-Z]{3}$', value_clean)  # A123 ABC
        old_format_2 = re.match(r'^[A-Z]{3}\d{3}[A-Z]$', value_clean)  # ABC 123A

        is_valid = bool(current_format or old_format_1 or old_format_2)

        result = {
            'is_valid': is_valid,
            'confidence': confidence if is_valid else confidence * 0.6,
            'suggestions': [],
            'correction': None,
            'warning': None
        }

        if not is_valid:
            result['warning'] = f'"{value}" does not match UK registration format'

            # Try to suggest corrections for common OCR errors
            # Replace common misreads
            corrected = value_clean
            for char, replacements in self.OCR_SUBSTITUTIONS.items():
                for replacement in replacements:
                    test_value = corrected.replace(replacement, char)
                    if re.match(r'^[A-Z]{2}\d{2}[A-Z]{3}$', test_value):
                        result['suggestions'].append(test_value)

        return result

    def _validate_model(self, value: str, confidence: float) -> Dict:
        """Validate vehicle model (basic check)."""
        # Model names are highly variable, just check it's not empty
        # and doesn't contain obvious OCR errors

        value_clean = value.strip()

        # Check for excessive special characters or numbers that look wrong
        suspicious_chars = re.findall(r'[|\\/<>{}[\]~`]', value_clean)

        return {
            'is_valid': len(suspicious_chars) == 0,
            'confidence': confidence if len(suspicious_chars) == 0 else confidence * 0.7,
            'suggestions': [],
            'correction': None,
            'warning': f'Model name contains suspicious characters: {suspicious_chars}' if suspicious_chars else None
        }

    def validate_document(self, extracted_fields: Dict[str, str], confidences: Dict[str, float] = None) -> Dict:
        """
        Validate all fields in a document.

        Args:
            extracted_fields: Dictionary of field_name -> value
            confidences: Optional dictionary of field_name -> confidence

        Returns:
            Dictionary with validation results for each field
        """
        if confidences is None:
            confidences = {}

        results = {}
        for field_name, value in extracted_fields.items():
            confidence = confidences.get(field_name, 0.5)
            results[field_name] = self.validate_field(field_name, value, confidence)

        return results


# Singleton instance
_validator = None

def get_validator() -> OCRValidator:
    """Get or create the OCR validator instance."""
    global _validator
    if _validator is None:
        _validator = OCRValidator()
    return _validator
