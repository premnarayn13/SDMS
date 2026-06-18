/**
 * Storage Engine for DocMatrix DMS
 * Handles local filesystem-based storage, chunking, deduplication, and integrity checks
 */

import pako from 'pako';

// Storage configuration
const STORAGE_CONFIG = {
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  MAX_STORAGE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB max
  HASH_ALGORITHM: 'SHA-256',
  STORAGE_PREFIX: 'docmatrix_storage_',
  CHUNK_PREFIX: 'docmatrix_chunk_',
  BLOB_PREFIX: 'docmatrix_blob_',
  META_PREFIX: 'docmatrix_meta_',
  INDEX_KEY: 'docmatrix_storage_index',
  SETTINGS_KEY: 'docmatrix_storage_settings'
};

// Generate SHA-256 hash for deduplication
export const generateHash = async (data) => {
  try {
    const buffer = typeof data === 'string' 
      ? new TextEncoder().encode(data) 
      : data instanceof ArrayBuffer 
        ? data 
        : await data.arrayBuffer?.() || data;
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Hash generation failed:', error);
    // Fallback to simple hash
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
};

// Storage Index - tracks all stored files and their metadata
class StorageIndex {
  constructor() {
    this.index = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(STORAGE_CONFIG.INDEX_KEY);
      return stored ? JSON.parse(stored) : {
        files: {},
        chunks: {},
        blobs: {},
        totalSize: 0,
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Failed to load storage index:', error);
      return { files: {}, chunks: {}, blobs: {}, totalSize: 0, lastUpdated: new Date().toISOString(), version: '1.0.0' };
    }
  }

  save() {
    try {
      this.index.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_CONFIG.INDEX_KEY, JSON.stringify(this.index));
      return true;
    } catch (error) {
      console.error('Failed to save storage index:', error);
      return false;
    }
  }

  addFile(fileId, metadata) {
    this.index.files[fileId] = {
      ...metadata,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };
    this.index.totalSize += metadata.size || 0;
    this.save();
  }

  removeFile(fileId) {
    if (this.index.files[fileId]) {
      this.index.totalSize -= this.index.files[fileId].size || 0;
      delete this.index.files[fileId];
      this.save();
    }
  }

  addChunk(chunkHash, refCount = 1) {
    if (this.index.chunks[chunkHash]) {
      this.index.chunks[chunkHash].refCount += refCount;
    } else {
      this.index.chunks[chunkHash] = { refCount, createdAt: new Date().toISOString() };
    }
    this.save();
  }

  removeChunkRef(chunkHash) {
    if (this.index.chunks[chunkHash]) {
      this.index.chunks[chunkHash].refCount--;
      if (this.index.chunks[chunkHash].refCount <= 0) {
        delete this.index.chunks[chunkHash];
        localStorage.removeItem(`${STORAGE_CONFIG.CHUNK_PREFIX}${chunkHash}`);
      }
      this.save();
    }
  }

  getStats() {
    return {
      totalFiles: Object.keys(this.index.files).length,
      totalChunks: Object.keys(this.index.chunks).length,
      totalSize: this.index.totalSize,
      lastUpdated: this.index.lastUpdated,
      version: this.index.version
    };
  }
}

// Initialize storage index
let storageIndex = null;
const getStorageIndex = () => {
  if (!storageIndex) {
    storageIndex = new StorageIndex();
  }
  return storageIndex;
};

// Split file into chunks for storage
export const splitIntoChunks = async (data, chunkSize = STORAGE_CONFIG.CHUNK_SIZE) => {
  const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer?.() || new TextEncoder().encode(data);
  const chunks = [];
  const uint8Array = new Uint8Array(buffer);
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    const hash = await generateHash(chunk);
    chunks.push({
      index: chunks.length,
      hash,
      size: chunk.length,
      data: chunk
    });
  }
  
  return chunks;
};

// Reassemble chunks back into original data
export const reassembleChunks = (chunks) => {
  const sortedChunks = chunks.sort((a, b) => a.index - b.index);
  const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
  const result = new Uint8Array(totalSize);
  
  let offset = 0;
  for (const chunk of sortedChunks) {
    result.set(new Uint8Array(chunk.data), offset);
    offset += chunk.size;
  }
  
  return result;
};

