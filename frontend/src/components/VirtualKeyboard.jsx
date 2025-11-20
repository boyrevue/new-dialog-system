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

// Phonetic similarity groups - letters that sound similar and are often confused
const PHONETIC_SIMILARITY_GROUPS = {
  // Plosive sounds (often confused)
  'B': ['B', 'V', 'P', 'D'],
  'V': ['V', 'B', 'F'],
  'P': ['P', 'B', 'T'],
  'D': ['D', 'B', 'T'],
  'T': ['T', 'D', 'P'],

  // Nasal sounds
  'M': ['M', 'N'],
  'N': ['N', 'M'],

  // Fricatives
  'F': ['F', 'V', 'S'],
  'S': ['S', 'F', 'Z'],
  'Z': ['Z', 'S'],

  // Sibilants
  'C': ['C', 'S', 'K'],
  'K': ['K', 'C', 'G'],
  'G': ['G', 'K', 'J'],
  'J': ['J', 'G'],

  // Similar vowels
  'I': ['I', 'E', 'Y'],
  'E': ['E', 'I', 'A'],
  'A': ['A', 'E', 'O'],
  'O': ['O', 'A', 'U'],
  'U': ['U', 'O'],
  'Y': ['Y', 'I'],

  // Liquids
  'L': ['L', 'R'],
  'R': ['R', 'L'],

  // Other
  'Q': ['Q', 'K'],
  'W': ['W', 'V'],
  'X': ['X', 'S'],
  'H': ['H']
};

