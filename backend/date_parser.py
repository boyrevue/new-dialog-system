"""
Date Parser for Natural Language Date Input
Handles spoken date formats and converts them to DD/MM/YYYY
"""

import re
from datetime import datetime
from typing import Optional, Tuple

# Ordinal number mappings
ORDINAL_NUMBERS = {
    'first': 1, '1st': 1,
    'second': 2, '2nd': 2,
    'third': 3, '3rd': 3,
    'fourth': 4, '4th': 4,
    'fifth': 5, '5th': 5,
    'sixth': 6, '6th': 6,
    'seventh': 7, '7th': 7,
    'eighth': 8, '8th': 8,
    'ninth': 9, '9th': 9,
    'tenth': 10, '10th': 10,
    'eleventh': 11, '11th': 11,
    'twelfth': 12, '12th': 12,
    'thirteenth': 13, '13th': 13,
    'fourteenth': 14, '14th': 14,
    'fifteenth': 15, '15th': 15,
    'sixteenth': 16, '16th': 16,
    'seventeenth': 17, '17th': 17,
    'eighteenth': 18, '18th': 18,
    'nineteenth': 19, '19th': 19,
    'twentieth': 20, '20th': 20,
    'twenty-first': 21, 'twenty first': 21, '21st': 21,
    'twenty-second': 22, 'twenty second': 22, '22nd': 22,
    'twenty-third': 23, 'twenty third': 23, '23rd': 23,
    'twenty-fourth': 24, 'twenty fourth': 24, '24th': 24,
    'twenty-fifth': 25, 'twenty fifth': 25, '25th': 25,
    'twenty-sixth': 26, 'twenty sixth': 26, '26th': 26,
    'twenty-seventh': 27, 'twenty seventh': 27, '27th': 27,
    'twenty-eighth': 28, 'twenty eighth': 28, '28th': 28,
    'twenty-ninth': 29, 'twenty ninth': 29, '29th': 29,
    'thirtieth': 30, '30th': 30,
    'thirty-first': 31, 'thirty first': 31, '31st': 31,
}

# Month mappings
MONTH_NAMES = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sept': 9, 'sep': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12,
}

# Month ordinals
MONTH_ORDINALS = {
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4,
    'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8,
    'ninth': 9, 'tenth': 10, 'eleventh': 11, 'twelfth': 12,
}