// Store a file with chunking and deduplication
export const storeFile = async (fileId, data, metadata = {}) => {
  const index = getStorageIndex();
  
  try {
    const chunks = await splitIntoChunks(data);
    const chunkRefs = [];
    let dedupedSize = 0;
    
    for (const chunk of chunks) {
      const existingChunk = localStorage.getItem(`${STORAGE_CONFIG.CHUNK_PREFIX}${chunk.hash}`);
      
      if (existingChunk) {
        // Chunk already exists - deduplicated!
        index.addChunk(chunk.hash, 1);
        dedupedSize += chunk.size;
      } else {
        // Store new chunk
        const compressedChunk = pako.deflate(chunk.data);
        localStorage.setItem(
          `${STORAGE_CONFIG.CHUNK_PREFIX}${chunk.hash}`,
          arrayBufferToBase64(compressedChunk)
        );
        index.addChunk(chunk.hash, 1);
      }
      
      chunkRefs.push({
        index: chunk.index,
        hash: chunk.hash,
        size: chunk.size
      });
    }
    
    // Store file metadata with chunk references
    const fileMetadata = {
      ...metadata,
      id: fileId,
      chunks: chunkRefs,
      totalChunks: chunks.length,
      originalSize: chunks.reduce((sum, c) => sum + c.size, 0),
      dedupedSize,
      hash: await generateHash(data),
      storedAt: new Date().toISOString(),
      integrity: 'valid'
    };
    
    localStorage.setItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`, JSON.stringify(fileMetadata));
    index.addFile(fileId, fileMetadata);
    
    return {
      success: true,
      fileId,
      metadata: fileMetadata,
      dedupedBytes: dedupedSize
    };
  } catch (error) {
    console.error('Failed to store file:', error);
    return { success: false, error: error.message };
  }
};

// Retrieve a file from storage
export const retrieveFile = async (fileId) => {
  try {
    const metaStr = localStorage.getItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`);
    if (!metaStr) {
      return { success: false, error: 'File not found' };
    }
    
    const metadata = JSON.parse(metaStr);
    const chunks = [];
    
    for (const chunkRef of metadata.chunks) {
      const compressedChunk = localStorage.getItem(`${STORAGE_CONFIG.CHUNK_PREFIX}${chunkRef.hash}`);
      if (!compressedChunk) {
        return { success: false, error: `Missing chunk: ${chunkRef.hash}` };
      }
      
      const decompressed = pako.inflate(base64ToArrayBuffer(compressedChunk));
      chunks.push({
        index: chunkRef.index,
        size: chunkRef.size,
        data: decompressed
      });
    }
    
    const data = reassembleChunks(chunks);
    
    // Verify integrity
    const hash = await generateHash(data);
    if (hash !== metadata.hash) {
      return { success: false, error: 'Integrity check failed', expectedHash: metadata.hash, actualHash: hash };
    }
    
    return {
      success: true,
      data,
      metadata,
      integrityValid: true
    };
  } catch (error) {
    console.error('Failed to retrieve file:', error);
    return { success: false, error: error.message };
  }
};

// Delete a file from storage
export const deleteFile = async (fileId) => {
  const index = getStorageIndex();
  
  try {
    const metaStr = localStorage.getItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`);
    if (!metaStr) {
      return { success: false, error: 'File not found' };
    }
    
    const metadata = JSON.parse(metaStr);
    
    // Remove chunk references
    for (const chunkRef of metadata.chunks) {
      index.removeChunkRef(chunkRef.hash);
    }
    
    // Remove file metadata
    localStorage.removeItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`);
    index.removeFile(fileId);
    
    return { success: true, fileId };
  } catch (error) {
    console.error('Failed to delete file:', error);
    return { success: false, error: error.message };
  }
};

