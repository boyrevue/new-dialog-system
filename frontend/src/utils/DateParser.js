/**
 * Date Parser
 * 
 * Parses speech recognition results into standard date format (DD/MM/YYYY)
 * Handles multiple input formats and variations
 */

// Number word to digit mapping
const numberWords = {
    'zero': 0, 'nought': 0, 'oh': 0,
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
};

// Ordinal word to number mapping
const ordinalWords = {
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
    'twenty first': 21, '21st': 21,
    'twenty second': 22, '22nd': 22,
    'twenty third': 23, '23rd': 23,
    'twenty fourth': 24, '24th': 24,
    'twenty fifth': 25, '25th': 25,
    'twenty sixth': 26, '26th': 26,
    'twenty seventh': 27, '27th': 27,
    'twenty eighth': 28, '28th': 28,
    'twenty ninth': 29, '29th': 29,
    'thirtieth': 30, '30th': 30,
    'thirty first': 31, '31st': 31
};

// Month name to number mapping
const monthNames = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
};

/**
 * Parse date component from speech transcript
 * @param {string} transcript - Speech recognition result
 * @param {string} componentType - Type of date component: 'full', 'month_year', 'day', 'month', 'year'
 * @returns {string|null} Formatted date component or null if parsing fails
 */
export function parseDateComponent(transcript, componentType = 'full') {
    if (!transcript) return null;

    const normalized = transcript.toLowerCase().trim();
    console.log(`📅 Parsing ${componentType} from:`, normalized);

    try {
        switch (componentType) {
            case 'month_year':
                return parseMonthYear(normalized);
            case 'day':
                return parseDay(normalized);
            case 'month':
                return parseMonth(normalized);
            case 'year':
                return parseYear(normalized);
            case 'full':
            default:
                return parseDateFromSpeech(transcript);
        }
    } catch (error) {
        console.error(`❌ Error parsing ${componentType}:`, error);
        return null;
    }
}

/**
 * Parse month and year from speech (MM/YYYY)
 * @param {string} text - Normalized transcript
 * @returns {string|null} Month/Year in MM/YYYY format or null
 */
function parseMonthYear(text) {
    const month = extractMonth(text);
    const year = extractYear(text);

    if (!month || !year) {
        console.warn('❌ Failed to extract month/year:', { month, year });
        return null;
    }

    const formatted = `${String(month).padStart(2, '0')}/${year}`;
    console.log('✅ Parsed month/year:', formatted);
    return formatted;
}

/**
 * Parse day only from speech (DD)
 * @param {string} text - Normalized transcript
 * @returns {string|null} Day in DD format or null
 */
function parseDay(text) {
    const day = extractDay(text);

    if (!day) {
        console.warn('❌ Failed to extract day');
        return null;
    }

    const formatted = String(day).padStart(2, '0');
    console.log('✅ Parsed day:', formatted);
    return formatted;
}

/**
 * Parse month only from speech (MM)
 * @param {string} text - Normalized transcript
 * @returns {string|null} Month in MM format or null
 */
function parseMonth(text) {
    const month = extractMonth(text);

    if (!month) {
        console.warn('❌ Failed to extract month');
        return null;
    }

    const formatted = String(month).padStart(2, '0');
    console.log('✅ Parsed month:', formatted);
    return formatted;
}

/**
 * Parse year only from speech (YYYY)
 * @param {string} text - Normalized transcript
 * @returns {string|null} Year in YYYY format or null
 */
function parseYear(text) {
    const year = extractYear(text);

    if (!year) {
        console.warn('❌ Failed to extract year');
        return null;
    }

    const formatted = String(year);
    console.log('✅ Parsed year:', formatted);
    return formatted;
}

/**
 * Parse date from speech transcript
 * @param {string} transcript - Speech recognition result
 * @returns {string|null} Date in DD/MM/YYYY format or null if parsing fails
 */
export function parseDateFromSpeech(transcript) {
    if (!transcript) return null;

    const normalized = transcript.toLowerCase().trim();
    console.log('📅 Parsing date from:', normalized);

    try {
        const day = extractDay(normalized);
        const month = extractMonth(normalized);
        const year = extractYear(normalized);

        if (!day || !month || !year) {
            console.warn('❌ Failed to extract all date components:', { day, month, year });
            return null;
        }

        // Format as DD/MM/YYYY
        const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        console.log('✅ Parsed date:', formatted);
        return formatted;
    } catch (error) {
        console.error('❌ Error parsing date:', error);
        return null;
    }
}

/**
 * Extract day from transcript
 * @param {string} text - Normalized transcript
 * @returns {number|null} Day (1-31) or null
 */
