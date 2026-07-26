import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  Save, X, Check, AlertCircle, ShieldCheck, Search, File, EyeOff, RefreshCw, Trash2
} from 'lucide-react';

const BackupRestorePanel = ({ isOpen, onClose, items = [], onRefresh }) => {
  const [backedUpDocs, setBackedUpDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceFiles, setSelectedWorkspaceFiles] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchBackedUpDocuments();
    }
  }, [isOpen]);

  const fetchBackedUpDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/documents/backups/list');
      const docs = res.data?.documents || res.data || [];
      setBackedUpDocs(docs);
    } catch (error) {
      console.error("Failed to fetch backed up documents", error);
      // Fallback try legacy route
      try {
        const res2 = await api.get('/v1/backups');
        setBackedUpDocs(res2.data?.documents || res2.data || []);
      } catch (err) {
        showMessage('error', 'Failed to load backed up documents');
      }
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Add selected workspace files to Google Drive Backup protection
  const handleAddSelectedToBackup = async () => {
    if (selectedWorkspaceFiles.length === 0) return;
    setLoading(true);
    let count = 0;
    for (const docId of selectedWorkspaceFiles) {
      try {
        await api.post(`/v1/documents/${docId}/backup?is_backed_up=true`);
        count++;
      } catch (err) {
        console.error(`Failed to add file ${docId} to backup`, err);
      }
    }
    setSelectedWorkspaceFiles([]);
    await fetchBackedUpDocuments();
    if (onRefresh) onRefresh();
    showMessage('success', `Added ${count} file(s) to Google Drive Backup protection`);
    setLoading(false);
  };

  // Toggle single file backup status
  const handleToggleBackup = async (docId, isBackedUp) => {
    try {
      await api.post(`/v1/documents/${docId}/backup?is_backed_up=${isBackedUp}`);
      await fetchBackedUpDocuments();
      if (onRefresh) onRefresh();
      showMessage('success', isBackedUp ? 'File added to Google Drive Backup' : 'Removed from Backup protection');
    } catch (err) {
      showMessage('error', 'Failed to update backup status');
    }
  };

  // Restore document to Dashboard / Workspace
  const handleRestoreToWorkspace = async (docId, name) => {
    try {
      await api.post(`/v1/documents/backups/${docId}/restore`);
      await fetchBackedUpDocuments();
      if (onRefresh) onRefresh();
      showMessage('success', `"${name}" restored to Workspace Dashboard`);
    } catch (err) {
      showMessage('error', 'Failed to restore document');
    }
  };

  // Delete permanently from Google Drive
  const handleDeletePermanentlyFromDrive = async (docId, name) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}" from Google Drive? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/v1/documents/backups/${docId}`);
      await fetchBackedUpDocuments();
      if (onRefresh) onRefresh();
      showMessage('success', `"${name}" permanently deleted from Google Drive`);
    } catch (err) {
      showMessage('error', 'Failed to delete file from Google Drive');
    }
  };

  if (!isOpen) return null;

  // Filter workspace files available to add
  const availableWorkspaceFiles = items.filter(
    item => item.type !== 'folder' && !item.trash && !item.deleted_at
  );

  const filteredBackedUpDocs = backedUpDocs.filter(doc =>
    (doc.display_name || doc.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Save size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Google Drive Backup Protection Manager</h3>
              <p className="text-xs text-slate-500">Backed-up files are preserved safely in Google Drive even if deleted from the dashboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100' : 'bg-red-50 text-red-800 border-b border-red-100'
          }`}>
            {message.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">

          {/* Section 1: Add Workspace Files to Backup */}
          {availableWorkspaceFiles.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">Add Workspace Files to Backup Protection</h4>
                  <p className="text-xs text-slate-600">Select active files from your workspace to enable Google Drive Backup protection</p>
                </div>
                <button
                  onClick={handleAddSelectedToBackup}
                  disabled={selectedWorkspaceFiles.length === 0 || loading}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck size={14} />
                  <span>Protect Selected ({selectedWorkspaceFiles.length})</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                {availableWorkspaceFiles.map(file => {
                  const isBackedUp = backedUpDocs.some(b => b.id === file.id && !b.is_hidden_from_workspace);
                  const isChecked = selectedWorkspaceFiles.includes(file.id);

                  return (
                    <label
                      key={file.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                        isBackedUp
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : isChecked
                          ? 'bg-indigo-100/70 border-indigo-300 text-indigo-900 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isBackedUp}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWorkspaceFiles([...selectedWorkspaceFiles, file.id]);
                          } else {
                            setSelectedWorkspaceFiles(selectedWorkspaceFiles.filter(id => id !== file.id));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                      <span className="truncate flex-1">{file.name || file.display_name}</span>
                      {isBackedUp && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">Protected</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Backed-up Documents List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Protected Google Drive Backup List</h4>
                <p className="text-xs text-slate-500">Files listed here remain safely preserved in Google Drive</p>
              </div>
              <div className="relative w-48">
                <input
                  type="text"
                  placeholder="Search backups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search size={13} />
                </span>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 text-xs">Loading Google Drive backup items...</div>
            ) : filteredBackedUpDocs.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                <Save size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No Backed Up Files Found</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Select files from your workspace above and click "Protect Selected" to add them to Google Drive Backup protection.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-soft">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Document Name</th>
                      <th className="px-4 py-2.5">Size</th>
                      <th className="px-4 py-2.5">Workspace Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredBackedUpDocs.map(doc => {
                      const isHiddenFromWorkspace = doc.is_hidden_from_workspace || doc.trash;

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                            <File size={15} className="text-indigo-600 flex-shrink-0" />
                            <span className="truncate max-w-xs">{doc.display_name || doc.name}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatBytes(doc.size_bytes || doc.size)}</td>
                          <td className="px-4 py-3">
                            {isHiddenFromWorkspace ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                                <EyeOff size={11} /> Preserved in Drive / Hidden from Dashboard
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                                <Check size={11} /> Active in Dashboard
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isHiddenFromWorkspace && (
                                <button
                                  onClick={() => handleRestoreToWorkspace(doc.id, doc.display_name || doc.name)}
                                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-medium hover:bg-indigo-700 transition flex items-center gap-1"
                                  title="Restore file visibility to workspace dashboard"
                                >
                                  <RefreshCw size={12} />
                                  <span>Restore to Dashboard</span>
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleToggleBackup(doc.id, false)}
                                className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium hover:bg-slate-200 transition"
                                title="Remove backup protection flag"
                              >
                                Remove Protection
                              </button>

                              <button
                                onClick={() => handleDeletePermanentlyFromDrive(doc.id, doc.display_name || doc.name)}
                                className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[11px] font-medium hover:bg-red-700 transition flex items-center gap-1"
                                title="Permanently delete file from Google Drive"
                              >
                                <Trash2 size={12} />
                                <span>Delete from Drive</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Protected Google Drive Folder: <strong className="text-slate-700">DocMatrix</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default BackupRestorePanel;
