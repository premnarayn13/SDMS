import React from 'react';
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

export default function EmptyState({ type = 'default', onUploadClick }) {
  const configs = {
    default: {
      icon: 'folder',
      color: 'text-sky-400',
      bg: 'bg-sky-50',
      title: 'No files here',
      description: 'Upload files or create folders'
    },
    trash: {
      icon: 'trash',
      color: 'text-red-400',
      bg: 'bg-red-50',
      title: 'Trash is empty',
      description: 'Deleted files appear here'
    },
    search: {
      icon: 'search',
      color: 'text-navy-400',
      bg: 'bg-navy-50',
      title: 'No results found',
      description: 'Try different keywords'
    },
    favorites: {
      icon: 'star',
      color: 'text-amber-400',
      bg: 'bg-amber-50',
      title: 'No favorites yet',
      description: 'Star files to add them here'
    },
    shared: {
      icon: 'share',
      color: 'text-green-400',
      bg: 'bg-green-50',
      title: 'No shared files',
      description: 'Files shared with you will appear here'
    },
    tag: {
      icon: 'tag',
      color: 'text-purple-400',
      bg: 'bg-purple-50',
      title: 'No items with this tag',
      description: 'Add tags to files to organize them'
    }
  };

  const config = configs[type] || configs.default;

  return (
    <div className="text-center py-16 px-6">
      <div className={`w-20 h-20 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <Icon name={config.icon} size={40} className={config.color} />
      </div>
      <h3 className="text-lg font-medium text-navy-700 mb-2">{config.title}</h3>
      <p className="text-navy-500 mb-5">{config.description}</p>
      {type === 'default' && onUploadClick && (
        <button
          onClick={onUploadClick}
          className="btn-primary flex items-center gap-2 mx-auto"
        >
          <Icon name="upload" size={16} />
          Upload Files
        </button>
      )}
    </div>
  );
}
