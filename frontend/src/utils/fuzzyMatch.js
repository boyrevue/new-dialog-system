/**
 * Fuzzy Matching Utilities
 * 
 * Helper functions for matching user input (voice or keyboard) to select options
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
export function levenshteinDistance(a, b) {
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Find best matching option from a list
 * @param {string} query - Search query (from voice or keyboard)
 * @param {Array} options - Array of {value, label} objects
 * @returns {Object} - {option, confidence, alternatives}
 */
export function findBestMatch(query, options) {
    if (!query || !options || options.length === 0) {
        return { option: null, confidence: 0, alternatives: [] };
    }

    const normalized = query.toLowerCase().trim();

    // 1. Exact match
    const exact = options.find(o =>
        o.label.toLowerCase() === normalized ||
        o.value.toLowerCase() === normalized
    );
    if (exact) {
        return { option: exact, confidence: 1.0, alternatives: [] };
    }

    // 2. Starts with
    const startsWith = options.filter(o =>
        o.label.toLowerCase().startsWith(normalized) ||
        o.value.toLowerCase().startsWith(normalized)
    );
    if (startsWith.length === 1) {
        return { option: startsWith[0], confidence: 0.9, alternatives: startsWith.slice(1, 5) };
    }
    if (startsWith.length > 1) {
        return { option: startsWith[0], confidence: 0.8, alternatives: startsWith.slice(1, 5) };
    }

    // 3. Contains
    const contains = options.filter(o =>
        o.label.toLowerCase().includes(normalized) ||
        o.value.toLowerCase().includes(normalized)
    );
    if (contains.length === 1) {
        return { option: contains[0], confidence: 0.75, alternatives: [] };
    }
    if (contains.length > 1) {
        return { option: contains[0], confidence: 0.7, alternatives: contains.slice(1, 5) };
    }

    // 4. Fuzzy match (Levenshtein distance)
    const fuzzyMatches = options.map(o => {
        const labelDistance = levenshteinDistance(normalized, o.label.toLowerCase());
        const valueDistance = levenshteinDistance(normalized, o.value.toLowerCase());
        const minDistance = Math.min(labelDistance, valueDistance);

        return {
            option: o,
            distance: minDistance,
            confidence: Math.max(0, 1 - (minDistance / Math.max(normalized.length, o.label.length)))
        };
    }).sort((a, b) => a.distance - b.distance);

    const bestMatch = fuzzyMatches[0];

    // Only return fuzzy match if confidence is reasonable
    if (bestMatch.confidence > 0.5) {
        return {
            option: bestMatch.option,
            confidence: bestMatch.confidence,
            alternatives: fuzzyMatches.slice(1, 6).map(m => m.option)
        };
    }

    // No good match found
    return {
        option: null,
        confidence: 0,
        alternatives: fuzzyMatches.slice(0, 5).map(m => m.option)
    };
}

/**
 * Filter options based on search query
 * @param {string} query - Search query
 * @param {Array} options - Array of {value, label} objects
 * @returns {Array} - Filtered options
 */
export function filterOptions(query, options) {
    if (!query || !query.trim()) {
        return options;
    }

    const normalized = query.toLowerCase().trim();

    return options.filter(option =>
        option.label.toLowerCase().includes(normalized) ||
        option.value.toLowerCase().includes(normalized)
    );
}
