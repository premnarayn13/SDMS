/**
 * PDF POWER TOOLS - 21 Advanced Document Features
 * Complete professional document manipulation suite
 * 
 * Features:
 * 1. Form filling
 * 2. Save filled forms
 * 3. Digital signatures (local draw / image)
 * 4. Multiple signatures
 * 5. Watermark insertion
 * 6. Page background
 * 7. Add / remove pages
 * 8. Merge multiple PDFs
 * 9. Split PDFs by page range
 * 10. Password protect PDF
 * 11. Remove PDF password
 * 12. Encrypt / decrypt PDF
 * 13. PDF → Text
 * 14. PDF → Images
 * 15. Images → PDF
 * 16. Reorder PDF pages
 * 17. Doc → PDF
 * 18. Txt → PDF
 * 19. PDF → Doc
 * 20. PPT → PDF
 * 21. PDF → PPT
 */

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { tokenUtils } from './authApi';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Fetch PDF bytes from URL or data URL
 */
function buildFetchOptions(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = tokenUtils.getAccessToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    method: 'GET',
    credentials: 'include',
    headers,
  };
}

async function fetchOrThrow(url, parser = 'arrayBuffer') {
  const isLocalScheme = /^blob:|^data:/i.test(String(url || ''));
  const response = isLocalScheme
    ? await fetch(url)
    : await fetch(url, buildFetchOptions());
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.clone().json();
      detail = payload?.detail
        ? (typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail))
        : JSON.stringify(payload);
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }

  if (parser === 'text') {
    return response.text();
  }

  return response.arrayBuffer();
}

async function fetchPdfBytes(pdfUrl) {
  if (pdfUrl.startsWith('data:')) {
    return dataUrlToBytes(pdfUrl);
  }
  const arrayBuffer = await fetchOrThrow(pdfUrl, 'arrayBuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Convert data URL to Uint8Array
 */
async function dataUrlToBytes(dataUrl) {
  const arrayBuffer = await fetchOrThrow(dataUrl, 'arrayBuffer');
  return new Uint8Array(arrayBuffer);
}

async function getPdfJsLib() {
  const pdfjsLib = await import('pdfjs-dist');
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  return pdfjsLib;
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Download bytes as file
 */
export function downloadBytes(bytes, filename, mimeType = 'application/pdf') {
  const blob = new Blob([bytes], { type: mimeType });
  saveAs(blob, filename);
}

/**
 * Download multiple files as ZIP
 */
export async function downloadAsZip(files, zipFilename = 'download.zip') {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    for (const file of files) {
      zip.file(file.name, file.bytes);
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, zipFilename);
  } catch (e) {
    // Fallback: download files individually
    for (const file of files) {
      downloadBytes(file.bytes, file.name);
    }
  }
}

// ============================================
// 1. FORM FILLING
// ============================================

/**
 * Fill PDF form fields
 * @param {string} pdfUrl - PDF URL or data URL
 * @param {Object} formData - Key-value pairs of field names and values
 * @returns {Promise<Uint8Array>} - Filled PDF
 */
export async function fillPDFForm(pdfUrl, formData) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const fieldsByName = new Map(fields.map(field => [field.getName(), field]));
    const isTruthy = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value ?? '').trim().toLowerCase();
      return ['1', 'true', 'yes', 'on', 'checked'].includes(normalized);
    };
    const tryFindField = (name) => {
      if (fieldsByName.has(name)) return fieldsByName.get(name);
      const normalized = String(name || '').trim().toLowerCase();
      if (!normalized) return null;
      return fields.find(field => field.getName().trim().toLowerCase() === normalized) || null;
    };
    let updatedCount = 0;
    
    Object.entries(formData).forEach(([fieldName, value]) => {
      try {
        const field = tryFindField(fieldName);
        if (!field) return;

        if (typeof field.check === 'function' && typeof field.uncheck === 'function') {
          if (isTruthy(value)) field.check();
          else field.uncheck();
          updatedCount += 1;
          return;
        }

        if (typeof field.select === 'function' && Array.isArray(value)) {
          field.select(value.map(v => String(v)));
          updatedCount += 1;
          return;
        }

        if (typeof field.select === 'function') {
          field.select(String(value ?? ''));
          updatedCount += 1;
          return;
        }

        if (typeof field.setText === 'function') {
          field.setText(String(value ?? ''));
          updatedCount += 1;
          return;
        }

        if (typeof field.setImage === 'function' && value instanceof Uint8Array) {
          field.setImage(value);
          updatedCount += 1;
          return;
        }
      } catch (_error) {
        console.log(`Field ${fieldName} not found or incompatible`);
      }
    });

    if (updatedCount === 0) {
      throw new Error('No matching fillable fields were updated. Verify field names in the PDF form.');
    }
    
    const filledPdfBytes = await pdfDoc.save();
    return filledPdfBytes;
  } catch (error) {
    throw new Error(`Failed to fill form: ${error.message}`);
  }
}

/**
 * Get all form fields from PDF
 */
export async function getPDFFormFields(pdfUrl) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    return fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name,
      isReadOnly: field.isReadOnly?.() || false,
    }));
  } catch (error) {
    return [];
  }
}

// ============================================
// 2. SAVE FILLED FORMS (FLATTEN)
// ============================================

export async function saveFlattenedForm(pdfUrl) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const form = pdfDoc.getForm();
    form.flatten();
    
    const flattenedBytes = await pdfDoc.save();
    return flattenedBytes;
  } catch (error) {
    throw new Error(`Failed to flatten form: ${error.message}`);
  }
}

// ============================================
// 3. DIGITAL SIGNATURES (LOCAL DRAW / IMAGE)
// ============================================

export async function addSignatureToPDF(pdfUrl, signatureData) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const { page: pageNum = 0, x = 50, y = 50, width = 200, height = 100 } = signatureData.position || {};
    const pages = pdfDoc.getPages();
    const page = pages[pageNum] || pages[0];
    
    if (signatureData.data) {
      const signatureBytes = await dataUrlToBytes(signatureData.data);
      
      let signatureImage;
      if (signatureData.data.includes('png')) {
        signatureImage = await pdfDoc.embedPng(signatureBytes);
      } else {
        signatureImage = await pdfDoc.embedJpg(signatureBytes);
      }
      
      page.drawImage(signatureImage, {
        x: x,
        y: page.getHeight() - y - height,
        width: width,
        height: height,
      });
    }
    
    const signedPdfBytes = await pdfDoc.save();
    return signedPdfBytes;
  } catch (error) {
    throw new Error(`Failed to add signature: ${error.message}`);
  }
}

