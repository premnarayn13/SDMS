import React, { useState } from 'react';
import Modal from './Modal';
import { Icons } from '../utils/helpers';

const Icon = ({ name, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}
    dangerouslySetInnerHTML={{ __html: Icons[name] || '' }}
  />
);

export default function MoveModal({ isOpen, onClose, folders = [], selectedItems = [], onMove }) {
  const [targetFolder, setTargetFolder] = useState(null);

  // Filter out selected items from folder list (can't move into themselves)
  const availableFolders = folders.filter(f => !selectedItems.includes(f.id));

  const handleMove = () => {
    onMove(selectedItems, targetFolder);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move to" icon="folder">
      <div className="max-h-[250px] overflow-y-auto">
        {/* Root option */}
        <div
          onClick={() => setTargetFolder(null)}
          className={`
            py-2.5 px-3.5 flex items-center gap-2.5 cursor-pointer rounded-lg mb-1
            ${targetFolder === null ? 'bg-navy-50 border-2 border-navy-600' : 'hover:bg-navy-50'}
          `}
        >
          <Icon name="folder" size={18} className="text-navy-600" />
          <span className="text-navy-800 font-medium">My Drive (Root)</span>
        </div>

        {/* Folders */}
        {availableFolders.map(f => (
          <div
            key={f.id}
            onClick={() => setTargetFolder(f.id)}
            className={`
              py-2.5 px-3.5 flex items-center gap-2.5 cursor-pointer rounded-lg mb-1
              ${targetFolder === f.id ? 'bg-navy-50 border-2 border-navy-600' : 'hover:bg-navy-50'}
            `}
            style={{ paddingLeft: f.parentId ? '28px' : '14px' }}
          >
            <Icon name="folder" size={18} className="text-navy-600" />
            <span className="text-navy-800">{f.name}</span>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-navy-100">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button onClick={handleMove} className="btn-primary">
          Move
        </button>
      </div>
    </Modal>
  );
}
