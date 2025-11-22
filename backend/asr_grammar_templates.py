"""
ASR Grammar Templates
Pre-built ASR grammar configurations for common field types
"""

# First Name - Phonetic letter-by-letter
FIRST_NAME_GRAMMAR = {
    "id": "first_name",
    "label": "First Name",
    "icon": "👤",
    "color": "bg-blue-500",
    "description": "Phonetic alphabet spelling (Alpha, Bravo, Charlie...)",

    "asr": {
        "mode": "letter-by-letter",
        "phonetic": True,
        "grammar": """#JSGF V1.0;
grammar first_name;

public <name> = <letter> [<name>];

<letter> = alpha | bravo | charlie | delta | echo | foxtrot | golf | hotel |
           india | juliet | kilo | lima | mike | november | oscar | papa |
           quebec | romeo | sierra | tango | uniform | victor | whiskey |
           x-ray | yankee | zulu;
""",
        "termination": ["done", "finished", "complete", "next"],
        "specialChars": ["space", "hyphen", "apostrophe"]
    },

    "validation": {
        "validators": ["isString", "isAlphanumeric"],
        "minLength": 1,
        "maxLength": 50,
        "pattern": r"^[A-Za-z\-\']+$"
    },

    "ui": {
        "placeholder": "Enter first name",
        "keyboardType": "phonetic"
    }
}

# Last Name - Phonetic letter-by-letter with special chars
LAST_NAME_GRAMMAR = {
    "id": "last_name",
    "label": "Last Name",
    "icon": "👤",
    "color": "bg-blue-600",
    "description": "Surnames with special characters (O'Brien, de la Cruz)",

    "asr": {
        "mode": "letter-by-letter",
        "phonetic": True,
        "grammar": """#JSGF V1.0;
grammar last_name;

public <surname> = <letter> [<surname>];

<letter> = alpha | bravo | charlie | delta | echo | foxtrot | golf | hotel |
           india | juliet | kilo | lima | mike | november | oscar | papa |
           quebec | romeo | sierra | tango | uniform | victor | whiskey |
           x-ray | yankee | zulu;
""",
        "termination": ["done", "finished", "complete", "next"],
        "specialChars": ["space", "hyphen", "apostrophe", "prefix"]
    },

    "validation": {
        "validators": ["isString", "isAlphanumeric"],
        "minLength": 1,
        "maxLength": 50,
        "pattern": r"^[A-Za-z\-\'\s]+$"
    },

    "ui": {
        "placeholder": "Enter last name",
        "keyboardType": "phonetic"
    }
}

# Date of Birth - Conversational with digit fallback
DATE_OF_BIRTH_GRAMMAR = {
    "id": "date_of_birth",
    "label": "Date of Birth",
    "icon": "📅",
    "color": "bg-purple-500",
    "description": "Say 'January 15th, 1990' or spell digits",

    "asr": {
        "mode": "conversational",
        "fallback": "digit-by-digit",
        "grammar": """#JSGF V1.0;
grammar date_of_birth;

public <date> = <conversational_date> | <numeric_date>;

<conversational_date> = [the] <day> [of] <month> [comma] <year>;
<numeric_date> = <digit> <digit> <digit> <digit> <digit> <digit> <digit> <digit>;

<month> = january | february | march | april | may | june |
          july | august | september | october | november | december;

<day> = first | second | third | fourth | fifth | sixth | seventh | eighth | ninth | tenth |
        eleventh | twelfth | thirteenth | fourteenth | fifteenth | sixteenth | seventeenth |
        eighteenth | nineteenth | twentieth | twenty first | twenty second | twenty third |
        twenty fourth | twenty fifth | twenty sixth | twenty seventh | twenty eighth |
        twenty ninth | thirtieth | thirty first;

<digit> = zero | one | two | three | four | five | six | seven | eight | nine;
""",
        "format": "DD/MM/YYYY",
        "prompts": {
            "initial": "Please say your date of birth, for example 'January 15th, 1990'",
            "fallback": "You can also spell it digit by digit, like '1-5-0-1-1-9-9-0'"
        }
    },

    "validation": {
        "validators": ["isMonth", "isDayOfMonth", "isLeapYear"],
        "minDate": "1900-01-01",
        "maxDate": "2025-01-01"
    },

    "ui": {
        "placeholder": "DD/MM/YYYY",
        "keyboardType": "numeric"
    }
}

