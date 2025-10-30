'use client';

import {KeyboardArrowUp, KeyboardArrowDown, KeyboardArrowLeft, KeyboardArrowRight} from '@mui/icons-material';
import { IconButton } from '@mui/material';
import './toggleDrawer.css';

type ToggleDrawerProps = {
  side: 'top' | 'bottom' | 'left' | 'right';
  open: boolean;
  onToggle: () => void;
};

export default function ToggleDrawer({side, open, onToggle}: ToggleDrawerProps) {
    const icon = {
        top: open ? <KeyboardArrowUp /> : <KeyboardArrowDown />,
        bottom: open ? <KeyboardArrowDown /> : <KeyboardArrowUp />,
        left: open ? <KeyboardArrowLeft /> : <KeyboardArrowRight />,
        right: open ? <KeyboardArrowRight /> : <KeyboardArrowLeft />,
    }[side];

    return (
    <IconButton
      className={`toggle-button toggle-${side}`}
      onClick={onToggle}
    >
      {icon}
    </IconButton>
  );

}