// Verify file integrity
export const verifyIntegrity = async (fileId) => {
  try {
    const result = await retrieveFile(fileId);
    if (!result.success) {
      return { valid: false, error: result.error };
    }
    
    return {
      valid: result.integrityValid,
      hash: result.metadata.hash,
      size: result.metadata.originalSize
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

// Verify all files in storage
export const verifyAllFiles = async () => {
  const index = getStorageIndex();
  const results = [];
  
  for (const fileId of Object.keys(index.index.files)) {
    const result = await verifyIntegrity(fileId);
    results.push({
      fileId,
      ...result
    });
  }
  
  return {
    total: results.length,
    valid: results.filter(r => r.valid).length,
    invalid: results.filter(r => !r.valid).length,
    results
  };
};

// Get storage analytics
export const getStorageAnalytics = () => {
  const index = getStorageIndex();
  const stats = index.getStats();
  
  // Calculate actual storage used in localStorage
  let actualStorageUsed = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('docmatrix_')) {
      actualStorageUsed += localStorage.getItem(key)?.length || 0;
    }
  }
  
  // Calculate storage by type
  const filesByType = {};
  for (const file of Object.values(index.index.files)) {
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'unknown';
    if (!filesByType[ext]) {
      filesByType[ext] = { count: 0, size: 0 };
    }
    filesByType[ext].count++;
    filesByType[ext].size += file.originalSize || file.size || 0;
  }
  
  // Calculate deduplication savings
  let totalOriginalSize = 0;
  let totalStoredSize = actualStorageUsed;
  for (const file of Object.values(index.index.files)) {
    totalOriginalSize += file.originalSize || file.size || 0;
  }
  
  const deduplicationSavings = Math.max(0, totalOriginalSize - totalStoredSize);
  const compressionRatio = totalOriginalSize > 0 
    ? ((1 - (totalStoredSize / totalOriginalSize)) * 100).toFixed(1) 
    : 0;
  
  return {
    ...stats,
    actualStorageUsed,
    maxStorage: STORAGE_CONFIG.MAX_STORAGE_SIZE,
    usagePercentage: ((actualStorageUsed / STORAGE_CONFIG.MAX_STORAGE_SIZE) * 100).toFixed(2),
    filesByType,
    deduplicationSavings,
    compressionRatio,
    chunkSize: STORAGE_CONFIG.CHUNK_SIZE
  };
};

// Export workspace to a single file
export const exportWorkspace = async () => {
  const index = getStorageIndex();
  const exportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    index: index.index,
    files: {},
    chunks: {}
  };
  
  // Export all file metadata
  for (const fileId of Object.keys(index.index.files)) {
    const metaStr = localStorage.getItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`);
    if (metaStr) {
      exportData.files[fileId] = JSON.parse(metaStr);
    }
  }
  
  // Export all chunks
  for (const chunkHash of Object.keys(index.index.chunks)) {
    const chunkData = localStorage.getItem(`${STORAGE_CONFIG.CHUNK_PREFIX}${chunkHash}`);
    if (chunkData) {
      exportData.chunks[chunkHash] = chunkData;
    }
  }
  
  // Compress the export
  const jsonString = JSON.stringify(exportData);
  const compressed = pako.deflate(new TextEncoder().encode(jsonString));
  
  return {
    data: compressed,
    filename: `docmatrix_workspace_${new Date().toISOString().split('T')[0]}.dmx`,
    size: compressed.length,
    originalSize: jsonString.length
  };
};

// Import workspace from exported file
export const importWorkspace = async (data, options = { merge: false }) => {
  try {
    // Decompress
    const decompressed = pako.inflate(data);
    const jsonString = new TextDecoder().decode(decompressed);
    const importData = JSON.parse(jsonString);
    
    if (!options.merge) {
      // Clear existing storage
      clearAllStorage();
    }
    
    // Import chunks first
    for (const [hash, chunkData] of Object.entries(importData.chunks)) {
      localStorage.setItem(`${STORAGE_CONFIG.CHUNK_PREFIX}${hash}`, chunkData);
    }
    
    // Import file metadata
    for (const [fileId, metadata] of Object.entries(importData.files)) {
      localStorage.setItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`, JSON.stringify(metadata));
    }
    
    // Import index
    if (options.merge) {
      const currentIndex = getStorageIndex();
      currentIndex.index = {
        ...currentIndex.index,
        files: { ...currentIndex.index.files, ...importData.index.files },
        chunks: { ...currentIndex.index.chunks, ...importData.index.chunks },
        totalSize: currentIndex.index.totalSize + importData.index.totalSize
      };
      currentIndex.save();
    } else {
      localStorage.setItem(STORAGE_CONFIG.INDEX_KEY, JSON.stringify(importData.index));
      storageIndex = null; // Reset to reload
    }
    
    return {
      success: true,
      importedFiles: Object.keys(importData.files).length,
      importedChunks: Object.keys(importData.chunks).length
    };
  } catch (error) {
    console.error('Failed to import workspace:', error);
    return { success: false, error: error.message };
  }
};

