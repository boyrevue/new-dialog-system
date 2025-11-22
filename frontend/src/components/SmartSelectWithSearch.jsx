/**
 * SmartSelectWithSearch Component
 * 
 * A smart select component with:
 * - Voice search capability
 * - Keyboard filtering
 * - Smart display for long lists
 * - Scroll-to-match functionality
 * - Support for cascading/dependent selects
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Button, Badge, TextInput } from 'flowbite-react';
import { Search, Mic, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const SmartSelectWithSearch = ({
    options = [],
    value = null,
    onChange,
    onVoiceSearch,
    placeholder = 'Search options...',
    maxInitialDisplay = 20,
    enableVoiceSearch = true,
    enableKeyboardSearch = true,
    parentValue = null,
    isDependent = false,
    loading = false,
    className = ''
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const searchInputRef = useRef(null);
    const optionsContainerRef = useRef(null);
    const optionRefs = useRef([]);

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return options;

        const query = searchQuery.toLowerCase().trim();
        return options.filter(option =>
            option.label.toLowerCase().includes(query) ||
            option.value.toLowerCase().includes(query)
        );
    }, [options, searchQuery]);

    // Determine which options to display
    const displayedOptions = useMemo(() => {
        if (showAll || searchQuery.trim()) {
            return filteredOptions;
        }
        return filteredOptions.slice(0, maxInitialDisplay);
    }, [filteredOptions, showAll, searchQuery, maxInitialDisplay]);

    const hasMore = filteredOptions.length > maxInitialDisplay && !showAll && !searchQuery.trim();
    const hiddenCount = filteredOptions.length - maxInitialDisplay;

    // Reset showAll when search query changes
    useEffect(() => {
        if (searchQuery.trim()) {
            setShowAll(false);
        }
    }, [searchQuery]);

    // Scroll to highlighted option
    useEffect(() => {
        if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
            optionRefs.current[highlightedIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, [highlightedIndex]);

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev < displayedOptions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(displayedOptions[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setSearchQuery('');
            setHighlightedIndex(-1);
            searchInputRef.current?.blur();
        }
    };

    // Handle option selection
    const handleSelect = (option) => {
        if (onChange) {
            onChange(option);
        }
        setSearchQuery('');
        setHighlightedIndex(-1);
    };

    // Handle voice search
    const handleVoiceSearchClick = () => {
        if (onVoiceSearch) {
            setIsListening(true);
            onVoiceSearch((transcript) => {
                setSearchQuery(transcript);
                setIsListening(false);

                // Auto-select if exact match
                const exactMatch = filteredOptions.find(
                    opt => opt.label.toLowerCase() === transcript.toLowerCase()
                );
                if (exactMatch) {
                    handleSelect(exactMatch);
                }
            });
        }
    };

    // Highlight matching text in option label
    const highlightMatch = (text, query) => {
        if (!query.trim()) return text;

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={i} className="bg-yellow-200 font-semibold">{part}</mark>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </span>
        );
    };

    // Disabled state for dependent selects
    const isDisabled = isDependent && !parentValue;

    if (isDisabled) {
        return (
            <Card className={className}>
                <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Please select the previous option first</p>
                </div>
            </Card>
        );
    }

    if (loading) {
        return (
            <Card className={className}>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                    <span className="text-gray-600">Loading options...</span>
                </div>
            </Card>
        );
    }

    return (
        <Card className={className}>
            {/* Search Bar */}
            {(enableKeyboardSearch || enableVoiceSearch) && options.length > 5 && (
                <div className="mb-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search className="w-4 h-4 text-gray-500" />
                        </div>
                        <TextInput
                            ref={searchInputRef}
                            type="text"
                            placeholder={placeholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-10"
                            disabled={isListening}
                        />
                        {enableVoiceSearch && (
                            <button
                                onClick={handleVoiceSearchClick}
                                disabled={isListening}
                                className={`absolute inset-y-0 right-0 flex items-center pr-3 ${isListening ? 'text-red-600 animate-pulse' : 'text-gray-500 hover:text-blue-600'
                                    } transition-colors`}
                                title="Voice search"
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Search Results Info */}
                    {searchQuery.trim() && (
                        <div className="mt-2 text-sm text-gray-600">
                            {filteredOptions.length === 0 ? (
                                <span className="text-red-600">No matches found</span>
                            ) : filteredOptions.length === 1 ? (
                                <span className="text-green-600">1 match found</span>
                            ) : (
                                <span className="text-blue-600">{filteredOptions.length} matches found</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Options List */}
            <div
                ref={optionsContainerRef}
                className="space-y-2 max-h-96 overflow-y-auto"
                role="listbox"
            >
                {displayedOptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No options available</p>
                    </div>
                ) : (
                    displayedOptions.map((option, index) => {
                        const isSelected = value === option.value;
                        const isHighlighted = index === highlightedIndex;

                        return (
                            <button
                                key={option.value}
                                ref={el => optionRefs.current[index] = el}
                                onClick={() => handleSelect(option)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${isSelected
                                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold'
                                        : isHighlighted
                                            ? 'bg-gray-100 border-gray-400'
                                            : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                                role="option"
                                aria-selected={isSelected}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">
                                        {highlightMatch(option.label, searchQuery)}
                                    </span>
                                    {isSelected && (
                                        <Badge color="success" size="sm">Selected</Badge>
                                    )}
                                    {option.has_children && (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Show More Button */}
            {hasMore && (
                <div className="mt-4 text-center">
                    <Button
                        color="light"
                        size="sm"
                        onClick={() => setShowAll(true)}
                    >
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Show {hiddenCount} more option{hiddenCount !== 1 ? 's' : ''}
                    </Button>
                </div>
            )}

            {/* Show Less Button */}
            {showAll && !searchQuery.trim() && (
                <div className="mt-4 text-center">
                    <Button
                        color="light"
                        size="sm"
                        onClick={() => setShowAll(false)}
                    >
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Show less
                    </Button>
                </div>
            )}
        </Card>
    );
};

export default SmartSelectWithSearch;
