import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { documentsApi, foldersApi, uploadApi, sharingApi, tagsApi, trashApi } from '../utils/api';
import { documentOpsApi, folderOpsApi } from '../utils/documentApi';
import { tokenUtils } from '../utils/authApi';
import { megaSettingsApi } from '../utils/settingsApi';
import { generateId, getCurrentDate, getCurrentDateTime } from '../utils/helpers';

// Check if we should use cloud backend
const isCloudMode = () => {
  const token = tokenUtils.getAccessToken();
  const legacyMode = import.meta.env.VITE_LEGACY_MODE === 'true';
  const forceCloud = import.meta.env.VITE_FORCE_CLOUD === 'true';
  const forceLocal = import.meta.env.VITE_FORCE_LOCAL === 'true';

  if (legacyMode) return false;
  if (forceLocal) return false;
  if (forceCloud) return !!token;
  return !!token;
};

const BASE_ABSOLUTE_PATH = 'C:/Enterprise/DocumentMatrix';
const MIME_OVERRIDES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  zip: 'application/zip'
};

const getMimeType = (extension = '') => MIME_OVERRIDES[extension.toLowerCase()] || 'application/octet-stream';

const computePaths = (items, item) => {
  const names = [];
  const visited = new Set();
  let current = item;
  const bucket = Array.isArray(items) ? items : [];
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.name) {
      names.unshift(current.name);
    }
    current = current.parentId ? bucket.find(i => i.id === current.parentId) : null;
  }
  const workspacePath = names.length ? names.join('/') : 'Workspace';
  return {
    workspacePath,
    absolutePath: `${BASE_ABSOLUTE_PATH}/${workspacePath}`
  };
};

const simpleHash = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
};

const buildSha256 = (value = '') => {
  const base = simpleHash(`${value}-sha`);
  return Array.from({ length: 64 }, (_, index) => ((base + index * 23) % 16).toString(16)).join('');
};

const bumpVersion = (version = 'v1.0') => {
  const normalized = version.replace(/^v/i, '');
  const [majorStr, minorStr = '0'] = normalized.split('.');
  const major = Number(majorStr) || 1;
  const minor = Number(minorStr) || 0;
  const nextMinor = Number((minor + 0.1).toFixed(1));
  const minorLabel = `${nextMinor}`.replace(/\.0$/, '');
  return `v${major}.${minorLabel}`;
};

const ensureMetadata = (items = [], item) => {
  if (!item) return item;
  const extension = item.name?.includes('.') ? item.name.split('.').pop().toLowerCase() : '';
  const { workspacePath, absolutePath } = computePaths(items, item);
  const baseSeed = `${item.id}-${item.name}-${item.date || ''}-${workspacePath}-${item.size || 0}`;
  const duplicateSignature = Math.abs(simpleHash(`${item.name}-${workspacePath}`)).toString(16).padStart(4, '0');
  const storageSignature = Math.abs(simpleHash(`${workspacePath}-${item.id}`)).toString(16).slice(0, 6);
  const defaultDescription = item.description ?? (item.type === 'folder'
    ? 'Folder container for related files and shared documents.'
    : 'Add a description to capture the business intent of this document.'
  );

  return {
    ...item,
    fileExtension: extension || (item.type === 'folder' ? 'folder' : 'bin'),
    mimeType: item.mimeType || getMimeType(extension),
    absolutePath,
    workspacePath,
    sha256: item.sha256 || buildSha256(baseSeed),
    integrityChecksum: item.integrityChecksum || buildSha256(`${baseSeed}-integrity`),
    duplicateGroupId: item.duplicateGroupId || `dup-${duplicateSignature}`,
    storageBlockId: item.storageBlockId || `blk-${storageSignature}`,
    compressionState: item.compressionState || (item.isArchive ? 'Compressed (ZIP)' : 'Uncompressed'),
    encryptionState: item.encryptionState ?? (item.type === 'folder' ? 'N/A' : 'Encrypted (AES-256)'),
    versionId: item.versionId || 'v1.0',
    description: defaultDescription,
    notes: item.notes || '',
    customLabels: item.customLabels || [],
    priority: item.priority || 'normal',
    lastAccessed: item.lastAccessed || item.date
  };
};

const enrichItems = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items.map(item => ensureMetadata(items, item));
};

const mapCloudDocumentToItem = (doc) => ({
  id: doc.id,
  name: doc.display_name || doc.original_name,
  type: 'file',
  fileType: doc.file_type || 'Document',
  size: doc.size_bytes,
  date: doc.created_at?.split('T')[0] || getCurrentDate(),
  created: doc.created_at?.split('T')[0] || getCurrentDate(),
  parentId: doc.virtual_folder_id || null,
  favorite: doc.is_favorite || false,
  tags: doc.tags || [],
  shared: [],
  trash: doc.status === 'trashed',
  mimeType: doc.mime_type || 'application/octet-stream',
  driveFileId: doc.drive_file_id,
  driveId: doc.drive_id || null,
  storageProvider: 'google',
  isCloud: true,
  description: doc.description,
  history: []
});

const mapMegaFileToItem = (file) => ({
  id: `mega:${file.file_id}`,
  name: file.name,
  type: 'file',
  fileType: 'Document',
  size: Number(file.size_bytes) || 0,
  date: (file.uploaded_at || getCurrentDate()).split?.('T')?.[0] || getCurrentDate(),
  created: (file.uploaded_at || getCurrentDate()).split?.('T')?.[0] || getCurrentDate(),
  parentId: null,
  favorite: false,
  tags: [],
  shared: [],
  trash: false,
  mimeType: 'application/octet-stream',
  driveFileId: file.file_id,
  driveId: 'mega-account',
  storageProvider: 'mega',
  isCloud: false,
  isMega: true,
  description: 'Stored in MEGA',
  history: []
});

const mapLegacyDocumentToItem = (doc) => ({
  id: doc.id,
  name: doc.name,
  type: doc.type || 'file',
  fileType: doc.fileType || 'Document',
  size: doc.size || 0,
  date: doc.date || getCurrentDate(),
  created: doc.created || doc.date || getCurrentDate(),
  parentId: doc.parentId ?? null,
  favorite: doc.favorite || false,
  tags: doc.tags || [],
  shared: doc.shared || [],
  trash: doc.trash || false,
  mimeType: doc.mimeType || 'application/octet-stream',
  content: doc.content || null,
  dataUrl: doc.dataUrl || null,
  history: doc.history || [],
  isCloud: false
});

const mapCloudFolderToItem = (folder) => {
  console.log("FOLDER FROM BACKEND:", folder);

  return {
    id: folder.id,
    name: folder.name,
    type: 'folder',
    fileType: 'Folder',
    size: 0,
    date: folder.created_at?.split('T')[0] || getCurrentDate(),
    created: folder.created_at?.split('T')[0] || getCurrentDate(),
    parentId: folder.parent_id || null,
    favorite: false,
    tags: [],
    shared: [],
    trash: false,
    mimeType: 'application/vnd.docmatrix.folder',
    isCloud: true,
    description: folder.description || '',
    color: folder.color || null,
    history: [],
    driveId: folder.drive_id || null,
    storageProvider: 'google',
  };
};


const flattenFolderTree = (nodes = [], parentId = null) => {
  const flattened = [];
  for (const node of nodes || []) {
    const current = {
      ...node,
      parent_id: node.parent_id ?? parentId
    };
    flattened.push(current);
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattened.push(...flattenFolderTree(node.children, node.id));
    }
  }
  return flattened;
};

const mergeItemsById = (primary = [], secondary = []) => {
  const merged = [...primary];
  const seen = new Set(primary.map(item => String(item.id)));
  for (const item of secondary) {
    const key = String(item.id);
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }
  return merged;
};

// Initial state
const initialState = {
  items: [],
  currentFolder: null,
  currentView: 'home',
  viewMode: 'grid', // 'grid', 'list', or 'details'
  selectedItems: [],
  clipboard: { items: [], operation: null },
  loading: false,
  error: null,
  storage: { used: 0, total: 10737418240, percent: 0 },
  trashCount: 0,
  searchQuery: '',
  navigationHistory: { back: [], forward: [] },
  pinnedItems: [],
  sortBy: 'name',
  sortOrder: 'asc',
  filterCategory: null,
  filterStatus: null,
  filterSensitivity: null,
  activeStorageScope: null,
};