# UK Postcode - Structured letter-digit pattern
UK_POSTCODE_GRAMMAR = {
    "id": "uk_postcode",
    "label": "UK Postcode",
    "icon": "🇬🇧",
    "color": "bg-red-500",
    "description": "UK postcode format (SW1A 1AA)",

    "asr": {
        "mode": "letter-by-letter",
        "phonetic": True,
        "grammar": """#JSGF V1.0;
grammar uk_postcode;

public <postcode> = <outward> [space] <inward>;

<outward> = <area> <district> [<sub_district>];
<inward> = <sector> <unit>;

<area> = <letter> [<letter>];
<district> = <digit> [<digit>];
<sub_district> = <letter>;
<sector> = <digit>;
<unit> = <letter> <letter>;

<letter> = alpha | bravo | charlie | delta | echo | foxtrot | golf | hotel |
           india | juliet | kilo | lima | mike | november | oscar | papa |
           quebec | romeo | sierra | tango | uniform | victor | whiskey |
           x-ray | yankee | zulu;

<digit> = zero | one | two | three | four | five | six | seven | eight | nine;
""",
        "segments": [
            {"name": "area", "type": "alpha", "length": "1-2", "prompt": "Area code (e.g., SW, M, EC)"},
            {"name": "district", "type": "digit", "length": "1-2", "prompt": "District number"},
            {"name": "sub_district", "type": "alpha", "length": "0-1", "prompt": "Sub-district (optional)"},
            {"name": "sector", "type": "digit", "length": "1", "prompt": "Sector"},
            {"name": "unit", "type": "alpha", "length": "2", "prompt": "Unit code (2 letters)"}
        ]
    },

    "validation": {
        "validators": ["isUKPostcode"],
        "pattern": r"^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$"
    },

    "ui": {
        "placeholder": "SW1A 1AA",
        "keyboardType": "phonetic"
    }
}

# UK Driving Licence - Segmented 3-part format
UK_DRIVING_LICENCE_GRAMMAR = {
    "id": "uk_driving_licence",
    "label": "UK Driving Licence",
    "icon": "🪪",
    "color": "bg-red-600",
    "description": "16-character UK licence (MORGA657054SM9IJ)",

    "asr": {
        "mode": "segmented",
        "phonetic": True,
        "grammar": """#JSGF V1.0;
grammar uk_driving_licence;

public <licence> = <surname_part> <date_part> <initials_part>;

<surname_part> = <letter> <letter> <letter> <letter> <letter>;
<date_part> = <digit> <digit> <digit> <digit> <digit> <digit>;
<initials_part> = <alphanumeric> <alphanumeric> <alphanumeric> <alphanumeric> <alphanumeric>;

<alphanumeric> = <letter> | <digit>;

<letter> = alpha | bravo | charlie | delta | echo | foxtrot | golf | hotel |
           india | juliet | kilo | lima | mike | november | oscar | papa |
           quebec | romeo | sierra | tango | uniform | victor | whiskey |
           x-ray | yankee | zulu;

<digit> = zero | one | two | three | four | five | six | seven | eight | nine;
""",
        "segments": [
            {
                "name": "surname",
                "type": "alpha",
                "length": 5,
                "phonetic": True,
                "prompt": "First 5 letters of surname (e.g., MORGA for Morgan)"
            },
            {
                "name": "date_code",
                "type": "digit",
                "length": 6,
                "phonetic": False,
                "prompt": "6-digit date code (DDMMYY with month offset)"
            },
            {
                "name": "initials_code",
                "type": "alphanumeric",
                "length": 5,
                "phonetic": True,
                "prompt": "5-character initials and check code"
            }
        ]
    },

    "validation": {
        "validators": ["isUKDrivingLicence"],
        "pattern": r"^[A-Z]{5}\d{6}[A-Z0-9]{5}$",
        "length": 16
    },

    "ui": {
        "placeholder": "MORGA657054SM9IJ",
        "keyboardType": "phonetic"
    }
}

# UK Car Registration - Letter-digit pattern
UK_CAR_REGISTRATION_GRAMMAR = {
    "id": "uk_car_registration",
    "label": "UK Car Registration",
    "icon": "🚗",
    "color": "bg-yellow-500",
    "description": "UK vehicle registration (AB12 CDE)",

    "asr": {
        "mode": "letter-by-letter",
        "phonetic": True,
        "grammar": """#JSGF V1.0;
grammar uk_car_registration;

public <registration> = <new_format> | <prefix_format> | <suffix_format>;

<new_format> = <letter> <letter> <digit> <digit> <letter> <letter> <letter>;
<prefix_format> = <letter> [<letter>] <digit> [<digit>] [<digit>] [<digit>] <letter> [<letter>] [<letter>];
<suffix_format> = <letter> <letter> <letter> <digit> [<digit>] [<digit>] [<digit>] <letter>;

<letter> = alpha | bravo | charlie | delta | echo | foxtrot | golf | hotel |
           india | juliet | kilo | lima | mike | november | oscar | papa |
           quebec | romeo | sierra | tango | uniform | victor | whiskey |
           x-ray | yankee | zulu;

<digit> = zero | one | two | three | four | five | six | seven | eight | nine;
""",
        "formats": ["AB12 CDE", "A123 ABC", "ABC 123D"]
    },

    "validation": {
        "validators": ["isUKCarRegistration"],
        "pattern": r"^[A-Z]{1,3}\d{1,4}[A-Z]{1,3}$"
    },

    "ui": {
        "placeholder": "AB12 CDE",
        "keyboardType": "phonetic"
    }
}

