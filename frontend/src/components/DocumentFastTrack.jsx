/**
 * Document Fast Track Component
 * 
 * Special section type that appears first in dialog flow
 * Allows users to upload documents and auto-extract data
 * Pre-fills subsequent questions with extracted information
 */

import React, { useState, useCallback } from 'react';
import { Card, Button, Badge, Alert } from 'flowbite-react';
import { Upload, Camera, FileText, CheckCircle, AlertCircle, X, Edit } from 'lucide-react';

const DocumentFastTrack = ({
    documentsRequested = [],
    onDocumentsExtracted,
    onSkip,
    sessionId // Add sessionId prop
}) => {
    const [uploadedDocuments, setUploadedDocuments] = useState([]);
    const [extractedData, setExtractedData] = useState({});
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);
    const [currentDocumentType, setCurrentDocumentType] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);

    // Handle file upload
    const handleFileUpload = async (file, documentType) => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('document_type', documentType);
            if (sessionId) {
                formData.append('session_id', sessionId);
            }

            const response = await fetch('/api/document/upload-and-extract', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                // Add to uploaded documents
                setUploadedDocuments(prev => [...prev, {
                    type: documentType,
                    filename: file.name,
                    extractedFields: data.extracted_fields,
                    confidence: data.confidence
                }]);

                // Merge extracted data
                setExtractedData(prev => ({
                    ...prev,
                    ...data.extracted_fields
                }));

                console.log('✅ Document extracted:', data.extracted_fields);
            } else {
                setError(data.error || 'Failed to extract document data');
            }
        } catch (err) {
            setError('Failed to upload document: ' + err.message);
            console.error('❌ Upload error:', err);
        } finally {
            setIsUploading(false);
        }
    };

    // Handle drag and drop
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file && currentDocumentType) {
            handleFileUpload(file, currentDocumentType);
        }
    }, [currentDocumentType]);

    // Handle file input change
    const handleFileChange = (e, documentType) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file, documentType);
        }
    };

    // Confirm and proceed
    const handleConfirm = () => {
        if (onDocumentsExtracted) {
            onDocumentsExtracted(extractedData);
        }
    };

    // Skip document upload
    const handleSkip = () => {
        if (onSkip) {
            onSkip();
        }
    };

    // Camera functions
    const startCamera = async (documentType) => {
        setCurrentDocumentType(documentType);
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            setError('Could not access camera: ' + err.message);
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to blob/file
            canvas.toBlob((blob) => {
                const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                handleFileUpload(file, currentDocumentType);
                stopCamera();
            }, 'image/jpeg', 0.95);
        }
    };

    // Get document type label
    const getDocumentLabel = (type) => {
        const labels = {
            'uk_driving_licence': 'UK Driving Licence',
            'passport': 'Passport',
            'utility_bill': 'Utility Bill',
            'bank_statement': 'Bank Statement',
            'insurance_document': 'Insurance Document'
        };
        return labels[type] || type;
    };

    // Check if document is uploaded
    const isDocumentUploaded = (type) => {
        return uploadedDocuments.some(doc => doc.type === type);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                        <FileText className="w-6 h-6 text-gray-700" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">📄 Documents Fast Track</h2>
                        <p className="text-sm text-gray-600">Upload your documents to auto-fill the form</p>
                    </div>
                </div>

                <Alert color="info" className="mb-4">
                    <p className="text-sm">
                        <strong>Save time!</strong> Upload your documents and we'll automatically extract your information.
                        You can skip this step and enter details manually if you prefer.
                    </p>
                </Alert>

                {/* Document List */}
                <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900">Required Documents:</h3>

                    {documentsRequested.map((docRequest, idx) => {
                        const isUploaded = isDocumentUploaded(docRequest.document_type);
                        const isRequired = docRequest.required;

                        return (
                            <div
                                key={idx}
                                className={`p-4 border-2 rounded-lg transition-all ${isUploaded
                                    ? 'border-gray-400 bg-gray-50'
                                    : isDragging && currentDocumentType === docRequest.document_type
                                        ? 'border-gray-600 bg-gray-100'
                                        : 'border-gray-200 bg-white'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {isUploaded ? (
                                            <CheckCircle className="w-5 h-5 text-gray-700" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                                        )}
                                        <span className="font-medium text-gray-900">
                                            {getDocumentLabel(docRequest.document_type)}
                                        </span>
                                        {isRequired && (
                                            <Badge color="gray" size="sm">Required</Badge>
                                        )}
                                    </div>

                                    {!isUploaded && (
                                        <div className="flex gap-2">
                                            <input
                                                type="file"
                                                id={`file-${docRequest.document_type}`}
                                                className="hidden"
                                                accept="image/*,.pdf"
                                                onChange={(e) => handleFileChange(e, docRequest.document_type)}
                                            />
                                            <Button
                                                size="sm"
                                                color="gray"
                                                onClick={() => {
                                                    setCurrentDocumentType(docRequest.document_type);
                                                    document.getElementById(`file-${docRequest.document_type}`).click();
                                                }}
                                                disabled={isUploading}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Upload
                                            </Button>
                                            <Button
                                                size="sm"
                                                color="gray"
                                                onClick={() => {
                                                    setCurrentDocumentType(docRequest.document_type);
                                                    startCamera(docRequest.document_type);
                                                }}
                                                disabled={isUploading}
                                            >
                                                <Camera className="w-4 h-4 mr-2" />
                                                Photo
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Show uploaded document info */}
                                {isUploaded && (
                                    <div className="mt-3 p-3 bg-white border border-gray-200 rounded">
                                        {uploadedDocuments
                                            .filter(doc => doc.type === docRequest.document_type)
                                            .map((doc, docIdx) => (
                                                <div key={docIdx}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm text-gray-600">📎 {doc.filename}</span>
                                                        <Button
                                                            size="xs"
                                                            color="gray"
                                                            onClick={() => {
                                                                setUploadedDocuments(prev => prev.filter((_, i) => i !== docIdx));
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>

                                                    {/* Show extracted fields */}
                                                    {doc.extractedFields && Object.keys(doc.extractedFields).length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            <p className="text-xs font-semibold text-gray-700">Extracted Data:</p>
                                                            {Object.entries(doc.extractedFields).map(([key, value]) => (
                                                                <div key={key} className="flex justify-between text-xs">
                                                                    <span className="text-gray-600">{key}:</span>
                                                                    <span className="font-mono text-gray-900">{value}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                )}

                                {/* Drag and drop hint */}
                                {!isUploaded && isDragging && currentDocumentType === docRequest.document_type && (
                                    <div className="mt-3 p-4 border-2 border-dashed border-gray-400 rounded-lg text-center">
                                        <p className="text-sm text-gray-600">Drop file here to upload</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Error Display */}
                {error && (
                    <Alert color="failure" className="mt-4">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    </Alert>
                )}

                {/* Extracted Data Summary */}
                {Object.keys(extractedData).length > 0 && (
                    <Card className="mt-4 bg-gray-50">
                        <h3 className="font-semibold text-gray-900 mb-3">📋 Extracted Information</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(extractedData).map(([key, value]) => (
                                <div key={key} className="p-2 bg-white rounded border border-gray-200">
                                    <p className="text-xs text-gray-600 mb-1">{key.replace(/_/g, ' ').toUpperCase()}</p>
                                    <p className="text-sm font-medium text-gray-900">{value}</p>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                            ℹ️ This information will be used to pre-fill the form. You can edit any field later.
                        </p>
                    </Card>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                    <Button
                        color="gray"
                        className="flex-1"
                        onClick={handleConfirm}
                        disabled={uploadedDocuments.length === 0}
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Continue with Extracted Data
                    </Button>
                    <Button
                        color="light"
                        onClick={handleSkip}
                    >
                        Skip & Enter Manually
                    </Button>
                </div>
            </Card>

            {/* Camera Modal */}
            {showCamera && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                    <div className="bg-white rounded-lg overflow-hidden max-w-lg w-full">
                        <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                            <h3 className="font-semibold">Take Photo</h3>
                            <button onClick={stopCamera} className="text-gray-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="relative bg-black aspect-video flex items-center justify-center">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="max-w-full max-h-full"
                                onLoadedMetadata={() => {
                                    if (videoRef.current) videoRef.current.play();
                                }}
                            />
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                        <div className="p-4 flex justify-center gap-4 bg-gray-100">
                            <Button color="light" onClick={stopCamera}>Cancel</Button>
                            <Button color="blue" onClick={capturePhoto}>
                                <Camera className="w-4 h-4 mr-2" />
                                Capture
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentFastTrack;
