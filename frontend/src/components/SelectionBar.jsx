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

// Action button component
const ActionButton = ({ icon, label, onClick, variant = 'default' }) => {
  const baseClass = "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200";
  const variants = {
    default: "text-white/90 hover:bg-white/15 hover:text-white",
    danger: "text-red-300 hover:bg-red-500/20 hover:text-red-200"
  };
  
  return (
    <button 
      onClick={onClick}
      className={`${baseClass} ${variants[variant]}`}
      title={label}
    >
      <Icon name={icon} size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default function SelectionBar({ 
  count, 
  onCut, 
  onCopy, 
  onDownload, 
  onBundle,
  onDelete, 
  onClear,
  canMergePDFs,
  canConvertWordsToPDF,
  canCombineImagesToPDF,
  onMergePDFs,
  onConvertWordsToPDF,
  onCombineImagesToPDF
}) {
  if (count <= 1) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy-900/95 text-white py-2 px-4 rounded-xl flex items-center gap-1 shadow-strong z-[9000] backdrop-blur-sm border border-navy-700 animate-slide-up">
      {/* Selection count badge */}
      <div className="flex items-center gap-2 px-2 py-1 bg-sky-500/20 rounded-lg mr-2">
        <Icon name="check" size={14} className="text-sky-400" />
        <span className="font-semibold text-xs text-sky-200 whitespace-nowrap">{count} selected</span>
      </div>
      
      {/* Divider */}
      <div className="w-px h-6 bg-navy-600 mx-1" />
      
      {/* Actions */}
      <ActionButton icon="cut" label="Cut" onClick={onCut} />
      <ActionButton icon="copy" label="Copy" onClick={onCopy} />
      <ActionButton icon="download" label="Download" onClick={onDownload} />
      <ActionButton icon="folderPlus" label="Bundle Up" onClick={onBundle} />

      {canMergePDFs && <ActionButton icon="merge" label="Merge PDFs" onClick={onMergePDFs} />}
      {canConvertWordsToPDF && <ActionButton icon="convert" label="Word → PDF" onClick={onConvertWordsToPDF} />}
      {canCombineImagesToPDF && <ActionButton icon="image" label="Images → PDF" onClick={onCombineImagesToPDF} />}
      
      {/* Divider */}
      <div className="w-px h-6 bg-navy-600 mx-1" />
      
      {/* Delete action */}
      <ActionButton icon="trash" label="Delete" onClick={onDelete} variant="danger" />
      
      {/* Divider */}
      <div className="w-px h-6 bg-navy-600 mx-1" />
      
      {/* Clear selection */}
      <button 
        onClick={onClear}
        className="p-1.5 rounded-md text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
        title="Clear Selection"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
