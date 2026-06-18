import { useEffect, useCallback } from 'react';

export function useKeyboardShortcuts({
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onRename,
  onOpen,
  onEscape,
  selectedItems = []
}) {
  const handleKeyDown = useCallback((e) => {
    // Ignore if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Cut: Ctrl+X
    if (ctrl && e.key === 'x') {
      e.preventDefault();
      onCut?.();
    }
    
    // Copy: Ctrl+C
    if (ctrl && e.key === 'c') {
      e.preventDefault();
      onCopy?.();
    }
    
    // Paste: Ctrl+V
    if (ctrl && e.key === 'v') {
      e.preventDefault();
      onPaste?.();
    }
    
    // Delete
    if (e.key === 'Delete') {
      e.preventDefault();
      onDelete?.();
    }
    
    // Rename: F2
    if (e.key === 'F2' && selectedItems.length === 1) {
      e.preventDefault();
      onRename?.();
    }
    
    // Open: Enter
    if (e.key === 'Enter' && selectedItems.length === 1) {
      e.preventDefault();
      onOpen?.();
    }
    
    // Escape: clear selection / close modals
    if (e.key === 'Escape') {
      onEscape?.();
    }
  }, [onCut, onCopy, onPaste, onDelete, onRename, onOpen, onEscape, selectedItems]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
