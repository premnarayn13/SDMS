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

export default function ClipboardBar({ clipboard, onPaste, onClear }) {
  if (!clipboard.items.length) return null;

  return (
    <div className="bg-navy-100 border-b border-navy-200 py-2.5 px-6 flex items-center gap-4 text-sm animate-slide-down">
      <div className="flex items-center gap-2 text-navy-700">
        <div className="w-6 h-6 rounded bg-navy-200 flex items-center justify-center">
          <Icon name={clipboard.operation === 'cut' ? 'cut' : 'copy'} size={14} className="text-navy-600" />
        </div>
        <span className="font-medium">
          {clipboard.items.length} item{clipboard.items.length !== 1 ? 's' : ''} {clipboard.operation === 'cut' ? 'cut' : 'copied'}
        </span>
      </div>
      <button
        onClick={onPaste}
        className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
      >
        <Icon name="clipboard" size={14} />
        Paste here
      </button>
      <button
        onClick={onClear}
        className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-3"
      >
        <Icon name="close" size={14} />
        Clear
      </button>
    </div>
  );
}
