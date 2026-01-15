'use client';

import React, {useRef, useState, useEffect} from 'react';
import ToggleDrawer from './toggleDrawer';
import './sideTab.css';

type SideTabProps = {
  side: 'left' | 'right';
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
};

export default function SideTab({ side, open, onToggle, children }: SideTabProps) {
  const [width, setWidth] = useState(480);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleDrag = (e:MouseEvent) => {
      if (!isDragging.current) return;

      if (side==='left') {
        setWidth(Math.min(Math.max(e.clientX, 480), 720));
      }

      if (side==='right') {
        setWidth(Math.min(Math.max(window.innerWidth - e.clientX, 480), 720));
      }; 
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleMouseUp);
    };

  }, [side]);

  const startDrag = () => {
    isDragging.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const saved = localStorage.getItem('sideTabWidth');
    if (saved) setWidth(Number(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('sideTabWidth', width.toString());
  }, [width]);


  return (
    <>
      <div className={`side-tab side-tab-${side} ${open ? 'open' : 'closed'}`} style={{ width: `${width}px` }}
      >
        <div className="side-tab-content">{children}</div>

        <div
          className={`side-tab-resizer side-tab-resizer-${side}`}
          onMouseDown={startDrag}
        />
      </div>

      <ToggleDrawer side={side} open={open} onToggle={onToggle} sideTabWidth={width}/>
    </>
  );
}