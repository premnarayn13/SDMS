import React, { useState, useMemo } from 'react';
import { Icons } from '../utils/helpers';

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

function TreeNode({ item, level, items, currentFolder, onFolderClick, onFileClick, expandedFolders, onToggleExpand, compact, showFiles }) {
  const isFolder = item.type === 'folder';
  const isExpanded = isFolder && expandedFolders.includes(item.id);
  const isActive = isFolder && currentFolder === item.id;
  
  // Get child folders/files
  const childFolders = useMemo(() => {
    return items.filter(i => i.type === 'folder' && i.parentId === item.id && !i.trash);
  }, [items, item.id]);
  
  const childFiles = useMemo(() => {
    if (!showFiles) return [];
    return items.filter(i => i.type === 'file' && i.parentId === item.id && !i.trash);
  }, [items, item.id, showFiles]);
  
  const children = [...childFolders, ...childFiles];
  const hasChildren = children.length > 0;
  const totalItems = childFolders.length + childFiles.length;

  return (
    <div className={compact ? '' : 'animate-fade-in'}>
      <button
        className={`
          tree-item w-full
          ${isActive ? 'tree-item-active' : ''}
        `}
        style={{ paddingLeft: `${(compact ? 4 : 8) + level * 12}px` }}
        onClick={() => {
          if (isFolder) {
            onFolderClick(item.id);
          } else {
            onFileClick?.(item);
          }
        }}
      >
        {/* Expand/Collapse Arrow */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (isFolder && hasChildren) onToggleExpand(item.id);
          }}
          className={`w-3 flex items-center justify-center transition-transform duration-200 ${isFolder && hasChildren ? 'cursor-pointer' : 'opacity-0'}`}
        >
          {isFolder && hasChildren && (
            <Icon 
              name={isExpanded ? 'chevronDown' : 'chevronRight'} 
              size={10} 
              className={`transition-transform duration-200 ${isExpanded ? '' : ''}`}
            />
          )}
        </span>
        
        {/* Icon */}
        <Icon 
          name={isFolder ? (isExpanded ? 'folderOpen' : 'folder') : 'file'} 
          size={compact ? 12 : 14} 
          className={isFolder ? 'text-sky-400' : 'text-navy-200'} 
        />
        
        {/* Name */}
        <span className={`sidebar-file-name truncate flex-1 text-left ${compact ? 'text-[13px]' : 'text-sm'}`}>
          {item.name}
        </span>
        
        {/* Item count badge */}
        {isFolder && totalItems > 0 && !compact && (
          <span className="text-[9px] text-navy-400 bg-white/10 px-1 rounded">
            {totalItems}
          </span>
        )}
        
        {/* Pin indicator */}
        {item.pinned && (
          <Icon name="pin" size={10} className="text-amber-400" />
        )}
      </button>
      
      {/* Children - Nested with visual indicator */}
      {isFolder && isExpanded && hasChildren && (
        <div className="relative">
          {/* Vertical connecting line */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-px bg-white/10"
            style={{ marginLeft: `${(compact ? 10 : 14) + level * 12}px` }}
          />
          <div className="animate-slide-down">
            {children.map(child => (
              <TreeNode
                key={child.id}
                item={child}
                level={level + 1}
                items={items}
                currentFolder={currentFolder}
                onFolderClick={onFolderClick}
                onFileClick={onFileClick}
                expandedFolders={expandedFolders}
                onToggleExpand={onToggleExpand}
                compact={compact}
                showFiles={showFiles}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TreeView({ items, currentFolder, onFolderClick, onFileClick, showFiles = false, compact = false }) {
  const [expandedFolders, setExpandedFolders] = useState([]);
  
  // Get root folders (no parent)
  const rootFolders = useMemo(() => {
    return items.filter(i => i.type === 'folder' && i.parentId === null && !i.trash);
  }, [items]);

  const rootFiles = useMemo(() => {
    if (!showFiles) return [];
    return items.filter(i => i.type === 'file' && i.parentId === null && !i.trash);
  }, [items, showFiles]);

  const rootItems = [...rootFolders, ...rootFiles];
  
  const handleToggleExpand = (folderId) => {
    setExpandedFolders(prev => 
      prev.includes(folderId) 
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  if (rootItems.length === 0) {
    return (
      <div className={`text-center py-2 ${compact ? 'text-[12px]' : 'text-sm'} text-navy-400`}>
        No folders yet
      </div>
    );
  }

  return (
    <div className="text-white">
      {/* Tree Nodes */}
      {rootItems.map(item => (
        <TreeNode
          key={item.id}
          item={item}
          level={0}
          items={items}
          currentFolder={currentFolder}
          onFolderClick={onFolderClick}
          onFileClick={onFileClick}
          expandedFolders={expandedFolders}
          onToggleExpand={handleToggleExpand}
          compact={compact}
          showFiles={showFiles}
        />
      ))}
    </div>
  );
}