# Year word parsing
def parse_year_words(year_str: str) -> Optional[int]:
    """Parse spoken year like 'nineteen sixty one' or 'two thousand and twenty'"""
    year_str = year_str.lower().strip()

    # Direct number check
    if year_str.isdigit() and len(year_str) == 4:
        return int(year_str)

    # Number word mappings
    ones = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9}
    tens = {'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19}
    decades = {'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
               'eighty': 80, 'ninety': 90}
    hundreds = {'hundred': 100}
    thousands = {'thousand': 1000}

    # Pattern: "nineteen sixty one" or "two thousand and twenty"
    words = year_str.replace('-', ' ').split()

    try:
        # Pattern 1: "nineteen sixty one" (1961)
        if len(words) >= 3:
            first = decades.get(words[0], tens.get(words[0], 0))
            second = decades.get(words[1], tens.get(words[1], 0))
            third = ones.get(words[2], tens.get(words[2], 0))
            # nineteen (19) * 100 + sixty (60) + one (1) = 1961
            if first >= 10:  # "nineteen" etc
                return first * 100 + second + third

        # Pattern 2: "two thousand and twenty" (2020)
        if 'thousand' in words:
            idx = words.index('thousand')
            prefix = ones.get(words[idx-1], 0) if idx > 0 else 0
            result = prefix * 1000

            # Add remainder after "thousand"
            remainder_words = words[idx+1:]
            # Remove "and" if present
            if remainder_words and remainder_words[0] == 'and':
                remainder_words = remainder_words[1:]

            if remainder_words:
                if len(remainder_words) == 1:
                    result += tens.get(remainder_words[0], ones.get(remainder_words[0], 0))
                elif len(remainder_words) == 2:
                    result += decades.get(remainder_words[0], 0) + ones.get(remainder_words[1], 0)

            return result

        # Pattern 3: "sixty one" (treat as part of century based on context)
        if len(words) == 2:
            first = decades.get(words[0], tens.get(words[0], 0))
            second = ones.get(words[1], tens.get(words[1], 0))
            # Assume 1900s for 20-99, 2000s for 00-19
            year = first + second
            if year >= 20:
                return 1900 + year
            else:
                return 2000 + year

    except (ValueError, KeyError):
        pass

    return None


def parse_date_natural(date_input: str) -> Optional[str]:
    """
    Parse natural language date input and return DD/MM/YYYY format

    Examples:
        "9th of the fourth 1961" -> "09/04/1961"
        "ninth of April nineteen sixty one" -> "09/04/1961"
        "9 4 1961" -> "09/04/1961"
        "09/04/1961" -> "09/04/1961"
        "9th April 1961" -> "09/04/1961"
        "April 9 1961" -> "09/04/1961"
    """
    if not date_input or not isinstance(date_input, str):
        return None

    date_input = date_input.lower().strip()

    # Pattern 1: Already formatted DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    match = re.match(r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})', date_input)
    if match:
        day, month, year = map(int, match.groups())
        if 1 <= day <= 31 and 1 <= month <= 12:
            return f"{day:02d}/{month:02d}/{year}"

    # Pattern 2: "9th of the fourth 1961" or "9th of the 4th 1961"
    match = re.search(r'(\d+)(?:st|nd|rd|th)?\s+of\s+the\s+(\w+)\s+(\d+|\w+(?:\s+\w+)*)', date_input)
    if match:
        day_str, month_str, year_str = match.groups()
        day = int(day_str)

        # Month could be ordinal or name
        month = MONTH_ORDINALS.get(month_str, ORDINAL_NUMBERS.get(month_str, 0))
        if not month and month_str.isdigit():
            month = int(month_str)
        if not month and month_str.replace('st', '').replace('nd', '').replace('rd', '').replace('th', '').isdigit():
            month = int(month_str.replace('st', '').replace('nd', '').replace('rd', '').replace('th', ''))

        # Parse year
        year = parse_year_words(year_str)
        if not year and year_str.isdigit():
            year = int(year_str)

        if day and month and year and 1 <= day <= 31 and 1 <= month <= 12:
            return f"{day:02d}/{month:02d}/{year}"

    # Pattern 3: "9th April 1961" or "ninth of April 1961"
    match = re.search(r'(\w+)\s+(?:of\s+)?(\w+)\s+(\d+|\w+(?:\s+\w+)*)', date_input)
    if match:
        day_str, month_str, year_str = match.groups()

        # Parse day (could be number or ordinal word)
        day = ORDINAL_NUMBERS.get(day_str, None)
        if not day and day_str.replace('st', '').replace('nd', '').replace('rd', '').replace('th', '').isdigit():
            day = int(day_str.replace('st', '').replace('nd', '').replace('rd', '').replace('th', ''))
        if not day and day_str.isdigit():
            day = int(day_str)

        # Parse month
        month = MONTH_NAMES.get(month_str.lower(), None)

        # Parse year
        year = parse_year_words(year_str)
        if not year and year_str.isdigit():
            year = int(year_str)

        if day and month and year and 1 <= day <= 31 and 1 <= month <= 12:
            return f"{day:02d}/{month:02d}/{year}"

    # Pattern 4: "April 9 1961" or "April ninth 1961"
    match = re.search(r'(\w+)\s+(\w+)\s+(\d+|\w+(?:\s+\w+)*)', date_input)
    if match:
        month_str, day_str, year_str = match.groups()

        # Parse month
        month = MONTH_NAMES.get(month_str.lower(), None)
        if not month:
            return None  # First word must be month for this pattern

        # Parse day
        day = ORDINAL_NUMBERS.get(day_str, None)
        if not day and day_str.replace('st', '').replace('nd', '').replace('rd', '').replace('th', '').isdigit():
            day = int(day_str.replace('st', '').replace('nd', '').replace('rd', '').replace('th', ''))
        if not day and day_str.isdigit():
            day = int(day_str)

        # Parse year
        year = parse_year_words(year_str)
        if not year and year_str.isdigit():
            year = int(year_str)

        if day and month and year and 1 <= day <= 31 and 1 <= month <= 12:
            return f"{day:02d}/{month:02d}/{year}"

    # Pattern 5: "9 4 1961" - space separated numbers
    parts = date_input.split()
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        day, month, year = map(int, parts)
        if 1 <= day <= 31 and 1 <= month <= 12 and len(parts[2]) == 4:
            return f"{day:02d}/{month:02d}/{year}"

    # Pattern 6: Handle "9 ^ 1961" (ASR might hear caret as separator)
    match = re.search(r'(\d{1,2})\s*[\^]\s*(\d{4})', date_input)
    if match:
        day_str, year_str = match.groups()
        # Missing month - can't parse without month
        return None

    return None


def validate_date(date_str: str) -> Tuple[bool, Optional[str]]:
    """
    Validate a date string in DD/MM/YYYY format
    Returns (is_valid, error_message)
    """
    if not date_str:
        return False, "Date is required"

    try:
        day, month, year = map(int, date_str.split('/'))

        # Check ranges
        if year < 1900 or year > datetime.now().year:
            return False, f"Year must be between 1900 and {datetime.now().year}"

        if month < 1 or month > 12:
            return False, "Month must be between 1 and 12"

        if day < 1 or day > 31:
            return False, "Day must be between 1 and 31"

        # Validate actual date
        datetime(year, month, day)

        return True, None
    except ValueError as e:
        return False, f"Invalid date: {str(e)}"


if __name__ == "__main__":
    # Test cases
    test_cases = [
        "9th of the fourth 1961",
        "ninth of April nineteen sixty one",
        "9 4 1961",
        "09/04/1961",
        "9th April 1961",
        "April 9 1961",
        "9th of the 4th 1961",
        "first of January two thousand and twenty",
        "31st December 1999",
    ]

    print("Date Parser Test Cases:\n")
    for test in test_cases:
        result = parse_date_natural(test)
        print(f"Input:  '{test}'")
        print(f"Output: '{result}'")
        if result:
            is_valid, error = validate_date(result)
            print(f"Valid:  {is_valid} {f'({error})' if error else ''}")
        print()
