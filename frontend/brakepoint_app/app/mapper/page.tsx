'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Divider, Box, Typography, List, ListItem, ListItemAvatar, ListItemText, TextField, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';

import SideTab from '@components/map/sideTab';
import Table from '@components/ui/table';

const Map = dynamic(() => import("@components/map/map"), { ssr: false });

import './style.css';

type DrawMode = "none" | "drawPolygon" | "editPolygon" | "deletePolygon";

export default function MapPage() {
  const router = useRouter();

  const [open, setOpen] = useState(true);

  const [map, setMap] = useState<maplibregl.Map | null>(null);

  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [draftPoly, setDraftPoly] = useState<[number, number][]>([]); // [lng, lat]
  

  return (
    <>
      <Box sx={{ height: "100vh", width: "100vw", zIndex:0 }}>
        <Map
          mode="map"
          refreshTrigger={0}
          goTo={null}
        />
      </Box>

      <SideTab side="left" open={open} onToggle={() => setOpen((v) => !v)}>
       
      </SideTab>
    </>
  );
}