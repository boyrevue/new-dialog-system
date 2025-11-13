/**
 * Phonetic Keyboard Component
 *
 * Virtual keyboard for spelling input with NATO phonetic alphabet support.
 * Used for fields like vehicle registration, email, names that need precise spelling.
 */

import React, { useState } from 'react';
import { Card, Button, Badge, Alert } from 'flowbite-react';
import { Delete, Space, HelpCircle, X, Check } from 'lucide-react';

// NATO Phonetic Alphabet
const NATO_ALPHABET = {
  'A': 'Alpha', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta',
  'E': 'Echo', 'F': 'Foxtrot', 'G': 'Golf', 'H': 'Hotel',
  'I': 'India', 'J': 'Juliet', 'K': 'Kilo', 'L': 'Lima',
  'M': 'Mike', 'N': 'November', 'O': 'Oscar', 'P': 'Papa',
  'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
  'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray',
  'Y': 'Yankee', 'Z': 'Zulu',
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three',
  '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven',
  '8': 'Eight', '9': 'Nine'
};

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const NUMBER_ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const PhoneticKeyboard = ({ value, onChange, onSubmit, placeholder = "Click letters or speak NATO codes", inputMode = null }) => {
  const [showNATOHelp, setShowNATOHelp] = useState(false);
  const [lastEnteredLetter, setLastEnteredLetter] = useState(null);
  const [showLetterConfirmation, setShowLetterConfirmation] = useState(false);

  // Extract input mode configuration
  const terminationKeyword = inputMode?.termination_keyword || "end";
  const timeoutSeconds = inputMode?.timeout_seconds || 5;
  const usesSpaceSeparator = inputMode?.uses_space_separator !== false;

  const handleLetterClick = (letter) => {
    const newValue = value + letter;
    onChange(newValue);
    setLastEnteredLetter(letter);
    setShowLetterConfirmation(true);

    // Auto-hide confirmation after 2 seconds
    setTimeout(() => {
      setShowLetterConfirmation(false);
    }, 2000);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleSpace = () => {
    onChange(value + ' ');
  };

  const handleClear = () => {
    onChange('');
    setShowLetterConfirmation(false);
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Alert color="info" className="text-sm">
        <div className="flex items-start gap-2">
          <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">How to spell accurately:</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Click letters one by one using the keyboard below</li>
              <li>Or speak NATO phonetic codes (e.g., "Alpha Bravo Charlie" for ABC)</li>
              {usesSpaceSeparator && (
                <li>When speaking: use SPACE between letters, say "{terminationKeyword}" when done</li>
              )}
              <li>Auto-completes after {timeoutSeconds} seconds of silence</li>
            </ul>
          </div>
        </div>
      </Alert>

      {/* Display Value */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
          className="w-full px-4 py-3 text-2xl font-mono tracking-widest text-center border-2 border-blue-500 rounded-lg bg-white uppercase"
        />
        {value && (
          <Button
            color="light"
            size="xs"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Letter Confirmation */}
      {showLetterConfirmation && lastEnteredLetter && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <span className="text-lg font-semibold text-green-900">
            {lastEnteredLetter} = {NATO_ALPHABET[lastEnteredLetter]}
          </span>
        </div>
      )}

      {/* Number Row */}
      <div className="flex gap-1 justify-center">
        {NUMBER_ROW.map((num) => (
          <Button
            key={num}
            color="light"
            size="sm"
            onClick={() => handleLetterClick(num)}
            className="w-12 h-12 text-lg font-semibold hover:bg-blue-50"
          >
            {num}
          </Button>
        ))}
      </div>

      {/* Keyboard Rows */}
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 justify-center">
          {row.map((letter) => (
            <Button
              key={letter}
              color="light"
              size="sm"
              onClick={() => handleLetterClick(letter)}
              className="w-12 h-12 text-lg font-semibold hover:bg-blue-50 relative group"
            >
              {letter}
              {/* Hover tooltip with NATO code */}
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <Badge color="info" size="xs">
                  {NATO_ALPHABET[letter]}
                </Badge>
              </div>
            </Button>
          ))}
        </div>
      ))}

      {/* Special Keys Row */}
      <div className="flex gap-2 justify-center">
        <Button
          color="gray"
          size="sm"
          onClick={handleSpace}
          className="px-6 h-12"
        >
          <Space className="w-4 h-4 mr-2" />
          Space
        </Button>
        <Button
          color="failure"
          size="sm"
          onClick={handleBackspace}
          className="px-6 h-12"
        >
          <Delete className="w-4 h-4 mr-2" />
          Backspace
        </Button>
        <Button
          color="blue"
          size="sm"
          onClick={() => setShowNATOHelp(!showNATOHelp)}
          className="px-6 h-12"
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          NATO Codes
        </Button>
      </div>

      {/* NATO Phonetic Alphabet Reference */}
      {showNATOHelp && (
        <Card className="bg-blue-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-blue-900">NATO Phonetic Alphabet</h3>
            <Button
              color="light"
              size="xs"
              onClick={() => setShowNATOHelp(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {Object.entries(NATO_ALPHABET).map(([letter, code]) => (
              <div
                key={letter}
                className="flex items-center gap-2 p-2 bg-white rounded border border-blue-200 hover:bg-blue-100 cursor-pointer"
                onClick={() => handleLetterClick(letter)}
              >
                <span className="font-bold text-blue-900 text-lg w-6">{letter}</span>
                <span className="text-gray-700">=</span>
                <span className="text-gray-600">{code}</span>
              </div>
            ))}
          </div>

          <Alert color="info" className="mt-3">
            <p className="text-xs">
              <strong>Tip:</strong> When speaking, say the NATO code clearly. For example:
              "Alpha Bravo One Two Charlie" will be recognized as "AB12C"
            </p>
          </Alert>
        </Card>
      )}

      {/* Submit Button */}
      {onSubmit && (
        <Button
          color="success"
          size="lg"
          onClick={onSubmit}
          disabled={!value}
          className="w-full"
        >
          <Check className="w-5 h-5 mr-2" />
          Confirm {value && `"${value}"`}
        </Button>
      )}
    </div>
  );
};

export default PhoneticKeyboard;
