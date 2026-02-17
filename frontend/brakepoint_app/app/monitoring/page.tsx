"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Box, Typography, IconButton, Badge, Menu, MenuItem, Snackbar, Alert, LinearProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useRouter } from "next/navigation";

import Timeline from "@components/timeline/timeline";

import "./style.css";

import dynamic from "next/dynamic";
const Map = dynamic(() => import("@components/map/map"), { ssr: false });

export default function MonitoringPage() {
  const router = useRouter();

  const [allFeeds, setAllFeeds] = useState<any[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<number | string | null>(null);
  const selectedFeedIdRef = useRef<number | string | null>(null);

  const [visibleCameraIds, setVisibleCameraIds] = useState<(number | string)[]>([]);

  const [camerasRefreshTrigger] = useState(0);

  useEffect(() => {
    selectedFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId]);

  const selectedFeed = useMemo(
    () => (selectedFeedId == null ? null : allFeeds.find((f) => String(f.id) === String(selectedFeedId)) ?? null),
    [allFeeds, selectedFeedId],
  );

  const handleCameraClick = useCallback((cameraId: number | string) => {
    setSelectedFeedId((prev) => (String(prev) === String(cameraId) ? null : cameraId));
  }, []);

  const handleVisibleCamerasChange = useCallback((ids: (number | string)[]) => {
    setVisibleCameraIds(ids);
  }, []);

  const handleCamerasLoaded = useCallback((cameras: any[]) => {
    const formatted = cameras.map((cam: any) => ({
      id: cam.id,
      name: cam.name,
      lat: cam.lat,
      lng: cam.lng,
      location: cam.location,
      latestUpload: cam.latest_upload || 'No uploads yet',
      vehicles: cam.vehicles || 0,
      occurrences: cam.occurrences || 0,
      behaviors: Array.isArray(cam.behaviors) && cam.behaviors.length > 0 ? cam.behaviors : ['No Data'],
      signs: cam.signs || 0,
      signClasses: cam.sign_classes || [],
      jeepneyHotspot: cam.latest_video?.jeepney_hotspot || false,
    }));

    setAllFeeds(formatted);

    if (
      selectedFeedIdRef.current != null &&
      !formatted.some((f) => String(f.id) === String(selectedFeedIdRef.current))
    ) {
      setSelectedFeedId(null);
    }
  }, []);

  return (

    // NEED TO SEE CAMERAS AND POLYGONS
    
    <Box>
      <Map
        mode="heatmap"
        onCameraClick={handleCameraClick}
        onVisibleCamerasChange={handleVisibleCamerasChange}
        onCamerasLoaded={handleCamerasLoaded}
        selectedCameraId={selectedFeedId}
        refreshTrigger={camerasRefreshTrigger}
        goTo={undefined}
      />

      <Timeline />
    </Box>

    
  );
}
