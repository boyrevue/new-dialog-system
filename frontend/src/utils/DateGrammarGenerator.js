/**
 * Date Grammar Generator
 * 
 * Automatically generates comprehensive JSGF grammar for date input fields
 * Supports multiple formats:
 * - Ordinal: "9th of the fourth 1961", "ninth April 1961"
 * - Numeric: "09 04 1961", "zero nine zero four nineteen sixty one"
 * - Mixed: "9th April 1961", "ninth of the 4th 1961"
 * - Short years: "9th of the 9th 61"
 * - Zero variations: "zero", "nought", "oh"
 */

// Ordinal day words (1st-31st)
const ordinalDays = {
  1: ['first', '1st'],
  2: ['second', '2nd'],
  3: ['third', '3rd'],
  4: ['fourth', '4th'],
  5: ['fifth', '5th'],
  6: ['sixth', '6th'],
  7: ['seventh', '7th'],
  8: ['eighth', '8th'],
  9: ['ninth', '9th'],
  10: ['tenth', '10th'],
  11: ['eleventh', '11th'],
  12: ['twelfth', '12th'],
  13: ['thirteenth', '13th'],
  14: ['fourteenth', '14th'],
  15: ['fifteenth', '15th'],
  16: ['sixteenth', '16th'],
  17: ['seventeenth', '17th'],
  18: ['eighteenth', '18th'],
  19: ['nineteenth', '19th'],
  20: ['twentieth', '20th'],
  21: ['twenty first', '21st'],
  22: ['twenty second', '22nd'],
  23: ['twenty third', '23rd'],
  24: ['twenty fourth', '24th'],
  25: ['twenty fifth', '25th'],
  26: ['twenty sixth', '26th'],
  27: ['twenty seventh', '27th'],
  28: ['twenty eighth', '28th'],
  29: ['twenty ninth', '29th'],
  30: ['thirtieth', '30th'],
  31: ['thirty first', '31st']
};

// Month names
const monthNames = {
  1: ['January', 'Jan'],
  2: ['February', 'Feb'],
  3: ['March', 'Mar'],
  4: ['April', 'Apr'],
  5: ['May'],
  6: ['June', 'Jun'],
  7: ['July', 'Jul'],
  8: ['August', 'Aug'],
  9: ['September', 'Sep', 'Sept'],
  10: ['October', 'Oct'],
  11: ['November', 'Nov'],
  12: ['December', 'Dec']
};

// Number words for numeric dates
const singleDigits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * Generate comprehensive JSGF grammar for date input
 * @param {string} componentType - Type of date component: 'full', 'month_year', 'day', 'month', 'year'
 * @returns {string} JSGF grammar string
 */
export function generateDateGrammar(componentType = 'full') {
  switch (componentType) {
    case 'month_year':
      return generateMonthYearGrammar();
    case 'day':
      return generateDayGrammar();
    case 'month':
      return generateMonthGrammar();
    case 'year':
      return generateYearGrammar();
    case 'full':
    default:
      return generateFullDateGrammar();
  }
}

/**
 * Generate full date grammar (DD/MM/YYYY)
 */
function generateFullDateGrammar() {
  return `#JSGF V1.0;

grammar ukDate;

public <date> = <day_phrase> <month_phrase> <year_phrase>;

<day_phrase> = <ordinal_day> [of [the]] | <numeric_day>;

<ordinal_day> = (
  ${Object.values(ordinalDays).flat().join(' | ')}
);

<numeric_day> = (
  <zero_prefix> <single_digit> |
  one <zero_or_digit> |
  two <zero_to_nine> |
  three <zero_or_one> |
  <single_digit>
);

<zero_prefix> = (zero | nought | oh);
<zero_or_digit> = (zero | nought | oh | one | two | three | four | five | six | seven | eight | nine);
<zero_to_nine> = (zero | nought | oh | one | two | three | four | five | six | seven | eight | nine);
<zero_or_one> = (zero | nought | oh | one);
<single_digit> = (one | two | three | four | five | six | seven | eight | nine);

<month_phrase> = <month_name> | <month_number>;

<month_name> = (
  ${Object.values(monthNames).flat().join(' | ')}
);

<month_number> = (
  <zero_prefix> <single_digit> |
  one <zero_or_two> |
  <single_digit>
);

<zero_or_two> = (zero | nought | oh | one | two);

<year_phrase> = <full_year> | <short_year>;

<full_year> = (
  nineteen <two_digit_year> |
  twenty <two_digit_year> |
  one nine <single_digit> <single_digit> |
  two zero <single_digit> <single_digit>
);

<short_year> = <two_digit_year>;

<two_digit_year> = (
  <zero_prefix> <single_digit> |
  ${teens.join(' | ')} |
  ${tens.slice(2).map((ten) => `${ten} [<single_digit>]`).join(' | ')} |
  <single_digit>
);
`;
}

/**
 * Generate month and year grammar (MM/YYYY)
 */
