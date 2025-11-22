"""
Validation Functions for Dialog System
Zod-style validators for UK-specific and general data validation

Available Validators:
- Number: isDigit, isNumber, isInteger, isFloat
- Date/Time: isMonth, isDayOfMonth, isLeapYear
- String: isString, isAlphanumeric
- Contact: isEmail, isPhone
- UK-Specific: isUKPostcode, isUKDrivingLicence, isUKDrivingLicenceCategory,
               isUKDrivingOffenceCode, isUKCarRegistration
"""

import re
from typing import Any
from datetime import datetime
import calendar


# ============================================================================
# DATE/TIME VALIDATORS
# ============================================================================

def is_month(value: Any) -> bool:
    """Validates month number (1-12)"""
    try:
        month = int(value)
        return 1 <= month <= 12
    except (ValueError, TypeError):
        return False


def is_leap_year(value: Any) -> bool:
    """
    Validates if a year is a leap year
    Rules: Divisible by 4, except century years must be divisible by 400
    Examples: 2000, 2020, 2024 are leap years; 1900, 2100 are not
    """
    try:
        year = int(value)
        return (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
    except (ValueError, TypeError):
        return False


def is_day_of_month(day: Any, month: Any, year: Any = None) -> bool:
    """
    Validates day based on month and leap year
    Examples:
    - February: 1-29 (only 29 in leap years)
    - April, June, September, November: 1-30
    - January, March, May, July, August, October, December: 1-31
    """
    try:
        day = int(day)
        month = int(month)

        if not is_month(month):
            return False

        if day < 1:
            return False

        # February special case
        if month == 2:
            if year and is_leap_year(year):
                return day <= 29
            return day <= 28

        # Use calendar module for accurate day counts
        max_day = calendar.monthrange(year if year else 2024, month)[1]
        return day <= max_day

    except (ValueError, TypeError):
        return False


# ============================================================================
# UK-SPECIFIC VALIDATORS
# ============================================================================

def is_uk_postcode(value: str) -> bool:
    """
    Validates UK postcode format
    Examples: SW1A 1AA, M1 1AE, CR2 6XH, EC1A 1BB
    """
    if not isinstance(value, str):
        return False

    # UK postcode regex pattern
    pattern = r'^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$'
    return bool(re.match(pattern, value.upper().strip()))


def is_uk_driving_licence(value: str) -> bool:
    """
    Validates UK driving licence number (16-character format)
    Format: MORGA657054SM9IJ (5 letters, 6 digits, 5 characters)
    """
    if not isinstance(value, str):
        return False

    # UK driving licence regex: 5 letters, 6 digits, 5 alphanumeric
    pattern = r'^[A-Z]{5}\d{6}[A-Z0-9]{5}$'
    return bool(re.match(pattern, value.upper().strip()))


def is_uk_driving_licence_category(value: str) -> bool:
    """
    Validates UK driving licence categories
    Categories:
    - A, A1, A2, AM: Motorcycles
    - B, BE: Cars and light vehicles
    - C, C1, C1E, CE: Trucks
    - D, D1, D1E, DE: Buses
    - f, g, h, k, l, n, p, q: Special vehicles
    """
    if not isinstance(value, str):
        return False

    valid_categories = {
        # Motorcycles
        'A', 'A1', 'A2', 'AM',
        # Cars/Light vehicles
        'B', 'BE',
        # Trucks
        'C', 'C1', 'C1E', 'CE',
        # Buses
        'D', 'D1', 'D1E', 'DE',
        # Special vehicles (lowercase)
        'f', 'g', 'h', 'k', 'l', 'n', 'p', 'q'
    }

    return value.strip() in valid_categories


def is_uk_driving_offence_code(value: str) -> bool:
    """
    Validates UK driving offence codes

    Major categories:
    - AC: Accident Offences (AC10-AC30)
    - BA: Disqualified Driver (BA10-BA60)
    - CD: Careless Driving (CD10-CD99)
    - CU: Construction & Use (CU10-CU80)
    - DD: Reckless/Dangerous (DD10-DD90)
    - DR: Drink/Drugs (DR10-DR90)
    - IN: Insurance (IN10)
    - LC: Licence (LC20-LC50)
    - MS: Miscellaneous (MS10-MS90)
    - MW: Motorway (MW10)
    - PC: Pedestrian Crossing (PC10-PC30)
    - SP: Speed Limits (SP10-SP60)
    - TS: Traffic Direction (TS10-TS70)
    - UT: Theft (UT50)
    - TT: Totting Up (TT99)
    """
    if not isinstance(value, str):
        return False

    code = value.upper().strip()

    # Pattern: 2 letters followed by 2 digits
    if not re.match(r'^[A-Z]{2}\d{2}$', code):
        return False

    prefix = code[:2]
    number = int(code[2:])

    # Define valid ranges for each prefix
    valid_ranges = {
        'AC': (10, 30),   # Accident offences
        'BA': (10, 60),   # Disqualified driver
        'CD': (10, 99),   # Careless driving
        'CU': (10, 80),   # Construction & use
        'DD': (10, 90),   # Dangerous driving
        'DR': (10, 90),   # Drink/drugs
        'IN': (10, 10),   # Insurance
        'LC': (20, 50),   # Licence
        'MS': (10, 90),   # Miscellaneous
        'MW': (10, 10),   # Motorway
        'PC': (10, 30),   # Pedestrian crossing
        'SP': (10, 60),   # Speed limits
        'TS': (10, 70),   # Traffic direction
        'UT': (50, 50),   # Theft
        'TT': (99, 99)    # Totting up
    }

    if prefix not in valid_ranges:
        return False

    min_val, max_val = valid_ranges[prefix]
    return min_val <= number <= max_val


def is_uk_car_registration(value: str) -> bool:
    """
    Validates UK vehicle registration
    Examples: AB12 CDE, AB12CDE, A123 ABC
    Supports both old and new UK registration formats
    """
    if not isinstance(value, str):
        return False

    reg = value.upper().strip().replace(' ', '')

    # New format (2001-present): AB12 CDE
    new_format = r'^[A-Z]{2}\d{2}[A-Z]{3}$'

    # Older formats
    prefix_format = r'^[A-Z]{1,2}\d{1,4}[A-Z]{1,3}$'
    suffix_format = r'^[A-Z]{3}\d{1,4}[A-Z]$'

    return bool(
        re.match(new_format, reg) or
        re.match(prefix_format, reg) or
        re.match(suffix_format, reg)
    )


# ============================================================================
# GENERAL VALIDATORS
# ============================================================================

def is_digit(value: Any) -> bool:
    """Validates if value is a single digit (0-9)"""
    return isinstance(value, (int, str)) and str(value).isdigit() and len(str(value)) == 1


def is_number(value: Any) -> bool:
    """Validates if value is a number"""
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


def is_integer(value: Any) -> bool:
    """Validates if value is an integer"""
    try:
        return float(value).is_integer()
    except (ValueError, TypeError, AttributeError):
        return False


def is_float(value: Any) -> bool:
    """Validates if value is a float"""
    try:
        float(value)
        return not is_integer(value)
    except (ValueError, TypeError):
        return False


def is_email(value: str) -> bool:
    """Validates email address format"""
    if not isinstance(value, str):
        return False

    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, value.strip()))


