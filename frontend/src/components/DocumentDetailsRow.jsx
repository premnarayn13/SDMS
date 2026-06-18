import React from 'react';
import { formatSize, formatDate, getIcon, Icons } from '../utils/helpers';

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

// Get file icon based on type
const getFileIcon = (item) => {
  if (item.type === 'folder') {
    return { icon: 'folder', color: 'text-sky-500' };
  }
  const iconMap = {
    'PDF': { icon: 'filePdf', color: 'text-red-500' },
    'Word': { icon: 'fileWord', color: 'text-blue-500' },
    'Excel': { icon: 'fileExcel', color: 'text-green-500' },
    'PowerPoint': { icon: 'filePpt', color: 'text-orange-500' },
    'Image': { icon: 'fileImage', color: 'text-purple-500' },
    'Text': { icon: 'fileText', color: 'text-gray-500' },
    'Archive': { icon: 'fileArchive', color: 'text-lime-600' },
  };
  return iconMap[item.fileType] || { icon: 'file', color: 'text-navy-400' };
};

export default function DocumentDetailsRow({ 
  item, 
  isSelected, 
  isCut,
  onClick, 
  onDoubleClick, 
  onContextMenu,
  onCheckboxChange,
  onFavoriteClick,
  onMouseEnter,
  onMouseLeave
}) {
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onCheckboxChange?.(item.id);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onFavoriteClick?.(item.id);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'final': return 'bg-green-50 text-green-700 border-green-200';
      case 'archived': return 'bg-navy-50 text-navy-600 border-navy-200';
      default: return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  };

  // Get sensitivity color
  const getSensitivityColor = (level) => {
    switch (level) {
      case 'confidential': return 'bg-red-50 text-red-700 border-red-200';
      case 'internal': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'public': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-navy-50 text-navy-600 border-navy-200';
    }
  };

  const fileIcon = getFileIcon(item);

  return (
    <tr
      data-selectable-item="true"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        cursor-pointer transition-all
        ${isSelected ? 'bg-navy-50' : 'hover:bg-navy-50/50'}
        ${isCut ? 'opacity-50' : ''}
      `}
    >
      {/* Checkbox */}
      <td
        className="px-3 py-2 w-10"
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
      </td>

      {/* Icon & Name */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5">
          <Icon name={fileIcon.icon} size={18} className={fileIcon.color} />
          <div>
            <div className="text-sm font-medium text-navy-800 truncate max-w-xs" title={item.name}>
              {item.name}
            </div>
            {item.category && (
              <span className="text-xs text-navy-400">{item.category}</span>
            )}
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-2 text-xs text-navy-500">
        {item.type === 'folder' ? 'Folder' : item.fileType}
      </td>

      {/* Size */}
      <td className="px-3 py-2 text-xs text-navy-500">
        {item.type === 'folder' ? `${item.folderSize ? formatSize(item.folderSize) : '-'}` : formatSize(item.size)}
      </td>

      {/* Modified */}
      <td className="px-3 py-2 text-xs text-navy-500">
        {formatDate(item.date)}
      </td>

      {/* Created */}
      <td className="px-3 py-2 text-xs text-navy-500">
        {formatDate(item.created)}
      </td>

      {/* Last Accessed */}
      <td className="px-3 py-2 text-xs text-navy-500">
        {item.lastAccessed ? formatDate(item.lastAccessed) : '-'}
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        {item.status ? (
          <span className={`px-1.5 py-0.5 rounded text-xs border ${getStatusColor(item.status)}`}>
            {item.status}
          </span>
        ) : <span className="text-navy-300">-</span>}
      </td>

      {/* Tags */}
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {item.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-navy-100 text-navy-600 rounded text-xs">
              {tag}
            </span>
          ))}
          {item.tags?.length > 2 && (
            <span className="text-xs text-navy-400">+{item.tags.length - 2}</span>
          )}
        </div>
      </td>

      {/* Sensitivity */}
      <td className="px-3 py-2">
        {item.sensitivity ? (
          <span className={`px-1.5 py-0.5 rounded text-xs border ${getSensitivityColor(item.sensitivity)}`}>
            {item.sensitivity}
          </span>
        ) : <span className="text-navy-300">-</span>}
      </td>

      {/* Favorite */}
      <td className="px-3 py-2 text-center">
        <button
          onClick={handleFavoriteClick}
          className="p-0.5 rounded hover:bg-navy-100 transition-colors"
        >
          <Icon 
            name={item.favorite ? 'starFilled' : 'star'} 
            size={14} 
            className={item.favorite ? 'text-amber-400' : 'text-navy-300 hover:text-navy-400'} 
          />
        </button>
      </td>

      {/* Pinned */}
      <td className="px-3 py-2 text-center">
        {item.pinned && <Icon name="pin" size={14} className="text-navy-500" />}
      </td>
    </tr>
  );
}
