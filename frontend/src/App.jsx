import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { useToast } from './hooks/useToast';
import { useContextMenu } from './hooks/useContextMenu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { VIEW_TITLES } from './utils/helpers';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ClipboardBar from './components/ClipboardBar';
import DocumentGrid from './components/DocumentGrid';
import EmptyState from './components/EmptyState';
import PropertiesPanel from './components/PropertiesPanel';
import ContextMenu from './components/ContextMenu';
import SelectionBar from './components/SelectionBar';
import ToastContainer from './components/ToastContainer';
import ActivityDashboard from './components/ActivityDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import TreeView from './components/TreeView';

const SPLIT_PANE_VIEWS = ['favorites', 'recent', 'shared', 'all', 'trash', 'home'];
const CUSTOM_LABELS_STORAGE_KEY = 'docmatrix_custom_labels';
const DEFAULT_LABELS = ['work', 'important', 'extra work'];

// Modals
import UploadModal from './components/UploadModal';
import FolderModal from './components/FolderModal';
import RenameModal from './components/RenameModal';
import ShareModal from './components/ShareModal';
import MoveModal from './components/MoveModal';
import TagModal from './components/TagModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import FileViewerModal from './components/FileViewerModal';
import EnhancedFileViewer from './components/EnhancedFileViewer';
import FolderColorModal from './components/FolderColorModal';
import ItemPropertiesModal from './components/ItemPropertiesModal';
import ArchiveModal from './components/ArchiveModal';
import DocumentPowerTools from './components/DocumentPowerTools';
import VersionHistoryPanel from './components/VersionHistoryPanel';
import VersionCompareModal from './components/VersionCompareModal';
import StorageManager from './components/StorageManager';
import BackupRestorePanel from './components/BackupRestorePanel';
import DockyChat from './components/DockyChat';
import { extractZipArchive, isCompressed as isCompressedFile } from './utils/compression';
import { exportHtmlAsDocxBlob } from './utils/docxExport';

