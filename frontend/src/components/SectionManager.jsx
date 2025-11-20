/**
 * Section Manager Component
 *
 * Manages dialog sections and question assignments with:
 * - Drag-and-drop question reordering within and between sections
 * - Create/edit/delete sections
 * - Semantic aliases and SKOS relationships
 * - Automatic OWL/SPARQL relationship updates
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, TextInput, Textarea, Badge, Alert, Label, Modal } from 'flowbite-react';
import {
  GripVertical,
  Plus,
  Save,
  Trash2,
  Edit,
  FolderPlus,
  AlertCircle,
  CheckCircle,
  Move,
  Tag,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const API_BASE_URL = '/api/config';

const SectionManager = () => {
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionsBySection, setQuestionsBySection] = useState({});
  const [draggedQuestion, setDraggedQuestion] = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editingSectionData, setEditingSectionData] = useState(null);
  const [generatedAliases, setGeneratedAliases] = useState([]);
  const [selectedAliases, setSelectedAliases] = useState({});
  const [generatingAliases, setGeneratingAliases] = useState(false);
  const [expandedSections, setExpandedSections] = useState({}); // Track which sections are expanded

  // New section form state
  const [newSection, setNewSection] = useState({
    sectionId: '',
    sectionTitle: '',
    sectionDescription: '',
    sectionOrder: 1,
    semanticAliases: '',
    skosLabels: ''
  });

  useEffect(() => {
    loadSectionsAndQuestions();
  }, []);

  const loadSectionsAndQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/questions`);
      const data = await response.json();

      setSections(data.sections || []);
      setQuestions(data.questions || []);
      setQuestionsBySection(data.questions_by_section || {});
    } catch (err) {
      setError('Failed to load sections: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, question) => {
    setDraggedQuestion(question);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, sectionId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(sectionId);
  };

  const handleDragLeave = () => {
    setDragOverSection(null);
  };

  const handleDrop = async (e, targetSectionId) => {
    e.preventDefault();
    setDragOverSection(null);

    if (!draggedQuestion) return;

    try {
      setLoading(true);

      // Update question section assignment
      const response = await fetch(`${API_BASE_URL}/question/${draggedQuestion.question_id}/section`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: targetSectionId,
          update_owl: true  // Flag to update OWL relationships
        })
      });

      if (!response.ok) throw new Error('Failed to update section');

      const data = await response.json();
      setSuccess(`Moved "${draggedQuestion.question_text}" to section. OWL relationships updated.`);

      // Reload data to reflect changes
      await loadSectionsAndQuestions();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to move question: ' + err.message);
    } finally {
      setLoading(false);
      setDraggedQuestion(null);
    }
  };

  const handleReorderWithinSection = async (sectionId, questionId, newOrder) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/question/${questionId}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          new_order: newOrder,
          update_owl: true
        })
      });

      if (!response.ok) throw new Error('Failed to reorder question');

      await loadSectionsAndQuestions();
      setSuccess('Question order updated successfully');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to reorder: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSection = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/section/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: newSection.sectionId,
          section_title: newSection.sectionTitle,
          section_description: newSection.sectionDescription,
          section_order: newSection.sectionOrder,
          semantic_aliases: newSection.semanticAliases.split(',').map(s => s.trim()).filter(Boolean),
          skos_labels: newSection.skosLabels.split(',').map(s => s.trim()).filter(Boolean)
        })
      });

      if (!response.ok) throw new Error('Failed to create section');

      setSuccess('Section created successfully with OWL/SKOS relationships');
      setShowNewSectionModal(false);
      setNewSection({
        sectionId: '',
        sectionTitle: '',
        sectionDescription: '',
        sectionOrder: 1,
        semanticAliases: '',
        skosLabels: ''
      });

      await loadSectionsAndQuestions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to create section: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSection = async (section) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/section/${section.section_id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(section)
      });

      if (!response.ok) throw new Error('Failed to update section');

      setSuccess('Section updated successfully');
      setEditingSection(null);
      await loadSectionsAndQuestions();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to update section: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this section? Questions will be unassigned.')) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/section/${sectionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete section');

      setSuccess('Section deleted successfully');
      await loadSectionsAndQuestions();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to delete section: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSection = (section) => {
    setEditingSection(section);
    setEditingSectionData({
      section_title: section.section_title || '',
      section_description: section.section_description || '',
      section_order: section.section_order || 1,
      semantic_aliases: section.semantic_aliases || []
    });
    setGeneratedAliases([]);

    // Pre-select existing aliases
    const selected = {};
    (section.semantic_aliases || []).forEach(alias => {
      selected[alias] = true;
    });
    setSelectedAliases(selected);
  };

  const handleGenerateAliases = async () => {
    if (!editingSectionData) return;

    try {
      setGeneratingAliases(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/section/generate-aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_title: editingSectionData.section_title,
          section_description: editingSectionData.section_description
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate aliases');
      }

      const data = await response.json();
      setGeneratedAliases(data.aliases || []);
      setSuccess(`Generated ${data.count} semantic aliases using AI`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to generate aliases: ' + err.message);
    } finally {
      setGeneratingAliases(false);
    }
  };

  const toggleAlias = (alias) => {
    setSelectedAliases(prev => ({
      ...prev,
      [alias]: !prev[alias]
    }));
  };

  const handleSaveEditedSection = async () => {
    if (!editingSection || !editingSectionData) return;

    try {
      setLoading(true);

      // Get selected aliases
      const finalAliases = Object.keys(selectedAliases).filter(alias => selectedAliases[alias]);

      const response = await fetch(`${API_BASE_URL}/section/${editingSection.section_id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_title: editingSectionData.section_title,
          section_description: editingSectionData.section_description,
          section_order: editingSectionData.section_order,
          semantic_aliases: finalAliases
        })
      });

      if (!response.ok) throw new Error('Failed to update section');

      setSuccess('Section updated successfully with ' + finalAliases.length + ' aliases');
      setEditingSection(null);
      setEditingSectionData(null);
      setGeneratedAliases([]);
      setSelectedAliases({});
      await loadSectionsAndQuestions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update section: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSectionExpansion = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Section Manager</h1>
          <p className="text-gray-600 mt-1">Organize questions into sections with drag-and-drop</p>
        </div>
        <Button
          color="blue"
          onClick={() => setShowNewSectionModal(true)}
        >
          <FolderPlus className="w-4 h-4 mr-2" />
          New Section
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" onDismiss={() => setSuccess(null)}>
          <CheckCircle className="w-4 h-4 mr-2" />
          {success}
        </Alert>
      )}

      {/* Sections List */}
      <div className="space-y-4">
        {loading && sections.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500">Loading sections...</p>
          </Card>
        ) : sections.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <FolderPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No sections created yet</p>
              <p className="text-gray-400 text-sm mt-2">Create your first section to organize questions</p>
            </div>
          </Card>
        ) : (
          sections
            .sort((a, b) => (a.section_order || 0) - (b.section_order || 0))
            .map((section) => (
              <Card
                key={section.section_id}
                className={`transition-all ${
                  dragOverSection === section.section_id
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : ''
                }`}
                onDragOver={(e) => handleDragOver(e, section.section_id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, section.section_id)}
              >
                {/* Section Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b">
                  <div className="flex-1">
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
                      onClick={() => toggleSectionExpansion(section.section_id)}
                    >
                      <div className="flex-shrink-0">
                        {expandedSections[section.section_id] ? (
                          <ChevronDown className="w-6 h-6 text-blue-600 font-bold" />
                        ) : (
                          <ChevronRight className="w-6 h-6 text-blue-600 font-bold" />
                        )}
                      </div>
                      <Badge color="info" className="text-sm">
                        Order: {section.section_order}
                      </Badge>
                      <h3 className="text-xl font-bold text-white">
                        {section.section_title}
                      </h3>
                      <Badge color="gray" size="sm" className="ml-2">
                        {questionsBySection[section.section_id]?.length || 0} questions
                      </Badge>
                    </div>
                    <p className="text-gray-300 text-sm mt-2">{section.section_description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge color="gray" size="xs">
                        ID: {section.section_id}
                      </Badge>
                      {section.semantic_aliases && (
                        <Badge color="purple" size="xs">
                          <Tag className="w-3 h-3 mr-1" />
                          Aliases: {section.semantic_aliases.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      color="light"
                      onClick={() => handleEditSection(section)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      color="failure"
                      onClick={() => handleDeleteSection(section.section_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Questions in this section - Only show when expanded */}
                {expandedSections[section.section_id] && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Move className="w-4 h-4 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-200">
                        Questions ({questionsBySection[section.section_id]?.length || 0})
                      </p>
                    </div>

                    {questionsBySection[section.section_id]?.length === 0 ||
                    !questionsBySection[section.section_id] ? (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-600 text-sm">
                          Drop questions here to assign them to this section
                        </p>
                      </div>
                    ) : (
                      questionsBySection[section.section_id]
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((question, index) => (
                          <div
                            key={question.question_id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, question)}
                            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-move group"
                          >
                            <GripVertical className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge color="gray" size="xs">
                                  {question.order || index + 1}
                                </Badge>
                                <p className="font-semibold text-gray-900">
                                  {question.question_text}
                                </p>
                              </div>
                              <div className="flex gap-2 mt-1">
                                <Badge color="blue" size="xs">
                                  {question.question_id}
                                </Badge>
                                <Badge color="gray" size="xs">
                                  Slot: {question.slot_name}
                                </Badge>
                                {question.required && (
                                  <Badge color="failure" size="xs">Required</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </Card>
            ))
        )}
      </div>

      {/* New Section Modal */}
      {showNewSectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Create New Section</h2>
              <button onClick={() => setShowNewSectionModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sectionId">Section ID*</Label>
              <TextInput
                id="sectionId"
                value={newSection.sectionId}
                onChange={(e) => setNewSection({ ...newSection, sectionId: e.target.value })}
                placeholder="e.g., section_vehicle_details"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Use lowercase with underscores (e.g., section_personal_info)
              </p>
            </div>

            <div>
              <Label htmlFor="sectionTitle">Section Title*</Label>
              <TextInput
                id="sectionTitle"
                value={newSection.sectionTitle}
                onChange={(e) => setNewSection({ ...newSection, sectionTitle: e.target.value })}
                placeholder="e.g., Vehicle Details"
                required
              />
            </div>

            <div>
              <Label htmlFor="sectionDescription">Description</Label>
              <Textarea
                id="sectionDescription"
                value={newSection.sectionDescription}
                onChange={(e) => setNewSection({ ...newSection, sectionDescription: e.target.value })}
                placeholder="Brief description of this section"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="sectionOrder">Display Order</Label>
              <TextInput
                id="sectionOrder"
                type="number"
                value={newSection.sectionOrder}
                onChange={(e) => setNewSection({ ...newSection, sectionOrder: parseInt(e.target.value) })}
                min="1"
              />
            </div>

            <div>
              <Label htmlFor="semanticAliases">Semantic Aliases (SKOS:altLabel)</Label>
              <TextInput
                id="semanticAliases"
                value={newSection.semanticAliases}
                onChange={(e) => setNewSection({ ...newSection, semanticAliases: e.target.value })}
                placeholder="car info, vehicle data, auto details (comma-separated)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Alternative names for semantic search and NLP
              </p>
            </div>

            <div>
              <Label htmlFor="skosLabels">SKOS Preferred Labels</Label>
              <TextInput
                id="skosLabels"
                value={newSection.skosLabels}
                onChange={(e) => setNewSection({ ...newSection, skosLabels: e.target.value })}
                placeholder="Vehicle Information, Car Details (comma-separated)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formal labels for knowledge graph relationships
              </p>
            </div>

            <Alert color="info">
              <p className="text-sm">
                <strong>OWL/SPARQL Relationships:</strong> Creating a section will automatically:
              </p>
              <ul className="text-sm mt-2 ml-4 list-disc">
                <li>Add OWL Class definition to dialog-sections.ttl</li>
                <li>Create SKOS:Concept with prefLabel and altLabel properties</li>
                <li>Establish rdfs:label and rdfs:comment annotations</li>
                <li>Define section ordering relationships</li>
              </ul>
            </Alert>
          </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button color="gray" onClick={() => setShowNewSectionModal(false)}>
                Cancel
              </Button>
              <Button
                color="blue"
                onClick={handleCreateSection}
                disabled={!newSection.sectionId || !newSection.sectionTitle}
              >
                <Save className="w-4 h-4 mr-2" />
                Create Section
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit Section</h2>
              <button
                onClick={() => {
                  setEditingSection(null);
                  setEditingSectionData(null);
                  setGeneratedAliases([]);
                  setSelectedAliases({});
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          {editingSectionData && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editSectionTitle">Section Title*</Label>
                <TextInput
                  id="editSectionTitle"
                  value={editingSectionData.section_title}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, section_title: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="editSectionDescription">Description</Label>
                <Textarea
                  id="editSectionDescription"
                  value={editingSectionData.section_description}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, section_description: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="editSectionOrder">Display Order</Label>
                <TextInput
                  id="editSectionOrder"
                  type="number"
                  value={editingSectionData.section_order}
                  onChange={(e) => setEditingSectionData({ ...editingSectionData, section_order: parseInt(e.target.value) })}
                  min="1"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Semantic Aliases</Label>
                  <Button
                    size="sm"
                    color="purple"
                    onClick={handleGenerateAliases}
                    disabled={generatingAliases}
                  >
                    {generatingAliases ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>

                {generatedAliases.length > 0 && (
                  <Alert color="info" className="mb-3">
                    <p className="text-sm">
                      Select aliases to add to this section. These will be used for semantic search and NLP matching.
                    </p>
                  </Alert>
                )}

                {/* Generated Aliases Checkboxes */}
                {generatedAliases.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-semibold mb-2">Generated Aliases ({generatedAliases.length}):</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {generatedAliases.map((alias, index) => (
                        <label key={index} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedAliases[alias] || false}
                            onChange={() => toggleAlias(alias)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">{alias}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Aliases (if any not in generated) */}
                {editingSectionData.semantic_aliases && editingSectionData.semantic_aliases.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold mb-2">Current Aliases:</p>
                    <div className="flex flex-wrap gap-2">
                      {editingSectionData.semantic_aliases.map((alias, index) => (
                        <Badge key={index} color={selectedAliases[alias] ? "success" : "gray"}>
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected count */}
                <div className="mt-3">
                  <Badge color="blue">
                    {Object.keys(selectedAliases).filter(k => selectedAliases[k]).length} aliases selected
                  </Badge>
                </div>
              </div>
            </div>
          )}
            <div className="flex justify-end gap-2 mt-6">
              <Button
                color="gray"
                onClick={() => {
                  setEditingSection(null);
                  setEditingSectionData(null);
                  setGeneratedAliases([]);
                  setSelectedAliases({});
                }}
              >
                Cancel
              </Button>
              <Button
                color="blue"
                onClick={handleSaveEditedSection}
                disabled={!editingSectionData || !editingSectionData.section_title || loading}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionManager;