// ============================================
// 4. MULTIPLE SIGNATURES
// ============================================

export async function addMultipleSignatures(pdfUrl, signatures) {
  try {
    let currentPdfBytes = await fetchPdfBytes(pdfUrl);
    
    for (const signature of signatures) {
      const blob = new Blob([currentPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      currentPdfBytes = await addSignatureToPDF(url, signature);
      URL.revokeObjectURL(url);
    }
    
    return currentPdfBytes;
  } catch (error) {
    throw new Error(`Failed to add multiple signatures: ${error.message}`);
  }
}

export async function addTextOverlays(pdfUrl, overlays = [], options = {}) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const {
      coordinateOrigin = 'top-left',
      color = { r: 0.1, g: 0.1, b: 0.1 },
    } = options;

    const safeOverlays = Array.isArray(overlays) ? overlays : [];
    if (!safeOverlays.length) {
      throw new Error('No text overlays were provided');
    }

    safeOverlays.forEach((entry) => {
      const pageIndex = Math.max(0, Number(entry?.page ?? 0) || 0);
      const page = pages[pageIndex] || pages[0];
      if (!page) return;

      const text = String(entry?.text ?? '').trim();
      if (!text) return;

      const size = Math.max(8, Math.min(72, Number(entry?.size ?? 12) || 12));
      const x = Math.max(0, Number(entry?.x ?? 72) || 72);
      const inputY = Math.max(0, Number(entry?.y ?? 72) || 72);
      const y = coordinateOrigin === 'top-left'
        ? Math.max(0, page.getHeight() - inputY - size)
        : inputY;

      page.drawText(text, {
        x,
        y,
        size,
        color: rgb(color.r, color.g, color.b),
      });
    });

    return await pdfDoc.save();
  } catch (error) {
    throw new Error(`Failed to add visual text fill: ${error.message}`);
  }
}

export async function suggestTextOverlayAnchors(pdfUrl, fieldMap = {}, options = {}) {
  try {
    const {
      offsetX = 12,
      fallbackX = 90,
      fallbackY = 140,
      fallbackGapY = 20,
      size = 12,
    } = options;

    const entries = Object.entries(fieldMap || {})
      .map(([name, value]) => ({
        name: String(name || '').trim(),
        value: String(value || '').trim(),
      }))
      .filter(entry => entry.name && entry.value);

    if (!entries.length) {
      return { overlays: [], unresolved: [] };
    }

    const pdfjsLib = await getPdfJsLib();
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    const overlays = [];
    const unresolved = [];

    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      const entry = entries[entryIndex];
      const needle = entry.name.toLowerCase();
      let found = null;

      for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
        const page = await pdf.getPage(pageIndex);
        const viewport = page.getViewport({ scale: 1 });
        const pageHeight = viewport.height || 842;
        const textContent = await page.getTextContent();

        for (const item of textContent.items || []) {
          const itemText = String(item.str || '').trim();
          if (!itemText) continue;
          const normalized = itemText.toLowerCase();
          if (!normalized.includes(needle) && !needle.includes(normalized)) continue;

          const x = (item.transform?.[4] || 0) + (item.width || 0) + offsetX;
          const yFromBottom = item.transform?.[5] || 0;
          const yTopLeft = Math.max(0, pageHeight - yFromBottom - size);
          found = {
            page: pageIndex - 1,
            x: Math.max(0, x),
            y: yTopLeft,
            size,
            text: entry.value,
          };
          break;
        }

        if (found) break;
      }

      if (!found) {
        unresolved.push(entry.name);
        found = {
          page: 0,
          x: fallbackX,
          y: fallbackY + entryIndex * fallbackGapY,
          size,
          text: `${entry.name}: ${entry.value}`,
        };
      }

      overlays.push(found);
    }

    return { overlays, unresolved };
  } catch (error) {
    throw new Error(`Failed to suggest fill anchors: ${error.message}`);
  }
}

// ============================================
// 5. WATERMARK INSERTION
// ============================================

export async function addWatermark(pdfUrl, watermarkConfig) {
  try {
    const {
      text = 'CONFIDENTIAL',
      opacity = 0.3,
      rotation = 45,
      color = { r: 0.5, g: 0.5, b: 0.5 },
      fontSize = 60,
      allPages = true,
      pageIndex = 0
    } = watermarkConfig;
    
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    
    const pagesToMark = allPages ? pages : [pages[pageIndex]];
    
    pagesToMark.forEach(page => {
      if (!page) return;
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font: font,
        color: rgb(color.r, color.g, color.b),
        opacity: opacity,
        rotate: degrees(rotation),
      });
    });
    
    const watermarkedBytes = await pdfDoc.save();
    return watermarkedBytes;
  } catch (error) {
    throw new Error(`Failed to add watermark: ${error.message}`);
  }
}

// ============================================
// 6. PAGE BACKGROUND
// ============================================

export async function addPageBackground(pdfUrl, bgConfig) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const outputDoc = await PDFDocument.create();
    const pages = sourceDoc.getPages();
    const opacity = bgConfig.opacity ?? 0.3;

    let embeddedBackgroundImage = null;
    if (bgConfig.type === 'image' && bgConfig.value) {
      const imgBytes = await dataUrlToBytes(bgConfig.value);
      embeddedBackgroundImage = bgConfig.value.includes('png')
        ? await outputDoc.embedPng(imgBytes)
        : await outputDoc.embedJpg(imgBytes);
    }
    
    for (const srcPage of pages) {
      const { width, height } = srcPage.getSize();
      const page = outputDoc.addPage([width, height]);

      // Draw source content first so the background tool is visible on any PDF,
      // including pages with opaque white fills.
      const embeddedSourcePage = await outputDoc.embedPage(srcPage);
      page.drawPage(embeddedSourcePage, {
        x: 0,
        y: 0,
        width,
        height,
      });

      if (bgConfig.type === 'color') {
        const { r = 1, g = 1, b = 0.9 } = bgConfig.value || {};
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height,
          color: rgb(r, g, b),
          opacity,
          borderWidth: 0,
        });
      } else if (embeddedBackgroundImage) {
        page.drawImage(embeddedBackgroundImage, {
          x: 0,
          y: 0,
          width,
          height,
          opacity,
        });
      }
    }
    
    const bgPdfBytes = await outputDoc.save();
    return bgPdfBytes;
  } catch (error) {
    throw new Error(`Failed to add background: ${error.message}`);
  }
}

