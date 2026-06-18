import React, { useState, useMemo, useCallback } from 'react';
import { Icons, formatSize, formatDate } from '../utils/helpers';

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

// Get file type icon and color based on extension
const getFileTypeInfo = (item) => {
  if (item.type === 'folder') {
    return { icon: 'folder', color: 'text-amber-500', label: 'Folder' };
  }
  
  const ext = item.name?.split('.').pop()?.toLowerCase() || '';
  const typeMap = {
    pdf: { icon: 'pdf', color: 'text-red-500', label: 'PDF' },
    doc: { icon: 'word', color: 'text-blue-600', label: 'Word' },
    docx: { icon: 'word', color: 'text-blue-600', label: 'Word' },
    xls: { icon: 'excel', color: 'text-green-600', label: 'Excel' },
    xlsx: { icon: 'excel', color: 'text-green-600', label: 'Excel' },
    ppt: { icon: 'powerpoint', color: 'text-orange-500', label: 'PowerPoint' },
    pptx: { icon: 'powerpoint', color: 'text-orange-500', label: 'PowerPoint' },
    jpg: { icon: 'image', color: 'text-purple-500', label: 'Image' },
    jpeg: { icon: 'image', color: 'text-purple-500', label: 'Image' },
    png: { icon: 'image', color: 'text-purple-500', label: 'Image' },
    gif: { icon: 'image', color: 'text-purple-500', label: 'Image' },
    svg: { icon: 'image', color: 'text-purple-500', label: 'Image' },
    txt: { icon: 'text', color: 'text-gray-600', label: 'Text' },
    md: { icon: 'text', color: 'text-gray-600', label: 'Markdown' },
    json: { icon: 'code', color: 'text-yellow-600', label: 'JSON' },
    js: { icon: 'code', color: 'text-yellow-500', label: 'JavaScript' },
    zip: { icon: 'archive', color: 'text-amber-600', label: 'Archive' },
    rar: { icon: 'archive', color: 'text-amber-600', label: 'Archive' },
  };
  
  return typeMap[ext] || { icon: 'file', color: 'text-gray-500', label: 'File' };
};

