import React, { useState } from 'react';
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

export default function ArchiveModal({ isOpen, onClose, items, onArchive, mode = 'create' }) {
  const [archiveName, setArchiveName] = useState(
    items?.length === 1 ? items[0].name.replace(/\.[^/.]+$/, '') + '.zip' : 'archive.zip'
  );

  const handleArchive = () => {
    // Create a ZIP archive simulation
    // In a real app, this would use JSZip library
    const archiveData = {
      name: archiveName,
      files: items.map(item => ({
        name: item.name,
        content: item.content || '',
        dataUrl: item.dataUrl || null,
        size: item.size
      }))
    };
    
    onArchive(archiveData);
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={mode === 'create' ? 'Create Archive' : 'Extract Archive'}
      icon={mode === 'create' ? 'archive' : 'folder'}
    >
      {mode === 'create' ? (
        <>
          {/* Archive Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-navy-700 mb-1.5">
              Archive Name
            </label>
            <input
              type="text"
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value)}
              className="input"
              placeholder="archive.zip"
            />
          </div>

          {/* Files to Archive */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-navy-700 mb-1.5">
              Files to archive ({items?.length || 0})
            </label>
            <div className="max-h-48 overflow-y-auto bg-navy-50 rounded-lg p-3 border border-navy-100">
              {items?.map(item => (
                <div key={item.id} className="flex items-center gap-2 py-1.5 text-sm text-navy-700">
                  <Icon name={item.type === 'folder' ? 'folder' : 'file'} size={14} className={item.type === 'folder' ? 'text-sky-500' : 'text-navy-400'} />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="mb-6 space-y-2">
            <label className="flex items-center gap-2 text-sm text-navy-700">
              <input type="checkbox" className="rounded border-navy-300 text-navy-900 focus:ring-navy-500" defaultChecked />
              Include subfolders
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-700">
              <input type="checkbox" className="rounded border-navy-300 text-navy-900 focus:ring-navy-500" />
              Compress files
            </label>
          </div>
        </>
      ) : (
        <>
          {/* Extract Options */}
          <div className="mb-4">
            <p className="text-sm text-navy-600 mb-4">
              Extract contents of <strong className="text-navy-900">{items?.[0]?.name}</strong>
            </p>
            <label className="flex items-center gap-2 text-sm text-navy-700">
              <input type="checkbox" className="rounded border-navy-300 text-navy-900 focus:ring-navy-500" defaultChecked />
              Create folder with archive name
            </label>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          onClick={handleArchive}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          <Icon name={mode === 'create' ? 'archive' : 'folder'} size={14} />
          {mode === 'create' ? 'Create Archive' : 'Extract'}
        </button>
      </div>
    </Modal>
  );
}
