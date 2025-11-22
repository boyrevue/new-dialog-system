/**
 * Alpha Keyboard Component
 * Fullscreen/collapsible NATO phonetic alphabet keyboard
 * Shows keys with alpha codes underneath
 */

import React, { useState } from 'react';
import { Maximize2, Minimize2, Delete } from 'lucide-react';
import { Button } from 'flowbite-react';

// NATO phonetic alphabet mapping
const NATO_ALPHABET = {
  'A': 'Alpha',
  'B': 'Bravo',
  'C': 'Charlie',
  'D': 'Delta',
  'E': 'Echo',
  'F': 'Foxtrot',
  'G': 'Golf',
  'H': 'Hotel',
  'I': 'India',
  'J': 'Juliet',
  'K': 'Kilo',
  'L': 'Lima',
  'M': 'Mike',
  'N': 'November',
  'O': 'Oscar',
  'P': 'Papa',
  'Q': 'Quebec',
  'R': 'Romeo',
  'S': 'Sierra',
  'T': 'Tango',
  'U': 'Uniform',
  'V': 'Victor',
  'W': 'Whiskey',
  'X': 'X-ray',
  'Y': 'Yankee',
  'Z': 'Zulu'
};

const AlphaKeyboard = ({ value = '', onChange, onSubmit }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Handle key press
  const handleKeyPress = (letter) => {
    const newValue = inputValue + letter;
    setInputValue(newValue);
    if (onChange) onChange(newValue);
  };

  // Handle space
  const handleSpace = () => {
    const newValue = inputValue + ' ';
    setInputValue(newValue);
    if (onChange) onChange(newValue);
  };

  // Handle hyphen
  const handleHyphen = () => {
    const newValue = inputValue + '-';
    setInputValue(newValue);
    if (onChange) onChange(newValue);
  };

  // Handle backspace
  const handleBackspace = () => {
    const newValue = inputValue.slice(0, -1);
    setInputValue(newValue);
    if (onChange) onChange(newValue);
  };

  // Handle submit
  const handleSubmit = () => {
    if (onSubmit) onSubmit(inputValue);
  };

  // Keyboard rows (QWERTY layout)
  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center p-8'
    : 'relative bg-white border-2 border-gray-300 rounded-lg p-4';

  const keyboardClass = isFullscreen
    ? 'w-full max-w-6xl'
    : 'w-full';

  const keyClass = isFullscreen
    ? 'flex flex-col items-center justify-center p-6 bg-white hover:bg-blue-100 active:bg-blue-200 rounded-xl border-2 border-gray-300 shadow-lg cursor-pointer transition-all transform hover:scale-105 active:scale-95'
    : 'flex flex-col items-center justify-center p-3 bg-white hover:bg-blue-100 active:bg-blue-200 rounded-lg border-2 border-gray-300 shadow cursor-pointer transition-all';

  const letterClass = isFullscreen
    ? 'text-4xl font-bold text-gray-900'
    : 'text-xl font-bold text-gray-900';

  const natoClass = isFullscreen
    ? 'text-sm text-gray-600 mt-1'
    : 'text-xs text-gray-600 mt-1';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-4 ${isFullscreen ? 'w-full max-w-6xl' : 'w-full'}`}>
        <h3 className={`font-bold ${isFullscreen ? 'text-white text-2xl' : 'text-gray-900 text-lg'}`}>
          NATO Phonetic Alphabet Keyboard
        </h3>
        <Button
          size="sm"
          color="gray"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4 mr-2" />
              Exit Fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4 mr-2" />
              Fullscreen
            </>
          )}
        </Button>
      </div>

      {/* Input Display */}
      <div className={`mb-6 ${isFullscreen ? 'w-full max-w-6xl' : 'w-full'}`}>
        <div className={`bg-gray-100 border-2 border-gray-300 rounded-lg p-4 ${isFullscreen ? 'text-3xl' : 'text-xl'} font-mono text-gray-900 min-h-16`}>
          {inputValue || (
            <span className="text-gray-400">Type using the keyboard below...</span>
          )}
        </div>
      </div>

      {/* Keyboard */}
      <div className={keyboardClass}>
        {/* Letter Rows */}
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className={`flex gap-2 mb-2 ${rowIndex === 1 ? 'ml-8' : rowIndex === 2 ? 'ml-16' : ''}`}>
            {row.map((letter) => (
              <div
                key={letter}
                className={keyClass}
                onClick={() => handleKeyPress(letter)}
              >
                <div className={letterClass}>{letter}</div>
                <div className={natoClass}>{NATO_ALPHABET[letter]}</div>
              </div>
            ))}
          </div>
        ))}

        {/* Special Keys Row */}
        <div className="flex gap-2 mt-4 justify-center">
          {/* Space */}
          <div
            className={`${keyClass} flex-1 max-w-md`}
            onClick={handleSpace}
          >
            <div className={letterClass}>SPACE</div>
          </div>

          {/* Hyphen */}
          <div
            className={keyClass}
            onClick={handleHyphen}
          >
            <div className={letterClass}>-</div>
            <div className={natoClass}>Hyphen</div>
          </div>

          {/* Backspace */}
          <div
            className={keyClass}
            onClick={handleBackspace}
          >
            <Delete className={`${isFullscreen ? 'w-8 h-8' : 'w-6 h-6'} text-red-600`} />
            <div className={natoClass}>Delete</div>
          </div>
        </div>

        {/* Submit Button */}
        {onSubmit && (
          <div className="flex justify-center mt-6">
            <Button
              color="success"
              size={isFullscreen ? 'xl' : 'lg'}
              onClick={handleSubmit}
            >
              Submit
            </Button>
          </div>
        )}
      </div>

      {/* Instructions */}
      {isFullscreen && (
        <div className="mt-8 text-center text-white text-sm max-w-2xl">
          <p className="mb-2">
            <strong>NATO Phonetic Alphabet</strong> - Click any key to type the letter
          </p>
          <p className="text-gray-400">
            Each key shows the letter and its NATO phonetic code word below (e.g., A = Alpha, B = Bravo)
          </p>
        </div>
      )}
    </div>
  );
};

export default AlphaKeyboard;
