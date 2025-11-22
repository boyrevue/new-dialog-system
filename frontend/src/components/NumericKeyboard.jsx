/**
 * Numeric Keyboard Component
 * Fullscreen/collapsible keyboard for numeric input
 * Supports digits 0-9, hyphen, space, and backspace
 */

import React, { useState } from 'react';
import { Maximize2, Minimize2, Delete } from 'lucide-react';
import { Button } from 'flowbite-react';

const NumericKeyboard = ({ value = '', onChange, onSubmit }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Handle digit press
  const handleDigitPress = (digit) => {
    const newValue = inputValue + digit;
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

  // Keyboard rows (numeric layout)
  const keyboardRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0']
  ];

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center p-8'
    : 'relative bg-white border-2 border-gray-300 rounded-lg p-4';

  const keyboardClass = isFullscreen
    ? 'w-full max-w-2xl'
    : 'w-full max-w-md';

  const keyClass = isFullscreen
    ? 'flex items-center justify-center p-8 bg-white hover:bg-blue-100 active:bg-blue-200 rounded-xl border-2 border-gray-300 shadow-lg cursor-pointer transition-all transform hover:scale-105 active:scale-95 text-5xl font-bold text-gray-900'
    : 'flex items-center justify-center p-4 bg-white hover:bg-blue-100 active:bg-blue-200 rounded-lg border-2 border-gray-300 shadow cursor-pointer transition-all text-2xl font-bold text-gray-900';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-4 ${isFullscreen ? 'w-full max-w-2xl' : 'w-full'}`}>
        <h3 className={`font-bold ${isFullscreen ? 'text-white text-2xl' : 'text-gray-900 text-lg'}`}>
          Numeric Keyboard
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
      <div className={`mb-6 ${isFullscreen ? 'w-full max-w-2xl' : 'w-full'}`}>
        <div className={`bg-gray-100 border-2 border-gray-300 rounded-lg p-4 ${isFullscreen ? 'text-4xl' : 'text-2xl'} font-mono text-gray-900 min-h-16 text-center`}>
          {inputValue || (
            <span className="text-gray-400">Enter numbers...</span>
          )}
        </div>
      </div>

      {/* Keyboard */}
      <div className={keyboardClass}>
        {/* Digit Rows */}
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className={`flex gap-3 mb-3 ${rowIndex === 3 ? 'justify-center' : ''}`}>
            {row.map((digit) => (
              <div
                key={digit}
                className={`${keyClass} ${rowIndex === 3 ? 'flex-1 max-w-xs' : 'flex-1'}`}
                onClick={() => handleDigitPress(digit)}
              >
                {digit}
              </div>
            ))}
          </div>
        ))}

        {/* Special Keys Row */}
        <div className="flex gap-3 mt-6">
          {/* Hyphen */}
          <div
            className={`${keyClass} flex-1`}
            onClick={handleHyphen}
          >
            -
          </div>

          {/* Space */}
          <div
            className={`${keyClass} flex-1`}
            onClick={handleSpace}
          >
            <span className={isFullscreen ? 'text-2xl' : 'text-base'}>SPACE</span>
          </div>

          {/* Backspace */}
          <div
            className={`${keyClass} flex-1 bg-red-50 hover:bg-red-100 active:bg-red-200`}
            onClick={handleBackspace}
          >
            <Delete className={`${isFullscreen ? 'w-12 h-12' : 'w-8 h-8'} text-red-600`} />
          </div>
        </div>

        {/* Submit Button */}
        {onSubmit && (
          <div className="flex justify-center mt-8">
            <Button
              color="success"
              size={isFullscreen ? 'xl' : 'lg'}
              onClick={handleSubmit}
              className="w-full"
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
            <strong>Numeric Keyboard</strong> - Click any key to enter digits
          </p>
          <p className="text-gray-400">
            Supports digits 0-9, hyphen (-), space, and backspace/delete
          </p>
        </div>
      )}
    </div>
  );
};

export default NumericKeyboard;
