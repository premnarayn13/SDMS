import EXIF from 'exif-js';
import { jsPDF } from 'jspdf';

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatToMime = (format = 'png') => {
  const normalized = String(format || 'png').toLowerCase();
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'webp') return 'image/webp';
  return 'image/png';
};

const parseExif = (img) => new Promise((resolve) => {
  try {
    EXIF.getData(img, function onExifLoaded() {
      const tags = EXIF.getAllTags(this) || {};
      resolve(tags);
    });
  } catch {
    resolve({});
  }
});

export const extractImageMetadata = async (src, fileInfo = {}) => {
  const img = await loadImage(src);
  const exif = await parseExif(img);

  const cameraMake = exif.Make || '';
  const cameraModel = exif.Model || '';
  const camera = [cameraMake, cameraModel].filter(Boolean).join(' ').trim();

  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    resolution: `${img.naturalWidth} x ${img.naturalHeight}`,
    mimeType: fileInfo.mimeType || 'image/*',
    size: fileInfo.size || 0,
    createdAt: exif.DateTimeOriginal || exif.DateTime || fileInfo.date || '',
    camera: camera || 'Unknown',
    iso: exif.ISOSpeedRatings || exif.ISO || null,
    aperture: exif.FNumber || null,
    shutter: exif.ExposureTime || null,
    focalLength: exif.FocalLength || null,
    exif
  };
};

export const transformImage = async (src, options = {}) => {
  const {
    rotate = 0,
    flipH = false,
    flipV = false,
    brightness = 100,
    contrast = 100,
    grayscale = false,
    crop = null,
    resize = null,
    format = 'png',
    quality = 0.92
  } = options;

  const img = await loadImage(src);
  const sourceX = crop?.x ?? 0;
  const sourceY = crop?.y ?? 0;
  const sourceWidth = crop?.width ?? img.naturalWidth;
  const sourceHeight = crop?.height ?? img.naturalHeight;

  const targetWidth = resize?.width ? Math.round(resize.width) : sourceWidth;
  const targetHeight = resize?.height ? Math.round(resize.height) : sourceHeight;

  const rotation = ((rotate % 360) + 360) % 360;
  const swapAxes = rotation === 90 || rotation === 270;

  const canvas = document.createElement('canvas');
  canvas.width = swapAxes ? targetHeight : targetWidth;
  canvas.height = swapAxes ? targetWidth : targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.filter = [
    `brightness(${clamp(brightness, 0, 400)}%)`,
    `contrast(${clamp(contrast, 0, 400)}%)`,
    grayscale ? 'grayscale(100%)' : 'grayscale(0%)'
  ].join(' ');

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    -targetWidth / 2,
    -targetHeight / 2,
    targetWidth,
    targetHeight
  );

  const mimeType = formatToMime(format);
  return canvas.toDataURL(mimeType, clamp(quality, 0.1, 1));
};

export const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export const convertImageFormat = async (src, targetFormat = 'png', quality = 0.92) => {
  return transformImage(src, { format: targetFormat, quality });
};

export const compressImage = async (src, quality = 0.7) => {
  return transformImage(src, { format: 'jpeg', quality });
};

export const removeImageMetadata = async (src, format = 'png') => {
  // Re-encoding through canvas strips EXIF metadata.
  return transformImage(src, { format, quality: 0.92 });
};

export const imageToPdfBlob = async (src, fileName = 'image.pdf') => {
  const img = await loadImage(src);
  const orientation = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const scale = Math.min(pageWidth / img.naturalWidth, pageHeight / img.naturalHeight);
  const renderWidth = img.naturalWidth * scale;
  const renderHeight = img.naturalHeight * scale;
  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(src, 'PNG', x, y, renderWidth, renderHeight);
  return pdf.output('blob', { filename: fileName });
};

export const imageToTextOcr = async (src) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(src);
    return result?.data?.text || '';
  } finally {
    await worker.terminate();
  }
};
