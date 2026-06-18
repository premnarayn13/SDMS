import React, { useState } from 'react';
import DocumentCard from './DocumentCard';
import DocumentRow from './DocumentRow';
import DocumentDetailsRow from './DocumentDetailsRow';
import QuickPreview from './QuickPreview';
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

export default function DocumentGrid({ 
  items, 
  viewMode,
  selectedItems = [],
  clipboardItems = [],
  clipboardOperation,
  onItemClick,
  onItemDoubleClick,
  onContextMenu,
  onCheckboxChange,
  onFavoriteClick,
  onMenuClick
}) {
  const [hoverItem, setHoverItem] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const selectedIdSet = new Set((selectedItems || []).map(id => String(id)));

  if (items.length === 0) {
    return null;
  }

  // Separate folders and files, sort folders first
  const folders = items.filter(i => i.type === 'folder');
  const files = items.filter(i => i.type === 'file');
  const sortedItems = [...folders, ...files];

  const handleMouseEnter = (e, item) => {
    const timeout = setTimeout(() => {
      setHoverItem(item);
      setHoverPosition({ x: e.clientX, y: e.clientY });
    }, 800); // Delay before showing preview
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    setHoverItem(null);
  };

  if (viewMode === 'grid') {
    return (
      <>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))' }}>
          {sortedItems.map(item => (
            <div
              key={item.id}
              onMouseEnter={(e) => handleMouseEnter(e, item)}
              onMouseLeave={handleMouseLeave}
            >
              <DocumentCard
                item={item}
                isSelected={selectedIdSet.has(String(item.id))}
                isCut={clipboardItems.includes(item.id) && clipboardOperation === 'cut'}
                onClick={(e) => onItemClick(e, item.id)}
                onDoubleClick={() => onItemDoubleClick(item.id)}
                onContextMenu={(e) => onContextMenu(e, item.id)}
                onCheckboxChange={onCheckboxChange}
                onFavoriteClick={onFavoriteClick}
              />
            </div>
          ))}
        </div>
        <QuickPreview item={hoverItem} position={hoverPosition} isVisible={!!hoverItem} />
      </>
    );
  }

  // Details view - comprehensive table
  if (viewMode === 'details') {
    return (
      <>
        <div className="bg-white rounded-lg border border-navy-100 overflow-hidden shadow-soft">
          <table className="w-full">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr className="text-xs text-navy-600 font-medium">
                <th className="px-3 py-2.5 text-left w-10"></th>
                <th className="px-3 py-2.5 text-left">Name</th>
                <th className="px-3 py-2.5 text-left w-24">Type</th>
                <th className="px-3 py-2.5 text-left w-24">Size</th>
                <th className="px-3 py-2.5 text-left w-28">Modified</th>
                <th className="px-3 py-2.5 text-left w-28">Created</th>
                <th className="px-3 py-2.5 text-left w-28">Accessed</th>
                <th className="px-3 py-2.5 text-left w-20">Status</th>
                <th className="px-3 py-2.5 text-left w-28">Tags</th>
                <th className="px-3 py-2.5 text-left w-24">Sensitivity</th>
                <th className="px-3 py-2.5 text-center w-10">
                  <Icon name="star" size={12} className="text-navy-400" />
                </th>
                <th className="px-3 py-2.5 text-center w-10">
                  <Icon name="pin" size={12} className="text-navy-400" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {sortedItems.map(item => (
                <DocumentDetailsRow
                  key={item.id}
                  item={item}
                  isSelected={selectedIdSet.has(String(item.id))}
                  isCut={clipboardItems.includes(item.id) && clipboardOperation === 'cut'}
                  onClick={(e) => onItemClick(e, item.id)}
                  onDoubleClick={() => onItemDoubleClick(item.id)}
                  onContextMenu={(e) => onContextMenu(e, item.id)}
                  onCheckboxChange={onCheckboxChange}
                  onFavoriteClick={onFavoriteClick}
                  onMouseEnter={(e) => handleMouseEnter(e, item)}
                  onMouseLeave={handleMouseLeave}
                />
              ))}
            </tbody>
          </table>
        </div>
        <QuickPreview item={hoverItem} position={hoverPosition} isVisible={!!hoverItem} />
      </>
    );
  }

  // List view
  return (
    <>
      <div className="flex flex-col gap-1">
        {/* Header Row */}
        <div 
          className="grid items-center py-2.5 px-3 bg-navy-50 rounded-lg font-medium text-xs text-navy-600 border border-navy-100"
          style={{ gridTemplateColumns: '36px 36px 1fr 90px 90px 100px 50px' }}
        >
          <div></div>
          <div></div>
          <div>Name</div>
          <div>Type</div>
          <div>Size</div>
          <div>Modified</div>
          <div></div>
        </div>

        {/* Item Rows */}
        {sortedItems.map(item => (
          <div
            key={item.id}
            onMouseEnter={(e) => handleMouseEnter(e, item)}
            onMouseLeave={handleMouseLeave}
          >
            <DocumentRow
              item={item}
              isSelected={selectedIdSet.has(String(item.id))}
              isCut={clipboardItems.includes(item.id) && clipboardOperation === 'cut'}
              onClick={(e) => onItemClick(e, item.id)}
              onDoubleClick={() => onItemDoubleClick(item.id)}
              onContextMenu={(e) => onContextMenu(e, item.id)}
              onMenuClick={onMenuClick}
              onCheckboxChange={onCheckboxChange}
            />
          </div>
        ))}
      </div>
      <QuickPreview item={hoverItem} position={hoverPosition} isVisible={!!hoverItem} />
    </>
  );
}
