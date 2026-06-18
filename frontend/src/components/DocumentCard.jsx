import React from 'react';
import { formatSize, Icons, getFileTypeIconClass } from '../utils/helpers';

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

// Get file type icon with proper color - clear distinction between files and folders
const getFileIcon = (item) => {
  if (item.type === 'folder') {
    return { name: 'folder', color: '#f59e0b', bgColor: '#fef3c7', label: 'Folder' }; // Amber/Yellow for folders
  }
  
  const fileType = item.fileType || 'Document';
  const iconMap = {
    'PDF': { name: 'filePdf', color: '#dc2626', bgColor: '#fee2e2', label: 'PDF' },
    'Word': { name: 'fileWord', color: '#2563eb', bgColor: '#dbeafe', label: 'Word' },
    'Excel': { name: 'fileExcel', color: '#16a34a', bgColor: '#dcfce7', label: 'Excel' },
    'PowerPoint': { name: 'filePpt', color: '#ea580c', bgColor: '#ffedd5', label: 'PowerPoint' },
    'Image': { name: 'fileImage', color: '#7c3aed', bgColor: '#ede9fe', label: 'Image' },
    'Text': { name: 'fileText', color: '#64748b', bgColor: '#f1f5f9', label: 'Text' },
    'Archive': { name: 'fileArchive', color: '#84cc16', bgColor: '#ecfccb', label: 'Archive' },
  };
  
  return iconMap[fileType] || { name: 'file', color: '#64748b', bgColor: '#f1f5f9', label: 'File' };
};

export default function DocumentCard({ 
  item, 
  isSelected, 
  isCut,
  onClick, 
  onDoubleClick, 
  onContextMenu,
  onCheckboxChange,
  onFavoriteClick
}) {
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onCheckboxChange?.(item.id);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onFavoriteClick?.(item.id);
  };

  const fileIcon = getFileIcon(item);

  return (
    <div
      data-selectable-item="true"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`
        card p-3 cursor-pointer group relative
        transition-all duration-200 ease-out
        hover:shadow-medium hover:-translate-y-0.5
        ${isSelected ? 'border-navy-600 bg-navy-50 shadow-medium' : 'border-navy-100'}
        ${isCut ? 'opacity-50' : ''}
      `}
    >
      {/* Checkbox - appears on hover or when selected */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCheckboxChange?.(item.id);
        }}
        className={`
        absolute top-2 left-2 transition-opacity duration-200
        ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
      `}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-navy-300 text-navy-600 focus:ring-navy-500 cursor-pointer"
        />
      </div>

      {/* Favorite Star */}
      <button
        onClick={handleFavoriteClick}
        className={`
          absolute top-2 right-2 transition-all duration-200
          ${item.favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
      >
        <Icon 
          name={item.favorite ? 'starFilled' : 'star'} 
          size={14} 
          className={item.favorite ? 'text-amber-400' : 'text-navy-300 hover:text-amber-400'} 
        />
      </button>

      {/* Status Badge */}
      {item.status && (
        <div className="absolute top-2 right-8">
          <span className={`badge text-[9px] ${
            item.status === 'draft' ? 'badge-warning' :
            item.status === 'final' ? 'badge-success' :
            'badge-primary'
          }`}>
            {item.status}
          </span>
        </div>
      )}

      {/* Icon - Distinct look for folders vs files */}
      <div className="flex items-center justify-center py-4">
        <div 
          className={`w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
            item.type === 'folder' ? 'border-2 border-amber-300' : ''
          }`}
          style={{ backgroundColor: fileIcon.bgColor || `${fileIcon.color}15` }}
        >
          <Icon name={fileIcon.name} size={item.type === 'folder' ? 28 : 24} className="" style={{ color: fileIcon.color }} />
        </div>
      </div>

      {/* Type Label - prominent for folders */}
      {item.type === 'folder' && (
        <div className="text-[9px] font-semibold text-amber-700 text-center uppercase tracking-wide -mt-1 mb-1">
          Folder
        </div>
      )}

      {/* Name */}
      <div 
        className="text-xs font-medium text-navy-800 text-center truncate px-1"
        title={item.name}
      >
        {item.name}
      </div>

      {/* Meta */}
      <div className="text-[10px] text-navy-400 text-center mt-0.5">
        {item.type === 'folder' ? `${item.itemCount || 0} items` : formatSize(item.size)}
      </div>

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div className="flex flex-wrap gap-0.5 justify-center mt-1.5">
          {item.tags.slice(0, 2).map(tag => (
            <span 
              key={tag} 
              className="px-1.5 py-0.5 bg-navy-100 text-navy-600 rounded text-[9px]"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span className="text-[9px] text-navy-400">+{item.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Sensitivity Indicator */}
      {item.sensitivity === 'confidential' && (
        <div className="absolute bottom-2 left-2">
          <Icon name="lock" size={12} className="text-red-500" />
        </div>
      )}
      {item.sensitivity === 'internal' && (
        <div className="absolute bottom-2 left-2">
          <Icon name="shield" size={12} className="text-amber-500" />
        </div>
      )}
    </div>
  );
}
