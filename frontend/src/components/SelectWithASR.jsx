/**
 * Select Component with ASR Support
 *
 * Features:
 * - Scrollable dropdown (max 10 visible items)
 * - Fuzzy matching against label, aliases, and phonetics
 * - Speech recognition with intelligent matching
 * - Keyboard search/filter
 */

import React, { useState, useMemo } from 'react';
import { Card, TextInput, Badge, Button, Alert } from 'flowbite-react';
import { Search, Check, Mic, MicOff } from 'lucide-react';

const SelectWithASR = ({ options = [], value, onChange, placeholder = "Select or speak an option", onStartRecording, onStopRecording, isRecording = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  /**
   * Fuzzy match function
   * Matches against: label, aliases, phonetics
   * Returns score (higher is better match)
   */
  const matchOption = (option, query) => {
    if (!query) return 100; // Show all if no query

    const q = query.toLowerCase().trim();
    const label = option.label.toLowerCase();
    const aliases = option.aliases?.map(a => a.toLowerCase()) || [];
    const phonetics = option.phonetics?.map(p => p.toLowerCase()) || [];

    // Exact match scores highest
    if (label === q) return 1000;
    if (aliases.includes(q)) return 900;
    if (phonetics.includes(q)) return 800;

    // Start-of-word match
    if (label.startsWith(q)) return 500;
    if (aliases.some(a => a.startsWith(q))) return 450;
    if (phonetics.some(p => p.startsWith(q))) return 400;

    // Contains match
    if (label.includes(q)) return 300;
    if (aliases.some(a => a.includes(q))) return 250;
    if (phonetics.some(p => p.includes(q))) return 200;

    // Partial word match (for multi-word queries like "land rover")
    const queryWords = q.split(/\s+/);
    const labelWords = label.split(/\s+/);
    const matchingWords = queryWords.filter(qw =>
      labelWords.some(lw => lw.startsWith(qw) || lw.includes(qw))
    );
    if (matchingWords.length > 0) {
      return 100 + (matchingWords.length * 50);
    }

    return 0; // No match
  };

  /**
   * Filter and sort options by match score
   */
  const filteredOptions = useMemo(() => {
    return options
      .map(opt => ({
        ...opt,
        matchScore: matchOption(opt, searchTerm)
      }))
      .filter(opt => opt.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [options, searchTerm]);

  /**
   * Handle option selection
   */
  const handleSelect = (option) => {
    onChange(option.value);
    setSearchTerm(''); // Clear search after selection
  };

  /**
   * Handle ASR result - find best matching option
   */
  const handleASRMatch = (transcript) => {
    const bestMatch = options
      .map(opt => ({
        option: opt,
        score: matchOption(opt, transcript)
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (bestMatch && bestMatch.score > 100) {
      handleSelect(bestMatch.option);
      return bestMatch.option;
    }

    return null;
  };

  // Expose ASR matching to parent via callback
  React.useEffect(() => {
    if (window.selectWithASRMatch) {
      window.selectWithASRMatch = handleASRMatch;
    }
  }, [options]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="space-y-3">
      {/* Search / Filter Input */}
      <div className="relative">
        <TextInput
          icon={Search}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        {selectedOption && !searchTerm && (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
            <Badge color="success" size="sm">
              <Check className="w-3 h-3 mr-1" />
              {selectedOption.label}
            </Badge>
          </div>
        )}
      </div>

      {/* ASR Button */}
      <Button
        color={isRecording ? 'failure' : 'blue'}
        size="sm"
        onClick={isRecording ? onStopRecording : onStartRecording}
        className="w-full"
      >
        {isRecording ? (
          <>
            <MicOff className="w-4 h-4 mr-2 animate-pulse" />
            Listening... Speak the manufacturer name
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Speak to Select
          </>
        )}
      </Button>

      {/* Info about ASR matching */}
      {!searchTerm && filteredOptions.length > 5 && (
        <Alert color="info" className="text-xs">
          <p>
            <strong>Tip:</strong> Type to filter the list, or click "Speak to Select" and say the manufacturer name.
            We recognize common variations (e.g., "VW" for Volkswagen, "Merc" for Mercedes).
          </p>
        </Alert>
      )}

      {/* Scrollable Options List (max 10 visible) */}
      <Card className="p-0">
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-200">
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No matches found for "{searchTerm}"</p>
              <p className="text-xs mt-1">Try a different spelling or use speech recognition</p>
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full p-3 text-left transition-colors duration-150 ${
                  value === option.value
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : highlightedIndex === index
                    ? 'bg-gray-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {option.label}
                      {value === option.value && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    {option.description && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        {option.description}
                      </div>
                    )}
                    {/* Show aliases/phonetics if searching */}
                    {searchTerm && (option.aliases?.length > 0 || option.phonetics?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {option.aliases?.map(alias => (
                          <Badge key={alias} color="gray" size="xs">
                            {alias}
                          </Badge>
                        ))}
                        {option.phonetics?.slice(0, 2).map(phonetic => (
                          <Badge key={phonetic} color="info" size="xs">
                            {phonetic}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {option.matchScore < 500 && option.matchScore > 0 && searchTerm && (
                    <Badge color="warning" size="xs">
                      Partial match
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        {filteredOptions.length > 10 && (
          <div className="p-2 bg-gray-50 text-center text-xs text-gray-600 border-t">
            Showing {filteredOptions.length} options - scroll to see more
          </div>
        )}
      </Card>
    </div>
  );
};

export default SelectWithASR;