def is_phone(value: str) -> bool:
    """Validates phone number (international format)"""
    if not isinstance(value, str):
        return False

    # Remove common separators
    cleaned = re.sub(r'[\s\-\(\)]', '', value)

    # Check for + prefix and 10-15 digits
    pattern = r'^\+?\d{10,15}$'
    return bool(re.match(pattern, cleaned))


# ============================================================================
# STRING VALIDATORS
# ============================================================================

def is_string(value: Any) -> bool:
    """Validates if value is a string"""
    return isinstance(value, str)


def is_alphanumeric(value: str) -> bool:
    """
    Validates if string contains only alphanumeric characters (letters and numbers)
    Examples: 'ABC123', 'Test123', 'HelloWorld'
    Rejects: 'Test 123', 'Test-123', 'Test@123'
    """
    if not isinstance(value, str):
        return False

    return bool(value) and value.isalnum()


def is_alpha(value: str) -> bool:
    """
    Validates if string contains only alphabetic characters (letters only, no numbers)
    Examples: 'ABC', 'John', 'Smith', 'HelloWorld'
    Rejects: 'ABC123', 'Test@123', 'Test 123', 'Test-123'
    """
    if not isinstance(value, str):
        return False

    return bool(value) and value.isalpha()


def is_numeric(value: str) -> bool:
    """
    Validates if string contains only numeric characters (digits 0-9)
    Allows: digits, spaces, and hyphens
    Examples: '12345', '123-456', '123 456'
    Rejects: 'ABC', 'Test123', '123@456'
    """
    if not isinstance(value, str):
        return False

    # Remove allowed characters (space and hyphen)
    cleaned = value.replace(' ', '').replace('-', '')

    # Check if remaining characters are all digits
    return bool(cleaned) and cleaned.isdigit()


# ============================================================================
# VALIDATION MAPPER
# ============================================================================

VALIDATORS = {
    # Number validators
    'isDigit': is_digit,
    'isNumber': is_number,
    'isInteger': is_integer,
    'isFloat': is_float,

    # Date/time validators
    'isMonth': is_month,
    'isDayOfMonth': is_day_of_month,
    'isLeapYear': is_leap_year,

    # String validators
    'isString': is_string,
    'isAlphanumeric': is_alphanumeric,
    'isAlpha': is_alpha,
    'isNumeric': is_numeric,

    # Contact validators
    'isEmail': is_email,
    'isPhone': is_phone,

    # UK-specific validators
    'isUKPostcode': is_uk_postcode,
    'isUKDrivingLicence': is_uk_driving_licence,
    'isUKDrivingLicenceCategory': is_uk_driving_licence_category,
    'isUKDrivingOffenceCode': is_uk_driving_offence_code,
    'isUKCarRegistration': is_uk_car_registration,
}


def validate(validator_name: str, value: Any, **kwargs) -> bool:
    """
    Generic validation function

    Args:
        validator_name: Name of the validator (e.g., 'isUKPostcode')
        value: Value to validate
        **kwargs: Additional arguments for validators that need them

    Returns:
        bool: True if validation passes, False otherwise

    Example:
        validate('isUKPostcode', 'SW1A 1AA')  # True
        validate('isMonth', 5)  # True
        validate('isDayOfMonth', 29, month=2, year=2024)  # True
    """
    if validator_name not in VALIDATORS:
        raise ValueError(f"Unknown validator: {validator_name}")

    validator_func = VALIDATORS[validator_name]

    try:
        return validator_func(value, **kwargs)
    except TypeError:
        # If kwargs not supported, try without
        return validator_func(value)
