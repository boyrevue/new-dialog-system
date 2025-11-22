/**
 * Email Grammar Generator
 * 
 * Generates JSGF grammar for email voice input
 * Supports:
 * - Letters (a-z)
 * - Numbers (0-9)
 * - Special characters (@, ., -, _, +)
 * - TLD shortcuts (dot com, dot org, etc.)
 */

// Common TLDs
const commonTLDs = [
    'com', 'org', 'net', 'edu', 'gov', 'mil',
    'co.uk', 'ac.uk', 'gov.uk', 'org.uk',
    'io', 'ai', 'app', 'dev', 'tech',
    'info', 'biz', 'name', 'pro',
    'eu', 'us', 'ca', 'au', 'de', 'fr', 'jp'
];

/**
 * Generate comprehensive JSGF grammar for email input
 * @param {Array<string>} customTLDs - Additional TLDs to include
 * @returns {string} JSGF grammar string
 */
export function generateEmailGrammar(customTLDs = []) {
    const allTLDs = [...commonTLDs, ...customTLDs];

    return `#JSGF V1.0;

grammar email;

public <email_input> = <character> | <special> | <tld>;

<character> = <letter> | <number>;

<letter> = (
  letter a | letter b | letter c | letter d | letter e |
  letter f | letter g | letter h | letter i | letter j |
  letter k | letter l | letter m | letter n | letter o |
  letter p | letter q | letter r | letter s | letter t |
  letter u | letter v | letter w | letter x | letter y | letter z |
  a | b | c | d | e | f | g | h | i | j | k | l | m |
  n | o | p | q | r | s | t | u | v | w | x | y | z
);

<number> = (
  number zero | number one | number two | number three | number four |
  number five | number six | number seven | number eight | number nine |
  zero | one | two | three | four | five | six | seven | eight | nine
);

<special> = (
  at | at sign |
  dot | period | point |
  dash | hyphen | minus |
  underscore | under score |
  plus | plus sign
);

<tld> = (
  ${allTLDs.map(tld => `dot ${tld.replace('.', ' dot ')}`).join(' |\n  ')}
);
`;
}

/**
 * Get list of supported TLDs
 * @returns {Array<string>} Array of TLD strings
 */
export function getSupportedTLDs() {
    return commonTLDs;
}

/**
 * Get example email voice commands
 * @returns {Array<string>} Array of example commands
 */
export function getEmailVoiceExamples() {
    return [
        "letter j letter o letter h letter n",
        "dot",
        "letter d letter o letter e",
        "at",
        "letter e letter x letter a letter m letter p letter l letter e",
        "dot com"
    ];
}

/**
 * Parse voice command to email character
 * @param {string} command - Voice command
 * @returns {string|null} Email character or null
 */
export function parseEmailCommand(command) {
    const normalized = command.toLowerCase().trim();

    // Letters
    const letterMatch = normalized.match(/^(?:letter )?([a-z])$/);
    if (letterMatch) return letterMatch[1];

    // Numbers
    const numberWords = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
    };

    const numberMatch = normalized.match(/^(?:number )?(\w+)$/);
    if (numberMatch && numberWords[numberMatch[1]]) {
        return numberWords[numberMatch[1]];
    }

    // Special characters
    if (normalized === 'at' || normalized === 'at sign') return '@';
    if (normalized === 'dot' || normalized === 'period' || normalized === 'point') return '.';
    if (normalized === 'dash' || normalized === 'hyphen' || normalized === 'minus') return '-';
    if (normalized === 'underscore' || normalized === 'under score') return '_';
    if (normalized === 'plus' || normalized === 'plus sign') return '+';

    // TLDs
    const tldMatch = normalized.match(/^dot (.+)$/);
    if (tldMatch) {
        const tld = tldMatch[1].replace(/ dot /g, '.');
        return `.${tld}`;
    }

    return null;
}

export default {
    generateEmailGrammar,
    getSupportedTLDs,
    getEmailVoiceExamples,
    parseEmailCommand
};
