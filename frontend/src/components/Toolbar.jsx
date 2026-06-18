import React, { useState } from 'react';
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

export default function Toolbar({ 
  breadcrumb, 
  sortBy, 
  onSortChange, 
  viewMode, 
  onViewModeChange,
  onGoToRoot,
  onOpenFolder,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoToPath,
  filterCategory,
  filterStatus,
  filterSensitivity,
  onFilterCategoryChange,
  onFilterStatusChange,
  onFilterSensitivityChange,
  onFilterFileTypeChange,
  filterFileType,
  fileTypes = [],
  onClearFilters,
  splitViewEnabled,
  onToggleSplitView,
  onOpenNewWindow,
  embedded = false,
  inline = false
}) {
  const [showPathInput, setShowPathInput] = useState(false);
  const [pathInputValue, setPathInputValue] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handlePathSubmit = (e) => {
    e.preventDefault();
    const success = onGoToPath?.(pathInputValue);
    if (success !== false) {
      setShowPathInput(false);
      setPathInputValue('');
    }
  };

  const getCurrentPath = () => {
    if (breadcrumb.length === 0) return '/';
    return '/' + breadcrumb.map(b => b.name).join('/');
  };

  const hasActiveFilters = filterCategory || filterStatus || filterSensitivity || filterFileType;

  return (
    <div className={`${inline ? 'py-0 px-0 min-w-max whitespace-nowrap' : embedded ? 'py-2 px-0' : 'bg-white py-2 px-4 border-b border-navy-100'} flex items-center gap-3 relative`}>
      {/* Back/Forward Navigation */}
      <div className="flex gap-0.5">
        <button
          onClick={onGoBack}
          disabled={!canGoBack}
          className={`p-1.5 rounded transition-all ${
            canGoBack ? 'hover:bg-navy-100 text-navy-600' : 'text-navy-300 cursor-not-allowed'
          }`}
          title="Go Back"
        >
          <Icon name="arrowLeft" size={14} />
        </button>
        <button
          onClick={onGoForward}
          disabled={!canGoForward}
          className={`p-1.5 rounded transition-all ${
            canGoForward ? 'hover:bg-navy-100 text-navy-600' : 'text-navy-300 cursor-not-allowed'
          }`}
          title="Go Forward"
        >
          <Icon name="arrowRight" size={14} />
        </button>
      </div>

      {/* Breadcrumb / Path Input */}
      <div className={`${inline ? 'flex items-center gap-1.5 text-xs min-w-max' : 'flex-1 flex items-center gap-1.5 text-xs min-w-0'}`}>
        {showPathInput ? (
          <form onSubmit={handlePathSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              value={pathInputValue}
              onChange={(e) => setPathInputValue(e.target.value)}
              placeholder="Enter path (e.g., /Work Documents/Projects)"
              className="input flex-1 text-xs py-1.5"
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary text-xs py-1.5 px-3"
            >
              Go
            </button>
            <button
              type="button"
              onClick={() => setShowPathInput(false)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button 
              onClick={onGoToRoot}
              className="text-navy-500 cursor-pointer hover:text-navy-700 flex items-center gap-1 flex-shrink-0 transition-colors"
            >
              <Icon name="folder" size={14} className="text-sky-500" />
              <span>My Drive</span>
            </button>
            {breadcrumb.map((item, index) => (
              <React.Fragment key={item.id}>
                <Icon name="chevronRight" size={12} className="text-navy-300 flex-shrink-0" />
                {index === breadcrumb.length - 1 ? (
                  <span className="text-navy-800 font-medium truncate">{item.name}</span>
                ) : (
                  <button 
                    onClick={() => onOpenFolder(item.id)}
                    className="text-navy-500 cursor-pointer hover:text-navy-700 truncate transition-colors"
                  >
                    {item.name}
                  </button>
                )}
              </React.Fragment>
            ))}
            <button
              onClick={() => {
                setPathInputValue(getCurrentPath());
                setShowPathInput(true);
              }}
              className="ml-1 p-1 text-navy-400 hover:text-navy-600 hover:bg-navy-100 rounded transition-all"
              title="Edit path"
            >
              <Icon name="edit" size={12} />
            </button>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all ${
            hasActiveFilters 
              ? 'bg-navy-900 text-white' 
              : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
          }`}
        >
          <Icon name="filter" size={12} />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
          )}
        </button>
        
        <button
          onClick={onOpenNewWindow}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-navy-50 text-navy-600 hover:bg-navy-100 transition-all"
          title="Open new window"
        >
          <Icon name="externalLink" size={12} />
        </button>
        
        <button
          onClick={onToggleSplitView}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all ${
            splitViewEnabled 
              ? 'bg-navy-900 text-white' 
              : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
          }`}
          title="Toggle split pane"
        >
          <Icon name="splitPane" size={12} />
        </button>
      </div>

      {/* Sort Dropdown */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="px-2.5 py-1.5 border border-navy-200 rounded text-xs bg-white text-navy-700 focus:outline-none focus:border-navy-400 cursor-pointer"
      >
        <option value="name">Name</option>
        <option value="date">Modified</option>
        <option value="created">Created</option>
        <option value="accessed">Accessed</option>
        <option value="size">Size</option>
        <option value="type">Type</option>
      </select>

      {/* View Toggle */}
      <div className="flex rounded overflow-hidden border border-navy-200">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`p-1.5 transition-all ${
            viewMode === 'grid' ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 hover:bg-navy-50'
          }`}
          title="Grid View"
        >
          <Icon name="grid" size={14} />
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`p-1.5 border-l border-navy-200 transition-all ${
            viewMode === 'list' ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 hover:bg-navy-50'
          }`}
          title="List View"
        >
          <Icon name="list" size={14} />
        </button>
        <button
          onClick={() => onViewModeChange('details')}
          className={`p-1.5 border-l border-navy-200 transition-all ${
            viewMode === 'details' ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 hover:bg-navy-50'
          }`}
          title="Details View"
        >
          <Icon name="columns" size={14} />
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-navy-100 shadow-medium z-40 px-4 py-3 flex items-center gap-4 flex-wrap animate-slide-down">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy-500">Category:</span>
            <select
              value={filterCategory || ''}
              onChange={(e) => onFilterCategoryChange?.(e.target.value || null)}
              className="px-2 py-1 border border-navy-200 rounded text-xs bg-white focus:outline-none focus:border-navy-400"
            >
              <option value="">All</option>
              <option value="Documents">Documents</option>
              <option value="Spreadsheets">Spreadsheets</option>
              <option value="Presentations">Presentations</option>
              <option value="Images">Images</option>
              <option value="Archives">Archives</option>
              <option value="Code">Code</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy-500">Status:</span>
            <select
              value={filterStatus || ''}
              onChange={(e) => onFilterStatusChange?.(e.target.value || null)}
              className="px-2 py-1 border border-navy-200 rounded text-xs bg-white focus:outline-none focus:border-navy-400"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Sensitivity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy-500">Sensitivity:</span>
            <select
              value={filterSensitivity || ''}
              onChange={(e) => onFilterSensitivityChange?.(e.target.value || null)}
              className="px-2 py-1 border border-navy-200 rounded text-xs bg-white focus:outline-none focus:border-navy-400"
            >
              <option value="">All</option>
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
            </select>
          </div>

          {/* File Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy-500">Type:</span>
            <select
              value={filterFileType || ''}
              onChange={(e) => onFilterFileTypeChange?.(e.target.value || '')}
              className="px-2 py-1 border border-navy-200 rounded text-xs bg-white focus:outline-none focus:border-navy-400"
            >
              <option value="">All</option>
              {fileTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                onClearFilters?.();
                onFilterFileTypeChange?.('');
                setShowFilters(false);
              }}
              className="flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs transition-all"
            >
              <Icon name="close" size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
