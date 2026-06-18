import React from 'react';
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

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = '480px', icon }) {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl w-[90%] max-h-[85vh] overflow-hidden shadow-strong animate-scale-in"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-4 px-5 border-b border-navy-100 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
            {icon && <Icon name={icon} size={16} className="text-navy-500" />}
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-navy-100 text-navy-400 hover:text-navy-600 transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="py-3 px-5 border-t border-navy-100 flex gap-2 justify-end bg-navy-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
