/**
 * Field Status Panel Component
 *
 * Displays field-level state tracking for FCA-compliant document extraction.
 * Allows back office operators to:
 * - View all field states and confidence scores
 * - See which fields were extracted vs user-provided
 * - Release fields for re-asking
 * - Lock/unlock fields
 * - View complete audit trail
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Table, Alert, Tabs, Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  FileText,
  User,
  Database,
  Settings,
  History,
  RotateCcw,
  Eye
} from 'lucide-react';

const FIELD_STATE_COLORS = {
  NOT_STARTED: 'gray',
  ASK_PENDING: 'info',
  DOCUMENT_PROCESSING: 'warning',
  COMPLETED: 'success',
  REASK_PENDING: 'failure',
  LOCKED: 'dark'
};

const FIELD_STATE_ICONS = {
  NOT_STARTED: Clock,
  ASK_PENDING: Clock,
  DOCUMENT_PROCESSING: FileText,
  COMPLETED: CheckCircle2,
  REASK_PENDING: AlertTriangle,
  LOCKED: Lock
};

const SOURCE_ICONS = {
  user_input: User,
  document: FileText,
  backoffice: Settings,
  system: Database
};

const FieldStatusPanel = ({ sessionId }) => {
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTrail, setAuditTrail] = useState([]);
  const [stats, setStats] = useState({
    total_fields: 0,
    completed_fields: 0,
    pending_fields: 0
  });

  // Load field states
  const loadFieldStates = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/session/${sessionId}/fields`);

      if (!response.ok) {
        throw new Error(`Failed to load field states: ${response.statusText}`);
      }

      const data = await response.json();
      setFields(data.fields);
      setStats({
        total_fields: data.total_fields,
        completed_fields: data.completed_fields,
        pending_fields: data.pending_fields
      });
    } catch (err) {
      console.error('Error loading field states:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load audit trail for a field
  const loadAuditTrail = async (fieldId) => {
    try {
      const response = await fetch(`/api/session/${sessionId}/field/${fieldId}/audit`);

      if (!response.ok) {
        throw new Error(`Failed to load audit trail: ${response.statusText}`);
      }

      const data = await response.json();
      setAuditTrail(data.audit_trail);
      setSelectedField(fieldId);
      setShowAuditModal(true);
    } catch (err) {
      console.error('Error loading audit trail:', err);
      setError(err.message);
    }
  };

  // Release field for re-ask
  const releaseForReask = async (fieldId, reason) => {
    try {
      const response = await fetch('/api/field/release-for-reask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          field_id: fieldId,
          reason: reason || 'Released by operator for re-verification'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to release field: ${response.statusText}`);
      }

      setSuccess(`Field ${fieldId} released for re-ask`);
      await loadFieldStates(); // Refresh
    } catch (err) {
      console.error('Error releasing field:', err);
      setError(err.message);
    }
  };

  // Lock field
  const lockField = async (fieldId, reason) => {
    try {
      const response = await fetch('/api/field/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          field_id: fieldId,
          reason: reason || 'Locked by operator'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to lock field: ${response.statusText}`);
      }

      setSuccess(`Field ${fieldId} locked`);
      await loadFieldStates(); // Refresh
    } catch (err) {
      console.error('Error locking field:', err);
      setError(err.message);
    }
  };

  // Unlock field
  const unlockField = async (fieldId) => {
    try {
      const response = await fetch('/api/field/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          field_id: fieldId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to unlock field: ${response.statusText}`);
      }

      setSuccess(`Field ${fieldId} unlocked`);
      await loadFieldStates(); // Refresh
    } catch (err) {
      console.error('Error unlocking field:', err);
      setError(err.message);
    }
  };

  // Load on mount and when sessionId changes
  useEffect(() => {
    loadFieldStates();
  }, [sessionId]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionId) {
        loadFieldStates();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId]);

  if (!sessionId) {
    return (
      <Alert color="info">
        <span className="font-medium">No session selected</span>
        <p>Please select a session to view field states</p>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Fields</p>
              <p className="text-2xl font-bold">{stats.total_fields}</p>
            </div>
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed_fields}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-orange-600">{stats.pending_fields}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-400" />
          </div>
        </Card>
      </div>

      {/* Error/Success Alerts */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" onDismiss={() => setSuccess(null)}>
          <span className="font-medium">Success:</span> {success}
        </Alert>
      )}

      {/* Field Status Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Field States</h3>
          <Button size="sm" onClick={loadFieldStates} disabled={loading}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Field ID</Table.HeadCell>
              <Table.HeadCell>Question</Table.HeadCell>
              <Table.HeadCell>State</Table.HeadCell>
              <Table.HeadCell>Value</Table.HeadCell>
              <Table.HeadCell>Source</Table.HeadCell>
              <Table.HeadCell>Confidence</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {Object.entries(fields).map(([fieldId, field]) => {
                const StateIcon = FIELD_STATE_ICONS[field.state] || Clock;
                const SourceIcon = SOURCE_ICONS[field.source] || Database;

                return (
                  <Table.Row key={fieldId} className="bg-white dark:bg-gray-800">
                    <Table.Cell className="font-mono text-xs">{fieldId}</Table.Cell>
                    <Table.Cell>{field.question_id}</Table.Cell>
                    <Table.Cell>
                      <Badge color={FIELD_STATE_COLORS[field.state]} icon={StateIcon}>
                        {field.state}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-medium">{field.value || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <SourceIcon className="w-4 h-4" />
                        <span className="text-sm">{field.source || 'N/A'}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {field.meta?.confidence ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                field.meta.confidence >= 0.85 ? 'bg-green-500' :
                                field.meta.confidence >= 0.70 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${field.meta.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {(field.meta.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        {/* View Audit Trail */}
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => loadAuditTrail(fieldId)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Audit
                        </Button>

                        {/* Release for Re-ask (only if COMPLETED) */}
                        {field.state === 'COMPLETED' && (
                          <Button
                            size="xs"
                            color="warning"
                            onClick={() => releaseForReask(fieldId)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Re-ask
                          </Button>
                        )}

                        {/* Lock/Unlock */}
                        {field.state === 'LOCKED' ? (
                          <Button
                            size="xs"
                            color="success"
                            onClick={() => unlockField(fieldId)}
                          >
                            <Unlock className="w-3 h-3 mr-1" />
                            Unlock
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            color="dark"
                            onClick={() => lockField(fieldId)}
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            Lock
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>

          {Object.keys(fields).length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No fields found for this session
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading field states...</p>
            </div>
          )}
        </div>
      </Card>

      {/* Audit Trail Modal */}
      <Modal show={showAuditModal} onClose={() => setShowAuditModal(false)} size="2xl">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Audit Trail: {selectedField}
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {auditTrail.map((entry, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color={FIELD_STATE_COLORS[entry.to_state]}>
                        {entry.from_state} → {entry.to_state}
                      </Badge>
                      <span className="text-xs text-gray-500">by {entry.changed_by}</span>
                    </div>
                    <p className="text-sm text-gray-700">{entry.notes}</p>
                    {entry.document_id && (
                      <p className="text-xs text-gray-500 mt-1">
                        Document ID: {entry.document_id}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {auditTrail.length === 0 && (
              <p className="text-center text-gray-500">No audit trail entries</p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => setShowAuditModal(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default FieldStatusPanel;