function extractDay(text) {
    // Try ordinal words first
    for (const [word, num] of Object.entries(ordinalWords)) {
        if (text.includes(word)) {
            return num;
        }
    }

    // Try numeric patterns (e.g., "zero nine", "09", "9")
    const words = text.split(/\s+/);

    // Look for two-digit day (e.g., "zero nine", "nought nine", "oh nine")
    for (let i = 0; i < words.length - 1; i++) {
        const first = numberWords[words[i]];
        const second = numberWords[words[i + 1]];

        if (first !== undefined && second !== undefined) {
            const day = first * 10 + second;
            if (day >= 1 && day <= 31) {
                return day;
            }
        }
    }

    // Look for single-digit day
    for (const word of words) {
        const num = numberWords[word];
        if (num !== undefined && num >= 1 && num <= 31) {
            return num;
        }
    }

    // Try numeric digits (e.g., "09", "9")
    const digitMatch = text.match(/\b(\d{1,2})\b/);
    if (digitMatch) {
        const day = parseInt(digitMatch[1], 10);
        if (day >= 1 && day <= 31) {
            return day;
        }
    }

    return null;
}

/**
 * Extract month from transcript
 * @param {string} text - Normalized transcript
 * @returns {number|null} Month (1-12) or null
 */
function extractMonth(text) {
    // Try month names first
    for (const [name, num] of Object.entries(monthNames)) {
        if (text.includes(name)) {
            return num;
        }
    }

    // Try numeric patterns
    const words = text.split(/\s+/);

    // Look for two-digit month (e.g., "zero four", "nought four", "oh four")
    for (let i = 0; i < words.length - 1; i++) {
        const first = numberWords[words[i]];
        const second = numberWords[words[i + 1]];

        if (first !== undefined && second !== undefined) {
            const month = first * 10 + second;
            if (month >= 1 && month <= 12) {
                return month;
            }
        }
    }

    // Look for single-digit month
    for (const word of words) {
        const num = numberWords[word];
        if (num !== undefined && num >= 1 && num <= 12) {
            return num;
        }
    }

    // Try numeric digits
    const digitMatch = text.match(/\b(\d{1,2})\b/);
    if (digitMatch) {
        const month = parseInt(digitMatch[1], 10);
        if (month >= 1 && month <= 12) {
            return month;
        }
    }

    return null;
}

/**
 * Extract year from transcript
 * @param {string} text - Normalized transcript
 * @returns {number|null} Year (1900-2099) or null
 */
function extractYear(text) {
    const words = text.split(/\s+/);

    // Try full year patterns (e.g., "nineteen sixty one", "twenty twenty four")
    for (let i = 0; i < words.length - 1; i++) {
        if (words[i] === 'nineteen' || words[i] === 'twenty') {
            const century = words[i] === 'nineteen' ? 1900 : 2000;

            // Next word might be a two-digit year
            const nextWord = words[i + 1];
            const twoDigit = parseYearWords(words.slice(i + 1, i + 3).join(' '));

            if (twoDigit !== null) {
                return century + twoDigit;
            }
        }
    }

    // Try numeric year (e.g., "1961", "61")
    const fourDigitMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
    if (fourDigitMatch) {
        return parseInt(fourDigitMatch[1], 10);
    }

    const twoDigitMatch = text.match(/\b(\d{2})\b/);
    if (twoDigitMatch) {
        const year = parseInt(twoDigitMatch[1], 10);
        // Assume 1900s for years >= 50, 2000s for years < 50
        return year >= 50 ? 1900 + year : 2000 + year;
    }

    // Try short year words (e.g., "sixty one")
    const shortYear = parseYearWords(text);
    if (shortYear !== null) {
        return shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear;
    }

    return null;
}

/**
 * Parse two-digit year from words
 * @param {string} text - Text containing year words
 * @returns {number|null} Two-digit year (0-99) or null
 */
function parseYearWords(text) {
    const words = text.split(/\s+/);

    // Try compound numbers (e.g., "sixty one" = 61)
    for (let i = 0; i < words.length - 1; i++) {
        const tens = numberWords[words[i]];
        const ones = numberWords[words[i + 1]];

        if (tens !== undefined && tens >= 20 && tens <= 90 && tens % 10 === 0) {
            if (ones !== undefined && ones >= 0 && ones <= 9) {
                return tens + ones;
            }
        }
    }

    // Try single number words
    for (const word of words) {
        const num = numberWords[word];
        if (num !== undefined && num >= 0 && num <= 99) {
            return num;
        }
    }

    return null;
}

/**
 * Validate if a date is valid
 * @param {number} day - Day (1-31)
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (1900-2099)
 * @returns {boolean} True if valid date
 */
export function isValidDate(day, month, year) {
    if (!day || !month || !year) return false;
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2099) return false;

    // Check for valid day in month
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
}