// Create a snapshot backup
export const createSnapshot = async (name = '') => {
  const snapshotName = name || `snapshot_${Date.now()}`;
  const exportResult = await exportWorkspace();
  
  const snapshot = {
    id: `snap_${Date.now()}`,
    name: snapshotName,
    createdAt: new Date().toISOString(),
    size: exportResult.size,
    data: arrayBufferToBase64(exportResult.data)
  };
  
  // Store snapshot list
  const snapshots = getSnapshots();
  snapshots.push({
    id: snapshot.id,
    name: snapshot.name,
    createdAt: snapshot.createdAt,
    size: snapshot.size
  });
  localStorage.setItem('docmatrix_snapshots', JSON.stringify(snapshots));
  
  // Store snapshot data separately
  localStorage.setItem(`docmatrix_snapshot_${snapshot.id}`, snapshot.data);
  
  return {
    success: true,
    snapshot: {
      id: snapshot.id,
      name: snapshot.name,
      createdAt: snapshot.createdAt,
      size: snapshot.size
    }
  };
};

// Get list of snapshots
export const getSnapshots = () => {
  try {
    const stored = localStorage.getItem('docmatrix_snapshots');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Restore from snapshot
export const restoreSnapshot = async (snapshotId) => {
  try {
    const snapshotData = localStorage.getItem(`docmatrix_snapshot_${snapshotId}`);
    if (!snapshotData) {
      return { success: false, error: 'Snapshot not found' };
    }
    
    const data = base64ToArrayBuffer(snapshotData);
    return await importWorkspace(new Uint8Array(data), { merge: false });
  } catch (error) {
    console.error('Failed to restore snapshot:', error);
    return { success: false, error: error.message };
  }
};

// Delete a snapshot
export const deleteSnapshot = (snapshotId) => {
  try {
    localStorage.removeItem(`docmatrix_snapshot_${snapshotId}`);
    const snapshots = getSnapshots().filter(s => s.id !== snapshotId);
    localStorage.setItem('docmatrix_snapshots', JSON.stringify(snapshots));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Repair/rebuild storage
export const repairStorage = async () => {
  const results = {
    orphanedChunks: 0,
    missingChunks: 0,
    corruptedFiles: 0,
    repaired: 0
  };
  
  try {
    const index = getStorageIndex();
    
    // Find orphaned chunks (chunks not referenced by any file)
    const referencedChunks = new Set();
    for (const fileId of Object.keys(index.index.files)) {
      const metaStr = localStorage.getItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`);
      if (metaStr) {
        const metadata = JSON.parse(metaStr);
        metadata.chunks?.forEach(c => referencedChunks.add(c.hash));
      }
    }
    
    // Check for orphaned chunks in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_CONFIG.CHUNK_PREFIX)) {
        const hash = key.replace(STORAGE_CONFIG.CHUNK_PREFIX, '');
        if (!referencedChunks.has(hash)) {
          localStorage.removeItem(key);
          results.orphanedChunks++;
        }
      }
    }
    
    // Check for missing chunks
    for (const fileId of Object.keys(index.index.files)) {
      const metaStr = localStorage.getItem(`${STORAGE_CONFIG.META_PREFIX}${fileId}`);
      if (metaStr) {
        const metadata = JSON.parse(metaStr);
        for (const chunkRef of metadata.chunks || []) {
          if (!localStorage.getItem(`${STORAGE_CONFIG.CHUNK_PREFIX}${chunkRef.hash}`)) {
            results.missingChunks++;
          }
        }
      }
    }
    
    // Verify file integrity
    const verifyResult = await verifyAllFiles();
    results.corruptedFiles = verifyResult.invalid;
    
    // Rebuild index
    const newIndex = { files: {}, chunks: {}, blobs: {}, totalSize: 0, lastUpdated: new Date().toISOString(), version: '1.0.0' };
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_CONFIG.META_PREFIX)) {
        const fileId = key.replace(STORAGE_CONFIG.META_PREFIX, '');
        const metaStr = localStorage.getItem(key);
        if (metaStr) {
          const metadata = JSON.parse(metaStr);
          newIndex.files[fileId] = metadata;
          newIndex.totalSize += metadata.originalSize || metadata.size || 0;
          
          metadata.chunks?.forEach(c => {
            if (!newIndex.chunks[c.hash]) {
              newIndex.chunks[c.hash] = { refCount: 0, createdAt: new Date().toISOString() };
            }
            newIndex.chunks[c.hash].refCount++;
          });
        }
      }
    }
    
    localStorage.setItem(STORAGE_CONFIG.INDEX_KEY, JSON.stringify(newIndex));
    storageIndex = null; // Reset to reload
    results.repaired = results.orphanedChunks;
    
    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Failed to repair storage:', error);
    return { success: false, error: error.message, results };
  }
};

// Clear all storage
export const clearAllStorage = () => {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('docmatrix_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  storageIndex = null;
};

// Portable workspace mode - export to USB-ready format
export const exportPortableWorkspace = async () => {
  const exportResult = await exportWorkspace();
  
  // Create portable package with launcher info
  const portablePackage = {
    version: '1.0.0',
    type: 'portable',
    createdAt: new Date().toISOString(),
    workspace: arrayBufferToBase64(exportResult.data),
    settings: localStorage.getItem(STORAGE_CONFIG.SETTINGS_KEY) || '{}',
    readme: `
DocMatrix Portable Workspace
============================
This is a portable workspace export from DocMatrix DMS.

To use:
1. Open DocMatrix DMS in any browser
2. Go to Storage Manager
3. Click "Import Workspace"
4. Select this file

Created: ${new Date().toISOString()}
    `.trim()
  };
  
  const jsonString = JSON.stringify(portablePackage, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  
  return {
    blob,
    filename: `DocMatrix_Portable_${new Date().toISOString().split('T')[0]}.dmxp`,
    size: blob.size
  };
};

// Import from external drive/portable workspace
export const importPortableWorkspace = async (data) => {
  try {
    const portablePackage = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data));
    
    if (portablePackage.type !== 'portable') {
      return { success: false, error: 'Invalid portable workspace format' };
    }
    
    const workspaceData = base64ToArrayBuffer(portablePackage.workspace);
    const result = await importWorkspace(new Uint8Array(workspaceData), { merge: false });
    
    if (result.success && portablePackage.settings) {
      localStorage.setItem(STORAGE_CONFIG.SETTINGS_KEY, portablePackage.settings);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to import portable workspace:', error);
    return { success: false, error: error.message };
  }
};

// Helper: ArrayBuffer to Base64
export const arrayBufferToBase64 = (buffer) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Helper: Base64 to ArrayBuffer
export const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export default {
  generateHash,
  splitIntoChunks,
  reassembleChunks,
  storeFile,
  retrieveFile,
  deleteFile,
  verifyIntegrity,
  verifyAllFiles,
  getStorageAnalytics,
  exportWorkspace,
  importWorkspace,
  createSnapshot,
  getSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  repairStorage,
  clearAllStorage,
  exportPortableWorkspace,
  importPortableWorkspace,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  STORAGE_CONFIG
};
