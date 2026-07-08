import React, { useLayoutEffect, useRef, useState } from 'react';
import { Icons } from '../utils/helpers';

// Icon component to render SVG icons safely
const Icon = ({ name, size = 14, className = '' }) => {
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

export default function ContextMenu({ 
  visible, 
  x: initialX, 
  y: initialY, 
  isMultiSelect,
  selectedCount,
  inTrash,
  hasClipboard,
  isFavorite,
  isPinned,
  isFolder,
  isArchive,
  isCompressed,
  isEmptySpace,
  canMergePDFs,
  canConvertWordsToPDF,
  canCombineImagesToPDF,
  onOpen,
  onDownload,
  onCut,
  onCopy,
  onPaste,
  onRename,
  onDuplicate,
  onMove,
  onToggleFavorite,
  onTogglePin,
  onShare,
  onAddTag,
  onProperties,
  onFolderColor,
  onArchive,
  onExtract,
  onSecureDelete,
  onBundleUp,
  onMoveToTrash,
  onRestore,
  onPermanentDelete,
  onPDFTools,
  onMergePDFs,
  onConvertWordsToPDF,
  onCombineImagesToPDF,
  onNewFolder,
  onOpenWithGoogleDocs,
  onUpload
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x: initialX, y: initialY });

  useLayoutEffect(() => {
    if (visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let nextX = initialX;
      let nextY = initialY;

      // Adjust horizontally
      if (initialX + rect.width > viewportWidth - 10) {
        nextX = initialX - rect.width;
      }

      // Adjust vertically
      if (initialY + rect.height > viewportHeight - 10) {
        nextY = initialY - rect.height;
      }

      // Final bounds check
      nextX = Math.max(10, Math.min(nextX, viewportWidth - rect.width - 10));
      nextY = Math.max(10, Math.min(nextY, viewportHeight - rect.height - 10));

      setPos({ x: nextX, y: nextY });
    }
  }, [visible, initialX, initialY]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="dropdown-menu fixed min-w-[180px]"
      style={{ left: pos.x, top: pos.y, visibility: 'visible' }}
    >
      {/* Empty space context menu - for creating new items */}
      {isEmptySpace && !inTrash && (
        <>
          <MenuItem icon="folderPlus" label="New Folder" onClick={onNewFolder} />
          <MenuItem icon="upload" label="Upload Files" onClick={onUpload} />
          {hasClipboard && (
            <>
              <Divider />
              <MenuItem icon="clipboard" label="Paste" shortcut="Ctrl+V" onClick={onPaste} />
            </>
          )}
          <Divider />
          <MenuItem icon="refresh" label="Refresh" onClick={() => window.location.reload()} />
        </>
      )}

      {!inTrash && !isEmptySpace && (
        <>
          {isMultiSelect ? (
            <>
              <MenuItem icon="check" label={`${selectedCount} items selected`} disabled />
              <Divider />
              <MenuItem icon="download" label="Download Selected" onClick={onDownload} />
              <MenuItem icon="scissors" label="Cut Selected" shortcut="Ctrl+X" onClick={onCut} />
              <MenuItem icon="copy" label="Copy Selected" shortcut="Ctrl+C" onClick={onCopy} />
              <MenuItem icon="move" label="Move Selected..." onClick={onMove} />
              <MenuItem icon="folderPlus" label="Bundle Up..." onClick={onBundleUp} highlight />
              {(canMergePDFs || canConvertWordsToPDF || canCombineImagesToPDF) && <Divider />}
              {canMergePDFs && (
                <MenuItem icon="merge" label="Merge PDFs" onClick={onMergePDFs} highlight />
              )}
              {canConvertWordsToPDF && (
                <MenuItem icon="convert" label="Convert Word Files to PDF" onClick={onConvertWordsToPDF} highlight />
              )}
              {canCombineImagesToPDF && (
                <MenuItem icon="image" label="Combine Images to PDF" onClick={onCombineImagesToPDF} highlight />
              )}
              <Divider />
              <MenuItem icon="trash" label="Delete Selected" shortcut="Del" onClick={onMoveToTrash} danger />
            </>
          ) : (
            <>
              <MenuItem
                  icon="externalLink"
                  label="Open"
                  shortcut="Enter"
                  onClick={onOpen}
              />

              <MenuItem
                  icon="externalLink"
                  label="Open with Google Docs"
                  onClick={onOpenWithGoogleDocs}
              />

              <MenuItem
                  icon="download"
                  label="Download"
                  onClick={onDownload}
              />
              <Divider />
              <MenuItem icon="scissors" label="Cut" shortcut="Ctrl+X" onClick={onCut} />
              <MenuItem icon="copy" label="Copy" shortcut="Ctrl+C" onClick={onCopy} />
              {hasClipboard && (
                <MenuItem icon="clipboard" label="Paste" shortcut="Ctrl+V" onClick={onPaste} />
              )}
              <Divider />
              <MenuItem icon="edit" label="Rename" shortcut="F2" onClick={onRename} />
              <MenuItem icon="copy" label="Make a Copy" onClick={onDuplicate} />
              <MenuItem icon="move" label="Move to..." onClick={onMove} />
              <Divider />
              <MenuItem 
                icon={isFavorite ? 'star' : 'starFilled'} 
                label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'} 
                onClick={onToggleFavorite} 
              />
              <MenuItem 
                icon="pin" 
                label={isPinned ? 'Unpin from Quick Access' : 'Pin to Quick Access'} 
                onClick={onTogglePin} 
              />
              <MenuItem icon="share" label="Share" onClick={onShare} />
              <MenuItem icon="tag" label="Add Tag" onClick={onAddTag} />
              <Divider />
              <MenuItem icon="zap" label="Power Tools" onClick={onPDFTools} highlight />
              <Divider />
              {isFolder && (
                <MenuItem icon="folder" label="Folder Appearance" onClick={onFolderColor} />
              )}
              {!isCompressed && <MenuItem icon="archive" label="Create Archive (ZIP)" onClick={onArchive} />}
              {(isArchive || isCompressed) && (
                <MenuItem icon="folderOpen" label="Extract Archive" onClick={onExtract} />
              )}
              <MenuItem icon="info" label="Properties" onClick={onProperties} />
              <Divider />
              <MenuItem icon="trash" label="Move to Trash" shortcut="Del" onClick={onMoveToTrash} danger />
            </>
          )}
        </>
      )}
      
      {inTrash && (
        <>
          <MenuItem icon="refresh" label="Restore" onClick={onRestore} />
          <Divider />
          <MenuItem icon="trash" label="Delete Permanently" onClick={onPermanentDelete} danger />
          <MenuItem icon="lock" label="Secure Delete" onClick={onSecureDelete} danger />
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, shortcut, onClick, danger, highlight, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        py-1.5 px-3 flex items-center gap-2 cursor-pointer text-[11px] transition-colors
        ${disabled ? 'opacity-60 cursor-default' : 'hover:bg-navy-50'}
        ${danger ? 'text-red-600 hover:bg-red-50' : highlight ? 'text-navy-700 bg-navy-50/50' : 'text-navy-700'}
      `}
    >
      <Icon name={icon} size={12} className={danger ? 'text-red-500' : highlight ? 'text-navy-600' : 'text-navy-400'} />
      <span className="flex-1 font-medium">{label}</span>
      {shortcut && (
        <span className="ml-2 text-[10px] text-navy-400 font-normal">{shortcut}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-navy-100 my-0.5 mx-2" />;
}
