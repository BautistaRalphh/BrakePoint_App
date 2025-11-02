'use client';

import React, { useEffect, useState } from 'react';
import {KeyboardArrowUp, KeyboardArrowDown, KeyboardArrowLeft, KeyboardArrowRight} from '@mui/icons-material';
import { IconButton } from '@mui/material';
import './toggleDrawer.css';

type ToggleDrawerProps = {
  side: 'top' | 'bottom' | 'left' | 'right';
  open: boolean;
  onToggle: () => void;
  sideTabWidth?: number;
};

export default function ToggleDrawer({side, open, onToggle, sideTabWidth}: ToggleDrawerProps) {
  const [translate, setTranslate] = useState(open ? sideTabWidth : 0);

  useEffect(() => {
    if (open) setTranslate(sideTabWidth);
    else setTranslate(0);
  }, [open, sideTabWidth]);

  const icon = {
        top: open ? <KeyboardArrowUp /> : <KeyboardArrowDown />,
        bottom: open ? <KeyboardArrowDown /> : <KeyboardArrowUp />,
        left: open ? <KeyboardArrowLeft /> : <KeyboardArrowRight />,
        right: open ? <KeyboardArrowRight /> : <KeyboardArrowLeft />,
    }[side];

  const sideClass = `toggle-${side}`;

  const style =
    side === 'left'
      ? { transform: `translateX(${translate}px) translateY(-50%)` }
      : side === 'right'
      ? { transform: `translateX(-${translate}px) translateY(-50%)` }
      : {};


    return (
    <IconButton
      className={`toggle-button toggle-${side}`}
      onClick={onToggle}
      style={style}
    >
      {icon}
    </IconButton>
  );

}