// Get phonetically similar letters for a given letter
const getPhoneticallySimilar = (letter) => {
  return PHONETIC_SIMILARITY_GROUPS[letter.toUpperCase()] || [letter.toUpperCase()];
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
  // Remove internal state - use value prop directly (controlled component)
  const [lastKey, setLastKey] = useState(null);
  const [pressedKey, setPressedKey] = useState(null); // for visual feedback
  const audioContextRef = React.useRef(null);

  // Clear input field when component mounts
  React.useEffect(() => {
    if (onValueChange) {
      onValueChange('');
      console.log('🧹 Virtual keyboard input cleared');
    }
  }, []);

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

    // Visual feedback - longer timeout for speech recognition visibility
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), fromSpeech ? 800 : 200);

    // Play click sound
    playClickSound();

    setLastKey(key);
    if (onValueChange) {
      // Functional update ensures correct accumulation within same event loop tick
      onValueChange(prev => {
        const newValue = (prev ?? '') + key;
        currentValueRef.current = newValue; // Keep ref in sync
        return newValue;
      });
    }
  };

  const handleBackspace = () => {
    setLastKey(null);
    if (onValueChange) {
      onValueChange(prev => {
        const newValue = (prev ?? '').slice(0, -1);
        currentValueRef.current = newValue; // Keep ref in sync
        return newValue;
      });
    }
  };

  const handleSpace = () => {
    setLastKey(' ');
    if (onValueChange) {
      onValueChange(prev => {
        const newValue = (prev ?? '') + ' ';
        currentValueRef.current = newValue; // Keep ref in sync
        return newValue;
      });
    }
  };

  const handleClear = () => {
    setLastKey(null);
    if (onValueChange) {
      onValueChange(() => '');
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(value);
    }
    if (onClose) {
      onClose();
    }
  };

  const getPhoneticForLetter = (letter) => {
    return NATO_PHONETIC[letter.toUpperCase()] || '';
  };

  // Keep internal ref of current value to avoid prop update lag
  const currentValueRef = React.useRef(value);

  // Update ref whenever value prop changes
  React.useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  // Process speech recognition result
  React.useEffect(() => {
    if (!onSpeechRecognized) return;

    const processSpokenText = async (spokenText) => {
      const text = spokenText.toLowerCase().trim();
      console.log('🎤 Processing spoken text:', text);

      // Check for change/swap commands first
      // Patterns: "change B for V", "change the D for V", "change the first B for V", "swap B for V"
      // Also handles common speech recognition errors: "james" (instead of "change"), "chains", etc.
      // Skip articles "a" and "an" before the target letter
      const changePattern = /(?:change|swap|james|chains|jane|changed)(?:\s+the)?(?:\s+(first|last|def|deaf|death))?\s+([a-z]|alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|x-ray|yankee|zulu)\s+(?:for|to|with|of|off)(?:\s+(?:a|an|av))?\s+([a-z]|alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|x-ray|yankee|zulu)/i;

      const changeMatch = text.match(changePattern);
      if (changeMatch) {
        let position = changeMatch[1]; // 'first', 'last', 'def', 'deaf', 'death', or undefined (all)
        const fromLetter = changeMatch[2];
        const toLetter = changeMatch[3];

        // Normalize common mis-transcriptions of "first"
        if (position && ['def', 'deaf', 'death'].includes(position.toLowerCase())) {
          position = 'first';
        }

        console.log(`🔄 Change command detected: position=${position}, from=${fromLetter}, to=${toLetter}`);

        // Convert NATO phonetic to letter
        const getLetterFromPhonetic = (word) => {
          for (const [letter, phonetic] of Object.entries(NATO_PHONETIC)) {
            if (word.toLowerCase() === phonetic.toLowerCase() || word.toLowerCase() === letter.toLowerCase()) {
              return letter;
            }
          }
          return word.toUpperCase();
        };

        const from = getLetterFromPhonetic(fromLetter);
        const to = getLetterFromPhonetic(toLetter);

        console.log(`🔄 Replacing: ${from} → ${to} (position: ${position || 'all'})`);

        // Use ref to get most current value (avoids prop update lag)
        const currentValue = currentValueRef.current || '';
        console.log(`🔄 Current value: "${currentValue}"`);
        let newValue = currentValue;

        if (position === 'first') {
          // Replace first occurrence
          newValue = currentValue.replace(new RegExp(from, 'i'), to);
        } else if (position === 'last') {
          // Replace last occurrence
          const lastIndex = currentValue.toUpperCase().lastIndexOf(from);
          if (lastIndex !== -1) {
            newValue = currentValue.substring(0, lastIndex) + to + currentValue.substring(lastIndex + 1);
          }
        } else {
          // Replace all occurrences
          newValue = currentValue.replace(new RegExp(from, 'gi'), to);
        }

        if (newValue !== currentValue) {
          console.log(`✅ Changed: "${currentValue}" → "${newValue}"`);
          if (onValueChange) {
            onValueChange(newValue);
          }
          return true;
        } else {
          console.log(`⚠️ No changes made - letter "${from}" not found`);
          return false;
        }
      }

      // Check for insert commands
      // Patterns: "insert A at the beginning", "insert B at the end"
      // Also handles: "insert alpha at the beginning", "insert bravo at the end"
      // Common ASR errors: "in cert" → "insert", "cert" → "insert"
      const insertBeginningPattern = /(?:insert|in cert|cert)(?:\s+(?:a|an))?\s+([a-z]|alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|x-ray|yankee|zulu)\s+(?:at\s+)?(?:the\s+)?(?:beginning|start|front)/i;

      const insertEndPattern = /(?:insert|in cert|cert)(?:\s+(?:a|an))?\s+([a-z]|alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|x-ray|yankee|zulu)\s+(?:at\s+)?(?:the\s+)?(?:end|back)/i;

      const insertBeginningMatch = text.match(insertBeginningPattern);
      const insertEndMatch = text.match(insertEndPattern);

      if (insertBeginningMatch || insertEndMatch) {
        const isBeginning = !!insertBeginningMatch;
        const letter = isBeginning ? insertBeginningMatch[1] : insertEndMatch[1];

        console.log(`➕ Insert command detected: ${isBeginning ? 'beginning' : 'end'}, letter=${letter}`);

        // Convert NATO phonetic to letter
        const getLetterFromPhonetic = (word) => {
          for (const [l, phonetic] of Object.entries(NATO_PHONETIC)) {
            if (word.toLowerCase() === phonetic.toLowerCase() || word.toLowerCase() === l.toLowerCase()) {
              return l;
            }
          }
          return word.toUpperCase();
        };

        const letterToInsert = getLetterFromPhonetic(letter);
        console.log(`➕ Inserting: ${letterToInsert} at ${isBeginning ? 'beginning' : 'end'}`);

        // Use ref to get most current value (avoids prop update lag)
        const currentValue = currentValueRef.current || '';
        console.log(`➕ Current value: "${currentValue}"`);

        let newValue;
        if (isBeginning) {
          newValue = letterToInsert + currentValue;
        } else {
          newValue = currentValue + letterToInsert;
        }

        console.log(`✅ Inserted: "${currentValue}" → "${newValue}"`);
        if (onValueChange) {
          onValueChange(newValue);
        }
        return true;
      }

      // Split by spaces to handle multiple words (e.g., "alpha bravo charlie")
      const words = text.split(/\s+/);
      console.log('🎤 Split into words:', words);

      let anyWordHandled = false;

      // Process words sequentially with delay for visual feedback
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word) continue;

        console.log('🎤 Processing word:', word);

        // Check for delete/backspace commands
        if (word === 'delete' || word === 'backspace' || word === 'clear') {
          handleBackspace();
          anyWordHandled = true;
          // Add delay before next word
          if (i < words.length - 1) await new Promise(resolve => setTimeout(resolve, 150));
          continue;
        }

        // Check for space
        if (word === 'space') {
          handleSpace();
          anyWordHandled = true;
          // Add delay before next word
          if (i < words.length - 1) await new Promise(resolve => setTimeout(resolve, 150));
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
            // Add delay before next word to show visual feedback
            if (i < words.length - 1) await new Promise(resolve => setTimeout(resolve, 150));
            break;
          }
        }

        if (matched) continue;

        // Check for numbers (if numeric keyboard)
        if (keyboardType === 'numeric' && /^[0-9]$/.test(word)) {
          handleKeyPress(word, true);
          anyWordHandled = true;
          // Add delay before next word
          if (i < words.length - 1) await new Promise(resolve => setTimeout(resolve, 150));
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

      {/* Instructions */}
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <div className="text-sm font-semibold text-blue-900 mb-2">How to enter your answer:</div>
        <ul className="text-xs text-blue-800 space-y-1">
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">1.</span>
            <span><strong>Voice spell</strong> letter by letter (e.g., say "V I N C E N T")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">2.</span>
            <span><strong>Use NATO alphabet</strong> (e.g., say "Victor India November Charlie Echo November Tango")</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">3.</span>
            <span><strong>Type manually</strong> using the on-screen keyboard or your physical keyboard</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">4.</span>
            <span><strong>Fix mistakes</strong> by saying "change B for V" or "change the first B for V"</span>
          </li>
        </ul>
        <div className="mt-2 pt-2 border-t border-blue-300 text-xs text-blue-700">
          <div className="font-medium mb-1">When finished, click the green <strong>Submit</strong> button below</div>
          <div className="text-blue-600 italic">
            💡 Tip: The system recognizes phonetically similar letters (B/V, M/N, F/S) for easier corrections
          </div>
        </div>
      </div>

      {/* Input Display */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              if (onValueChange) onValueChange(e.target.value);
            }}
            placeholder={placeholder}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />
          {value && (
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
                    className={`relative w-14 h-16 border-4 rounded-lg font-semibold transition-all group ${
                      isPressed
                        ? 'bg-yellow-300 border-yellow-500 text-gray-900 scale-95 shadow-lg'
                        : 'bg-white hover:bg-blue-50 border-gray-300 hover:border-blue-400 text-gray-800 active:scale-95'
                    }`}
                    title={`${key} - ${phonetic}`}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className={`text-xl font-bold ${isPressed ? 'text-gray-900' : 'text-gray-800'}`}>
                        {key}
                      </span>
                      {showPhonetic && (
                        <span className={`text-[9px] font-medium mt-0.5 ${
                          isPressed ? 'text-gray-700' : 'text-gray-500 group-hover:text-blue-600'
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
        disabled={!value.trim()}
        className={`w-full flex items-center justify-center gap-2 h-12 rounded-lg font-semibold transition-all ${
          value.trim()
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
