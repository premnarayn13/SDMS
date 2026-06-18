import React, { useState, useEffect } from 'react';
import {
  getFileVersions,
  getVersionTimeline,
  getVersionStats,
  updateVersionLabel,
  updateVersionComment,
  deleteVersion,
  rollbackToVersion,
  formatVersionDate,
  getVersionMetadata,
  toggleAutoVersioning,
  setMaxVersions,
  exportVersionHistory
} from '../utils/versionControl';

const VERSION_LABELS = [
  { value: 'Draft', color: 'bg-gray-100 text-gray-700', icon: '📝' },
  { value: 'Review', color: 'bg-yellow-100 text-yellow-700', icon: '👁️' },
  { value: 'Final', color: 'bg-green-100 text-green-700', icon: '✅' },
  { value: 'Archive', color: 'bg-blue-100 text-blue-700', icon: '📦' },
  { value: 'Auto-save', color: 'bg-purple-100 text-purple-700', icon: '⚡' },
  { value: 'Rollback', color: 'bg-orange-100 text-orange-700', icon: '↩️' }
];

export default function VersionHistoryPanel({
  fileId,
  fileName,
  onRestoreVersion,
  onCompareVersions,
  onClose,
  isOpen = true
}) {
  const [versions, setVersions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [stats, setStats] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'timeline'
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [editingComment, setEditingComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [maxVersionsInput, setMaxVersionsInput] = useState(50);

  useEffect(() => {
    if (fileId && isOpen) {
      loadVersionData();
    }
  }, [fileId, isOpen]);

  const loadVersionData = () => {
    const versionsData = getFileVersions(fileId);
    const timelineData = getVersionTimeline(fileId);
    const statsData = getVersionStats(fileId);
    const metadataData = getVersionMetadata(fileId);

    setVersions(versionsData);
    setTimeline(timelineData);
    setStats(statsData);
    setMetadata(metadataData);
    setMaxVersionsInput(metadataData.maxVersions || 50);
  };

  const handleLabelChange = (versionId, newLabel) => {
    updateVersionLabel(fileId, versionId, newLabel);
    loadVersionData();
  };

  const handleCommentSave = (versionId) => {
    updateVersionComment(fileId, versionId, commentText);
    setEditingComment(null);
    setCommentText('');
    loadVersionData();
  };

  const handleDeleteVersion = (versionId) => {
    if (window.confirm('Are you sure you want to delete this version?')) {
      deleteVersion(fileId, versionId);
      loadVersionData();
    }
  };

  const handleRollback = (versionId) => {
    if (window.confirm('This will create a new version with the content from the selected version. Continue?')) {
      const result = rollbackToVersion(fileId, versionId, { fileName });
      if (result && onRestoreVersion) {
        onRestoreVersion(result.restoredContent, result.newVersion);
        loadVersionData();
      }
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompareVersions) {
      onCompareVersions(selectedVersions[0], selectedVersions[1]);
    }
  };

  const toggleVersionSelection = (versionId) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
  };

  const handleToggleAutoVersion = () => {
    toggleAutoVersioning(fileId, !metadata.autoVersionEnabled);
    loadVersionData();
  };

  const handleMaxVersionsChange = () => {
    setMaxVersions(fileId, maxVersionsInput);
    setShowSettings(false);
    loadVersionData();
  };

  const handleExport = () => {
    const data = exportVersionHistory(fileId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_version_history.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLabelStyle = (label) => {
    const labelConfig = VERSION_LABELS.find(l => l.value === label);
    return labelConfig || VERSION_LABELS[0];
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Version History</h2>
              <p className="text-sm text-gray-500">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={handleExport}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
              title="Export History"
            >
              📥
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-medium text-gray-700 mb-3">Version Settings</h3>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metadata?.autoVersionEnabled}
                  onChange={handleToggleAutoVersion}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Auto-save versions</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Max versions:</span>
                <input
                  type="number"
                  value={maxVersionsInput}
                  onChange={(e) => setMaxVersionsInput(parseInt(e.target.value) || 10)}
                  min={5}
                  max={100}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={handleMaxVersionsChange}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        {stats && (
          <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-blue-600 font-medium">{stats.totalVersions}</span>
                <span className="text-gray-500">versions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-green-600 font-medium">{stats.manualSaves}</span>
                <span className="text-gray-500">manual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-purple-600 font-medium">{stats.autoSaves}</span>
                <span className="text-gray-500">auto-saved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600 font-medium">{formatSize(stats.totalSize)}</span>
                <span className="text-gray-500">total</span>
              </div>
            </div>
          </div>
        )}

        {/* View Toggle & Compare Button */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📋 List
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'timeline' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📅 Timeline
            </button>
          </div>
          <div className="flex items-center gap-2">
            {selectedVersions.length > 0 && (
              <span className="text-sm text-gray-500">
                {selectedVersions.length}/2 selected
              </span>
            )}
            <button
              onClick={handleCompare}
              disabled={selectedVersions.length !== 2}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedVersions.length === 2
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              🔍 Compare
            </button>
          </div>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <span className="text-4xl mb-2">📭</span>
              <p>No versions saved yet</p>
              <p className="text-sm">Edit the file to create versions</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {versions.map((version, idx) => {
                const labelStyle = getLabelStyle(version.label);
                const isSelected = selectedVersions.includes(version.id);
                
                return (
                  <div
                    key={version.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isSelected 
                        ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleVersionSelection(version.id)}
                          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${labelStyle.color}`}>
                              {labelStyle.icon} {version.label}
                            </span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Latest
                              </span>
                            )}
                            {version.isAutoSave && (
                              <span className="text-xs text-gray-400">Auto-saved</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {formatVersionDate(version.createdAt)}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{formatSize(version.size)}</span>
                            <span>•</span>
                            <span>{version.wordCount} words</span>
                            <span>•</span>
                            <span>{version.charCount} chars</span>
                          </div>
                          {version.comment && (
                            <p className="mt-2 text-sm text-gray-600 italic">
                              💬 {version.comment}
                            </p>
                          )}
                          {editingComment === version.id && (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Add a comment..."
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => handleCommentSave(version.id)}
                                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingComment(null); setCommentText(''); }}
                                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Label Dropdown */}
                        <select
                          value={version.label}
                          onChange={(e) => handleLabelChange(version.id, e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-200 rounded hover:border-gray-300 bg-white"
                        >
                          {VERSION_LABELS.map(l => (
                            <option key={l.value} value={l.value}>
                              {l.icon} {l.value}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setEditingComment(version.id); setCommentText(version.comment || ''); }}
                          className="p-1.5 hover:bg-gray-200 rounded text-gray-500 text-sm"
                          title="Add comment"
                        >
                          💬
                        </button>
                        <button
                          onClick={() => handleRollback(version.id)}
                          className="p-1.5 hover:bg-blue-100 rounded text-blue-500 text-sm"
                          title="Restore this version"
                        >
                          ↩️
                        </button>
                        <button
                          onClick={() => handleDeleteVersion(version.id)}
                          className="p-1.5 hover:bg-red-100 rounded text-red-500 text-sm"
                          title="Delete version"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Timeline View
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              {timeline.map((group, groupIdx) => (
                <div key={group.date} className="mb-6">
                  <div className="flex items-center gap-3 mb-3 relative">
                    <div className="w-3 h-3 rounded-full bg-blue-500 z-10"></div>
                    <h3 className="font-medium text-gray-800">{group.date}</h3>
                  </div>
                  <div className="ml-6 pl-4 space-y-2">
                    {group.versions.map((version) => {
                      const labelStyle = getLabelStyle(version.label);
                      const isSelected = selectedVersions.includes(version.id);
                      
                      return (
                        <div
                          key={version.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-blue-400 bg-blue-50' 
                              : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                          onClick={() => toggleVersionSelection(version.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                              {new Date(version.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${labelStyle.color}`}>
                              {labelStyle.icon} {version.label}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatSize(version.size)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRollback(version.id); }}
                              className="p-1 hover:bg-blue-100 rounded text-blue-500 text-xs"
                            >
                              ↩️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {metadata?.autoVersionEnabled 
                ? '⚡ Auto-versioning enabled' 
                : '⏸️ Auto-versioning disabled'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