// Action types
const ACTIONS = {
  SET_ITEMS: 'SET_ITEMS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_CURRENT_FOLDER: 'SET_CURRENT_FOLDER',
  SET_CURRENT_VIEW: 'SET_CURRENT_VIEW',
  SET_VIEW_MODE: 'SET_VIEW_MODE',
  SET_SELECTED_ITEMS: 'SET_SELECTED_ITEMS',
  ADD_SELECTED_ITEM: 'ADD_SELECTED_ITEM',
  REMOVE_SELECTED_ITEM: 'REMOVE_SELECTED_ITEM',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  SET_CLIPBOARD: 'SET_CLIPBOARD',
  CLEAR_CLIPBOARD: 'CLEAR_CLIPBOARD',
  UPDATE_ITEM: 'UPDATE_ITEM',
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  SET_STORAGE: 'SET_STORAGE',
  SET_TRASH_COUNT: 'SET_TRASH_COUNT',
  SET_SEARCH_QUERY: 'SET_SEARCH_QUERY',
  SET_NAVIGATION_HISTORY: 'SET_NAVIGATION_HISTORY',
  SET_PINNED_ITEMS: 'SET_PINNED_ITEMS',
  SET_SORT: 'SET_SORT',
  SET_FILTER_CATEGORY: 'SET_FILTER_CATEGORY',
  SET_FILTER_STATUS: 'SET_FILTER_STATUS',
  SET_FILTER_SENSITIVITY: 'SET_FILTER_SENSITIVITY',
  SET_STORAGE_SCOPE: 'SET_STORAGE_SCOPE',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_ITEMS:
      return { ...state, items: action.payload };
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    case ACTIONS.SET_CURRENT_FOLDER:
      return { ...state, currentFolder: action.payload };
    case ACTIONS.SET_CURRENT_VIEW:
      return { ...state, currentView: action.payload };
    case ACTIONS.SET_VIEW_MODE:
      return { ...state, viewMode: action.payload };
    case ACTIONS.SET_SELECTED_ITEMS:
      return {
        ...state,
        selectedItems: Array.from(new Set((action.payload || []).map(id => String(id))))
      };
    case ACTIONS.ADD_SELECTED_ITEM:
      {
        const normalized = String(action.payload);
        const current = state.selectedItems.map(id => String(id));
        return {
          ...state,
          selectedItems: current.includes(normalized)
            ? current
            : [...current, normalized]
        };
      }
    case ACTIONS.REMOVE_SELECTED_ITEM:
      {
        const normalized = String(action.payload);
        return {
          ...state,
          selectedItems: state.selectedItems
            .map(id => String(id))
            .filter(id => id !== normalized)
        };
      }
    case ACTIONS.CLEAR_SELECTION:
      return { ...state, selectedItems: [] };
    case ACTIONS.SET_CLIPBOARD:
      return { ...state, clipboard: action.payload };
    case ACTIONS.CLEAR_CLIPBOARD:
      return { ...state, clipboard: { items: [], operation: null } };
    case ACTIONS.UPDATE_ITEM:
      return {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
        )
      };
    case ACTIONS.ADD_ITEM:
      return { ...state, items: [...state.items, action.payload] };
    case ACTIONS.REMOVE_ITEM:
      return { ...state, items: state.items.filter(item => item.id !== action.payload) };
    case ACTIONS.SET_STORAGE:
      return { ...state, storage: action.payload };
    case ACTIONS.SET_TRASH_COUNT:
      return { ...state, trashCount: action.payload };
    case ACTIONS.SET_SEARCH_QUERY:
      return { ...state, searchQuery: action.payload };
    case ACTIONS.SET_NAVIGATION_HISTORY:
      return { ...state, navigationHistory: action.payload };
    case ACTIONS.SET_PINNED_ITEMS:
      return { ...state, pinnedItems: action.payload };
    case ACTIONS.SET_SORT:
      return { ...state, sortBy: action.payload.sortBy, sortOrder: action.payload.sortOrder };
    case ACTIONS.SET_FILTER_CATEGORY:
      return { ...state, filterCategory: action.payload };
    case ACTIONS.SET_FILTER_STATUS:
      return { ...state, filterStatus: action.payload };
    case ACTIONS.SET_FILTER_SENSITIVITY:
      return { ...state, filterSensitivity: action.payload };
    case ACTIONS.SET_STORAGE_SCOPE:
      return { ...state, activeStorageScope: action.payload };
    default:
      return state;
  }
}

// Context
const AppContext = createContext(null);

// Default items - Empty for fresh start
const defaultItems = [];

const hasNameConflict = (items, name, parentId, ignoreId = null) => {
  return items.some(item =>
    item.id !== ignoreId &&
    item.parentId === parentId &&
    !item.trash &&
    item.name.toLowerCase() === name.toLowerCase()
  );
};

const resolveNameConflict = (items, name, parentId, ignoreId = null) => {
  let candidate = name;
  const extIndex = name.lastIndexOf('.');
  const extension = extIndex > 0 ? name.slice(extIndex) : '';
  const base = extIndex > 0 ? name.slice(0, extIndex) : name;
  let counter = 1;

  while (hasNameConflict(items, candidate, parentId, ignoreId)) {
    candidate = `${base} (${counter})${extension}`;
    counter += 1;
  }

  return candidate;
};

// LocalStorage key
const STORAGE_KEY = 'docmatrix_data';

const getStorageFriendlyItems = (items = []) => {
  return (items || []).map(item => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };

    const isVolatileBlobUrl = typeof copy.dataUrl === 'string' && copy.dataUrl.startsWith('blob:');
    if (isVolatileBlobUrl || (copy.dataUrl && copy.dataUrl.length > 2048)) {
      delete copy.dataUrl;
    }

    if (copy.content && typeof copy.content === 'string' && copy.content.length > 10000) {
      copy.content = copy.content.slice(0, 10000);
    }

    if (Array.isArray(copy.archiveContents) && copy.archiveContents.length > 200) {
      copy.archiveContents = copy.archiveContents.slice(0, 200);
    }

    return copy;
  });
};