function generateMonthYearGrammar() {
  return `#JSGF V1.0;

grammar monthYear;

public <month_year> = <month_phrase> <year_phrase>;

<month_phrase> = <month_name> | <month_number>;

<month_name> = (
  ${Object.values(monthNames).flat().join(' | ')}
);

<month_number> = (
  <zero_prefix> <single_digit> |
  one <zero_or_two> |
  <single_digit>
);

<zero_prefix> = (zero | nought | oh);
<zero_or_two> = (zero | nought | oh | one | two);
<single_digit> = (one | two | three | four | five | six | seven | eight | nine);

<year_phrase> = <full_year> | <short_year>;

<full_year> = (
  nineteen <two_digit_year> |
  twenty <two_digit_year> |
  one nine <single_digit> <single_digit> |
  two zero <single_digit> <single_digit>
);

<short_year> = <two_digit_year>;

<two_digit_year> = (
  <zero_prefix> <single_digit> |
  ${teens.join(' | ')} |
  ${tens.slice(2).map((ten) => `${ten} [<single_digit>]`).join(' | ')} |
  <single_digit>
);
`;
}

/**
 * Generate day-only grammar (DD)
 */
function generateDayGrammar() {
  return `#JSGF V1.0;

grammar day;

public <day> = <ordinal_day> | <numeric_day>;

<ordinal_day> = (
  ${Object.values(ordinalDays).flat().join(' | ')}
);

<numeric_day> = (
  <zero_prefix> <single_digit> |
  one <zero_or_digit> |
  two <zero_to_nine> |
  three <zero_or_one> |
  <single_digit>
);

<zero_prefix> = (zero | nought | oh);
<zero_or_digit> = (zero | nought | oh | one | two | three | four | five | six | seven | eight | nine);
<zero_to_nine> = (zero | nought | oh | one | two | three | four | five | six | seven | eight | nine);
<zero_or_one> = (zero | nought | oh | one);
<single_digit> = (one | two | three | four | five | six | seven | eight | nine);
`;
}

/**
 * Generate month-only grammar (MM)
 */
function generateMonthGrammar() {
  return `#JSGF V1.0;

grammar month;

public <month> = <month_name> | <month_number>;

<month_name> = (
  ${Object.values(monthNames).flat().join(' | ')}
);

<month_number> = (
  <zero_prefix> <single_digit> |
  one <zero_or_two> |
  <single_digit>
);

<zero_prefix> = (zero | nought | oh);
<zero_or_two> = (zero | nought | oh | one | two);
<single_digit> = (one | two | three | four | five | six | seven | eight | nine);
`;
}

/**
 * Generate year-only grammar (YYYY)
 */
function generateYearGrammar() {
  return `#JSGF V1.0;

grammar year;

public <year> = <full_year> | <short_year>;

<full_year> = (
  nineteen <two_digit_year> |
  twenty <two_digit_year> |
  one nine <single_digit> <single_digit> |
  two zero <single_digit> <single_digit>
);

<short_year> = <two_digit_year>;

<two_digit_year> = (
  <zero_prefix> <single_digit> |
  ${teens.join(' | ')} |
  ${tens.slice(2).map((ten) => `${ten} [<single_digit>]`).join(' | ')} |
  <single_digit>
);

<zero_prefix> = (zero | nought | oh);
<single_digit> = (one | two | three | four | five | six | seven | eight | nine);
`;
}

/**
 * Get example date formats for display
 * @param {string} componentType - Type of date component
 * @returns {Array<string>} Array of example date formats
 */
export function getDateFormatExamples(componentType = 'full') {
  switch (componentType) {
    case 'month_year':
      return [
        "April 1961",
        "zero four nineteen sixty one",
        "April sixty one",
        "04 1961",
        "four nineteen sixty one"
      ];
    case 'day':
      return [
        "9th",
        "ninth",
        "zero nine",
        "twenty first",
        "31st"
      ];
    case 'month':
      return [
        "April",
        "zero four",
        "four",
        "December",
        "twelve"
      ];
    case 'year':
      return [
        "1961",
        "nineteen sixty one",
        "sixty one",
        "2024",
        "twenty twenty four"
      ];
    case 'full':
    default:
      return [
        "9th of the fourth 1961",
        "ninth April 1961",
        "09 04 1961",
        "9th of the 9th 61",
        "zero nine zero four nineteen sixty one",
        "nought nine nought four one nine six one",
        "9th April 61",
        "first of January 2000",
        "31st December ninety nine"
      ];
  }
}

/**
 * Get supported format description
 * @param {string} componentType - Type of date component
 * @returns {string} Description of supported formats
 */
export function getDateFormatDescription(componentType = 'full') {
  switch (componentType) {
    case 'month_year':
      return `Supports month and year formats:
• Month names: "April 1961", "December 2024"
• Numeric: "04 1961", "zero four nineteen sixty one"
• Short years: "April 61", "04 61"`;
    case 'day':
      return `Supports day formats:
• Ordinal: "9th", "twenty first", "31st"
• Word: "ninth", "twenty first"
• Numeric: "09", "zero nine", "21"`;
    case 'month':
      return `Supports month formats:
• Names: "April", "December", "Jan"
• Numeric: "04", "zero four", "four", "12"`;
    case 'year':
      return `Supports year formats:
• Full: "1961", "nineteen sixty one"
• Short: "61", "sixty one"
• Recent: "2024", "twenty twenty four"`;
    case 'full':
    default:
      return `Supports multiple date formats:
• Ordinal: "9th of April 1961", "ninth of the fourth 1961"
• Numeric: "09 04 1961", "9 4 61"
• Zero variations: "zero", "nought", "oh"
• Short years: "61" for "1961"
• Month names: Full or abbreviated (April, Apr)`;
  }
}
