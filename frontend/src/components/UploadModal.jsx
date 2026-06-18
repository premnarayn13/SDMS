import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { Icons } from '../utils/helpers';

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

export default function UploadModal({ isOpen, onClose, folders = [], currentFolder, onUpload, onUploadFolder }) {
  const [targetFolder, setTargetFolder] = useState(currentFolder || 'root');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState('files'); // 'files' or 'folder'
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTargetFolder(currentFolder ?? 'root');
    }
  }, [isOpen, currentFolder]);

  const folderOptions = useMemo(() => {
    const byId = new Map((folders || []).map(folder => [String(folder.id), folder]));
    const getPath = (folder) => {
      const parts = [folder.name];
      let current = folder;
      const guard = new Set([String(folder.id)]);
      while (current?.parentId != null) {
        const parent = byId.get(String(current.parentId));
        if (!parent || guard.has(String(parent.id))) break;
        parts.unshift(parent.name);
        guard.add(String(parent.id));
        current = parent;
      }
      return parts.join(' / ');
    };

    return [...(folders || [])]
      .map(folder => ({ ...folder, pathLabel: getPath(folder) }))
      .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel));
  }, [folders]);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      const parentId = targetFolder === 'root' ? null : targetFolder;
      onUpload(Array.from(files), parentId);
      onClose();
    }
  };

  const handleFolderChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      const parentId = targetFolder === 'root' ? null : targetFolder;
      onUploadFolder?.(Array.from(files), parentId);
      onClose();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const items = Array.from(e.dataTransfer.items);
    const files = Array.from(e.dataTransfer.files);
    
    // Check if any item is a directory
    const hasDirectory = items.some(item => {
      const entry = item.webkitGetAsEntry?.();
      return entry?.isDirectory;
    });
    
    if (hasDirectory && uploadMode === 'folder') {
      // For folder mode with directories, we need to handle this specially
      // Unfortunately, drag & drop doesn't preserve directory structure well
      // So we'll just show a message
      alert('Please use the folder picker button to upload folders with their structure preserved.');
      return;
    }
    
    if (files.length > 0) {
      const parentId = targetFolder === 'root' ? null : targetFolder;
      if (uploadMode === 'folder' && files[0].webkitRelativePath) {
        onUploadFolder?.(files, parentId);
      } else {
        onUpload(files, parentId);
      }
      onClose();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Files" icon="upload">
      {/* Upload Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setUploadMode('files')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            uploadMode === 'files' 
              ? 'bg-navy-900 text-white' 
              : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
          }`}
        >
          <Icon name="file" size={14} /> Files
        </button>
        <button
          onClick={() => setUploadMode('folder')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            uploadMode === 'folder' 
              ? 'bg-navy-900 text-white' 
              : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
          }`}
        >
          <Icon name="folder" size={14} /> Folder
        </button>
      </div>

      {/* Folder Select */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-navy-700 mb-1.5">Upload to:</label>
        <select
          value={targetFolder}
          onChange={(e) => setTargetFolder(e.target.value)}
          className="input"
        >
          <option value="root">My Drive (Root)</option>
          {folderOptions.map(f => (
            <option key={f.id} value={f.id}>{f.pathLabel}</option>
          ))}
        </select>
      </div>

      {/* Upload Zone */}
      <div
        onClick={() => uploadMode === 'files' ? fileInputRef.current?.click() : folderInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
          ${isDragOver ? 'border-navy-600 bg-navy-50' : 'border-navy-200 hover:border-navy-600 hover:bg-navy-50'}
        `}
      >
        <div className={`w-16 h-16 rounded-full ${uploadMode === 'files' ? 'bg-sky-100' : 'bg-amber-100'} flex items-center justify-center mx-auto mb-4`}>
          <Icon name={uploadMode === 'files' ? 'upload' : 'folder'} size={32} className={uploadMode === 'files' ? 'text-sky-500' : 'text-amber-500'} />
        </div>
        <h4 className="text-base font-medium mb-2 text-navy-900">
          {uploadMode === 'files' ? 'Drag & drop files here' : 'Click to select a folder'}
        </h4>
        <p className="text-sm text-navy-500 mb-2">
          {uploadMode === 'files' 
            ? 'or click to browse (multiple files supported)' 
            : 'Folder structure and all files will be preserved'
          }
        </p>
        {uploadMode === 'folder' && (
          <div className="flex items-center justify-center gap-2 text-xs text-navy-600 font-medium mt-3">
            <Icon name="info" size={14} />
            <span>Use the folder picker to maintain folder structure</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept="*/*"
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderChange}
          className="hidden"
        />
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-navy-50 rounded-lg text-xs text-navy-600 space-y-2">
        <div className="flex items-center gap-2 font-medium">
          <Icon name="info" size={12} />
          <span>Supported Formats:</span>
        </div>
        <ul className="list-disc list-inside ml-4 space-y-1 text-navy-500">
          <li><strong>Documents:</strong> PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx), Excel (.xls, .xlsx)</li>
          <li><strong>CSV Data:</strong> CSV (.csv)</li>
          <li><strong>Images:</strong> JPG, PNG, GIF, SVG, WebP, BMP</li>
          <li><strong>Video:</strong> MP4, WebM, MOV, AVI, MKV, M4V</li>
          <li><strong>Audio:</strong> MP3, WAV, FLAC, AAC, M4A, WMA</li>
          <li><strong>Text:</strong> TXT, MD, JSON, CSV, and more</li>
        </ul>
        {uploadMode === 'folder' && (
          <p className="text-navy-700 font-medium mt-2 pt-2 border-t border-navy-100">
            Folder mode will create all subdirectories and upload all contained files automatically!
          </p>
        )}
      </div>
    </Modal>
  );
}
