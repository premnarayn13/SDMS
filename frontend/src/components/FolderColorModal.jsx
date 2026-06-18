import React, { useState } from 'react';
import Modal from './Modal';
import { Icons } from '../utils/helpers';

const Icon = ({ name, size = 16, className = '', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}
    dangerouslySetInnerHTML={{ __html: Icons[name] || '' }}
  />
);

// Icon options for folders (using SVG icon names)
const folderIconOptions = [
  { name: 'folder', label: 'Folder' },
  { name: 'file', label: 'File' },
  { name: 'document', label: 'Document' },
  { name: 'bookmark', label: 'Bookmark' },
  { name: 'star', label: 'Star' },
  { name: 'heart', label: 'Heart' },
  { name: 'music', label: 'Music' },
  { name: 'video', label: 'Video' },
  { name: 'image', label: 'Image' },
  { name: 'code', label: 'Code' },
  { name: 'archive', label: 'Archive' },
  { name: 'settings', label: 'Settings' },
  { name: 'lock', label: 'Lock' },
  { name: 'key', label: 'Key' },
  { name: 'home', label: 'Home' },
  { name: 'briefcase', label: 'Briefcase' },
  { name: 'globe', label: 'Globe' },
  { name: 'mail', label: 'Mail' },
  { name: 'calendar', label: 'Calendar' },
  { name: 'clock', label: 'Clock' },
];

export default function FolderColorModal({ isOpen, onClose, item, onSave }) {
  const [selectedColor, setSelectedColor] = useState(item?.color || '#102a43');
  const [selectedIcon, setSelectedIcon] = useState(item?.icon || 'folder');

  const colors = [
    { name: 'Navy', value: '#102a43' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Brown', value: '#92400e' },
  ];

  const handleSave = () => {
    onSave(item.id, { color: selectedColor, icon: selectedIcon });
    onClose();
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Folder Appearance" icon="palette">
      <div className="mb-6">
        <h4 className="text-sm font-medium text-navy-700 mb-3">Folder: {item.name}</h4>
        
        {/* Preview */}
        <div className="flex justify-center mb-6">
          <div className="p-6 rounded-xl bg-navy-50 flex items-center justify-center">
            <Icon name={selectedIcon} size={64} style={{ color: selectedColor }} />
          </div>
        </div>

        {/* Icon Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-navy-700 mb-2">Icon</label>
          <div className="grid grid-cols-10 gap-2">
            {folderIconOptions.map(iconOpt => (
              <button
                key={iconOpt.name}
                onClick={() => setSelectedIcon(iconOpt.name)}
                title={iconOpt.label}
                className={`p-2 rounded-lg transition-all hover:bg-navy-100 flex items-center justify-center ${selectedIcon === iconOpt.name ? 'bg-navy-100 ring-2 ring-navy-500' : ''}`}
              >
                <Icon name={iconOpt.name} size={24} className="text-navy-700" />
              </button>
            ))}
          </div>
        </div>

        {/* Color Selection */}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-2">Color</label>
          <div className="grid grid-cols-6 gap-2">
            {colors.map(color => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                className={`w-full h-10 rounded-lg transition-all hover:scale-105 ${selectedColor === color.value ? 'ring-2 ring-offset-2 ring-navy-800' : ''}`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1 py-3">
          Cancel
        </button>
        <button onClick={handleSave} className="btn-primary flex-1 py-3">
          Save
        </button>
      </div>
    </Modal>
  );
}