function AppContent({ user, onSettingsClick, onLogout }) {
  const location = useLocation();
  const { state, actions } = useApp();
  const { items, currentFolder, currentView, viewMode, selectedItems, clipboard, searchQuery, navigationHistory, filterCategory, filterStatus, filterSensitivity, activeStorageScope } = state;
  
  const { toasts, showToast, removeToast } = useToast();
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [showActivityDashboard, setShowActivityDashboard] = useState(false);
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const [showFolderColorModal, setShowFolderColorModal] = useState(false);
  const [showItemPropertiesModal, setShowItemPropertiesModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showPDFTools, setShowPDFTools] = useState(false);
  const [pdfToolsItem, setPdfToolsItem] = useState(null);
  const [pdfToolsSection, setPdfToolsSection] = useState('main');
  const [autoPowerSidebar, setAutoPowerSidebar] = useState(false);
  const [autoPowerSection, setAutoPowerSection] = useState('main');
  
  // Version Control states
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistoryItem, setVersionHistoryItem] = useState(null);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [compareVersions, setCompareVersions] = useState({ v1: null, v2: null });
  
  // Storage Management states
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [showBackupRestore, setShowBackupRestore] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem('docmatrix_sidebar_width'));
    if (Number.isFinite(stored) && stored >= 280 && stored <= 420) return stored;
    return 320;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  
  // Sort state
  const [sortBy, setSortBy] = useState('name');
  const [trashOrderBy, setTrashOrderBy] = useState('recent');
  const [trashFormatFilter, setTrashFormatFilter] = useState('all');
  const [trashLabelFilter, setTrashLabelFilter] = useState('all');
  
  // Tag & file type filter state
  const [filterTag, setFilterTag] = useState(null);
  const [filterFileType, setFilterFileType] = useState('');
  const [customLabels, setCustomLabels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_LABELS_STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved.map(label => String(label || '').trim()).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  });
  
  // Tab management
  const [tabs, setTabs] = useState([
    { id: 'tab-home', view: 'home', folderId: null, label: 'Home' }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-home');
  
  // Split pane state
  const [splitViewEnabled, setSplitViewEnabled] = useState(false);
  const [secondaryPaneView, setSecondaryPaneView] = useState('favorites');
  
  const noop = useCallback(() => {}, []);

  // Reload data whenever authenticated user changes so files rehydrate after re-login.
  useEffect(() => {
    actions.loadData();
    // Intentionally keyed by user identity; actions is context-bound and recreated often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const open = params.get('open');
    if (!open) return;

    if (open === 'trash') {
      actions.navigateTo('trash');
    } else if (open === 'activity') {
      setShowActivityDashboard(true);
    } else if (open === 'backup') {
      setShowBackupRestore(true);
    } else if (open === 'storage') {
      setShowStorageManager(true);
    }

    params.delete('open');
    const nextSearch = params.toString();
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [location.search, location.pathname, location.hash, actions]);

  // Update storage whenever items change
  useEffect(() => {
    actions.updateStorage();
  }, [items]);

  useEffect(() => {
    localStorage.setItem('docmatrix_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_LABELS_STORAGE_KEY, JSON.stringify(customLabels));
  }, [customLabels]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (event) => {
      const nextWidth = Math.min(420, Math.max(280, event.clientX));
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  const getTabLabel = useCallback((view, folderId) => {
    if (view === 'folder' && folderId != null) {
      const folder = items.find(i => i.id === folderId);
      return folder?.name || VIEW_TITLES[view] || 'Folder';
    }
    return VIEW_TITLES[view] || 'Documents';
  }, [items]);

  const getItemsByView = useCallback((view, folderId) => {
    const belongsToScope = (item) => {

      console.log(
        "SCOPE CHECK",
        item.name,
        item.type,
        item.driveId,
        activeStorageScope
      );

      if (!activeStorageScope?.provider) return true;

      if (activeStorageScope.provider === 'mega') {
        return item.storageProvider === 'mega';
      }

      if (activeStorageScope.provider === 'google') {

        // Virtual folders are visible in all drives
        if (item.type === 'folder') {
          return true;
        }

        return (
          (item.storageProvider || 'google') === 'google'
          &&
          (!activeStorageScope.id ||
            item.driveId === activeStorageScope.id)
        );
      }

      return true;
    };

    if (view === 'trash') {
      return items.filter(i => i.trash);
    }
    const list = items.filter(i => !i.trash);
    switch (view) {
      case 'home':
      case 'folder':
      case 'workspace': {

        const folderItems =
            list.filter(i => i.parentId === folderId);

        console.log(
            "ITEMS BEFORE SCOPE FILTER",
            folderItems
        );

        const result =
            folderItems.filter(belongsToScope);

        console.log(
            "ITEMS AFTER SCOPE FILTER",
            result
        );

        return result;
      }
      case 'all':
        return list.filter(i => i.type === 'file');
      case 'recent':
        return list.filter(i => i.type === 'file').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
      case 'favorites':
        return list.filter(i => i.favorite);
      case 'shared':
        return list.filter(i => i.shared?.length > 0);
      default:
        return list.filter(i => i.parentId === folderId);
    }
  }, [items, activeStorageScope]);

  const sortItems = useCallback((list) => {
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.date) - new Date(a.date);
        case 'created':
          return new Date(b.created) - new Date(a.created);
        case 'accessed':
          return new Date(b.lastAccessed || 0) - new Date(a.lastAccessed || 0);
        case 'size':
          return (b.size || 0) - (a.size || 0);
        case 'type':
          return (a.fileType || 'Folder').localeCompare(b.fileType || 'Folder');
        default:
          return 0;
      }
    });
    const folders = sorted.filter(i => i.type === 'folder');
    const files = sorted.filter(i => i.type === 'file');
    return [...folders, ...files];
  }, [sortBy]);

  const viewItems = useMemo(() => getItemsByView(currentView, currentFolder), [getItemsByView, currentView, currentFolder]);

  const filteredItems = useMemo(() => {
    let list = viewItems;
    const includeTrash = currentView === 'trash';
    
    if (searchQuery) {
      list = items.filter(i => (includeTrash ? i.trash : !i.trash) && i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    } else if (filterTag) {
      list = items.filter(i => i.tags?.includes(filterTag) && (includeTrash ? i.trash : !i.trash));
    }

    if (filterCategory) {
      list = list.filter(i => i.category === filterCategory);
    }

    if (filterStatus) {
      list = list.filter(i => i.status === filterStatus);
    }

    if (filterSensitivity) {
      list = list.filter(i => i.sensitivity === filterSensitivity);
    }

    if (filterFileType) {
      const normalized = filterFileType.toLowerCase();
      list = list.filter(i => (i.fileType || 'Folder').toLowerCase() === normalized);
    }

    return list;
  }, [items, viewItems, searchQuery, filterTag, filterCategory, filterStatus, filterSensitivity, filterFileType, currentView]);

  const sortedItems = useMemo(() => sortItems(filteredItems), [filteredItems, sortItems]);

  const trashAvailableFormats = useMemo(() => {
    const formats = new Set();
    items.filter(item => item.trash).forEach((item) => {
      if (item.type === 'folder') {
        formats.add('folder');
        return;
      }
      const ext = (item.name || '').split('.').pop()?.toLowerCase();
      formats.add(ext || 'other');
    });
    return Array.from(formats).sort();
  }, [items]);

  const trashAvailableLabels = useMemo(() => {
    const labels = new Set();
    items.filter(item => item.trash).forEach((item) => {
      (item.tags || []).forEach((tag) => labels.add(String(tag).trim()));
    });
    return Array.from(labels).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const trashManagedItems = useMemo(() => {
    if (currentView !== 'trash') return sortedItems;

    const getDeletedAt = (entry) => {
      const value = entry?.trashedAt || entry?.deletedAt || entry?.updated || entry?.date;
      const timestamp = value ? new Date(value).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const getExt = (entry) => {
      if (entry?.type === 'folder') return 'folder';
      return (entry?.name || '').split('.').pop()?.toLowerCase() || 'other';
    };

    let list = [...sortedItems];

    if (trashFormatFilter !== 'all') {
      list = list.filter((entry) => getExt(entry) === trashFormatFilter);
    }

    if (trashLabelFilter !== 'all') {
      list = list.filter((entry) => (entry.tags || []).some((tag) => String(tag).toLowerCase() === trashLabelFilter.toLowerCase()));
    }

    list.sort((a, b) => {
      if (trashOrderBy === 'recent') return getDeletedAt(b) - getDeletedAt(a);
      if (trashOrderBy === 'oldest') return getDeletedAt(a) - getDeletedAt(b);
      if (trashOrderBy === 'size-desc') return (b.size || 0) - (a.size || 0);
      if (trashOrderBy === 'size-asc') return (a.size || 0) - (b.size || 0);
      if (trashOrderBy === 'type') return getExt(a).localeCompare(getExt(b));
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [currentView, sortedItems, trashOrderBy, trashFormatFilter, trashLabelFilter]);

  const primaryItems = currentView === 'trash' ? trashManagedItems : sortedItems;

  const fileTypes = useMemo(() => {
    const types = new Set();
    items.forEach(item => {
      if (item.type === 'file' && item.fileType) {
        types.add(item.fileType);
      }
      if (item.type === 'folder') {
        types.add('Folder');
      }
    });
    return Array.from(types).sort();
  }, [items]);

  const availableLabels = useMemo(() => {
    const fromItems = items.flatMap(item => Array.isArray(item.tags) ? item.tags : []);
    const seen = new Set();
    return [...DEFAULT_LABELS, ...customLabels, ...fromItems]
      .map(label => String(label || '').trim())
      .filter(Boolean)
      .filter((label) => {
        const key = label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [items, customLabels]);

  const secondaryItems = useMemo(() => getItemsByView(secondaryPaneView, null), [getItemsByView, secondaryPaneView]);
  const secondarySortedItems = useMemo(() => sortItems(secondaryItems), [secondaryItems, sortItems]);

  useEffect(() => {
    setTabs(prev => prev.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const label = getTabLabel(currentView, currentFolder);
      if (tab.view === currentView && tab.folderId === currentFolder && tab.label === label) {
        return tab;
      }
      return { ...tab, view: currentView, folderId: currentFolder, label };
    }));
  }, [activeTabId, currentView, currentFolder, getTabLabel]);

  // Get all folders for modals
  const allFolders = useMemo(() => {
    return items.filter(i => i.type === 'folder' && !i.trash);
  }, [items]);

  // Get breadcrumb path
  const breadcrumb = useMemo(() => {
    const path = [];
    if (currentFolder) {
      let curr = items.find(i => i.id === currentFolder);
      while (curr) {
        path.unshift({ id: curr.id, name: curr.name });
        curr = curr.parentId ? items.find(i => i.id === curr.parentId) : null;
      }
    }
    return path;
  }, [currentFolder, items]);

  // Get selected item for modals
  const selectedItem = useMemo(() => {
    if (selectedItems.length === 1) {
      return items.find(i => String(i.id) === String(selectedItems[0]));
    }
    return null;
  }, [selectedItems, items]);

  const selectedIdSet = useMemo(() => {
    return new Set(selectedItems.map(id => String(id)));
  }, [selectedItems]);

  const selectedEntries = useMemo(() => {
    return selectedItems
      .map(id => items.find(i => String(i.id) === String(id)))
      .filter(Boolean);
  }, [selectedItems, items]);

  const normalizeFormat = useCallback((entry) => {
    if (!entry || entry.type !== 'file') return 'other';
    const name = String(entry.name || '').toLowerCase();
    const mimeType = String(entry.mimeType || entry.mime_type || '').toLowerCase();
    const fileType = String(entry.fileType || entry.file_type || '').toLowerCase();

    if (name.endsWith('.pdf') || mimeType.includes('pdf') || fileType.includes('pdf')) return 'pdf';
    if (name.endsWith('.doc') || name.endsWith('.docx') || mimeType.includes('word') || fileType.includes('word') || fileType.includes('document')) return 'word';
    if (
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.gif') ||
      name.endsWith('.bmp') ||
      name.endsWith('.webp') ||
      mimeType.startsWith('image/') ||
      fileType.includes('image')
    ) return 'image';
    return 'other';
  }, []);

  const selectionCapabilities = useMemo(() => {
    const hasSelection = selectedEntries.length > 0;
    const allFiles = hasSelection && selectedEntries.every(entry => entry.type === 'file');
    const formatSet = new Set(selectedEntries.map(normalizeFormat));
    const singleFormat = allFiles && formatSet.size === 1;
    const format = singleFormat ? Array.from(formatSet)[0] : null;

    const commonActions = {
      canDownload: hasSelection,
      canDelete: hasSelection,
      canMove: hasSelection,
      canBundle: selectedEntries.length > 1,
      canCutCopy: hasSelection,
    };

    return {
      ...commonActions,
      isMixedFormat: formatSet.size > 1,
      allFiles,
      format,
      canMergePDFs: selectedEntries.length > 1 && singleFormat && format === 'pdf',
      canConvertWordsToPDF: selectedEntries.length > 1 && singleFormat && format === 'word',
      canCombineImagesToPDF: selectedEntries.length > 1 && singleFormat && format === 'image',
    };
  }, [selectedEntries, normalizeFormat]);

  // Get context menu item
  const contextMenuItem = useMemo(() => {
    if (contextMenu.itemId) {
      return items.find(i => String(i.id) === String(contextMenu.itemId));
    }
    return null;
  }, [contextMenu.itemId, items]);

  const isContextMultiSelect = useMemo(() => {
    if (!contextMenu.itemId) return false;
    return selectedItems.length > 1 && selectedIdSet.has(String(contextMenu.itemId));
  }, [contextMenu.itemId, selectedItems.length, selectedIdSet]);

  const isCompressedContextItem = useMemo(() => {
    if (!contextMenuItem?.name) return false;
    return isCompressedFile(contextMenuItem.name);
  }, [contextMenuItem]);

  // Event handlers
  const handleItemClick = useCallback((e, id) => {
    const normalizedId = String(id);
    const isAlreadySelected = selectedIdSet.has(normalizedId);

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      actions.toggleSelectItem(id);
      return;
    }

    if (selectedItems.length > 0 && !isAlreadySelected) {
      actions.toggleSelectItem(id);
      return;
    } else {
      actions.selectItem(id);
    }
  }, [actions, selectedIdSet, selectedItems.length]);

  const handleItemDoubleClick = useCallback((id) => {
    const item = items.find(i => i.id === id);
    if (item?.type === 'folder') {
      actions.openFolder(id);
    } else {
      actions.selectItem(id);
      setShowViewerModal(true);
    }
  }, [items, actions]);

  const handleContextMenu = useCallback((e, id) => {
    if (!selectedIdSet.has(String(id))) {
      actions.selectItem(id);
    }
    const item = items.find(i => i.id === id);
    showContextMenu(e, id, item?.trash);
  }, [selectedIdSet, items, actions, showContextMenu]);

  // Handle right-click on empty space to show "New Folder" option
  const handleEmptySpaceContextMenu = useCallback((e) => {
    // Only trigger if clicking directly on the content area, not on items
    if (e.target === e.currentTarget || e.target.closest('[data-content-area]')) {
      e.preventDefault();
      showContextMenu(e, null, false);
    }
  }, [showContextMenu]);

  const handleFavoriteClick = useCallback((id) => {
    actions.toggleFavorite(id);
    const item = items.find(i => i.id === id);
    showToast(item?.favorite ? 'Removed from favorites' : 'Added to favorites');
  }, [actions, items, showToast]);

  const handleCheckboxChange = useCallback((id) => {
    actions.toggleSelectItem(id);
  }, [actions]);

  // Modal handlers
  const handleUpload = useCallback(async (files, parentId) => {
    for (const file of files) {
      await actions.uploadFile(file, parentId);
    }
    showToast(`${files.length} file(s) uploaded!`);
  }, [actions, showToast]);

  const handleCreateFolder = useCallback(async (name, parentId) => {
    try {
      const created = await actions.createFolder(name, parentId);
      if (created) {
        showToast(`Folder "${created.name || name}" created`);
        return created;
      }
      showToast('Could not create folder. Please try again.', 'error');
      return null;
    } catch (error) {
      showToast(error?.message || 'Could not create folder. Please try again.', 'error');
      throw error;
    }
  }, [actions, showToast]);

  const handleRename = useCallback((id, newName) => {
    actions.renameItem(id, newName);
    showToast(`Renamed to "${newName}"`);
  }, [actions, showToast]);

  const handleMove = useCallback((ids, targetFolderId) => {
    ids.forEach(id => actions.moveItem(id, targetFolderId));
    showToast('Moved successfully');
    actions.clearSelection();
  }, [actions, showToast]);

  const handleMergeSelectedPDFs = useCallback(async () => {
    const selectedPdfIds = selectedEntries
      .filter(entry => normalizeFormat(entry) === 'pdf')
      .map(entry => entry.id);

    if (selectedPdfIds.length < 2) {
      showToast('Select at least 2 PDF files to merge', 'warning');
      return;
    }

    try {
      const outputName = `Merged_${new Date().toISOString().slice(0, 10)}.pdf`;
      const merged = await actions.mergePDFs(selectedPdfIds, outputName);
      if (merged?.id) {
        actions.clearSelection();
        actions.selectItem(merged.id);
      }
      showToast('Merged selected PDFs successfully', 'success');
    } catch (error) {
      showToast(error?.message || 'Failed to merge selected PDFs', 'error');
    }
  }, [selectedEntries, normalizeFormat, actions, showToast]);

  const handleConvertSelectedWordsToPDF = useCallback(async () => {
    const selectedWordIds = selectedEntries
      .filter(entry => normalizeFormat(entry) === 'word')
      .map(entry => entry.id);

    if (selectedWordIds.length < 2) {
      showToast('Select at least 2 Word files to convert', 'warning');
      return;
    }

    let successCount = 0;
    for (const id of selectedWordIds) {
      try {
        await actions.docToPDF(id);
        successCount += 1;
      } catch (error) {
        console.error('Word to PDF conversion failed for item:', id, error);
      }
    }

    if (successCount === 0) {
      showToast('Word to PDF conversion failed', 'error');
      return;
    }

    showToast(`Converted ${successCount} Word file(s) to PDF`, 'success');
  }, [selectedEntries, normalizeFormat, actions, showToast]);

  const handleCombineSelectedImagesToPDF = useCallback(async () => {
    const selectedImageIds = selectedEntries
      .filter(entry => normalizeFormat(entry) === 'image')
      .map(entry => entry.id);

    if (selectedImageIds.length < 2) {
      showToast('Select at least 2 image files', 'warning');
      return;
    }

    try {
      const outputName = `Images_${new Date().toISOString().slice(0, 10)}.pdf`;
      const createdPdf = await actions.imagesToPDF(selectedImageIds, outputName);
      if (createdPdf?.id) {
        actions.clearSelection();
        actions.selectItem(createdPdf.id);
      }
      showToast('Combined selected images to PDF', 'success');
    } catch (error) {
      showToast(error?.message || 'Failed to combine images to PDF', 'error');
    }
  }, [selectedEntries, normalizeFormat, actions, showToast]);

  const handleBundleUp = useCallback(async () => {
    if (selectedItems.length < 2) return;

    const suggested = `Bundle ${new Date().toISOString().slice(0, 10)}`;
    const folderName = window.prompt('Enter new folder name for selected files:', suggested);
    if (!folderName || !folderName.trim()) return;

    try {
      const createdFolder = await actions.createFolder(folderName.trim(), currentFolder);
      if (!createdFolder?.id) {
        showToast('Failed to create bundle folder', 'error');
        return;
      }

      for (const id of selectedItems) {
        await actions.moveItem(id, createdFolder.id);
      }

      actions.clearSelection();
      actions.selectItem(createdFolder.id);
      showToast(`Bundled ${selectedItems.length} items into "${createdFolder.name}"`, 'success');
    } catch (error) {
      showToast(error?.message || 'Bundle operation failed', 'error');
    }
  }, [selectedItems, actions, currentFolder, showToast]);

  const handleAddShare = useCallback((id, email) => {
    actions.addShare(id, email);
    showToast(`Shared with ${email}`);
  }, [actions, showToast]);

  const handleRemoveShare = useCallback((id, email) => {
    actions.removeShare(id, email);
    showToast(`Removed ${email}`);
  }, [actions, showToast]);

  const handleAddTag = useCallback((id, tag) => {
    const normalized = String(tag || '').trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    actions.addTag(id, normalized);
    showToast(`Added tag: ${normalized}`);
  }, [actions, showToast]);

  const handleCreateCustomLabel = useCallback((label) => {
    const normalized = String(label || '').trim().replace(/\s+/g, ' ');
    if (!normalized) return false;

    const duplicate = availableLabels.some(entry => entry.toLowerCase() === normalized.toLowerCase());
    if (duplicate) {
      showToast('Label already exists', 'warning');
      return false;
    }

    setCustomLabels(prev => [...prev, normalized]);
    showToast(`Custom label created: ${normalized}`, 'success');
    return true;
  }, [availableLabels, showToast]);

  const handleSaveContent = useCallback((id, content) => {
    actions.updateContent(id, content);
    showToast('File saved successfully!');
  }, [actions, showToast]);

  const handleDownload = useCallback(async () => {
    for (const id of selectedItems) {
      const item = items.find(i => i.id === id);
      if (item && item.type === 'file') {
        let downloadUrl;
        let blob;
        
        // Handle cloud file download
        if (item.isCloud && item.id) {
          try {
            const { documentOpsApi } = await import('./utils/documentApi');
            blob = await documentOpsApi.downloadDocument(item.id);
            downloadUrl = URL.createObjectURL(blob);
          } catch (error) {
            console.error('Cloud download failed:', error);
            showToast('Download failed: ' + (error.message || 'Unknown error'), 'error');
            continue;
          }
        } else if (item.dataUrl) {
          downloadUrl = item.dataUrl;
        } else if (item.content && typeof item.content === 'string') {
          blob = new Blob([item.content], { type: item.mimeType || 'text/plain' });
          downloadUrl = URL.createObjectURL(blob);
        } else {
          const placeholderContent = `File: ${item.name}\nType: ${item.fileType}\nSize: ${item.size} bytes`;
          blob = new Blob([placeholderContent], { type: 'text/plain' });
          downloadUrl = URL.createObjectURL(blob);
        }
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (blob) {
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
        }
        
        actions.addHistory(id, 'Downloaded');
      }
    }
    showToast('Download started');
  }, [selectedItems, items, actions, showToast]);

  const handleOpenWithGoogleDocs = useCallback(() => {

    if (selectedItems.length !== 1) return;

    const item = items.find(
        i => String(i.id) === String(selectedItems[0])
    );

    if (!item) return;

    if (!item.driveFileId) {
        showToast("This file is not stored in Google Drive.", "warning");
        return;
    }

    const name = (item.name || "").toLowerCase();

    let url = "";

    if (
        name.endsWith(".doc") ||
        name.endsWith(".docx")
    ) {

        url = `https://docs.google.com/document/d/${item.driveFileId}/edit`;

    } else if (
        name.endsWith(".xls") ||
        name.endsWith(".xlsx")
    ) {

        url = `https://docs.google.com/spreadsheets/d/${item.driveFileId}/edit`;

    } else if (
        name.endsWith(".ppt") ||
        name.endsWith(".pptx")
    ) {

        url = `https://docs.google.com/presentation/d/${item.driveFileId}/edit`;

    } else {

        showToast(
            "Google Docs editing is not available for this file.",
            "warning"
        );

        return;
    }

    window.open(url, "_blank");

}, [selectedItems, items, showToast]);

  // Cut/Copy/Paste handlers
  const handleCut = useCallback(() => {
    if (selectedItems.length === 0) return;
    actions.cutItems();
    showToast(`${selectedItems.length} item(s) cut`);
  }, [selectedItems, actions, showToast]);

  const handleCopy = useCallback(() => {
    if (selectedItems.length === 0) return;
    actions.copyItems();
    showToast(`${selectedItems.length} item(s) copied`);
  }, [selectedItems, actions, showToast]);

  const handlePaste = useCallback(() => {
    if (clipboard.items.length === 0) return;
    actions.pasteItems();
    showToast('Pasted successfully');
  }, [clipboard.items.length, actions, showToast]);

  // Delete handlers
  const handleMoveToTrash = useCallback(() => {
    if (selectedItems.length === 0) return;
    actions.moveToTrash(selectedItems);
    showToast('Moved to trash');
  }, [selectedItems, actions, showToast]);

  const handleRestore = useCallback(() => {
    if (selectedItems.length === 0) return;
    actions.restoreFromTrash(selectedItems);
    showToast('Restored from trash');
  }, [selectedItems, actions, showToast]);

  const handlePermanentDelete = useCallback(() => {
    actions.permanentlyDelete(selectedItems);
    showToast('Permanently deleted', 'warning');
  }, [selectedItems, actions, showToast]);

  const handleRestoreAllTrash = useCallback(() => {
    actions.restoreAllTrash();
    showToast('All items restored');
  }, [actions, showToast]);

  const handleEmptyTrash = useCallback(() => {
    actions.emptyTrash();
    showToast('Trash emptied', 'warning');
  }, [actions, showToast]);

  // Duplicate handler
  const handleDuplicate = useCallback(() => {
    if (selectedItems.length !== 1) return;
    const copy = actions.duplicateItem(selectedItems[0]);
    if (copy) {
      showToast(`Copied: ${copy.name}`);
    }
  }, [selectedItems, actions, showToast]);

  // Open file handler
  const handleOpenFile = useCallback(() => {
    if (selectedItems.length !== 1) return;
    const item = items.find(i => String(i.id) === String(selectedItems[0]));
    if (item?.type === 'folder') {
      actions.openFolder(item.id);
    } else {
      setShowViewerModal(true);
      actions.addHistory(item.id, 'Viewed');
    }
  }, [selectedItems, items, actions]);

  const handleSidebarOpenItem = useCallback((item) => {
    if (!item) return;
    actions.selectItem(item.id);
    if (item.type === 'folder') {
      actions.openFolder(item.id);
      return;
    }
    setShowViewerModal(true);
    actions.addHistory(item.id, 'Viewed');
  }, [actions]);

  // Filter by tag handler
  const handleFilterByTag = useCallback((tag) => {
    setFilterTag(tag);
    actions.navigateTo('home');
  }, [actions]);

  // Clear tag filter when navigating
  useEffect(() => {
    if (currentView !== 'home' || currentFolder !== null) {
      setFilterTag(null);
    }
  }, [currentView, currentFolder]);

  const handleAddTab = useCallback(() => {
    const viewForTab = currentView === 'folder' ? 'folder' : currentView;
    const folderForTab = viewForTab === 'folder' ? currentFolder : null;
    const newTab = {
      id: `tab-${Date.now()}`,
      view: viewForTab,
      folderId: folderForTab,
      label: getTabLabel(viewForTab, folderForTab)
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [currentView, currentFolder, getTabLabel]);

  const handleSelectTab = useCallback((tabId, sourceTabs) => {
    const tabList = sourceTabs || tabs;
    const tab = tabList.find(t => t.id === tabId);
    if (!tab) return;
    setActiveTabId(tabId);
    if (tab.view === 'folder') {
      if (tab.folderId == null) {
        actions.goToRoot();
      } else {
        actions.openFolder(tab.folderId);
      }
    } else {
      actions.navigateTo(tab.view);
    }
  }, [tabs, actions]);

  const handleCloseTab = useCallback((tabId) => {
    const remaining = tabs.filter(tab => tab.id !== tabId);
    if (remaining.length === tabs.length) return;
    setTabs(remaining);
    if (tabId === activeTabId && remaining.length > 0) {
      handleSelectTab(remaining[remaining.length - 1].id, remaining);
    }
  }, [tabs, activeTabId, handleSelectTab]);

  const handleOpenWindow = useCallback(() => {
    window.open(window.location.href, '_blank');
  }, []);

  const handleToggleSplitView = useCallback(() => {
    setSplitViewEnabled(prev => !prev);
  }, []);

  // Print handler
  const handlePrint = useCallback(() => {
    window.print();
    showToast('Print dialog opened');
  }, [showToast]);

  // Pin handler
  const handleTogglePin = useCallback(() => {
    if (selectedItems.length !== 1) return;
    actions.togglePin(selectedItems[0]);
    const item = items.find(i => i.id === selectedItems[0]);
    showToast(item?.pinned ? 'Unpinned from Quick Access' : 'Pinned to Quick Access');
  }, [selectedItems, actions, items, showToast]);

  // Folder color handler
  const handleFolderColor = useCallback((id, { color, icon }) => {
    actions.updateFolderAppearance(id, { color, icon });
    showToast('Folder appearance updated');
  }, [actions, showToast]);

  // Item properties handler
  const handleItemProperties = useCallback((id, props) => {
    actions.updateItemProperties(id, props);
    showToast('Properties updated');
  }, [actions, showToast]);

  // Archive handler
  const handleCreateArchive = useCallback((archiveData) => {
    const archive = actions.createArchive(selectedItems, archiveData.name);
    if (archive) {
      showToast(`Created archive: ${archive.name}`);
    }
  }, [selectedItems, actions, showToast]);

  // Secure delete handler
  const handleSecureDelete = useCallback(() => {
    actions.secureDelete(selectedItems);
    showToast('Securely deleted', 'warning');
  }, [selectedItems, actions, showToast]);

  const handleExtractArchive = useCallback(async () => {
    if (!contextMenuItem) return;

    if (contextMenuItem.isArchive && contextMenuItem.archiveContents) {
      const folder = actions.extractArchive(contextMenuItem.id);
      if (folder) {
        showToast(`Extracted archive to ${folder.name}`);
      }
      return;
    }

    const isZipFile = /\.zip$/i.test(contextMenuItem.name || '') || (contextMenuItem.mimeType || '').includes('zip');
    if (!isZipFile) {
      showToast('Only ZIP archives can be extracted.', 'error');
      return;
    }

    try {
      let zipArrayBuffer;

      if (contextMenuItem.isCloud && contextMenuItem.id) {
        const { documentOpsApi } = await import('./utils/documentApi');
        const zipBlob = await documentOpsApi.downloadDocument(contextMenuItem.id);
        zipArrayBuffer = await zipBlob.arrayBuffer();
      } else if (contextMenuItem.dataUrl) {
        const response = await fetch(contextMenuItem.dataUrl);
        zipArrayBuffer = await response.arrayBuffer();
      } else {
        throw new Error('Zip content not available for extraction.');
      }

      const extracted = await extractZipArchive(zipArrayBuffer);
      if (!extracted?.success) {
        throw new Error(extracted?.error || 'Failed to extract zip archive.');
      }

      const files = extracted.files || [];
      if (!files.length) {
        throw new Error('Archive does not contain extractable files.');
      }

      const targetFolderName = `${(contextMenuItem.name || 'archive').replace(/\.zip$/i, '')}_extracted`;
      const targetFolder = await actions.createFolder(targetFolderName, contextMenuItem.parentId ?? currentFolder);
      const targetFolderId = targetFolder?.id ?? contextMenuItem.parentId ?? currentFolder;

      const maxFiles = 200;
      const toUpload = files.slice(0, maxFiles);

      for (const entry of toUpload) {
        const blob = new Blob([entry.data], { type: 'application/octet-stream' });
        const file = new File([blob], entry.name || `extracted_${Date.now()}`, { type: 'application/octet-stream' });
        await actions.uploadFile(file, targetFolderId);
      }

      if (files.length > maxFiles) {
        showToast(`Extracted ${maxFiles} files (archive has more; apply extraction in smaller batches).`, 'warning');
      } else {
        showToast(`Extracted ${toUpload.length} file(s) to ${targetFolderName}`);
      }
    } catch (error) {
      showToast(error?.message || 'Extract archive failed', 'error');
    }
  }, [actions, contextMenuItem, currentFolder, showToast]);

  // Upload folder handler
  const handleUploadFolder = useCallback(async (files, parentId) => {
    await actions.uploadFolder(files, parentId);
    showToast('Folder uploaded successfully!');
  }, [actions, showToast]);

  // Spacebar quick preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept space when user is typing in input/textarea/contentEditable
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      
      if (e.code === 'Space' && selectedItems.length === 1 && !showViewerModal) {
        e.preventDefault();
        setShowViewerModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, showViewerModal]);

  const handleContentAreaMouseDown = useCallback((event) => {
    if (selectedItems.length === 0) return;
    if (event.button !== 0) return;

    const clickedInsideSelectableItem = event.target.closest('[data-selectable-item="true"]');
    const clickedInsideContextMenu = event.target.closest('.dropdown-menu');

    if (!clickedInsideSelectableItem && !clickedInsideContextMenu) {
      actions.clearSelection();
      hideContextMenu();
    }
  }, [selectedItems.length, actions, hideContextMenu]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCut: handleCut,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: currentView === 'trash' ? () => setShowDeleteModal(true) : handleMoveToTrash,
    onRename: () => selectedItems.length === 1 && setShowRenameModal(true),
    onOpen: handleOpenFile,
    onEscape: () => {
      actions.clearSelection();
      setShowUploadModal(false);
      setShowFolderModal(false);
      setShowRenameModal(false);
      setShowShareModal(false);
      setShowMoveModal(false);
      setShowTagModal(false);
      setShowDeleteModal(false);
      setShowViewerModal(false);
      setShowActivityDashboard(false);
      setShowFolderColorModal(false);
      setShowItemPropertiesModal(false);
      setShowArchiveModal(false);
    },
    selectedItems
  });

  // Get section title
  const sectionTitle = filterTag 
    ? `Tagged: ${filterTag}` 
    : currentView === 'trash'
      ? `Trash (${primaryItems.length} items)`
      : VIEW_TITLES[currentView] || 'Documents';

  // Get empty state type
  const getEmptyStateType = () => {
    if (searchQuery) return 'search';
    if (filterTag) return 'tag';
    switch (currentView) {
      case 'trash': return 'trash';
      case 'favorites': return 'favorites';
      case 'shared': return 'shared';
      default: return 'default';
    }
  };

  const primaryDocumentContent = primaryItems.length > 0 ? (
    <DocumentGrid
      items={primaryItems}
      viewMode={viewMode}
      selectedItems={selectedItems}
      clipboardItems={clipboard.items}
      clipboardOperation={clipboard.operation}
      onItemClick={handleItemClick}
      onItemDoubleClick={handleItemDoubleClick}
      onContextMenu={handleContextMenu}
      onCheckboxChange={handleCheckboxChange}
      onFavoriteClick={handleFavoriteClick}
      onMenuClick={handleContextMenu}
    />
  ) : (
    <EmptyState
      type={getEmptyStateType()}
      onUploadClick={() => setShowUploadModal(true)}
    />
  );

  const getPowerToolsTarget = () => {
    const selectedIds = Array.isArray(selectedItems)
      ? selectedItems
      : Array.from(selectedItems || []);

    const selectedList = selectedIds
      .map(id => items.find(i => i.id === id))
      .filter(Boolean);

    if (selectedItem && selectedItem.type !== 'folder') {
      return selectedItem;
    }

    const candidates = selectedList.length > 0
      ? selectedList.filter(file => file?.type !== 'folder')
      : [];

    if (candidates.length === 0) return null;

    return candidates[0] || null;
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar 
        onFilterByTag={handleFilterByTag} 
        onActivityClick={() => setShowActivityDashboard(true)}
        onOpenItem={handleSidebarOpenItem}
        width={sidebarWidth}
      />

      <div
        className="fixed top-0 h-screen w-1.5 cursor-col-resize z-[60]"
        style={{ left: `${sidebarWidth - 1}px` }}
        onMouseDown={() => setIsResizingSidebar(true)}
        aria-label="Resize sidebar"
        role="separator"
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: `${sidebarWidth}px` }}>
        {/* Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={(q) => actions.setSearchQuery(q)}
          onUploadClick={() => setShowUploadModal(true)}
          onNewFolderClick={() => setShowFolderModal(true)}
          onPropertiesToggle={() => setShowPropertiesPanel(!showPropertiesPanel)}
          onRefresh={() => showToast('Refreshed')}
          onConvertClick={() => {
            if (selectedItems.length !== 1) {
              showToast('Select exactly one file to use Convert', 'warning');
              return;
            }

            const target = getPowerToolsTarget();
            if (target) {
              setPdfToolsItem(target);
              setPdfToolsSection('export');
              setShowPDFTools(true);
              return;
            }
            showToast('Please select a file first, then click Convert', 'warning');
          }}
          onDownloadAsideClick={handleDownload}
          onDeleteClick={() => {
            if (selectedItems.length === 0) {
              showToast('Please select at least one item to delete', 'warning');
              return;
            }
            if (currentView === 'trash') {
              setShowDeleteModal(true);
              return;
            }
            handleMoveToTrash();
          }}
          onStorageManagerClick={() => setShowStorageManager(true)}
          onBackupRestoreClick={() => setShowBackupRestore(true)}
          onSettingsClick={onSettingsClick}
          onLogout={onLogout}
          user={user}
          toolbarProps={{
            breadcrumb,
            sortBy,
            onSortChange: setSortBy,
            viewMode,
            onViewModeChange: actions.setViewMode,
            onGoToRoot: actions.goToRoot,
            onOpenFolder: actions.openFolder,
            canGoBack: navigationHistory.back.length > 0,
            canGoForward: navigationHistory.forward.length > 0,
            onGoBack: actions.goBack,
            onGoForward: actions.goForward,
            onGoToPath: actions.goToPath,
            filterCategory,
            filterStatus,
            filterSensitivity,
            onFilterCategoryChange: actions.setFilterCategory,
            onFilterStatusChange: actions.setFilterStatus,
            onFilterSensitivityChange: actions.setFilterSensitivity,
            filterFileType,
            onFilterFileTypeChange: setFilterFileType,
            fileTypes,
            splitViewEnabled,
            onToggleSplitView: handleToggleSplitView,
            onOpenNewWindow: handleOpenWindow,
            onClearFilters: actions.clearFilters,
          }}
          onPDFToolsClick={() => {
            const target = getPowerToolsTarget();
            if (target) {
              const name = (target.name || '').toLowerCase();
              const isDoc = /\.(docx?|odt)$/i.test(name);
              const section = isDoc ? 'wordFeatures' : 'main';
              actions.selectItem(target.id);
              setAutoPowerSection(section);
              setAutoPowerSidebar(true);
              setShowViewerModal(true);
              return;
            }
            showToast('Please select a file first, then click Power Tools', 'warning');
          }}
        />

        {/* Clipboard Bar */}
        <ClipboardBar
          clipboard={clipboard}
          onPaste={handlePaste}
          onClear={() => {
            actions.clearClipboard();
            showToast('Clipboard cleared');
          }}
        />

        {/* Content Area */}
        <div className="flex-1 p-6 flex gap-6">
          <div className="flex-1 flex flex-col gap-4">
            {/* Trash Actions */}
            {currentView === 'trash' && (
              <div className="mb-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="text-sm font-medium text-gray-800">Trash Manager</div>
                  <div className="text-xs text-gray-500">Items: {primaryItems.length}</div>
                  <select
                    value={trashOrderBy}
                    onChange={(e) => setTrashOrderBy(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs bg-white"
                  >
                    <option value="recent">Recently Deleted</option>
                    <option value="oldest">Oldest Deleted</option>
                    <option value="name">Name A-Z</option>
                    <option value="size-desc">Size High-Low</option>
                    <option value="size-asc">Size Low-High</option>
                    <option value="type">File Type</option>
                  </select>
                  <select
                    value={trashFormatFilter}
                    onChange={(e) => setTrashFormatFilter(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs bg-white"
                  >
                    <option value="all">All Formats</option>
                    {trashAvailableFormats.map((format) => (
                      <option key={format} value={format}>{format.toUpperCase()}</option>
                    ))}
                  </select>
                  <select
                    value={trashLabelFilter}
                    onChange={(e) => setTrashLabelFilter(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs bg-white"
                  >
                    <option value="all">All Labels</option>
                    {trashAvailableLabels.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                <button
                  onClick={handleRestoreAllTrash}
                  className="px-4 py-2.5 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600"
                >
                  Restore All
                </button>
                <button
                  onClick={handleEmptyTrash}
                  className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700"
                >
                  Empty Trash
                </button>
                </div>
              </div>
            )}

            {/* Section Title */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {sectionTitle}
            </h2>

            {splitViewEnabled ? (
              <div className="flex gap-6">
                <div 
                  className="flex-1"
                  data-content-area="true"
                  onMouseDown={handleContentAreaMouseDown}
                  onContextMenu={(e) => {
                    if (e.target === e.currentTarget) {
                      e.preventDefault();
                      showContextMenu(e, null, false);
                    }
                  }}
                >
                  {primaryDocumentContent}
                </div>
                <div className="w-1/2 min-w-[320px] bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase text-gray-500">Split Pane</p>
                      <p className="font-semibold text-sm">{VIEW_TITLES[secondaryPaneView] || 'Split View'}</p>
                    </div>
                    <select
                      value={secondaryPaneView}
                      onChange={(e) => setSecondaryPaneView(e.target.value)}
                      className="px-2 py-1 border border-gray-200 rounded text-xs"
                    >
                      {SPLIT_PANE_VIEWS.map(view => (
                        <option key={view} value={view}>
                          {VIEW_TITLES[view] || view}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-h-0 p-4 overflow-y-auto">
                    {secondarySortedItems.length === 0 ? (
                      <p className="text-sm text-gray-500">No items in this pane.</p>
                    ) : (
                      <DocumentGrid
                        items={secondarySortedItems}
                        viewMode={viewMode}
                        selectedItems={[]}
                        clipboardItems={[]}
                        clipboardOperation={null}
                        onItemClick={noop}
                        onItemDoubleClick={noop}
                        onContextMenu={noop}
                        onCheckboxChange={noop}
                        onFavoriteClick={noop}
                        onMenuClick={noop}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div 
                className="flex-1"
                data-content-area="true"
                onMouseDown={handleContentAreaMouseDown}
                onContextMenu={(e) => {
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                    showContextMenu(e, null, false);
                  }
                }}
              >
                {primaryDocumentContent}
              </div>
            )}
          </div>

          {/* Properties Panel */}
          <PropertiesPanel
            item={selectedItem}
            items={items}
            isOpen={showPropertiesPanel}
            onClose={() => setShowPropertiesPanel(false)}
            onOpen={handleOpenFile}
            onDownload={handleDownload}
            onShare={() => selectedItem && setShowShareModal(true)}
            onRename={() => selectedItem && setShowRenameModal(true)}
          />
        </div>
      </main>

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        isMultiSelect={isContextMultiSelect}
        selectedCount={selectedItems.length}
        inTrash={contextMenu.inTrash}
        hasClipboard={clipboard.items.length > 0}
        isFavorite={contextMenuItem?.favorite}
        isPinned={contextMenuItem?.pinned}
        isFolder={contextMenuItem?.type === 'folder'}
        isArchive={contextMenuItem?.isArchive}
        isCompressed={isCompressedContextItem}
        isEmptySpace={!contextMenu.itemId}
        canMergePDFs={selectionCapabilities.canMergePDFs}
        canConvertWordsToPDF={selectionCapabilities.canConvertWordsToPDF}
        canCombineImagesToPDF={selectionCapabilities.canCombineImagesToPDF}
        onOpen={handleOpenFile}
        onOpenWithGoogleDocs={handleOpenWithGoogleDocs}
        onDownload={handleDownload}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onRename={() => setShowRenameModal(true)}
        onDuplicate={handleDuplicate}
        onMove={() => setShowMoveModal(true)}
        onToggleFavorite={() => selectedItems.length > 0 && handleFavoriteClick(selectedItems[0])}
        onTogglePin={handleTogglePin}
        onShare={() => setShowShareModal(true)}
        onAddTag={() => setShowTagModal(true)}
        onFolderColor={() => setShowFolderColorModal(true)}
        onArchive={() => setShowArchiveModal(true)}
        onBundleUp={handleBundleUp}
        onExtract={handleExtractArchive}
        onProperties={() => setShowItemPropertiesModal(true)}
        onSecureDelete={handleSecureDelete}
        onMoveToTrash={handleMoveToTrash}
        onRestore={handleRestore}
        onPermanentDelete={() => setShowDeleteModal(true)}
        onNewFolder={() => { hideContextMenu(); setShowFolderModal(true); }}
        onUpload={() => { hideContextMenu(); setShowUploadModal(true); }}
        onPDFTools={() => {
          if (contextMenuItem) {
            const name = (contextMenuItem.name || '').toLowerCase();
            const isDoc = /\.(docx?|odt)$/i.test(name);
            const section = isDoc ? 'wordFeatures' : 'main';
            actions.selectItem(contextMenuItem.id);
            setAutoPowerSection(section);
            setAutoPowerSidebar(true);
            setShowViewerModal(true);
            hideContextMenu();
          }
        }}
        onMergePDFs={handleMergeSelectedPDFs}
        onConvertWordsToPDF={handleConvertSelectedWordsToPDF}
        onCombineImagesToPDF={handleCombineSelectedImagesToPDF}
      />

      {/* Selection Bar */}
      <SelectionBar
        count={selectedItems.length}
        onCut={handleCut}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onBundle={handleBundleUp}
        onDelete={handleMoveToTrash}
        onClear={actions.clearSelection}
        canMergePDFs={selectionCapabilities.canMergePDFs}
        canConvertWordsToPDF={selectionCapabilities.canConvertWordsToPDF}
        canCombineImagesToPDF={selectionCapabilities.canCombineImagesToPDF}
        onMergePDFs={handleMergeSelectedPDFs}
        onConvertWordsToPDF={handleConvertSelectedWordsToPDF}
        onCombineImagesToPDF={handleCombineSelectedImagesToPDF}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Modals */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        folders={allFolders}
        currentFolder={currentFolder}
        onUpload={handleUpload}
        onUploadFolder={handleUploadFolder}
      />

      <FolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        folders={allFolders}
        currentFolder={currentFolder}
        onCreate={handleCreateFolder}
      />

      <RenameModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        item={selectedItem}
        onRename={handleRename}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        item={selectedItem}
        onAddShare={handleAddShare}
        onRemoveShare={handleRemoveShare}
      />

      <MoveModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        folders={allFolders}
        selectedItems={selectedItems}
        onMove={handleMove}
      />

      <TagModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        item={selectedItem}
        onAddTag={handleAddTag}
        availableTags={availableLabels}
        onCreateTag={handleCreateCustomLabel}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        itemName={selectedItem?.name}
        count={selectedItems.length}
        onConfirm={handlePermanentDelete}
      />

      <EnhancedFileViewer
        isOpen={showViewerModal}
        onClose={() => {
          setShowViewerModal(false);
          setAutoPowerSidebar(false);
        }}
        item={selectedItem}
        onSave={handleSaveContent}
        onSaveAsCopy={async (item, content, newName, options = {}) => {
          const parentId = item?.parentId ?? null;
          const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

          try {
            if (options?.isDocxEdit) {
              const baseName = (newName || item?.name || 'Edited Document').replace(/\.[^.]+$/, '');
              const outputName = `${baseName}.docx`;
              const blob = await exportHtmlAsDocxBlob(typeof content === 'string' ? content : '');
              const file = new File([blob], outputName, { type: docxMimeType });
              await actions.uploadFile(file, parentId);
              showToast(`Created edited file: ${outputName}`, 'success');
              return;
            }

            const mimeType = options?.mimeType || item?.mimeType || 'application/octet-stream';
            const blob = content instanceof Blob
              ? content
              : new Blob([typeof content === 'string' ? content : JSON.stringify(content ?? '')], { type: mimeType });
            const file = new File([blob], newName, { type: blob.type || mimeType });
            await actions.uploadFile(file, parentId);
            showToast(`Created copy: ${newName}`, 'success');
          } catch (error) {
            showToast(error?.message || 'Failed to create edited file', 'error');
            throw error;
          }
        }}
        onSaveAsNewVersion={(item, version) => {
          showToast(`Version "${version.label}" saved successfully`, 'success');
        }}
        onDownload={handleDownload}
        onShare={() => setShowShareModal(true)}
        onDelete={handleMoveToTrash}
        onPrint={handlePrint}
        autoShowPowerSidebar={autoPowerSidebar}
        autoPowerSection={autoPowerSection}
        onPowerSidebarConsumed={() => setAutoPowerSidebar(false)}
        onShowVersionHistory={(fileItem) => {
          setVersionHistoryItem(fileItem);
          setShowVersionHistory(true);
        }}
      />

      {/* Activity Dashboard Modal */}
      <ActivityDashboard
        isOpen={showActivityDashboard}
        onClose={() => setShowActivityDashboard(false)}
        items={state.items}
        history={state.history}
      />

      {/* Analytics Dashboard Modal */}
      <AnalyticsDashboard
        isOpen={showAnalyticsDashboard}
        onClose={() => setShowAnalyticsDashboard(false)}
      />

      {/* Folder Color Modal */}
      <FolderColorModal
        isOpen={showFolderColorModal}
        onClose={() => setShowFolderColorModal(false)}
        folder={selectedItem}
        onSave={handleFolderColor}
      />

      {/* Item Properties Modal */}
      <ItemPropertiesModal
        isOpen={showItemPropertiesModal}
        onClose={() => setShowItemPropertiesModal(false)}
        item={selectedItem}
        onSave={handleItemProperties}
      />

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        items={selectedItem ? [selectedItem] : selectedItems.map(id => state.items.find(i => i.id === id)).filter(Boolean)}
        onArchive={handleCreateArchive}
      />

      {/* DOCUMENT POWER TOOLS MODAL - FILE-TYPE SPECIFIC */}
      {showPDFTools && pdfToolsItem && (
        <DocumentPowerTools
          item={pdfToolsItem}
          initialSection={pdfToolsSection}
          onClose={() => {
            setShowPDFTools(false);
            setPdfToolsItem(null);
            setPdfToolsSection('main');
          }}
        />
      )}

      {/* VERSION HISTORY PANEL */}
      {showVersionHistory && versionHistoryItem && (
        <VersionHistoryPanel
          fileId={versionHistoryItem.id}
          fileName={versionHistoryItem.name}
          isOpen={showVersionHistory}
          onClose={() => {
            setShowVersionHistory(false);
            setVersionHistoryItem(null);
          }}
          onRestoreVersion={(content, newVersion) => {
            // Update the item content with restored version
            if (versionHistoryItem) {
              handleSaveContent(versionHistoryItem.id, content);
              showToast(`Restored to version: ${newVersion.label}`, 'success');
            }
          }}
          onCompareVersions={(v1, v2) => {
            setCompareVersions({ v1, v2 });
            setShowVersionCompare(true);
          }}
        />
      )}

      {/* VERSION COMPARE MODAL */}
      {showVersionCompare && versionHistoryItem && (
        <VersionCompareModal
          fileId={versionHistoryItem.id}
          versionId1={compareVersions.v1}
          versionId2={compareVersions.v2}
          isOpen={showVersionCompare}
          onClose={() => {
            setShowVersionCompare(false);
            setCompareVersions({ v1: null, v2: null });
          }}
        />
      )}

      {/* STORAGE MANAGER */}
      <StorageManager
        isOpen={showStorageManager}
        onClose={() => setShowStorageManager(false)}
        onRefresh={() => actions.loadData()}
      />

      {/* BACKUP RESTORE PANEL */}
      <BackupRestorePanel
        isOpen={showBackupRestore}
        onClose={() => setShowBackupRestore(false)}
        items={items.filter(i => !i.trash)}
        onRefresh={() => actions.loadData()}
      />

      {/* DOCKY AI ASSISTANT - disabled on admin routes */}
      {!location.pathname.startsWith('/admin') && (
        <DockyChat 
          onOpenFile={(fileId) => {
            const item = items.find(i => i.id === fileId);
            if (item) {
              if (item.type === 'folder') {
                actions.openFolder(item.id);
              } else {
                actions.selectItem(fileId);
                setShowViewerModal(true);
                actions.addHistory(item.id, 'Viewed');
              }
            }
          }}
          onShowAnalytics={() => setShowAnalyticsDashboard(true)}
          onNotify={(message, type = 'success') => showToast(message, type)}
        />
      )}
    </div>
  );
}

export default function App({ user, onSettingsClick, onLogout }) {
  return (
    <AppProvider>
      <AppContent user={user} onSettingsClick={onSettingsClick} onLogout={onLogout} />
    </AppProvider>
  );
}
