import React from 'react';
import { getIcon, formatSize, formatDate, Icons } from '../utils/helpers';

// Icon component to render SVG icons safely
const Icon = ({ name, size = 18, className = '' }) => {
  const icon = Icons[name];
  if (!icon) return null;
  const sizedIcon = icon.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  return (
    <span 
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: sizedIcon }}
    />
  );
};

// Get file icon based on type - clear distinction between files and folders
const getFileIcon = (item) => {
  if (item.type === 'folder') {
    return { icon: 'folder', color: 'text-amber-500', bgClass: 'bg-amber-100', label: 'Folder' };
  }
  const iconMap = {
    'PDF': { icon: 'filePdf', color: 'text-red-500', bgClass: 'bg-red-50', label: 'PDF' },
    'Word': { icon: 'fileWord', color: 'text-blue-500', bgClass: 'bg-blue-50', label: 'Word' },
    'Excel': { icon: 'fileExcel', color: 'text-green-500', bgClass: 'bg-green-50', label: 'Excel' },
    'PowerPoint': { icon: 'filePpt', color: 'text-orange-500', bgClass: 'bg-orange-50', label: 'PowerPoint' },
    'Image': { icon: 'fileImage', color: 'text-purple-500', bgClass: 'bg-purple-50', label: 'Image' },
    'Text': { icon: 'fileText', color: 'text-gray-500', bgClass: 'bg-gray-50', label: 'Text' },
    'Archive': { icon: 'fileArchive', color: 'text-lime-600', bgClass: 'bg-lime-50', label: 'Archive' },
  };
  return iconMap[item.fileType] || { icon: 'file', color: 'text-navy-400', bgClass: 'bg-navy-50', label: 'File' };
};

export default function DocumentRow({ 
  item, 
  isSelected, 
  isCut,
  onClick, 
  onDoubleClick, 
  onContextMenu,
  onMenuClick,
  onCheckboxChange
}) {
  const handleMenuClick = (e) => {
    e.stopPropagation();
    onMenuClick?.(e, item.id);
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onCheckboxChange?.(item.id);
  };

  const fileIcon = getFileIcon(item);

  return (
    <div
      data-selectable-item="true"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`
        grid items-center py-2 px-3 bg-white rounded-lg cursor-pointer transition-all border
        hover:bg-navy-50 hover:border-navy-200
        ${isSelected ? 'bg-navy-50 border-navy-300 shadow-soft' : 'border-transparent'}
        ${isCut ? 'opacity-50' : ''}
      `}
      style={{ gridTemplateColumns: '36px 36px 1fr 90px 90px 100px 50px' }}
    >
      {/* Checkbox */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCheckboxChange?.(item.id);
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 cursor-pointer rounded border-navy-300 text-navy-600 focus:ring-navy-500"
        />
      </div>

      {/* Icon with background for better distinction */}
      <div className="flex items-center justify-center">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${fileIcon.bgClass} ${item.type === 'folder' ? 'ring-1 ring-amber-300' : ''}`}>
          <Icon name={fileIcon.icon} size={item.type === 'folder' ? 18 : 16} className={fileIcon.color} />
        </div>
      </div>

      {/* Name with type indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-navy-800 truncate">{item.name}</span>
        {item.type === 'folder' && (
          <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
            Folder
          </span>
        )}
        {item.favorite && <Icon name="starFilled" size={12} className="text-amber-400" />}
      </div>

      {/* Type */}
      <div className="text-xs text-navy-500">
        {item.type === 'folder' ? 'Folder' : item.fileType}
      </div>

      {/* Size */}
      <div className="text-xs text-navy-500">
        {formatSize(item.size)}
      </div>

      {/* Date */}
      <div className="text-xs text-navy-500">
        {formatDate(item.date)}
      </div>

      {/* Menu Button */}
      <div>
        <button
          onClick={handleMenuClick}
          className="p-1 rounded hover:bg-navy-100 text-navy-400 hover:text-navy-600 transition-colors"
        >
          <Icon name="moreVertical" size={14} />
        </button>
      </div>
    </div>
  );
}