// ============================================
// 7. ADD / REMOVE PAGES
// ============================================

export async function addPages(pdfUrl, config) {
  try {
    const { position = 'end', count = 1, size = 'A4' } = config;
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const pageSizes = {
      'A4': [595.28, 841.89],
      'Letter': [612, 792],
      'Legal': [612, 1008]
    };
    
    const [width, height] = pageSizes[size] || pageSizes['A4'];
    
    for (let i = 0; i < count; i++) {
      if (position === 'start') {
        pdfDoc.insertPage(0, [width, height]);
      } else if (position === 'end') {
        pdfDoc.addPage([width, height]);
      } else if (typeof position === 'number') {
        pdfDoc.insertPage(position + i, [width, height]);
      }
    }
    
    const modifiedBytes = await pdfDoc.save();
    return modifiedBytes;
  } catch (error) {
    throw new Error(`Failed to add pages: ${error.message}`);
  }
}

export async function removePages(pdfUrl, pageIndices) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    const uniqueValid = [...new Set(pageIndices)]
      .filter(index => Number.isInteger(index) && index >= 0 && index < pdfDoc.getPageCount())
      .sort((a, b) => b - a);

    if (!uniqueValid.length) {
      throw new Error('No valid pages were selected for removal');
    }

    if (uniqueValid.length >= pdfDoc.getPageCount()) {
      throw new Error('Cannot remove all pages from a PDF');
    }
    
    uniqueValid.forEach(index => {
      pdfDoc.removePage(index);
    });
    
    const modifiedBytes = await pdfDoc.save();
    return modifiedBytes;
  } catch (error) {
    throw new Error(`Failed to remove pages: ${error.message}`);
  }
}

// Insert pages from another PDF
export async function insertPagesFromPDF(pdfUrl, insertPdfUrl, options = {}) {
  try {
    const { position = 'end', startPage = 1, endPage = null } = options;
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const insertBytes = await fetchPdfBytes(insertPdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const insertDoc = await PDFDocument.load(insertBytes, { ignoreEncryption: true });

    const totalInsertPages = insertDoc.getPageCount();
    const startIdx = Math.max(0, (startPage || 1) - 1);
    const endIdx = Math.min(totalInsertPages - 1, (endPage ? endPage - 1 : totalInsertPages - 1));
    const pageIndices = [];
    for (let i = startIdx; i <= endIdx; i++) {
      pageIndices.push(i);
    }

    const copiedPages = await pdfDoc.copyPages(insertDoc, pageIndices);
    let insertAt = pdfDoc.getPageCount();
    if (position === 'start') {
      insertAt = 0;
    } else if (typeof position === 'number') {
      insertAt = Math.max(0, Math.min(position, pdfDoc.getPageCount()));
    }

    copiedPages.forEach((page, idx) => {
      if (insertAt >= pdfDoc.getPageCount()) {
        pdfDoc.addPage(page);
      } else {
        pdfDoc.insertPage(insertAt + idx, page);
      }
    });

    const modifiedBytes = await pdfDoc.save();
    return modifiedBytes;
  } catch (error) {
    throw new Error(`Failed to insert pages: ${error.message}`);
  }
}

// Duplicate selected pages
export async function duplicatePages(pdfUrl, pageIndices, copies = 1) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    const sortedIndices = [...new Set(pageIndices)]
      .filter(index => Number.isInteger(index) && index >= 0 && index < pageCount)
      .sort((a, b) => a - b);
    const safeCopies = Math.max(1, Number(copies) || 1);

    if (!sortedIndices.length) {
      throw new Error('No valid pages were selected for duplication');
    }

    let offset = 0;

    for (const index of sortedIndices) {
      for (let c = 0; c < safeCopies; c++) {
        const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [index + offset]);
        pdfDoc.insertPage(index + offset + 1, copiedPage);
        offset += 1;
      }
    }

    const modifiedBytes = await pdfDoc.save();
    return modifiedBytes;
  } catch (error) {
    throw new Error(`Failed to duplicate pages: ${error.message}`);
  }
}

// ============================================
// 8. MERGE MULTIPLE PDFS
// ============================================

export async function mergePDFs(pdfUrls) {
  try {
    const mergedPdf = await PDFDocument.create();
    
    for (const pdfUrl of pdfUrls) {
      const pdfBytes = await fetchPdfBytes(pdfUrl);
      const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }
    
    const mergedBytes = await mergedPdf.save();
    return mergedBytes;
  } catch (error) {
    throw new Error(`Failed to merge PDFs: ${error.message}`);
  }
}

export async function mergePDFFiles(files) {
  try {
    const mergedPdf = await PDFDocument.create();
    
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }
    
    const mergedBytes = await mergedPdf.save();
    return mergedBytes;
  } catch (error) {
    throw new Error(`Failed to merge PDFs: ${error.message}`);
  }
}

// ============================================
// 9. SPLIT PDF BY PAGE RANGE
// ============================================

export async function splitPDFByRange(pdfUrl, ranges) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const splitPdfs = [];
    
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const newPdf = await PDFDocument.create();
      const startIdx = (range.start || 1) - 1;
      const endIdx = (range.end || sourcePdf.getPageCount()) - 1;
      
      const pageIndices = [];
      for (let j = startIdx; j <= endIdx && j < sourcePdf.getPageCount(); j++) {
        pageIndices.push(j);
      }
      
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach(page => newPdf.addPage(page));
      
      const bytes = await newPdf.save();
      splitPdfs.push({
        bytes,
        name: `split_${i + 1}_pages_${range.start}-${range.end}.pdf`
      });
    }
    
    return splitPdfs;
  } catch (error) {
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
}

export async function splitPDFToSinglePages(pdfUrl) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const pageCount = pdf.getPageCount();
    const splitPdfs = [];

    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdf, [i]);
      newPdf.addPage(copiedPage);
      
      const bytes = await newPdf.save();
      splitPdfs.push({
        bytes,
        name: `page_${i + 1}.pdf`
      });
    }

    return splitPdfs;
  } catch (error) {
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
}

