import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatSize, Icons } from '../utils/helpers';
import { driveSettingsApi, megaSettingsApi, storageUtils } from '../utils/settingsApi';
import TreeView from './TreeView';
import logo from '../assets/Logo_DocMatrix.png';

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

const NAV_ITEMS = [
  { view: 'home', icon: 'home', label: 'Home' },
  { view: 'all', icon: 'folder', label: 'All Files' },
  { view: 'recent', icon: 'clock', label: 'Recent' },
  { view: 'favorites', icon: 'star', label: 'Favorites' },
  { view: 'shared', icon: 'users', label: 'Shared' },
  { view: 'workspace', icon: 'briefcase', label: 'Workspace' },
];

const LABELS = [
  { tag: 'work', color: '#3b82f6', label: 'Work' },
  { tag: 'personal', color: '#8b5cf6', label: 'Personal' },
  { tag: 'important', color: '#ef4444', label: 'Important' },
  { tag: 'urgent', color: '#f97316', label: 'Urgent' },
];

// Default drive sections (static)
const DEFAULT_DRIVE_SECTIONS = [
  { id: 'shared', name: 'Shared Drives', icon: 'users' },
  { id: 'archive', name: 'Archive', icon: 'archive' },
];

export default function Sidebar({ onFilterByTag, onActivityClick, onOpenItem, width = 320 }) {
  const { state, actions } = useApp();
  const { currentView, currentFolder, items, storage } = state;
  const [expandedDrives, setExpandedDrives] = useState(['main']);
  const [showFolders, setShowFolders] = useState(true);
  const [linkedDrives, setLinkedDrives] = useState([]);
  const [loadingDrives, setLoadingDrives] = useState(true);
  const [megaSummary, setMegaSummary] = useState({
    connected: false,
    fileCount: 0,
    usedBytes: 0,
    totalBytes: 20 * 1024 * 1024 * 1024,
    remainingBytes: 20 * 1024 * 1024 * 1024,
    email: '',
    folderName: ''
  });

  const trashCount = items.filter(i => i.trash).length;
  const pinnedItems = items.filter(i => i.pinned && !i.trash);

  // Load linked drives from API
  useEffect(() => {
    const loadDrives = async () => {
      try {
        setLoadingDrives(true);
        const [driveResult, megaStatus] = await Promise.all([
          driveSettingsApi.getAllDrives(),
          megaSettingsApi.getStatus().catch(() => ({ connected: false }))
        ]);

        const result = driveResult || { drives: [] };
        setLinkedDrives(result.drives || []);
        // Expand first drive by default
        if (result.drives?.length > 0) {
          setExpandedDrives(['drive-0']);
        }

        if (megaStatus?.connected) {
          const megaFilesResult = await megaSettingsApi.listFiles().catch(() => ({ files: [] }));
          const files = megaFilesResult?.files || [];
          const usedBytes = files.reduce((sum, file) => sum + (Number(file?.size_bytes) || 0), 0);
          const totalBytes = 20 * 1024 * 1024 * 1024;
          setMegaSummary({
            connected: true,
            fileCount: files.length,
            usedBytes,
            totalBytes,
            remainingBytes: Math.max(0, totalBytes - usedBytes),
            email: megaStatus?.mega_email || '',
            folderName: megaStatus?.folder_name || ''
          });
        } else {
          setMegaSummary((prev) => ({ ...prev, connected: false, fileCount: 0, usedBytes: 0, remainingBytes: prev.totalBytes }));
        }
      } catch (error) {
        console.warn('Could not load drives:', error);
        // Fallback to showing default drive structure
        setLinkedDrives([]);
        setMegaSummary((prev) => ({ ...prev, connected: false, fileCount: 0, usedBytes: 0, remainingBytes: prev.totalBytes }));
      } finally {
        setLoadingDrives(false);
      }
    };
    loadDrives();
  }, []);

  const handleNavClick = (view) => {
    actions.navigateTo(view);
  };

  const handleFolderClick = (folderId) => {
    if (folderId === null) {
      actions.goToRoot();
    } else {
      actions.openFolder(folderId);
    }
  };

  const openStorageScope = (provider, id, label = '') => {
    actions.setStorageScope?.({ provider, id, label });
  };

  const toggleDrive = (driveId) => {
    setExpandedDrives(prev => 
      prev.includes(driveId) 
        ? prev.filter(id => id !== driveId)
        : [...prev, driveId]
    );
  };

  const storagePercent = Math.min(storage.percent, 100);
  const storageColor = storagePercent > 90 ? '#ef4444' : storagePercent > 70 ? '#f59e0b' : '#22c55e';

  const handleFileClick = (fileItem) => {
    if (!fileItem) return;
    actions.selectItem(fileItem.id);
    onOpenItem?.(fileItem);
  };

  return (
    <aside
      className="bg-navy-900 text-white flex flex-col fixed h-screen z-50 transition-all duration-300"
      style={{ width: `${width}px` }}
    >
      {/* Logo */}
      <div className="h-20 flex items-center justify-center px-3 border-b border-white/10">
        <img
          src={logo}
          alt="DocMatrix"
          className="max-h-17 w-auto object-contain"
        />
        
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {/* Main Navigation */}
        <div className="mb-3">
          <div className="section-header">Navigation</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={`nav-item w-full ${
                currentView === item.view && currentFolder === null ? 'nav-item-active' : ''
              }`}
            >
              <Icon name={item.icon} size={18} className="opacity-80" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Quick Access (Pinned) */}
        {pinnedItems.length > 0 && (
          <div className="mb-3">
            <div className="section-header flex items-center gap-2">
              <Icon name="pin" size={14} className="opacity-60" />
              <span>Quick Access</span>
            </div>
            {pinnedItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.type === 'folder') {
                    handleFolderClick(item.id);
                    return;
                  }
                  handleFileClick(item);
                }}
                className={`nav-item w-full ${
                  currentFolder === item.id ? 'nav-item-active' : ''
                }`}
              >
                <Icon 
                  name={item.type === 'folder' ? 'folder' : 'file'} 
                  size={18} 
                  className={item.type === 'folder' ? 'text-sky-400' : 'text-gray-400'} 
                />
                <span className="sidebar-file-name truncate">{item.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Drive Sections - Multi-Drive Support */}
        <div className="mb-3">
          <button
            onClick={() => setShowFolders(!showFolders)}
            className="section-header w-full flex items-center justify-between cursor-pointer hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Icon name="hardDrive" size={14} className="opacity-60" />
              <span>My Drives</span>
              {linkedDrives.length > 0 && (
                <span className="ml-1 bg-white/20 px-1.5 rounded text-[10px]">
                  {linkedDrives.length}
                </span>
              )}
            </span>
            <Icon name={showFolders ? 'chevronDown' : 'chevronRight'} size={14} className="opacity-60" />
          </button>
          
          {showFolders && (
            <div className="mt-1 space-y-0.5">
              {/* Loading State */}
              {loadingDrives && (
                <div className="px-2 py-1 text-xs text-navy-400">
                  Loading drives...
                </div>
              )}
              
              {/* Linked Google Drives */}
              {!loadingDrives && linkedDrives.map((drive, index) => (
                <div key={drive.id} className="drive-section">
                  {/* Drive Header */}
                  <button
                    onClick={() => {
                      toggleDrive(`drive-${index}`);
                      openStorageScope('google', drive.id, drive.label || drive.display_name || `Drive ${String.fromCharCode(65 + index)}`);
                    }}
                    className={`flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs font-medium text-navy-200 hover:bg-white/10 transition-all ${
                      index === 0 && currentFolder === null && currentView === 'home' ? 'bg-white/15 text-white' : ''
                    }`}
                  >
                    <Icon 
                      name={expandedDrives.includes(`drive-${index}`) ? 'chevronDown' : 'chevronRight'} 
                      size={14} 
                      className="opacity-60 flex-shrink-0" 
                    />
                    {/* Drive Color Indicator */}
                    <span 
                      className="w-3 h-3 rounded flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: drive.color || '#3b82f6' }}
                    >
                      <Icon name="hardDrive" size={12} className="text-white" />
                    </span>
                    <span className="truncate flex-1 text-left">
                      {drive.label || drive.display_name || `Drive ${String.fromCharCode(65 + index)}`}
                    </span>
                    {drive.is_primary && (
                      <span className="text-[10px] bg-sky-500/30 text-sky-300 px-1.5 rounded">
                        Primary
                      </span>
                    )}
                  </button>
                  
                  {/* Drive Storage Info */}
                  {expandedDrives.includes(`drive-${index}`) && (
                    <div className="ml-6 mt-1 mb-1">
                      {/* Storage Bar */}
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(100, ((drive.quota_bytes_used || 0) / (drive.allocated_storage_bytes || 10737418240)) * 100)}%`,
                              backgroundColor: drive.color || '#3b82f6'
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-navy-400 whitespace-nowrap">
                          {formatSize(drive.quota_bytes_used || 0)} / {formatSize(drive.allocated_storage_bytes || 10737418240)}
                        </span>
                      </div>
                      
                      {/* Drive Email */}
                      <div className="px-2 text-[11px] text-navy-400 truncate" title={drive.drive_email}>
                        {drive.drive_email}
                      </div>
                      
                      {/* Drive Contents - Tree View */}
                      <div className="mt-1 border-l border-white/10 pl-2">
                        <TreeView 
                          items={items.filter(item => (item.storageProvider || 'google') === 'google' && ( (item.driveId || item.drive_id) === drive.id || (index === 0 && !item.driveId)))} 
                          currentFolder={currentFolder} 
                          onFolderClick={handleFolderClick}
                          onFileClick={handleFileClick}
                          showFiles
                          compact
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* MEGA Drive Section */}
              {!loadingDrives && (
                <div className="drive-section">
                  <button
                    onClick={() => {
                      toggleDrive('mega-drive');
                      openStorageScope('mega', 'mega-account', 'MEGA');
                    }}
                    className={`flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs font-medium transition-all ${
                      megaSummary.connected
                        ? 'text-navy-200 hover:bg-white/10'
                        : 'text-navy-400 hover:bg-white/6'
                    }`}
                  >
                    <Icon
                      name={expandedDrives.includes('mega-drive') ? 'chevronDown' : 'chevronRight'}
                      size={14}
                      className="opacity-60 flex-shrink-0"
                    />
                    <span className="w-3 h-3 rounded flex-shrink-0 flex items-center justify-center bg-sky-600">
                      <Icon name="hardDrive" size={12} className="text-white" />
                    </span>
                    <span className="truncate flex-1 text-left">Drive {String.fromCharCode(65 + linkedDrives.length)} · MEGA</span>
                    <span className={`text-[10px] px-1.5 rounded ${megaSummary.connected ? 'bg-emerald-500/25 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
                      {megaSummary.connected ? 'Connected' : 'Not linked'}
                    </span>
                  </button>

                  {expandedDrives.includes('mega-drive') && (
                    <div className="ml-6 mt-1 mb-1">
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (megaSummary.usedBytes / Math.max(megaSummary.totalBytes, 1)) * 100)}%`,
                              backgroundColor: '#0ea5e9'
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-navy-400 whitespace-nowrap">
                          {formatSize(megaSummary.usedBytes)} / {formatSize(megaSummary.totalBytes)}
                        </span>
                      </div>

                      <div className="px-2 text-[11px] text-navy-400 truncate" title={megaSummary.email || ''}>
                        {megaSummary.connected ? (megaSummary.email || megaSummary.folderName || 'MEGA Workspace') : 'Connect from Settings > MEGA'}
                      </div>

                      <div className="px-2 pt-1 text-[10px] text-navy-500">
                        {megaSummary.connected ? `${megaSummary.fileCount} file(s)` : 'No active MEGA connection'}
                      </div>

                      {megaSummary.connected && (
                        <div className="mt-1 border-l border-white/10 pl-2">
                          <TreeView
                            items={items.filter(item => item.storageProvider === 'mega')}
                            currentFolder={currentFolder}
                            onFolderClick={handleFolderClick}
                            onFileClick={handleFileClick}
                            showFiles
                            compact
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Add Drive Button */}
              {!loadingDrives && (
                <button
                  onClick={() => window.location.href = '/settings?tab=drive'}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm text-navy-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Icon name="plus" size={16} className="opacity-60" />
                  <span>Add Google Drive</span>
                </button>
              )}
              
              {/* Default Sections */}
              {DEFAULT_DRIVE_SECTIONS.map(drive => (
                <div key={drive.id} className="drive-section">
                  <button
                    onClick={() => toggleDrive(drive.id)}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs font-medium text-navy-200 hover:bg-white/10 transition-all opacity-60"
                  >
                    <Icon 
                      name={expandedDrives.includes(drive.id) ? 'chevronDown' : 'chevronRight'} 
                      size={14} 
                      className="opacity-60 flex-shrink-0" 
                    />
                    <Icon name={drive.icon} size={18} className="text-navy-400 flex-shrink-0" />
                    <span className="truncate">{drive.name}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Labels Section */}
        <div className="mb-3">
          <div className="section-header flex items-center gap-2">
            <Icon name="tag" size={14} className="opacity-60" />
            <span>Labels</span>
          </div>
          {LABELS.map(item => (
            <button
              key={item.tag}
              onClick={() => onFilterByTag?.(item.tag)}
              className="nav-item w-full"
            >
              <span 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Other Section */}
        <div className="mb-3">
          <div className="section-header">Other</div>
          <button
            onClick={() => onActivityClick?.()}
            className="nav-item w-full"
          >
            <Icon name="activity" size={18} className="opacity-80" />
            <span>Activity</span>
          </button>
          <button
            onClick={() => handleNavClick('trash')}
            className={`nav-item w-full ${
              currentView === 'trash' ? 'nav-item-active' : ''
            }`}
          >
            <Icon name="trash" size={18} className="opacity-80" />
            <span>Trash</span>
            {trashCount > 0 && (
              <span className="ml-auto bg-red-500 text-[11px] px-2 py-0.5 rounded-full font-medium">
                {trashCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Storage Info - Combined from all drives */}
      <div className="p-2.5 border-t border-white/10">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-medium text-navy-300 flex items-center gap-2">
            <Icon name="database" size={14} />
            Total Storage
          </span>
          <span className="text-xs font-medium" style={{ color: storageColor }}>
            {storagePercent.toFixed(0)}%
          </span>
        </div>
        
        {/* Combined storage bar */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden flex">
          {linkedDrives.length > 0 || megaSummary.connected ? (
            linkedDrives.map((drive, index) => {
              const driveUsed = drive.quota_bytes_used || 0;
              const totalAllocated = linkedDrives.reduce((sum, d) => sum + (d.allocated_storage_bytes || 10737418240), 0) + (megaSummary.connected ? megaSummary.totalBytes : 0);
              const drivePercent = (driveUsed / totalAllocated) * 100;
              return (
                <div
                  key={drive.id}
                  className="h-full transition-all duration-300"
                  style={{ 
                    width: `${drivePercent}%`,
                    backgroundColor: drive.color || `hsl(${index * 60}, 70%, 50%)`
                  }}
                  title={`${drive.label || `Drive ${String.fromCharCode(65 + index)}`}: ${formatSize(driveUsed)}`}
                />
              );
            }).concat(
              megaSummary.connected
                ? [
                    <div
                      key="mega-drive-total"
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${(megaSummary.usedBytes / Math.max(linkedDrives.reduce((sum, d) => sum + (d.allocated_storage_bytes || 10737418240), 0) + megaSummary.totalBytes, 1)) * 100}%`,
                        backgroundColor: '#0ea5e9'
                      }}
                      title={`MEGA: ${formatSize(megaSummary.usedBytes)}`}
                    />
                  ]
                : []
            )
          ) : (
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ 
                width: `${storagePercent}%`,
                backgroundColor: storageColor
              }}
            />
          )}
        </div>
        
        {/* Storage details */}
        <div className="text-[11px] text-navy-400 mt-1 flex justify-between">
          <span>
            {linkedDrives.length > 0 || megaSummary.connected
              ? formatSize(linkedDrives.reduce((sum, d) => sum + (d.quota_bytes_used || 0), 0) + (megaSummary.connected ? megaSummary.usedBytes : 0))
              : formatSize(storage.used)
            }
          </span>
          <span>
            of {linkedDrives.length > 0 || megaSummary.connected
              ? formatSize(linkedDrives.reduce((sum, d) => sum + (d.allocated_storage_bytes || 10737418240), 0) + (megaSummary.connected ? megaSummary.totalBytes : 0))
              : '10 GB'
            }
          </span>
        </div>
        
        {/* Drive legend (if multiple drives) */}
        {(linkedDrives.length > 1 || megaSummary.connected) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {linkedDrives.map((drive, index) => (
              <div key={drive.id} className="flex items-center gap-0.5">
                <span 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: drive.color || `hsl(${index * 60}, 70%, 50%)` }}
                />
                <span className="text-[10px] text-navy-400">
                  {drive.label?.charAt(0) || String.fromCharCode(65 + index)}
                </span>
              </div>
            ))}
            {megaSummary.connected && (
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
                <span className="text-[10px] text-navy-400">M</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workspace Shortcuts */}
      <div className="p-2.5 border-t border-white/10">
        <p className="text-[11px] uppercase tracking-wide text-navy-400 mb-2">Workspace</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => window.location.href = '/settings'}
            className="px-2 py-1.5 text-[11px] rounded bg-white/10 text-navy-100 hover:bg-white/20 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={() => window.location.href = '/?open=backup'}
            className="px-2 py-1.5 text-[11px] rounded bg-white/10 text-navy-100 hover:bg-white/20 transition-colors"
          >
            Backup
          </button>
        </div>
      </div>
    </aside>
  );
}
