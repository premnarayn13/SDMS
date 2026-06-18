import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getIcon, formatSize, formatDate, Icons } from '../utils/helpers';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { renderAsync as renderDocxAsync } from 'docx-preview';
import {
  createVersion,
  createAutoVersion,
  getFileVersions,
  saveAsCopy,
  saveAsNewVersion,
  getVersionMetadata
} from '../utils/versionControl';
import { tokenUtils } from '../utils/authApi';
import { extractErrorText, isDriveAuthError, getDriveReauthorizeUrl } from '../utils/driveRecovery';
import DocumentPowerTools from './DocumentPowerTools';
import ImageWorkbench from './ImageWorkbench';
import CsvWorkbench from './CsvWorkbench';
import ExcelWorkbench from './ExcelWorkbench';
const downloadBlobForViewer = async (itemId) => {

  if (String(itemId).startsWith("mega:")) {

    const megaId = String(itemId).replace("mega:", "");

    const token = tokenUtils.getAccessToken();

    const response = await fetch(
      `/api/v1/mega/download/${megaId}`,
      {
        credentials: "include",
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      }
    );

    if (!response.ok) {
      throw new Error(`MEGA download failed: ${response.status}`);
    }

    return await response.blob();
  }

  const { documentOpsApi } = await import("../utils/documentApi");

  return await documentOpsApi.downloadDocument(itemId);
};
// Configure PDF.js worker - for v5.x, use the local worker from node_modules
// The CDN doesn't have v5.x workers yet, so we skip the worker and use the main thread
// This is a fallback approach that works but may be slower for large PDFs
pdfjsLib.GlobalWorkerOptions.workerSrc = '';
// Alternative: Import the worker locally if needed
// import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
// pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// PDFLoader Component - Dynamically loads PDF from backend
const PDFLoader = ({ itemId, fileName, onLoad, onAuthFailure }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadPDF = async () => {
      if (!itemId) {
        setError('No file ID provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Import documentApi - it's a named export
        const { documentOpsApi } = await import('../utils/documentApi');
        const blob = await downloadBlobForViewer(itemId);
        const dataUrl = URL.createObjectURL(blob);
        
        if (onLoad) {
          onLoad(dataUrl);
        }
      } catch (err) {
        console.warn('Cloud PDF load failed, trying legacy payload:', err);
        if (isDriveAuthError(err)) {
          onAuthFailure?.(err);
        }
        try {
          const token = tokenUtils.getAccessToken();
          const authHeaders = {};
          if (token) authHeaders.Authorization = `Bearer ${token}`;

          const directResponse = await fetch(`/api/v1/documents/${itemId}/download`, {
            method: 'GET',
            credentials: 'include',
            headers: authHeaders,
          });

          if (directResponse.ok) {
            const directBlob = await directResponse.blob();
            const directUrl = URL.createObjectURL(directBlob);
            if (onLoad) {
              onLoad(directUrl);
            }
            return;
          }

          const directErrorText = await directResponse.text().catch(() => '');
          if (isDriveAuthError({ status: directResponse.status }, directErrorText)) {
            onAuthFailure?.(directErrorText || 'Google Drive authorization expired.');
          }

          const { documentsApi } = await import('../utils/api');
          const response = await documentsApi.getDocument(itemId);
          const legacyDoc = response?.data;

          if (legacyDoc?.dataUrl) {
            if (onLoad) {
              onLoad(legacyDoc.dataUrl);
            }
            return;
          }

          setError('Failed to load PDF content');
        } catch (legacyError) {
          console.error('Failed to load PDF:', legacyError);
          if (isDriveAuthError(legacyError)) {
            onAuthFailure?.(legacyError);
          }
          setError('Failed to load PDF content');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadPDF();
  }, [itemId, onLoad]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] p-8">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4 flex justify-center">
            <Icon name="refresh" size={40} className="text-red-400" />
          </div>
          <p className="text-gray-600 mb-2">Loading PDF preview...</p>
          <p className="text-sm text-gray-500">{fileName}</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px] p-8">
        <div className="text-center">
          <Icon name="pdf" size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Failed to load PDF preview</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }
  
  return null; // Component will be replaced with the loaded PDF via onLoad callback
};

// Icon component for SVG rendering
const Icon = ({ name, size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    dangerouslySetInnerHTML={{ __html: Icons[name] || '' }}
  />
);

// Get file type configuration for icon and colors
const getFileTypeConfig = (item) => {
  const ext = item?.name?.split('.').pop()?.toLowerCase() || '';
  if (item?.type === 'folder') return { icon: 'folder', color: 'text-navy-600', bg: 'bg-navy-100' };
  if (['pdf'].includes(ext)) return { icon: 'pdf', color: 'text-red-500', bg: 'bg-red-50' };
  if (['doc', 'docx'].includes(ext)) return { icon: 'word', color: 'text-blue-500', bg: 'bg-blue-50' };
  if (['xls', 'xlsx'].includes(ext)) return { icon: 'excel', color: 'text-green-500', bg: 'bg-green-50' };
  if (['ppt', 'pptx'].includes(ext)) return { icon: 'powerpoint', color: 'text-orange-500', bg: 'bg-orange-50' };
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return { icon: 'image', color: 'text-purple-500', bg: 'bg-purple-50' };
  if (['txt', 'md', 'json', 'js', 'jsx', 'css', 'html'].includes(ext)) return { icon: 'text', color: 'text-navy-500', bg: 'bg-navy-50' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: 'archive', color: 'text-amber-600', bg: 'bg-amber-50' };
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogg', 'ogv'].includes(ext)) return { icon: 'video', color: 'text-pink-500', bg: 'bg-pink-50' };
  if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) return { icon: 'audio', color: 'text-indigo-500', bg: 'bg-indigo-50' };
  return { icon: 'file', color: 'text-navy-500', bg: 'bg-navy-50' };
};

