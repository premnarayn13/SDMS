import React from 'react';
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

export default function DeleteConfirmModal({ isOpen, onClose, itemName, count = 1, onConfirm }) {
  const displayName = count > 1 ? `${count} items` : itemName;

  const footer = (
    <>
      <button
        onClick={onClose}
        className="btn-secondary"
      >
        Cancel
      </button>
      <button
        onClick={() => {
          onConfirm();
          onClose();
        }}
        className="btn-danger flex items-center gap-2"
      >
        <Icon name="trash" size={14} />
        Delete Forever
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Delete" icon="warning" footer={footer} maxWidth="400px">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="trash" size={32} className="text-red-500" />
        </div>
        <p className="text-base text-navy-800 mb-2 font-semibold">
          {displayName}
        </p>
        <p className="text-navy-600 text-sm">This will permanently delete the file.</p>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 justify-center">
          <Icon name="warning" size={16} className="text-red-500" />
          <p className="text-red-600 text-sm font-medium">This action cannot be undone!</p>
        </div>
      </div>
    </Modal>
  );
}
