import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';

const DEFAULT_TAGS = ['work', 'important', 'extra work', 'personal', 'urgent'];

const toTitleCase = (value) => {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function TagModal({ isOpen, onClose, item, onAddTag, availableTags = [], onCreateTag }) {
  const mergedTags = useMemo(() => {
    const seen = new Set();
    const combined = [...DEFAULT_TAGS, ...availableTags]
      .map(tag => String(tag || '').trim())
      .filter(Boolean)
      .filter((tag) => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return combined;
  }, [availableTags]);

  const [selectedTag, setSelectedTag] = useState(mergedTags[0] || DEFAULT_TAGS[0]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTag(mergedTags[0] || DEFAULT_TAGS[0]);
    setNewTag('');
  }, [isOpen, mergedTags]);

  const handleAddTag = () => {
    const normalized = String(selectedTag || '').trim();
    if (item && normalized) {
      onAddTag(item.id, normalized);
    }
    onClose();
  };

  const handleCreateTag = () => {
    const normalized = String(newTag || '').trim().replace(/\s+/g, ' ');
    if (!normalized || !onCreateTag) return;

    const duplicate = mergedTags.some(tag => tag.toLowerCase() === normalized.toLowerCase());
    if (duplicate) {
      setSelectedTag(mergedTags.find(tag => tag.toLowerCase() === normalized.toLowerCase()) || normalized);
      setNewTag('');
      return;
    }

    const created = onCreateTag(normalized);
    if (created !== false) {
      setSelectedTag(normalized);
      setNewTag('');
    }
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
        onClick={handleAddTag}
        className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700"
      >
        Add Tag
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🏷️ Add Tag" footer={footer}>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Tag</label>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm outline-none focus:border-blue-600"
        >
          {mergedTags.map(tag => (
            <option key={tag} value={tag}>{toTitleCase(tag)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Create Custom Label</label>
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateTag();
              }
            }}
            placeholder="e.g. Extra Work"
            className="flex-1 p-3 border-2 border-gray-200 rounded-lg text-sm outline-none focus:border-blue-600"
          />
          <button
            type="button"
            onClick={handleCreateTag}
            className="px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}
