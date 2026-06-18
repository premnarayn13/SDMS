import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function RenameModal({ isOpen, onClose, item, onRename }) {
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (item) {
      setNewName(item.name);
    }
  }, [item]);

  const handleRename = () => {
    if (!newName.trim()) return;
    onRename(item.id, newName.trim());
    onClose();
  };

  const footer = (
    <>
      <button
        onClick={onClose}
        className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200"
      >
        Cancel
      </button>
      <button
        onClick={handleRename}
        className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700"
      >
        Rename
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✏️ Rename" footer={footer}>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">New Name</label>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter new name"
          className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm outline-none focus:border-blue-600"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
        />
      </div>
    </Modal>
  );
}
