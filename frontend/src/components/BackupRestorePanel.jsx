import React, { useState, useEffect } from 'react';
import {
  createSnapshot,
  getSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  exportWorkspace,
  importWorkspace,
  exportPortableWorkspace,
  importPortableWorkspace
} from '../utils/storageEngine';
import { createZipArchive, extractZipArchive } from '../utils/compression';

const BackupRestorePanel = ({ isOpen, onClose, items = [], onRefresh }) => {
  const [activeTab, setActiveTab] = useState('snapshot');
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [backupName, setBackupName] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState('daily');

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen]);

  const loadSnapshots = () => {
    const snaps = getSnapshots();
    setSnapshots(snaps);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Create a new snapshot
  const handleCreateSnapshot = async () => {
    setLoading(true);
    setProgress(0);
    
    try {
      const name = backupName.trim() || `Backup ${new Date().toLocaleDateString()}`;
      const result = await createSnapshot(name);
      
      if (result.success) {
        loadSnapshots();
        setBackupName('');
        showMessage('success', `Snapshot "${name}" created successfully`);
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      showMessage('error', `Failed to create snapshot: ${error.message}`);
    }
    
    setLoading(false);
    setProgress(100);
  };

  // Restore from snapshot
  const handleRestoreSnapshot = async (snapshotId, snapshotName) => {
    if (!confirm(`Restore from "${snapshotName}"? This will replace all current data.`)) return;
    
    setLoading(true);
    setProgress(0);
    
    try {
      const result = await restoreSnapshot(snapshotId);
      
      if (result.success) {
        onRefresh?.();
        showMessage('success', 'Snapshot restored successfully');
      } else {
        showMessage('error', result.error);
      }
    } catch (error) {
      showMessage('error', `Failed to restore: ${error.message}`);
    }
    
    setLoading(false);
  };

  // Delete snapshot
  const handleDeleteSnapshot = async (snapshotId, snapshotName) => {
    if (!confirm(`Delete snapshot "${snapshotName}"?`)) return;
    
    const result = deleteSnapshot(snapshotId);
    if (result.success) {
      loadSnapshots();
      showMessage('success', 'Snapshot deleted');
    } else {
      showMessage('error', result.error);
    }
  };

  // Export selected items as ZIP
  const handleExportSelected = async () => {
    if (selectedItems.length === 0) {
      showMessage('warning', 'Select items to export');
      return;
    }

    setLoading(true);
    try {
      const filesToZip = selectedItems.map(item => ({
        name: item.name,
        data: item.content || new TextEncoder().encode(item.name)
      }));

      const result = await createZipArchive(filesToZip, {
        filename: `export_${Date.now()}.zip`,
        onProgress: setProgress
      });

      if (result.success) {
        const blob = new Blob([result.data], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        showMessage('success', `Exported ${selectedItems.length} items`);
      }
    } catch (error) {
      showMessage('error', `Export failed: ${error.message}`);
    }
    setLoading(false);
  };

  // Full workspace export
  const handleFullExport = async () => {
    setLoading(true);
    try {
      const result = await exportWorkspace();
      const blob = new Blob([result.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('success', `Full backup exported (${formatBytes(result.size)})`);
    } catch (error) {
      showMessage('error', `Export failed: ${error.message}`);
    }
    setLoading(false);
  };

  // Import workspace
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Check file type
      if (file.name.endsWith('.zip')) {
        // Extract ZIP
        const result = await extractZipArchive(arrayBuffer, { onProgress: setProgress });
        if (result.success) {
          showMessage('success', `Extracted ${result.fileCount} files`);
          onRefresh?.();
        }
      } else if (file.name.endsWith('.dmx')) {
        // Import workspace
        const merge = confirm('Merge with existing data? (Cancel to replace)');
        const result = await importWorkspace(new Uint8Array(arrayBuffer), { merge });
        if (result.success) {
          showMessage('success', `Imported ${result.importedFiles} files`);
          onRefresh?.();
        }
      } else if (file.name.endsWith('.dmxp')) {
        // Import portable
        const text = await file.text();
        const result = await importPortableWorkspace(text);
        if (result.success) {
          showMessage('success', 'Portable workspace imported');
          onRefresh?.();
        }
      } else {
        showMessage('error', 'Unsupported file format');
      }
    } catch (error) {
      showMessage('error', `Import failed: ${error.message}`);
    }
    setLoading(false);
    event.target.value = '';
  };

  // Toggle item selection
  const toggleItemSelection = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...items]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <h2 className="text-xl font-bold">Backup & Restore</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`px-4 py-2 ${
            message.type === 'success' ? 'bg-green-100 text-green-800' :
            message.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Progress */}
        {loading && progress > 0 && (
          <div className="px-4 py-2 bg-gray-100">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b flex">
          {['snapshot', 'export', 'import'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-green-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-gray-700">Processing...</span>
              </div>
            </div>
          )}

          {/* Snapshot Tab */}
          {activeTab === 'snapshot' && (
            <div className="space-y-6">
              {/* Create Snapshot */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Create Snapshot</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                    placeholder="Snapshot name (optional)"
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleCreateSnapshot}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Create Snapshot
                  </button>
                </div>
              </div>

              {/* Snapshot List */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Available Snapshots</h3>
                {snapshots.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No snapshots created yet</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {snapshots.map(snap => (
                      <div 
                        key={snap.id} 
                        className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">{snap.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatDate(snap.createdAt)} • {formatBytes(snap.size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestoreSnapshot(snap.id, snap.name)}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteSnapshot(snap.id, snap.name)}
                            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Automatic Backups</h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleEnabled}
                      onChange={(e) => setScheduleEnabled(e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <span>Enable scheduled backups</span>
                  </label>
                  <select
                    value={scheduleInterval}
                    onChange={(e) => setScheduleInterval(e.target.value)}
                    disabled={!scheduleEnabled}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                  >
                    <option value="hourly">Every hour</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Full Export */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Full Workspace Export</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Export all files, settings, and metadata as a single backup file.
                </p>
                <button
                  onClick={handleFullExport}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export Full Backup (.dmx)
                </button>
              </div>

              {/* Selective Export */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Selective Export</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select specific items to export as a ZIP file.
                </p>
                
                {items.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedItems.length === items.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-sm">Select all ({items.length} items)</span>
                      </label>
                      <span className="text-sm text-gray-500">{selectedItems.length} selected</span>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto border rounded-lg bg-white">
                      {items.map(item => (
                        <label 
                          key={item.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.some(i => i.id === item.id)}
                            onChange={() => toggleItemSelection(item)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                          <span className="text-sm truncate">{item.name}</span>
                        </label>
                      ))}
                    </div>
                    
                    <button
                      onClick={handleExportSelected}
                      disabled={loading || selectedItems.length === 0}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Export Selected as ZIP
                    </button>
                  </>
                ) : (
                  <p className="text-gray-500 text-center py-4">No items available to export</p>
                )}
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Import Backup</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Import from a backup file. Supported formats: .dmx, .dmxp, .zip
                </p>
                
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400">.dmx, .dmxp, or .zip files</p>
                  </div>
                  <input
                    type="file"
                    accept=".dmx,.dmxp,.zip"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-3">Supported Formats</h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex items-center gap-2">
                    <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">.dmx</span>
                    <span>DocMatrix workspace backup</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">.dmxp</span>
                    <span>Portable workspace (USB-ready)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">.zip</span>
                    <span>Standard ZIP archive</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupRestorePanel;