const safePersistItems = (items = []) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (error) {
    try {
      const trimmed = getStorageFriendlyItems(items);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return true;
    } catch (trimmedError) {
      console.warn('Failed to persist full item cache, storing minimal cache instead:', trimmedError?.message || trimmedError);
      try {
        const minimal = (items || []).map(item => ({
          id: item.id,
          name: item.name,
          type: item.type,
          fileType: item.fileType,
          parentId: item.parentId ?? null,
          trash: !!item.trash,
          date: item.date,
          created: item.created,
          size: item.size || 0,
          isCloud: !!item.isCloud,
          mimeType: item.mimeType,
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
        return true;
      } catch (minimalError) {
        console.warn('Failed to persist local cache due to quota:', minimalError?.message || minimalError);
        return false;
      }
    }
  }
};

// Force fresh start - set to false for normal operation
const FORCE_FRESH_START = false;

// Provider
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load documents from cloud API
  const loadCloudDocuments = useCallback(async () => {
    if (!isCloudMode()) return [];
    
    try {
      /*const [result, folderTree, megaStatus] = await Promise.all([
        documentOpsApi.getDocuments({ view: 'all', page_size: 100 }),
        folderOpsApi.getFolderTree().catch(() => []),
        megaSettingsApi.getStatus().catch(() => ({ connected: false }))
      ]);*/
      const result =
    await documentOpsApi
        .getDocuments({ view: 'all', page_size: 100 });

console.log("DOCUMENT RESULT:", result);

const folderTree =
    await folderOpsApi
        .getFolderTree()
        .catch(() => []);

console.log("FOLDER TREE:", folderTree);

const megaStatus =
    await megaSettingsApi
        .getStatus()
        .catch(() => ({ connected: false }));

console.log("MEGA STATUS:", megaStatus);

      const cloudDocs = (result.documents || []).map(mapCloudDocumentToItem);
      const cloudFolders = flattenFolderTree(Array.isArray(folderTree) ? folderTree : [])
        .map(mapCloudFolderToItem);

      let megaItems = [];
      console.log("MEGA STATUS FULL:", megaStatus);
      if (megaStatus?.connected) {
        const megaFiles = await megaSettingsApi.listFiles().catch(() => ({ files: [] }));
        console.log("MEGA FILES:", megaFiles);
        megaItems = (megaFiles?.files || []).map(mapMegaFileToItem);
      }

      return mergeItemsById(mergeItemsById(cloudFolders, cloudDocs), megaItems);
    } catch (error) {
      console.error('Failed to load cloud documents:', error);
      throw error;
    }
  }, []);

  // Load data from localStorage or use defaults
  const loadData = useCallback(async () => {
    // Force fresh start - clear all existing data
    if (FORCE_FRESH_START) {
      localStorage.removeItem(STORAGE_KEY);
      dispatch({ type: ACTIONS.SET_ITEMS, payload: [] });
      return [];
    }
    
    // Cloud mode: source of truth is backend cloud storage (Google Drive + metadata)
    if (isCloudMode()) {
      try {
        const cloudDocs = await loadCloudDocuments();
        dispatch({ type: ACTIONS.SET_ITEMS, payload: cloudDocs });
        // Drive-only mode
        return cloudDocs;
      } catch (error) {
            console.error('Cloud load failed:', error);

            dispatch({
                type: ACTIONS.SET_ITEMS,
                payload: []
            });

            return [];
        }
    }
    
    // Fallback to localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const items = JSON.parse(saved);
        dispatch({ type: ACTIONS.SET_ITEMS, payload: items });
        return items;
      } catch {
        dispatch({ type: ACTIONS.SET_ITEMS, payload: defaultItems });
        return defaultItems;
      }
    }
    dispatch({ type: ACTIONS.SET_ITEMS, payload: defaultItems });
    safePersistItems(defaultItems);
    return defaultItems;
  }, [loadCloudDocuments]);

  // Save data to localStorage
  const saveData = useCallback((items) => {
    safePersistItems(items);
  }, []);

  // Update storage stats
  const updateStorage = useCallback(() => {
    const activeFiles = state.items.filter(i => !i.trash && i.type === 'file');
    const total = activeFiles.reduce((s, i) => s + (i.size || 0), 0);
    const capacity = 10 * 1073741824; // 10 GB
    dispatch({ 
      type: ACTIONS.SET_STORAGE, 
      payload: { used: total, total: capacity, percent: Math.min((total / capacity) * 100, 100) }
    });
    dispatch({ 
      type: ACTIONS.SET_TRASH_COUNT, 
      payload: state.items.filter(i => i.trash).length 
    });
  }, [state.items]);

  const ensureItemDataUrl = useCallback(async (itemId) => {
    const item = state.items.find(i => i.id === itemId);
    if (!item) throw new Error('File not found');

    if (item.dataUrl) {
  return { item, dataUrl: item.dataUrl };
}

// ===== MEGA FILE HANDLER =====
if (String(itemId).startsWith("mega:")) {

    const megaId = String(itemId).replace("mega:", "");

    const { megaSettingsApi } =
        await import("../utils/settingsApi");

    const blob =
        await megaSettingsApi.downloadFile(megaId);

    const dataUrl =
        URL.createObjectURL(blob);

    const updatedItems = state.items.map(i =>
        i.id === itemId
            ? { ...i, dataUrl }
            : i
    );

    dispatch({
        type: ACTIONS.SET_ITEMS,
        payload: updatedItems
    });

    saveData(updatedItems);

    return {
        item: { ...item, dataUrl },
        dataUrl
    };
}
    

    try {
      const { documentOpsApi } = await import('../utils/documentApi');
      const blob = await documentOpsApi.downloadDocument(itemId);
      const dataUrl = URL.createObjectURL(blob);

      const updatedItems = state.items.map(i =>
        i.id === itemId ? { ...i, dataUrl } : i
      );

      dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
      saveData(updatedItems);
      return { item: { ...item, dataUrl }, dataUrl };
    } catch (error) {
      console.warn('Primary download failed, trying legacy payload:', error);
    }

    try {
      const { documentsApi } = await import('../utils/api');
      const response = await documentsApi.getDocument(itemId);
      const legacyDoc = response?.data || null;
      if (legacyDoc?.dataUrl) {
        const updatedItems = state.items.map(i =>
          i.id === itemId ? { ...i, dataUrl: legacyDoc.dataUrl, content: legacyDoc.content ?? i.content } : i
        );
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return { item: { ...item, dataUrl: legacyDoc.dataUrl }, dataUrl: legacyDoc.dataUrl };
      }
    } catch (error) {
      console.warn('Legacy download failed:', error);
    }

    throw new Error('Unable to load file content for this operation.');
  }, [state.items, saveData]);

  const createDerivedPdfCopy = useCallback((sourceItem, pdfBytes, suffix, actionLabel) => {
    const baseName = sourceItem?.name || 'document.pdf';
    const safeBaseName = /\.pdf$/i.test(baseName) ? baseName : `${baseName}.pdf`;
    const derivedName = safeBaseName.replace(/\.pdf$/i, `${suffix}.pdf`);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const dataUrl = URL.createObjectURL(blob);

    const newFile = {
      id: generateId(),
      name: derivedName,
      type: 'file',
      size: pdfBytes.length,
      date: getCurrentDate(),
      created: getCurrentDate(),
      lastAccessed: getCurrentDate(),
      parentId: sourceItem?.parentId ?? state.currentFolder,
      dataUrl,
      fileType: 'PDF Document',
      favorite: false,
      tags: [...(sourceItem?.tags || [])],
      shared: [],
      trash: false,
      history: [{ action: actionLabel || 'Edited with PDF Power Tools', date: getCurrentDateTime(), user: 'Admin' }]
    };

    const updatedItems = [...state.items, newFile];
    dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
    saveData(updatedItems);

    return newFile;
  }, [state.items, state.currentFolder, saveData]);

  // Actions
  const actions = {
    refreshItems: async () => {
      if (isCloudMode()) {
        try {
          const cloudDocs = await loadCloudDocuments();
          dispatch({ type: ACTIONS.SET_ITEMS, payload: cloudDocs });
          //saveData(cloudDocs);
          return cloudDocs;
        } catch (error) {
          console.error('Cloud refresh failed:', error);
          return [];
        }
      }

      return state.items;
      if (!saved) return state.items;
      try {
        const items = JSON.parse(saved);
        dispatch({ type: ACTIONS.SET_ITEMS, payload: items });
        return items;
      } catch {
        return state.items;
      }
    },

    // Navigation with history
    navigateTo: (view) => {
      // Save current location to back history
      const currentLocation = { view: state.currentView, folder: state.currentFolder };
      dispatch({ 
        type: ACTIONS.SET_NAVIGATION_HISTORY, 
        payload: { 
          back: [...state.navigationHistory.back, currentLocation], 
          forward: [] 
        } 
      });
      const workspaceRoot = state.items.find(item => item.workspaceRoot && !item.trash);
      const folderTarget = view === 'workspace' ? (workspaceRoot ? workspaceRoot.id : null) : null;
      dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: view });
      dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: folderTarget });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
    },

    openFolder: (folderId) => {
      // Save current location to back history
      const currentLocation = { view: state.currentView, folder: state.currentFolder };
      dispatch({ 
        type: ACTIONS.SET_NAVIGATION_HISTORY, 
        payload: { 
          back: [...state.navigationHistory.back, currentLocation], 
          forward: [] 
        } 
      });
      dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: folderId });
      dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: 'folder' });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
      
      // Update last accessed
      const newItems = state.items.map(item => 
        item.id === folderId ? { ...item, lastAccessed: getCurrentDate() } : item
      );
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    goBack: () => {
      if (state.navigationHistory.back.length === 0) return;
      const back = [...state.navigationHistory.back];
      const previous = back.pop();
      const currentLocation = { view: state.currentView, folder: state.currentFolder };
      
      dispatch({ 
        type: ACTIONS.SET_NAVIGATION_HISTORY, 
        payload: { 
          back, 
          forward: [currentLocation, ...state.navigationHistory.forward] 
        } 
      });
      dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: previous.view });
      dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: previous.folder });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
    },

    goForward: () => {
      if (state.navigationHistory.forward.length === 0) return;
      const forward = [...state.navigationHistory.forward];
      const next = forward.shift();
      const currentLocation = { view: state.currentView, folder: state.currentFolder };
      
      dispatch({ 
        type: ACTIONS.SET_NAVIGATION_HISTORY, 
        payload: { 
          back: [...state.navigationHistory.back, currentLocation], 
          forward 
        } 
      });
      dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: next.view });
      dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: next.folder });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
    },

    goToPath: (path) => {
      // Parse path like "/Work Documents/Projects" and navigate
      if (!path || path === '/' || path === '') {
        dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: null });
        dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: 'home' });
        return true;
      }
      
      const parts = path.split('/').filter(p => p.trim());
      let currentParent = null;
      
      for (const part of parts) {
        const folder = state.items.find(i => 
          i.type === 'folder' && 
          i.name.toLowerCase() === part.toLowerCase() && 
          i.parentId === currentParent &&
          !i.trash
        );
        if (!folder) return false; // Path not found
        currentParent = folder.id;
      }
      
      dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: currentParent });
      dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: 'folder' });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
      return true;
    },

    goToRoot: () => {
      dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: null });
      dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: 'home' });
    },

    cutItems: () => {
      if (state.selectedItems.length === 0) return;
      dispatch({ 
        type: ACTIONS.SET_CLIPBOARD, 
        payload: { items: [...state.selectedItems], operation: 'cut' } 
      });
    },

    copyItems: () => {
      if (state.selectedItems.length === 0) return;
      dispatch({ 
        type: ACTIONS.SET_CLIPBOARD, 
        payload: { items: [...state.selectedItems], operation: 'copy' } 
      });
    },

    pasteItems: () => {
      if (state.clipboard.items.length === 0) return;
      
      const newItems = [...state.items];
      
      state.clipboard.items.forEach(id => {
        const orig = newItems.find(i => i.id === id);
        if (!orig) return;

        if (state.clipboard.operation === 'cut') {
          orig.parentId = state.currentFolder;
          orig.date = getCurrentDate();
          if (!orig.history) orig.history = [];
          orig.history.push({ action: 'Moved', date: getCurrentDateTime(), user: 'Admin' });
        } else {
          const copy = {
            ...orig,
            id: generateId(),
            name: orig.name.replace(/(\.[^.]+)?$/, ' - Copy$1'),
            parentId: state.currentFolder,
            date: getCurrentDate(),
            created: getCurrentDate(),
            shared: [],
            history: [{ action: 'Created (Copy)', date: getCurrentDateTime(), user: 'Admin' }]
          };
          newItems.push(copy);
        }
      });

      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
      
      if (state.clipboard.operation === 'cut') {
        dispatch({ type: ACTIONS.CLEAR_CLIPBOARD });
      }
    },

    clearClipboard: () => {
      dispatch({ type: ACTIONS.CLEAR_CLIPBOARD });
    },

    // CRUD Operations
    createFolder: async (name, parentId = undefined) => {
      const targetParent = parentId !== undefined ? parentId : state.currentFolder;
      const scope = state.activeStorageScope || null;

      if (isCloudMode()) {
        try {
          console.log("ACTIVE SCOPE:", state.activeStorageScope);
          const created = await folderOpsApi.createFolder(name, targetParent, scope?.id || null);
          console.log("CREATED FOLDER RESPONSE", created);
          const newFolder = mapCloudFolderToItem(created);
          const newItems = [...state.items, newFolder];
          dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
          saveData(newItems);
          return newFolder;
        } catch (error) {
          const detail = error?.response?.data?.detail;
          const isNetworkFailure = !error?.response && (error?.message || '').toLowerCase().includes('network');
          const message = detail || (isNetworkFailure
            ? 'Cannot reach server. Ensure backend is running on port 8000.'
            : error?.message) || 'Cloud create folder failed';
          console.warn('Cloud create folder failed. Falling back to local folder creation:', message, error);
        }
      }

      const finalName = resolveNameConflict(state.items, name, targetParent);
      const newFolder = {
        id: generateId(),
        name: finalName,
        type: 'folder',
        size: 0,
        date: getCurrentDate(),
        created: getCurrentDate(),
        parentId: targetParent,
        favorite: false,
        driveId: scope?.provider === 'google' ? scope.id : null,
        storageProvider: scope?.provider || 'google',
        tags: [],
        shared: [],
        trash: false,
        history: [{ action: 'Created', date: getCurrentDateTime(), user: 'Admin' }]
      };
      
      const newItems = [...state.items, newFolder];
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
      return newFolder;
    },

    uploadFile: async (file, parentId = undefined) => {
      const targetParent = parentId !== undefined ? parentId : state.currentFolder;
      const scope = state.activeStorageScope || null;

      if (scope?.provider === 'mega') {
        try {
          const uploadResult = await megaSettingsApi.uploadFile(file);

          const reader = new FileReader();
          return await new Promise((resolve) => {
            reader.onload = (event) => {
              const newFile = {
                id: `mega:${uploadResult.file_id}`,
                name: file.name,
                type: 'file',
                fileType: 'Document',
                size: file.size,
                date: getCurrentDate(),
                created: getCurrentDate(),
                parentId: targetParent,
                favorite: false,
                tags: [],
                shared: [],
                trash: false,
                content: null,
                dataUrl: event.target.result,
                mimeType: file.type || 'application/octet-stream',
                driveFileId: null,
                driveId: scope.id || 'mega-account',
                storageProvider: 'mega',
                isMega: true,
                history: [{ action: 'Uploaded to MEGA', date: getCurrentDateTime(), user: 'You' }]
              };

              const newItems = [...state.items, newFile];
              dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
              saveData(newItems);
              resolve(newFile);
            };
            reader.readAsDataURL(file);
          });
        } catch (error) {
          console.warn('MEGA upload failed:', error);
          throw error;
        }
      }
      
      // Prefer cloud API when authenticated, but gracefully fall back to local mode.
      if (isCloudMode()) {
        try {
          const scopedDriveId = scope?.provider === 'google' ? scope.id : null;
          const result = await documentOpsApi.uploadFile(file, targetParent, null, [], scopedDriveId);
          const doc = result.document;
          
          // Add to local state for immediate UI update
          const newFile = {
            ...mapCloudDocumentToItem(doc),
            history: [{ action: 'Uploaded to Google Drive', date: getCurrentDateTime(), user: 'You' }]
          };
          
          const newItems = [...state.items, newFile];
          dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
          saveData(newItems);
          return newFile;
        } catch (error) {
          console.warn('Cloud upload failed. Falling back to local upload:', error);
        }
      }
      
      // Fallback to local storage upload
      return new Promise((resolve) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          const uniqueName = resolveNameConflict(state.items, file.name, targetParent);
          const ext = file.name.split('.').pop().toLowerCase();
          const typeMap = {
            'pdf': 'PDF', 'doc': 'Word', 'docx': 'Word',
            'xls': 'Excel', 'xlsx': 'Excel',
            'ppt': 'PowerPoint', 'pptx': 'PowerPoint',
            'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'svg': 'Image', 'webp': 'Image', 'bmp': 'Image',
            'txt': 'Text', 'md': 'Text',
            'mp4': 'Video', 'webm': 'Video', 'mov': 'Video', 'avi': 'Video', 'mkv': 'Video', 'm4v': 'Video', 'ogg': 'Video', 'ogv': 'Video',
            'mp3': 'Audio', 'wav': 'Audio', 'flac': 'Audio', 'aac': 'Audio', 'm4a': 'Audio', 'wma': 'Audio'
          };
          
          const isText = file.type?.startsWith('text/') || 
            ['txt', 'js', 'css', 'html', 'json', 'xml', 'csv', 'md', 'py', 'java', 'c', 'cpp', 'h', 'sql', 'log'].includes(ext);
          
          const newFile = {
            id: generateId(),
            name: uniqueName,
            type: 'file',
            fileType: typeMap[ext] || 'Document',
            size: file.size,
            date: getCurrentDate(),
            created: getCurrentDate(),
            parentId: targetParent,
            favorite: false,
            driveId: scope?.provider === 'google' ? scope.id : null,
            storageProvider: scope?.provider || 'google',
            tags: [],
            shared: [],
            trash: false,
            content: isText ? event.target.result : null,
            dataUrl: !isText ? event.target.result : null,
            mimeType: file.type || 'application/octet-stream',
            history: [{ action: 'Uploaded', date: getCurrentDateTime(), user: 'Admin' }]
          };
          
          const newItems = [...state.items, newFile];
          dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
          saveData(newItems);
          resolve(newFile);
        };
        
        const isTextFile = file.type?.startsWith('text/') || 
          ['txt', 'js', 'css', 'html', 'json', 'xml', 'csv', 'md', 'py', 'java', 'c', 'cpp', 'h', 'sql', 'log'].includes(
            file.name.split('.').pop().toLowerCase()
          );
        
        if (isTextFile) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
    },

    renameItem: async (id, newName) => {
      const targetItem = state.items.find(item => item.id === id);
      if (isCloudMode() && targetItem?.isCloud) {
        try {
          if (targetItem.type === 'folder') {
            await folderOpsApi.updateFolder(id, { name: newName });
          } else {
            await documentOpsApi.updateDocument(id, { display_name: newName });
          }
        } catch (error) {
          console.error('Cloud rename failed:', error);
          return;
        }
      }

      const newItems = state.items.map(item => {
        if (item.id === id) {
          const oldName = item.name;
          const finalName = resolveNameConflict(state.items, newName, item.parentId, item.id);
          return {
            ...item,
            name: finalName,
            date: getCurrentDate(),
            versionId: bumpVersion(item.versionId),
            history: [...(item.history || []), { action: `Renamed from "${oldName}"`, date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    moveItem: async (id, targetFolderId) => {
      const targetItem = state.items.find(item => item.id === id);
      if (isCloudMode() && targetItem?.isCloud) {
        try {
          if (targetItem.type === 'folder') {
            await folderOpsApi.moveFolder(id, targetFolderId || null);
          } else {
            await documentOpsApi.moveDocument(id, targetFolderId || null);
          }
        } catch (error) {
          console.error('Cloud move failed:', error);
          return;
        }
      }

      const newItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            parentId: targetFolderId,
            date: getCurrentDate(),
            versionId: bumpVersion(item.versionId),
            history: [...(item.history || []), { action: 'Moved', date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    duplicateItem: (id) => {
      const orig = state.items.find(i => i.id === id);
      if (!orig) return;
      
      const copy = {
        ...orig,
        id: generateId(),
        name: resolveNameConflict(state.items, orig.name.replace(/(\.[^.]+)?$/, ' - Copy$1'), orig.parentId),
        date: getCurrentDate(),
        created: getCurrentDate(),
        shared: [],
        history: [{ action: 'Created (Copy)', date: getCurrentDateTime(), user: 'Admin' }]
      };
      
      const newItems = [...state.items, copy];
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
      return copy;
    },

    toggleFavorite: async (id) => {
      const targetItem = state.items.find(item => item.id === id);
      if (isCloudMode() && targetItem?.isCloud && targetItem.type !== 'folder') {
        try {
          await documentOpsApi.toggleFavorite(id);
        } catch (error) {
          console.error('Cloud toggle favorite failed:', error);
          return;
        }
      }

      const newItems = state.items.map(item => {
        if (item.id === id) {
          const newFavorite = !item.favorite;
          return {
            ...item,
            favorite: newFavorite,
            history: [...(item.history || []), { 
              action: newFavorite ? 'Added to favorites' : 'Removed from favorites', 
              date: getCurrentDateTime(), 
              user: 'Admin' 
            }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    moveToTrash: async (ids) => {
      const itemIds = Array.isArray(ids) ? ids : [ids];

      if (isCloudMode()) {
        for (const itemId of itemIds) {
          const targetItem = state.items.find(item => item.id === itemId);
          if (!targetItem?.isCloud || targetItem.type === 'folder') continue;
          try {
            await documentOpsApi.deleteDocument(itemId, false);
          } catch (error) {
            console.error('Cloud trash failed:', error);
            return;
          }
        }
      }

      const newItems = state.items.map(item => {
        if (itemIds.includes(item.id)) {
          return {
            ...item,
            trash: true,
            history: [...(item.history || []), { action: 'Moved to trash', date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
      saveData(newItems);
    },

    restoreFromTrash: async (ids) => {
      const itemIds = Array.isArray(ids) ? ids : [ids];

      if (isCloudMode()) {
        for (const itemId of itemIds) {
          const targetItem = state.items.find(item => item.id === itemId);
          if (!targetItem?.isCloud || targetItem.type === 'folder') continue;
          try {
            await documentOpsApi.restoreDocument(itemId);
          } catch (error) {
            console.error('Cloud restore failed:', error);
            return;
          }
        }
      }

      const newItems = state.items.map(item => {
        if (itemIds.includes(item.id)) {
          return {
            ...item,
            trash: false,
            history: [...(item.history || []), { action: 'Restored from trash', date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
      saveData(newItems);
    },

    restoreAllTrash: () => {
      const newItems = state.items.map(item => {
        if (item.trash) {
          return {
            ...item,
            trash: false,
            history: [...(item.history || []), { action: 'Restored from trash', date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    emptyTrash: () => {
      const newItems = state.items.filter(i => !i.trash);
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    permanentlyDelete: (ids) => {
      const itemIds = Array.isArray(ids) ? ids : [ids];
      const newItems = state.items.filter(i => !itemIds.includes(i.id));
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
      saveData(newItems);
    },

    // Sharing
    addShare: async (id, email, permission = 'viewer') => {
      const targetItem = state.items.find(item => item.id === id);
      if (isCloudMode() && targetItem?.isCloud && targetItem.type !== 'folder') {
        try {
          await documentOpsApi.shareDocument(id, email, permission);
        } catch (error) {
          console.error('Cloud share failed:', error);
          return;
        }
      }

      const newItems = state.items.map(item => {
        if (item.id === id) {
          const shared = item.shared || [];
          if (shared.find(s => s.email === email)) return item;
          return {
            ...item,
            shared: [...shared, { email, permission }],
            history: [...(item.history || []), { action: `Shared with ${email}`, date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    removeShare: async (id, email) => {
      const targetItem = state.items.find(item => item.id === id);
      if (isCloudMode() && targetItem?.isCloud && targetItem.type !== 'folder') {
        try {
          await documentOpsApi.removeShare(id, email);
        } catch (error) {
          console.error('Cloud remove share failed:', error);
          return;
        }
      }

      const newItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            shared: (item.shared || []).filter(s => s.email !== email),
            history: [...(item.history || []), { action: `Removed ${email} from sharing`, date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    // Tags
    addTag: async (id, tag) => {
      const targetItem = state.items.find(item => item.id === id);
      if (isCloudMode() && targetItem?.isCloud && targetItem.type !== 'folder') {
        try {
          await documentOpsApi.addTag(id, tag);
        } catch (error) {
          console.error('Cloud add tag failed:', error);
          return;
        }
      }

      const newItems = state.items.map(item => {
        if (item.id === id) {
          const tags = item.tags || [];
          if (tags.includes(tag)) return item;
          return {
            ...item,
            tags: [...tags, tag],
            history: [...(item.history || []), { action: `Added tag: ${tag}`, date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    removeTag: async (id, tag) => {
      const targetItem = state.items.find(item => item.id === id);
      if (isCloudMode() && targetItem?.isCloud && targetItem.type !== 'folder') {
        try {
          await documentOpsApi.removeTag(id, tag);
        } catch (error) {
          console.error('Cloud remove tag failed:', error);
          return;
        }
      }

      const newItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            tags: (item.tags || []).filter(t => t !== tag),
            history: [...(item.history || []), { action: `Removed tag: ${tag}`, date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    // Content
    updateContent: (id, content) => {
      const newItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            content,
            size: new Blob([content]).size,
            date: getCurrentDate(),
            versionId: bumpVersion(item.versionId),
            history: [...(item.history || []), { action: 'Edited', date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    // History
    addHistory: (id, action) => {
      const newItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            history: [...(item.history || []), { action, date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    // Search
    setSearchQuery: (query) => {
      dispatch({ type: ACTIONS.SET_SEARCH_QUERY, payload: query });
    },

    // View mode
    setViewMode: (mode) => {
      dispatch({ type: ACTIONS.SET_VIEW_MODE, payload: mode });
    },

    // Selection
    selectItem: (id) => {
      dispatch({ type: ACTIONS.SET_SELECTED_ITEMS, payload: [String(id)] });
    },

    toggleSelectItem: (id) => {
      const normalized = String(id);
      const current = state.selectedItems.map(selectedId => String(selectedId));
      if (current.includes(normalized)) {
        dispatch({ type: ACTIONS.REMOVE_SELECTED_ITEM, payload: normalized });
      } else {
        dispatch({ type: ACTIONS.ADD_SELECTED_ITEM, payload: normalized });
      }
    },

    clearSelection: () => {
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
    },

    // Pinning
    togglePin: (id) => {
      const newItems = state.items.map(item => {
        if (item.id === id) {
          const newPinned = !item.pinned;
          return {
            ...item,
            pinned: newPinned,
            history: [...(item.history || []), { 
              action: newPinned ? 'Pinned to Quick Access' : 'Unpinned from Quick Access', 
              date: getCurrentDateTime(), 
              user: 'Admin' 
            }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    // Folder appearance
    updateFolderAppearance: (id, { color, icon }) => {
      const newItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            color: color || item.color,
            icon: icon || item.icon,
            history: [...(item.history || []), { action: 'Changed appearance', date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    // Item properties (category, status, sensitivity)
    updateItemProperties: (id, updates = {}) => {
      const {
        category,
        status,
        sensitivity,
        description,
        notes,
        customLabels,
        priority,
        favorite,
        compressionState,
        encryptionState
      } = updates;
      const newItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            category: category ?? item.category,
            status: status ?? item.status,
            sensitivity: sensitivity ?? item.sensitivity,
            description: description ?? item.description,
            notes: notes ?? item.notes,
            customLabels: Array.isArray(customLabels) ? customLabels : (item.customLabels || []),
            priority: priority ?? item.priority,
            favorite: typeof favorite === 'boolean' ? favorite : item.favorite,
            compressionState: compressionState ?? item.compressionState,
            encryptionState: encryptionState ?? item.encryptionState,
            date: getCurrentDate(),
            versionId: bumpVersion(item.versionId),
            history: [...(item.history || []), { action: 'Updated properties', date: getCurrentDateTime(), user: 'Admin' }]
          };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
    },

    // Calculate folder size
    calculateFolderSize: (folderId) => {
      const getSize = (id) => {
        const children = state.items.filter(i => i.parentId === id && !i.trash);
        let size = 0;
        for (const child of children) {
          if (child.type === 'folder') {
            size += getSize(child.id);
          } else {
            size += child.size || 0;
          }
        }
        return size;
      };
      
      const folderSize = getSize(folderId);
      const newItems = state.items.map(item => {
        if (item.id === folderId) {
          return { ...item, folderSize };
        }
        return item;
      });
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
      return folderSize;
    },

    // Secure delete (overwrite)
    secureDelete: (ids) => {
      const itemIds = Array.isArray(ids) ? ids : [ids];
      // In a real app, this would overwrite the file data before deletion
      const newItems = state.items.filter(i => !itemIds.includes(i.id));
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
      saveData(newItems);
    },

    // Archive operations
    createArchive: (itemIds, archiveName) => {
      const items = state.items.filter(i => itemIds.includes(i.id));
      const totalSize = items.reduce((sum, i) => sum + (i.size || 0), 0);
      
      const archive = {
        id: generateId(),
        name: archiveName || 'archive.zip',
        type: 'file',
        fileType: 'Archive',
        size: Math.round(totalSize * 0.7), // Simulated compression
        date: getCurrentDate(),
        created: getCurrentDate(),
        lastAccessed: getCurrentDate(),
        parentId: state.currentFolder,
        favorite: false,
        pinned: false,
        tags: [],
        shared: [],
        trash: false,
        category: 'Archives',
        isArchive: true,
        archiveContents: items.map(i => ({ id: i.id, name: i.name, type: i.type })),
        history: [{ action: 'Created (Archive)', date: getCurrentDateTime(), user: 'Admin' }]
      };
      
      const newItems = [...state.items, archive];
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
      return archive;
    },

    extractArchive: (archiveId, targetFolderId) => {
      const archive = state.items.find(i => i.id === archiveId);
      if (!archive || !archive.archiveContents) return;
      
      // Create a folder for extraction
      const extractFolder = {
        id: generateId(),
        name: archive.name.replace('.zip', ''),
        type: 'folder',
        size: 0,
        date: getCurrentDate(),
        created: getCurrentDate(),
        parentId: targetFolderId ?? state.currentFolder,
        favorite: false,
        tags: [],
        shared: [],
        trash: false,
        history: [{ action: 'Extracted from archive', date: getCurrentDateTime(), user: 'Admin' }]
      };
      
      const newItems = [...state.items, extractFolder];
      dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
      saveData(newItems);
      return extractFolder;
    },

    // Merge PDFs
    mergePDFs: async (itemIds, outputName = 'merged.pdf') => {
      try {
        const { mergePDFs: mergeUtil } = await import('../utils/pdfPowerTools');
        const items = state.items.filter(i => itemIds.includes(i.id));
        const pdfItems = items.filter(i => i.name.toLowerCase().endsWith('.pdf') && i.dataUrl);
        
        if (pdfItems.length < 2) throw new Error('Select at least 2 PDF files');
        
        const pdfUrls = pdfItems.map(i => i.dataUrl);
        const mergedPdfBytes = await mergeUtil(pdfUrls);
        
        // Save result as new file
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const dataUrl = URL.createObjectURL(blob);
        
        const newFile = {
          id: generateId(),
          name: outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`,
          type: 'file',
          size: mergedPdfBytes.length,
          date: getCurrentDate(),
          created: getCurrentDate(),
          lastAccessed: getCurrentDate(),
          parentId: state.currentFolder,
          dataUrl,
          fileType: 'PDF Document',
          favorite: false,
          tags: [],
          shared: [],
          trash: false,
          history: [{ action: 'Created by Merging', date: getCurrentDateTime(), user: 'Admin' }]
        };
        
        const newItems = [...state.items, newFile];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: newItems });
        saveData(newItems);
        return newFile;
      } catch (err) {
        console.error('Merge error:', err);
        throw err;
      }
    },

    // === PDF POWER TOOLS (20 Advanced Features) ===
    
    // 1-2. Form Filling & Save
    fillPDFForm: async (itemId, formData) => {
      try {
        const { fillPDFForm } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const filledBytes = await fillPDFForm(sourceUrl, formData);
        const newFile = createDerivedPdfCopy(item, filledBytes, '_form_filled', 'Filled PDF form');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Fill form error:', err);
        throw err;
      }
    },

    saveFlattenedForm: async (itemId) => {
      try {
        const { saveFlattenedForm } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const flattenedBytes = await saveFlattenedForm(sourceUrl);
        const newFile = createDerivedPdfCopy(item, flattenedBytes, '_flattened', 'Flattened PDF form');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Flatten form error:', err);
        throw err;
      }
    },

    // 3-4. Digital Signatures
    addSignature: async (itemId, signatureData) => {
      try {
        const { addSignatureToPDF } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const signedBytes = await addSignatureToPDF(sourceUrl, signatureData);
        const newFile = createDerivedPdfCopy(item, signedBytes, '_signed', 'Added signature to PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Add signature error:', err);
        throw err;
      }
    },

    addMultipleSignatures: async (itemId, signatures) => {
      try {
        const { addMultipleSignatures } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const signedBytes = await addMultipleSignatures(sourceUrl, signatures);
        const newFile = createDerivedPdfCopy(item, signedBytes, '_multi_signed', 'Added multiple signatures to PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Add multiple signatures error:', err);
        throw err;
      }
    },

    // 5. Watermark
    addWatermark: async (itemId, watermarkConfig) => {
      try {
        const { addWatermark } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const watermarkedBytes = await addWatermark(sourceUrl, watermarkConfig);
        const newFile = createDerivedPdfCopy(item, watermarkedBytes, '_watermarked', 'Added watermark to PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Add watermark error:', err);
        throw err;
      }
    },

    // 6. Page Background
    addPageBackground: async (itemId, bgConfig) => {
      try {
        const { addPageBackground } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const bgBytes = await addPageBackground(sourceUrl, bgConfig);
        const newFile = createDerivedPdfCopy(item, bgBytes, '_background', 'Added background to PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Add background error:', err);
        throw err;
      }
    },

    // 7. Add/Remove Pages
    addPDFPages: async (itemId, config) => {
      try {
        const { addPages } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const modifiedBytes = await addPages(sourceUrl, config);
        const newFile = createDerivedPdfCopy(item, modifiedBytes, '_pages_added', 'Added pages to PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Add pages error:', err);
        throw err;
      }
    },

    removePDFPages: async (itemId, pageIndices) => {
      try {
        const { removePages } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const modifiedBytes = await removePages(sourceUrl, pageIndices);
        const newFile = createDerivedPdfCopy(item, modifiedBytes, '_pages_removed', 'Removed pages from PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Remove pages error:', err);
        throw err;
      }
    },

    insertPDFPagesFromPDF: async (itemId, insertSource, options = {}) => {
      try {
        const { insertPagesFromPDF } = await import('../utils/pdfPowerTools');

        let insertUrl = null;
        if (insertSource instanceof File) {
          insertUrl = URL.createObjectURL(insertSource);
        } else if (typeof insertSource === 'string') {
          insertUrl = insertSource;
        } else {
          throw new Error('Insert source must be a PDF file');
        }

        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        const modifiedBytes = await insertPagesFromPDF(sourceUrl, insertUrl, options);
        if (insertSource instanceof File) URL.revokeObjectURL(insertUrl);

        const newFile = createDerivedPdfCopy(item, modifiedBytes, '_pages_inserted', 'Inserted pages into PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Insert pages error:', err);
        throw err;
      }
    },

    duplicatePDFPages: async (itemId, pageIndices, copies = 1) => {
      try {
        const { duplicatePages } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);

        const modifiedBytes = await duplicatePages(sourceUrl, pageIndices, copies);
        const newFile = createDerivedPdfCopy(item, modifiedBytes, '_pages_duplicated', 'Duplicated pages in PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Duplicate pages error:', err);
        throw err;
      }
    },

    // 9. Split by Range
    splitPDFByRange: async (itemId, ranges) => {
      try {
        const { splitPDFByRange } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const splitPdfs = await splitPDFByRange(sourceUrl, ranges);
        const newFiles = [];
        
        splitPdfs.forEach((entry, index) => {
          const pdfBytes = entry?.bytes || entry;
          const fileName = entry?.name || `${item.name.replace('.pdf', '')}_part${index + 1}.pdf`;
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const dataUrl = URL.createObjectURL(blob);
          
          const newFile = {
            id: generateId(),
            name: fileName,
            type: 'file',
            size: pdfBytes.length,
            date: getCurrentDate(),
            created: getCurrentDate(),
            lastAccessed: getCurrentDate(),
            parentId: state.currentFolder,
            dataUrl,
            fileType: 'PDF Document',
            favorite: false,
            tags: [],
            shared: [],
            trash: false,
            history: [{ action: 'Split from PDF', date: getCurrentDateTime(), user: 'Admin' }]
          };
          newFiles.push(newFile);
        });
        
        const updatedItems = [...state.items, ...newFiles];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFiles;
      } catch (err) {
        console.error('Split PDF error:', err);
        throw err;
      }
    },

    splitPDFToSinglePages: async (itemId) => {
      try {
        const { splitPDFToSinglePages } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);

        const splitPdfs = await splitPDFToSinglePages(sourceUrl);
        const newFiles = [];

        splitPdfs.forEach((entry, index) => {
          const blob = new Blob([entry.bytes], { type: 'application/pdf' });
          const dataUrl = URL.createObjectURL(blob);
          const name = entry.name || `${item.name.replace('.pdf', '')}_page${index + 1}.pdf`;

          newFiles.push({
            id: generateId(),
            name,
            type: 'file',
            size: entry.bytes.length,
            date: getCurrentDate(),
            created: getCurrentDate(),
            lastAccessed: getCurrentDate(),
            parentId: state.currentFolder,
            dataUrl,
            fileType: 'PDF Document',
            favorite: false,
            tags: [],
            shared: [],
            trash: false,
            history: [{ action: 'Split from PDF', date: getCurrentDateTime(), user: 'Admin' }]
          });
        });

        const updatedItems = [...state.items, ...newFiles];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFiles;
      } catch (err) {
        console.error('Split to pages error:', err);
        throw err;
      }
    },

    // 10-12. Password Protection
    passwordProtectPDF: async (itemId, passwords) => {
      try {
        const { passwordProtectPDF } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const protectedBytes = await passwordProtectPDF(sourceUrl, passwords);
        const newFile = createDerivedPdfCopy(item, protectedBytes, '_protected', 'Password-protected PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Password protect error:', err);
        throw err;
      }
    },

    removePasswordPDF: async (itemId, password) => {
      try {
        const { removePasswordPDF } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const unlockedBytes = await removePasswordPDF(sourceUrl, password);
        const newFile = createDerivedPdfCopy(item, unlockedBytes, '_unlocked', 'Removed PDF password');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Remove password error:', err);
        throw err;
      }
    },

    // 13. PDF to Text
    pdfToText: async (itemId) => {
      try {
        const { pdfToText } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const text = await pdfToText(sourceUrl);
        
        const blob = new Blob([text], { type: 'text/plain' });
        const dataUrl = URL.createObjectURL(blob);
        
        const newFile = {
          id: generateId(),
          name: item.name.replace('.pdf', '.txt'),
          type: 'file',
          size: text.length,
          date: getCurrentDate(),
          created: getCurrentDate(),
          lastAccessed: getCurrentDate(),
          parentId: state.currentFolder,
          dataUrl,
          content: text,
          fileType: 'Text Document',
          favorite: false,
          tags: [],
          shared: [],
          trash: false,
          history: [{ action: 'Converted from PDF', date: getCurrentDateTime(), user: 'Admin' }]
        };
        
        const updatedItems = [...state.items, newFile];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFile;
      } catch (err) {
        console.error('PDF to text error:', err);
        throw err;
      }
    },

    extractPDFPages: async (itemId, pageIndices) => {
      try {
        const { extractPages } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);

        const extractedBytes = await extractPages(sourceUrl, pageIndices);
        const blob = new Blob([extractedBytes], { type: 'application/pdf' });
        const dataUrl = URL.createObjectURL(blob);
        const suffix = pageIndices.map(i => i + 1).join('-');

        const newFile = {
          id: generateId(),
          name: `${item.name.replace('.pdf', '')}_extract_${suffix}.pdf`,
          type: 'file',
          size: extractedBytes.length,
          date: getCurrentDate(),
          created: getCurrentDate(),
          lastAccessed: getCurrentDate(),
          parentId: state.currentFolder,
          dataUrl,
          fileType: 'PDF Document',
          favorite: false,
          tags: [],
          shared: [],
          trash: false,
          history: [{ action: 'Extracted pages', date: getCurrentDateTime(), user: 'Admin' }]
        };

        const updatedItems = [...state.items, newFile];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFile;
      } catch (err) {
        console.error('Extract pages error:', err);
        throw err;
      }
    },

    // 14. PDF to Images
    pdfToImages: async (itemId) => {
      try {
        const { pdfToImages } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const images = await pdfToImages(sourceUrl);
        const newFiles = [];
        
        images.forEach((image, index) => {
          const imageDataUrl = typeof image === 'string' ? image : image?.dataUrl;
          const imageName = typeof image === 'string'
            ? `${item.name.replace('.pdf', '')}_page${index + 1}.png`
            : (image?.name || `${item.name.replace('.pdf', '')}_page${index + 1}.png`);

          if (!imageDataUrl) return;

          const newFile = {
            id: generateId(),
            name: imageName,
            type: 'file',
            size: 0,
            date: getCurrentDate(),
            created: getCurrentDate(),
            lastAccessed: getCurrentDate(),
            parentId: state.currentFolder,
            dataUrl: imageDataUrl,
            fileType: 'Image',
            favorite: false,
            tags: [],
            shared: [],
            trash: false,
            history: [{ action: 'Extracted from PDF', date: getCurrentDateTime(), user: 'Admin' }]
          };
          newFiles.push(newFile);
        });
        
        const updatedItems = [...state.items, ...newFiles];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFiles;
      } catch (err) {
        console.error('PDF to images error:', err);
        throw err;
      }
    },

    extractPDFTables: async (itemId) => {
      try {
        const { extractTablesToCSV } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);

        const result = await extractTablesToCSV(sourceUrl);
        const csv = result.csv || '';
        const blob = new Blob([csv], { type: 'text/csv' });
        const dataUrl = URL.createObjectURL(blob);

        const newFile = {
          id: generateId(),
          name: item.name.replace('.pdf', '_tables.csv'),
          type: 'file',
          size: csv.length,
          date: getCurrentDate(),
          created: getCurrentDate(),
          lastAccessed: getCurrentDate(),
          parentId: state.currentFolder,
          dataUrl,
          content: csv,
          fileType: 'CSV',
          favorite: false,
          tags: [],
          shared: [],
          trash: false,
          history: [{ action: 'Extracted tables', date: getCurrentDateTime(), user: 'Admin' }]
        };

        const updatedItems = [...state.items, newFile];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFile;
      } catch (err) {
        console.error('Extract tables error:', err);
        throw err;
      }
    },

    extractPDFFonts: async (itemId) => {
      try {
        const { extractEmbeddedFonts } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);

        const fonts = await extractEmbeddedFonts(sourceUrl);
        const content = fonts.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const dataUrl = URL.createObjectURL(blob);

        const newFile = {
          id: generateId(),
          name: item.name.replace('.pdf', '_fonts.txt'),
          type: 'file',
          size: content.length,
          date: getCurrentDate(),
          created: getCurrentDate(),
          lastAccessed: getCurrentDate(),
          parentId: state.currentFolder,
          dataUrl,
          content,
          fileType: 'Text Document',
          favorite: false,
          tags: [],
          shared: [],
          trash: false,
          history: [{ action: 'Extracted fonts', date: getCurrentDateTime(), user: 'Admin' }]
        };

        const updatedItems = [...state.items, newFile];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFile;
      } catch (err) {
        console.error('Extract fonts error:', err);
        throw err;
      }
    },

    // 15. Images to PDF
    imagesToPDF: async (itemIds, outputName = 'images.pdf') => {
      try {
        const { imagesToPDF } = await import('../utils/pdfPowerTools');
        const items = state.items.filter(i => itemIds.includes(i.id));
        const imageItems = items.filter(i => 
          ['jpg', 'jpeg', 'png', 'gif', 'bmp'].some(ext => i.name.toLowerCase().endsWith(ext))
        );
        
        if (imageItems.length === 0) throw new Error('No image files selected');
        
        const imageUrls = imageItems.map(i => i.dataUrl);
        const pdfBytes = await imagesToPDF(imageUrls);
        
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const dataUrl = URL.createObjectURL(blob);
        
        const newFile = {
          id: generateId(),
          name: outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`,
          type: 'file',
          size: pdfBytes.length,
          date: getCurrentDate(),
          created: getCurrentDate(),
          lastAccessed: getCurrentDate(),
          parentId: state.currentFolder,
          dataUrl,
          fileType: 'PDF Document',
          favorite: false,
          tags: [],
          shared: [],
          trash: false,
          history: [{ action: 'Created from Images', date: getCurrentDateTime(), user: 'Admin' }]
        };
        
        const updatedItems = [...state.items, newFile];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFile;
      } catch (err) {
        console.error('Images to PDF error:', err);
        throw err;
      }
    },

    // 16. Reorder Pages
    reorderPDFPages: async (itemId, newOrder) => {
      try {
        const { reorderPDFPages } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const reorderedBytes = await reorderPDFPages(sourceUrl, newOrder);
        const newFile = createDerivedPdfCopy(item, reorderedBytes, '_reordered', 'Reordered PDF pages');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Reorder pages error:', err);
        throw err;
      }
    },

    rotatePDFPages: async (itemId, degrees, pageIndices = null) => {
      try {
        const { rotatePDF } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);

        const rotatedBytes = await rotatePDF(sourceUrl, degrees, pageIndices);
        const newFile = createDerivedPdfCopy(item, rotatedBytes, '_rotated', 'Rotated PDF pages');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Rotate PDF error:', err);
        throw err;
      }
    },

    compressPDF: async (itemId) => {
      try {
        const { compressPDF } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);

        const compressedBytes = await compressPDF(sourceUrl);
        const newFile = createDerivedPdfCopy(item, compressedBytes, '_compressed', 'Compressed PDF');
        return newFile.dataUrl;
      } catch (err) {
        console.error('Compress PDF error:', err);
        throw err;
      }
    },

    // 18. DOC to PDF
    docToPDF: async (itemId) => {
      try {
        const { docToPDF } = await import('../utils/pdfPowerTools');
        const { item, dataUrl: sourceUrl } = await ensureItemDataUrl(itemId);
        
        const pdfBytes = await docToPDF(sourceUrl);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const dataUrl = URL.createObjectURL(blob);
        
        const newFile = {
          id: generateId(),
          name: item.name.replace(/\.(docx?|doc)$/i, '.pdf'),
          type: 'file',
          size: pdfBytes.length,
          date: getCurrentDate(),
          created: getCurrentDate(),
          lastAccessed: getCurrentDate(),
          parentId: state.currentFolder,
          dataUrl,
          fileType: 'PDF Document',
          favorite: false,
          tags: [],
          shared: [],
          trash: false,
          history: [{ action: 'Converted from DOC', date: getCurrentDateTime(), user: 'Admin' }]
        };
        
        const updatedItems = [...state.items, newFile];
        dispatch({ type: ACTIONS.SET_ITEMS, payload: updatedItems });
        saveData(updatedItems);
        return newFile;
      } catch (err) {
        console.error('DOC to PDF error:', err);
        throw err;
      }
    },

    // 20. Save As
    savePDFAs: async (itemId, filename, options) => {
      try {
        const { savePDFAs } = await import('../utils/pdfPowerTools');
        const { dataUrl } = await ensureItemDataUrl(itemId);
        
        const response = await fetch(dataUrl);
        const pdfBytes = await response.arrayBuffer();
        
        await savePDFAs(new Uint8Array(pdfBytes), filename, options);
        return true;
      } catch (err) {
        console.error('Save PDF as error:', err);
        throw err;
      }
    },

    // Upload folder (recursive)
    uploadFolder: async (folderFiles, parentId = null) => {
      // folderFiles is an array from webkitdirectory input
      const targetParent = parentId ?? state.currentFolder;
      const folderStructure = {};
      
      // Build folder structure
      for (const file of folderFiles) {
        const path = file.webkitRelativePath || file.name;
        const parts = path.split('/');
        
        let current = folderStructure;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = { _isFolder: true, _children: {} };
          }
          current = current[parts[i]]._children;
        }
        current[parts[parts.length - 1]] = file;
      }
      
      // Create folders and files recursively
      const createStructure = async (structure, parentId) => {
        for (const [name, content] of Object.entries(structure)) {
          if (content._isFolder) {
            const folder = actions.createFolder(name, parentId);
            await createStructure(content._children, folder.id);
          } else {
            await actions.uploadFile(content, parentId);
          }
        }
      };
      
      await createStructure(folderStructure, targetParent);
    },

    // Filters
    setFilterCategory: (category) => {
      dispatch({ type: ACTIONS.SET_FILTER_CATEGORY, payload: category });
    },

    setFilterStatus: (status) => {
      dispatch({ type: ACTIONS.SET_FILTER_STATUS, payload: status });
    },

    setFilterSensitivity: (sensitivity) => {
      dispatch({ type: ACTIONS.SET_FILTER_SENSITIVITY, payload: sensitivity });
    },

    clearFilters: () => {
      dispatch({ type: ACTIONS.SET_FILTER_CATEGORY, payload: null });
      dispatch({ type: ACTIONS.SET_FILTER_STATUS, payload: null });
      dispatch({ type: ACTIONS.SET_FILTER_SENSITIVITY, payload: null });
    },

    setStorageScope: (scope = null) => {
      dispatch({ type: ACTIONS.SET_STORAGE_SCOPE, payload: scope });
      dispatch({ type: ACTIONS.SET_CURRENT_FOLDER, payload: null });
      dispatch({ type: ACTIONS.SET_CURRENT_VIEW, payload: 'home' });
      dispatch({ type: ACTIONS.CLEAR_SELECTION });
    },

    // Sorting
    setSort: (sortBy, sortOrder = 'asc') => {
      dispatch({ type: ACTIONS.SET_SORT, payload: { sortBy, sortOrder } });
    },

    // File conflict detection
    checkNameConflict: (name, parentId, ignoreId = null) => {
      return hasNameConflict(state.items, name, parentId, ignoreId);
    },

    // Smart duplicate name resolution
    getUniqueName: (name, parentId, ignoreId = null) => {
      return resolveNameConflict(state.items, name, parentId, ignoreId);
    },

    // Load data
    loadData,
    updateStorage,
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions, ACTIONS }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export { ACTIONS };
