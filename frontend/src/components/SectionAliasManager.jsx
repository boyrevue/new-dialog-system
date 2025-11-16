import React, { useState, useEffect } from 'react';

/**
 * SectionAliasManager - Manage semantic aliases for dialog sections
 *
 * Features:
 * - Edit section titles, descriptions, icons
 * - Add/remove aliases for voice recognition
 * - Add/remove phonetic spellings for ASR
 * - Preview TTL before saving
 * - Real-time validation
 */
const SectionAliasManager = ({ sectionId, onSave, onCancel }) => {
  const [section, setSection] = useState({
    section_id: '',
    title: '',
    description: '',
    icon: '',
    aliases: [],
    phonetics: [],
    order: 1
  });

  const [newAlias, setNewAlias] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [ttlPreview, setTtlPreview] = useState('');
  const [showTtlPreview, setShowTtlPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Common icons for quick selection
  const commonIcons = [
    { icon: '👤', label: 'Person' },
    { icon: '🚗', label: 'Car' },
    { icon: '📄', label: 'Document' },
    { icon: '📋', label: 'Clipboard' },
    { icon: '💳', label: 'Payment' },
    { icon: '➕', label: 'Plus' },
    { icon: '📧', label: 'Email' },
    { icon: '🏠', label: 'Home' },
    { icon: '📞', label: 'Phone' },
    { icon: '⚙️', label: 'Settings' },
    { icon: '📊', label: 'Chart' },
    { icon: '🔒', label: 'Lock' },
    { icon: '✅', label: 'Check' },
    { icon: '❌', label: 'Cross' },
    { icon: '⚠️', label: 'Warning' },
    { icon: '💡', label: 'Idea' }
  ];

  // Load section data when component mounts
  useEffect(() => {
    if (sectionId) {
      loadSectionData();
    }
  }, [sectionId]);

  const loadSectionData = async () => {
    setLoading(true);
    setErrors([]);

    try {
      const response = await fetch(`http://localhost:8002/api/config/section/${sectionId}`);
      const data = await response.json();

      if (data.section) {
        setSection({
          section_id: data.section.section_id || '',
          title: data.section.title || '',
          description: data.section.description || '',
          icon: data.section.icon || '',
          aliases: data.section.aliases || [],
          phonetics: data.section.phonetics || [],
          order: data.section.order || 1
        });
      }
    } catch (error) {
      console.error('Error loading section:', error);
      setErrors(['Failed to load section data: ' + error.message]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = () => {
    if (!newAlias.trim()) {
      return;
    }

    if (section.aliases.includes(newAlias.trim())) {
      setErrors(['This alias already exists']);
      return;
    }

    setSection({
      ...section,
      aliases: [...section.aliases, newAlias.trim()]
    });
    setNewAlias('');
    setErrors([]);
  };

  const handleRemoveAlias = (index) => {
    setSection({
      ...section,
      aliases: section.aliases.filter((_, i) => i !== index)
    });
  };

  const handleAddPhonetic = () => {
    if (!newPhonetic.trim()) {
      return;
    }

    if (section.phonetics.includes(newPhonetic.trim())) {
      setErrors(['This phonetic spelling already exists']);
      return;
    }

    setSection({
      ...section,
      phonetics: [...section.phonetics, newPhonetic.trim()]
    });
    setNewPhonetic('');
    setErrors([]);
  };

  const handleRemovePhonetic = (index) => {
    setSection({
      ...section,
      phonetics: section.phonetics.filter((_, i) => i !== index)
    });
  };

  const generateTTLPreview = () => {
    const sectionUri = `:${section.section_id || 'NewSection'}`;

    const aliasesStr = section.aliases.length > 0
      ? section.aliases.map(a => `"${a}"`).join(', ')
      : '';

    const phoneticsStr = section.phonetics.length > 0
      ? section.phonetics.map(p => `"${p}"`).join(', ')
      : '';

    let ttl = `# Section: ${section.title || 'Untitled Section'}\n`;
    ttl += `${sectionUri} a :Section ;\n`;
    ttl += `    rdfs:label "${section.title || 'Untitled'}" ;\n`;
    ttl += `    :sectionTitle "${section.icon ? section.icon + ' ' : ''}${section.title || 'Untitled'}" ;\n`;

    if (section.description) {
      ttl += `    :sectionDescription "${section.description}" ;\n`;
    }

    if (aliasesStr) {
      ttl += `    :sectionAlias ${aliasesStr} ;\n`;
    }

    if (phoneticsStr) {
      ttl += `    :sectionPhonetic ${phoneticsStr} ;\n`;
    }

    if (section.icon) {
      ttl += `    :sectionIcon "${section.icon}" ;\n`;
    }

    ttl += `    :order ${section.order} .\n`;

    return ttl;
  };

  const handleGeneratePreview = () => {
    const preview = generateTTLPreview();
    setTtlPreview(preview);
    setShowTtlPreview(true);
  };

  const handleSave = async () => {
    // Validation
    if (!section.title.trim()) {
      setErrors(['Section title is required']);
      return;
    }

    setLoading(true);
    setErrors([]);
    setSuccessMessage('');

    try {
      const response = await fetch('http://localhost:8002/api/config/section/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: section.section_id,
          title: section.title,
          description: section.description,
          icon: section.icon,
          aliases: section.aliases,
          phonetics: section.phonetics,
          order: section.order,
          ttl_content: generateTTLPreview()
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Section "${section.title}" saved successfully!`);
        if (onSave) onSave(data);
      } else {
        setErrors(['Failed to save: ' + (data.detail || 'Unknown error')]);
      }
    } catch (error) {
      console.error('Error saving section:', error);
      setErrors(['Failed to save: ' + error.message]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Section Alias Manager</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800">✓ {successMessage}</p>
        </div>
      )}

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

      {/* Section Basic Info */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block font-semibold mb-2">Section ID</label>
          <input
            type="text"
            value={section.section_id}
            onChange={(e) => setSection({ ...section, section_id: e.target.value })}
            className="w-full p-3 border rounded"
            placeholder="e.g., DriversSection"
            disabled={sectionId} // Can't change ID if editing existing
          />
          <p className="text-sm text-gray-500 mt-1">
            Unique identifier (CamelCase, no spaces)
          </p>
        </div>

        <div>
          <label className="block font-semibold mb-2">Section Title</label>
          <input
            type="text"
            value={section.title}
            onChange={(e) => setSection({ ...section, title: e.target.value })}
            className="w-full p-3 border rounded"
            placeholder="e.g., Driver Information"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">Description</label>
          <textarea
            value={section.description}
            onChange={(e) => setSection({ ...section, description: e.target.value })}
            rows={3}
            className="w-full p-3 border rounded"
            placeholder="Brief description of what this section collects"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">Icon</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={section.icon}
              onChange={(e) => setSection({ ...section, icon: e.target.value })}
              className="w-24 p-3 border rounded text-center text-2xl"
              placeholder="📄"
              maxLength={2}
            />
            <span className="text-4xl">{section.icon || '❓'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {commonIcons.map(({ icon, label }) => (
              <button
                key={icon}
                onClick={() => setSection({ ...section, icon })}
                className="px-3 py-2 bg-gray-100 hover:bg-blue-100 rounded border text-xl"
                title={label}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2">Order</label>
          <input
            type="number"
            value={section.order}
            onChange={(e) => setSection({ ...section, order: parseInt(e.target.value) || 1 })}
            className="w-32 p-3 border rounded"
            min="1"
          />
          <p className="text-sm text-gray-500 mt-1">
            Display order in the dialog flow
          </p>
        </div>
      </div>

      {/* Aliases Section */}
      <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-3">Semantic Aliases</h3>
        <p className="text-sm text-blue-700 mb-3">
          Alternative names for voice recognition and natural language understanding
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddAlias()}
            className="flex-1 p-2 border rounded"
            placeholder="e.g., Driver Info, About the Driver"
          />
          <button
            onClick={handleAddAlias}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + Add Alias
          </button>
        </div>

        {section.aliases.length > 0 && (
          <div className="space-y-2">
            {section.aliases.map((alias, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                <span className="flex-1">{alias}</span>
                <button
                  onClick={() => handleRemoveAlias(idx)}
                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {section.aliases.length === 0 && (
          <p className="text-sm text-gray-500 italic">No aliases added yet</p>
        )}
      </div>

      {/* Phonetics Section */}
      <div className="mb-6 p-4 bg-purple-50 rounded border border-purple-200">
        <h3 className="font-semibold text-purple-800 mb-3">Phonetic Spellings</h3>
        <p className="text-sm text-purple-700 mb-3">
          Phonetic variations for ASR (Automatic Speech Recognition)
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newPhonetic}
            onChange={(e) => setNewPhonetic(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddPhonetic()}
            className="flex-1 p-2 border rounded"
            placeholder="e.g., Dryver Info, Vee Hickle Details"
          />
          <button
            onClick={handleAddPhonetic}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            + Add Phonetic
          </button>
        </div>

        {section.phonetics.length > 0 && (
          <div className="space-y-2">
            {section.phonetics.map((phonetic, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                <span className="flex-1">{phonetic}</span>
                <button
                  onClick={() => handleRemovePhonetic(idx)}
                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {section.phonetics.length === 0 && (
          <p className="text-sm text-gray-500 italic">No phonetic spellings added yet</p>
        )}
      </div>

      {/* Preview Section */}
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Preview</h3>
        <div className="p-4 bg-gray-50 rounded border">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{section.icon || '❓'}</span>
            <div>
              <div className="font-bold text-lg">{section.title || 'Untitled Section'}</div>
              <div className="text-sm text-gray-600">{section.description || 'No description'}</div>
            </div>
          </div>

          {section.aliases.length > 0 && (
            <div className="mt-3 text-sm">
              <span className="font-semibold">Aliases: </span>
              <span className="text-gray-700">{section.aliases.join(', ')}</span>
            </div>
          )}

          {section.phonetics.length > 0 && (
            <div className="mt-1 text-sm">
              <span className="font-semibold">Phonetics: </span>
              <span className="text-gray-700">{section.phonetics.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* TTL Preview Button */}
      <div className="mb-6">
        <button
          onClick={handleGeneratePreview}
          className="px-6 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 font-semibold"
        >
          {showTtlPreview ? '🔄 Refresh' : '👁️ Generate'} TTL Preview
        </button>
      </div>

      {/* TTL Preview Display */}
      {showTtlPreview && ttlPreview && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">TTL/RDF Output</h3>
          <pre className="p-4 bg-gray-900 text-green-400 rounded overflow-x-auto text-sm max-h-64 overflow-y-auto font-mono">
            {ttlPreview}
          </pre>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={loading || !section.title.trim()}
          className="px-8 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg"
        >
          {loading ? '⏳ Saving...' : '💾 Save Section'}
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

      {/* Help Section */}
      <div className="mt-8 p-4 bg-yellow-50 rounded border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">💡 Tips:</h3>
        <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
          <li><strong>Aliases</strong> help users navigate with natural language (e.g., "Driver Info" instead of "Driver Information")</li>
          <li><strong>Phonetics</strong> help ASR understand spelled-out or mispronounced words</li>
          <li><strong>Icons</strong> provide visual cues and improve UX in the dialog flow</li>
          <li>Add multiple variations to improve voice recognition accuracy</li>
          <li>Use descriptive titles that clearly indicate what the section collects</li>
          <li>Order determines the sequence in the dialog flow (lower numbers appear first)</li>
        </ul>
      </div>
    </div>
  );
};

export default SectionAliasManager;