# Email Address - Letter-by-letter with special chars
EMAIL_GRAMMAR = {
    "id": "email",
    "label": "Email Address",
    "icon": "📧",
    "color": "bg-green-500",
    "description": "Spell email letter-by-letter with @ and .",

    "asr": {
        "mode": "letter-by-letter",
        "phonetic": True,
        "grammar": """#JSGF V1.0;
grammar email;

public <email> = <local_part> <at> <domain>;

<local_part> = <alphanumeric> [<local_part>];
<domain> = <alphanumeric> [<domain>] <dot> <tld>;

<alphanumeric> = <letter> | <digit> | <special>;

<letter> = alpha | bravo | charlie | delta | echo | foxtrot | golf | hotel |
           india | juliet | kilo | lima | mike | november | oscar | papa |
           quebec | romeo | sierra | tango | uniform | victor | whiskey |
           x-ray | yankee | zulu;

<digit> = zero | one | two | three | four | five | six | seven | eight | nine;

<special> = dot | hyphen | underscore;

<at> = at | at sign;
<dot> = dot | period | point;

<tld> = com | co uk | org | net | gmail | outlook | yahoo | hotmail;
""",
        "specialChars": {
            "@": ["at", "at sign"],
            ".": ["dot", "period", "point"],
            "-": ["hyphen", "dash"],
            "_": ["underscore"]
        }
    },

    "validation": {
        "validators": ["isEmail"],
        "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    },

    "ui": {
        "placeholder": "john@example.com",
        "keyboardType": "email"
    }
}

# Phone Number - Digit-by-digit
PHONE_GRAMMAR = {
    "id": "phone",
    "label": "Phone Number",
    "icon": "📱",
    "color": "bg-green-600",
    "description": "Digit-by-digit phone number entry",

    "asr": {
        "mode": "digit-by-digit",
        "phonetic": False,
        "grammar": """#JSGF V1.0;
grammar phone;

public <phone> = [<country_code>] <number>;

<country_code> = plus <digit> <digit> [<digit>];
<number> = <digit> [<number>];

<digit> = zero | one | two | three | four | five | six | seven | eight | nine |
          oh | double <digit>;

<plus> = plus;
""",
        "format": "+44 1234 567890",
        "minDigits": 10,
        "maxDigits": 15
    },

    "validation": {
        "validators": ["isPhone"],
        "pattern": r"^\+?\d{10,15}$"
    },

    "ui": {
        "placeholder": "+44 1234 567890",
        "keyboardType": "phone"
    }
}

# Yes/No - Conversational boolean
YES_NO_GRAMMAR = {
    "id": "yes_no",
    "label": "Yes/No Question",
    "icon": "✓",
    "color": "bg-indigo-500",
    "description": "Accept yes/no with variations",

    "asr": {
        "mode": "conversational",
        "grammar": """#JSGF V1.0;
grammar yes_no;

public <answer> = <yes> | <no>;

<yes> = yes | yeah | yep | yup | sure | correct | affirmative | true |
        okay | ok | accept | agree | confirm | absolutely | definitely |
        of course | certainly;

<no> = no | nope | nah | negative | false | incorrect |
       decline | disagree | deny | reject | not really | absolutely not;
""",
        "confidenceThreshold": 0.7
    },

    "validation": {
        "type": "boolean"
    },

    "ui": {
        "displayAs": "toggle",
        "placeholder": "Yes or No"
    }
}

# All templates organized by category
ASR_GRAMMAR_TEMPLATES = {
    "name_fields": [
        FIRST_NAME_GRAMMAR,
        LAST_NAME_GRAMMAR
    ],
    "date_time": [
        DATE_OF_BIRTH_GRAMMAR
    ],
    "uk_specific": [
        UK_POSTCODE_GRAMMAR,
        UK_DRIVING_LICENCE_GRAMMAR,
        UK_CAR_REGISTRATION_GRAMMAR
    ],
    "contact": [
        EMAIL_GRAMMAR,
        PHONE_GRAMMAR
    ],
    "boolean": [
        YES_NO_GRAMMAR
    ]
}

# Flat list of all templates
ALL_ASR_TEMPLATES = [
    FIRST_NAME_GRAMMAR,
    LAST_NAME_GRAMMAR,
    DATE_OF_BIRTH_GRAMMAR,
    UK_POSTCODE_GRAMMAR,
    UK_DRIVING_LICENCE_GRAMMAR,
    UK_CAR_REGISTRATION_GRAMMAR,
    EMAIL_GRAMMAR,
    PHONE_GRAMMAR,
    YES_NO_GRAMMAR
]
