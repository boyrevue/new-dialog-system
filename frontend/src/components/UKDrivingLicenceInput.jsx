/**
 * UK Driving Licence Input Component
 *
 * Format-specific voice entry for UK driving licences with:
 * - Visual segmented display showing pre-filled vs user-input sections
 * - Phonetic alphabet support (Alpha, Bravo, Charlie, etc.) for letters
 * - Digit voice input for security code
 * - Auto-fill from DOB/name/gender fields
 * - Only asks for missing parts (middle initial + security digits)
 *
 * UK Licence Format (16 characters):
 * Positions 1-5:   Surname (first 5 chars, padded with 9s)
 * Position 6:      Birth year decade digit
 * Positions 7-8:   Birth month (females +50)
 * Positions 9-10:  Birth day
 * Position 11:     Birth year last digit
 * Position 12:     First initial
 * Position 13:     Middle initial (or 9 if none) - USER INPUT
 * Positions 14-16: Security digits - USER INPUT
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Badge, Alert } from 'flowbite-react';
import { CreditCard, Mic, MicOff, Upload, CheckCircle, AlertCircle, X, Lock, Edit3, HelpCircle } from 'lucide-react';

// NATO Phonetic Alphabet for voice input
const NATO_ALPHABET = {
    'ALPHA': 'A', 'BRAVO': 'B', 'CHARLIE': 'C', 'DELTA': 'D', 'ECHO': 'E',
    'FOXTROT': 'F', 'GOLF': 'G', 'HOTEL': 'H', 'INDIA': 'I', 'JULIET': 'J',
    'KILO': 'K', 'LIMA': 'L', 'MIKE': 'M', 'NOVEMBER': 'N', 'OSCAR': 'O',
    'PAPA': 'P', 'QUEBEC': 'Q', 'ROMEO': 'R', 'SIERRA': 'S', 'TANGO': 'T',
    'UNIFORM': 'U', 'VICTOR': 'V', 'WHISKEY': 'W', 'XRAY': 'X', 'X-RAY': 'X',
    'YANKEE': 'Y', 'ZULU': 'Z', 'NINER': '9', 'NINE': '9'
};

// Spoken digit mappings
const SPOKEN_DIGITS = {
    'ZERO': '0', 'ONE': '1', 'TWO': '2', 'THREE': '3', 'FOUR': '4',
    'FIVE': '5', 'SIX': '6', 'SEVEN': '7', 'EIGHT': '8', 'NINE': '9',
    'NINER': '9', 'OH': '0', 'O': '0'
};

const UKDrivingLicenceInput = ({
    value = '',
    onChange,
    onComplete,
    dateOfBirth = null,
    fullName = null,
    firstName = null,  // Direct first name if available
    lastName = null,   // Direct last name if available
    middleName = null, // Direct middle name if available
    gender = 'Male',
    allowDocumentUpload = true,
    onUploadComplete
}) => {
    // Licence segments state
    const [segments, setSegments] = useState({
        surname: '',      // 1-5: Pre-filled from lastName
        yearDecade: '',   // 6: Pre-filled from DOB
        month: '',        // 7-8: Pre-filled from DOB + gender
        day: '',          // 9-10: Pre-filled from DOB
        yearUnit: '',     // 11: Pre-filled from DOB
        firstInitial: '', // 12: Pre-filled from firstName
        middleInitial: '', // 13: USER INPUT (NATO alphabet)
        securityCode: ''  // 14-16: USER INPUT (digits)
    });

    const [isValid, setIsValid] = useState(false);
    const [isListeningMiddle, setIsListeningMiddle] = useState(false);
    const [isListeningSecurity, setIsListeningSecurity] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [preFilledData, setPreFilledData] = useState(null);

    const fileInputRef = useRef(null);
    const middleRecognitionRef = useRef(null);
    const securityRecognitionRef = useRef(null);

    // Initialize speech recognition for middle initial (NATO)
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            // Middle initial recognition (NATO alphabet)
            const middleRec = new SpeechRecognition();
            middleRec.continuous = false;
            middleRec.interimResults = false;
            middleRec.lang = 'en-GB';

            middleRec.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toUpperCase().trim();
                console.log('Middle initial voice input:', transcript);

                // Try to match NATO alphabet
                for (const [word, letter] of Object.entries(NATO_ALPHABET)) {
                    if (transcript.includes(word)) {
                        setSegments(prev => ({ ...prev, middleInitial: letter }));
                        break;
                    }
                }
                // Also try single letter
                if (transcript.length === 1 && /[A-Z9]/.test(transcript)) {
                    setSegments(prev => ({ ...prev, middleInitial: transcript }));
                }
            };

            middleRec.onend = () => setIsListeningMiddle(false);
            middleRec.onerror = () => setIsListeningMiddle(false);
            middleRecognitionRef.current = middleRec;

            // Security code recognition (digits)
            const securityRec = new SpeechRecognition();
            securityRec.continuous = true;
            securityRec.interimResults = false;
            securityRec.lang = 'en-GB';

            securityRec.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.toUpperCase().trim();
                console.log('Security code voice input:', transcript);

                let digits = '';
                // Parse spoken digits
                for (const word of transcript.split(/\s+/)) {
                    if (SPOKEN_DIGITS[word]) {
                        digits += SPOKEN_DIGITS[word];
                    } else if (/^\d$/.test(word)) {
                        digits += word;
                    }
                }

                if (digits) {
                    setSegments(prev => {
                        const current = prev.securityCode || '';
                        const newCode = (current + digits).slice(0, 3);
                        return { ...prev, securityCode: newCode };
                    });
                }
            };

            securityRec.onend = () => setIsListeningSecurity(false);
            securityRec.onerror = () => setIsListeningSecurity(false);
            securityRecognitionRef.current = securityRec;
        }

        return () => {
            if (middleRecognitionRef.current) {
                try { middleRecognitionRef.current.abort(); } catch {}
            }
            if (securityRecognitionRef.current) {
                try { securityRecognitionRef.current.abort(); } catch {}
            }
        };
    }, []);

    // Pre-fill segments from props
    useEffect(() => {
        if (!dateOfBirth) return;

        try {
            // Determine names
            let fName = firstName;
            let lName = lastName;
            let mName = middleName;

            // Parse from fullName if direct names not provided
            if (!fName && fullName) {
                const parts = fullName.trim().split(/\s+/);
                fName = parts[0] || '';
                if (parts.length === 2) {
                    lName = parts[1];
                } else if (parts.length >= 3) {
                    mName = parts[1];
                    lName = parts.slice(2).join(' ');
                }
            }

            if (!lName && fullName) {
                const parts = fullName.trim().split(/\s+/);
                lName = parts[parts.length - 1] || '';
            }

            // 1. Surname (positions 1-5): First 5 chars, padded with 9s
            let surnameCode = (lName || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
            surnameCode = surnameCode.length < 5
                ? surnameCode.padEnd(5, '9')
                : surnameCode.substring(0, 5);

            // 2. Date encoding
            const dob = new Date(dateOfBirth);
            const yearFull = dob.getFullYear().toString();
            const yearDecade = yearFull.charAt(2);  // Position 6
            const yearUnit = yearFull.charAt(3);    // Position 11

            let monthNum = dob.getMonth() + 1;
            // Female = month + 50
            if (gender && (gender.toLowerCase() === 'female' || gender.toLowerCase() === 'f')) {
                monthNum += 50;
            }
            const month = String(monthNum).padStart(2, '0');  // Positions 7-8
            const day = String(dob.getDate()).padStart(2, '0');  // Positions 9-10

            // 3. First initial (position 12)
            const firstInit = (fName || '').charAt(0).toUpperCase() || '9';

            // 4. Middle initial (position 13) - only pre-fill if we have it
            const middleInit = mName ? mName.charAt(0).toUpperCase() : '';

            setSegments({
                surname: surnameCode,
                yearDecade,
                month,
                day,
                yearUnit,
                firstInitial: firstInit,
                middleInitial: middleInit,
                securityCode: ''  // Always user input
            });

            setPreFilledData({
                name: fName,
                surname: lName,
                middleName: mName,
                dob: dateOfBirth,
                gender
            });

        } catch (error) {
            console.error('Pre-fill error:', error);
        }
    }, [dateOfBirth, fullName, firstName, lastName, middleName, gender]);

    // Check validity when segments change
    useEffect(() => {
        const licence = getLicenceString();
        const valid = licence.length === 16 && /^[A-Z0-9]{16}$/.test(licence);
        setIsValid(valid);

        if (onChange) {
            onChange(formatLicenceDisplay(licence));
        }
    }, [segments]);

    // Build licence string from segments
    const getLicenceString = () => {
        const { surname, yearDecade, month, day, yearUnit, firstInitial, middleInitial, securityCode } = segments;
        return `${surname}${yearDecade}${month}${day}${yearUnit}${firstInitial}${middleInitial || '9'}${securityCode || '000'}`;
    };

    // Format for display with spaces
    const formatLicenceDisplay = (str) => {
        if (!str || str.length < 5) return str;
        // SSSSS YMMDD Y II CCC
        let result = str.substring(0, 5);  // Surname
        if (str.length > 5) result += ' ' + str.substring(5, 11);  // DOB code
        if (str.length > 11) result += ' ' + str.substring(11, 13);  // Initials
        if (str.length > 13) result += ' ' + str.substring(13, 16);  // Security
        return result;
    };

    // Toggle middle initial voice input
    const toggleMiddleListening = () => {
        if (!middleRecognitionRef.current) return;

        if (isListeningMiddle) {
            middleRecognitionRef.current.stop();
        } else {
            setIsListeningMiddle(true);
            middleRecognitionRef.current.start();
        }
    };

    // Toggle security code voice input
    const toggleSecurityListening = () => {
        if (!securityRecognitionRef.current) return;

        if (isListeningSecurity) {
            securityRecognitionRef.current.stop();
        } else {
            setSegments(prev => ({ ...prev, securityCode: '' }));
            setIsListeningSecurity(true);
            securityRecognitionRef.current.start();
        }
    };

    // Handle middle initial click input
    const handleMiddleInitialClick = (letter) => {
        setSegments(prev => ({ ...prev, middleInitial: letter }));
    };

    // Handle security code digit input
    const handleSecurityDigitClick = (digit) => {
        setSegments(prev => {
            const current = prev.securityCode || '';
            if (current.length >= 3) return prev;
            return { ...prev, securityCode: current + digit };
        });
    };

    // Clear security code
    const clearSecurityCode = () => {
        setSegments(prev => ({ ...prev, securityCode: '' }));
    };

    // Handle Document Upload
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('document_type', 'uk_driving_licence');

            const response = await fetch('/api/document/upload-and-extract', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success && data.extracted_fields) {
                if (onUploadComplete) {
                    onUploadComplete(data.extracted_fields);
                }
            }
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setIsUploading(false);
        }
    };

    // Handle complete
    const handleComplete = () => {
        if (isValid && onComplete) {
            onComplete(getLicenceString());
        }
    };

    // Letters and digits for quick input
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9'.split('');
    const digits = '0123456789'.split('');

    // NATO alphabet display mapping
    const natoDisplay = {
        'A': 'Alpha', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta', 'E': 'Echo',
        'F': 'Foxtrot', 'G': 'Golf', 'H': 'Hotel', 'I': 'India', 'J': 'Juliet',
        'K': 'Kilo', 'L': 'Lima', 'M': 'Mike', 'N': 'November', 'O': 'Oscar',
        'P': 'Papa', 'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
        'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray', 'Y': 'Yankee',
        'Z': 'Zulu', '9': 'Niner (no middle name)'
    };

    return (
        <Card className="bg-white">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">UK Driving Licence Number</h3>
                            <p className="text-xs text-gray-500">16 characters - Pre-filled from your details</p>
                        </div>
                    </div>
                    {isValid && (
                        <Badge color="success" size="lg">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Complete
                        </Badge>
                    )}
                </div>

                {/* Visual Licence Number Display */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="text-xs font-semibold text-blue-700 mb-3">LICENCE NUMBER FORMAT</div>

                    {/* Segmented Display */}
                    <div className="flex items-center gap-1 font-mono text-2xl mb-4 flex-wrap">
                        {/* Surname - Positions 1-5 (Pre-filled) */}
                        <div className="flex">
                            {(segments.surname || '_____').split('').map((char, i) => (
                                <div
                                    key={`surname-${i}`}
                                    className="w-8 h-12 flex items-center justify-center bg-green-100 border-2 border-green-300 text-green-800 rounded"
                                    title={`Position ${i + 1}: Surname`}
                                >
                                    {char}
                                </div>
                            ))}
                        </div>

                        <span className="text-gray-400 mx-1">-</span>

                        {/* Year Decade - Position 6 (Pre-filled) */}
                        <div
                            className="w-8 h-12 flex items-center justify-center bg-green-100 border-2 border-green-300 text-green-800 rounded"
                            title="Position 6: Year decade"
                        >
                            {segments.yearDecade || '_'}
                        </div>

                        {/* Month - Positions 7-8 (Pre-filled) */}
                        {(segments.month || '__').split('').map((char, i) => (
                            <div
                                key={`month-${i}`}
                                className="w-8 h-12 flex items-center justify-center bg-green-100 border-2 border-green-300 text-green-800 rounded"
                                title={`Position ${7 + i}: Month${gender?.toLowerCase() === 'female' ? ' (+50 for female)' : ''}`}
                            >
                                {char}
                            </div>
                        ))}

                        {/* Day - Positions 9-10 (Pre-filled) */}
                        {(segments.day || '__').split('').map((char, i) => (
                            <div
                                key={`day-${i}`}
                                className="w-8 h-12 flex items-center justify-center bg-green-100 border-2 border-green-300 text-green-800 rounded"
                                title={`Position ${9 + i}: Day`}
                            >
                                {char}
                            </div>
                        ))}

                        {/* Year Unit - Position 11 (Pre-filled) */}
                        <div
                            className="w-8 h-12 flex items-center justify-center bg-green-100 border-2 border-green-300 text-green-800 rounded"
                            title="Position 11: Year unit"
                        >
                            {segments.yearUnit || '_'}
                        </div>

                        <span className="text-gray-400 mx-1">-</span>

                        {/* First Initial - Position 12 (Pre-filled) */}
                        <div
                            className="w-8 h-12 flex items-center justify-center bg-green-100 border-2 border-green-300 text-green-800 rounded"
                            title="Position 12: First initial"
                        >
                            {segments.firstInitial || '_'}
                        </div>

                        {/* Middle Initial - Position 13 (USER INPUT) */}
                        <div
                            className={`w-8 h-12 flex items-center justify-center rounded border-2 ${
                                segments.middleInitial
                                    ? 'bg-blue-100 border-blue-400 text-blue-800'
                                    : 'bg-yellow-100 border-yellow-400 text-yellow-800 animate-pulse'
                            }`}
                            title="Position 13: Middle initial (USER INPUT)"
                        >
                            {segments.middleInitial || '?'}
                        </div>

                        <span className="text-gray-400 mx-1">-</span>

                        {/* Security Code - Positions 14-16 (USER INPUT) */}
                        {[0, 1, 2].map((i) => (
                            <div
                                key={`security-${i}`}
                                className={`w-8 h-12 flex items-center justify-center rounded border-2 ${
                                    (segments.securityCode || '')[i]
                                        ? 'bg-blue-100 border-blue-400 text-blue-800'
                                        : 'bg-yellow-100 border-yellow-400 text-yellow-800 animate-pulse'
                                }`}
                                title={`Position ${14 + i}: Security digit (USER INPUT)`}
                            >
                                {(segments.securityCode || '')[i] || '?'}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-1">
                            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                            <span className="text-gray-600">Pre-filled (locked)</span>
                            <Lock className="w-3 h-3 text-green-600" />
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-4 h-4 bg-yellow-100 border border-yellow-400 rounded"></div>
                            <span className="text-gray-600">Your input needed</span>
                            <Edit3 className="w-3 h-3 text-yellow-600" />
                        </div>
                    </div>
                </div>

                {/* Pre-filled Data Source */}
                {preFilledData && (
                    <Alert color="info" className="text-xs">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            <span>
                                Pre-filled from: <strong>{preFilledData.name} {preFilledData.surname}</strong>,
                                DOB: <strong>{new Date(preFilledData.dob).toLocaleDateString('en-GB')}</strong>,
                                Gender: <strong>{preFilledData.gender}</strong>
                            </span>
                        </div>
                    </Alert>
                )}

                {/* Middle Initial Input Section */}
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="font-semibold text-blue-900">Position 13: Middle Initial</h4>
                            <p className="text-xs text-blue-700">Say a NATO letter (e.g., "Alpha" for A) or click a letter. Say "Niner" or click 9 if no middle name.</p>
                        </div>
                        <Button
                            color={isListeningMiddle ? 'failure' : 'blue'}
                            size="sm"
                            onClick={toggleMiddleListening}
                        >
                            {isListeningMiddle ? (
                                <>
                                    <MicOff className="w-4 h-4 mr-1" />
                                    Stop
                                </>
                            ) : (
                                <>
                                    <Mic className="w-4 h-4 mr-1" />
                                    Speak NATO
                                </>
                            )}
                        </Button>
                    </div>

                    {isListeningMiddle && (
                        <div className="bg-red-100 border border-red-300 rounded p-2 mb-3 flex items-center gap-2">
                            <Mic className="w-4 h-4 text-red-600 animate-pulse" />
                            <span className="text-sm text-red-700">Listening... Say "Alpha" for A, "Bravo" for B, etc.</span>
                        </div>
                    )}

                    {/* Current selection display */}
                    {segments.middleInitial && (
                        <div className="bg-white border-2 border-blue-300 rounded p-3 mb-3 flex items-center justify-between">
                            <div>
                                <span className="text-2xl font-bold text-blue-800 mr-2">{segments.middleInitial}</span>
                                <span className="text-gray-600">= {natoDisplay[segments.middleInitial]}</span>
                            </div>
                            <Button size="xs" color="gray" onClick={() => setSegments(prev => ({ ...prev, middleInitial: '' }))}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    )}

                    {/* Letter grid */}
                    <div className="grid grid-cols-9 gap-1">
                        {letters.map((letter) => (
                            <button
                                key={letter}
                                onClick={() => handleMiddleInitialClick(letter)}
                                className={`p-2 rounded text-sm font-mono transition-all ${
                                    segments.middleInitial === letter
                                        ? 'bg-blue-600 text-white border-2 border-blue-800'
                                        : 'bg-white hover:bg-blue-100 border border-gray-300'
                                }`}
                                title={natoDisplay[letter]}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Security Code Input Section */}
                <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="font-semibold text-purple-900">Positions 14-16: Security Digits</h4>
                            <p className="text-xs text-purple-700">Say three digits (e.g., "One Two Three") or click the numbers below.</p>
                        </div>
                        <Button
                            color={isListeningSecurity ? 'failure' : 'purple'}
                            size="sm"
                            onClick={toggleSecurityListening}
                        >
                            {isListeningSecurity ? (
                                <>
                                    <MicOff className="w-4 h-4 mr-1" />
                                    Stop
                                </>
                            ) : (
                                <>
                                    <Mic className="w-4 h-4 mr-1" />
                                    Speak Digits
                                </>
                            )}
                        </Button>
                    </div>

                    {isListeningSecurity && (
                        <div className="bg-red-100 border border-red-300 rounded p-2 mb-3 flex items-center gap-2">
                            <Mic className="w-4 h-4 text-red-600 animate-pulse" />
                            <span className="text-sm text-red-700">Listening... Say "One Two Three" or individual digits</span>
                        </div>
                    )}

                    {/* Current digits display */}
                    <div className="bg-white border-2 border-purple-300 rounded p-3 mb-3 flex items-center justify-between">
                        <div className="flex gap-2">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className={`w-12 h-14 flex items-center justify-center text-2xl font-bold rounded border-2 ${
                                        (segments.securityCode || '')[i]
                                            ? 'bg-purple-100 border-purple-400 text-purple-800'
                                            : 'bg-gray-100 border-gray-300 text-gray-400'
                                    }`}
                                >
                                    {(segments.securityCode || '')[i] || '_'}
                                </div>
                            ))}
                        </div>
                        <Button size="xs" color="gray" onClick={clearSecurityCode} disabled={!segments.securityCode}>
                            <X className="w-3 h-3 mr-1" />
                            Clear
                        </Button>
                    </div>

                    {/* Digit grid */}
                    <div className="grid grid-cols-10 gap-1">
                        {digits.map((digit) => (
                            <button
                                key={digit}
                                onClick={() => handleSecurityDigitClick(digit)}
                                disabled={(segments.securityCode || '').length >= 3}
                                className={`p-3 rounded text-lg font-mono transition-all ${
                                    (segments.securityCode || '').length >= 3
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white hover:bg-purple-100 border border-gray-300'
                                }`}
                            >
                                {digit}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Document Upload Option */}
                {allowDocumentUpload && (
                    <div className="border border-gray-200 rounded-lg p-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload}
                        />
                        <Button
                            color="light"
                            className="w-full"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
                            ) : (
                                <Upload className="w-4 h-4 mr-2" />
                            )}
                            Upload Photo of Licence (Optional)
                        </Button>
                    </div>
                )}

                {/* Final Licence Display */}
                <div className="bg-gray-100 rounded-lg p-4">
                    <div className="text-xs text-gray-600 mb-1">COMPLETE LICENCE NUMBER</div>
                    <div className="flex items-center justify-between">
                        <code className="text-xl font-mono tracking-wider text-gray-900">
                            {formatLicenceDisplay(getLicenceString())}
                        </code>
                        {isValid ? (
                            <Badge color="success">Valid Format</Badge>
                        ) : (
                            <Badge color="warning">Incomplete</Badge>
                        )}
                    </div>
                </div>

                {/* Confirm Button */}
                <Button
                    color="success"
                    size="lg"
                    className="w-full"
                    onClick={handleComplete}
                    disabled={!isValid}
                >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirm Licence Number
                </Button>
            </div>
        </Card>
    );
};

export default UKDrivingLicenceInput;
