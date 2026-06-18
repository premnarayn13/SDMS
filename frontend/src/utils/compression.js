/**
 * Compression Utility for DocMatrix DMS
 * File/Folder compression (ZIP), decompression
 */

import JSZip from 'jszip';
import pako from 'pako';

// Compression configuration
const COMPRESSION_CONFIG = {
  DEFAULT_LEVEL: 6, // 0-9, where 9 is maximum compression
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large files
  SUPPORTED_FORMATS: ['zip', 'gzip', 'deflate']
};

// Compress data using DEFLATE (gzip-compatible)
export const compressData = (data, level = COMPRESSION_CONFIG.DEFAULT_LEVEL) => {
  try {
    let inputData;
    if (typeof data === 'string') {
      inputData = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      inputData = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      inputData = data;
    } else {
      inputData = new TextEncoder().encode(JSON.stringify(data));
    }
    
    const compressed = pako.deflate(inputData, { level });
    
    return {
      success: true,
      data: compressed,
      originalSize: inputData.length,
      compressedSize: compressed.length,
      compressionRatio: ((1 - compressed.length / inputData.length) * 100).toFixed(1)
    };
  } catch (error) {
    console.error('Compression failed:', error);
    return { success: false, error: error.message };
  }
};

// Decompress DEFLATE data
export const decompressData = (compressedData) => {
  try {
    const data = compressedData instanceof Uint8Array 
      ? compressedData 
      : new Uint8Array(compressedData);
    
    const decompressed = pako.inflate(data);
    
    return {
      success: true,
      data: decompressed
    };
  } catch (error) {
    console.error('Decompression failed:', error);
    return { success: false, error: error.message };
  }
};

// Compress to GZIP format
export const compressToGzip = (data, level = COMPRESSION_CONFIG.DEFAULT_LEVEL) => {
  try {
    let inputData;
    if (typeof data === 'string') {
      inputData = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      inputData = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      inputData = data;
    } else {
      inputData = new TextEncoder().encode(JSON.stringify(data));
    }
    
    const compressed = pako.gzip(inputData, { level });
    
    return {
      success: true,
      data: compressed,
      originalSize: inputData.length,
      compressedSize: compressed.length,
      compressionRatio: ((1 - compressed.length / inputData.length) * 100).toFixed(1)
    };
  } catch (error) {
    console.error('GZIP compression failed:', error);
    return { success: false, error: error.message };
  }
};

// Decompress GZIP data
export const decompressGzip = (compressedData) => {
  try {
    const data = compressedData instanceof Uint8Array 
      ? compressedData 
      : new Uint8Array(compressedData);
    
    const decompressed = pako.ungzip(data);
    
    return {
      success: true,
      data: decompressed
    };
  } catch (error) {
    console.error('GZIP decompression failed:', error);
    return { success: false, error: error.message };
  }
};

// Compress a single file
export const compressFile = async (file, options = {}) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = compressData(new Uint8Array(arrayBuffer), options.level);
    
    if (!result.success) return result;
    
    return {
      ...result,
      filename: file.name,
      originalName: file.name,
      compressedName: `${file.name}.gz`
    };
  } catch (error) {
    console.error('File compression failed:', error);
    return { success: false, error: error.message };
  }
};

// Decompress a file
export const decompressFile = async (compressedData, originalName) => {
  try {
    const result = decompressData(compressedData);
    if (!result.success) return result;
    
    const blob = new Blob([result.data]);
    
    return {
      success: true,
      blob,
      filename: originalName.replace(/\.gz$/, '')
    };
  } catch (error) {
    console.error('File decompression failed:', error);
    return { success: false, error: error.message };
  }
};

// Create ZIP archive from multiple files
export const createZipArchive = async (files, options = {}) => {
  try {
    const zip = new JSZip();
    const compressionLevel = options.level || COMPRESSION_CONFIG.DEFAULT_LEVEL;
    let totalOriginalSize = 0;
    
    // Add files to zip
    for (const file of files) {
      let data, name, path;
      
      if (file instanceof File) {
        data = await file.arrayBuffer();
        name = file.name;
        path = file.webkitRelativePath || file.name;
        totalOriginalSize += file.size;
      } else {
        // Assume {name, data, path?} object
        data = file.data instanceof ArrayBuffer 
          ? file.data 
          : file.data instanceof Uint8Array 
            ? file.data.buffer 
            : new TextEncoder().encode(file.data);
        name = file.name;
        path = file.path || file.name;
        totalOriginalSize += data.byteLength;
      }
      
      // Handle folder structure
      if (path && path.includes('/')) {
        zip.file(path, data, { 
          compression: 'DEFLATE',
          compressionOptions: { level: compressionLevel }
        });
      } else {
        zip.file(name, data, { 
          compression: 'DEFLATE',
          compressionOptions: { level: compressionLevel }
        });
      }
    }
    
    // Generate zip
    const content = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel }
    }, (metadata) => {
      if (options.onProgress) {
        options.onProgress(metadata.percent);
      }
    });
    
    const filename = options.filename || `archive_${Date.now()}.zip`;
    
    return {
      success: true,
      data: content,
      filename,
      originalSize: totalOriginalSize,
      compressedSize: content.length,
      compressionRatio: ((1 - content.length / totalOriginalSize) * 100).toFixed(1),
      fileCount: files.length
    };
  } catch (error) {
    console.error('ZIP creation failed:', error);
    return { success: false, error: error.message };
  }
};