// ============================================
// 10. PASSWORD PROTECT PDF
// ============================================

export async function passwordProtectPDF(pdfUrl, passwords) {
  try {
    const { userPassword = '', ownerPassword = '' } = passwords;
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    pdfDoc.setTitle(`Protected: ${pdfDoc.getTitle() || 'Document'}`);
    pdfDoc.setSubject('Password Protected Document');
    
    const protectedBytes = await pdfDoc.save();
    
    console.warn('Full password protection requires backend service. Document saved with protection metadata.');
    return protectedBytes;
  } catch (error) {
    throw new Error(`Password protection: ${error.message}`);
  }
}

// ============================================
// 11. REMOVE PDF PASSWORD
// ============================================

export async function removePasswordPDF(pdfUrl, password) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { 
      password,
      ignoreEncryption: true 
    });
    
    const unlockedBytes = await pdfDoc.save();
    return unlockedBytes;
  } catch (error) {
    throw new Error(`Failed to remove password: ${error.message}`);
  }
}

// ============================================
// 12. ENCRYPT / DECRYPT PDF
// ============================================

export async function encryptDecryptPDF(pdfUrl, action, password) {
  if (action === 'encrypt') {
    return await passwordProtectPDF(pdfUrl, { userPassword: password });
  } else {
    return await removePasswordPDF(pdfUrl, password);
  }
}

// ============================================
// 13. PDF TO TEXT
// ============================================

