/**
 * DOCUMENT POWER TOOLS - File-Type Specific Features
 * 
 * PDF Files: Forms, Signatures, Watermark, Background, Pages, Merge, Split, Reorder, Security, Convert
 * Image Files: Images to PDF, Image adjustments
 * DOC/DOCX Files: Doc to PDF
 * TXT Files: Txt to PDF
 * PPT/PPTX Files: PPT to PDF
 */

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as pdfTools from '../utils/pdfPowerTools';
import { Icons } from '../utils/helpers';
import { tokenUtils } from '../utils/authApi';
import { extractErrorText, isDriveAuthError, getDriveReauthorizeUrl } from '../utils/driveRecovery';
import mammoth from 'mammoth';
import { extractZipArchive } from '../utils/compression';
import WordPowerFeaturesPanel from './WordPowerFeaturesPanel';

// Icon component to render SVG icons safely
const Icon = ({ name, size = 18, className = '' }) => {
  const icon = Icons[name];
  if (!icon) return null;
  const sizedIcon = icon.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  return (
    <span 
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: sizedIcon }}
    />
  );
};

// File type specific colors
const FILE_TYPE_COLORS = {
  pdf: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', accent: '#dc2626' },
  image: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', accent: '#7c3aed' },
  doc: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', accent: '#2563eb' },
  text: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', accent: '#64748b' },
  ppt: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', accent: '#ea580c' },
  excel: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', accent: '#16a34a' },
  archive: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: '#b45309' },
  unknown: { bg: 'bg-navy-50', border: 'border-navy-200', text: 'text-navy-600', accent: '#102a43' }
};

// Determine file type category
const getFileCategory = (item) => {
  if (!item) return 'unknown';
  const primaryName = (item.name || item.filename || '').toLowerCase();
  const altName = (
    item.display_name ||
    item.original_name ||
    item.originalFilename ||
    item.file_name ||
    ''
  ).toLowerCase();
  const allNames = `${primaryName} ${altName}`.trim();
  const mimeType = (item.mimeType || item.mime_type || '').toLowerCase();
  const fileType = (item.fileType || item.file_type || '').toLowerCase();

  if (allNames.match(/\.pdf(\b|\s|$)/i) || mimeType.includes('pdf') || fileType.includes('pdf')) return 'pdf';
  if (allNames.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff?)(\b|\s|$)/i) || mimeType.includes('image') || fileType.includes('image')) return 'image';
  if (allNames.match(/\.(docx?|odt)(\b|\s|$)/i) || mimeType.includes('word') || fileType.includes('word') || fileType.includes('document')) return 'doc';
  if (allNames.match(/\.(txt|text|md|markdown|log|ini|cfg|conf|json|xml|yaml|yml|csv)(\b|\s|$)/i) || mimeType.includes('text') || fileType.includes('text')) return 'text';
  if (allNames.match(/\.(pptx?|odp)(\b|\s|$)/i) || mimeType.includes('presentation') || mimeType.includes('powerpoint') || fileType.includes('powerpoint') || fileType.includes('presentation')) return 'ppt';
  if (allNames.match(/\.(xlsx?|ods)(\b|\s|$)/i) || mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileType.includes('excel') || fileType.includes('spreadsheet')) return 'excel';
  if (allNames.match(/\.(zip|rar|7z|tar|gz)(\b|\s|$)/i) || mimeType.includes('zip') || fileType.includes('archive')) return 'archive';
  return 'unknown';
};

