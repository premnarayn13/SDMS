/**
 * PDF POWER TOOLS - Advanced PDF manipulation utilities
 * 20 Professional Features for Complete PDF Management
 * Uses pdf-lib, jsPDF, and other libraries for comprehensive PDF operations
 */

import { PDFDocument, rgb, StandardFonts, PDFTextField, PDFCheckBox, degrees } from 'pdf-lib';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import mammoth from 'mammoth';

/**
 * 1. MERGE MULTIPLE PDFs
 * Combine multiple PDFs into one document
 * @param {string[]} pdfUrls - Array of PDF data URLs or blob URLs
 * @returns {Promise<Uint8Array>} - Merged PDF as byte array
 */
export async function mergePDFs(pdfUrls) {
  try {
    const mergedPdf = await PDFDocument.create();

    for (const url of pdfUrls) {
      const response = await fetch(url);
      const pdfBytes = await response.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBytes);
      
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    return mergedPdfBytes;
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw new Error(`Failed to merge PDFs: ${error.message}`);
  }
}

/**
 * Split a PDF into separate single-page PDFs
 * @param {string} pdfUrl - PDF data URL or blob URL
 * @returns {Promise<Uint8Array[]>} - Array of PDF byte arrays, one per page
 */
export async function splitPDF(pdfUrl) {
  try {
    // Fetch and load the PDF
    const response = await fetch(pdfUrl);
    const pdfBytes = await response.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    
    const pageCount = pdf.getPageCount();
    const splitPdfs = [];

    // Create a separate PDF for each page
    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdf, [i]);
      newPdf.addPage(copiedPage);
      
      const pdfBytes = await newPdf.save();
      splitPdfs.push(pdfBytes);
    }

    return splitPdfs;
  } catch (error) {
    console.error('Error splitting PDF:', error);
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
}

/**
 * Extract specific pages from a PDF
 * @param {string} pdfUrl - PDF data URL or blob URL
 * @param {number[]} pageIndices - Array of page indices to extract (0-based)
 * @returns {Promise<Uint8Array>} - Extracted pages as a new PDF
 */
export async function extractPages(pdfUrl, pageIndices) {
  try {
    // Fetch and load the PDF
    const response = await fetch(pdfUrl);
    const pdfBytes = await response.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    
    // Create a new PDF with extracted pages
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));
    
    const extractedPdfBytes = await newPdf.save();
    return extractedPdfBytes;
  } catch (error) {
    console.error('Error extracting pages:', error);
    throw new Error(`Failed to extract pages: ${error.message}`);
  }
}

/**
 * Compress a PDF by reducing quality
 * @param {string} pdfUrl - PDF data URL or blob URL
 * @returns {Promise<Uint8Array>} - Compressed PDF
 */
export async function compressPDF(pdfUrl) {
  try {
    // Fetch and load the PDF
    const response = await fetch(pdfUrl);
    const pdfBytes = await response.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    
    // Save with compression options
    // Note: pdf-lib has limited compression capabilities
    // For better compression, you'd need a backend service
    const compressedPdfBytes = await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
    });
    
    return compressedPdfBytes;
  } catch (error) {
    console.error('Error compressing PDF:', error);
    throw new Error(`Failed to compress PDF: ${error.message}`);
  }
}

/**
 * Rotate pages in a PDF
 * @param {string} pdfUrl - PDF data URL or blob URL
 * @param {number} degrees - Rotation angle (90, 180, or 270)
 * @param {number[]} pageIndices - Array of page indices to rotate (0-based). If null, rotates all pages
 * @returns {Promise<Uint8Array>} - Rotated PDF
 */
export async function rotatePDF(pdfUrl, degrees, pageIndices = null) {
  try {
    // Fetch and load the PDF
    const response = await fetch(pdfUrl);
    const pdfBytes = await response.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    
    const pages = pdf.getPages();
    const pagesToRotate = pageIndices || pages.map((_, i) => i);
    
    // Rotate specified pages
    pagesToRotate.forEach(index => {
      if (index >= 0 && index < pages.length) {
        const page = pages[index];
        const currentRotation = page.getRotation().angle;
        page.setRotation({ type: 'degrees', angle: (currentRotation + degrees) % 360 });
      }
    });
    
    const rotatedPdfBytes = await pdf.save();
    return rotatedPdfBytes;
  } catch (error) {
    console.error('Error rotating PDF:', error);
    throw new Error(`Failed to rotate PDF: ${error.message}`);
  }
}

/**
 * Get PDF metadata and page count
 * @param {string} pdfUrl - PDF data URL or blob URL
 * @returns {Promise<object>} - PDF metadata
 */
export async function getPDFInfo(pdfUrl) {
  try {
    const response = await fetch(pdfUrl);
    const pdfBytes = await response.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    
    return {
      pageCount: pdf.getPageCount(),
      title: pdf.getTitle(),
      author: pdf.getAuthor(),
      subject: pdf.getSubject(),
      creator: pdf.getCreator(),
      producer: pdf.getProducer(),
      creationDate: pdf.getCreationDate(),
      modificationDate: pdf.getModificationDate(),
    };
  } catch (error) {
    console.error('Error getting PDF info:', error);
    throw new Error(`Failed to get PDF info: ${error.message}`);
  }
}

export default {
  mergePDFs,
  splitPDF,
  extractPages,
  compressPDF,
  rotatePDF,
  getPDFInfo,
};