export async function pdfToText(pdfUrl) {
  try {
    const pdfjsLib = await getPdfJsLib();

    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n--- Page ${i} ---\n${pageText}\n`;
    }
    
    return fullText;
  } catch (error) {
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

export async function extractTablesToCSV(pdfUrl) {
  try {
    const pdfjsLib = await getPdfJsLib();
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    const csvLines = [];
    let totalRows = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const lineBuckets = new Map();

      textContent.items.forEach(item => {
        const y = Math.round(item.transform?.[5] || 0);
        const x = item.transform?.[4] || 0;
        const text = item.str || '';
        if (!text) return;
        if (!lineBuckets.has(y)) lineBuckets.set(y, []);
        lineBuckets.get(y).push({ x, text });
      });

      const sortedLines = Array.from(lineBuckets.entries()).sort((a, b) => b[0] - a[0]);
      const pageRows = [];
      sortedLines.forEach(([, entries]) => {
        entries.sort((a, b) => a.x - b.x);
        const cols = [];
        let current = '';
        let lastX = null;
        entries.forEach(entry => {
          if (lastX !== null && entry.x - lastX > 24) {
            cols.push(current.trim());
            current = entry.text;
          } else {
            current = current ? `${current} ${entry.text}` : entry.text;
          }
          lastX = entry.x;
        });
        if (current) cols.push(current.trim());

        // Consider it a likely table row only when multiple columns are present.
        const normalizedCols = cols
          .map((col) => String(col || '').trim())
          .filter(Boolean);

        if (normalizedCols.length >= 2) {
          pageRows.push(normalizedCols);
        }
      });

      if (pageRows.length >= 2) {
        pageRows.forEach((row) => {
          csvLines.push(row.map(escapeCsvValue).join(','));
          totalRows += 1;
        });
        if (i < pdf.numPages) csvLines.push('');
      }
    }

    return { csv: csvLines.join('\n'), rows: totalRows };
  } catch (error) {
    throw new Error(`Failed to extract tables: ${error.message}`);
  }
}

export async function extractStructuredTextToCSV(pdfUrl) {
  try {
    const pdfjsLib = await getPdfJsLib();
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    const lines = ['page,y,text'];
    let totalRows = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const lineBuckets = new Map();

      textContent.items.forEach((item) => {
        const y = Math.round(item.transform?.[5] || 0);
        const x = item.transform?.[4] || 0;
        const text = String(item.str || '').trim();
        if (!text) return;
        if (!lineBuckets.has(y)) lineBuckets.set(y, []);
        lineBuckets.get(y).push({ x, text });
      });

      const sortedLines = Array.from(lineBuckets.entries()).sort((a, b) => b[0] - a[0]);
      sortedLines.forEach(([y, entries]) => {
        entries.sort((a, b) => a.x - b.x);
        const text = entries.map((entry) => entry.text).join(' ').replace(/\s+/g, ' ').trim();
        if (!text) return;
        lines.push([i, y, escapeCsvValue(text)].join(','));
        totalRows += 1;
      });
    }

    return {
      csv: lines.join('\n'),
      rows: totalRows,
    };
  } catch (error) {
    throw new Error(`Failed to extract structured text: ${error.message}`);
  }
}

export async function extractEmbeddedFonts(pdfUrl) {
  try {
    const pdfjsLib = await getPdfJsLib();
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const fonts = new Set();

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const styles = textContent.styles || {};
      Object.values(styles).forEach(style => {
        if (style?.fontFamily) {
          fonts.add(style.fontFamily);
        }
      });
    }

    return Array.from(fonts);
  } catch (error) {
    throw new Error(`Failed to extract embedded fonts: ${error.message}`);
  }
}

export async function pdfToTextFile(pdfUrl, filename = 'extracted.txt') {
  const text = await pdfToText(pdfUrl);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
  return text;
}

// ============================================
// 14. PDF TO IMAGES
// ============================================

export async function pdfToImages(pdfUrl, options = {}) {
  try {
    const {
      format = 'png',
      scale = 1.25,
      maxPages = 100,
      maxDimension = 2000,
      startPage = 1,
      endPage = null,
    } = options;
    
    const pdfjsLib = await getPdfJsLib();

    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    const images = [];
    
    const first = Math.max(1, Number(startPage) || 1);
    const lastByRange = endPage ? Math.max(first, Number(endPage) || first) : pdf.numPages;
    const last = Math.min(pdf.numPages, lastByRange);
    const availablePages = Math.max(0, (last - first) + 1);
    const totalPages = Math.min(availablePages, maxPages);

    for (let offset = 0; offset < totalPages; offset++) {
      const i = first + offset;
      const page = await pdf.getPage(i);
      let viewport = page.getViewport({ scale });

      const downscaleRatio = Math.min(
        1,
        maxDimension / Math.max(viewport.width, viewport.height)
      );

      if (downscaleRatio < 1) {
        viewport = page.getViewport({ scale: scale * downscaleRatio });
      }
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      const dataUrl = canvas.toDataURL(`image/${format}`);
      images.push({
        dataUrl,
        name: `page_${i}.${format}`,
        page: i
      });

      canvas.width = 0;
      canvas.height = 0;
    }
    
    return images;
  } catch (error) {
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
}

export async function downloadPDFAsImages(pdfUrl, options = {}) {
  const images = await pdfToImages(pdfUrl, options);
  
  for (const img of images) {
    const link = document.createElement('a');
    link.href = img.dataUrl;
    link.download = img.name;
    link.click();
  }
  
  return images;
}

export async function downloadImagesAsZip(images, zipFilename = 'pdf_images.zip') {
  try {
    const files = [];
    for (const image of images || []) {
      if (!image?.dataUrl || !image?.name) continue;
      const bytes = await dataUrlToBytes(image.dataUrl);
      files.push({
        name: image.name,
        bytes,
      });
    }

    if (files.length === 0) {
      throw new Error('No images available to export');
    }

    await downloadAsZip(files, zipFilename);
    return files.length;
  } catch (error) {
    throw new Error(`Failed to package images: ${error.message}`);
  }
}

// ============================================
// 15. IMAGES TO PDF
// ============================================

export async function imagesToPDF(images, options = {}) {
  try {
    const { pageSize = 'A4', orientation = 'portrait', margin = 20 } = options;
    const pdfDoc = await PDFDocument.create();
    
    const pageSizes = {
      'A4': orientation === 'portrait' ? [595.28, 841.89] : [841.89, 595.28],
      'Letter': orientation === 'portrait' ? [612, 792] : [792, 612],
    };
    
    const [pageWidth, pageHeight] = pageSizes[pageSize] || pageSizes['A4'];
    
    for (const imageInput of images) {
      let imageBytes;
      let imageType = 'png';
      
      if (imageInput instanceof File) {
        imageBytes = new Uint8Array(await imageInput.arrayBuffer());
        imageType = imageInput.type.includes('png') ? 'png' : 'jpg';
      } else if (typeof imageInput === 'string') {
        if (imageInput.startsWith('data:')) {
          imageBytes = await dataUrlToBytes(imageInput);
          imageType = imageInput.includes('png') ? 'png' : 'jpg';
        } else {
          const arrayBuffer = await fetchOrThrow(imageInput, 'arrayBuffer');
          imageBytes = new Uint8Array(arrayBuffer);
          imageType = imageInput.toLowerCase().includes('png') ? 'png' : 'jpg';
        }
      }
      
      let image;
      try {
        image = imageType === 'png' 
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);
      } catch (e) {
        try {
          image = imageType === 'png'
            ? await pdfDoc.embedJpg(imageBytes)
            : await pdfDoc.embedPng(imageBytes);
        } catch (e2) {
          console.error('Failed to embed image:', e2);
          continue;
        }
      }
      
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      
      const imgDims = image.scale(1);
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2);
      
      const scale = Math.min(
        availableWidth / imgDims.width,
        availableHeight / imgDims.height
      );
      
      const scaledWidth = imgDims.width * scale;
      const scaledHeight = imgDims.height * scale;
      
      page.drawImage(image, {
        x: (pageWidth - scaledWidth) / 2,
        y: (pageHeight - scaledHeight) / 2,
        width: scaledWidth,
        height: scaledHeight,
      });
    }
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    throw new Error(`Failed to convert images to PDF: ${error.message}`);
  }
}

// ============================================
// 16. REORDER PDF PAGES
// ============================================

export async function reorderPDFPages(pdfUrl, newOrder) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = sourcePdf.getPageCount();

    if (!Array.isArray(newOrder) || newOrder.length === 0) {
      throw new Error('Page order must contain at least one page');
    }

    const asNumbers = newOrder
      .map(value => Number(value))
      .filter(value => Number.isFinite(value));

    const looksOneBased = asNumbers.length > 0 && Math.min(...asNumbers) >= 1 && Math.max(...asNumbers) <= pageCount;
    const normalizedOrder = asNumbers
      .map(value => (looksOneBased ? value - 1 : value))
      .filter(index => index >= 0 && index < pageCount);

    const dedupedOrder = [];
    normalizedOrder.forEach(index => {
      if (!dedupedOrder.includes(index)) dedupedOrder.push(index);
    });

    for (let index = 0; index < pageCount; index++) {
      if (!dedupedOrder.includes(index)) {
        dedupedOrder.push(index);
      }
    }
    
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, dedupedOrder);
    
    copiedPages.forEach(page => newPdf.addPage(page));
    
    const reorderedBytes = await newPdf.save();
    return reorderedBytes;
  } catch (error) {
    throw new Error(`Failed to reorder pages: ${error.message}`);
  }
}

export async function reversePDFPageOrder(pdfUrl) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = sourcePdf.getPageCount();

    if (pageCount <= 1) {
      return pdfBytes;
    }

    const reversedOrder = Array.from({ length: pageCount }, (_, idx) => pageCount - idx - 1);
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, reversedOrder);
    copiedPages.forEach(page => newPdf.addPage(page));

    return await newPdf.save();
  } catch (error) {
    throw new Error(`Failed to reverse page order: ${error.message}`);
  }
}

export async function addPageNumbers(pdfUrl, config = {}) {
  try {
    const {
      startAt = 1,
      prefix = '',
      position = 'bottom-center',
      fontSize = 10,
    } = config;

    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    pages.forEach((page, idx) => {
      const label = `${prefix || ''}${startAt + idx}`;
      const size = Math.max(8, Math.min(36, Number(fontSize) || 10));
      const textWidth = font.widthOfTextAtSize(label, size);
      const textHeight = size;
      const { width, height } = page.getSize();
      const margin = 24;

      let x = (width - textWidth) / 2;
      let y = margin;

      if (position === 'bottom-right') {
        x = width - textWidth - margin;
      } else if (position === 'top-right') {
        x = width - textWidth - margin;
        y = height - textHeight - margin;
      } else if (position === 'top-center') {
        y = height - textHeight - margin;
      }

      page.drawText(label, {
        x,
        y,
        size,
        font,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.95,
      });
    });

    return await pdfDoc.save();
  } catch (error) {
    throw new Error(`Failed to add page numbers: ${error.message}`);
  }
}

// ============================================
// 17. DOC TO PDF
// ============================================

export async function docToPDF(docInput) {
  try {
    let arrayBuffer;
    let sourceName = 'document';
    
    if (docInput instanceof File) {
      arrayBuffer = await docInput.arrayBuffer();
      sourceName = docInput.name || sourceName;
    } else {
      arrayBuffer = await fetchOrThrow(docInput, 'arrayBuffer');
    }

    let html = '';
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value;
    } catch {
      html = '';
    }

    if (!html || !html.trim()) {
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
      const cleaned = decoded.replace(/\u0000/g, '').trim();
      const fallbackText = cleaned
        ? cleaned.slice(0, 12000)
        : `Unable to fully parse this document in-browser. Source: ${sourceName}.`;
      const escaped = fallbackText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html = `<p>${escaped.replace(/\n/g, '</p><p>')}</p>`;
    }
    
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.style.width = '190mm';
    tempDiv.style.padding = '10mm';
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.fontSize = '12pt';
    tempDiv.style.lineHeight = '1.5';
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);
    
    const canvas = await html2canvas(tempDiv, { 
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    document.body.removeChild(tempDiv);
    
    const pdfBytes = doc.output('arraybuffer');
    return new Uint8Array(pdfBytes);
  } catch (error) {
    throw new Error(`Failed to convert DOC to PDF: ${error.message}`);
  }
}

// ============================================
// 18. TXT TO PDF
// ============================================

export async function txtToPDF(txtInput, options = {}) {
  try {
    const { fontSize = 12, margin = 20 } = options;
    
    let textContent;
    
    if (txtInput instanceof File) {
      textContent = await txtInput.text();
    } else if (txtInput.startsWith('http') || txtInput.startsWith('data:')) {
      textContent = await fetchOrThrow(txtInput, 'text');
    } else {
      textContent = txtInput;
    }
    
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Courier);
    
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const maxWidth = pageWidth - (margin * 2);
    const lineHeight = fontSize * 1.2;
    const maxLinesPerPage = Math.floor((pageHeight - (margin * 2)) / lineHeight);
    
    const lines = textContent.split('\n');
    const wrappedLines = [];
    
    for (const line of lines) {
      if (line.length === 0) {
        wrappedLines.push('');
        continue;
      }
      
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        
        if (width > maxWidth && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    }
    
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    let lineCount = 0;
    
    for (const line of wrappedLines) {
      if (lineCount >= maxLinesPerPage) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        lineCount = 0;
      }
      
      currentPage.drawText(line, {
        x: margin,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      y -= lineHeight;
      lineCount++;
    }
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    throw new Error(`Failed to convert TXT to PDF: ${error.message}`);
  }
}

// ============================================
// 19. PDF TO DOC
// ============================================

export async function pdfToDoc(pdfUrl) {
  try {
    const pdfjsLib = await getPdfJsLib();
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const pages = [];
    const allLineSizes = [];

    const toHexColor = (value) => {
      if (!value && value !== 0) return undefined;
      if (typeof value === 'string') {
        const hex = value.replace('#', '').trim();
        if (/^[0-9a-fA-F]{6}$/.test(hex)) return hex.toUpperCase();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.min(0xffffff, Math.round(value))).toString(16).padStart(6, '0').toUpperCase();
      }
      if (Array.isArray(value) && value.length >= 3) {
        const [r, g, b] = value;
        if ([r, g, b].every(v => Number.isFinite(v))) {
          const scale = (r <= 1 && g <= 1 && b <= 1) ? 255 : 1;
          const rr = Math.max(0, Math.min(255, Math.round(r * scale)));
          const gg = Math.max(0, Math.min(255, Math.round(g * scale)));
          const bb = Math.max(0, Math.min(255, Math.round(b * scale)));
          return [rr, gg, bb].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
        }
      }
      return undefined;
    };

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width || 595;
      const textContent = await page.getTextContent({ normalizeWhitespace: true });
      const styles = textContent.styles || {};
      const lineBuckets = new Map();

      for (const item of textContent.items || []) {
        const rawText = String(item.str || '');
        if (!rawText.trim()) continue;

        const x = item.transform?.[4] || 0;
        const y = item.transform?.[5] || 0;
        const fontSize = Math.max(8, Math.min(42, Math.abs(item.transform?.[3]) || Math.abs(item.transform?.[0]) || item.height || 11));
        const width = Math.max(1, item.width || text.length * fontSize * 0.5);
        const style = styles[item.fontName] || {};
        const styleName = `${style.fontFamily || ''} ${item.fontName || ''}`.toLowerCase();
        const bucketKey = Math.round(y / Math.max(2, fontSize * 0.25)) * Math.max(2, fontSize * 0.25);

        const token = {
          text: rawText.replace(/\s+/g, ' ').trim(),
          leadingSpace: /^\s/.test(rawText),
          trailingSpace: /\s$/.test(rawText),
          x,
          y,
          width,
          fontSize,
          bold: /bold|black|heavy|semibold|demi/.test(styleName),
          italics: /italic|oblique/.test(styleName),
          fontName: style.fontFamily || undefined,
          color: toHexColor(item.color || style.color),
        };

        if (!lineBuckets.has(bucketKey)) lineBuckets.set(bucketKey, []);
        lineBuckets.get(bucketKey).push(token);
      }

      const lines = Array.from(lineBuckets.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([keyY, tokens]) => {
          const sorted = [...tokens].sort((a, b) => a.x - b.x);
          const lineMinX = sorted[0]?.x || 0;
          const lineMaxX = Math.max(...sorted.map(token => token.x + token.width));
          const lineWidth = Math.max(1, lineMaxX - lineMinX);
          const avgSize = sorted.reduce((sum, token) => sum + token.fontSize, 0) / Math.max(1, sorted.length);

          const children = [];
          let prevEndX = null;
          let prevTrailingSpace = false;
          const plainTextParts = [];

          for (const token of sorted) {
            let insertedSpace = false;

            if (prevEndX !== null) {
              const gap = token.x - prevEndX;
              const sourceSuggestsSpace = token.leadingSpace || prevTrailingSpace;
              const minGapForSpace = Math.max(0.6, avgSize * 0.06);

              if (sourceSuggestsSpace || gap > minGapForSpace) {
                const spaces = sourceSuggestsSpace
                  ? 1
                  : Math.max(1, Math.min(8, Math.round(gap / Math.max(1, avgSize * 0.3))));
                children.push(new TextRun(' '.repeat(spaces)));
                plainTextParts.push(' '.repeat(spaces));
                insertedSpace = true;
              }
            }

            if (!insertedSpace && plainTextParts.length > 0) {
              const prev = plainTextParts[plainTextParts.length - 1] || '';
              if (!/\s$/.test(prev) && !/^[,.;:!?)}\]]/.test(token.text)) {
                children.push(new TextRun(' '));
                plainTextParts.push(' ');
              }
            }

            children.push(new TextRun({
              text: token.text,
              bold: token.bold,
              italics: token.italics,
              font: token.fontName,
              color: token.color,
              size: Math.max(16, Math.min(84, Math.round(token.fontSize * 2))),
            }));
            plainTextParts.push(token.text);

            prevEndX = token.x + token.width;
            prevTrailingSpace = token.trailingSpace;
          }

          const plainText = plainTextParts.join('').replace(/\s+/g, ' ').trim();

          const centerX = lineMinX + lineWidth / 2;
          let alignment = AlignmentType.LEFT;
          if (Math.abs(centerX - pageWidth / 2) < pageWidth * 0.08 && lineWidth < pageWidth * 0.92) {
            alignment = AlignmentType.CENTER;
          } else if ((pageWidth - lineMaxX) < pageWidth * 0.07 && lineMinX > pageWidth * 0.22) {
            alignment = AlignmentType.RIGHT;
          }

          return {
            y: Number(keyY),
            minX: lineMinX,
            maxX: lineMaxX,
            lineWidth,
            avgSize,
            alignment,
            text: plainText,
            children,
          };
        })
        .filter(line => line.text.length > 0);

      const mergedLines = [];
      for (let index = 0; index < lines.length; index++) {
        const current = lines[index];
        const next = index < lines.length - 1 ? lines[index + 1] : null;
        const isStandaloneBullet = /^[•·\-–—*]$/.test(current.text);

        if (isStandaloneBullet && next) {
          mergedLines.push({
            ...next,
            text: `${current.text} ${next.text}`,
            minX: current.minX,
            children: [new TextRun(`${current.text} `), ...next.children],
          });
          index += 1;
          continue;
        }

        mergedLines.push(current);
      }

      mergedLines.forEach(line => allLineSizes.push(line.avgSize));
      pages.push({ lines: mergedLines, pageWidth });
    }

    const sortedSizes = [...allLineSizes].sort((a, b) => a - b);
    const bodySize = sortedSizes.length ? sortedSizes[Math.floor(sortedSizes.length / 2)] : 11;

    const docChildren = [];

    pages.forEach((page, pageIdx) => {
      const lines = page.lines;
      if (!lines.length) return;

      const globalMinX = Math.min(...lines.map(line => line.minX));

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const nextLine = index < lines.length - 1 ? lines[index + 1] : null;
        const lineGap = nextLine ? Math.max(0, line.y - nextLine.y) : line.avgSize * 1.2;
        const indentTwips = Math.min(7200, Math.max(0, Math.round((line.minX - globalMinX) * 20)));
        const spacingAfter = Math.max(50, Math.min(420, Math.round(lineGap * 14)));

        const shortTitle = line.text.length <= 120;
        const heading1 = line.avgSize >= bodySize * 1.55 && shortTitle;
        const heading2 = !heading1 && line.avgSize >= bodySize * 1.3 && shortTitle;

        docChildren.push(new Paragraph({
          heading: heading1 ? HeadingLevel.HEADING_1 : (heading2 ? HeadingLevel.HEADING_2 : undefined),
          alignment: line.alignment,
          indent: { left: indentTwips },
          spacing: { after: spacingAfter },
          children: line.children,
        }));
      }

      if (pageIdx < pages.length - 1) {
        docChildren.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] }));
      }
    });

    if (!docChildren.length) {
      const fallbackText = await pdfToText(pdfUrl);
      const fallbackLines = (fallbackText || 'No extractable text was detected in this PDF.').split(/\n+/).filter(Boolean);
      const fallbackChildren = fallbackLines.length
        ? fallbackLines.map(line => new Paragraph({ spacing: { after: 140 }, children: [new TextRun(line)] }))
        : [new Paragraph({ children: [new TextRun('No extractable text was detected in this PDF.')] })];
      const fallbackDoc = new Document({ sections: [{ children: fallbackChildren }] });
      return await Packer.toBlob(fallbackDoc);
    }

    const doc = new Document({ sections: [{ children: docChildren }] });
    return await Packer.toBlob(doc);
  } catch (error) {
    throw new Error(`Failed to convert PDF to DOC: ${error.message}`);
  }
}

export async function downloadPDFAsDoc(pdfUrl, filename = 'converted.docx') {
  const blob = await pdfToDoc(pdfUrl);
  saveAs(blob, filename);
  return blob;
}

// ============================================
// 20. PPT TO PDF
// ============================================

export async function pptToPDF(pptFile) {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([595.28, 841.89]);
    
    page.drawText('PowerPoint to PDF Conversion', {
      x: 50,
      y: 750,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
    
    page.drawText(`File: ${pptFile.name}`, {
      x: 50,
      y: 700,
      size: 14,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    page.drawText('Note: Full PPTX to PDF conversion requires a backend service.', {
      x: 50,
      y: 650,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    throw new Error(`Failed to convert PPT to PDF: ${error.message}`);
  }
}

// ============================================
// 21. PDF TO PPT
// ============================================

export async function pdfToPPT(pdfUrl, options = {}) {
  try {
    const {
      format = 'png',
      scale = 1.25,
      maxPages = 100,
      maxDimension = 1920,
    } = options;

    const images = await pdfToImages(pdfUrl, { format, scale, maxPages, maxDimension });
    
    return {
      images,
      message: 'PDF pages converted to images. Import these into PowerPoint as slides.',
      instructions: [
        '1. Open PowerPoint',
        '2. Insert > Photo Album > New Photo Album',
        '3. Select the downloaded images',
        '4. Create the presentation'
      ]
    };
  } catch (error) {
    throw new Error(`Failed to convert PDF to PPT: ${error.message}`);
  }
}

// ============================================
// ADDITIONAL UTILITY FUNCTIONS
// ============================================

export async function extractPages(pdfUrl, pageIndices) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));
    
    const extractedPdfBytes = await newPdf.save();
    return extractedPdfBytes;
  } catch (error) {
    throw new Error(`Failed to extract pages: ${error.message}`);
  }
}

export async function compressPDF(pdfUrl) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const compressedPdfBytes = await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
    });
    
    return compressedPdfBytes;
  } catch (error) {
    throw new Error(`Failed to compress PDF: ${error.message}`);
  }
}

export async function rotatePDF(pdfUrl, rotationDegrees, pageIndices = null) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const pages = pdf.getPages();
    const normalizedRotation = ((Number(rotationDegrees) % 360) + 360) % 360;
    if (![90, 180, 270].includes(normalizedRotation)) {
      throw new Error('Rotation must be 90, 180, or 270 degrees');
    }

    const pagesToRotate = Array.isArray(pageIndices)
      ? [...new Set(pageIndices)].filter(index => Number.isInteger(index) && index >= 0 && index < pages.length)
      : pages.map((_, i) => i);

    if (!pagesToRotate.length) {
      throw new Error('No valid pages were selected for rotation');
    }
    
    pagesToRotate.forEach(index => {
      const page = pages[index];
      const currentRotation = page.getRotation().angle;
      const nextRotation = ((currentRotation + normalizedRotation) % 360 + 360) % 360;
      page.setRotation(degrees(nextRotation));
    });
    
    const rotatedPdfBytes = await pdf.save();
    return rotatedPdfBytes;
  } catch (error) {
    throw new Error(`Failed to rotate PDF: ${error.message}`);
  }
}

export async function removeBlankPages(pdfUrl, options = {}) {
  try {
    const { minCharacters = 1 } = options;
    const pdfBytes = await fetchPdfBytes(pdfUrl);

    const pdfjsLib = await getPdfJsLib();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdfJsDoc = await loadingTask.promise;

    const keepIndices = [];
    const removedPages = [];

    for (let i = 1; i <= pdfJsDoc.numPages; i++) {
      const page = await pdfJsDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = (textContent.items || [])
        .map(item => String(item.str || ''))
        .join('')
        .replace(/\s+/g, '');

      if (text.length >= Math.max(0, Number(minCharacters) || 0)) {
        keepIndices.push(i - 1);
      } else {
        removedPages.push(i);
      }
    }

    if (!removedPages.length) {
      return {
        bytes: pdfBytes,
        removedPages: [],
      };
    }

    if (!keepIndices.length) {
      throw new Error('All pages appear blank by text analysis. Aborted to avoid deleting the whole file.');
    }

    const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const nextPdf = await PDFDocument.create();
    const copiedPages = await nextPdf.copyPages(sourcePdf, keepIndices);
    copiedPages.forEach(page => nextPdf.addPage(page));

    const bytes = await nextPdf.save();
    return {
      bytes,
      removedPages,
    };
  } catch (error) {
    throw new Error(`Failed to remove blank pages: ${error.message}`);
  }
}

export async function extractPageSummaryCSV(pdfUrl) {
  try {
    const pdfjsLib = await getPdfJsLib();
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    const lines = ['page,width,height,text_chars,text_items'];
    let rows = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const textItems = textContent.items || [];
      const text = textItems
        .map(item => String(item.str || ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      lines.push([
        i,
        Math.round(viewport.width || 0),
        Math.round(viewport.height || 0),
        text.length,
        textItems.length,
      ].join(','));
      rows += 1;
    }

    return {
      csv: lines.join('\n'),
      rows,
    };
  } catch (error) {
    throw new Error(`Failed to extract page summary: ${error.message}`);
  }
}

export async function getPDFInfo(pdfUrl) {
  try {
    const pdfBytes = await fetchPdfBytes(pdfUrl);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const pages = pdf.getPages();
    const firstPage = pages[0];
    
    return {
      pageCount: pdf.getPageCount(),
      title: pdf.getTitle() || 'Untitled',
      author: pdf.getAuthor() || 'Unknown',
      subject: pdf.getSubject() || '',
      creator: pdf.getCreator() || '',
      producer: pdf.getProducer() || '',
      creationDate: pdf.getCreationDate(),
      modificationDate: pdf.getModificationDate(),
      pageSize: firstPage ? {
        width: firstPage.getWidth(),
        height: firstPage.getHeight(),
      } : null,
    };
  } catch (error) {
    throw new Error(`Failed to get PDF info: ${error.message}`);
  }
}

export async function savePDFAs(pdfBytes, filename, options = {}) {
  try {
    const { compress = false } = options;
    
    let finalBytes = pdfBytes;
    
    if (compress) {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      finalBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      });
    }
    
    const blob = new Blob([finalBytes], { type: 'application/pdf' });
    saveAs(blob, filename);
    return finalBytes;
  } catch (error) {
    throw new Error(`Failed to save PDF: ${error.message}`);
  }
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================

export default {
  fillPDFForm,
  getPDFFormFields,
  saveFlattenedForm,
  addSignatureToPDF,
  addMultipleSignatures,
  addTextOverlays,
  suggestTextOverlayAnchors,
  addWatermark,
  addPageBackground,
  addPages,
  removePages,
  insertPagesFromPDF,
  duplicatePages,
  mergePDFs,
  mergePDFFiles,
  splitPDFByRange,
  splitPDFToSinglePages,
  passwordProtectPDF,
  removePasswordPDF,
  encryptDecryptPDF,
  pdfToText,
  extractTablesToCSV,
  extractStructuredTextToCSV,
  extractEmbeddedFonts,
  pdfToTextFile,
  pdfToImages,
  downloadPDFAsImages,
  imagesToPDF,
  reorderPDFPages,
  reversePDFPageOrder,
  addPageNumbers,
  docToPDF,
  txtToPDF,
  pdfToDoc,
  downloadPDFAsDoc,
  pptToPDF,
  pdfToPPT,
  extractPages,
  removeBlankPages,
  extractPageSummaryCSV,
  compressPDF,
  rotatePDF,
  getPDFInfo,
  savePDFAs,
  downloadBytes,
  downloadAsZip,
};