// Tree Node for folder hierarchy
function TreeNode({ 
  item, 
  level, 
  items, 
  currentFolder, 
  selectedItems,
  expandedFolders, 
  onToggleExpand, 
  onFolderClick,
  onFileClick,
  onContextMenu,
  showFiles = true
}) {
  const isFolder = item.type === 'folder';
  const isExpanded = expandedFolders.includes(item.id);
  const isActive = currentFolder === item.id;
  const isSelected = selectedItems?.includes(item.id);
  const fileInfo = getFileTypeInfo(item);
  
  // Get children
  const children = useMemo(() => {
    const childFolders = items.filter(i => i.type === 'folder' && i.parentId === item.id && !i.trash);
    const childFiles = showFiles ? items.filter(i => i.type === 'file' && i.parentId === item.id && !i.trash) : [];
    return [...childFolders, ...childFiles];
  }, [items, item.id, showFiles]);
  
  const hasChildren = children.length > 0;

  const handleClick = (e) => {
    e.stopPropagation();
    if (isFolder) {
      onFolderClick(item.id);
    } else {
      onFileClick?.(item);
    }
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (isFolder && hasChildren) {
      onToggleExpand(item.id);
    }
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 py-1 px-1 rounded cursor-pointer select-none text-xs
          transition-colors duration-100
          ${isActive ? 'bg-navy-100 text-navy-900' : ''}
          ${isSelected && !isActive ? 'bg-navy-50' : ''}
          ${!isActive && !isSelected ? 'hover:bg-navy-50' : ''}
        `}
        style={{ paddingLeft: `${4 + level * 16}px` }}
        onClick={handleClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (isFolder) {
            onToggleExpand(item.id);
          }
        }}
        onContextMenu={(e) => onContextMenu?.(e, item.id)}
      >
        {/* Expand/Collapse Arrow */}
        <span 
          className={`w-4 h-4 flex items-center justify-center ${hasChildren ? 'cursor-pointer' : ''}`}
          onClick={handleToggle}
        >
          {isFolder && hasChildren && (
            <Icon 
              name={isExpanded ? 'chevronDown' : 'chevronRight'} 
              size={10} 
              className="text-navy-400"
            />
          )}
        </span>
        
        {/* Icon */}
        <Icon 
          name={isFolder && isExpanded ? 'folderOpen' : fileInfo.icon} 
          size={14} 
          className={fileInfo.color}
        />
        
        {/* Name */}
        <span className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}>
          {item.name}
        </span>
        
        {/* Indicators */}
        {item.favorite && (
          <Icon name="star" size={10} className="text-amber-400" />
        )}
        {item.pinned && (
          <Icon name="pin" size={10} className="text-navy-400" />
        )}
      </div>
      
      {/* Children */}
      {isFolder && isExpanded && hasChildren && (
        <div className="relative">
          {/* Vertical line connector */}
          <div 
            className="absolute top-0 bottom-2 w-px bg-navy-200"
            style={{ left: `${11 + level * 16}px` }}
          />
          {children.map(child => (
            <TreeNode
              key={child.id}
              item={child}
              level={level + 1}
              items={items}
              currentFolder={currentFolder}
              selectedItems={selectedItems}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              onFolderClick={onFolderClick}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              showFiles={showFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorerPanel({ 
  items, 
  currentFolder, 
  selectedItems = [],
  onFolderClick, 
  onFileClick,
  onContextMenu,
  onCreateFolder,
  onUpload,
  showFiles = false,
  compact = false
}) {
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get root folders
  const rootFolders = useMemo(() => {
    return items.filter(i => i.type === 'folder' && i.parentId === null && !i.trash);
  }, [items]);
  
  // Get root files if showing files
  const rootFiles = useMemo(() => {
    if (!showFiles) return [];
    return items.filter(i => i.type === 'file' && i.parentId === null && !i.trash);
  }, [items, showFiles]);
  
  const rootItems = [...rootFolders, ...rootFiles];

  const handleToggleExpand = useCallback((folderId) => {
    setExpandedFolders(prev => 
      prev.includes(folderId) 
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  }, []);

  // Expand all folders in path to current folder
  React.useEffect(() => {
    if (currentFolder) {
      const pathToExpand = [];
      let curr = items.find(i => i.id === currentFolder);
      while (curr) {
        if (curr.parentId) {
          pathToExpand.push(curr.parentId);
        }
        curr = curr.parentId ? items.find(i => i.id === curr.parentId) : null;
      }
      if (pathToExpand.length > 0) {
        setExpandedFolders(prev => [...new Set([...prev, ...pathToExpand])]);
      }
    }
  }, [currentFolder, items]);

  return (
    <div className={`flex flex-col h-full ${compact ? 'text-[11px]' : ''}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-navy-100 bg-navy-50">
          <span className="text-xs font-medium text-navy-700 flex items-center gap-1.5">
            <Icon name="folder" size={14} className="text-navy-500" />
            File Explorer
          </span>
          <div className="flex gap-1">
            <button 
              onClick={onCreateFolder}
              className="p-1 hover:bg-navy-100 rounded transition-colors"
              title="New Folder"
            >
              <Icon name="folderPlus" size={14} className="text-navy-500" />
            </button>
            <button 
              onClick={() => setExpandedFolders([])}
              className="p-1 hover:bg-navy-100 rounded transition-colors"
              title="Collapse All"
            >
              <Icon name="minimize" size={14} className="text-navy-500" />
            </button>
          </div>
        </div>
      )}
      
      {/* Search */}
      {!compact && (
        <div className="px-2 py-2 border-b border-navy-100">
          <div className="relative">
            <Icon name="search" size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search folders..."
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-navy-200 rounded focus:border-navy-400 focus:outline-none"
            />
          </div>
        </div>
      )}
      
      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Root / My Drive */}
        <div
          className={`
            flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer text-xs font-medium
            ${currentFolder === null ? 'bg-navy-100 text-navy-900' : 'hover:bg-navy-50 text-navy-700'}
          `}
          onClick={() => onFolderClick(null)}
        >
          <Icon name="hardDrive" size={14} className="text-navy-500" />
          <span>My Drive</span>
          <span className="ml-auto text-[10px] text-navy-400 bg-navy-100 px-1.5 rounded">
            {rootItems.length}
          </span>
        </div>
        
        {/* Tree Nodes */}
        <div className="mt-1">
          {rootItems.length > 0 ? (
            rootItems.map(item => (
              <TreeNode
                key={item.id}
                item={item}
                level={0}
                items={items}
                currentFolder={currentFolder}
                selectedItems={selectedItems}
                expandedFolders={expandedFolders}
                onToggleExpand={handleToggleExpand}
                onFolderClick={onFolderClick}
                onFileClick={onFileClick}
                onContextMenu={onContextMenu}
                showFiles={showFiles}
              />
            ))
          ) : (
            <div className="text-center py-4 text-xs text-navy-400">
              <Icon name="folder" size={24} className="mx-auto mb-2 opacity-50" />
              <p>No folders yet</p>
              <button 
                onClick={onCreateFolder}
                className="mt-2 text-navy-600 hover:underline"
              >
                Create folder
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer - Quick Stats */}
      {!compact && (
        <div className="px-3 py-2 border-t border-navy-100 bg-navy-50 text-[10px] text-navy-500">
          <div className="flex justify-between">
            <span>{items.filter(i => i.type === 'folder' && !i.trash).length} folders</span>
            <span>{items.filter(i => i.type === 'file' && !i.trash).length} files</span>
          </div>
        </div>
      )}
    </div>
  );
}
