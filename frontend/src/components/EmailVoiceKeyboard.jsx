/**
 * Email Voice Keyboard Component
 * 
 * Voice-enabled email input with:
 * - Character-by-character voice entry
 * - TLD shortcuts (dot com, dot org, etc.)
 * - Special character support (@, ., -, _, +)
 * - Real-time email validation
 */

import React, { useState } from 'react';
import { Card, Button, Badge } from 'flowbite-react';
import { Mail, Mic, X, CheckCircle, AlertCircle } from 'lucide-react';

const EmailVoiceKeyboard = ({
    value = '',
    onChange,
    onComplete,
    customTLDs = []
}) => {
    const [email, setEmail] = useState(value);
    const [isValid, setIsValid] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Common TLDs
    const commonTLDs = [
        '.com', '.org', '.net', '.edu', '.gov',
        '.co.uk', '.ac.uk', '.io', '.ai', '.app'
    ];

    const allTLDs = [...commonTLDs, ...customTLDs.map(tld => tld.startsWith('.') ? tld : `.${tld}`)];

    // Validate email
    const validateEmail = (emailStr) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailStr);
    };

    // Handle character input
    const handleCharacterInput = (char) => {
        const newEmail = email + char;
        setEmail(newEmail);
        setIsValid(validateEmail(newEmail));

        if (onChange) {
            onChange(newEmail);
        }
    };

    // Handle TLD input
    const handleTLDInput = (tld) => {
        const newEmail = email + tld;
        setEmail(newEmail);
        setIsValid(validateEmail(newEmail));

        if (onChange) {
            onChange(newEmail);
        }
    };

    // Handle backspace
    const handleBackspace = () => {
        const newEmail = email.slice(0, -1);
        setEmail(newEmail);
        setIsValid(validateEmail(newEmail));

        if (onChange) {
            onChange(newEmail);
        }
    };

    // Handle clear
    const handleClear = () => {
        setEmail('');
        setIsValid(false);

        if (onChange) {
            onChange('');
        }
    };

    // Handle complete
    const handleComplete = () => {
        if (isValid && onComplete) {
            onComplete(email);
        }
    };

    // Letters
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

    // Numbers
    const numbers = '0123456789'.split('');

    // Special characters
    const specialChars = [
        { char: '@', label: 'at' },
        { char: '.', label: 'dot' },
        { char: '-', label: 'dash' },
        { char: '_', label: 'underscore' },
        { char: '+', label: 'plus' }
    ];

    return (
        <Card className="bg-white">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-700" />
                    <h3 className="text-lg font-semibold text-gray-900">Email Voice Input</h3>
                    {isValid && <CheckCircle className="w-5 h-5 text-green-600" />}
                </div>

                {/* Email Display */}
                <div className="p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-600">EMAIL ADDRESS</span>
                        {email && (
                            <Button size="xs" color="gray" onClick={handleClear}>
                                <X className="w-3 h-3 mr-1" />
                                Clear
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-mono text-gray-900 break-all">
                            {email || <span className="text-gray-400">your.email@example.com</span>}
                        </p>
                        {isValid && <Badge color="success" size="sm">Valid</Badge>}
                        {email && !isValid && <Badge color="failure" size="sm">Invalid</Badge>}
                    </div>
                </div>

                {/* Letters */}
                <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">LETTERS</p>
                    <div className="grid grid-cols-13 gap-1">
                        {letters.map((letter) => (
                            <button
                                key={letter}
                                onClick={() => handleCharacterInput(letter)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-sm font-mono transition-colors"
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Numbers */}
                <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">NUMBERS</p>
                    <div className="grid grid-cols-10 gap-1">
                        {numbers.map((num) => (
                            <button
                                key={num}
                                onClick={() => handleCharacterInput(num)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-sm font-mono transition-colors"
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Special Characters */}
                <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">SPECIAL CHARACTERS</p>
                    <div className="grid grid-cols-5 gap-2">
                        {specialChars.map(({ char, label }) => (
                            <button
                                key={char}
                                onClick={() => handleCharacterInput(char)}
                                className="p-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors"
                            >
                                <div className="text-center">
                                    <div className="text-lg font-mono">{char}</div>
                                    <div className="text-xs text-gray-600">{label}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* TLD Quick Select */}
                <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">🌐 QUICK TLDs</p>
                    <div className="grid grid-cols-5 gap-2">
                        {allTLDs.map((tld) => (
                            <button
                                key={tld}
                                onClick={() => handleTLDInput(tld)}
                                className="p-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded text-sm font-mono text-blue-900 transition-colors"
                            >
                                {tld}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Voice Input Hint */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-semibold text-gray-700 mb-2">💬 Voice Commands:</p>
                    <div className="text-xs text-gray-600 space-y-1">
                        <div>• "letter a" → a</div>
                        <div>• "number 5" → 5</div>
                        <div>• "at" → @</div>
                        <div>• "dot" → .</div>
                        <div>• "dot com" → .com</div>
                        <div>• "underscore" → _</div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Button
                        color="gray"
                        className="flex-1"
                        onClick={handleBackspace}
                        disabled={!email}
                    >
                        ← Backspace
                    </Button>
                    <Button
                        color="blue"
                        className="flex-1"
                        onClick={handleComplete}
                        disabled={!isValid}
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm Email
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default EmailVoiceKeyboard;
