'use client';

import React, { useState } from 'react';
import Map from '@components/map/map.js';
import ToggleDrawer from '@components/map/toggleDrawer';
import SideTab from '@components/map/sideTab';

export default function MapPage() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Map/>
      <SideTab side="left" open={open} onToggle={() => setOpen(!open)}>
        <h2>Tools</h2>
        <p>Polygon, layers, etc.</p>
      </SideTab>
      
    </>
    
  )

}