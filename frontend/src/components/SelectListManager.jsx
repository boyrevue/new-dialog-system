import React, { useState, useEffect } from 'react';

/**
 * SelectListManager - Manage select list options for questions
 *
 * Features:
 * - CSV upload for 1D and 2D select lists
 * - Download CSV templates
 * - Preview TTL before saving
 * - Edit existing select lists
 * - Support for aliases and phonetics
 */
const SelectListManager = ({ questionId, onSave, onCancel }) => {
  const [listType, setListType] = useState('1d'); // '1d' or '2d'
  const [csvContent, setCsvContent] = useState('');
  const [options, setOptions] = useState(null);
  const [ttlPreview, setTtlPreview] = useState('');
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTtlPreview, setShowTtlPreview] = useState(false);
  const [existingOptions, setExistingOptions] = useState(null);

  // Load existing options when component mounts
  useEffect(() => {
    if (questionId) {
      loadExistingOptions();
    }
  }, [questionId]);

  const loadExistingOptions = async () => {
    try {
      const response = await fetch(`http://localhost:8002/api/config/select-list/${questionId}`);
      const data = await response.json();

      if (data.has_options) {
        setExistingOptions(data.options);
      }
    } catch (error) {
      console.error('Error loading existing options:', error);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch(`http://localhost:8002/api/config/select-list/csv-template/${listType}`);
      const data = await response.json();

      // Create download link
      const blob = new Blob([data.template], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `select-list-${listType}-template.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading template:', error);
      setErrors(['Failed to download template']);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const parseCSV = async () => {
    if (!csvContent.trim()) {
      setErrors(['Please upload a CSV file or paste CSV content']);
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const response = await fetch('http://localhost:8002/api/config/select-list/upload-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_content: csvContent,
          question_id: questionId,
          list_type: listType
        })
      });

      const data = await response.json();

      if (data.success) {
        setOptions(data.options);
        setTtlPreview(data.ttl_preview);
        setErrors([]);
      } else {
        setErrors(data.errors || ['Failed to parse CSV']);
        setOptions(null);
        setTtlPreview('');
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setErrors(['Failed to parse CSV: ' + error.message]);
    } finally {
      setLoading(false);
    }
  };

  const saveToTTL = async () => {
    if (!ttlPreview) {
      setErrors(['No TTL content to save']);
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const response = await fetch('http://localhost:8002/api/config/select-list/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          list_type: listType,
          ttl_content: ttlPreview,
          ontology_file: 'insurance_questions'
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Select list saved successfully for ${questionId}!`);
        if (onSave) onSave(data);
      } else {
        setErrors(['Failed to save: ' + (data.detail || 'Unknown error')]);
      }
    } catch (error) {
      console.error('Error saving select list:', error);
      setErrors(['Failed to save: ' + error.message]);
    } finally {
      setLoading(false);
    }
  };

  const renderOptions = () => {
    if (!options) return null;

    if (listType === '1d') {
      return (
        <div className="mt-4 p-4 bg-gray-50 rounded border">
          <h4 className="font-semibold mb-2">Parsed Options ({options.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {options.map((opt, idx) => (
              <div key={idx} className="p-2 bg-white border rounded text-sm">
                <div className="font-medium">{opt.label}</div>
                <div className="text-gray-600">Value: {opt.value}</div>
                {opt.aliases && opt.aliases.length > 0 && (
                  <div className="text-gray-500 text-xs">Aliases: {opt.aliases.join(', ')}</div>
                )}
                {opt.phonetics && opt.phonetics.length > 0 && (
                  <div className="text-gray-500 text-xs">Phonetics: {opt.phonetics.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      // 2D hierarchical
      return (
        <div className="mt-4 p-4 bg-gray-50 rounded border">
          <h4 className="font-semibold mb-2">
            Parsed Hierarchical Options ({Object.keys(options).length} categories)
          </h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(options).map(([category, opts], idx) => (
              <div key={idx} className="p-2 bg-white border rounded">
                <div className="font-semibold text-blue-700">{category} ({opts.length})</div>
                <div className="ml-4 mt-1 space-y-1">
                  {opts.map((opt, optIdx) => (
                    <div key={optIdx} className="text-sm">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-gray-600"> ({opt.value})</span>
                      {opt.aliases && opt.aliases.length > 0 && (
                        <div className="text-gray-500 text-xs">Aliases: {opt.aliases.join(', ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Select List Manager</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ✕ Close
          </button>
        )}
      </div>

      {questionId && (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <span className="font-semibold">Question ID:</span> {questionId}
        </div>
      )}

      {/* Existing Options */}
      {existingOptions && existingOptions.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 rounded border border-green-200">
          <h3 className="font-semibold text-green-800 mb-2">
            ✓ Existing Options Found ({existingOptions.length})
          </h3>
          <p className="text-sm text-green-700">
            This question already has {existingOptions.length} options defined.
            Uploading new options will add to or replace the existing ones.
          </p>
        </div>
      )}

      {/* List Type Selection */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Select List Type</label>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="1d"
              checked={listType === '1d'}
              onChange={(e) => setListType(e.target.value)}
              className="mr-2"
            />
            <span>1D - Flat List</span>
            <span className="ml-2 text-sm text-gray-500">(e.g., Cover Types)</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="2d"
              checked={listType === '2d'}
              onChange={(e) => setListType(e.target.value)}
              className="mr-2"
            />
            <span>2D - Hierarchical</span>
            <span className="ml-2 text-sm text-gray-500">(e.g., Manufacturer &gt; Model)</span>
          </label>
        </div>
      </div>

      {/* CSV Format Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded border">
        <h3 className="font-semibold mb-2">CSV Format:</h3>
        {listType === '1d' ? (
          <div className="text-sm space-y-1">
            <p><strong>Headers:</strong> label, value, aliases, phonetics</p>
            <p className="text-gray-600">Example: "Comprehensive", "comprehensive", "Comp|Fully Comp", ""</p>
          </div>
        ) : (
          <div className="text-sm space-y-1">
            <p><strong>Headers:</strong> category, label, value, aliases, phonetics</p>
            <p className="text-gray-600">Example: "Toyota", "Corolla", "toyota_corolla", "Toyota Corolla|Corolla", ""</p>
          </div>
        )}
        <button
          onClick={downloadTemplate}
          className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ↓ Download {listType.toUpperCase()} Template
        </button>
      </div>

      {/* CSV Upload */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Upload CSV File</label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      {/* CSV Text Area */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Or Paste CSV Content</label>
        <textarea
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          rows={8}
          className="w-full p-3 border rounded font-mono text-sm"
          placeholder={`Paste your CSV content here...\n\n${listType === '1d' ? 'label,value,aliases,phonetics\nComprehensive,comprehensive,"Comp|Fully Comp",""' : 'category,label,value,aliases,phonetics\nToyota,Corolla,toyota_corolla,"Toyota Corolla",""'}`}
        />
      </div>

      {/* Parse Button */}
      <div className="mb-6">
        <button
          onClick={parseCSV}
          disabled={loading || !csvContent.trim()}
          className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
        >
          {loading ? '⏳ Parsing...' : '🔍 Parse CSV'}
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <h4 className="font-semibold text-red-800 mb-2">Errors:</h4>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Parsed Options Preview */}
      {renderOptions()}

      {/* TTL Preview */}
      {ttlPreview && (
        <div className="mt-6">
          <button
            onClick={() => setShowTtlPreview(!showTtlPreview)}
            className="mb-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            {showTtlPreview ? '▼ Hide' : '▶'} TTL Preview
          </button>

          {showTtlPreview && (
            <pre className="p-4 bg-gray-900 text-green-400 rounded overflow-x-auto text-xs max-h-96 overflow-y-auto">
              {ttlPreview}
            </pre>
          )}
        </div>
      )}

      {/* Save Button */}
      {ttlPreview && (
        <div className="mt-6 flex gap-4">
          <button
            onClick={saveToTTL}
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg"
          >
            {loading ? '⏳ Saving...' : '💾 Save to TTL Ontology'}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 p-4 bg-yellow-50 rounded border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">💡 Tips:</h3>
        <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
          <li>Use pipe (|) to separate multiple aliases or phonetics</li>
          <li>Aliases help with fuzzy matching during voice input</li>
          <li>Phonetics provide spelling alternatives for ASR</li>
          <li>1D lists are for simple dropdowns (single tier)</li>
          <li>2D lists support hierarchical selects (category → options)</li>
          <li>Download the template to see the exact format expected</li>
        </ul>
      </div>
    </div>
  );
};

export default SelectListManager;