// Extract ZIP archive
export const extractZipArchive = async (zipData, options = {}) => {
  try {
    const zip = await JSZip.loadAsync(zipData);
    const files = [];
    let totalExtractedSize = 0;
    
    const filePromises = [];
    
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir) {
        filePromises.push(
          zipEntry.async('uint8array').then(content => {
            totalExtractedSize += content.length;
            files.push({
              name: zipEntry.name.split('/').pop(),
              path: relativePath,
              data: content,
              size: content.length,
              date: zipEntry.date
            });
            
            if (options.onProgress) {
              options.onProgress((files.length / Object.keys(zip.files).length) * 100);
            }
          })
        );
      }
    });
    
    await Promise.all(filePromises);
    
    return {
      success: true,
      files,
      fileCount: files.length,
      totalSize: totalExtractedSize
    };
  } catch (error) {
    console.error('ZIP extraction failed:', error);
    return { success: false, error: error.message };
  }
};

// Create folder as ZIP (preserving structure)
export const compressFolder = async (folderFiles, folderName, options = {}) => {
  try {
    const zip = new JSZip();
    const folder = zip.folder(folderName);
    const compressionLevel = options.level || COMPRESSION_CONFIG.DEFAULT_LEVEL;
    let totalOriginalSize = 0;
    
    // Recursively add files maintaining folder structure
    const addFilesToZip = async (files, parentFolder) => {
      for (const item of files) {
        if (item.isDirectory && item.children) {
          const subFolder = parentFolder.folder(item.name);
          await addFilesToZip(item.children, subFolder);
        } else {
          let data;
          if (item.file instanceof File) {
            data = await item.file.arrayBuffer();
            totalOriginalSize += item.file.size;
          } else if (item.data) {
            data = item.data instanceof ArrayBuffer 
              ? item.data 
              : item.data instanceof Uint8Array 
                ? item.data.buffer 
                : new TextEncoder().encode(item.data);
            totalOriginalSize += data.byteLength;
          }
          
          if (data) {
            parentFolder.file(item.name, data, {
              compression: 'DEFLATE',
              compressionOptions: { level: compressionLevel }
            });
          }
        }
      }
    };
    
    await addFilesToZip(folderFiles, folder);
    
    const content = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel }
    }, (metadata) => {
      if (options.onProgress) {
        options.onProgress(metadata.percent);
      }
    });
    
    return {
      success: true,
      data: content,
      filename: `${folderName}.zip`,
      originalSize: totalOriginalSize,
      compressedSize: content.length,
      compressionRatio: totalOriginalSize > 0 
        ? ((1 - content.length / totalOriginalSize) * 100).toFixed(1) 
        : '0'
    };
  } catch (error) {
    console.error('Folder compression failed:', error);
    return { success: false, error: error.message };
  }
};

// Get compression statistics
export const getCompressionStats = (originalSize, compressedSize) => {
  const ratio = originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;
  const savings = originalSize - compressedSize;
  
  return {
    originalSize,
    compressedSize,
    savings,
    ratio: ratio.toFixed(1),
    readable: {
      original: formatBytes(originalSize),
      compressed: formatBytes(compressedSize),
      savings: formatBytes(savings)
    }
  };
};

// Estimate compression ratio for file type
export const estimateCompression = (fileType) => {
  const highCompression = ['txt', 'json', 'xml', 'html', 'css', 'js', 'csv', 'log', 'md'];
  const mediumCompression = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'bmp', 'tiff'];
  const lowCompression = ['pdf', 'png', 'gif'];
  const noCompression = ['jpg', 'jpeg', 'mp3', 'mp4', 'zip', 'rar', '7z', 'gz'];
  
  const ext = fileType.toLowerCase().replace('.', '');
  
  if (highCompression.includes(ext)) {
    return { expected: '60-80%', recommendation: 'High compression recommended' };
  } else if (mediumCompression.includes(ext)) {
    return { expected: '30-50%', recommendation: 'Medium compression recommended' };
  } else if (lowCompression.includes(ext)) {
    return { expected: '10-20%', recommendation: 'Low compression expected' };
  } else if (noCompression.includes(ext)) {
    return { expected: '0-5%', recommendation: 'Already compressed, minimal benefit' };
  }
  
  return { expected: '20-40%', recommendation: 'Compression recommended' };
};

// Batch compress multiple files
export const batchCompress = async (files, options = {}) => {
  const results = [];
  let totalOriginal = 0;
  let totalCompressed = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await compressFile(file, options);
    
    if (result.success) {
      totalOriginal += result.originalSize;
      totalCompressed += result.compressedSize;
    }
    
    results.push({
      file: file.name,
      ...result
    });
    
    if (options.onProgress) {
      options.onProgress(((i + 1) / files.length) * 100, file.name);
    }
  }
  
  return {
    success: true,
    results,
    summary: {
      totalFiles: files.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalOriginalSize: totalOriginal,
      totalCompressedSize: totalCompressed,
      overallRatio: totalOriginal > 0 
        ? ((1 - totalCompressed / totalOriginal) * 100).toFixed(1) 
        : '0'
    }
  };
};

// Helper: Format bytes to human readable
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Check if file is already compressed
export const isCompressed = (filename) => {
  const compressedExtensions = [
    'zip', 'rar', '7z', 'gz', 'bz2', 'xz', 'lz', 'lzma',
    'tar.gz', 'tgz', 'tar.bz2', 'tbz2',
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'mp3', 'mp4', 'avi', 'mkv', 'webm',
    'pdf'
  ];
  
  const ext = filename.split('.').pop().toLowerCase();
  return compressedExtensions.includes(ext);
};

export default {
  compressData,
  decompressData,
  compressToGzip,
  decompressGzip,
  compressFile,
  decompressFile,
  createZipArchive,
  extractZipArchive,
  compressFolder,
  getCompressionStats,
  estimateCompression,
  batchCompress,
  isCompressed,
  COMPRESSION_CONFIG
};
