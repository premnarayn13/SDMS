import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../utils/helpers';
import Toolbar from './Toolbar';

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

export default function Header({ 
  searchQuery, 
  onSearchChange, 
  onUploadClick, 
  onNewFolderClick, 
  onPropertiesToggle,
  onRefresh,
  onConvertClick,
  onDownloadAsideClick,
  onDeleteClick,
  onPDFToolsClick,
  onStorageManagerClick,
  onBackupRestoreClick,
  onSettingsClick,
  onLogout,
  user,
  toolbarProps
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  // Handle logout action
  const handleLogoutClick = async () => {
    setShowUserMenu(false);
    try {
      if (typeof onLogout === 'function') {
        await onLogout();
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Navigate to login even if logout fails
      navigate('/login', { replace: true });
    }
  };

  // Navigate to storage manager page
  const handleStorageClick = () => {
    if (typeof onStorageManagerClick === 'function') {
      onStorageManagerClick();
      return;
    }
    navigate('/storage');
  };

  const handleBackupClick = () => {
    if (typeof onBackupRestoreClick === 'function') {
      onBackupRestoreClick();
      return;
    }
    navigate('/storage?tab=backup');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 overflow-visible">
      <div className="h-14 px-4 flex items-center gap-3 overflow-visible">
      {/* Search Box */}
      <div className="flex-1 min-w-[140px] max-w-xs sm:max-w-sm relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon name="search" size={16} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files and folders..."
          className="input-search"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 overflow-x-auto py-1 max-w-full">
        {/* Power Tools - Primary action */}
        <button
          onClick={onPDFToolsClick}
          className="flex items-center gap-1 text-xs py-1.5 px-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all duration-200 whitespace-nowrap"
          title="Document Power Tools"
        >
          <Icon name="zap" size={13} />
          <span>Tools</span>
        </button>
        
        {/* Storage Manager - Navigate to page */}
        <button
          onClick={handleStorageClick}
          className="flex items-center gap-1 text-xs py-1.5 px-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 whitespace-nowrap"
          title="Storage Analytics & Management"
        >
          <Icon name="database" size={13} />
          <span>Storage</span>
        </button>

        {/* Convert - Export/Convert access */}
        <button
          onClick={onConvertClick}
          className="flex items-center gap-1 text-xs py-1.5 px-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all duration-200 whitespace-nowrap"
          title="Export & Convert"
        >
          <Icon name="convert" size={13} />
          <span>Convert</span>
        </button>

        <button
          onClick={onDownloadAsideClick}
          className="flex items-center gap-1 text-xs py-1.5 px-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-all duration-200 whitespace-nowrap"
          title="Download selected file"
        >
          <Icon name="download" size={13} />
          <span>Download</span>
        </button>

        <button
          onClick={onDeleteClick}
          className="flex items-center gap-1 text-xs py-1.5 px-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 whitespace-nowrap"
          title="Delete selected"
        >
          <Icon name="trash" size={13} />
          <span>Delete</span>
        </button>
        
        {/* Backup & Restore - Navigate to storage page backup tab */}
        <button
          onClick={handleBackupClick}
          className="flex items-center gap-1 text-xs py-1.5 px-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 whitespace-nowrap"
          title="Backup & Restore"
        >
          <Icon name="save" size={13} />
          <span>Backup</span>
        </button>
        
        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
        
        {/* Primary Actions */}
        <button
          onClick={onUploadClick}
          className="btn-primary flex items-center gap-1 text-xs py-1.5 px-2.5 whitespace-nowrap"
        >
          <Icon name="upload" size={13} />
          <span>Upload</span>
        </button>
        
        <button
          onClick={onNewFolderClick}
          className="btn-secondary flex items-center gap-1 text-xs py-1.5 px-2.5 whitespace-nowrap"
        >
          <Icon name="folderPlus" size={13} />
          <span>Folder</span>
        </button>
        
        {/* Icon Buttons */}
        <button
          onClick={onPropertiesToggle}
          className="btn-icon"
          title="Properties"
        >
          <Icon name="info" size={16} />
        </button>
        
        <button
          onClick={onRefresh}
          className="btn-icon"
          title="Refresh"
        >
          <Icon name="refresh" size={16} />
        </button>
        
      </div>

      {/* User Menu - Moved outside overflow container */}
      <div className="relative ml-auto pl-2 border-l border-slate-200 flex-shrink-0 z-[100]">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
          title="Account"
        >
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <Icon name="chevronDown" size={14} className="text-slate-400" />
        </button>
        
        {showUserMenu && (
          <>
            <div 
              className="fixed inset-0 z-[90]" 
              onClick={() => setShowUserMenu(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-strong border border-slate-200 py-2 z-[100] animate-fade-in">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-slate-200">
                <p className="font-medium text-slate-900 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</p>
              </div>
              
              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => { setShowUserMenu(false); onSettingsClick?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200"
                >
                  <Icon name="settings" size={16} className="text-slate-400" />
                  <span>Settings</span>
                </button>
                
                <button
                  onClick={() => { setShowUserMenu(false); onSettingsClick?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200"
                >
                  <Icon name="user" size={16} className="text-slate-400" />
                  <span>Profile</span>
                </button>
                
                <button
                  onClick={() => { setShowUserMenu(false); handleStorageClick(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200"
                >
                  <Icon name="database" size={16} className="text-slate-400" />
                  <span>Storage</span>
                </button>
              </div>
              
              {/* Logout */}
              <div className="border-t border-slate-200 pt-1 mt-1">
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                >
                  <Icon name="logout" size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      </div>

      </div>

      {toolbarProps && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 overflow-visible">
          <div className="relative w-full overflow-visible">
            <Toolbar {...toolbarProps} embedded />
          </div>
        </div>
      )}
    </header>
  );
}
