import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';

export default function FolderModal({ isOpen, onClose, folders = [], currentFolder, onCreate }) {
  const [folderName, setFolderName] = useState('');
  const [targetFolder, setTargetFolder] = useState(currentFolder || 'root');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTargetFolder(currentFolder ?? 'root');
      setFolderName('');
      setCreateError('');
      setIsCreating(false);
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

  const handleCreate = async () => {
    if (!folderName.trim()) return;
    setIsCreating(true);
    setCreateError('');
    const parentId = targetFolder === 'root' ? null : targetFolder;
    try {
      const created = await onCreate(folderName.trim(), parentId);
      if (created) {
        setFolderName('');
        onClose();
        return;
      }
      setCreateError('Could not create folder. Please check the folder name or location.');
    } catch (error) {
      setCreateError(error?.message || 'Could not create folder. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const footer = (
    <>
      <button
        onClick={onClose}
        className="btn-secondary"
        disabled={isCreating}
      >
        Cancel
      </button>
      <button
        onClick={handleCreate}
        className="btn-primary"
        disabled={isCreating || !folderName.trim()}
      >
        {isCreating ? 'Creating...' : 'Create'}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Folder" icon="folder">
      <div className="mb-4">
        <label className="block text-sm font-medium text-navy-700 mb-1.5">Folder Name</label>
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Enter folder name"
          className="input"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-navy-700 mb-1.5">Create in:</label>
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
      {createError && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {createError}
        </div>
      )}
    </Modal>
  );
}
