/**
 * VirtualKeyboard Component
 *
 * On-screen keyboard with NATO phonetic alphabet support
 * For spelling out names and other text fields letter by letter
 */

import React, { useState } from 'react';
import { X, Delete, Space, Check } from 'lucide-react';

const NATO_PHONETIC = {
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

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const NUMERIC_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0']
];

const VirtualKeyboard = ({
  value = '',
  onValueChange,
  onClose,
  onSubmit,
  showPhonetic = true,
  keyboardType = 'alphanumeric', // 'alphanumeric' or 'numeric'
  placeholder = 'Type using keyboard or voice...',
  onSpeechRecognized // callback for ASR-driven key presses
}) => {
  const [currentValue, setCurrentValue] = useState(value);
  const [lastKey, setLastKey] = useState(null);
  const [pressedKey, setPressedKey] = useState(null); // for visual feedback
  const audioContextRef = React.useRef(null);

  // Play click sound
  const playClickSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.05);
    } catch (err) {
      console.log('Could not play click sound:', err);
    }
  };

  const handleKeyPress = (key, fromSpeech = false) => {
    console.log('🔤 Key pressed:', key, fromSpeech ? '(via speech)' : '(via click)');

    // Visual feedback
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 200);

    // Play click sound
    playClickSound();

    const newValue = currentValue + key;
    setCurrentValue(newValue);
    setLastKey(key);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const handleBackspace = () => {
    const newValue = currentValue.slice(0, -1);
    setCurrentValue(newValue);
    setLastKey(null);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const handleSpace = () => {
    const newValue = currentValue + ' ';
    setCurrentValue(newValue);
    setLastKey(' ');
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const handleClear = () => {
    setCurrentValue('');
    setLastKey(null);
    if (onValueChange) {
      onValueChange('');
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(currentValue);
    }
    if (onClose) {
      onClose();
    }
  };

  const getPhoneticForLetter = (letter) => {
    return NATO_PHONETIC[letter.toUpperCase()] || '';
  };

  // Process speech recognition result
  React.useEffect(() => {
    if (!onSpeechRecognized) return;

    const processSpokenText = (spokenText) => {
      const text = spokenText.toLowerCase().trim();
      console.log('🎤 Processing spoken text:', text);

      // Split by spaces to handle multiple words (e.g., "alpha bravo charlie")
      const words = text.split(/\s+/);
      console.log('🎤 Split into words:', words);

      let anyWordHandled = false;

      for (const word of words) {
        if (!word) continue;

        console.log('🎤 Processing word:', word);

        // Check for delete/backspace commands
        if (word === 'delete' || word === 'backspace' || word === 'clear') {
          handleBackspace();
          anyWordHandled = true;
          continue;
        }

        // Check for space
        if (word === 'space') {
          handleSpace();
          anyWordHandled = true;
          continue;
        }

        // Check for NATO phonetic alphabet
        let matched = false;
        for (const [letter, phonetic] of Object.entries(NATO_PHONETIC)) {
          if (word === phonetic.toLowerCase() || word === letter.toLowerCase()) {
            console.log(`✅ Matched "${word}" to letter ${letter}`);
            handleKeyPress(letter, true);
            anyWordHandled = true;
            matched = true;
            break;
          }
        }

        if (matched) continue;

        // Check for numbers (if numeric keyboard)
        if (keyboardType === 'numeric' && /^[0-9]$/.test(word)) {
          handleKeyPress(word, true);
          anyWordHandled = true;
          continue;
        }

        console.log('⚠️ Could not match word to any key:', word);
      }

      if (!anyWordHandled) {
        console.log('❌ No words were matched in:', text);
      }

      return anyWordHandled;
    };

    onSpeechRecognized(processSpokenText);
  }, [onSpeechRecognized, keyboardType]);

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Virtual Keyboard</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          title="Close keyboard"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Input Display */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={currentValue}
            onChange={(e) => {
              setCurrentValue(e.target.value);
              if (onValueChange) onValueChange(e.target.value);
            }}
            placeholder={placeholder}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />
          {currentValue && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* NATO Phonetic Display */}
        {showPhonetic && lastKey && lastKey !== ' ' && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Last letter:</div>
            <div className="text-lg font-bold text-blue-800">
              {lastKey.toUpperCase()} - {getPhoneticForLetter(lastKey)}
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Layout */}
      <div className="space-y-2 mb-4">
        {keyboardType === 'numeric' ? (
          // Numeric Keyboard Layout
          <div className="flex flex-col items-center gap-2">
            {NUMERIC_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-2">
                {row.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="w-20 h-16 bg-white hover:bg-blue-50 border-2 border-gray-300 hover:border-blue-400 rounded-lg font-bold text-2xl text-gray-800 transition-all active:scale-95"
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          // Alphanumeric Keyboard Layout
          KEYBOARD_ROWS.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex justify-center gap-1"
              style={{ paddingLeft: rowIndex === 1 ? '20px' : rowIndex === 2 ? '40px' : '0' }}
            >
              {row.map((key) => {
                const isPressed = pressedKey === key;
                const phonetic = getPhoneticForLetter(key);

                return (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className={`relative w-14 h-16 border-2 rounded-lg font-semibold transition-all group ${
                      isPressed
                        ? 'bg-blue-500 border-blue-600 text-white scale-95'
                        : 'bg-white hover:bg-blue-50 border-gray-300 hover:border-blue-400 text-gray-800 active:scale-95'
                    }`}
                    title={`${key} - ${phonetic}`}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className={`text-xl font-bold ${isPressed ? 'text-white' : 'text-gray-800'}`}>
                        {key}
                      </span>
                      {showPhonetic && (
                        <span className={`text-[9px] font-medium mt-0.5 ${
                          isPressed ? 'text-blue-100' : 'text-gray-500 group-hover:text-blue-600'
                        }`}>
                          {phonetic}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Bottom Row - Special Keys */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleBackspace}
          className="flex-1 flex items-center justify-center gap-2 h-12 bg-orange-100 hover:bg-orange-200 border-2 border-orange-300 hover:border-orange-400 rounded-lg font-semibold text-orange-800 transition-all active:scale-95"
          title="Backspace"
        >
          <Delete className="w-5 h-5" />
          <span>Delete</span>
        </button>
        <button
          onClick={handleSpace}
          className="flex-[2] flex items-center justify-center gap-2 h-12 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 hover:border-gray-400 rounded-lg font-semibold text-gray-800 transition-all active:scale-95"
          title="Space"
        >
          <Space className="w-5 h-5" />
          <span>Space</span>
        </button>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!currentValue.trim()}
        className={`w-full flex items-center justify-center gap-2 h-12 rounded-lg font-semibold transition-all ${
          currentValue.trim()
            ? 'bg-green-600 hover:bg-green-700 text-white active:scale-95'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <Check className="w-5 h-5" />
        <span>Submit</span>
      </button>

      {/* NATO Alphabet Reference */}
      {showPhonetic && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-600 mb-2">NATO Phonetic Alphabet:</div>
          <div className="grid grid-cols-5 gap-1 text-xs text-gray-600">
            {Object.entries(NATO_PHONETIC).map(([letter, word]) => (
              <div key={letter} className="truncate" title={`${letter} - ${word}`}>
                <span className="font-semibold">{letter}</span>: {word}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualKeyboard;
