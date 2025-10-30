'use client';

import React, { useState } from 'react';
import Map from '@components/map/map.js';
import ToggleDrawer from '@components/map/toggleDrawer';

export default function MapPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ToggleDrawer side="left" open={open}  onToggle={() => setOpen(!open)}></ToggleDrawer>
      <Map/>
      
    </>
    
  )

}