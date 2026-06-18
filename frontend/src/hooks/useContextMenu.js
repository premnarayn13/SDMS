import { useState, useCallback, useEffect } from 'react';

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    itemId: null,
    inTrash: false
  });

  const showContextMenu = useCallback((e, itemId, inTrash = false) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use viewport coordinates
    const clickX = e.clientX;
    const clickY = e.clientY;
    
    // Menu dimensions (approximate for calculation)
    const menuWidth = 200; 
    const menuHeight = inTrash ? 180 : 450;
    
    // Viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = clickX;
    let y = clickY;
    
    // Horizontal adjustment: if would overflow right, show on left
    if (clickX + menuWidth > viewportWidth - 10) {
      x = clickX - menuWidth;
    }
    
    // Vertical adjustment: if would overflow bottom, show on top
    if (clickY + menuHeight > viewportHeight - 10) {
      y = clickY - menuHeight;
    }
    
    // Ensure we don't go off the top or left edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setContextMenu({
      visible: true,
      x,
      y,
      itemId,
      inTrash
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Hide context menu on click outside
  useEffect(() => {
    const handleClick = () => hideContextMenu();
    const handleScroll = () => hideContextMenu();
    
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [hideContextMenu]);

  return { contextMenu, showContextMenu, hideContextMenu };
}
