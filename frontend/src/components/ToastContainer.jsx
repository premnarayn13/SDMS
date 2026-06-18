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

export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 items-center">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  const iconMap = {
    success: 'check',
    error: 'close',
    warning: 'warning',
    info: 'info'
  };

  const colors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    warning: 'bg-amber-600',
    info: 'bg-navy-700'
  };

  return (
    <div 
      className={`
        py-2.5 px-4 rounded-lg shadow-strong flex items-center gap-2.5 min-w-[180px] max-w-[300px]
        text-white animate-slide-in cursor-pointer text-xs
        ${colors[toast.type] || 'bg-navy-800'}
      `}
      onClick={() => onRemove?.(toast.id)}
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon name={iconMap[toast.type] || 'info'} size={12} />
      </div>
      <span className="font-medium">{toast.message}</span>
    </div>
  );
}
