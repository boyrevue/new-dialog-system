/**
 * UK Licence Grammar Generator
 * 
 * Generates JSGF grammar for UK driving licence voice input
 * Supports:
 * - Phonetic alphabet (Alpha, Bravo, Charlie, etc.)
 * - Letter names (A, B, C, etc.)
 * - Numbers (0-9)
 * - Navigation commands (next, back, clear)
 */

// NATO Phonetic Alphabet
const phoneticAlphabet = {
    'a': ['alpha', 'alfa'],
    'b': ['bravo'],
    'c': ['charlie'],
    'd': ['delta'],
    'e': ['echo'],
    'f': ['foxtrot'],
    'g': ['golf'],
    'h': ['hotel'],
    'i': ['india'],
    'j': ['juliet'],
    'k': ['kilo'],
    'l': ['lima'],
    'm': ['mike'],
    'n': ['november'],
    'o': ['oscar'],
    'p': ['papa'],
    'q': ['quebec'],
    'r': ['romeo'],
    's': ['sierra'],
    't': ['tango'],
    'u': ['uniform'],
    'v': ['victor'],
    'w': ['whiskey'],
    'x': ['x-ray', 'xray'],
    'y': ['yankee'],
    'z': ['zulu']
};

/**
 * Generate comprehensive JSGF grammar for UK licence input
 * @returns {string} JSGF grammar string
 */
export function generateUKLicenceGrammar() {
    return `#JSGF V1.0;

grammar ukLicence;

public <licence_input> = <letter> | <digit> | <command>;

<letter> = (
  ${Object.entries(phoneticAlphabet).map(([letter, phonetics]) =>
        `letter ${letter} | ${letter} | ${phonetics.join(' | ')}`
    ).join(' |\n  ')}
);

<digit> = (
  zero | nought | oh | 0 |
  one | 1 |
  two | 2 |
  three | 3 |
  four | 4 |
  five | 5 |
  six | 6 |
  seven | 7 |
  eight | 8 |
  nine | 9
);

<command> = (
  next | next field |
  back | backspace | delete |
  clear | clear all |
  auto fill | autofill
);
`;
}

/**
 * Parse voice command to licence character
 * @param {string} command - Voice command
 * @returns {string|null} Licence character or command
 */
export function parseLicenceCommand(command) {
    const normalized = command.toLowerCase().trim();

    // Check phonetic alphabet
    for (const [letter, phonetics] of Object.entries(phoneticAlphabet)) {
        if (phonetics.includes(normalized)) {
            return letter.toUpperCase();
        }
    }

    // Check letter names
    const letterMatch = normalized.match(/^(?:letter )?([a-z])$/);
    if (letterMatch) return letterMatch[1].toUpperCase();

    // Check numbers
    const numberWords = {
        'zero': '0', 'nought': '0', 'oh': '0',
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
    };

    if (numberWords[normalized]) {
        return numberWords[normalized];
    }

    // Check commands
    if (normalized === 'next' || normalized === 'next field') return 'NEXT';
    if (normalized === 'back' || normalized === 'backspace' || normalized === 'delete') return 'BACK';
    if (normalized === 'clear' || normalized === 'clear all') return 'CLEAR';
    if (normalized === 'auto fill' || normalized === 'autofill') return 'AUTOFILL';

    return null;
}

/**
 * Get example voice commands
 * @returns {Array<string>} Array of example commands
 */
export function getLicenceVoiceExamples() {
    return [
        "Mike Oscar Romeo Golf Alpha",
        "six five seven zero five four",
        "Sierra Mike",
        "nine India Juliet"
    ];
}

export default {
    generateUKLicenceGrammar,
    parseLicenceCommand,
    getLicenceVoiceExamples
};
