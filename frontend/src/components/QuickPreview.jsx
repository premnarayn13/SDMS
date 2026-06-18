import React from 'react';
import { formatSize, formatDate, Icons } from '../utils/helpers';

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
    return { icon: 'folder', color: 'text-sky-500', bg: 'bg-sky-50' };
  }
  const iconMap = {
    'PDF': { icon: 'filePdf', color: 'text-red-500', bg: 'bg-red-50' },
    'Word': { icon: 'fileWord', color: 'text-blue-500', bg: 'bg-blue-50' },
    'Excel': { icon: 'fileExcel', color: 'text-green-500', bg: 'bg-green-50' },
    'PowerPoint': { icon: 'filePpt', color: 'text-orange-500', bg: 'bg-orange-50' },
    'Image': { icon: 'fileImage', color: 'text-purple-500', bg: 'bg-purple-50' },
    'Text': { icon: 'fileText', color: 'text-gray-500', bg: 'bg-gray-100' },
    'Archive': { icon: 'fileArchive', color: 'text-lime-600', bg: 'bg-lime-50' },
  };
  return iconMap[item.fileType] || { icon: 'file', color: 'text-navy-400', bg: 'bg-navy-50' };
};

export default function QuickPreview({ item, position, isVisible }) {
  if (!isVisible || !item) return null;

  const fileIcon = getFileIcon(item);

  const getPreviewContent = () => {
    if (item.type === 'folder') {
      return (
        <div className={`flex items-center justify-center py-6 ${fileIcon.bg} rounded-lg`}>
          <Icon name="folder" size={48} className={fileIcon.color} />
        </div>
      );
    }

    // Image preview
    if (item.dataUrl && item.mimeType?.startsWith('image/')) {
      return (
        <img 
          src={item.dataUrl} 
          alt={item.name}
          className="max-w-full max-h-44 object-contain mx-auto rounded"
        />
      );
    }

    // Text preview
    if (item.content && typeof item.content === 'string') {
      return (
        <pre className="text-xs bg-navy-50 p-3 rounded-lg max-h-44 overflow-auto whitespace-pre-wrap text-navy-700 border border-navy-100">
          {item.content.substring(0, 500)}
          {item.content.length > 500 && '...'}
        </pre>
      );
    }

    // Default icon
    return (
      <div className={`flex items-center justify-center py-6 ${fileIcon.bg} rounded-lg`}>
        <Icon name={fileIcon.icon} size={48} className={fileIcon.color} />
      </div>
    );
  };

  return (
    <div
      className="fixed bg-white rounded-xl shadow-strong border border-navy-100 z-[1000] w-72 overflow-hidden animate-scale-in"
      style={{
        left: position.x + 20,
        top: position.y,
        maxHeight: '380px'
      }}
    >
      {/* Preview Content */}
      <div className="p-3 bg-navy-50/50 border-b border-navy-100">
        {getPreviewContent()}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="font-semibold text-sm text-navy-800 truncate mb-2">{item.name}</h4>
        
        <div className="space-y-1 text-xs text-navy-500">
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="text-navy-700">{item.type === 'folder' ? 'Folder' : item.fileType}</span>
          </div>
          <div className="flex justify-between">
            <span>Size:</span>
            <span className="text-navy-700">{item.type === 'folder' ? `${item.itemCount || 0} items` : formatSize(item.size)}</span>
          </div>
          <div className="flex justify-between">
            <span>Modified:</span>
            <span className="text-navy-700">{formatDate(item.date)}</span>
          </div>
          {item.created && (
            <div className="flex justify-between">
              <span>Created:</span>
              <span className="text-navy-700">{formatDate(item.created)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.map(tag => (
              <span key={tag} className="px-1.5 py-0.5 bg-navy-100 text-navy-600 rounded text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Status */}
        {item.status && (
          <div className="mt-2">
            <span className={`
              px-1.5 py-0.5 rounded text-xs border
              ${item.status === 'draft' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
              ${item.status === 'final' ? 'bg-green-50 text-green-700 border-green-200' : ''}
              ${item.status === 'archived' ? 'bg-navy-50 text-navy-600 border-navy-200' : ''}
            `}>
              {item.status}
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions Hint */}
      <div className="px-3 py-2 bg-navy-50 border-t border-navy-100 text-xs text-navy-400 text-center">
        Press Space for full preview • Double-click to open
      </div>
    </div>
  );
}