export default function EnhancedFileViewer({
  isOpen,
  onClose,
  item,
  onSave,
  onSaveAsCopy,
  onSaveAsNewVersion,
  onDownload,
  onShare,
  onDelete,
  onPrint,
  onShowVersionHistory,
  autoShowPowerSidebar = false,
  autoPowerSection = 'main',
  onPowerSidebarConsumed = () => {}
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchDirection, setSearchDirection] = useState('next');
  const [activeTab, setActiveTab] = useState('info');
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showPowerSidebar, setShowPowerSidebar] = useState(false);
  const [powerSidebarSection, setPowerSidebarSection] = useState('main');
  const [powerSidebarWidth, setPowerSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return 420;
    const stored = Number(window.localStorage.getItem('docmatrix_power_sidebar_width'));
    return Number.isFinite(stored) && stored >= 320 ? stored : 420;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarResizeRef = useRef({ startX: 0, startWidth: 420 });
  
  // View Mode States
  const [viewMode, setViewMode] = useState('fit-page'); // 'fit-page', 'fit-width', 'actual-size', 'continuous'
  const [displayMode, setDisplayMode] = useState('single'); // 'single', 'continuous'
  const [readMode, setReadMode] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  
  // PDF state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [useFallbackViewer, setUseFallbackViewer] = useState(false);
  const [pdfErrorDetail, setPdfErrorDetail] = useState('');
  const [driveReconnectUrl, setDriveReconnectUrl] = useState('');
  const [driveReconnectLoading, setDriveReconnectLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pageRotation, setPageRotation] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loadedPdfUrl, setLoadedPdfUrl] = useState(null); // For dynamically loaded PDFs
  const [remoteDataUrl, setRemoteDataUrl] = useState(null);
  const [remoteTextContent, setRemoteTextContent] = useState('');
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  
  // Word document state
  const [wordContent, setWordContent] = useState('');
  const [wordLoading, setWordLoading] = useState(false);
  const [wordArrayBuffer, setWordArrayBuffer] = useState(null);
  const [wordPreviewError, setWordPreviewError] = useState('');
  
  // PowerPoint state
  const [slideIndex, setSlideIndex] = useState(0);
  const [slides, setSlides] = useState([]);
  const [slideshowMode, setSlideshowMode] = useState(false);
  
  // TXT/CSV state
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [encoding, setEncoding] = useState('UTF-8');
  
  // Image state
  const [imageRotation, setImageRotation] = useState(0);
  const [imageBrightness, setImageBrightness] = useState(100);
  const [imageContrast, setImageContrast] = useState(100);
  const [imageSaturation, setImageSaturation] = useState(100);
  const [imageFlipH, setImageFlipH] = useState(false);
  const [imageFlipV, setImageFlipV] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [showExif, setShowExif] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  
  // Annotations state (Enhanced)
  const [annotations, setAnnotations] = useState([]);
  const [annotationTool, setAnnotationTool] = useState(null); // 'highlight', 'underline', 'strikethrough', 'draw', 'arrow', 'rectangle', 'text', 'sticky'
  const [annotationColor, setAnnotationColor] = useState('#ffeb3b');
  const [selectedText, setSelectedText] = useState('');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showAnnotationToolbar, setShowAnnotationToolbar] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);
  
  // Bookmarks state
  const [bookmarks, setBookmarks] = useState([]);
  const [showPrintPreview, setPrintPreview] = useState(false);

  // Video/Audio state
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);

  // Save As New File state
  const [showSaveAsNewFileDialog, setShowSaveAsNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Version Control state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [versionCount, setVersionCount] = useState(0);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [versionLabel, setVersionLabel] = useState('Draft');
  const [versionComment, setVersionComment] = useState('');
  const [showVersionSaveDialog, setShowVersionSaveDialog] = useState(false);
  const [autoVersionEnabled, setAutoVersionEnabled] = useState(true);
  const [isSavingAction, setIsSavingAction] = useState(false);

  // DOCX editing state
  const [docxEditMode, setDocxEditMode] = useState(false);
  const [docxEditableContent, setDocxEditableContent] = useState('');
  const docxEditorRef = useRef(null);
  const docxPreviewRef = useRef(null);
  const textUndoRef = useRef([]);
  const textRedoRef = useRef([]);
  const docxUndoRef = useRef([]);
  const docxRedoRef = useRef([]);
  const suspendHistoryRef = useRef(false);
  const activeRemoteUrlRef = useRef(null);

  const resolvedPreviewUrl = item?.dataUrl || loadedPdfUrl || remoteDataUrl;
  const resolvedTextContent = item?.content || remoteTextContent || editContent;
  const [excelSourceBlob, setExcelSourceBlob] = useState(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelLoadError, setExcelLoadError] = useState('');

  const resolveDriveReconnect = useCallback(async (errorOrText) => {
    const detail = extractErrorText(errorOrText) || 'Google Drive access expired for this file.';
    setPdfErrorDetail(detail);

    if (driveReconnectLoading || driveReconnectUrl) {
      return;
    }

    setDriveReconnectLoading(true);
    try {
      const driveIdHint = item?.drive_id || item?.driveId || null;
      const authUrl = await getDriveReauthorizeUrl(driveIdHint);
      if (authUrl) {
        setDriveReconnectUrl(authUrl);
      }
    } finally {
      setDriveReconnectLoading(false);
    }
  }, [item, driveReconnectLoading, driveReconnectUrl]);

  useEffect(() => {
    if (item?.content) {
      setEditContent(item.content);
      setOriginalContent(item.content);
      textUndoRef.current = [item.content];
      textRedoRef.current = [];
    }
    if (item?.id) {
      const versions = getFileVersions(item.id);
      setVersionCount(versions.length);
      const metadata = getVersionMetadata(item.id);
      setAutoVersionEnabled(metadata.autoVersionEnabled);
    }
  }, [item]);

  useEffect(() => {
    if (!isOpen) {
      setShowPowerSidebar(false);
      setPowerSidebarSection('main');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isEditMode || suspendHistoryRef.current) return;
    const stack = textUndoRef.current;
    if (stack.length === 0 || stack[stack.length - 1] !== editContent) {
      stack.push(editContent);
      if (stack.length > 100) stack.shift();
      textRedoRef.current = [];
    }
  }, [editContent, isOpen, isEditMode]);

  useEffect(() => {
    if (!isOpen || !docxEditMode || suspendHistoryRef.current) return;
    const stack = docxUndoRef.current;
    if (stack.length === 0 || stack[stack.length - 1] !== docxEditableContent) {
      stack.push(docxEditableContent);
      if (stack.length > 100) stack.shift();
      docxRedoRef.current = [];
    }
  }, [docxEditableContent, isOpen, docxEditMode]);

  // Track changes for unsaved indicator
  useEffect(() => {
    if (isEditMode || docxEditMode) {
      const currentContent = docxEditMode ? docxEditableContent : editContent;
      setHasUnsavedChanges(currentContent !== originalContent);
    }
  }, [editContent, docxEditableContent, originalContent, isEditMode, docxEditMode]);

  // Auto-save version on content change (debounced)
  useEffect(() => {
    if (!hasUnsavedChanges || !item?.id || !autoVersionEnabled || docxEditMode) return;
    
    const content = docxEditMode ? docxEditableContent : editContent;
    createAutoVersion(item.id, content, {
      fileName: item.name,
      fileType: item.type
    }, 10000); // 10 second debounce
  }, [editContent, docxEditableContent, hasUnsavedChanges, item, autoVersionEnabled, docxEditMode]);

  useEffect(() => {
    if (!isOpen || !item) return;

    const isPDF = item.type === 'pdf' || item.name?.endsWith('.pdf');
    const isWord = /\.(doc|docx)$/i.test(item.name || '');

    // Keep a single fetch/render path per file type to avoid duplicate loads and flicker.
    if (isPDF) {
      if (item.dataUrl) {
        loadPDF(item.dataUrl);
      } else if (item.id && !loadedPdfUrl) {
        loadPDFFromBackend(item.id);
      }
    } else if (isWord) {
      if (item.dataUrl) {
        loadWordDocument(item.dataUrl);
      } else if (item.id) {
        loadWordFromBackend(item.id);
      }
    }
  }, [isOpen, item?.id, item?.name, item?.type, item?.dataUrl, loadedPdfUrl]);

  useEffect(() => {
    if (isOpen) return;
    setPdfDoc(null);
    setWordContent('');
    setWordArrayBuffer(null);
    setWordPreviewError('');
    setCurrentPage(1);
    setTotalPages(0);
    setLoadedPdfUrl(null);
    setRemoteDataUrl(null);
    setRemoteTextContent('');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && autoShowPowerSidebar) {
      setPowerSidebarSection(autoPowerSection || 'main');
      setShowPowerSidebar(true);
      onPowerSidebarConsumed?.();
    }
  }, [isOpen, autoShowPowerSidebar, autoPowerSection, onPowerSidebarConsumed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('docmatrix_power_sidebar_width', String(powerSidebarWidth));
  }, [powerSidebarWidth]);

  useEffect(() => {
    if (!isResizingSidebar) return;
    const handleMove = (event) => {
      const delta = sidebarResizeRef.current.startX - event.clientX;
      const nextWidth = Math.min(680, Math.max(320, sidebarResizeRef.current.startWidth + delta));
      setPowerSidebarWidth(nextWidth);
    };
    const handleUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
    };
  }, [isResizingSidebar]);

  const handleSidebarResizeStart = (event) => {
    event.preventDefault();
    setIsResizingSidebar(true);
    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: powerSidebarWidth,
    };
  };

  useEffect(() => {
    if (!isOpen || !item?.id || item?.dataUrl || item?.content) {
      setRemoteDataUrl(null);
      setRemoteTextContent('');
      return;
    }

    const extension = item.name?.split('.').pop()?.toLowerCase() || '';
    const textExtensions = new Set(['txt', 'md', 'csv', 'json', 'xml', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'py', 'java', 'sql', 'log']);
    const itemName = item.name || '';
    const localIsPDF = item.type === 'pdf' || /\.pdf$/i.test(itemName);
    const localIsWord = /\.(doc|docx)$/i.test(itemName);
    const shouldFetchRemote = !localIsPDF && !localIsWord && item.type !== 'folder';

    if (!shouldFetchRemote) {
      setRemoteDataUrl(null);
      setRemoteTextContent('');
      return;
    }

    let cancelled = false;

    const loadRemotePreview = async () => {
      try {
        const { documentOpsApi } = await import('../utils/documentApi');
        const blob = await downloadBlobForViewer(item.id);
        if (cancelled) return;

        if (activeRemoteUrlRef.current) {
          URL.revokeObjectURL(activeRemoteUrlRef.current);
          activeRemoteUrlRef.current = null;
        }

        const objectUrl = URL.createObjectURL(blob);
        activeRemoteUrlRef.current = objectUrl;
        setRemoteDataUrl(objectUrl);

        const mimeType = (blob.type || item.mimeType || '').toLowerCase();
        const isTextLike = mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml') || textExtensions.has(extension);
        if (isTextLike) {
          const text = await blob.text();
          if (!cancelled) {
            setRemoteTextContent(text);
            setEditContent(text);
          }
        } else {
          setRemoteTextContent('');
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed cloud preview fetch, trying legacy payload:', error);
          const legacyDoc = await loadLegacyDocumentPayload(item.id);
          if (legacyDoc?.dataUrl) {
            setRemoteDataUrl(legacyDoc.dataUrl);
            setRemoteTextContent(legacyDoc.content || '');
            if (legacyDoc.content) {
              setEditContent(legacyDoc.content);
            }
            return;
          }
          if (legacyDoc?.content) {
            setRemoteDataUrl(null);
            setRemoteTextContent(legacyDoc.content);
            setEditContent(legacyDoc.content);
            return;
          }

          console.error('Failed to load remote file preview:', error);
          setRemoteDataUrl(null);
          setRemoteTextContent('');
        }
      }
    };

    loadRemotePreview();

    return () => {
      cancelled = true;
    };
  }, [isOpen, item?.id, item?.dataUrl, item?.content, item?.name, item?.type, item?.mimeType]);

  useEffect(() => {
    const isExcelFile = /\.(xls|xlsx)$/i.test(item?.name || '');
    if (!isOpen || !isExcelFile) {
      setExcelSourceBlob(null);
      setExcelLoadError('');
      setExcelLoading(false);
      return;
    }

    let cancelled = false;

    const loadExcelBlob = async () => {
      setExcelLoading(true);
      setExcelLoadError('');

      try {
        // First preference: direct fetch from preview/data URL when already available.
        const excelUrl = item?.dataUrl || resolvedPreviewUrl;
        if (excelUrl) {
          const response = await fetch(excelUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (!cancelled) {
              setExcelSourceBlob(blob);
              setExcelLoading(false);
              return;
            }
          }
        }

        // Second preference: backend API download by id.
        if (item?.id) {
          const { documentOpsApi } = await import('../utils/documentApi');
         const blob = await downloadBlobForViewer(item.id);
          if (!cancelled) {
            setExcelSourceBlob(blob);
            setExcelLoading(false);
            return;
          }
        }

        // Third preference: use signed/authorized view URL.
        if (item?.id) {
          const { documentOpsApi } = await import('../utils/documentApi');
          const viewUrl = await documentOpsApi.getViewUrl(item.id);
          if (viewUrl) {
            const token = tokenUtils.getAccessToken();
            const viewResponse = await fetch(viewUrl, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (viewResponse.ok) {
              const blob = await viewResponse.blob();
              if (!cancelled) {
                setExcelSourceBlob(blob);
                setExcelLoading(false);
                return;
              }
            }
          }
        }

        // Fourth preference: legacy payload fallback.
        if (item?.id) {
          const legacyDoc = await loadLegacyDocumentPayload(item.id);
          if (legacyDoc?.dataUrl) {
            const legacyResponse = await fetch(legacyDoc.dataUrl);
            if (legacyResponse.ok) {
              const blob = await legacyResponse.blob();
              if (!cancelled) {
                setExcelSourceBlob(blob);
                setExcelLoading(false);
                return;
              }
            }
          }

          if (legacyDoc?.content && !cancelled) {
            // Last-resort support for CSV-like content labelled as spreadsheet.
            const blob = new Blob([legacyDoc.content], { type: 'text/csv;charset=utf-8' });
            setExcelSourceBlob(blob);
            setExcelLoading(false);
            return;
          }
        }

        throw new Error('Workbook source not available');
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load Excel workbook:', error);
          setExcelSourceBlob(null);
          setExcelLoadError(error?.message || 'Failed to load workbook');
          setExcelLoading(false);
        }
      }
    };

    loadExcelBlob();

    return () => {
      cancelled = true;
    };
  }, [isOpen, item?.id, item?.name, item?.dataUrl, resolvedPreviewUrl]);

  useEffect(() => {
    return () => {
      if (activeRemoteUrlRef.current) {
        URL.revokeObjectURL(activeRemoteUrlRef.current);
        activeRemoteUrlRef.current = null;
      }
    };
  }, []);

  const loadPDF = async (url) => {
    console.log('Loading PDF from:', url?.substring(0, 50) + '...');
    try {
      setPdfRendering(true);
      setPdfError(false);
      setPdfErrorDetail('');
      setDriveReconnectUrl('');
      setUseFallbackViewer(false);
      
      // Try PDF.js first
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      console.log('PDF.js loaded successfully, pages:', pdf.numPages);
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setPdfRendering(false);
    } catch (error) {
      console.error('Error loading PDF with PDF.js:', error);
      console.log('Falling back to native browser PDF viewer');
      setPdfRendering(false);
      setPdfError(true);
      // Use browser's native PDF viewer as fallback
      setUseFallbackViewer(true);
    }
  };

  const loadLegacyDocumentPayload = async (fileId) => {
    try {
      const { documentsApi } = await import('../utils/api');
      const response = await documentsApi.getDocument(fileId);
      return response?.data || null;
    } catch (error) {
      console.warn('Legacy document fetch failed:', error);
      return null;
    }
  };

  const loadWordDocument = async (url) => {
    try {
      setWordLoading(true);
      setWordPreviewError('');
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      setWordArrayBuffer(arrayBuffer);
      // Keep Mammoth HTML only for the lightweight inline editor fallback.
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setWordContent(result.value || '');
      setWordLoading(false);
    } catch (error) {
      console.error('Error loading Word document:', error);
      setWordArrayBuffer(null);
      setWordPreviewError(error?.message || 'Failed to load preview');
      setWordContent('<p>Error loading document. Please try downloading the file.</p>');
      setWordLoading(false);
    }
  };

  // Load PDF from backend API
  const loadPDFFromBackend = async (fileId) => {
    try {
      console.log('🔄 Loading PDF from backend:', fileId);
      setPdfError(false);
      setPdfErrorDetail('');
      setDriveReconnectUrl('');
      const { documentOpsApi } = await import('../utils/documentApi');
      const blob = await downloadBlobForViewer(fileId);
      const dataUrl = URL.createObjectURL(blob);
      setLoadedPdfUrl(dataUrl);
      loadPDF(dataUrl);
    } catch (error) {
      console.warn('Cloud PDF download failed, trying legacy payload:', error);
      let fallbackErrorText = '';

      try {
        const token = tokenUtils.getAccessToken();
        const authHeaders = {};
        if (token) authHeaders.Authorization = `Bearer ${token}`;

        const directResponse = await fetch(`/api/v1/documents/${fileId}/download`, {
          method: 'GET',
          credentials: 'include',
          headers: authHeaders,
        });

        if (directResponse.ok) {
          const blob = await directResponse.blob();
          const dataUrl = URL.createObjectURL(blob);
          setLoadedPdfUrl(dataUrl);
          loadPDF(dataUrl);
          return;
        }

        fallbackErrorText = await directResponse.text().catch(() => '');
      } catch (directError) {
        console.warn('Direct PDF fetch failed:', directError);
        fallbackErrorText = extractErrorText(directError);
      }

      const legacyDoc = await loadLegacyDocumentPayload(fileId);
      if (legacyDoc?.dataUrl) {
        setLoadedPdfUrl(legacyDoc.dataUrl);
        loadPDF(legacyDoc.dataUrl);
        return;
      }
      console.error('❌ Error loading PDF from backend:', error);

      if (isDriveAuthError(error, fallbackErrorText)) {
        await resolveDriveReconnect(fallbackErrorText || error);
      }

      setPdfError(true);
    }
  };

  // Load Word document from backend API
  const loadWordFromBackend = async (fileId) => {
    try {
      console.log('🔄 Loading Word doc from backend:', fileId);
      setWordLoading(true);
      setWordPreviewError('');
      const { documentOpsApi } = await import('../utils/documentApi');
      const blob = await downloadBlobForViewer(fileId);
      const arrayBuffer = await blob.arrayBuffer();
      setWordArrayBuffer(arrayBuffer);
      // Keep Mammoth HTML only for the lightweight inline editor fallback.
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setWordContent(result.value || '');
      setWordLoading(false);
      console.log('✅ Word document loaded successfully');
    } catch (error) {
      console.warn('Cloud Word download failed, trying legacy payload:', error);
      if (isDriveAuthError(error)) {
        await resolveDriveReconnect(error);
        setWordArrayBuffer(null);
        setWordPreviewError('Google Drive authorization required. Reconnect Drive and retry.');
        setWordContent('');
        setWordLoading(false);
        return;
      }
      const legacyDoc = await loadLegacyDocumentPayload(fileId);
      if (legacyDoc?.dataUrl) {
        await loadWordDocument(legacyDoc.dataUrl);
        return;
      }
      if (legacyDoc?.content) {
        setWordArrayBuffer(null);
        setWordContent(`<pre>${legacyDoc.content}</pre>`);
        setWordLoading(false);
        return;
      }
      console.error('❌ Error loading Word document from backend:', error);
      setWordArrayBuffer(null);
      setWordPreviewError(error?.message || 'Failed to load preview');
      setWordContent(`<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-red-800 font-medium">Failed to load document</p>
        <p class="text-red-600 text-sm mt-2">${error.message}</p>
      </div>`);
      setWordLoading(false);
    }
  };

  // Render DOCX preview with preserved structure (headings, spacing, fonts, colors).
  // Mammoth is still used only for the basic inline edit mode.
  useEffect(() => {
    if (!isOpen || docxEditMode || !wordArrayBuffer) return;
    if (!item?.name || !/\.(doc|docx)$/i.test(item.name)) return;

    let cancelled = false;

    const renderPreview = async () => {
      // Ensure container is mounted.
      for (let i = 0; i < 10 && !docxPreviewRef.current; i += 1) {
        await new Promise(requestAnimationFrame);
        if (cancelled) return;
      }

      const container = docxPreviewRef.current;
      if (!container) return;

      try {
        container.innerHTML = '';
        await renderDocxAsync(wordArrayBuffer, container, container, {
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
        });
        if (!cancelled) setWordPreviewError('');
      } catch (error) {
        console.error('Error rendering DOCX preview:', error);
        if (!cancelled) {
          setWordPreviewError(error?.message || 'Failed to render preview');
        }
      }
    };

    renderPreview();
    return () => {
      cancelled = true;
    };
  }, [docxEditMode, isOpen, item?.name, wordArrayBuffer]);

  useEffect(() => {
    if (!docxEditMode || !docxEditorRef.current) return;
    const editor = docxEditorRef.current;
    const isFocused = document.activeElement === editor;
    if (!isFocused && editor.innerHTML !== (docxEditableContent || '')) {
      editor.innerHTML = docxEditableContent || '';
    }
  }, [docxEditMode, docxEditableContent]);

  const handleSearchNavigation = (direction = 'next') => {
    if (!searchQuery?.trim()) return;
    setSearchDirection(direction);
    const isBackward = direction === 'prev';
    if (typeof window.find === 'function') {
      window.find(searchQuery, false, isBackward, true, false, false, false);
    }
  };

  const handleUndo = () => {
    if (docxEditMode) {
      const stack = docxUndoRef.current;
      if (stack.length <= 1) return;
      const current = stack.pop();
      docxRedoRef.current.push(current);
      const previous = stack[stack.length - 1] || '';
      suspendHistoryRef.current = true;
      setDocxEditableContent(previous);
      if (docxEditorRef.current) {
        docxEditorRef.current.innerHTML = previous;
      }
      queueMicrotask(() => {
        suspendHistoryRef.current = false;
      });
      return;
    }

    if (!isEditMode) return;
    const stack = textUndoRef.current;
    if (stack.length <= 1) return;
    const current = stack.pop();
    textRedoRef.current.push(current);
    const previous = stack[stack.length - 1] || '';
    suspendHistoryRef.current = true;
    setEditContent(previous);
    queueMicrotask(() => {
      suspendHistoryRef.current = false;
    });
  };

  const handleRedo = () => {
    if (docxEditMode) {
      if (docxRedoRef.current.length === 0) return;
      const next = docxRedoRef.current.pop();
      docxUndoRef.current.push(next);
      suspendHistoryRef.current = true;
      setDocxEditableContent(next);
      if (docxEditorRef.current) {
        docxEditorRef.current.innerHTML = next;
      }
      queueMicrotask(() => {
        suspendHistoryRef.current = false;
      });
      return;
    }

    if (!isEditMode) return;
    if (textRedoRef.current.length === 0) return;
    const next = textRedoRef.current.pop();
    textUndoRef.current.push(next);
    suspendHistoryRef.current = true;
    setEditContent(next);
    queueMicrotask(() => {
      suspendHistoryRef.current = false;
    });
  };

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPDFPage(currentPage);
    }
  }, [pdfDoc, currentPage, zoomLevel, pageRotation, viewMode]);

  const renderPDFPage = async (pageNum) => {
    if (!pdfDoc || !canvasRef.current) return;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      let scale = zoomLevel / 100;
      
      // Apply view mode scaling
      if (viewMode === 'fit-width' && canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.clientWidth - 40;
        const viewport = page.getViewport({ scale: 1, rotation: pageRotation });
        scale = containerWidth / viewport.width;
      } else if (viewMode === 'fit-page' && canvasContainerRef.current) {
        const containerHeight = canvasContainerRef.current.clientHeight - 40;
        const containerWidth = canvasContainerRef.current.clientWidth - 40;
        const viewport = page.getViewport({ scale: 1, rotation: pageRotation });
        const scaleWidth = containerWidth / viewport.width;
        const scaleHeight = containerHeight / viewport.height;
        scale = Math.min(scaleWidth, scaleHeight);
      }
      
      const viewport = page.getViewport({ scale, rotation: pageRotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering PDF page:', error);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false);
        if (isFullscreen) setIsFullscreen(false);
        if (slideshowMode) setSlideshowMode(false);
        if (readMode) setReadMode(false);
      }
      // PDF navigation
      if (pdfDoc) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          setCurrentPage(prev => Math.max(1, prev - 1));
        }
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          setCurrentPage(prev => Math.min(totalPages, prev + 1));
        }
        if (e.key === 'Home') {
          e.preventDefault();
          setCurrentPage(1);
        }
        if (e.key === 'End') {
          e.preventDefault();
          setCurrentPage(totalPages);
        }
      }
      // Slideshow navigation
      if (slideshowMode) {
        if (e.key === 'ArrowRight') {
          setSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
        }
        if (e.key === 'ArrowLeft') {
          setSlideIndex(prev => Math.max(0, prev - 1));
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showSearch, pdfDoc, totalPages, isFullscreen, slideshowMode, readMode, slides.length]);

  const powerToolsItem = {
    ...item,
    dataUrl: item?.dataUrl || resolvedPreviewUrl || loadedPdfUrl || remoteDataUrl || null,
    content: item?.content || resolvedTextContent || '',
  };

  if (!isOpen || !item) return null;

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 25));
  const handleZoomReset = () => setZoomLevel(100);
  const handleZoomFitWidth = () => setViewMode('fit-width');
  const handleZoomFitPage = () => setViewMode('fit-page');
  const handleZoomActual = () => { setViewMode('actual-size'); setZoomLevel(100); };

  // Save handler - now creates a version before saving
  const handleSave = async () => {
    if (docxEditMode) {
      const suggestedName = `${item.name.replace(/\.[^.]+$/, '')} (Edited)`;
      setNewFileName(suggestedName);
      setShowSaveAsNewFileDialog(true);
      return;
    }

    const content = docxEditMode ? docxEditableContent : editContent;
    
    // Create a version before saving
    if (item?.id) {
      createVersion(item.id, content, {
        label: 'Manual Save',
        comment: 'Saved from editor',
        fileName: item.name,
        fileType: item.type
      });
      setVersionCount(prev => prev + 1);
    }
    
    await onSave?.(item.id, content);
    setOriginalContent(content);
    setHasUnsavedChanges(false);
    setIsEditMode(false);
    setDocxEditMode(false);
  };

  // Save as Copy handler
  const handleSaveAsCopy = async () => {
    if (isSavingAction) return;
    const content = docxEditMode ? docxEditableContent : editContent;
    const copyName = saveAsName || `${item.name.replace(/\.[^.]+$/, '')} (Copy)${item.name.match(/\.[^.]+$/)?.[0] || ''}`;

    try {
      setIsSavingAction(true);
      if (onSaveAsCopy) {
        await onSaveAsCopy(item, content, copyName, { isDocxEdit: docxEditMode });
      }

      setShowSaveAsDialog(false);
      setSaveAsName('');
    } finally {
      setIsSavingAction(false);
    }
  };

  // Save as New Version handler
  const handleSaveAsNewVersion = () => {
    const content = docxEditMode ? docxEditableContent : editContent;
    
    const version = saveAsNewVersion(
      item.id,
      content,
      versionLabel,
      versionComment,
      item.name,
      item.type
    );
    
    if (version) {
      setVersionCount(prev => prev + 1);
      if (onSaveAsNewVersion) {
        onSaveAsNewVersion(item, version);
      }
    }
    
    setShowVersionSaveDialog(false);
    setVersionLabel('Draft');
    setVersionComment('');
    setOriginalContent(content);
    setHasUnsavedChanges(false);
  };

  // Show version history
  const handleShowVersionHistory = () => {
    if (onShowVersionHistory) {
      onShowVersionHistory(item);
    }
  };

  const inlineAnnotationTools = ['highlight', 'underline', 'strikethrough'];
  const pointAnnotationTools = ['draw', 'arrow', 'rectangle', 'text', 'sticky'];

  const getSelectionContext = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { text: '', range: null };
    }

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const selectionRoot = range.commonAncestorContainer?.nodeType === 3
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    const insideViewer = !!(canvasContainerRef.current && selectionRoot && canvasContainerRef.current.contains(selectionRoot));

    if (!insideViewer) {
      return { text: '', range: null };
    }

    return { text, range };
  };

  const applyInlineAnnotation = (type, color) => {
    const { text, range } = getSelectionContext();
    if (!text || !range) {
      return false;
    }

    const span = document.createElement('span');
    if (type === 'highlight') {
      span.style.backgroundColor = color;
      span.style.color = '#111827';
      span.style.padding = '0 1px';
      span.style.borderRadius = '2px';
    }
    if (type === 'underline') {
      span.style.textDecoration = 'underline';
      span.style.textDecorationColor = color;
      span.style.textDecorationThickness = '2px';
    }
    if (type === 'strikethrough') {
      span.style.textDecoration = 'line-through';
      span.style.textDecorationColor = color;
      span.style.textDecorationThickness = '2px';
    }

    try {
      range.surroundContents(span);
    } catch {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    if (docxEditMode && docxEditorRef.current) {
      setDocxEditableContent(docxEditorRef.current.innerHTML);
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
    return true;
  };

  // Annotation handlers
  const handleAddAnnotation = (type = annotationTool, options = {}) => {
    const annotationType = type || annotationTool;
    if (!annotationType) return false;

    const selectionText = options.text ?? selectedText;
    const annotationText = (selectionText || '').trim();

    const newAnnotation = {
      id: Date.now(),
      type: annotationType,
      text: annotationText || `${annotationType} annotation`,
      page: currentPage,
      color: annotationColor,
      timestamp: new Date().toISOString(),
      position: options.position || { x: 0, y: 0 }
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setSelectedText('');
    return true;
  };

  const handleAddBookmark = () => {
    const newBookmark = {
      id: Date.now(),
      page: currentPage,
      name: `Page ${currentPage}`,
      timestamp: new Date().toISOString()
    };
    setBookmarks([...bookmarks, newBookmark]);
  };

  const handleRemoveAnnotation = (id) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  const handleRemoveBookmark = (id) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  const handleGoToBookmark = (page) => {
    setCurrentPage(page);
  };

  const handleTextSelection = () => {
    const { text } = getSelectionContext();
    if (!text) {
      return;
    }

    setSelectedText(text);

    if (!annotationTool) {
      return;
    }

    if (inlineAnnotationTools.includes(annotationTool)) {
      const applied = applyInlineAnnotation(annotationTool, annotationColor);
      if (applied) {
        handleAddAnnotation(annotationTool, { text });
      }
      return;
    }

    handleAddAnnotation(annotationTool, { text });
  };

  const handleViewerClick = (event) => {
    if (!annotationTool || !pointAnnotationTools.includes(annotationTool)) {
      return;
    }

    const { text } = getSelectionContext();
    if (text) {
      return;
    }

    const container = canvasContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const position = {
      x: event.clientX - rect.left + container.scrollLeft,
      y: event.clientY - rect.top + container.scrollTop
    };

    let noteText = selectedText?.trim() || '';
    if ((annotationTool === 'text' || annotationTool === 'sticky') && !noteText) {
      const entered = window.prompt('Enter annotation text:');
      if (!entered || !entered.trim()) return;
      noteText = entered.trim();
    }

    handleAddAnnotation(annotationTool, {
      text: noteText || `${annotationTool} annotation`,
      position
    });
  };

  const handleQuickAnnotationAction = (type) => {
    const { text } = getSelectionContext();
    if (inlineAnnotationTools.includes(type) && text) {
      const applied = applyInlineAnnotation(type, annotationColor);
      if (applied) {
        handleAddAnnotation(type, { text });
      }
      return;
    }

    handleAddAnnotation(type, {
      text: text || selectedText || `${type} annotation`
    });
  };

  const handleOpenPowerTools = (section = 'main') => {
    if (!item) return;
    setPowerSidebarSection(section || 'main');
    setShowPowerSidebar(true);
  };

  const handleRotatePage = (degrees) => {
    setPageRotation((prev) => (prev + degrees) % 360);
  };

  // Image manipulation handlers
  const handleRotateLeft = () => setImageRotation(prev => (prev - 90) % 360);
  const handleRotateRight = () => setImageRotation(prev => (prev + 90) % 360);
  const handleFlipHorizontal = () => setImageFlipH(prev => !prev);
  const handleFlipVertical = () => setImageFlipV(prev => !prev);
  const handleResetImage = () => {
    setImageRotation(0);
    setImageBrightness(100);
    setImageContrast(100);
    setImageSaturation(100);
    setImageFlipH(false);
    setImageFlipV(false);
    setZoomLevel(100);
  };

  // Export annotations
  const handleExportAnnotations = () => {
    const data = JSON.stringify(annotations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.name}-annotations.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // File type detection
  const isPDF = item.type === 'pdf' || item.name?.endsWith('.pdf');
  const isImage = item.type === 'image' || /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i.test(item.name);
  const isText = item.type === 'text' || /\.(txt|md|json|js|jsx|css|html|xml)$/i.test(item.name);
  const isCSV = /\.csv$/i.test(item.name);
  const isWord = /\.(doc|docx)$/i.test(item.name);
  const isPowerPoint = /\.(ppt|pptx)$/i.test(item.name);
  const isExcel = /\.(xls|xlsx)$/i.test(item.name);
  const isVideo = /\.(mp4|webm|mov|avi|mkv|m4v|ogg|ogv)$/i.test(item.name);
  const isAudio = /\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i.test(item.name);
  const isMedia = isVideo || isAudio;
  const slideCount = Math.max(1, slides.length || 5);

  // Video/Audio control functions
  const togglePlayPause = () => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      if (isPlaying) {
        media.pause();
      } else {
        media.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e) => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      const newTime = parseFloat(e.target.value);
      media.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      media.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      media.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handlePlaybackRateChange = (rate) => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      media.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const skipForward = (seconds = 10) => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      media.currentTime = Math.min(media.currentTime + seconds, duration);
    }
  };

  const skipBackward = (seconds = 10) => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) {
      media.currentTime = Math.max(media.currentTime - seconds, 0);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleFullscreenVideo = () => {
    const videoContainer = document.getElementById('video-container');
    if (!document.fullscreenElement) {
      videoContainer?.requestFullscreen();
      setIsFullscreenVideo(true);
    } else {
      document.exitFullscreen();
      setIsFullscreenVideo(false);
    }
  };

  // Save as New File handler
  const handleSaveAsNewFile = async () => {
    if (isSavingAction) return;
    const content = docxEditMode ? docxEditableContent : editContent;
    const fileName = newFileName || `${item.name.replace(/\.[^.]+$/, '')} (New)${item.name.match(/\.[^.]+$/)?.[0] || ''}`;

    try {
      setIsSavingAction(true);
      if (onSaveAsCopy) {
        await onSaveAsCopy(item, content, fileName, { isDocxEdit: docxEditMode });
      }

      setShowSaveAsNewFileDialog(false);
      setNewFileName('');
      setHasUnsavedChanges(false);
      setIsEditMode(false);
      setDocxEditMode(false);
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleCreateDerivedFile = async (newName, payload, mimeType = null) => {
    try {
      if (onSaveAsCopy) {
        await onSaveAsCopy(item, payload, newName, { mimeType });
        return;
      }

      const blob = payload instanceof Blob
        ? payload
        : new Blob([typeof payload === 'string' ? payload : JSON.stringify(payload ?? '')], {
            type: mimeType || 'application/octet-stream'
          });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = newName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to create derived file:', error);
    }
  };

  const getImageStyles = () => {
    return {
      transform: `
        rotate(${imageRotation}deg)
        scaleX(${imageFlipH ? -1 : 1})
        scaleY(${imageFlipV ? -1 : 1})
        scale(${zoomLevel / 100})
      `,
      filter: `
        brightness(${imageBrightness}%)
        contrast(${imageContrast}%)
        saturate(${imageSaturation}%)
      `,
      transition: 'all 0.3s ease'
    };
  };

  // Line numbers for text files
  const renderTextWithLineNumbers = (text) => {
    const lines = text.split('\n');
    return (
      <div className="flex font-mono text-sm">
        {showLineNumbers && (
          <div className="pr-4 text-right text-gray-400 select-none border-r border-gray-200 bg-gray-50">
            {lines.map((_, i) => (
              <div key={i} className="leading-6">{i + 1}</div>
            ))}
          </div>
        )}
        <pre className={`flex-1 pl-4 leading-6 ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
          {text}
        </pre>
      </div>
    );
  };

  // CSV rendering
  const renderCSV = (content) => {
    const rows = content.split('\n').map(row => row.split(','));
    return (
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {rows[0]?.map((header, i) => (
                <th key={i} className="px-4 py-2 text-left font-semibold text-gray-900 border-r border-gray-200">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.slice(1).map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 border-r border-gray-200 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-0 ${isFullscreen ? '' : 'p-4'}`}>
      <div className={`bg-white rounded-lg shadow-2xl flex flex-col relative overflow-hidden ${isFullscreen ? 'w-full h-full rounded-none' : 'w-[95%] max-w-7xl h-full'}`}>
        {readMode && (
          <div className="absolute top-3 right-3 z-50 flex items-center gap-2 bg-white/95 border border-navy-200 rounded-md px-2 py-1 shadow">
            <button
              onClick={() => setReadMode(false)}
              className="px-2 py-1 rounded bg-navy-100 hover:bg-navy-200 text-xs"
            >
              Exit Read Mode
            </button>
            {!showToolbar && (
              <button
                onClick={() => setShowToolbar(true)}
                className="px-2 py-1 rounded bg-white border border-navy-200 hover:bg-navy-100 text-xs"
              >
                Show Toolbar
              </button>
            )}
          </div>
        )}
        {/* Header */}
        {!readMode && (
          <div className="flex items-center justify-between p-3 border-b border-navy-200 bg-navy-50">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getFileTypeConfig(item).bg}`}>
                <Icon name={getFileTypeConfig(item).icon} size={20} className={getFileTypeConfig(item).color} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-navy-900">{item.name}</h3>
                <p className="text-xs text-navy-500">{formatSize(item.size)} • {formatDate(item.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setReadMode(!readMode)}
                className="p-1.5 hover:bg-white/60 rounded text-sm"
                title="Read Mode"
              >
                <Icon name="eye" size={16} />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 hover:bg-white/60 rounded text-sm"
                title="Toggle Fullscreen"
              >
                <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
              </button>
              <button
                onClick={() => setShowToolbar(prev => !prev)}
                className="p-1.5 hover:bg-white/60 rounded text-sm"
                title={showToolbar ? 'Hide Toolbar' : 'Show Toolbar'}
              >
                <Icon name={showToolbar ? 'eyeOff' : 'eye'} size={16} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-red-100 rounded text-sm font-bold"
                title="Close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>
        )}

        {!readMode && !showToolbar && (
          <div className="px-3 py-2 border-b border-navy-200 bg-navy-50 text-xs flex items-center gap-2">
            <span className="text-navy-600">Toolbar hidden</span>
            <button
              onClick={() => setShowToolbar(true)}
              className="px-2 py-1 rounded bg-white border border-navy-200 hover:bg-navy-100"
            >
              Show Toolbar
            </button>
          </div>
        )}

        {/* Main Toolbar */}
        {!readMode && showToolbar && (
          <div className="pdf-toolbar-row text-xs">
            {/* Edit Mode (Text files) */}
            {isText && !isCSV && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`pdf-toolbar-btn ${isEditMode ? 'pdf-toolbar-btn-active' : ''}`}
              >
                <Icon name={isEditMode ? 'eye' : 'edit'} size={12} />
                {isEditMode ? 'View' : 'Edit'}
              </button>
            )}

            {/* Edit Mode (DOCX files) */}
            {isWord && (
              <button
                onClick={() => {
                  if (!docxEditMode) {
                    setDocxEditableContent(wordContent);
                  }
                  setDocxEditMode(!docxEditMode);
                }}
                className={`pdf-toolbar-btn ${docxEditMode ? 'pdf-toolbar-btn-active' : ''}`}
              >
                <Icon name={docxEditMode ? 'eye' : 'edit'} size={12} />
                {docxEditMode ? 'View' : 'Edit'}
              </button>
            )}

            {/* Unsaved Changes Indicator */}
            {hasUnsavedChanges && (isEditMode || docxEditMode) && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-medium animate-pulse shrink-0">
                ● Unsaved
              </span>
            )}

            {/* Image Tools */}
            {isImage && (
              <>
                <button onClick={handleRotateLeft} className="pdf-toolbar-btn" title="Rotate Left">
                  <Icon name="rotateLeft" size={14} />
                </button>
                <button onClick={handleRotateRight} className="pdf-toolbar-btn" title="Rotate Right">
                  <Icon name="rotateRight" size={14} />
                </button>
                <button onClick={handleFlipHorizontal} className="pdf-toolbar-btn" title="Flip Horizontal">
                  <Icon name="flipHorizontal" size={14} />
                </button>
                <button onClick={handleFlipVertical} className="pdf-toolbar-btn" title="Flip Vertical">
                  <Icon name="flipVertical" size={14} />
                </button>
                <button onClick={() => setShowExif(!showExif)} className="pdf-toolbar-btn" title="EXIF Data">
                  <Icon name="info" size={14} /> EXIF
                </button>
                <button onClick={() => setCropMode(!cropMode)} className="pdf-toolbar-btn" title="Crop">
                  <Icon name="cut" size={14} /> Crop
                </button>
                <button onClick={() => setSlideshowActive(!slideshowActive)} className="pdf-toolbar-btn" title="Slideshow">
                  <Icon name="image" size={14} /> Slideshow
                </button>
                <button onClick={handleResetImage} className="pdf-toolbar-btn bg-amber-100 hover:bg-amber-200 border-amber-200" title="Reset All">
                  <Icon name="refresh" size={14} /> Reset
                </button>
                <div className="h-4 w-px bg-navy-300 mx-1 shrink-0"></div>
              </>
            )}

            {/* Text File Tools */}
            {(isText || isCSV) && !isEditMode && (
              <>
                <button onClick={() => setShowLineNumbers(!showLineNumbers)} className={`pdf-toolbar-btn ${showLineNumbers ? 'pdf-toolbar-btn-active' : ''}`}>
                  <Icon name="lineNumbers" size={14} /> Lines
                </button>
                <button onClick={() => setWordWrap(!wordWrap)} className={`pdf-toolbar-btn ${wordWrap ? 'pdf-toolbar-btn-active' : ''}`}>
                  <Icon name="wordWrap" size={14} /> Wrap
                </button>
                <select value={encoding} onChange={(e) => setEncoding(e.target.value)} className="h-9 px-2 rounded-md bg-navy-100 border border-navy-100 text-xs shrink-0">
                  <option>UTF-8</option>
                  <option>UTF-16</option>
                  <option>ASCII</option>
                  <option>ISO-8859-1</option>
                </select>
                <div className="h-4 w-px bg-navy-300 mx-1 shrink-0"></div>
              </>
            )}

            {/* PDF Tools */}
            {isPDF && (
              <>
                <button onClick={() => setShowThumbnails(!showThumbnails)} className={`pdf-toolbar-btn ${showThumbnails ? 'pdf-toolbar-btn-active' : ''}`}>
                  <Icon name="thumbnails" size={14} /> Thumbnails
                </button>
                <button onClick={() => handleRotatePage(90)} className="pdf-toolbar-btn">
                  <Icon name="rotate" size={14} /> Rotate
                </button>
                <button onClick={() => handleOpenPowerTools('extract')} className="pdf-toolbar-btn">
                  <Icon name="document" size={14} /> Extract
                </button>
                <button onClick={() => handleOpenPowerTools('merge')} className="pdf-toolbar-btn">
                  <Icon name="merge" size={14} /> Merge
                </button>
                <button onClick={() => handleOpenPowerTools('split')} className="pdf-toolbar-btn">
                  <Icon name="split" size={14} /> Split
                </button>
                <button
                  onClick={() => setShowAnnotationToolbar(prev => !prev)}
                  className={`pdf-toolbar-btn ${showAnnotationToolbar ? 'pdf-toolbar-btn-active' : ''}`}
                  title="Show or hide annotation tools"
                >
                  <Icon name="edit" size={14} /> Annotations
                </button>
                <div className="h-4 w-px bg-navy-300 mx-1 shrink-0"></div>
              </>
            )}

            {/* PowerPoint Tools */}
            {isPowerPoint && (
              <>
                <button onClick={() => setSlideshowMode(!slideshowMode)} className="px-2 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 flex items-center gap-1">
                  <Icon name="play" size={14} /> Slideshow
                </button>
                <button
                  onClick={() => setSlideIndex(prev => Math.max(0, prev - 1))}
                  className="tool-btn flex items-center gap-1"
                >
                  <Icon name="prev" size={14} /> Prev
                </button>
                <span className="px-2 text-xs font-medium text-navy-700">{slideIndex + 1}/{slideCount}</span>
                <button
                  onClick={() => setSlideIndex(prev => Math.min(slideCount - 1, prev + 1))}
                  className="tool-btn flex items-center gap-1"
                >
                  Next <Icon name="next" size={14} />
                </button>
                <button onClick={() => setShowThumbnails(!showThumbnails)} className={`tool-btn flex items-center gap-1 ${showThumbnails ? 'bg-navy-100' : ''}`}>
                  <Icon name="thumbnails" size={14} /> Slides
                </button>
                <div className="h-4 w-px bg-navy-300 mx-1"></div>
              </>
            )}

            {/* Search */}
            {!isMedia && (
              <button onClick={() => setShowSearch(true)} className="pdf-toolbar-btn">
                <Icon name="search" size={14} /> Find
              </button>
            )}

            {(isEditMode || docxEditMode) && (
              <>
                <button onClick={handleUndo} className="pdf-toolbar-btn" title="Undo">
                  <Icon name="undo" size={14} /> Undo
                </button>
                <button onClick={handleRedo} className="pdf-toolbar-btn" title="Redo">
                  <Icon name="redo" size={14} /> Redo
                </button>
              </>
            )}

            {!isMedia && (
              <>
                <div className="h-4 w-px bg-navy-300 mx-1 shrink-0"></div>

                {/* Zoom Controls */}
                <button onClick={handleZoomOut} className="pdf-toolbar-btn">
                  <Icon name="minus" size={14} />
                </button>
                <span className="px-2 text-xs font-medium min-w-[56px] text-center shrink-0 leading-9">{zoomLevel}%</span>
                <button onClick={handleZoomIn} className="pdf-toolbar-btn">
                  <Icon name="plus" size={14} />
                </button>

                {/* View Mode Buttons */}
                <div className="flex gap-1 ml-2">
                  <button onClick={handleZoomFitWidth} className={`pdf-toolbar-btn ${viewMode === 'fit-width' ? 'pdf-toolbar-btn-active' : ''}`} title="Fit to Width">
                    <Icon name="fitWidth" size={14} />
                  </button>
                  <button onClick={handleZoomFitPage} className={`pdf-toolbar-btn ${viewMode === 'fit-page' ? 'pdf-toolbar-btn-active' : ''}`} title="Fit to Page">
                    <Icon name="fitPage" size={14} />
                  </button>
                  <button onClick={handleZoomActual} className={`pdf-toolbar-btn ${viewMode === 'actual-size' ? 'pdf-toolbar-btn-active' : ''}`} title="Actual Size">
                    1:1
                  </button>
                </div>

                <div className="h-4 w-px bg-navy-300 mx-1 shrink-0"></div>
              </>
            )}

            {/* Display Mode */}
            {(isPDF || isWord) && (
              <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value)} className="h-9 px-2 rounded-md bg-gray-100 border border-navy-100 text-xs shrink-0">
                <option value="single">Single Page</option>
                <option value="continuous">Continuous</option>
                {isWord && <option value="multi">Multi Page</option>}
              </select>
            )}

            {/* Save Options (Edit Mode) */}
            {(isEditMode || docxEditMode) && (
              <div className="relative">
                <div className="flex shrink-0">
                  <button
                    onClick={handleSave}
                    className="h-9 px-3 rounded-l-md bg-green-600 text-white hover:bg-green-700 font-medium flex items-center gap-1 text-xs"
                  >
                    <Icon name="save" size={14} /> Save
                  </button>
                  <button
                    onClick={() => setShowSaveMenu(!showSaveMenu)}
                    className="h-9 px-2 rounded-r-md bg-green-700 text-white hover:bg-green-800 border-l border-green-500"
                  >
                    <Icon name="chevronDown" size={12} />
                  </button>
                </div>
                {showSaveMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-navy-200 rounded-lg shadow-lg z-50 min-w-[180px]">
                    <button
                      onClick={() => { handleSave(); setShowSaveMenu(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-navy-50 flex items-center gap-2 text-sm"
                    >
                      <Icon name="save" size={14} /> {docxEditMode ? 'Save (Create Edited File)' : 'Save (Replace File)'}
                    </button>
                    <button
                      onClick={() => { setShowSaveAsNewFileDialog(true); setNewFileName(''); setShowSaveMenu(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-navy-50 flex items-center gap-2 text-sm"
                    >
                      <Icon name="filePlus" size={14} /> Save as New File
                    </button>
                    <button
                      onClick={() => { setShowSaveAsDialog(true); setShowSaveMenu(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-navy-50 flex items-center gap-2 text-sm"
                    >
                      <Icon name="copy" size={14} /> Save as Copy
                    </button>
                    <button
                      onClick={() => { setShowVersionSaveDialog(true); setShowSaveMenu(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-navy-50 flex items-center gap-2 text-sm"
                    >
                      <Icon name="pin" size={14} /> Save as New Version
                    </button>
                    <div className="border-t border-navy-100"></div>
                    <button
                      onClick={() => { handleShowVersionHistory(); setShowSaveMenu(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-navy-50 flex items-center gap-2 text-sm"
                    >
                      <Icon name="version" size={14} /> Version History ({versionCount})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Version History Button (View Mode) */}
            {!isEditMode && !docxEditMode && (isText || isWord) && (
              <button
                onClick={handleShowVersionHistory}
                className="pdf-toolbar-btn bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-200"
                title="Version History"
              >
                <Icon name="version" size={14} /> Versions {versionCount > 0 && `(${versionCount})`}
              </button>
            )}

            {/* Download */}
            <button onClick={() => onDownload?.(item.id)} className="pdf-toolbar-btn">
              <Icon name="download" size={14} /> Download
            </button>

            {/* Power Tools Button */}
            {!isMedia && (
              <button 
                onClick={() => handleOpenPowerTools('main')}
                className="pdf-toolbar-btn bg-gradient-to-r from-navy-700 to-purple-600 text-white border-transparent hover:from-navy-800 hover:to-purple-700"
                title="Power Tools - docked sidebar"
              >
                <Icon name="settings" size={14} /> Power Tools
              </button>
            )}

            {/* Print */}
            {!isMedia && (
              <button onClick={() => setPrintPreview(!showPrintPreview)} className="pdf-toolbar-btn">
                <Icon name="print" size={14} /> Print
              </button>
            )}

            {/* Share */}
            <button onClick={() => onShare?.()} className="pdf-toolbar-btn">
              <Icon name="share" size={14} /> Share
            </button>

            <div className="flex-1"></div>

            {/* Right Panel Toggle */}
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className={`pdf-toolbar-btn ${showRightPanel ? 'pdf-toolbar-btn-active' : ''}`}
            >
              <Icon name={showRightPanel ? 'prev' : 'next'} size={14} /> Panel
            </button>

            {/* Power Dock Toggle Button */}
            {!isMedia && (
              <button
                onClick={() => {
                  if (showPowerSidebar) {
                    setShowPowerSidebar(false);
                  } else {
                    handleOpenPowerTools(powerSidebarSection || 'main');
                  }
                }}
                className="pdf-toolbar-btn bg-gradient-to-r from-purple-600 to-purple-700 text-white border-transparent hover:from-purple-700 hover:to-purple-800"
                title={showPowerSidebar ? 'Hide Power Tools sidebar' : 'Show Power Tools sidebar'}
              >
                <Icon name={showPowerSidebar ? 'chevronRight' : 'chevronLeft'} size={14} /> 
                {showPowerSidebar ? 'Hide Dock' : 'Power Dock'}
              </button>
            )}
          </div>
        )}

        {/* Annotation Toolbar */}
        {!readMode && isPDF && showAnnotationToolbar && (
          <div className="pdf-annotation-toolbar">
            <span className="font-semibold text-navy-700 text-xs flex items-center gap-1">
              <Icon name="edit" size={12} /> Annotations:
            </span>
            
            <button
              onClick={() => setAnnotationTool(annotationTool === 'highlight' ? null : 'highlight')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'highlight' ? 'bg-yellow-400 text-black border-yellow-400' : ''}`}
            >
              <Icon name="highlight" size={12} /> Highlight
            </button>
            <button
              onClick={() => setAnnotationTool(annotationTool === 'underline' ? null : 'underline')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'underline' ? 'bg-blue-400 text-white border-blue-400' : ''}`}
            >
              <Icon name="underline" size={12} /> Underline
            </button>
            <button
              onClick={() => setAnnotationTool(annotationTool === 'strikethrough' ? null : 'strikethrough')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'strikethrough' ? 'bg-red-400 text-white border-red-400' : ''}`}
            >
              <Icon name="strikethrough" size={12} /> Strike
            </button>
            <button
              onClick={() => setAnnotationTool(annotationTool === 'draw' ? null : 'draw')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'draw' ? 'bg-purple-400 text-white border-purple-400' : ''}`}
            >
              <Icon name="draw" size={12} /> Draw
            </button>
            <button
              onClick={() => setAnnotationTool(annotationTool === 'arrow' ? null : 'arrow')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'arrow' ? 'bg-green-400 text-white border-green-400' : ''}`}
            >
              <Icon name="arrowRight" size={12} /> Arrow
            </button>
            <button
              onClick={() => setAnnotationTool(annotationTool === 'rectangle' ? null : 'rectangle')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'rectangle' ? 'bg-indigo-400 text-white border-indigo-400' : ''}`}
            >
              <Icon name="rectangle" size={12} /> Rect
            </button>
            <button
              onClick={() => setAnnotationTool(annotationTool === 'text' ? null : 'text')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'text' ? 'bg-cyan-400 text-white border-cyan-400' : ''}`}
            >
              <Icon name="textNote" size={12} /> Text
            </button>
            <button
              onClick={() => setAnnotationTool(annotationTool === 'sticky' ? null : 'sticky')}
              className={`pdf-toolbar-btn h-8 px-2 ${annotationTool === 'sticky' ? 'bg-pink-400 text-white border-pink-400' : ''}`}
            >
              <Icon name="stickyNote" size={12} /> Sticky
            </button>

            <div className="h-4 w-px bg-navy-300 mx-2 shrink-0"></div>

            {/* Color Picker */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-navy-600">Color:</span>
              {['#ffeb3b', '#ff9800', '#4caf50', '#2196f3', '#9c27b0', '#f44336'].map(color => (
                <button
                  key={color}
                  onClick={() => setAnnotationColor(color)}
                  className={`w-5 h-5 rounded-full border-2 ${annotationColor === color ? 'border-navy-900 scale-110' : 'border-navy-300'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-navy-300 mx-2 shrink-0"></div>

            <button
              onClick={() => setShowAnnotations(!showAnnotations)}
              className={`pdf-toolbar-btn h-8 px-2 ${showAnnotations ? 'bg-green-100 border-green-200' : ''}`}
            >
              <Icon name={showAnnotations ? 'eye' : 'eyeOff'} size={12} /> {showAnnotations ? 'Hide' : 'Show'}
            </button>
            
            <button onClick={handleExportAnnotations} className="pdf-toolbar-btn h-8 px-2">
              <Icon name="export" size={12} /> Export
            </button>
            
            <button onClick={() => alert('Flatten annotations into document')} className="pdf-toolbar-btn h-8 px-2">
              <Icon name="flatten" size={12} /> Flatten
            </button>
          </div>
        )}

        {/* Image Adjustment Controls */}
        {isImage && !readMode && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <label className="font-medium text-gray-700 text-xs">Brightness:</label>
              <input
                type="range"
                min="0"
                max="200"
                value={imageBrightness}
                onChange={(e) => setImageBrightness(e.target.value)}
                className="w-20"
              />
              <span className="text-xs text-gray-600 w-10">{imageBrightness}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="font-medium text-gray-700 text-xs">Contrast:</label>
              <input
                type="range"
                min="0"
                max="200"
                value={imageContrast}
                onChange={(e) => setImageContrast(e.target.value)}
                className="w-20"
              />
              <span className="text-xs text-gray-600 w-10">{imageContrast}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="font-medium text-gray-700 text-xs">Saturation:</label>
              <input
                type="range"
                min="0"
                max="200"
                value={imageSaturation}
                onChange={(e) => setImageSaturation(e.target.value)}
                className="w-20"
              />
              <span className="text-xs text-gray-600 w-10">{imageSaturation}%</span>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {showSearch && (
          <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in document... (Ctrl+F)"
              className="flex-1 px-3 py-1.5 border border-navy-200 rounded-md text-sm"
              autoFocus
            />
            <button className="tool-btn" onClick={() => handleSearchNavigation('prev')}>
              <Icon name="chevronUp" size={14} />
            </button>
            <button className="tool-btn" onClick={() => handleSearchNavigation('next')}>
              <Icon name="chevronDown" size={14} />
            </button>
            <button onClick={() => setShowSearch(false)} className="tool-btn">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {!showPowerSidebar && (
            <button
              onClick={() => handleOpenPowerTools(powerSidebarSection || 'main')}
              className="absolute top-1/2 -right-3 z-20 -translate-y-1/2 bg-white border border-navy-200 shadow-md rounded-full w-10 h-10 flex items-center justify-center hover:bg-navy-50"
              title="Open Power Tools"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
          )}
          {/* Left Thumbnail Panel */}
          {showThumbnails && (isPDF || isPowerPoint) && (
            <div className="w-40 border-r border-navy-200 bg-navy-50 overflow-y-auto p-2">
              <div className="text-xs font-semibold text-navy-700 mb-2 flex items-center gap-1">
                <Icon name="document" size={12} /> Pages
              </div>
              {Array.from({ length: isPDF ? (totalPages || 5) : slideCount }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => isPDF ? setCurrentPage(i + 1) : setSlideIndex(i)}
                  className={`mb-2 p-1 border-2 rounded cursor-pointer ${(isPDF ? currentPage : slideIndex) === (i + 1) ? 'border-navy-600 bg-navy-100' : 'border-navy-200 bg-white hover:border-navy-400'}`}
                >
                  <div className="aspect-[3/4] bg-navy-100 flex items-center justify-center text-xs text-navy-500">
                    Page {i + 1}
                  </div>
                  <div className="text-[10px] text-center mt-1 text-navy-600">{i + 1}</div>
                </div>
              ))}
            </div>
          )}

          {/* Content Viewer */}
          <div
            ref={canvasContainerRef}
            className={`flex-1 min-h-0 ${isVideo || isAudio ? 'overflow-hidden' : 'overflow-auto'} bg-navy-100 p-0 relative`}
            onMouseUp={handleTextSelection}
            onClick={handleViewerClick}
          >
            {isPDF ? (
              <div className="mx-auto bg-white shadow-lg flex-1">
                {pdfRendering ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin text-4xl mb-4 flex justify-center">
                        <Icon name="refresh" size={40} className="text-navy-600" />
                      </div>
                      <p className="text-navy-600">Loading PDF...</p>
                    </div>
                  </div>
                ) : pdfDoc ? (
                  <div className="flex flex-col items-center p-4">
                    <canvas ref={canvasRef} className="shadow-md max-w-full"></canvas>
                  </div>
                ) : pdfError && (driveReconnectUrl || pdfErrorDetail) ? (
                  <div className="flex items-center justify-center min-h-[420px] p-8">
                    <div className="max-w-md text-center space-y-3">
                      <Icon name="warning" size={34} className="text-amber-500 mx-auto" />
                      <p className="text-navy-700 font-medium">Unable to load PDF from Google Drive</p>
                      <p className="text-sm text-navy-500">
                        {pdfErrorDetail || 'Drive authorization may have expired for this account.'}
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        {driveReconnectUrl ? (
                          <button
                            onClick={() => window.location.href = driveReconnectUrl}
                            className="px-3 py-1.5 rounded-md bg-navy-700 text-white text-sm hover:bg-navy-800 transition-colors"
                          >
                            Reconnect Drive
                          </button>
                        ) : (
                          <button
                            disabled={driveReconnectLoading}
                            onClick={() => resolveDriveReconnect(pdfErrorDetail)}
                            className="px-3 py-1.5 rounded-md border border-navy-300 text-navy-700 text-sm hover:bg-navy-50 disabled:opacity-60 transition-colors"
                          >
                            {driveReconnectLoading ? 'Checking Drive link...' : 'Check Drive connection'}
                          </button>
                        )}
                        {item?.id && (
                          <button
                            onClick={() => loadPDFFromBackend(item.id)}
                            className="px-3 py-1.5 rounded-md border border-navy-300 text-navy-700 text-sm hover:bg-navy-50 transition-colors"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : useFallbackViewer && resolvedPreviewUrl ? (
                  /* Fallback: Use iframe to display PDF */
                  <div className="w-full h-full min-h-[700px]">
                    <iframe
                      src={resolvedPreviewUrl}
                      className="w-full h-full min-h-[700px] border-0"
                      title={item?.name || 'PDF Document'}
                      style={{ 
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: 'top center'
                      }}
                    />
                  </div>
                ) : resolvedPreviewUrl ? (
                  /* Direct embed for PDF */
                  <div className="w-full h-full min-h-[700px]">
                    <object
                      data={resolvedPreviewUrl}
                      type="application/pdf"
                      className="w-full h-full min-h-[700px]"
                    >
                      <iframe
                        src={resolvedPreviewUrl}
                        className="w-full h-full min-h-[700px] border-0"
                        title={item?.name || 'PDF Document'}
                      />
                    </object>
                  </div>
                ) : (
                  <div className="flex items-center justify-center min-h-[600px] p-8">
                    <div className="text-center">
                      <div className="animate-spin text-4xl mb-4 flex justify-center">
                        <Icon name="refresh" size={40} className="text-red-400" />
                      </div>
                      <p className="text-gray-600 mb-3">Loading PDF preview...</p>
                      {item?.id && (
                        <button
                          onClick={() => loadPDFFromBackend(item.id)}
                          className="px-3 py-1.5 rounded-md border border-navy-300 text-navy-700 text-sm hover:bg-navy-50 transition-colors"
                        >
                          Retry Load
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : isWord ? (
              <div className={`mx-auto bg-white shadow-lg p-8 ${displayMode === 'multi' ? 'max-w-7xl' : 'max-w-4xl'}`} style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
                {wordPreviewError && (
                  <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">Failed to load document</p>
                        <p className="text-xs text-rose-700 mt-1">{wordPreviewError}</p>
                      </div>
                      <div className="flex gap-2">
                        {driveReconnectUrl && (
                          <button
                            onClick={() => window.location.href = driveReconnectUrl}
                            className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs hover:bg-rose-700 transition-colors"
                          >
                            Reconnect Drive
                          </button>
                        )}
                        {item?.id && (
                          <button
                            onClick={() => loadWordFromBackend(item.id)}
                            className="px-3 py-1.5 rounded-md border border-rose-300 text-rose-700 text-xs hover:bg-rose-100 transition-colors"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {wordLoading ? (
                  <div className="flex items-center justify-center min-h-[600px]">
                    <div className="text-center">
                      <div className="animate-spin text-4xl mb-4 flex justify-center">
                        <Icon name="refresh" size={40} className="text-navy-600" />
                      </div>
                      <p className="text-navy-600">Loading Word document...</p>
                    </div>
                  </div>
                ) : docxEditMode ? (
                  /* DOCX Inline Editor */
                  <div className="min-h-[600px]">
                    <div className="mb-3 flex items-center justify-between bg-navy-50 p-2 rounded-lg">
                      <span className="text-sm text-navy-700 font-medium flex items-center gap-1">
                        <Icon name="edit" size={14} /> Editing Mode - Save creates an edited DOCX file
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (docxEditorRef.current) {
                              document.execCommand('bold');
                            }
                          }}
                          className="px-2 py-1 bg-white rounded border hover:bg-gray-50 font-bold"
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          onClick={() => {
                            if (docxEditorRef.current) {
                              document.execCommand('italic');
                            }
                          }}
                          className="px-2 py-1 bg-white rounded border hover:bg-gray-50 italic"
                          title="Italic"
                        >
                          I
                        </button>
                        <button
                          onClick={() => {
                            if (docxEditorRef.current) {
                              document.execCommand('underline');
                            }
                          }}
                          className="px-2 py-1 bg-white rounded border hover:bg-gray-50 underline"
                          title="Underline"
                        >
                          U
                        </button>
                        <div className="w-px bg-gray-300 mx-1"></div>
                        <button
                          onClick={() => {
                            if (docxEditorRef.current) {
                              document.execCommand('insertUnorderedList');
                            }
                          }}
                          className="px-2 py-1 bg-white rounded border hover:bg-gray-50"
                          title="Bullet List"
                        >
                          •
                        </button>
                        <button
                          onClick={() => {
                            if (docxEditorRef.current) {
                              document.execCommand('insertOrderedList');
                            }
                          }}
                          className="px-2 py-1 bg-white rounded border hover:bg-gray-50"
                          title="Numbered List"
                        >
                          1.
                        </button>
                      </div>
                    </div>
                    <div
                      ref={docxEditorRef}
                      contentEditable
                      className={`prose max-w-none min-h-[500px] p-4 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white ${displayMode === 'multi' ? 'columns-2 gap-8' : ''}`}
                      suppressContentEditableWarning
                      onInput={(e) => setDocxEditableContent(e.currentTarget.innerHTML)}
                      onBlur={(e) => setDocxEditableContent(e.currentTarget.innerHTML)}
                    />
                  </div>
                ) : (wordArrayBuffer && !wordPreviewError) ? (
                  <div ref={docxPreviewRef} className="w-full" />
                ) : wordContent ? (
                  <div
                    className={`prose max-w-none ${displayMode === 'multi' ? 'columns-2 gap-8' : ''}`}
                    dangerouslySetInnerHTML={{ __html: wordContent }}
                    onMouseUp={handleTextSelection}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Word document preview not available. Please download to view.</p>
                  </div>
                )}
              </div>
            ) : isPowerPoint ? (
              <div className={`mx-auto bg-white shadow-lg ${slideshowMode ? 'w-full h-full' : ''}`} style={{ transform: slideshowMode ? 'none' : `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
                <div className={`${slideshowMode ? 'h-full' : 'min-h-[600px]'} p-8`}>
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                      <Icon name="powerpoint" size={40} className="text-orange-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-navy-900">{item.name}</h2>
                    <p className="text-navy-600">PowerPoint Presentation</p>
                    {slideshowMode ? (
                      <div className="mt-8">
                        <div className="text-4xl font-bold mb-4">Slide {slideIndex + 1}</div>
                        <p className="text-navy-500 text-sm">Use arrow keys to navigate</p>
                      </div>
                    ) : (
                      <div className="mt-8 p-6 bg-navy-50 rounded-lg">
                        <p className="text-sm text-navy-700 mb-4">
                          PowerPoint preview is not available in the browser.
                        </p>
                        <button
                          onClick={() => setSlideshowMode(true)}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium mr-2 inline-flex items-center gap-2"
                        >
                          <Icon name="play" size={16} /> Start Slideshow
                        </button>
                        <button
                          onClick={() => onDownload?.(item.id)}
                          className="px-6 py-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 font-medium inline-flex items-center gap-2"
                        >
                          <Icon name="download" size={16} /> Download to View
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : isExcel ? (
              <div className="mx-auto w-full">
                {excelSourceBlob ? (
                  <ExcelWorkbench
                    item={item}
                    sourceBlob={excelSourceBlob}
                    onCreateDerivedFile={handleCreateDerivedFile}
                  />
                ) : excelLoadError ? (
                  <div className="bg-white shadow-lg p-8 min-h-[420px] flex items-center justify-center">
                    <div className="text-center space-y-3 max-w-md">
                      <p className="text-sm font-semibold text-rose-700">Unable to load workbook</p>
                      <p className="text-xs text-rose-600">{excelLoadError}</p>
                      <button
                        onClick={() => onDownload?.(item.id)}
                        className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs"
                      >
                        Download Workbook
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white shadow-lg p-8 min-h-[420px] flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="animate-spin text-3xl flex justify-center">
                        <Icon name="refresh" size={32} className="text-green-500" />
                      </div>
                      <p className="text-sm text-navy-700">{excelLoading ? 'Loading workbook...' : 'Preparing workbook...'}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : isEditMode && isText ? (
              <div className="mx-auto bg-white shadow-lg" style={{ width: '100%' }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onMouseUp={handleTextSelection}
                  className="w-full min-h-[800px] p-8 font-mono text-sm outline-none resize-none"
                  style={{ lineHeight: '1.6' }}
                />
              </div>
            ) : isCSV ? (
              <div className="mx-auto w-full">
                <CsvWorkbench
                  item={item}
                  csvText={resolvedTextContent}
                  onCreateDerivedFile={handleCreateDerivedFile}
                />
              </div>
            ) : isImage ? (
              <div className="mx-auto w-full">
                <ImageWorkbench
                  item={item}
                  src={resolvedPreviewUrl || item.preview || '/placeholder-image.png'}
                  zoomLevel={zoomLevel}
                  onCreateDerivedFile={handleCreateDerivedFile}
                />
              </div>
            ) : isVideo ? (
              /* Video Player with Controls */
              <div id="video-container" className="flex flex-col items-center justify-center h-full min-h-[420px] p-2 md:p-4 bg-black">
                <div className="relative w-full h-full max-w-5xl max-h-[calc(100vh-230px)] flex items-center justify-center">
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                    <button
                      onClick={() => onDownload?.(item.id)}
                      className="px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => onShare?.()}
                      className="px-2 py-1 rounded bg-white/90 text-xs font-medium hover:bg-white"
                    >
                      Share
                    </button>
                    <button
                      onClick={() => onDelete?.()}
                      className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-medium hover:bg-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                  <video
                    ref={videoRef}
                    src={resolvedPreviewUrl}
                    className="max-w-full max-h-[calc(100vh-260px)] w-auto h-auto object-contain rounded-lg shadow-2xl"
                    onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.target.duration)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onClick={togglePlayPause}
                  />
                  
                  {/* Video Controls Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
                    {/* Progress Bar */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-white text-xs font-mono min-w-[40px]">{formatTime(currentTime)}</span>
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <span className="text-white text-xs font-mono min-w-[40px]">{formatTime(duration)}</span>
                    </div>
                    
                    {/* Control Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Skip Back */}
                        <button onClick={() => skipBackward(10)} className="text-white hover:text-pink-300 transition-colors">
                          <Icon name="skipBack" size={20} />
                        </button>
                        
                        {/* Play/Pause */}
                        <button onClick={togglePlayPause} className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                          <Icon name={isPlaying ? 'pause' : 'play'} size={24} className="text-black" />
                        </button>
                        
                        {/* Skip Forward */}
                        <button onClick={() => skipForward(10)} className="text-white hover:text-pink-300 transition-colors">
                          <Icon name="skipForward" size={20} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Volume Control */}
                        <div className="flex items-center gap-2">
                          <button onClick={toggleMute} className="text-white hover:text-pink-300 transition-colors">
                            <Icon name={isMuted || volume === 0 ? 'volumeX' : 'volume'} size={18} />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer"
                          />
                        </div>
                        
                        {/* Playback Speed */}
                        <select
                          value={playbackRate}
                          onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                          className="bg-white/20 text-white text-xs rounded px-2 py-1 border-0 cursor-pointer"
                        >
                          <option value="0.5">0.5x</option>
                          <option value="0.75">0.75x</option>
                          <option value="1">1x</option>
                          <option value="1.25">1.25x</option>
                          <option value="1.5">1.5x</option>
                          <option value="2">2x</option>
                        </select>
                        
                        {/* Fullscreen */}
                        <button onClick={toggleFullscreenVideo} className="text-white hover:text-pink-300 transition-colors">
                          <Icon name={isFullscreenVideo ? 'minimize' : 'expand'} size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Video Info */}
                <div className="mt-4 text-center">
                  <h3 className="text-white text-lg font-medium">{item.name}</h3>
                  <p className="text-gray-400 text-sm">{formatSize(item.size)}</p>
                </div>
              </div>
            ) : isAudio ? (
              /* Audio Player with Controls */
              <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gradient-to-br from-indigo-900 to-purple-900">
                <div className="w-full max-w-xl bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
                  <div className="mb-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => onDownload?.(item.id)}
                      className="px-2 py-1 rounded bg-white/90 text-xs font-medium text-indigo-900 hover:bg-white"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => onShare?.()}
                      className="px-2 py-1 rounded bg-white/90 text-xs font-medium text-indigo-900 hover:bg-white"
                    >
                      Share
                    </button>
                    <button
                      onClick={() => onDelete?.()}
                      className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-medium hover:bg-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                  {/* Album Art Placeholder */}
                  <div className="w-48 h-48 mx-auto mb-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <Icon name="audio" size={80} className="text-white/80" />
                  </div>
                  
                  {/* Track Info */}
                  <div className="text-center mb-6">
                    <h3 className="text-white text-xl font-bold truncate">{item.name}</h3>
                    <p className="text-indigo-200 text-sm mt-1">{formatSize(item.size)}</p>
                  </div>
                  
                  {/* Audio Element */}
                  <audio
                    ref={audioRef}
                    src={resolvedPreviewUrl}
                    onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.target.duration)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {/* Progress Bar */}
                  <div className="mb-6">
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                    />
                    <div className="flex justify-between text-xs text-indigo-200 mt-2">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  
                  {/* Control Buttons */}
                  <div className="flex items-center justify-center gap-6 mb-6">
                    <button onClick={() => skipBackward(10)} className="text-white/70 hover:text-white transition-colors">
                      <Icon name="skipBack" size={28} />
                    </button>
                    
                    <button 
                      onClick={togglePlayPause} 
                      className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                    >
                      <Icon name={isPlaying ? 'pause' : 'play'} size={32} className="text-indigo-900" />
                    </button>
                    
                    <button onClick={() => skipForward(10)} className="text-white/70 hover:text-white transition-colors">
                      <Icon name="skipForward" size={28} />
                    </button>
                  </div>
                  
                  {/* Volume & Speed Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                        <Icon name={isMuted || volume === 0 ? 'volumeX' : 'volume'} size={20} />
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-24 h-1 bg-white/30 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                    
                    <select
                      value={playbackRate}
                      onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                      className="bg-white/20 text-white text-sm rounded-lg px-3 py-1.5 border-0 cursor-pointer"
                    >
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto bg-white shadow-lg p-4">
                {isText && !isCSV ? renderTextWithLineNumbers(resolvedTextContent) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm p-4">{resolvedTextContent || 'Content not available'}</pre>
                )}
              </div>
            )}

            {showAnnotations && annotations.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {annotations
                  .filter(annotation => annotation.position && (annotation.position.x > 0 || annotation.position.y > 0))
                  .map(annotation => (
                    <div
                      key={`overlay-${annotation.id}`}
                      className="absolute text-[10px] px-2 py-1 rounded shadow border max-w-[180px] truncate"
                      style={{
                        left: `${annotation.position.x}px`,
                        top: `${annotation.position.y}px`,
                        backgroundColor: 'white',
                        borderColor: annotation.color,
                        color: '#0f172a'
                      }}
                    >
                      <span className="font-semibold capitalize mr-1" style={{ color: annotation.color }}>
                        {annotation.type}:
                      </span>
                      {annotation.text}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Right Panel */}
          {showRightPanel && !readMode && (
            <div className="w-72 border-l border-navy-200 bg-white flex flex-col">
              {/* Panel Tabs */}
              <div className="flex items-center border-b border-navy-200 text-xs">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 px-3 py-2 font-medium flex items-center justify-center gap-1 ${activeTab === 'info' ? 'bg-navy-50 text-navy-900 border-b-2 border-navy-900' : 'text-navy-500 hover:bg-navy-50'}`}
                >
                  <Icon name="info" size={12} /> Info
                </button>
                <button
                  onClick={() => setActiveTab('bookmarks')}
                  className={`flex-1 px-3 py-2 font-medium flex items-center justify-center gap-1 ${activeTab === 'bookmarks' ? 'bg-navy-50 text-navy-900 border-b-2 border-navy-900' : 'text-navy-500 hover:bg-navy-50'}`}
                >
                  <Icon name="bookmark" size={12} /> Marks
                </button>
                <button
                  onClick={() => setActiveTab('annotations')}
                  className={`flex-1 px-3 py-2 font-medium flex items-center justify-center gap-1 ${activeTab === 'annotations' ? 'bg-navy-50 text-navy-900 border-b-2 border-navy-900' : 'text-navy-500 hover:bg-navy-50'}`}
                >
                  <Icon name="palette" size={12} /> Notes
                </button>
                <button
                  onClick={() => setShowRightPanel(false)}
                  className="px-2 py-2 text-navy-400 hover:text-navy-700"
                  title="Close panel"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-3">
                {activeTab === 'info' && (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-medium text-navy-500 text-[10px] uppercase">File Name</span>
                      <p className="text-sm text-navy-900 mt-0.5 break-words">{item.name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-navy-500 text-[10px] uppercase">Size</span>
                      <p className="text-sm text-navy-900 mt-0.5">{formatSize(item.size || 0)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-navy-500 text-[10px] uppercase">Type</span>
                      <p className="text-sm text-navy-900 mt-0.5 capitalize">{item.type}</p>
                    </div>
                    <div>
                      <span className="font-medium text-navy-500 text-[10px] uppercase">Modified</span>
                      <p className="text-sm text-navy-900 mt-0.5">{formatDate(item.date)}</p>
                    </div>
                    {isPDF && totalPages > 0 && (
                      <div>
                        <span className="font-medium text-navy-500 text-[10px] uppercase">Pages</span>
                        <p className="text-sm text-navy-900 mt-0.5">{totalPages}</p>
                      </div>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div>
                        <span className="font-medium text-navy-500 text-[10px] uppercase">Tags</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-navy-100 text-navy-700 rounded text-[10px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'bookmarks' && (
                  <div className="space-y-2">
                    <button
                      onClick={handleAddBookmark}
                      className="w-full btn-primary text-xs flex items-center justify-center gap-1"
                    >
                      <Icon name="plus" size={12} /> Add Bookmark
                    </button>
                    <div className="space-y-1.5">
                      {bookmarks.map(bookmark => (
                        <div key={bookmark.id} className="p-2 bg-navy-50 rounded-md flex items-start justify-between">
                          <button
                            onClick={() => handleGoToBookmark(bookmark.page)}
                            className="flex-1 text-left"
                          >
                            <p className="text-xs font-medium text-navy-900">{bookmark.name}</p>
                            <p className="text-[10px] text-navy-500">Page {bookmark.page}</p>
                          </button>
                          <button
                            onClick={() => handleRemoveBookmark(bookmark.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            <Icon name="close" size={12} />
                          </button>
                        </div>
                      ))}
                      {bookmarks.length === 0 && (
                        <p className="text-xs text-navy-500 text-center py-6">No bookmarks yet</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'annotations' && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-medium text-navy-500 uppercase mb-2">Quick Add</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleQuickAnnotationAction('highlight')}
                          className="px-2 py-1.5 rounded-md text-xs bg-yellow-100 hover:bg-yellow-200 flex items-center gap-1"
                        >
                          <Icon name="highlight" size={12} /> Highlight
                        </button>
                        <button
                          onClick={() => handleQuickAnnotationAction('underline')}
                          className="px-2 py-1.5 rounded-md text-xs bg-blue-100 hover:bg-blue-200 flex items-center gap-1"
                        >
                          <Icon name="underline" size={12} /> Underline
                        </button>
                        <button
                          onClick={() => handleQuickAnnotationAction('strikethrough')}
                          className="px-2 py-1.5 rounded-md text-xs bg-red-100 hover:bg-red-200 flex items-center gap-1"
                        >
                          <Icon name="strikethrough" size={12} /> Strike
                        </button>
                        <button
                          onClick={() => handleQuickAnnotationAction('sticky')}
                          className="px-2 py-1.5 rounded-md text-xs bg-pink-100 hover:bg-pink-200 flex items-center gap-1"
                        >
                          <Icon name="stickyNote" size={12} /> Note
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-medium text-navy-500 uppercase mb-2">Instructions</p>
                      <p className="text-[10px] text-navy-600">
                        1. Select a tool from toolbar<br />
                        2. Select text in document<br />
                        3. Annotation applies automatically
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-medium text-navy-500 uppercase">History ({annotations.length})</p>
                      {annotations.map(annotation => (
                        <div key={annotation.id} className="p-2 bg-navy-50 rounded-md text-xs">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-medium capitalize text-[10px]" style={{ color: annotation.color }}>
                              {annotation.type}
                            </span>
                            <button
                              onClick={() => handleRemoveAnnotation(annotation.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              <Icon name="close" size={10} />
                            </button>
                          </div>
                          <p className="text-[11px] text-navy-900 break-words">{annotation.text}</p>
                          <p className="text-[10px] text-navy-500 mt-1">Page {annotation.page}</p>
                        </div>
                      ))}
                      {annotations.length === 0 && (
                        <p className="text-xs text-navy-500 text-center py-6">No annotations yet</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {showPowerSidebar && (
            <div
              className="relative min-w-[320px] max-w-[680px] border-l border-navy-200 bg-white shadow-xl flex flex-col"
              style={{ width: powerSidebarWidth }}
            >
              <div
                className="absolute -left-1 top-0 h-full w-2 cursor-col-resize bg-gradient-to-r from-transparent via-navy-200/60 to-transparent"
                onMouseDown={handleSidebarResizeStart}
                title="Drag to resize"
              />
              <div className="flex items-center justify-between px-3 py-2 border-b border-navy-100 bg-navy-50 text-xs">
                <div className="flex items-center gap-2 font-semibold text-navy-800">
                  <Icon name="zap" size={14} /> Power Tools
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPowerSidebar(false)}
                    className="p-1 rounded hover:bg-white"
                    title="Hide Power Tools"
                  >
                    <Icon name="chevronRight" size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <DocumentPowerTools
                  inline
                  item={powerToolsItem}
                  initialSection={powerSidebarSection}
                  onClose={() => setShowPowerSidebar(false)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation (PDF/Multi-page) */}
        {isPDF && totalPages > 0 && !readMode && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 border-t border-navy-200 bg-navy-50">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="tool-btn disabled:opacity-50 disabled:cursor-not-allowed"
              title="First Page"
            >
              <Icon name="first" size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="tool-btn flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="prev" size={14} /> Previous
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value) || 1;
                  setCurrentPage(Math.max(1, Math.min(totalPages, page)));
                }}
                className="w-14 px-2 py-1 border border-navy-200 rounded text-center text-xs"
              />
              <span className="text-xs text-navy-600">of {totalPages}</span>
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="tool-btn flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <Icon name="next" size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="tool-btn disabled:opacity-50 disabled:cursor-not-allowed"
              title="Last Page"
            >
              <Icon name="last" size={14} />
            </button>
            
            {/* Page Selection */}
            <div className="ml-4 flex items-center gap-2">
              <span className="text-xs text-navy-600">Select:</span>
              <button
                onClick={() => setSelectedPages(prev => 
                  prev.includes(currentPage) ? prev.filter(p => p !== currentPage) : [...prev, currentPage]
                )}
                className={`px-2 py-1 rounded text-xs ${selectedPages.includes(currentPage) ? 'bg-navy-600 text-white' : 'bg-navy-100'}`}
              >
                Page {currentPage}
              </button>
              <span className="text-xs text-navy-500">({selectedPages.length} selected)</span>
            </div>
          </div>
        )}

        {/* Slideshow Navigation (PowerPoint) */}
        {isPowerPoint && slideshowMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-black/80 text-white px-4 py-2 rounded-lg">
            <button
              onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
              disabled={slideIndex === 0}
              className="px-3 py-1.5 rounded disabled:opacity-30 flex items-center gap-1"
            >
              <Icon name="prev" size={14} /> Prev
            </button>
            <span className="px-3 py-1.5">
              Slide {slideIndex + 1} / {slides.length || 5}
            </span>
            <button
              onClick={() => setSlideIndex(Math.min((slides.length || 5) - 1, slideIndex + 1))}
              disabled={slideIndex >= (slides.length || 5) - 1}
              className="px-3 py-1.5 rounded disabled:opacity-30 flex items-center gap-1"
            >
              Next <Icon name="next" size={14} />
            </button>
            <button
              onClick={() => setSlideshowMode(false)}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 ml-4"
            >
              Exit
            </button>
          </div>
        )}

        {/* Save As Copy Dialog */}
        {showSaveAsDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
                <Icon name="copy" size={20} className="text-navy-600" /> Save as Copy
              </h3>
              <p className="text-sm text-navy-600 mb-4">
                Create a new copy of this file with a different name.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-navy-700 mb-1">New file name</label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder={`${item.name.replace(/\.[^.]+$/, '')} (Copy)${item.name.match(/\.[^.]+$/)?.[0] || ''}`}
                  className="input"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowSaveAsDialog(false); setSaveAsName(''); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsCopy}
                  disabled={isSavingAction}
                  className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingAction ? 'Saving...' : 'Save Copy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save as New Version Dialog */}
        {showVersionSaveDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
                <Icon name="pin" size={20} className="text-navy-600" /> Save as New Version
              </h3>
              <p className="text-sm text-navy-600 mb-4">
                Create a new version snapshot of this file.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-navy-700 mb-1">Version Label</label>
                <select
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  className="input"
                >
                  <option value="Draft">Draft</option>
                  <option value="Review">Review</option>
                  <option value="Final">Final</option>
                  <option value="Archive">Archive</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-navy-700 mb-1">Comment (optional)</label>
                <textarea
                  value={versionComment}
                  onChange={(e) => setVersionComment(e.target.value)}
                  placeholder="Describe the changes in this version..."
                  rows={3}
                  className="input"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowVersionSaveDialog(false); setVersionLabel('Draft'); setVersionComment(''); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsNewVersion}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Save Version
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save as New File Dialog */}
        {showSaveAsNewFileDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
                <Icon name="filePlus" size={20} className="text-green-600" /> Save as New File
              </h3>
              <p className="text-sm text-navy-600 mb-4">
                Save your changes as a completely new file. The original file will remain unchanged.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-navy-700 mb-1">New file name</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder={`${item.name.replace(/\.[^.]+$/, '')} (New)${item.name.match(/\.[^.]+$/)?.[0] || ''}`}
                  className="w-full px-3 py-2 border border-navy-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <Icon name="info" size={16} className="text-green-600" />
                  This will create a new file with your changes, keeping the original file intact.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowSaveAsNewFileDialog(false); setNewFileName(''); }}
                  className="px-4 py-2 border border-navy-300 text-navy-700 rounded-lg hover:bg-navy-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsNewFile}
                  disabled={isSavingAction}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Icon name="save" size={16} /> {isSavingAction ? 'Saving...' : 'Save as New File'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
