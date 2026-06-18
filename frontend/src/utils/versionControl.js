/**
 * Version Control System for DocMatrix DMS
 * Handles automatic/manual versioning, history, rollback, and comparison
 */

// Version storage key prefix
const VERSION_STORAGE_KEY = 'docmatrix_versions_';
const VERSION_METADATA_KEY = 'docmatrix_version_metadata_';

// Generate unique version ID
export const generateVersionId = () => {
  return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get all versions for a file
export const getFileVersions = (fileId) => {
  try {
    const stored = localStorage.getItem(`${VERSION_STORAGE_KEY}${fileId}`);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting file versions:', error);
    return [];
  }
};

// Get version metadata
export const getVersionMetadata = (fileId) => {
  try {
    const stored = localStorage.getItem(`${VERSION_METADATA_KEY}${fileId}`);
    return stored ? JSON.parse(stored) : {
      autoVersionEnabled: true,
      maxVersions: 50,
      lastAutoSave: null
    };
  } catch (error) {
    return { autoVersionEnabled: true, maxVersions: 50, lastAutoSave: null };
  }
};

// Save version metadata
export const saveVersionMetadata = (fileId, metadata) => {
  try {
    localStorage.setItem(`${VERSION_METADATA_KEY}${fileId}`, JSON.stringify(metadata));
    return true;
  } catch (error) {
    console.error('Error saving version metadata:', error);
    return false;
  }
};

// Create a new version
export const createVersion = (fileId, content, options = {}) => {
  const {
    label = 'Draft',
    comment = '',
    isAutoSave = false,
    fileName = 'Untitled',
    fileType = 'text/plain'
  } = options;

  const version = {
    id: generateVersionId(),
    fileId,
    fileName,
    fileType,
    content,
    label, // 'Draft', 'Final', 'Review', 'Archive'
    comment,
    isAutoSave,
    createdAt: new Date().toISOString(),
    size: new Blob([content]).size,
    wordCount: typeof content === 'string' ? content.split(/\s+/).filter(Boolean).length : 0,
    charCount: typeof content === 'string' ? content.length : 0
  };

  try {
    const versions = getFileVersions(fileId);
    versions.unshift(version); // Add to beginning (newest first)

    // Limit versions based on metadata
    const metadata = getVersionMetadata(fileId);
    const limitedVersions = versions.slice(0, metadata.maxVersions);

    localStorage.setItem(`${VERSION_STORAGE_KEY}${fileId}`, JSON.stringify(limitedVersions));
    
    if (isAutoSave) {
      saveVersionMetadata(fileId, { ...metadata, lastAutoSave: version.createdAt });
    }

    return version;
  } catch (error) {
    console.error('Error creating version:', error);
    return null;
  }
};

// Create automatic version (debounced)
let autoSaveTimers = {};
export const createAutoVersion = (fileId, content, options = {}, debounceMs = 5000) => {
  return new Promise((resolve) => {
    if (autoSaveTimers[fileId]) {
      clearTimeout(autoSaveTimers[fileId]);
    }

    autoSaveTimers[fileId] = setTimeout(() => {
      const metadata = getVersionMetadata(fileId);
      if (!metadata.autoVersionEnabled) {
        resolve(null);
        return;
      }

      const version = createVersion(fileId, content, {
        ...options,
        isAutoSave: true,
        label: 'Auto-save'
      });
      resolve(version);
    }, debounceMs);
  });
};

// Get a specific version
export const getVersion = (fileId, versionId) => {
  const versions = getFileVersions(fileId);
  return versions.find(v => v.id === versionId) || null;
};

// Get latest version
export const getLatestVersion = (fileId) => {
  const versions = getFileVersions(fileId);
  return versions.length > 0 ? versions[0] : null;
};

// Update version label
export const updateVersionLabel = (fileId, versionId, newLabel) => {
  try {
    const versions = getFileVersions(fileId);
    const index = versions.findIndex(v => v.id === versionId);
    if (index !== -1) {
      versions[index].label = newLabel;
      versions[index].updatedAt = new Date().toISOString();
      localStorage.setItem(`${VERSION_STORAGE_KEY}${fileId}`, JSON.stringify(versions));
      return versions[index];
    }
    return null;
  } catch (error) {
    console.error('Error updating version label:', error);
    return null;
  }
};

// Update version comment
export const updateVersionComment = (fileId, versionId, comment) => {
  try {
    const versions = getFileVersions(fileId);
    const index = versions.findIndex(v => v.id === versionId);
    if (index !== -1) {
      versions[index].comment = comment;
      versions[index].updatedAt = new Date().toISOString();
      localStorage.setItem(`${VERSION_STORAGE_KEY}${fileId}`, JSON.stringify(versions));
      return versions[index];
    }
    return null;
  } catch (error) {
    console.error('Error updating version comment:', error);
    return null;
  }
};

// Delete a version
export const deleteVersion = (fileId, versionId) => {
  try {
    let versions = getFileVersions(fileId);
    versions = versions.filter(v => v.id !== versionId);
    localStorage.setItem(`${VERSION_STORAGE_KEY}${fileId}`, JSON.stringify(versions));
    return true;
  } catch (error) {
    console.error('Error deleting version:', error);
    return false;
  }
};

// Delete all versions for a file
export const deleteAllVersions = (fileId) => {
  try {
    localStorage.removeItem(`${VERSION_STORAGE_KEY}${fileId}`);
    localStorage.removeItem(`${VERSION_METADATA_KEY}${fileId}`);
    return true;
  } catch (error) {
    console.error('Error deleting all versions:', error);
    return false;
  }
};

// Rollback to a specific version (creates a new version with old content)
export const rollbackToVersion = (fileId, versionId, options = {}) => {
  const targetVersion = getVersion(fileId, versionId);
  if (!targetVersion) {
    console.error('Version not found for rollback');
    return null;
  }

  // Create a new version with the rolled-back content
  const newVersion = createVersion(fileId, targetVersion.content, {
    fileName: options.fileName || targetVersion.fileName,
    fileType: options.fileType || targetVersion.fileType,
    label: 'Rollback',
    comment: `Rolled back from version created at ${formatVersionDate(targetVersion.createdAt)}`,
    isAutoSave: false
  });

  return {
    newVersion,
    restoredContent: targetVersion.content
  };
};

// Compare two versions - returns diff information
export const compareVersions = (fileId, versionId1, versionId2) => {
  const version1 = getVersion(fileId, versionId1);
  const version2 = getVersion(fileId, versionId2);

  if (!version1 || !version2) {
    console.error('One or both versions not found');
    return null;
  }

  // Get content as strings
  const content1 = typeof version1.content === 'string' ? version1.content : '';
  const content2 = typeof version2.content === 'string' ? version2.content : '';

  // Calculate basic stats
  const lines1 = content1.split('\n');
  const lines2 = content2.split('\n');

  return {
    version1: {
      id: version1.id,
      label: version1.label,
      createdAt: version1.createdAt,
      content: content1,
      lineCount: lines1.length,
      wordCount: version1.wordCount,
      charCount: version1.charCount
    },
    version2: {
      id: version2.id,
      label: version2.label,
      createdAt: version2.createdAt,
      content: content2,
      lineCount: lines2.length,
      wordCount: version2.wordCount,
      charCount: version2.charCount
    },
    diff: computeLineDiff(lines1, lines2)
  };
};

// Compute line-by-line diff
export const computeLineDiff = (lines1, lines2) => {
  const result = [];
  const maxLines = Math.max(lines1.length, lines2.length);

  for (let i = 0; i < maxLines; i++) {
    const line1 = lines1[i];
    const line2 = lines2[i];

    if (line1 === undefined) {
      result.push({ type: 'added', lineNum: i + 1, content: line2, side: 'right' });
    } else if (line2 === undefined) {
      result.push({ type: 'removed', lineNum: i + 1, content: line1, side: 'left' });
    } else if (line1 !== line2) {
      result.push({ 
        type: 'modified', 
        lineNum: i + 1, 
        left: line1, 
        right: line2,
        wordDiff: computeWordDiff(line1, line2)
      });
    } else {
      result.push({ type: 'unchanged', lineNum: i + 1, content: line1 });
    }
  }

  // Calculate summary
  const summary = {
    added: result.filter(r => r.type === 'added').length,
    removed: result.filter(r => r.type === 'removed').length,
    modified: result.filter(r => r.type === 'modified').length,
    unchanged: result.filter(r => r.type === 'unchanged').length
  };

  return { lines: result, summary };
};

// Compute word-level diff within a line
export const computeWordDiff = (line1, line2) => {
  const words1 = line1.split(/(\s+)/);
  const words2 = line2.split(/(\s+)/);
  const result = [];

  const maxWords = Math.max(words1.length, words2.length);
  for (let i = 0; i < maxWords; i++) {
    const word1 = words1[i] || '';
    const word2 = words2[i] || '';

    if (word1 === word2) {
      result.push({ type: 'unchanged', text: word1 });
    } else if (!word1) {
      result.push({ type: 'added', text: word2 });
    } else if (!word2) {
      result.push({ type: 'removed', text: word1 });
    } else {
      result.push({ type: 'removed', text: word1 });
      result.push({ type: 'added', text: word2 });
    }
  }

  return result;
};

// Format version date for display
export const formatVersionDate = (isoString) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get version timeline (grouped by date)
export const getVersionTimeline = (fileId) => {
  const versions = getFileVersions(fileId);
  const timeline = {};

  versions.forEach(version => {
    const date = new Date(version.createdAt);
    const dateKey = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    if (!timeline[dateKey]) {
      timeline[dateKey] = [];
    }
    timeline[dateKey].push(version);
  });

  return Object.entries(timeline).map(([date, versions]) => ({
    date,
    versions: versions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }));
};

// Save as copy (creates new file with content)
export const saveAsCopy = (originalItem, content, newName) => {
  const copyName = newName || `${originalItem.name.replace(/\.[^.]+$/, '')} (Copy)${getExtension(originalItem.name)}`;
  
  return {
    id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: copyName,
    content,
    type: originalItem.type,
    size: new Blob([content]).size,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    originalId: originalItem.id,
    isCopy: true
  };
};

// Save as new version (creates version and returns updated item)
export const saveAsNewVersion = (fileId, content, label = 'Manual Save', comment = '', fileName = '', fileType = '') => {
  const version = createVersion(fileId, content, {
    label,
    comment,
    isAutoSave: false,
    fileName,
    fileType
  });

  return version;
};

// Get file extension
const getExtension = (filename) => {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '';
};

// Export version history as JSON
export const exportVersionHistory = (fileId) => {
  const versions = getFileVersions(fileId);
  const metadata = getVersionMetadata(fileId);
  
  return {
    fileId,
    metadata,
    versions,
    exportedAt: new Date().toISOString()
  };
};

// Import version history from JSON
export const importVersionHistory = (data) => {
  try {
    if (!data.fileId || !data.versions) {
      throw new Error('Invalid version history data');
    }

    localStorage.setItem(`${VERSION_STORAGE_KEY}${data.fileId}`, JSON.stringify(data.versions));
    if (data.metadata) {
      localStorage.setItem(`${VERSION_METADATA_KEY}${data.fileId}`, JSON.stringify(data.metadata));
    }
    
    return true;
  } catch (error) {
    console.error('Error importing version history:', error);
    return false;
  }
};

// Get version statistics
export const getVersionStats = (fileId) => {
  const versions = getFileVersions(fileId);
  
  if (versions.length === 0) {
    return {
      totalVersions: 0,
      labels: {},
      autoSaves: 0,
      manualSaves: 0,
      firstVersion: null,
      lastVersion: null,
      totalSize: 0
    };
  }

  const labels = {};
  let autoSaves = 0;
  let manualSaves = 0;
  let totalSize = 0;

  versions.forEach(v => {
    labels[v.label] = (labels[v.label] || 0) + 1;
    if (v.isAutoSave) autoSaves++;
    else manualSaves++;
    totalSize += v.size || 0;
  });

  return {
    totalVersions: versions.length,
    labels,
    autoSaves,
    manualSaves,
    firstVersion: versions[versions.length - 1],
    lastVersion: versions[0],
    totalSize,
    avgVersionSize: Math.round(totalSize / versions.length)
  };
};

// Toggle auto-versioning
export const toggleAutoVersioning = (fileId, enabled) => {
  const metadata = getVersionMetadata(fileId);
  metadata.autoVersionEnabled = enabled;
  return saveVersionMetadata(fileId, metadata);
};

// Set max versions limit
export const setMaxVersions = (fileId, maxVersions) => {
  const metadata = getVersionMetadata(fileId);
  metadata.maxVersions = Math.max(1, Math.min(100, maxVersions));
  return saveVersionMetadata(fileId, metadata);
};

export default {
  generateVersionId,
  getFileVersions,
  getVersionMetadata,
  saveVersionMetadata,
  createVersion,
  createAutoVersion,
  getVersion,
  getLatestVersion,
  updateVersionLabel,
  updateVersionComment,
  deleteVersion,
  deleteAllVersions,
  rollbackToVersion,
  compareVersions,
  computeLineDiff,
  computeWordDiff,
  formatVersionDate,
  getVersionTimeline,
  saveAsCopy,
  saveAsNewVersion,
  exportVersionHistory,
  importVersionHistory,
  getVersionStats,
  toggleAutoVersioning,
  setMaxVersions
};