export default function DocumentPowerTools({ item, onClose, initialSection = 'main', inline = false }) {
  const { actions } = useApp();
  const fileCategory = getFileCategory(item);
  const [activeSection, setActiveSection] = useState(initialSection || 'main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const signatureCanvasRef = useRef(null);
  const signaturePreviewRef = useRef(null);
  const itemUrlRef = useRef(null);
  const resolvedSourceKeyRef = useRef('');
  const [resolvedItemUrl, setResolvedItemUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [driveReconnectUrl, setDriveReconnectUrl] = useState('');
  const [reconnectLoading, setReconnectLoading] = useState(false);
  const [lastResolveError, setLastResolveError] = useState('');

  // State for various tools
  const [formData, setFormData] = useState({});
  const [formFields, setFormFields] = useState([]);
  const [manualFormField, setManualFormField] = useState({ name: '', value: '' });
  const [visualFill, setVisualFill] = useState({ text: '', page: 1, x: 80, y: 140, size: 12 });
  const [watermarkConfig, setWatermarkConfig] = useState({
    text: 'CONFIDENTIAL',
    opacity: 0.3,
    rotation: 45,
    fontSize: 60,
    color: { r: 0.5, g: 0.5, b: 0.5 },
    allPages: true
  });
  const [signatureData, setSignatureData] = useState(null);
  const [signaturePosition, setSignaturePosition] = useState({ page: 1, x: 100, y: 100, width: 200, height: 80 });
  const [signaturePreviewImage, setSignaturePreviewImage] = useState('');
  const [signatureBox, setSignatureBox] = useState({ xPct: 12, yPct: 68, wPct: 30, hPct: 14 });
  const [signatureDragMode, setSignatureDragMode] = useState(null);
  const [signatureDragStart, setSignatureDragStart] = useState(null);
  const [insertSourceFile, setInsertSourceFile] = useState(null);
  const [insertPosition, setInsertPosition] = useState('end');
  const [insertAtPage, setInsertAtPage] = useState(1);
  const [duplicatePagesInput, setDuplicatePagesInput] = useState('');
  const [duplicateCopies, setDuplicateCopies] = useState(1);
  const [rotatePagesInput, setRotatePagesInput] = useState('');
  const [rotateDegrees, setRotateDegrees] = useState(90);
  const [passwords, setPasswords] = useState({ userPassword: '', ownerPassword: '' });
  const [bgConfig, setBgConfig] = useState({ type: 'color', value: { r: 1, g: 1, b: 0.95 }, opacity: 0.3 });
  const [pageConfig, setPageConfig] = useState({ position: 'end', count: 1, size: 'A4' });
  const [pageIndices, setPageIndices] = useState('');
  const [splitRanges, setSplitRanges] = useState([{ start: 1, end: 5 }]);
  const [pageOrder, setPageOrder] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [extractPagesInput, setExtractPagesInput] = useState('');
  const [extractImageRange, setExtractImageRange] = useState({ start: 1, end: '' });
  const [blankPageMinChars, setBlankPageMinChars] = useState(1);
  const [pageNumberConfig, setPageNumberConfig] = useState({
    startAt: 1,
    prefix: '',
    position: 'bottom-center',
    fontSize: 10,
  });

  const parsePageInput = (value) => {
    const seen = new Set();
    return String(value || '')
      .split(',')
      .map(token => parseInt(token.trim(), 10) - 1)
      .filter(index => !Number.isNaN(index) && index >= 0)
      .filter(index => {
        if (seen.has(index)) return false;
        seen.add(index);
        return true;
      });
  };

  const getTimestampToken = () => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
  };

  const getPdfBaseName = () => {
    const name = String(item?.name || 'document.pdf');
    return name.replace(/\.pdf$/i, '');
  };

  const makePdfOutputName = (operationLabel = 'edited') => {
    const safeLabel = String(operationLabel || 'edited')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'edited';
    return `${getPdfBaseName()}_${safeLabel}_${getTimestampToken()}.pdf`;
  };

  const getMergedFormData = () => {
    const merged = { ...formData };
    const name = String(manualFormField.name || '').trim();
    const value = String(manualFormField.value || '');
    if (name) {
      merged[name] = value;
    }
    return merged;
  };

  const resolveBackendBaseUrl = () => {
    const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
    if (configured) return configured;
    if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return 'http://localhost:8000';
    }
    return '';
  };

  const isBlobUrl = (value) => typeof value === 'string' && value.startsWith('blob:');

  const revokeObjectUrlIfNeeded = (value) => {
    if (isBlobUrl(value)) {
      URL.revokeObjectURL(value);
    }
  };

  const verifyUrlIsReadable = async (value) => {
    if (!value) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(value, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      return !!response?.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const resolveItemUrl = async () => {
    const itemId = item?.id || item?.documentId || item?.document_id || item?.fileId || item?.file_id || null;
    const candidateUrl = item?.dataUrl || item?.url || item?.path || item?.src || item?.preview || '';
    if (candidateUrl) {
      const isCandidateValid = isBlobUrl(candidateUrl)
        ? await verifyUrlIsReadable(candidateUrl)
        : true;

      if (isCandidateValid) {
        itemUrlRef.current = candidateUrl;
        setResolvedItemUrl(candidateUrl);
        setLastResolveError('');
        return candidateUrl;
      }
    }

    if (!itemId) {
      setResolvedItemUrl('');
      setLastResolveError('Document reference missing. Reopen the file from the viewer and retry.');
      return '';
    }

    let lastError = null;
    setIsResolvingUrl(true);
    setDriveReconnectUrl('');

    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { documentOpsApi } = await import('../utils/documentApi');
          const blob = await documentOpsApi.downloadDocument(itemId);

          revokeObjectUrlIfNeeded(itemUrlRef.current);

          const objectUrl = URL.createObjectURL(blob);
          itemUrlRef.current = objectUrl;
          setResolvedItemUrl(objectUrl);
          setLastResolveError('');
          return objectUrl;
        } catch (error) {
          lastError = error;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }

      const authHeaders = {};
      const token = tokenUtils.getAccessToken();
      if (token) {
        authHeaders.Authorization = `Bearer ${token}`;
      }

      const backendBase = resolveBackendBaseUrl();
      const downloadUrls = [
        `/api/v1/documents/${itemId}/download`,
        backendBase ? `${backendBase}/api/v1/documents/${itemId}/download` : null,
      ].filter(Boolean);

      for (const downloadUrl of downloadUrls) {
        try {
          const response = await fetch(downloadUrl, {
            method: 'GET',
            credentials: 'include',
            headers: authHeaders,
          });

          if (!response.ok) {
            let responseText = '';
            let detail = null;
            try {
              const payload = await response.clone().json();
              detail = payload?.detail || null;
              responseText = typeof detail === 'string' ? detail : JSON.stringify(detail || payload);
              const hintedReauth = payload?.detail?.reauthorize_url || payload?.reauthorize_url;
              if (hintedReauth) {
                setDriveReconnectUrl(hintedReauth);
              }
            } catch {
              responseText = await response.text().catch(() => '');
            }

            const reason = responseText || `HTTP ${response.status}`;
            throw new Error(reason);
          }

          const blob = await response.blob();
          revokeObjectUrlIfNeeded(itemUrlRef.current);
          const objectUrl = URL.createObjectURL(blob);
          itemUrlRef.current = objectUrl;
          setResolvedItemUrl(objectUrl);
          setLastResolveError('');
          return objectUrl;
        } catch (error) {
          lastError = error;
        }
      }

      try {
        const { documentsApi } = await import('../utils/api');
        const legacyDoc = await documentsApi.getDocument(itemId);
        const legacyDataUrl = legacyDoc?.data?.dataUrl;
        if (legacyDataUrl) {
          itemUrlRef.current = legacyDataUrl;
          setResolvedItemUrl(legacyDataUrl);
          setLastResolveError('');
          return legacyDataUrl;
        }
      } catch (error) {
        lastError = error;
      }

      console.warn('Failed to resolve file URL for power tools:', lastError);
      const errorText = extractErrorText(lastError) || 'Could not fetch source content for this file.';
      setLastResolveError(errorText);

      if (isDriveAuthError(lastError)) {
        setReconnectLoading(true);
        try {
          const driveIdHint = item?.drive_id || item?.driveId || null;
          const authUrl = await getDriveReauthorizeUrl(driveIdHint);
          if (authUrl) {
            setDriveReconnectUrl(authUrl);
            showMessage('error', 'Google Drive session expired. Reconnect Drive and retry.');
          } else {
            showMessage('error', extractErrorText(lastError) || 'Google Drive authorization is required for this file.');
          }
        } finally {
          setReconnectLoading(false);
        }
      }

      setResolvedItemUrl('');
      return '';
    } finally {
      setIsResolvingUrl(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const sourceKey = [
      item?.id || item?.documentId || item?.document_id || item?.fileId || item?.file_id || '',
      item?.dataUrl || item?.url || item?.path || item?.src || item?.preview || '',
    ].join('|');

    const run = async () => {
      if (sourceKey && sourceKey === resolvedSourceKeyRef.current && (itemUrlRef.current || resolvedItemUrl)) {
        return;
      }

      const url = await resolveItemUrl();
      if (cancelled) return;
      if (!url) {
        setResolvedItemUrl('');
        return;
      }
      resolvedSourceKeyRef.current = sourceKey;
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.documentId, item?.document_id, item?.fileId, item?.file_id, item?.dataUrl, item?.url, item?.path, item?.src, item?.preview, resolvedItemUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrlIfNeeded(itemUrlRef.current);
      itemUrlRef.current = null;
    };
  }, []);

  // Load PDF info on mount
  useEffect(() => {
    if (fileCategory === 'pdf' && resolvedItemUrl) {
      pdfTools.getPDFInfo(resolvedItemUrl).then(info => setPdfInfo(info)).catch(() => {});
      pdfTools.getPDFFormFields(resolvedItemUrl).then(fields => setFormFields(fields)).catch(() => {});
    }
  }, [resolvedItemUrl, fileCategory]);

  useEffect(() => {
    const loadSignaturePreview = async () => {
      if (fileCategory !== 'pdf' || !resolvedItemUrl || activeSection !== 'signature') {
        return;
      }

      try {
        const targetPage = Math.max(1, signaturePosition.page || 1);
        const images = await pdfTools.pdfToImages(resolvedItemUrl, {
          format: 'png',
          scale: 0.9,
          maxPages: 1,
          startPage: targetPage,
          endPage: targetPage,
          maxDimension: 1400,
        });
        setSignaturePreviewImage(images?.[0]?.dataUrl || '');
      } catch {
        setSignaturePreviewImage('');
      }
    };

    loadSignaturePreview();
  }, [fileCategory, resolvedItemUrl, activeSection, signaturePosition.page]);

  useEffect(() => {
    if (fileCategory !== 'pdf' || !pdfInfo?.pageSize) return;
    updateSignaturePositionFromBox(signatureBox);
  }, [fileCategory, pdfInfo?.pageSize?.width, pdfInfo?.pageSize?.height]);

  const updateSignaturePositionFromBox = (nextBox) => {
    const pageWidth = pdfInfo?.pageSize?.width || 595;
    const pageHeight = pdfInfo?.pageSize?.height || 842;
    const x = Math.round((nextBox.xPct / 100) * pageWidth);
    const y = Math.round((nextBox.yPct / 100) * pageHeight);
    const width = Math.round((nextBox.wPct / 100) * pageWidth);
    const height = Math.round((nextBox.hPct / 100) * pageHeight);
    setSignaturePosition((prev) => ({ ...prev, x, y, width, height }));
  };

  const handleSignatureBoxPointerDown = (event, mode = 'move') => {
    const container = signaturePreviewRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setSignatureDragMode(mode);
    setSignatureDragStart({
      startX: event.clientX,
      startY: event.clientY,
      box: { ...signatureBox },
      rect,
    });
  };

  const handleSignaturePreviewPointerMove = (event) => {
    if (!signatureDragMode || !signatureDragStart) return;

    const dxPct = ((event.clientX - signatureDragStart.startX) / signatureDragStart.rect.width) * 100;
    const dyPct = ((event.clientY - signatureDragStart.startY) / signatureDragStart.rect.height) * 100;
    let next = { ...signatureDragStart.box };

    if (signatureDragMode === 'move') {
      next.xPct = Math.max(0, Math.min(100 - next.wPct, signatureDragStart.box.xPct + dxPct));
      next.yPct = Math.max(0, Math.min(100 - next.hPct, signatureDragStart.box.yPct + dyPct));
    }

    if (signatureDragMode === 'resize') {
      next.wPct = Math.max(8, Math.min(70, signatureDragStart.box.wPct + dxPct));
      next.hPct = Math.max(5, Math.min(35, signatureDragStart.box.hPct + dyPct));
      next.xPct = Math.max(0, Math.min(100 - next.wPct, signatureDragStart.box.xPct));
      next.yPct = Math.max(0, Math.min(100 - next.hPct, signatureDragStart.box.yPct));
    }

    setSignatureBox(next);
    updateSignaturePositionFromBox(next);
  };

  const stopSignatureDrag = () => {
    setSignatureDragMode(null);
    setSignatureDragStart(null);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const executeAction = async (actionFn, successMsg) => {
    try {
      setLoading(true);
      await actionFn();
      showMessage('success', successMsg);
    } catch (error) {
      showMessage('error', error.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const getItemUrl = async () => {
    if (itemUrlRef.current) {
      if (!isBlobUrl(itemUrlRef.current)) return itemUrlRef.current;
      const ok = await verifyUrlIsReadable(itemUrlRef.current);
      if (ok) return itemUrlRef.current;
      revokeObjectUrlIfNeeded(itemUrlRef.current);
      itemUrlRef.current = null;
      setResolvedItemUrl('');
    }
    if (resolvedItemUrl) {
      if (!isBlobUrl(resolvedItemUrl)) {
        itemUrlRef.current = resolvedItemUrl;
        return resolvedItemUrl;
      }

      const ok = await verifyUrlIsReadable(resolvedItemUrl);
      if (ok) {
        itemUrlRef.current = resolvedItemUrl;
        return resolvedItemUrl;
      }
    }

    const maxWaitMs = 8000;
    const waitStepMs = 350;
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxWaitMs) {
      if (itemUrlRef.current) return itemUrlRef.current;
      if (resolvedItemUrl) {
        itemUrlRef.current = resolvedItemUrl;
        return resolvedItemUrl;
      }

      const url = await resolveItemUrl();
      if (url) return url;

      if (driveReconnectUrl) {
        throw new Error('Google Drive authorization required. Click Reconnect Drive and retry this operation.');
      }

      if (lastResolveError && /missing|not found|unauthorized|invalid|auth|credential|token/i.test(lastResolveError)) {
        throw new Error(lastResolveError);
      }

      await new Promise(resolve => setTimeout(resolve, waitStepMs));
    }

    throw new Error(lastResolveError || 'Could not load file content for this operation. Please reopen the file and retry.');
  };

  const saveConvertedToStorage = async (content, outputName, mimeType) => {
    const blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType || 'application/octet-stream' });
    const effectiveType = mimeType || blob.type || 'application/octet-stream';

    try {
      const file = new File([blob], outputName, {
        type: effectiveType
      });
      await actions.uploadFile(file, item?.parentId ?? null);
      return true;
    } catch (error) {
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = outputName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      showMessage('success', `Saved as download (${outputName}) because storage upload failed`);
      return true;
    }
  };

  const saveEditedPdfVersion = async (pdfBytes, changeDescription) => {
    const outputName = makePdfOutputName(changeDescription || 'edited');
    await saveConvertedToStorage(pdfBytes, outputName, 'application/pdf');
    return outputName;
  };

  const saveImagesToStorage = async (images = [], folderLabel = 'images') => {
    let folderName = `${item?.name?.replace(/\.[^.]+$/, '') || 'document'}_${folderLabel}_${getTimestampToken()}`;
    let targetFolderId = item?.parentId ?? null;

    try {
      const folder = await actions.createFolder(folderName, item?.parentId ?? null);
      targetFolderId = folder?.id ?? targetFolderId;
      folderName = folder?.name || folderName;
    } catch {
      // Fallback to direct file output if folder creation fails.
    }

    let savedCount = 0;
    for (const image of images || []) {
      if (!image?.dataUrl || !image?.name) continue;
      const imageBlob = await fetch(image.dataUrl).then(res => res.blob());
      try {
        const imageFile = new File([imageBlob], image.name, { type: imageBlob.type || 'image/png' });
        await actions.uploadFile(imageFile, targetFolderId);
      } catch {
        const downloadUrl = URL.createObjectURL(imageBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = image.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }
      savedCount += 1;
    }

    return { folderName, savedCount };
  };

  const saveGeneratedFilesToStorage = async (files = [], folderLabel = 'generated') => {
    let folderName = `${item?.name?.replace(/\.[^.]+$/, '') || 'document'}_${folderLabel}_${getTimestampToken()}`;
    let targetFolderId = item?.parentId ?? null;

    try {
      const folder = await actions.createFolder(folderName, item?.parentId ?? null);
      targetFolderId = folder?.id ?? targetFolderId;
      folderName = folder?.name || folderName;
    } catch {
      // Fallback to direct file output if folder creation fails.
    }

    let savedCount = 0;
    for (const entry of files) {
      if (!entry?.name || !entry?.bytes) continue;
      const blob = new Blob([entry.bytes], { type: 'application/pdf' });
      try {
        const file = new File([blob], entry.name, { type: 'application/pdf' });
        await actions.uploadFile(file, targetFolderId);
      } catch {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = entry.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }
      savedCount += 1;
    }

    return { folderName, savedCount };
  };

  // =============================================
  // PDF SPECIFIC HANDLERS (Features 1-14, 16, 19, 21)
  // =============================================

  // 1. Form Filling
  const handleFillForm = async () => {
    const mergedFormData = getMergedFormData();

    if (formFields.length === 0) {
      const entries = Object.entries(mergedFormData)
        .filter(([name, value]) => String(name || '').trim() && String(value || '').trim())
        .map(([name, value], index) => ({
          page: Math.max(1, parseInt(visualFill.page, 10) || 1) - 1,
          x: Math.max(0, Number(visualFill.x) || 80),
          y: Math.max(0, (Number(visualFill.y) || 140) + index * Math.max(12, Number(visualFill.size) || 12) * 1.4),
          size: Math.max(8, Number(visualFill.size) || 12),
          text: `${name}: ${value}`,
        }));

      if (!entries.length) {
        showMessage('error', 'No AcroForm fields found. Use Visual Fill below to place text on the PDF.');
        return;
      }

      executeAction(async () => {
        const filledBytes = await pdfTools.addTextOverlays(await getItemUrl(), entries, { coordinateOrigin: 'top-left' });
        await saveConvertedToStorage(filledBytes, makePdfOutputName('visual_filled'), 'application/pdf');
      }, 'Visual text fill applied and saved!');
      return;
    }

    if (!Object.keys(mergedFormData).length) {
      showMessage('error', 'Enter at least one field name and value to fill the form');
      return;
    }

    executeAction(async () => {
      const filledBytes = await pdfTools.fillPDFForm(await getItemUrl(), mergedFormData);
      await saveConvertedToStorage(filledBytes, makePdfOutputName('filled_form'), 'application/pdf');
    }, 'Form filled and saved in storage!');
  };

  // 2. Save Filled Form (Flatten)
  const handleFlattenForm = async () => {
    executeAction(async () => {
      const flattenedBytes = await pdfTools.saveFlattenedForm(await getItemUrl());
      await saveConvertedToStorage(flattenedBytes, makePdfOutputName('flattened_form'), 'application/pdf');
    }, 'Form flattened and saved in storage!');
  };

  // 3 & 4. Digital Signature
  const handleDrawSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureData({ data: dataUrl, position: signaturePosition });
    showMessage('success', 'Signature captured! Click "Add to PDF" to apply.');
  };

  const handleImportSignatureImage = async (file) => {
    if (!file) return;

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      const maxWidth = 1000;
      const scale = image.width > maxWidth ? maxWidth / image.width : 1;
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 240) {
          pixels[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const cleanedDataUrl = canvas.toDataURL('image/png');

      setSignatureData({ data: cleanedDataUrl, position: signaturePosition });

      const previewCanvas = signatureCanvasRef.current;
      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        const importedImage = new Image();
        importedImage.onload = () => {
          const ratio = Math.min(previewCanvas.width / importedImage.width, previewCanvas.height / importedImage.height);
          const drawWidth = importedImage.width * ratio;
          const drawHeight = importedImage.height * ratio;
          const drawX = (previewCanvas.width - drawWidth) / 2;
          const drawY = (previewCanvas.height - drawHeight) / 2;
          previewCtx.drawImage(importedImage, drawX, drawY, drawWidth, drawHeight);
        };
        importedImage.src = cleanedDataUrl;
      }

      showMessage('success', 'Signature extracted from image. Move/resize the box and click Add to PDF.');
    } catch (error) {
      showMessage('error', `Could not extract signature from image: ${error.message || 'Invalid image file'}`);
    }
  };

  const handleAddSignature = async () => {
    if (!signatureData) {
      showMessage('error', 'Please draw a signature first');
      return;
    }
    executeAction(async () => {
      const signedBytes = await pdfTools.addSignatureToPDF(await getItemUrl(), {
        ...signatureData,
        position: { ...signaturePosition, page: signaturePosition.page - 1 }
      });
      await saveEditedPdfVersion(signedBytes, 'Signature inserted');
    }, 'Signature inserted and saved as new PDF copy!');
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureData(null);
  };

  // 5. Watermark
  const handleAddWatermark = async () => {
    executeAction(async () => {
      const watermarkedBytes = await pdfTools.addWatermark(await getItemUrl(), watermarkConfig);
      await saveEditedPdfVersion(watermarkedBytes, 'Applied watermark');
    }, 'Watermark added and saved!');
  };

  // 6. Page Background
  const handleAddBackground = async () => {
    executeAction(async () => {
      const bgBytes = await pdfTools.addPageBackground(await getItemUrl(), bgConfig);
      await saveEditedPdfVersion(bgBytes, 'Applied page background');
    }, 'Background added and saved!');
  };

  // 7. Add/Remove Pages
  const handleAddPages = async () => {
    executeAction(async () => {
      const modifiedBytes = await pdfTools.addPages(await getItemUrl(), pageConfig);
      await saveEditedPdfVersion(modifiedBytes, `Inserted ${pageConfig.count} blank page(s)`);
    }, `${pageConfig.count} page(s) inserted and saved!`);
  };

  const handleRemovePages = async () => {
    const indices = pageIndices.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i) && i >= 0);
    if (indices.length === 0) {
      showMessage('error', 'Enter valid page numbers (e.g., 1,3,5)');
      return;
    }
    executeAction(async () => {
      const modifiedBytes = await pdfTools.removePages(await getItemUrl(), indices);
      await saveEditedPdfVersion(modifiedBytes, `Deleted ${indices.length} page(s)`);
    }, `${indices.length} page(s) deleted and saved!`);
  };

  const handleInsertPagesFromAnotherPDF = async () => {
    if (!insertSourceFile) {
      showMessage('error', 'Select a PDF to insert from');
      return;
    }

    executeAction(async () => {
      const insertUrl = URL.createObjectURL(insertSourceFile);
      const positionValue = insertPosition === 'page'
        ? Math.max(0, (parseInt(insertAtPage, 10) || 1) - 1)
        : insertPosition;

      let modifiedBytes;
      try {
        modifiedBytes = await pdfTools.insertPagesFromPDF(
          await getItemUrl(),
          insertUrl,
          { position: positionValue }
        );
      } finally {
        URL.revokeObjectURL(insertUrl);
      }

      await saveEditedPdfVersion(modifiedBytes, `Inserted pages from ${insertSourceFile.name}`);
      setInsertSourceFile(null);
    }, 'Pages inserted and saved!');
  };

  const handleDuplicatePages = async () => {
    const indices = parsePageInput(duplicatePagesInput);
    if (!indices.length) {
      showMessage('error', 'Enter valid page numbers to duplicate');
      return;
    }

    const copies = Math.max(1, Number(duplicateCopies) || 1);
    executeAction(async () => {
      const modifiedBytes = await pdfTools.duplicatePages(await getItemUrl(), indices, copies);
      await saveEditedPdfVersion(modifiedBytes, `Duplicated ${indices.length} page(s) x${copies}`);
    }, 'Pages duplicated and saved!');
  };

  // 8. Merge PDFs
  const handleMergePDFs = async () => {
    if (selectedFiles.length < 2) {
      showMessage('error', 'Select at least 2 PDF files to merge');
      return;
    }
    executeAction(async () => {
      const mergedBytes = await pdfTools.mergePDFFiles(selectedFiles);
      const outputName = makePdfOutputName('merged');
      await saveConvertedToStorage(mergedBytes, outputName, 'application/pdf');
    }, 'PDFs merged and saved in storage!');
  };

  // 9. Split PDF
  const handleSplitPDF = async () => {
    const pageCount = Number(pdfInfo?.pageCount || 0);
    const validRanges = (splitRanges || [])
      .map(range => ({
        start: Math.max(1, parseInt(range?.start, 10) || 1),
        end: Math.max(1, parseInt(range?.end, 10) || 1),
      }))
      .map(range => ({
        start: pageCount > 0 ? Math.min(range.start, pageCount) : range.start,
        end: pageCount > 0 ? Math.min(range.end, pageCount) : range.end,
      }))
      .filter(range => range.start <= range.end);

    if (!validRanges.length) {
      showMessage('error', 'Enter at least one valid page range (start must be <= end)');
      return;
    }

    executeAction(async () => {
      const splitPdfs = await pdfTools.splitPDFByRange(await getItemUrl(), validRanges);
      if (!splitPdfs?.length) {
        throw new Error('No split output was produced for the selected ranges');
      }
      const saved = await saveGeneratedFilesToStorage(splitPdfs, 'split_ranges');
      showMessage('success', `Saved ${saved.savedCount} split file(s) in folder ${saved.folderName}`);
    }, `PDF split into ${validRanges.length} part(s) and saved!`);
  };

  const handleSplitToPages = async () => {
    executeAction(async () => {
      const splitPdfs = await pdfTools.splitPDFToSinglePages(await getItemUrl());
      if (!splitPdfs?.length) {
        throw new Error('No pages were produced while splitting');
      }
      const saved = await saveGeneratedFilesToStorage(splitPdfs, 'single_pages');
      showMessage('success', `Saved ${saved.savedCount} page file(s) in folder ${saved.folderName}`);
    }, 'PDF split into individual pages and saved!');
  };

  const handleExtractPages = async () => {
    const indices = extractPagesInput.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i) && i >= 0);
    if (indices.length === 0) {
      showMessage('error', 'Enter valid page numbers (e.g., 1,3,5)');
      return;
    }
    executeAction(async () => {
      const extractedBytes = await pdfTools.extractPages(await getItemUrl(), indices);
      const outputName = `${getPdfBaseName()}_extract_${indices.map(i => i + 1).join('-')}_${getTimestampToken()}.pdf`;
      await saveConvertedToStorage(extractedBytes, outputName, 'application/pdf');
    }, 'Pages extracted!');
  };

  const handleExtractTables = async () => {
    executeAction(async () => {
      const result = await pdfTools.extractTablesToCSV(await getItemUrl());
      const tableCsv = result?.csv || '';

      if (result?.rows > 0 && tableCsv.trim()) {
        const outputName = `${getPdfBaseName()}_tables_${getTimestampToken()}.csv`;
        await saveConvertedToStorage(tableCsv, outputName, 'text/csv');
        showMessage('success', `Tables extracted to CSV (${result?.rows || 0} rows)`);
        return;
      }

      const fallback = await pdfTools.extractStructuredTextToCSV(await getItemUrl());
      const fallbackName = `${getPdfBaseName()}_text_lines_${getTimestampToken()}.csv`;
      await saveConvertedToStorage(fallback.csv, fallbackName, 'text/csv');
      showMessage('success', `No clear table detected. Saved structured text CSV fallback (${fallback.rows} rows).`);
    }, 'Tables extracted to CSV!');
  };

  const handleVisualFillText = async () => {
    const text = String(visualFill.text || '').trim();
    if (!text) {
      showMessage('error', 'Enter text to place on the PDF');
      return;
    }

    const entry = {
      page: Math.max(1, parseInt(visualFill.page, 10) || 1) - 1,
      x: Math.max(0, Number(visualFill.x) || 80),
      y: Math.max(0, Number(visualFill.y) || 140),
      size: Math.max(8, Number(visualFill.size) || 12),
      text,
    };

    executeAction(async () => {
      const filledBytes = await pdfTools.addTextOverlays(await getItemUrl(), [entry], { coordinateOrigin: 'top-left' });
      await saveConvertedToStorage(filledBytes, makePdfOutputName('visual_text_fill'), 'application/pdf');
    }, 'Visual fill text placed and saved!');
  };

  const handleSmartAutoFill = async () => {
    const mergedFormData = getMergedFormData();
    const validCount = Object.entries(mergedFormData).filter(([k, v]) => String(k || '').trim() && String(v || '').trim()).length;
    if (!validCount) {
      showMessage('error', 'Add at least one field name and value for Smart Auto Fill');
      return;
    }

    executeAction(async () => {
      const sourceUrl = await getItemUrl();
      const suggested = await pdfTools.suggestTextOverlayAnchors(sourceUrl, mergedFormData, {
        offsetX: 12,
        fallbackX: Math.max(0, Number(visualFill.x) || 80),
        fallbackY: Math.max(0, Number(visualFill.y) || 140),
        fallbackGapY: Math.max(14, (Number(visualFill.size) || 12) * 1.5),
        size: Math.max(8, Number(visualFill.size) || 12),
      });

      const overlays = suggested?.overlays || [];
      if (!overlays.length) {
        throw new Error('Could not compute placement anchors for smart fill');
      }

      const filledBytes = await pdfTools.addTextOverlays(sourceUrl, overlays, { coordinateOrigin: 'top-left' });
      await saveConvertedToStorage(filledBytes, makePdfOutputName('smart_autofill'), 'application/pdf');

      const unresolved = suggested?.unresolved || [];
      if (unresolved.length) {
        showMessage('success', `Smart fill completed. Used fallback placement for: ${unresolved.join(', ')}`);
      }
    }, 'Smart Auto Fill applied and saved!');
  };

  const handleExtractFonts = async () => {
    executeAction(async () => {
      const fonts = await pdfTools.extractEmbeddedFonts(await getItemUrl());
      const content = (fonts || []).join('\n');
      const outputName = `${getPdfBaseName()}_fonts_${getTimestampToken()}.txt`;
      await saveConvertedToStorage(content, outputName, 'text/plain');
    }, 'Embedded fonts exported!');
  };

  const handleExtractPageImages = async () => {
    executeAction(async () => {
      const startPage = Math.max(1, parseInt(extractImageRange.start, 10) || 1);
      const endRaw = String(extractImageRange.end || '').trim();
      const endPage = endRaw ? Math.max(startPage, parseInt(endRaw, 10) || startPage) : undefined;

      const images = await pdfTools.pdfToImages(await getItemUrl(), {
        format: 'png',
        scale: 1.15,
        startPage,
        endPage,
        maxPages: 200,
        maxDimension: 1800,
      });

      if (!images?.length) {
        throw new Error('No page images were extracted for the selected range');
      }

      const saved = await saveImagesToStorage(images, 'extract_images');
      showMessage('success', `Saved ${saved.savedCount} page image(s) in folder ${saved.folderName}`);
    }, 'Page images extracted and saved!');
  };

  const handleExportPdfMetadata = async () => {
    executeAction(async () => {
      const info = await pdfTools.getPDFInfo(await getItemUrl());
      const fields = await pdfTools.getPDFFormFields(await getItemUrl()).catch(() => []);
      const payload = {
        file: item?.name || 'document.pdf',
        exportedAt: new Date().toISOString(),
        info,
        form: {
          hasAcroFormFields: Array.isArray(fields) && fields.length > 0,
          fieldsCount: fields?.length || 0,
          fields: fields || [],
        },
      };

      const outputName = `${getPdfBaseName()}_metadata_${getTimestampToken()}.json`;
      await saveConvertedToStorage(JSON.stringify(payload, null, 2), outputName, 'application/json');
    }, 'PDF metadata exported!');
  };

  const handleExtractPageSummary = async () => {
    executeAction(async () => {
      const result = await pdfTools.extractPageSummaryCSV(await getItemUrl());
      const outputName = `${getPdfBaseName()}_page_summary_${getTimestampToken()}.csv`;
      await saveConvertedToStorage(result.csv, outputName, 'text/csv');
      showMessage('success', `Page summary exported (${result.rows} pages)`);
    }, 'Page summary extracted!');
  };

  const handleRemoveBlankPages = async () => {
    executeAction(async () => {
      const result = await pdfTools.removeBlankPages(await getItemUrl(), {
        minCharacters: Math.max(0, Number(blankPageMinChars) || 0),
      });

      const removed = result?.removedPages || [];
      if (!removed.length) {
        showMessage('success', 'No blank pages detected by text analysis.');
        return;
      }

      await saveConvertedToStorage(result.bytes, makePdfOutputName('blank_pages_removed'), 'application/pdf');
      showMessage('success', `Removed blank pages: ${removed.join(', ')}`);
    }, 'Blank pages cleanup completed!');
  };

  // 10. Password Protect
  const handlePasswordProtect = async () => {
    if (!passwords.userPassword) {
      showMessage('error', 'Enter a password');
      return;
    }
    executeAction(async () => {
      const protectedBytes = await pdfTools.passwordProtectPDF(await getItemUrl(), passwords);
      await saveConvertedToStorage(protectedBytes, makePdfOutputName('protected'), 'application/pdf');
    }, 'Password protection applied!');
  };

  // 11. Remove Password
  const handleRemovePassword = async () => {
    executeAction(async () => {
      const unlockedBytes = await pdfTools.removePasswordPDF(await getItemUrl(), passwords.userPassword);
      await saveConvertedToStorage(unlockedBytes, makePdfOutputName('unlocked'), 'application/pdf');
    }, 'Password removed!');
  };

  // 13. PDF to Text
  const handlePDFToText = async () => {
    executeAction(async () => {
      const text = await pdfTools.pdfToText(await getItemUrl());
      const outputName = item.name.replace(/\.pdf$/i, '.txt');
      const textBlob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      await saveConvertedToStorage(textBlob, outputName, 'text/plain;charset=utf-8');
    }, 'PDF converted to text!');
  };

  // 14. PDF to Images
  const handlePDFToImages = async () => {
    executeAction(async () => {
      const pageCount = pdfInfo?.pageCount || 0;
      const maxPages = pageCount > 120 ? 40 : pageCount > 60 ? 60 : 100;
      const scale = pageCount > 60 ? 1.0 : 1.2;
      const maxDimension = pageCount > 60 ? 1600 : 1920;
      const images = await pdfTools.pdfToImages(await getItemUrl(), { format: 'png', scale, maxPages, maxDimension });
      const saved = await saveImagesToStorage(images, 'images');
      showMessage('success', `Saved ${saved.savedCount} image page(s) in folder ${saved.folderName}`);
    }, 'PDF pages converted to images in platform storage!');
  };

  // 16. Reorder Pages
  const handleReorderPages = async () => {
    const newOrder = pageOrder.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i) && i >= 0);
    if (newOrder.length === 0) {
      showMessage('error', 'Enter valid page order (e.g., 3,1,2,4)');
      return;
    }
    executeAction(async () => {
      const reorderedBytes = await pdfTools.reorderPDFPages(await getItemUrl(), newOrder);
      await saveEditedPdfVersion(reorderedBytes, 'Reordered pages');
    }, 'Pages reordered and saved!');
  };

  // 19. PDF to DOC
  const handlePDFToDoc = async () => {
    executeAction(async () => {
      const outputName = item.name.replace(/\.pdf$/i, '.docx');
      const docBlob = await pdfTools.pdfToDoc(await getItemUrl());
      await saveConvertedToStorage(docBlob, outputName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }, 'PDF converted to DOC!');
  };

  // 21. PDF to PPT
  const handlePDFToPPT = async () => {
    executeAction(async () => {
      const pageCount = pdfInfo?.pageCount || 0;
      const maxPages = pageCount > 120 ? 30 : pageCount > 60 ? 50 : 80;
      const scale = pageCount > 60 ? 0.95 : 1.15;
      const result = await pdfTools.pdfToPPT(await getItemUrl(), { maxPages, scale, maxDimension: 1600 });
      const saved = await saveImagesToStorage(result.images || [], 'ppt_slides');
      showMessage('success', `Saved ${saved.savedCount} slide image(s) in folder ${saved.folderName}`);
    }, 'PDF pages exported for PowerPoint in platform storage!');
  };

  // Compress PDF
  const handleCompressPDF = async () => {
    executeAction(async () => {
      const compressedBytes = await pdfTools.compressPDF(await getItemUrl());
      await saveConvertedToStorage(compressedBytes, makePdfOutputName('compressed'), 'application/pdf');
    }, 'PDF compressed!');
  };

  // Rotate PDF
  const handleRotatePDF = async (degrees) => {
    executeAction(async () => {
      const indices = parsePageInput(rotatePagesInput);
      const rotatedBytes = await pdfTools.rotatePDF(await getItemUrl(), degrees, indices.length ? indices : null);
      await saveEditedPdfVersion(rotatedBytes, `Rotated ${indices.length ? indices.length : 'all'} page(s) by ${degrees}°`);
    }, `Rotation applied and saved!`);
  };

  const handleAddPageNumbers = async () => {
    const startAt = Math.max(1, Number(pageNumberConfig.startAt) || 1);
    const fontSize = Math.max(8, Math.min(36, Number(pageNumberConfig.fontSize) || 10));

    executeAction(async () => {
      const numberedBytes = await pdfTools.addPageNumbers(await getItemUrl(), {
        startAt,
        position: pageNumberConfig.position,
        prefix: pageNumberConfig.prefix,
        fontSize,
      });
      await saveEditedPdfVersion(numberedBytes, 'Added page numbers');
    }, 'Page numbers added and saved!');
  };

  const handleReversePageOrder = async () => {
    executeAction(async () => {
      const reversedBytes = await pdfTools.reversePDFPageOrder(await getItemUrl());
      await saveEditedPdfVersion(reversedBytes, 'Reversed page order');
    }, 'Page order reversed and saved!');
  };

  // =============================================
  // IMAGE SPECIFIC HANDLERS (Feature 15)
  // =============================================

  // 15. Images to PDF
  const handleImagesToPDF = async () => {
    if (selectedFiles.length === 0) {
      showMessage('error', 'Select image files first');
      return;
    }
    executeAction(async () => {
      const pdfBytes = await pdfTools.imagesToPDF(selectedFiles, { pageSize: 'A4', orientation: 'portrait' });
      await saveConvertedToStorage(pdfBytes, 'images_to_pdf.pdf', 'application/pdf');
    }, 'Images converted to PDF!');
  };

  // Single image to PDF
  const handleSingleImageToPDF = async () => {
    executeAction(async () => {
      const pdfBytes = await pdfTools.imagesToPDF([await getItemUrl()], { pageSize: 'A4', orientation: 'portrait' });
      const outputName = item.name.replace(/\.[^.]+$/, '.pdf');
      await saveConvertedToStorage(pdfBytes, outputName, 'application/pdf');
    }, 'Image converted to PDF!');
  };

  // =============================================
  // DOC SPECIFIC HANDLERS (Feature 17)
  // =============================================

  // 17. Doc to PDF
  const handleDocToPDF = async () => {
    executeAction(async () => {
      const docInput = selectedFiles.length > 0 ? selectedFiles[0] : await getItemUrl();
      const sourceName = selectedFiles[0]?.name || item?.name || 'document.docx';
      const pdfBytes = await pdfTools.docToPDF(docInput);
      const outputName = sourceName.replace(/\.(docx?|odt)$/i, '.pdf');
      await saveConvertedToStorage(pdfBytes, outputName, 'application/pdf');
    }, 'Document converted to PDF!');
  };

  const handleDocToImages = async () => {
    executeAction(async () => {
      let arrayBuffer;
      if (selectedFiles.length > 0) {
        arrayBuffer = await selectedFiles[0].arrayBuffer();
      } else {
        const response = await fetch(await getItemUrl());
        arrayBuffer = await response.arrayBuffer();
      }

      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = (result.value || '').trim() || 'No readable text found in this document.';

      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = 1754;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#102a43';
      ctx.font = '24px Arial';

      const margin = 70;
      const maxWidth = canvas.width - margin * 2;
      const lineHeight = 34;
      let y = margin;

      const words = text.replace(/\s+/g, ' ').split(' ');
      let line = '';

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth) {
          ctx.fillText(line, margin, y);
          line = word;
          y += lineHeight;
          if (y > canvas.height - margin) break;
        } else {
          line = testLine;
        }
      }
      if (line && y <= canvas.height - margin) {
        ctx.fillText(line, margin, y);
      }

      const dataUrl = canvas.toDataURL('image/png');
      const imageBlob = await fetch(dataUrl).then(res => res.blob());
      const outputName = (selectedFiles[0]?.name || item.name).replace(/\.(docx?|odt)$/i, '.png');
      await saveConvertedToStorage(imageBlob, outputName, 'image/png');
    }, 'Document converted to image!');
  };

  // =============================================
  // TXT SPECIFIC HANDLERS (Feature 18)
  // =============================================

  // 18. Txt to PDF
  const handleTxtToPDF = async () => {
    if (selectedFiles.length === 0) {
      showMessage('error', 'Select a text file');
      return;
    }
    executeAction(async () => {
      const txtInput = selectedFiles[0] || await getItemUrl();
      const outputName = (selectedFiles[0]?.name || item.name).replace(/\.[^.]+$/i, '.pdf');
      const pdfBytes = await pdfTools.txtToPDF(txtInput);
      await saveConvertedToStorage(pdfBytes, outputName, 'application/pdf');
    }, 'Text file converted to PDF!');
  };

  // Current text file to PDF
  const handleCurrentTxtToPDF = async () => {
    executeAction(async () => {
      const response = await fetch(await getItemUrl());
      const text = await response.text();
      const pdfBytes = await pdfTools.txtToPDF(text);
      const outputName = item.name.replace(/\.[^.]+$/, '.pdf');
      await saveConvertedToStorage(pdfBytes, outputName, 'application/pdf');
    }, 'Text converted to PDF!');
  };

  // =============================================
  // PPT SPECIFIC HANDLERS (Feature 20)
  // =============================================

  // 20. PPT to PDF
  const handlePPTToPDF = async () => {
    executeAction(async () => {
      const pptInput = selectedFiles[0] || { name: item?.name || 'presentation.pptx' };
      const sourceName = selectedFiles[0]?.name || item?.name || 'presentation.pptx';
      const pdfBytes = await pdfTools.pptToPDF(pptInput);
      const outputName = sourceName.replace(/\.(pptx?)$/i, '.pdf');
      await saveConvertedToStorage(pdfBytes, outputName, 'application/pdf');
    }, 'PowerPoint converted to PDF!');
  };

  const handlePPTToImages = async () => {
    executeAction(async () => {
      const pptInput = selectedFiles[0] || { name: item?.name || 'presentation.pptx' };
      const pdfBytes = await pdfTools.pptToPDF(pptInput);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const tempUrl = URL.createObjectURL(blob);
      const images = await pdfTools.pdfToImages(tempUrl, { format: 'png', scale: 1.2, maxPages: 20, maxDimension: 1800 });
      URL.revokeObjectURL(tempUrl);
      const saved = await saveImagesToStorage(images, 'ppt_images');
      showMessage('success', `Saved ${saved.savedCount} image(s) in folder ${saved.folderName}`);
    }, 'PowerPoint converted to images!');
  };

  const handleImageToDoc = async () => {
    executeAction(async () => {
      const { Document, Packer, Paragraph, ImageRun, TextRun } = await import('docx');

      const sourceUrl = await getItemUrl();
      const response = await fetch(sourceUrl);
      const imageBlob = await response.blob();
      const imageBuffer = await imageBlob.arrayBuffer();

      const imageDims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width || 1000, height: img.height || 700 });
        img.onerror = () => resolve({ width: 1000, height: 700 });
        img.src = sourceUrl;
      });

      const maxWidth = 560;
      const ratio = Math.min(1, maxWidth / imageDims.width);
      const width = Math.max(120, Math.round(imageDims.width * ratio));
      const height = Math.max(90, Math.round(imageDims.height * ratio));

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ children: [new TextRun('Image to DOC conversion')] }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: { width, height },
                }),
              ],
            }),
          ],
        }],
      });

      const docBlob = await Packer.toBlob(doc);
      const outputName = item.name.replace(/\.[^.]+$/, '.docx');
      await saveConvertedToStorage(docBlob, outputName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }, 'Image converted to DOC!');
  };

  const handleImageToPPT = async () => {
    executeAction(async () => {
      const sourceUrl = await getItemUrl();
      const pdfBytes = await pdfTools.imagesToPDF([sourceUrl], { pageSize: 'A4', orientation: 'portrait' });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const tempUrl = URL.createObjectURL(blob);
      const result = await pdfTools.pdfToPPT(tempUrl, { maxPages: 1, scale: 1.2, maxDimension: 1800 });
      URL.revokeObjectURL(tempUrl);
      const saved = await saveImagesToStorage(result.images || [], 'ppt_slides');
      showMessage('success', `Saved ${saved.savedCount} slide image(s) in folder ${saved.folderName}`);
    }, 'Image exported for PowerPoint slides!');
  };

  const handleToggleFavoriteCurrent = async () => {
    executeAction(async () => {
      await actions.toggleFavorite(item.id);
    }, 'Favorite status updated!');
  };

  const handleQuickTagCurrent = async () => {
    const tag = window.prompt('Enter a tag for this file');
    if (!tag || !tag.trim()) return;
    executeAction(async () => {
      await actions.addTag(item.id, tag.trim());
    }, `Tag "${tag.trim()}" added!`);
  };

  const handleDuplicateCurrent = async () => {
    executeAction(async () => {
      const duplicated = await actions.duplicateItem(item.id);
      if (!duplicated) {
        throw new Error('Could not duplicate this file in current mode');
      }
    }, 'File duplicated in storage!');
  };

  const handleDocToText = async () => {
    executeAction(async () => {
      let arrayBuffer;
      if (selectedFiles.length > 0) {
        arrayBuffer = await selectedFiles[0].arrayBuffer();
      } else {
        const response = await fetch(await getItemUrl());
        arrayBuffer = await response.arrayBuffer();
      }

      const result = await mammoth.extractRawText({ arrayBuffer });
      const outputName = (selectedFiles[0]?.name || item.name).replace(/\.(docx?|odt)$/i, '.txt');
      const textBlob = new Blob([result.value || ''], { type: 'text/plain;charset=utf-8' });
      await saveConvertedToStorage(textBlob, outputName, 'text/plain;charset=utf-8');
    }, 'Document converted to TXT!');
  };

  const handleCleanTextFile = async () => {
    executeAction(async () => {
      const response = await fetch(await getItemUrl());
      const text = await response.text();
      const cleaned = text
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const outputName = item.name.replace(/\.[^.]+$/, '_cleaned.txt');
      const cleanedBlob = new Blob([cleaned], { type: 'text/plain;charset=utf-8' });
      await saveConvertedToStorage(cleanedBlob, outputName, 'text/plain;charset=utf-8');
    }, 'Cleaned text saved!');
  };

  const handleImageFormatConvert = async (targetFormat) => {
    executeAction(async () => {
      const sourceUrl = await getItemUrl();
      const image = new Image();
      image.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = sourceUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      const mimeType = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
      const quality = targetFormat === 'jpg' ? 0.85 : undefined;
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const blob = await fetch(dataUrl).then(r => r.blob());
      const outputName = item.name.replace(/\.[^.]+$/, `.${targetFormat}`);

      await saveConvertedToStorage(blob, outputName, mimeType);
    }, `Image converted to ${targetFormat.toUpperCase()}!`);
  };

  const handleExtractCurrentArchive = async () => {
    executeAction(async () => {
      const archiveUrl = await getItemUrl();
      const response = await fetch(archiveUrl);
      const archiveBuffer = await response.arrayBuffer();
      const extracted = await extractZipArchive(archiveBuffer);

      if (!extracted?.success) {
        throw new Error(extracted?.error || 'Could not extract archive');
      }

      const files = extracted.files || [];
      if (!files.length) {
        throw new Error('No files found in archive');
      }

      const folderName = `${item.name.replace(/\.zip$/i, '')}_extracted`;
      const folder = await actions.createFolder(folderName, item?.parentId ?? null);
      const targetFolderId = folder?.id ?? item?.parentId ?? null;

      const maxFiles = 200;
      const uploadBatch = files.slice(0, maxFiles);
      for (const fileEntry of uploadBatch) {
        const blob = new Blob([fileEntry.data], { type: 'application/octet-stream' });
        const file = new File([blob], fileEntry.name || `extracted_${Date.now()}`, { type: 'application/octet-stream' });
        await actions.uploadFile(file, targetFolderId);
      }

      if (files.length > maxFiles) {
        showMessage('error', `Extracted first ${maxFiles} files only. Archive contains more files.`);
      }
    }, 'Archive extracted into platform storage!');
  };

  // =============================================
  // RENDER FUNCTIONS BY FILE TYPE
  // =============================================

  // PDF Main Menu - Consolidated into dropdown sections
  const renderPDFMenu = () => (
    <div className="space-y-3">
      {/* Quick Actions Row */}
      <div className="grid grid-cols-4 gap-2">
        <ToolButton icon="edit" label="Forms" onClick={() => setActiveSection('forms')} />
        <ToolButton icon="signature" label="Sign" onClick={() => setActiveSection('signature')} />
        <ToolButton icon="pages" label="Page Ops" onClick={() => setActiveSection('pages')} />
        <ToolButton icon="reorder" label="Rearrange" onClick={() => setActiveSection('reorder')} />
      </div>
      
      {/* Document Section */}
      <ToolSection title="Document" icon="document">
        <div className="grid grid-cols-3 gap-2">
          <ToolButton icon="watermark" label="Watermark" onClick={() => setActiveSection('watermark')} small />
          <ToolButton icon="background" label="Background" onClick={() => setActiveSection('background')} small />
          <ToolButton icon="rotate" label="Rotate" onClick={() => setActiveSection('rotate')} small />
        </div>
      </ToolSection>

      {/* Organize Section */}
      <ToolSection title="Organize" icon="folder">
        <div className="grid grid-cols-3 gap-2">
          <ToolButton icon="compress" label="Compress" onClick={handleCompressPDF} small direct />
          <ToolButton icon="merge" label="Merge" onClick={() => setActiveSection('merge')} small />
          <ToolButton icon="split" label="Split" onClick={() => setActiveSection('split')} small />
        </div>
      </ToolSection>

      <ToolSection title="Extract" icon="export">
        <div className="grid grid-cols-3 gap-2">
          <ToolButton icon="export" label="Extract" onClick={() => setActiveSection('extract')} small />
          <ToolButton icon="lineNumbers" label="Page Numbers" onClick={() => setActiveSection('pageNumbers')} small />
          <ToolButton icon="sortAsc" label="Reverse Pages" onClick={() => setActiveSection('reversePages')} small />
        </div>
      </ToolSection>

      <ToolSection title="Security & Export" icon="lock">
        <div className="grid grid-cols-2 gap-2">
          <ToolButton icon="lock" label="Security" onClick={() => setActiveSection('security')} small />
          <ToolButton icon="export" label="Export" onClick={() => setActiveSection('export')} small />
        </div>
      </ToolSection>
    </div>
  );

  // Image Main Menu
  const renderImageMenu = () => (
    <div className="space-y-4">
      <div className="text-center py-4 bg-purple-50 rounded-lg border border-purple-100">
        <Icon name="image" size={32} className="text-purple-500 mx-auto mb-2" />
        <p className="text-navy-600 text-sm mb-3">Convert this image to PDF format</p>
        <button onClick={handleSingleImageToPDF} className="btn-primary px-6 py-2">
          <Icon name="convert" size={14} className="mr-2" />
          Convert to PDF
        </button>
      </div>
      <div className="border-t border-navy-100 pt-4">
        <h4 className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-3">Batch Convert</h4>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="input w-full text-sm mb-2"
        />
        {selectedFiles.length > 0 && (
          <p className="text-xs text-green-600 mb-2 flex items-center gap-1">
            <Icon name="check" size={12} /> {selectedFiles.length} image(s) selected
          </p>
        )}
        <button 
          onClick={handleImagesToPDF} 
          className="btn-secondary w-full text-sm"
          disabled={selectedFiles.length === 0}
        >
          Combine {selectedFiles.length || 0} Images to PDF
        </button>
      </div>

      <ToolSection title="Image Tools" icon="image">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleSingleImageToPDF} className="tool-btn py-3 text-xs">Image → PDF</button>
          <button onClick={handleImageToPPT} className="tool-btn py-3 text-xs">Image → PPT</button>
          <button onClick={handleImageToDoc} className="tool-btn py-3 text-xs">Image → DOC</button>
          <button onClick={() => handleImageFormatConvert('jpg')} className="tool-btn py-3 text-xs">Convert to JPG</button>
          <button onClick={() => handleImageFormatConvert('png')} className="tool-btn py-3 text-xs">Convert to PNG</button>
        </div>
      </ToolSection>

      <ToolSection title="Manage" icon="folder">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleToggleFavoriteCurrent} className="tool-btn py-2 text-xs">Favorite</button>
          <button onClick={handleQuickTagCurrent} className="tool-btn py-2 text-xs">Add Tag</button>
          <button onClick={handleDuplicateCurrent} className="tool-btn py-2 text-xs">Duplicate</button>
        </div>
      </ToolSection>
    </div>
  );

  // DOC Main Menu
  const renderDocMenu = () => (
    <div className="space-y-4">
      <div className="text-center py-4 bg-blue-50 rounded-lg border border-blue-100">
        <Icon name="word" size={32} className="text-blue-500 mx-auto mb-2" />
        <p className="text-navy-600 text-sm mb-3">Convert Word document to PDF format</p>
        <input
          type="file"
          accept=".doc,.docx"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="input w-full text-sm mb-3"
        />
        {selectedFiles.length > 0 && (
          <p className="text-xs text-green-600 mb-3 flex items-center justify-center gap-1">
            <Icon name="check" size={12} /> {selectedFiles[0].name}
          </p>
        )}
        <button 
          onClick={handleDocToPDF} 
          className="btn-primary px-6 py-2"
        >
          <Icon name="convert" size={14} className="mr-2" />
          Convert DOC to PDF
        </button>
      </div>

      <ToolSection title="Word Tools" icon="word">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleDocToPDF} className="tool-btn py-3 text-xs">DOC → PDF</button>
          <button onClick={handleDocToText} className="tool-btn py-3 text-xs">DOC → TXT</button>
          <button onClick={handleDocToImages} className="tool-btn py-3 text-xs">DOC → Images</button>
          <button onClick={() => setActiveSection('wordFeatures')} className="tool-btn py-3 text-xs col-span-2">Word Power Features (38)</button>
        </div>
      </ToolSection>

      <ToolSection title="Manage" icon="folder">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleToggleFavoriteCurrent} className="tool-btn py-2 text-xs">Favorite</button>
          <button onClick={handleQuickTagCurrent} className="tool-btn py-2 text-xs">Add Tag</button>
          <button onClick={handleDuplicateCurrent} className="tool-btn py-2 text-xs">Duplicate</button>
        </div>
      </ToolSection>
    </div>
  );

  // TXT Main Menu
  const renderTextMenu = () => (
    <div className="space-y-4">
      <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
        <Icon name="text" size={32} className="text-gray-500 mx-auto mb-2" />
        <p className="text-navy-600 text-sm mb-3">Convert this text file to PDF format</p>
        <button onClick={handleCurrentTxtToPDF} className="btn-primary px-6 py-2">
          <Icon name="convert" size={14} className="mr-2" />
          Convert to PDF
        </button>
      </div>
      <div className="border-t border-navy-100 pt-4">
        <h4 className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-3">Or select another file</h4>
        <input
          type="file"
          accept=".txt,.text,.md,.log,.ini,.cfg,.json,.xml,.yaml,.yml"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="input w-full text-sm mb-2"
        />
        {selectedFiles.length > 0 && (
          <p className="text-xs text-green-600 mb-2 flex items-center gap-1">
            <Icon name="check" size={12} /> {selectedFiles[0].name}
          </p>
        )}
        <button 
          onClick={handleTxtToPDF} 
          className="btn-secondary w-full text-sm"
          disabled={selectedFiles.length === 0}
        >
          Convert Selected Text to PDF
        </button>
      </div>

      <ToolSection title="Text Tools" icon="text">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleTxtToPDF} className="tool-btn py-3 text-xs">Text → PDF</button>
          <button onClick={handleCleanTextFile} className="tool-btn py-3 text-xs">Clean Text</button>
        </div>
      </ToolSection>

      <ToolSection title="Manage" icon="folder">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleToggleFavoriteCurrent} className="tool-btn py-2 text-xs">Favorite</button>
          <button onClick={handleQuickTagCurrent} className="tool-btn py-2 text-xs">Add Tag</button>
          <button onClick={handleDuplicateCurrent} className="tool-btn py-2 text-xs">Duplicate</button>
        </div>
      </ToolSection>
    </div>
  );

  // PPT Main Menu
  const renderPPTMenu = () => (
    <div className="space-y-4">
      <div className="text-center py-4 bg-orange-50 rounded-lg border border-orange-100">
        <Icon name="powerpoint" size={32} className="text-orange-500 mx-auto mb-2" />
        <p className="text-navy-600 text-sm mb-3">Convert PowerPoint to PDF format</p>
        <input
          type="file"
          accept=".ppt,.pptx"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="input w-full text-sm mb-3"
        />
        {selectedFiles.length > 0 && (
          <p className="text-xs text-green-600 mb-3 flex items-center justify-center gap-1">
            <Icon name="check" size={12} /> {selectedFiles[0].name}
          </p>
        )}
        <button 
          onClick={handlePPTToPDF} 
          className="btn-primary px-6 py-2"
        >
          <Icon name="convert" size={14} className="mr-2" />
          Convert PPT to PDF
        </button>
      </div>

      <ToolSection title="Presentation Tools" icon="powerpoint">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handlePPTToPDF} className="tool-btn py-3 text-xs">PPT → PDF</button>
          <button onClick={handlePPTToImages} className="tool-btn py-3 text-xs">PPT → Images</button>
        </div>
      </ToolSection>

      <ToolSection title="Manage" icon="folder">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleToggleFavoriteCurrent} className="tool-btn py-2 text-xs">Favorite</button>
          <button onClick={handleQuickTagCurrent} className="tool-btn py-2 text-xs">Add Tag</button>
          <button onClick={handleDuplicateCurrent} className="tool-btn py-2 text-xs">Duplicate</button>
        </div>
      </ToolSection>
    </div>
  );

  const renderArchiveMenu = () => (
    <div className="space-y-4">
      <div className="text-center py-4 bg-amber-50 rounded-lg border border-amber-100">
        <Icon name="archive" size={32} className="text-amber-600 mx-auto mb-2" />
        <p className="text-navy-600 text-sm mb-3">Extract this archive directly into platform storage</p>
        <button onClick={handleExtractCurrentArchive} className="btn-primary px-6 py-2">
          <Icon name="folderOpen" size={14} className="mr-2" />
          Extract Archive
        </button>
      </div>
    </div>
  );

  // PDF Sections
  const renderFormsSection = () => (
    <Section title="Form Filling" icon="edit" onBack={() => setActiveSection('main')}>
      {formFields.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-navy-500">Found {formFields.length} form field(s). Enter values below and click Fill Form.</p>
          {formFields.map((field, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <label className="w-1/3 text-xs text-navy-600">{field.name}</label>
              <input
                type="text"
                placeholder={`Enter ${field.name}`}
                className="input flex-1 text-sm"
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              />
            </div>
          ))}
          <div className="border-t border-navy-100 pt-3 space-y-2">
            <p className="text-xs text-navy-500">Optional extra custom field</p>
            <input
              type="text"
              placeholder="Field name"
              className="input w-full text-sm"
              value={manualFormField.name}
              onChange={(e) => setManualFormField(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Field value"
              className="input w-full text-sm"
              value={manualFormField.value}
              onChange={(e) => setManualFormField(prev => ({ ...prev, value: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleFillForm} className="btn-primary flex-1 text-sm">
              Fill Form
            </button>
            <button onClick={handleFlattenForm} className="btn-secondary flex-1 text-sm">
              Flatten Form
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-navy-500 text-sm">No AcroForm fields detected in this PDF. This means it is not a true fillable form.</p>
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
            Use Visual Fill to place text where needed (top-left coordinates), or use Fill Form to stamp your field/value pairs onto the page.
          </div>
          <div className="border-t border-navy-100 pt-3">
            <p className="text-xs text-navy-500 mb-2">Manual form field</p>
            <input
              type="text"
              placeholder="Field name"
              className="input w-full text-sm mb-2"
              value={manualFormField.name}
              onChange={(e) => setManualFormField(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Field value"
              className="input w-full text-sm mb-2"
              value={manualFormField.value}
              onChange={(e) => setManualFormField(prev => ({ ...prev, value: e.target.value }))}
            />
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-sm" onClick={handleFillForm}>Fill Form</button>
              <button className="btn-primary flex-1 text-sm" onClick={handleFlattenForm}>Flatten Form</button>
            </div>
            <button className="btn-secondary w-full text-sm mt-2" onClick={handleSmartAutoFill}>Smart Auto Fill by Keywords</button>
          </div>

          <div className="border-t border-navy-100 pt-3 space-y-2">
            <p className="text-xs text-navy-500">Visual Fill (non-form PDFs)</p>
            <input
              type="text"
              placeholder="Text to place on PDF"
              className="input w-full text-sm"
              value={visualFill.text}
              onChange={(e) => setVisualFill(prev => ({ ...prev, text: e.target.value }))}
            />
            <div className="grid grid-cols-4 gap-2">
              <input type="number" min="1" placeholder="Page" className="input text-sm" value={visualFill.page} onChange={(e) => setVisualFill(prev => ({ ...prev, page: parseInt(e.target.value, 10) || 1 }))} />
              <input type="number" min="0" placeholder="X" className="input text-sm" value={visualFill.x} onChange={(e) => setVisualFill(prev => ({ ...prev, x: parseInt(e.target.value, 10) || 80 }))} />
              <input type="number" min="0" placeholder="Y" className="input text-sm" value={visualFill.y} onChange={(e) => setVisualFill(prev => ({ ...prev, y: parseInt(e.target.value, 10) || 140 }))} />
              <input type="number" min="8" max="72" placeholder="Size" className="input text-sm" value={visualFill.size} onChange={(e) => setVisualFill(prev => ({ ...prev, size: parseInt(e.target.value, 10) || 12 }))} />
            </div>
            <button className="btn-primary w-full text-sm" onClick={handleVisualFillText}>Place Text on PDF</button>
          </div>
        </div>
      )}
    </Section>
  );

  const renderSignatureSection = () => (
    <Section title="Digital Signature" icon="signature" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <div className="border-2 border-dashed border-navy-200 rounded-lg p-2 bg-white">
          <canvas
            ref={signatureCanvasRef}
            width={360}
            height={100}
            className="w-full cursor-crosshair"
            style={{ touchAction: 'none' }}
            onMouseDown={(e) => {
              const canvas = e.target;
              const ctx = canvas.getContext('2d');
              const rect = canvas.getBoundingClientRect();
              let drawing = true;
              
              ctx.beginPath();
              ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
              
              const draw = (ev) => {
                if (!drawing) return;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#102a43';
                ctx.lineTo(ev.clientX - rect.left, ev.clientY - rect.top);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ev.clientX - rect.left, ev.clientY - rect.top);
              };
              
              canvas.onmousemove = draw;
              canvas.onmouseup = () => {
                drawing = false;
                canvas.onmousemove = null;
              };
              canvas.onmouseleave = () => {
                drawing = false;
                canvas.onmousemove = null;
              };
            }}
          />
        </div>
        <div>
          <label className="text-xs text-navy-500">Extract Signature from Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImportSignatureImage(e.target.files?.[0] || null)}
            className="input w-full text-sm py-1"
          />
        </div>
        <div>
          <label className="text-xs text-navy-500">Target Page</label>
          <input
            type="number"
            min="1"
            value={signaturePosition.page}
            onChange={(e) => setSignaturePosition({ ...signaturePosition, page: parseInt(e.target.value) || 1 })}
            className="input w-full text-sm py-1"
          />
        </div>

        <div className="border border-navy-200 rounded-lg p-2 bg-navy-50">
          <p className="text-[11px] text-navy-600 mb-2">Drag the blue box to place signature. Drag corner handle to resize.</p>
          <div
            ref={signaturePreviewRef}
            className="relative w-full rounded bg-white overflow-hidden border border-navy-200"
            onMouseMove={handleSignaturePreviewPointerMove}
            onMouseUp={stopSignatureDrag}
            onMouseLeave={stopSignatureDrag}
            style={{ minHeight: 180 }}
          >
            {signaturePreviewImage ? (
              <img src={signaturePreviewImage} alt="Signature placement preview" className="w-full h-auto block" />
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-navy-400">Loading page preview...</div>
            )}

            <div
              className="absolute border-2 border-sky-500 bg-sky-500/15 cursor-move"
              style={{
                left: `${signatureBox.xPct}%`,
                top: `${signatureBox.yPct}%`,
                width: `${signatureBox.wPct}%`,
                height: `${signatureBox.hPct}%`,
              }}
              onMouseDown={(e) => handleSignatureBoxPointerDown(e, 'move')}
            >
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-sky-600 cursor-se-resize" onMouseDown={(e) => handleSignatureBoxPointerDown(e, 'resize')} />
            </div>
          </div>
          <p className="text-[11px] text-navy-500 mt-2">X: {signaturePosition.x}, Y: {signaturePosition.y}, W: {signaturePosition.width}, H: {signaturePosition.height}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={clearSignature} className="btn-ghost flex-1 text-sm">Clear</button>
          <button onClick={handleDrawSignature} className="btn-secondary flex-1 text-sm">Capture</button>
          <button onClick={handleAddSignature} className="btn-primary flex-1 text-sm" disabled={!signatureData}>
            Add to PDF
          </button>
        </div>
      </div>
    </Section>
  );

  const renderWatermarkSection = () => (
    <Section title="Watermark" icon="watermark" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Watermark text"
          value={watermarkConfig.text}
          onChange={(e) => setWatermarkConfig({ ...watermarkConfig, text: e.target.value })}
          className="input w-full"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-navy-500">Opacity: {Math.round(watermarkConfig.opacity * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={watermarkConfig.opacity}
              onChange={(e) => setWatermarkConfig({ ...watermarkConfig, opacity: parseFloat(e.target.value) })}
              className="w-full accent-navy-600"
            />
          </div>
          <div>
            <label className="text-xs text-navy-500">Rotation: {watermarkConfig.rotation}°</label>
            <input
              type="range"
              min="-90"
              max="90"
              step="15"
              value={watermarkConfig.rotation}
              onChange={(e) => setWatermarkConfig({ ...watermarkConfig, rotation: parseInt(e.target.value) })}
              className="w-full accent-navy-600"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-navy-500">Font Size</label>
            <input
              type="number"
              value={watermarkConfig.fontSize}
              onChange={(e) => setWatermarkConfig({ ...watermarkConfig, fontSize: parseInt(e.target.value) })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="text-xs text-navy-500">Color</label>
            <input
              type="color"
              value={`#${Math.round(watermarkConfig.color.r * 255).toString(16).padStart(2, '0')}${Math.round(watermarkConfig.color.g * 255).toString(16).padStart(2, '0')}${Math.round(watermarkConfig.color.b * 255).toString(16).padStart(2, '0')}`}
              onChange={(e) => {
                const hex = e.target.value;
                setWatermarkConfig({
                  ...watermarkConfig,
                  color: {
                    r: parseInt(hex.slice(1, 3), 16) / 255,
                    g: parseInt(hex.slice(3, 5), 16) / 255,
                    b: parseInt(hex.slice(5, 7), 16) / 255
                  }
                });
              }}
              className="w-full h-9 rounded border border-navy-200"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input
            type="checkbox"
            checked={watermarkConfig.allPages}
            onChange={(e) => setWatermarkConfig({ ...watermarkConfig, allPages: e.target.checked })}
            className="rounded border-navy-300"
          />
          Apply to all pages
        </label>
        <button onClick={handleAddWatermark} className="btn-primary w-full">
          Add Watermark
        </button>
      </div>
    </Section>
  );

  const renderBackgroundSection = () => (
    <Section title="Page Background" icon="background" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <select
          value={bgConfig.type}
          onChange={(e) => setBgConfig({ ...bgConfig, type: e.target.value })}
          className="input w-full"
        >
          <option value="color">Color Background</option>
          <option value="image">Image Background</option>
        </select>
        {bgConfig.type === 'color' && (
          <input
            type="color"
            value={`#${Math.round(bgConfig.value.r * 255).toString(16).padStart(2, '0')}${Math.round(bgConfig.value.g * 255).toString(16).padStart(2, '0')}${Math.round(bgConfig.value.b * 255).toString(16).padStart(2, '0')}`}
            onChange={(e) => {
              const hex = e.target.value;
              setBgConfig({
                ...bgConfig,
                value: {
                  r: parseInt(hex.slice(1, 3), 16) / 255,
                  g: parseInt(hex.slice(3, 5), 16) / 255,
                  b: parseInt(hex.slice(5, 7), 16) / 255
                }
              });
            }}
            className="w-full h-12 rounded border border-navy-200"
          />
        )}
        {bgConfig.type === 'image' && (
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setBgConfig({ ...bgConfig, value: ev.target.result });
                };
                reader.readAsDataURL(file);
              }
            }}
            className="input w-full"
          />
        )}
        <div>
          <label className="text-xs text-navy-500">Opacity: {Math.round(bgConfig.opacity * 100)}%</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={bgConfig.opacity}
            onChange={(e) => setBgConfig({ ...bgConfig, opacity: parseFloat(e.target.value) })}
            className="w-full accent-navy-600"
          />
        </div>
        <button onClick={handleAddBackground} className="btn-primary w-full">
          Apply Background
        </button>
      </div>
    </Section>
  );

  const renderPagesSection = () => (
    <Section title="Page Management" icon="pages" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        {pdfInfo && (
          <p className="text-xs text-navy-500">Current document has {pdfInfo.pageCount} page(s)</p>
        )}
        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Add Blank Pages</h4>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              type="number"
              min="1"
              placeholder="Count"
              value={pageConfig.count}
              onChange={(e) => setPageConfig({ ...pageConfig, count: parseInt(e.target.value) || 1 })}
              className="input text-sm py-1"
            />
            <select
              value={pageConfig.position}
              onChange={(e) => setPageConfig({ ...pageConfig, position: e.target.value })}
              className="input text-sm py-1"
            >
              <option value="start">At Start</option>
              <option value="end">At End</option>
            </select>
            <select
              value={pageConfig.size}
              onChange={(e) => setPageConfig({ ...pageConfig, size: e.target.value })}
              className="input text-sm py-1"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </div>
          <button onClick={handleAddPages} className="btn-primary w-full text-sm">Add Pages</button>
        </div>
        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Remove Pages</h4>
          <input
            type="text"
            placeholder="Page numbers (e.g., 1, 3, 5)"
            value={pageIndices}
            onChange={(e) => setPageIndices(e.target.value)}
            className="input w-full text-sm mb-2"
          />
          <button onClick={handleRemovePages} className="btn-danger w-full text-sm">Remove Pages</button>
        </div>

        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Insert Pages from Another PDF</h4>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setInsertSourceFile(e.target.files?.[0] || null)}
            className="input w-full text-sm mb-2"
          />
          <select
            value={insertPosition}
            onChange={(e) => setInsertPosition(e.target.value)}
            className="input w-full text-sm mb-2"
          >
            <option value="start">Insert at Start</option>
            <option value="end">Insert at End</option>
            <option value="page">Insert Before Page #</option>
          </select>
          {insertPosition === 'page' && (
            <input
              type="number"
              min="1"
              value={insertAtPage}
              onChange={(e) => setInsertAtPage(parseInt(e.target.value, 10) || 1)}
              className="input w-full text-sm mb-2"
              placeholder="Page number"
            />
          )}
          <button onClick={handleInsertPagesFromAnotherPDF} className="btn-primary w-full text-sm" disabled={!insertSourceFile}>Insert Pages</button>
        </div>

        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Duplicate Pages</h4>
          <input
            type="text"
            placeholder="Pages to duplicate (e.g., 2,4)"
            value={duplicatePagesInput}
            onChange={(e) => setDuplicatePagesInput(e.target.value)}
            className="input w-full text-sm mb-2"
          />
          <input
            type="number"
            min="1"
            value={duplicateCopies}
            onChange={(e) => setDuplicateCopies(parseInt(e.target.value, 10) || 1)}
            className="input w-full text-sm mb-2"
            placeholder="Number of copies"
          />
          <button onClick={handleDuplicatePages} className="btn-secondary w-full text-sm">Duplicate Pages</button>
        </div>

        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Rotate Specific Pages</h4>
          <input
            type="text"
            placeholder="Pages (empty = all pages)"
            value={rotatePagesInput}
            onChange={(e) => setRotatePagesInput(e.target.value)}
            className="input w-full text-sm mb-2"
          />
          <select value={rotateDegrees} onChange={(e) => setRotateDegrees(parseInt(e.target.value, 10))} className="input w-full text-sm mb-2">
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
          <button onClick={() => handleRotatePDF(rotateDegrees)} className="btn-primary w-full text-sm">Rotate and Save</button>
        </div>

        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Remove Blank Pages (Text-Based)</h4>
          <p className="text-[11px] text-navy-500 mb-2">Removes pages with very low text content. Image-only pages may be kept if they contain text overlays only.</p>
          <input
            type="number"
            min="0"
            value={blankPageMinChars}
            onChange={(e) => setBlankPageMinChars(parseInt(e.target.value, 10) || 0)}
            className="input w-full text-sm mb-2"
            placeholder="Minimum text characters per page"
          />
          <button onClick={handleRemoveBlankPages} className="btn-secondary w-full text-sm">Clean Blank Pages</button>
        </div>
      </div>
    </Section>
  );

  const renderMergeSection = () => (
    <Section title="Merge PDFs" icon="merge" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <p className="text-xs text-navy-500">Select multiple PDF files to merge</p>
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
          className="input w-full text-sm"
        />
        {selectedFiles.length > 0 && (
          <div className="bg-navy-50 rounded-lg p-3 max-h-32 overflow-y-auto border border-navy-100">
            <p className="text-xs font-medium text-navy-700 mb-2">Files ({selectedFiles.length}):</p>
            <ol className="text-xs space-y-1 text-navy-600">
              {selectedFiles.map((f, i) => (
                <li key={i}>{i + 1}. {f.name}</li>
              ))}
            </ol>
          </div>
        )}
        <button
          onClick={handleMergePDFs}
          className="btn-primary w-full"
          disabled={selectedFiles.length < 2}
        >
          Merge {selectedFiles.length} PDFs
        </button>
      </div>
    </Section>
  );

  const renderSplitSection = () => (
    <Section title="Split PDF" icon="split" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        {pdfInfo && (
          <p className="text-xs text-navy-500">Document has {pdfInfo.pageCount} pages</p>
        )}
        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Split by Page Range</h4>
          {splitRanges.map((range, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <input
                type="number"
                min="1"
                placeholder="Start"
                value={range.start}
                onChange={(e) => {
                  const newRanges = [...splitRanges];
                  newRanges[idx].start = parseInt(e.target.value) || 1;
                  setSplitRanges(newRanges);
                }}
                className="input flex-1 text-sm py-1"
              />
              <span className="text-xs text-navy-400">to</span>
              <input
                type="number"
                min="1"
                placeholder="End"
                value={range.end}
                onChange={(e) => {
                  const newRanges = [...splitRanges];
                  newRanges[idx].end = parseInt(e.target.value) || 1;
                  setSplitRanges(newRanges);
                }}
                className="input flex-1 text-sm py-1"
              />
              {splitRanges.length > 1 && (
                <button
                  onClick={() => setSplitRanges(splitRanges.filter((_, i) => i !== idx))}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setSplitRanges([...splitRanges, { start: 1, end: 5 }])}
            className="btn-ghost w-full text-sm mb-2"
          >+ Add Range</button>
          <button onClick={handleSplitPDF} className="btn-primary w-full text-sm">Split by Ranges</button>
        </div>
        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2">Split to Individual Pages</h4>
          <button onClick={handleSplitToPages} className="btn-secondary w-full text-sm">
            Split All Pages
          </button>
        </div>
      </div>
    </Section>
  );

  const renderExtractSection = () => (
    <Section title="Extract & Export" icon="export" onBack={() => setActiveSection('main')}>
      <div className="space-y-4">
        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-navy-700">Extract Selected Pages</h4>
          <input
            type="text"
            placeholder="Page numbers (e.g., 1,3,5)"
            value={extractPagesInput}
            onChange={(e) => setExtractPagesInput(e.target.value)}
            className="input w-full text-sm"
          />
          <button onClick={handleExtractPages} className="btn-primary w-full text-sm">Extract Pages</button>
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-navy-700">Split to Single Pages</h4>
          <button onClick={handleSplitToPages} className="btn-secondary w-full text-sm">Split into Pages</button>
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-navy-700">Extract Tables → CSV</h4>
          <button onClick={handleExtractTables} className="btn-primary w-full text-sm">Extract Tables</button>
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-navy-700">Extract Embedded Fonts</h4>
          <button onClick={handleExtractFonts} className="btn-secondary w-full text-sm">Export Fonts List</button>
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-navy-700">Extract Page Images</h4>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="1"
              value={extractImageRange.start}
              onChange={(e) => setExtractImageRange(prev => ({ ...prev, start: parseInt(e.target.value, 10) || 1 }))}
              className="input text-sm"
              placeholder="Start page"
            />
            <input
              type="number"
              min="1"
              value={extractImageRange.end}
              onChange={(e) => setExtractImageRange(prev => ({ ...prev, end: e.target.value }))}
              className="input text-sm"
              placeholder="End page (optional)"
            />
          </div>
          <button onClick={handleExtractPageImages} className="btn-primary w-full text-sm">Extract Page Images</button>
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-navy-700">Extract Page Summary CSV</h4>
          <button onClick={handleExtractPageSummary} className="btn-secondary w-full text-sm">Export Page Summary</button>
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-navy-700">Export PDF Metadata JSON</h4>
          <button onClick={handleExportPdfMetadata} className="btn-secondary w-full text-sm">Export Metadata</button>
        </div>
      </div>
    </Section>
  );

  const renderPageNumbersSection = () => (
    <Section title="Add Page Numbers" icon="lineNumbers" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <input
          type="number"
          min="1"
          value={pageNumberConfig.startAt}
          onChange={(e) => setPageNumberConfig(prev => ({ ...prev, startAt: parseInt(e.target.value, 10) || 1 }))}
          className="input w-full text-sm"
          placeholder="Start numbering at"
        />
        <input
          type="text"
          value={pageNumberConfig.prefix}
          onChange={(e) => setPageNumberConfig(prev => ({ ...prev, prefix: e.target.value }))}
          className="input w-full text-sm"
          placeholder="Prefix (optional, e.g., Pg )"
        />
        <select
          value={pageNumberConfig.position}
          onChange={(e) => setPageNumberConfig(prev => ({ ...prev, position: e.target.value }))}
          className="input w-full text-sm"
        >
          <option value="bottom-center">Bottom Center</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="top-right">Top Right</option>
          <option value="top-center">Top Center</option>
        </select>
        <input
          type="number"
          min="8"
          max="36"
          value={pageNumberConfig.fontSize}
          onChange={(e) => setPageNumberConfig(prev => ({ ...prev, fontSize: parseInt(e.target.value, 10) || 10 }))}
          className="input w-full text-sm"
          placeholder="Font size"
        />
        <button onClick={handleAddPageNumbers} className="btn-primary w-full text-sm">Apply Page Numbers</button>
      </div>
    </Section>
  );

  const renderReversePagesSection = () => (
    <Section title="Reverse Page Order" icon="sortAsc" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <p className="text-xs text-navy-600">This creates a new PDF with page order reversed from last page to first page.</p>
        <button onClick={handleReversePageOrder} className="btn-primary w-full text-sm">Reverse All Pages</button>
      </div>
    </Section>
  );

  const renderReorderSection = () => (
    <Section title="Reorder Pages" icon="reorder" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        {pdfInfo && (
          <p className="text-xs text-navy-500">Current order: 1, 2, 3, ... {pdfInfo.pageCount}</p>
        )}
        <p className="text-xs text-navy-600">Enter new page order:</p>
        <input
          type="text"
          placeholder="e.g., 3, 1, 2, 4 (puts page 3 first)"
          value={pageOrder}
          onChange={(e) => setPageOrder(e.target.value)}
          className="input w-full"
        />
        <button onClick={handleReorderPages} className="btn-primary w-full">
          Reorder Pages
        </button>
      </div>
    </Section>
  );

  const renderSecuritySection = () => (
    <Section title="Security & Password" icon="lock" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2 flex items-center gap-1">
            <Icon name="lock" size={12} /> Add Password
          </h4>
          <input
            type="password"
            placeholder="Set password"
            value={passwords.userPassword}
            onChange={(e) => setPasswords({ ...passwords, userPassword: e.target.value })}
            className="input w-full text-sm mb-2"
          />
          <input
            type="password"
            placeholder="Owner password (optional)"
            value={passwords.ownerPassword}
            onChange={(e) => setPasswords({ ...passwords, ownerPassword: e.target.value })}
            className="input w-full text-sm mb-2"
          />
          <button onClick={handlePasswordProtect} className="btn-primary w-full text-sm">
            Protect PDF
          </button>
        </div>
        <div className="bg-navy-50 rounded-lg p-3 border border-navy-100">
          <h4 className="text-xs font-medium text-navy-700 mb-2 flex items-center gap-1">
            <Icon name="unlock" size={12} /> Remove Password
          </h4>
          <input
            type="password"
            placeholder="Enter current password"
            value={passwords.userPassword}
            onChange={(e) => setPasswords({ ...passwords, userPassword: e.target.value })}
            className="input w-full text-sm mb-2"
          />
          <button onClick={handleRemovePassword} className="btn-secondary w-full text-sm">
            Unlock PDF
          </button>
        </div>
      </div>
    </Section>
  );

  const renderExportSection = () => (
    <Section title="Export & Convert" icon="export" onBack={() => setActiveSection('main')}>
      <p className="text-xs text-navy-500 mb-3">
        Available conversions for this file type: <span className="font-medium uppercase">{fileCategory}</span>
      </p>

      {fileCategory === 'pdf' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handlePDFToText} className="tool-btn flex flex-col items-center py-3">
              <Icon name="text" size={20} className="text-gray-500 mb-1" />
              <span className="text-xs">Text (.txt)</span>
            </button>
            <button onClick={handlePDFToImages} className="tool-btn flex flex-col items-center py-3">
              <Icon name="image" size={20} className="text-purple-500 mb-1" />
              <span className="text-xs">Images</span>
            </button>
            <button onClick={handlePDFToDoc} className="tool-btn flex flex-col items-center py-3">
              <Icon name="word" size={20} className="text-blue-500 mb-1" />
              <span className="text-xs">Word (.docx)</span>
            </button>
            <button onClick={handlePDFToPPT} className="tool-btn flex flex-col items-center py-3">
              <Icon name="powerpoint" size={20} className="text-orange-500 mb-1" />
              <span className="text-xs">PowerPoint</span>
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-navy-100 space-y-2">
            <button onClick={handleCompressPDF} className="btn-primary w-full flex items-center justify-center gap-2">
              <Icon name="compress" size={14} />
              Compress PDF
            </button>
            <button onClick={() => setActiveSection('pages')} className="btn-secondary w-full text-sm">Open Page Operations</button>
          </div>
        </>
      )}

      {fileCategory === 'doc' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleDocToPDF} className="tool-btn flex flex-col items-center py-3">
            <Icon name="pdf" size={20} className="text-red-500 mb-1" />
            <span className="text-xs">PDF</span>
          </button>
          <button onClick={handleDocToText} className="tool-btn flex flex-col items-center py-3">
            <Icon name="text" size={20} className="text-gray-500 mb-1" />
            <span className="text-xs">TXT</span>
          </button>
          <button onClick={handleDocToImages} className="tool-btn flex flex-col items-center py-3">
            <Icon name="image" size={20} className="text-purple-500 mb-1" />
            <span className="text-xs">Images</span>
          </button>
        </div>
      )}

      {fileCategory === 'ppt' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handlePPTToPDF} className="tool-btn flex flex-col items-center py-3">
            <Icon name="pdf" size={20} className="text-red-500 mb-1" />
            <span className="text-xs">PDF</span>
          </button>
          <button onClick={handlePPTToImages} className="tool-btn flex flex-col items-center py-3">
            <Icon name="image" size={20} className="text-purple-500 mb-1" />
            <span className="text-xs">Images</span>
          </button>
        </div>
      )}

      {fileCategory === 'image' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleSingleImageToPDF} className="tool-btn flex flex-col items-center py-3">
            <Icon name="pdf" size={20} className="text-red-500 mb-1" />
            <span className="text-xs">PDF</span>
          </button>
          <button onClick={handleImageToPPT} className="tool-btn flex flex-col items-center py-3">
            <Icon name="powerpoint" size={20} className="text-orange-500 mb-1" />
            <span className="text-xs">PPT (slides)</span>
          </button>
          <button onClick={handleImageToDoc} className="tool-btn flex flex-col items-center py-3">
            <Icon name="word" size={20} className="text-blue-500 mb-1" />
            <span className="text-xs">DOCX</span>
          </button>
        </div>
      )}
    </Section>
  );

  const renderRotateSection = () => (
    <Section title="Rotate PDF" icon="rotate" onBack={() => setActiveSection('main')}>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Pages (e.g., 1,3,5). Leave empty = all pages"
          value={rotatePagesInput}
          onChange={(e) => setRotatePagesInput(e.target.value)}
          className="input w-full"
        />
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handleRotatePDF(90)} className="tool-btn py-4 flex flex-col items-center">
            <Icon name="rotateRight" size={24} className="text-navy-500 mb-1" />
            <span className="text-xs">90°</span>
          </button>
          <button onClick={() => handleRotatePDF(180)} className="tool-btn py-4 flex flex-col items-center">
            <Icon name="rotate" size={24} className="text-navy-500 mb-1" />
            <span className="text-xs">180°</span>
          </button>
          <button onClick={() => handleRotatePDF(270)} className="tool-btn py-4 flex flex-col items-center">
            <Icon name="rotateLeft" size={24} className="text-navy-500 mb-1" />
            <span className="text-xs">270°</span>
          </button>
        </div>
      </div>
    </Section>
  );

  const renderWordFeaturesSection = () => (
    <Section title="Word Power Features" icon="word" onBack={() => setActiveSection('main')}>
      <WordPowerFeaturesPanel
        item={item}
        getItemUrl={getItemUrl}
        saveConvertedToStorage={saveConvertedToStorage}
        showMessage={showMessage}
      />
    </Section>
  );

  // Main render based on file type
  const renderMainContent = () => {
    if (activeSection !== 'main') {
      switch (activeSection) {
        case 'forms': return renderFormsSection();
        case 'signature': return renderSignatureSection();
        case 'watermark': return renderWatermarkSection();
        case 'background': return renderBackgroundSection();
        case 'pages': return renderPagesSection();
        case 'merge': return renderMergeSection();
        case 'split': return renderSplitSection();
        case 'reorder': return renderReorderSection();
        case 'security': return renderSecuritySection();
        case 'export': return renderExportSection();
        case 'rotate': return renderRotateSection();
        case 'extract': return renderExtractSection();
        case 'pageNumbers': return renderPageNumbersSection();
        case 'reversePages': return renderReversePagesSection();
        case 'wordFeatures': return renderWordFeaturesSection();
        default: return null;
      }
    }

    switch (fileCategory) {
      case 'pdf': return renderPDFMenu();
      case 'image': return renderImageMenu();
      case 'doc': return renderDocMenu();
      case 'text': return renderTextMenu();
      case 'ppt': return renderPPTMenu();
      case 'archive': return renderArchiveMenu();
      default: return (
        <div className="text-center py-8 text-gray-500">
          <p>No power tools available for this file type</p>
        </div>
      );
    }
  };

  const getTitle = () => {
    const titles = {
      pdf: 'PDF Power Tools',
      image: 'Image Converter',
      doc: 'Document Converter',
      text: 'Text Converter',
      ppt: 'Presentation Converter',
      excel: 'Spreadsheet Converter',
      archive: 'Archive Tools'
    };
    return titles[fileCategory] || 'Document Tools';
  };

  const getIcon = () => {
    const icons = {
      pdf: 'pdf',
      image: 'image',
      doc: 'word',
      text: 'text',
      ppt: 'powerpoint',
      excel: 'excel',
      archive: 'archive'
    };
    return icons[fileCategory] || 'document';
  };

  const colors = FILE_TYPE_COLORS[fileCategory] || FILE_TYPE_COLORS.unknown;

  const containerClasses = inline
    ? 'bg-white h-full w-full max-w-none border-l border-navy-200 overflow-hidden flex flex-col'
    : 'bg-white rounded-xl shadow-strong max-w-md w-[95%] max-h-[85vh] overflow-hidden flex flex-col animate-scale-in';

  const content = (
    <div className={containerClasses} onClick={(e) => { if (!inline) e.stopPropagation(); }}>
      {/* Header */}
      <div className={`px-4 py-3 flex justify-between items-center border-b ${colors.bg} border-navy-100`}>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${colors.bg}`}>
            <Icon name={getIcon()} size={18} className={colors.text} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-navy-900">{getTitle()}</h2>
            <p className="text-xs text-navy-500 truncate max-w-[200px]">{item?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {inline && (
            <button
              onClick={() => setActiveSection('main')}
              className="p-1.5 rounded hover:bg-navy-100 text-navy-500"
              title="Back to main menu"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-navy-100 text-navy-400 hover:text-navy-600 transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          <Icon name={message.type === 'success' ? 'check' : 'warning'} size={14} />
          {message.text}
        </div>
      )}

      {isResolvingUrl && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100">
          <Icon name="refresh" size={14} className="animate-spin" />
          Preparing file content for power tools...
        </div>
      )}

      {driveReconnectUrl && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 bg-amber-50 text-amber-800 border border-amber-200">
          <span>Drive authorization required for this file.</span>
          <button
            onClick={() => window.location.href = driveReconnectUrl}
            className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Reconnect Drive
          </button>
        </div>
      )}

      {reconnectLoading && !driveReconnectUrl && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200">
          <Icon name="refresh" size={14} className="animate-spin" />
          Checking Google Drive connection...
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-navy-200 border-t-navy-600"></div>
            <p className="mt-3 text-sm text-navy-500">Processing...</p>
          </div>
        ) : (
          renderMainContent()
        )}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {content}
    </div>
  );
}

// Helper Components
function ToolButton({ icon, label, onClick, direct, small }) {
  return (
    <button
      onClick={onClick}
      className={`tool-btn flex flex-col items-center gap-1 transition-all ${small ? 'py-2' : 'py-3'} ${direct ? 'border-green-200 bg-green-50' : ''}`}
    >
      <Icon name={icon} size={small ? 16 : 20} className="text-navy-500" />
      <span className={`font-medium text-navy-700 ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
    </button>
  );
}

function ToolSection({ title, icon, children }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="border border-navy-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-navy-50 flex items-center justify-between text-left hover:bg-navy-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon} size={14} className="text-navy-500" />
          <span className="text-xs font-medium text-navy-700">{title}</span>
        </div>
        <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} className="text-navy-400" />
      </button>
      {isOpen && (
        <div className="p-2 animate-slide-down">
          {children}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children, onBack }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-navy-100">
        <button onClick={onBack} className="text-navy-500 hover:text-navy-700 transition-colors p-1 -ml-1">
          <Icon name="chevronLeft" size={16} />
        </button>
        {icon && <Icon name={icon} size={14} className="text-navy-500" />}
        <h3 className="text-sm font-medium text-navy-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}
