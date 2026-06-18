import React from 'react';
import { Icons, formatSize, formatDate } from '../utils/helpers';

const Icon = ({ name, size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}
    dangerouslySetInnerHTML={{ __html: Icons[name] || '' }}
  />
);

// Get file type configuration for icon and colors
const getFileTypeConfig = (item) => {
  const ext = item?.name?.split('.').pop()?.toLowerCase() || '';
  if (item?.type === 'folder') return { icon: 'folder', color: 'text-navy-600' };
  if (['pdf'].includes(ext)) return { icon: 'pdf', color: 'text-red-500' };
  if (['doc', 'docx'].includes(ext)) return { icon: 'word', color: 'text-blue-500' };
  if (['xls', 'xlsx'].includes(ext)) return { icon: 'excel', color: 'text-green-500' };
  if (['ppt', 'pptx'].includes(ext)) return { icon: 'powerpoint', color: 'text-orange-500' };
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return { icon: 'image', color: 'text-purple-500' };
  if (['txt', 'md', 'json', 'js', 'jsx', 'css', 'html'].includes(ext)) return { icon: 'text', color: 'text-navy-500' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: 'archive', color: 'text-amber-600' };
  return { icon: 'file', color: 'text-navy-500' };
};

export default function PropertiesPanel({ 
  item, 
  items = [],
  isOpen, 
  onClose,
  onOpen,
  onDownload,
  onShare,
  onRename
}) {
  if (!isOpen) return null;

  const parentFolder = item?.parentId ? items.find(i => i.id === item.parentId) : null;
  const sharedHtml = item?.shared?.length 
    ? item.shared.map(s => s.email).join(', ') 
    : 'Not shared';

  return (
    <div className="w-80 bg-white rounded-xl shadow-sm overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto border border-navy-100">
      {/* Header */}
      <div className="p-4 border-b border-navy-100 flex justify-between items-center bg-navy-50">
        <h3 className="text-base font-semibold text-navy-900 flex items-center gap-2">
          <Icon name="file" size={18} className="text-navy-600" />
          Properties
        </h3>
        <button 
          onClick={onClose}
          className="tool-btn"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Preview */}
      <div className="p-8 text-center bg-navy-50/50">
        {item ? (
          <Icon name={getFileTypeConfig(item).icon} size={64} className={getFileTypeConfig(item).color + ' mx-auto'} />
        ) : (
          <Icon name="document" size={64} className="text-navy-300 mx-auto" />
        )}
        <p className="text-sm font-semibold mt-2 text-navy-800">{item?.name || 'Select a file'}</p>
      </div>

      {/* Content */}
      {item ? (
        <>
          <div className="p-5">
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Type</div>
              <div className="text-sm text-navy-900">{item.type === 'folder' ? 'Folder' : item.fileType}</div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Size</div>
              <div className="text-sm text-navy-900">{formatSize(item.size)}</div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Created</div>
              <div className="text-sm text-navy-900">{formatDate(item.created || item.date)}</div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Modified</div>
              <div className="text-sm text-navy-900">{formatDate(item.date)}</div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Location</div>
              <div className="text-sm text-navy-900">{parentFolder?.name || 'My Drive'}</div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Favorite</div>
              <div className="text-sm text-navy-900 flex items-center gap-1">
                {item.favorite ? (
                  <>Yes <Icon name="star" size={14} className="text-amber-500" /></>
                ) : 'No'}
              </div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Shared</div>
              <div className="text-sm text-navy-900">{sharedHtml}</div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-navy-500 uppercase mb-0.5">Tags</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags?.length > 0 ? (
                  item.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-navy-100 text-navy-800 rounded-full text-xs">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-navy-400 text-sm">None</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-navy-100 flex flex-wrap gap-2">
            <button 
              onClick={onOpen}
              className="flex-1 min-w-[calc(50%-4px)] px-3 py-2 rounded-lg bg-navy-900 text-white text-xs font-medium hover:bg-navy-800 flex items-center justify-center gap-1.5"
            >
              <Icon name="eye" size={14} />
              Open
            </button>
            <button 
              onClick={onDownload}
              className="flex-1 min-w-[calc(50%-4px)] px-3 py-2 rounded-lg bg-navy-100 text-navy-700 text-xs font-medium hover:bg-navy-200 flex items-center justify-center gap-1.5"
            >
              <Icon name="download" size={14} />
              Download
            </button>
            <button 
              onClick={onShare}
              className="flex-1 min-w-[calc(50%-4px)] px-3 py-2 rounded-lg bg-navy-100 text-navy-700 text-xs font-medium hover:bg-navy-200 flex items-center justify-center gap-1.5"
            >
              <Icon name="share" size={14} />
              Share
            </button>
            <button 
              onClick={onRename}
              className="flex-1 min-w-[calc(50%-4px)] px-3 py-2 rounded-lg bg-navy-100 text-navy-700 text-xs font-medium hover:bg-navy-200 flex items-center justify-center gap-1.5"
            >
              <Icon name="edit" size={14} />
              Rename
            </button>
          </div>

          {/* History */}
          {item.history?.length > 0 && (
            <div className="border-t border-navy-100 p-4">
              <h4 className="text-sm font-medium text-navy-700 mb-3 flex items-center gap-2">
                <Icon name="version" size={16} className="text-navy-600" />
                File History
              </h4>
              {[...item.history].reverse().map((h, idx) => (
                <div key={idx} className="flex items-start gap-2.5 py-2 border-b border-navy-100 last:border-none">
                  <div className="w-2 h-2 bg-navy-600 rounded-full mt-1.5" />
                  <div>
                    <p className="text-xs text-navy-900">{h.action}</p>
                    <p className="text-xs text-navy-500">{h.date} by {h.user}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="p-5">
          <p className="text-navy-500 text-center text-sm">Select a file to view properties</p>
        </div>
      )}
    </div>
  );
}
