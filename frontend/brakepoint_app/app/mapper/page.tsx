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

import './style.css';

import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CarCrashIcon from '@mui/icons-material/CarCrash';
import DirectionsIcon from '@mui/icons-material/Directions';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';

// ✅ avoid name collision with global Map / your map.tsx registry typing
const MapView = dynamic(() => import('@/components/map/map'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        zIndex: 9999,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 50,
            height: 50,
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #161b4cff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <Typography variant="h6" style={{ color: '#161b4cff' }}>
          Loading...
        </Typography>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  ),
});

export default function MapPage() {
  const router = useRouter();
  const { notifications, addNotification, addProcessingNotification, completeProcessing, unreadCount } = useNotifications();

  const [open, setOpen] = useState(true);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);

  const notificationsRef = useRef(notifications);

  const [allFeeds, setAllFeeds] = useState<any[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const selectedFeedIdRef = useRef<number | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');

  const [visibleCameraIds, setVisibleCameraIds] = useState<number[]>([]);
  const [selectedFeedData, setSelectedFeedData] = useState<any>(null);
  const [selectedVideoData, setSelectedVideoData] = useState<any>(null);
  const [aggregatedVideoData, setAggregatedVideoData] = useState<any>(null);

  const [loadingFeedData, setLoadingFeedData] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [camerasRefreshTrigger, setCamerasRefreshTrigger] = useState(0);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    selectedFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId]);

  // ✅ prevents MapLibre initializing in a 0-height container
  // (SideTab overlays; map needs its own full-screen fixed wrapper)
  const mapShellSx = useMemo(
    () => ({
      position: 'fixed' as const,
      inset: 0,
      zIndex: 0,
    }),
    [],
  );

  // -------- Fetch camera details for selected feed --------
  useEffect(() => {
    const fetchCameraData = async () => {
      if (selectedFeedId === null) {
        setSelectedFeedData(null);
        return;
      }

      setLoadingFeedData(true);
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setSelectedFeedData(null);
          return;
        }

        const response = await fetch(`http://localhost:8000/brakepoint/api/cameras/`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          setSelectedFeedData(null);
          return;
        }

        const data = await response.json();
        if (data.success && data.cameras) {
          const camera = data.cameras.find((cam: any) => cam.id === selectedFeedId);
          if (camera) {
            setSelectedFeedData({
              id: camera.id,
              name: camera.name,
              lat: camera.lat,
              lng: camera.lng,
              location: camera.location,
              latestUpload: camera.latest_upload || 'No uploads yet',
              vehicles: camera.vehicles || 0,
              occurrences: camera.occurrences || 0,
              behaviors: camera.behaviors && camera.behaviors.length > 0 ? camera.behaviors : ['No Data'],
              signs: camera.signs || 0,
              signClasses: camera.sign_classes || [],
              jeepneyHotspot: camera.latest_video?.jeepney_hotspot || false,
            });
          } else {
            setSelectedFeedData(null);
          }
        }
      } catch {
        setSelectedFeedData(null);
      } finally {
        setLoadingFeedData(false);
      }
    };

    fetchCameraData();
  }, [selectedFeedId, refreshTrigger]);

  // -------- Fetch latest video for selected feed --------
  useEffect(() => {
    const fetchLatestVideo = async () => {
      if (selectedFeedId === null) {
        setSelectedVideoData(null);
        setVideoThumbnail(null);
        setVideoSrc(null);
        return;
      }

      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const response = await fetch(`http://localhost:8000/brakepoint/api/cameras/${selectedFeedId}/videos/`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.videos && data.videos.length > 0) {
          const latestVideo = data.videos[0];
          const occurrences =
            (latestVideo.speeding_count || 0) +
            (latestVideo.swerving_count || 0) +
            (latestVideo.abrupt_stopping_count || 0);

          setSelectedVideoData({
            vehicles: latestVideo.vehicles || 0,
            occurrences,
            behaviors: latestVideo.behaviors || ['No Data'],
            signs: latestVideo.signs || 0,
            signClasses: latestVideo.sign_classes || [],
            jeepneyHotspot: latestVideo.jeepney_hotspot || false,
            speeding: latestVideo.speeding_count || 0,
            swerving: latestVideo.swerving_count || 0,
            abruptStop: latestVideo.abrupt_stopping_count || 0,
            duration: latestVideo.duration_seconds || 0,
            videoName: latestVideo.filename || 'Unknown',
          });

          if (latestVideo.thumbnail) {
            setVideoThumbnail(latestVideo.thumbnail);
            setVideoSrc('placeholder');
          } else {
            setVideoThumbnail(null);
            setVideoSrc(null);
          }
        } else {
          setSelectedVideoData(null);
          setVideoThumbnail(null);
          setVideoSrc(null);
        }
      } catch {
        // ignore
      }
    };

    fetchLatestVideo();
  }, [selectedFeedId, refreshTrigger]);

  // -------- Aggregate visible cameras' video stats --------
  useEffect(() => {
    const fetchAggregatedVideos = async () => {
      if (visibleCameraIds.length === 0) {
        setAggregatedVideoData(null);
        return;
      }

      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const results = await Promise.all(
          visibleCameraIds.map((cameraId) =>
            fetch(`http://localhost:8000/brakepoint/api/cameras/${cameraId}/videos/`, {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            }).then((res) => res.json()),
          ),
        );

        const allVideos = results.flatMap((r) => (r.success && r.videos ? r.videos : []));

        if (allVideos.length === 0) {
          setAggregatedVideoData(null);
          return;
        }

        const totalVehicles = allVideos.reduce((sum, v) => sum + (v.vehicles || 0), 0);
        const totalSpeeding = allVideos.reduce((sum, v) => sum + (v.speeding_count || 0), 0);
        const totalSwerving = allVideos.reduce((sum, v) => sum + (v.swerving_count || 0), 0);
        const totalAbruptStop = allVideos.reduce((sum, v) => sum + (v.abrupt_stopping_count || 0), 0);
        const totalSigns = allVideos.reduce((sum, v) => sum + (v.signs || 0), 0);
        const totalOccurrences = totalSpeeding + totalSwerving + totalAbruptStop;

        const allBehaviors = new Set<string>();
        allVideos.forEach((v) => {
          if (v.speeding_count > 0) allBehaviors.add('Speeding');
          if (v.swerving_count > 0) allBehaviors.add('Swerving');
          if (v.abrupt_stopping_count > 0) allBehaviors.add('Abrupt Stopping');
        });

        const allSignClasses = new Set<string>();
        allVideos.forEach((v) => {
          if (Array.isArray(v.sign_classes)) v.sign_classes.forEach((sc: string) => allSignClasses.add(sc));
        });

        setAggregatedVideoData({
          totalVehicles,
          totalOccurrences,
          totalSigns,
          allBehaviors: Array.from(allBehaviors),
          allSignClasses: Array.from(allSignClasses),
          hasJeepneyHotspot: allVideos.some((v) => v.jeepney_hotspot),
          cameraCount: visibleCameraIds.length,
        });
      } catch {
        // ignore
      }
    };

    fetchAggregatedVideos();
  }, [visibleCameraIds, refreshTrigger]);

  const visibleFeeds = useMemo(() => allFeeds.filter((f) => visibleCameraIds.includes(f.id)), [allFeeds, visibleCameraIds]);

  const aggregateData = useMemo(() => {
    if (aggregatedVideoData) return aggregatedVideoData;
    if (visibleFeeds.length === 0) return null;

    return {
      totalVehicles: visibleFeeds.reduce((sum, f) => sum + f.vehicles, 0),
      totalOccurrences: visibleFeeds.reduce((sum, f) => sum + f.occurrences, 0),
      totalSigns: visibleFeeds.reduce((sum, f) => sum + (f.signs || 0), 0),
      allBehaviors: Array.from(new Set(visibleFeeds.flatMap((f) => f.behaviors))).filter((b) => b !== 'No Data'),
      allSignClasses: Array.from(new Set(visibleFeeds.flatMap((f) => f.signClasses || []))),
      hasJeepneyHotspot: visibleFeeds.some((f) => f.jeepneyHotspot),
      cameraCount: visibleFeeds.length,
    };
  }, [aggregatedVideoData, visibleFeeds]);

  const handleCamerasLoaded = useCallback((cameras: any[]) => {
    const formatted = cameras.map((cam: any) => ({
      id: cam.id,
      name: cam.name,
      lat: cam.lat,
      lng: cam.lng,
      location: cam.location,
      latestUpload: cam.latest_upload || 'No uploads yet',
      vehicles: cam.vehicles,
      occurrences: cam.occurrences,
      behaviors: cam.behaviors?.length > 0 ? cam.behaviors : ['No Data'],
      signs: cam.signs || 0,
      signClasses: cam.sign_classes || [],
      jeepneyHotspot: cam.latest_video?.jeepney_hotspot || false,
    }));

    setAllFeeds(formatted);
    if (formatted.length > 0) setSelectedFeedId(null);
  }, []);

  const handleCameraClick = useCallback((cameraId: number) => {
    setSelectedFeedId((prev) => (prev === cameraId ? null : cameraId));
    setVideoSrc(null);
    setVideoThumbnail(null);
    setSelectedVideoData(null);
    setIsEditingName(false);
  }, []);

  const handleVisibleCamerasChange = useCallback((visibleIds: number[]) => {
    setVisibleCameraIds(visibleIds);
  }, []);

  const handleNewCameraAdded = useCallback((id: number, lat: number, lng: number, cameraData: any) => {
    const newFeed = {
      id,
      name: cameraData.name || `Dynamic Camera ${id}`,
      lat,
      lng,
      location: cameraData.location || `New Location at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
      latestUpload: cameraData.latest_upload || new Date().toLocaleDateString(),
      vehicles: cameraData.vehicles || 0,
      occurrences: cameraData.occurrences || 0,
      behaviors: cameraData.behaviors || ['No Data'],
      signs: cameraData.signs || 0,
      signClasses: cameraData.sign_classes || [],
      jeepneyHotspot: cameraData.latest_video?.jeepney_hotspot || false,
    };

    setAllFeeds((prev) => [...prev, newFeed]);
    setSelectedFeedId(id);
    setIsEditingName(false);
  }, []);

  const handleVideoUploadComplete = useCallback(() => {
    setRefreshTrigger((p) => p + 1);
    setCamerasRefreshTrigger((p) => p + 1);
  }, []);

  const handleVideoFileSelect = useCallback(
    (url: string, thumbnail?: string) => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (videoThumbnail && videoThumbnail.startsWith('blob:')) URL.revokeObjectURL(videoThumbnail);

      setVideoSrc(url);
      setVideoThumbnail(thumbnail || null);
    },
    [videoSrc, videoThumbnail],
  );

  const displayData = useMemo(() => {
    if (selectedVideoData) return selectedVideoData;
    if (selectedFeedData) {
      return {
        vehicles: selectedFeedData.vehicles,
        occurrences: selectedFeedData.occurrences,
        behaviors: selectedFeedData.behaviors,
        signs: selectedFeedData.signs,
        signClasses: selectedFeedData.signClasses,
        jeepneyHotspot: selectedFeedData.jeepneyHotspot,
      };
    }
    return null;
  }, [selectedVideoData, selectedFeedData]);

  const startEdit = useCallback(() => {
    if (!selectedFeedData) return;
    setNewFeedName(selectedFeedData.name);
    setIsEditingName(true);
  }, [selectedFeedData]);

  const saveName = useCallback(() => {
    if (!selectedFeedData) return;

    const next = newFeedName.trim();
    if (next === '' || next === selectedFeedData.name) {
      setIsEditingName(false);
      return;
    }

    setAllFeeds((prev) => prev.map((f) => (f.id === selectedFeedId ? { ...f, name: next } : f)));
    setSelectedFeedData((prev: any) => (prev ? { ...prev, name: next } : null));
    setIsEditingName(false);
  }, [newFeedName, selectedFeedData, selectedFeedId]);

  return (
    <>
      {/* ✅ Full-screen map layer (prevents 0-height map container) */}
      <Box sx={mapShellSx}>
        <MapView
          mode="map"
          onCameraClick={handleCameraClick}
          onCameraAdd={handleNewCameraAdded}
          onVisibleCamerasChange={handleVisibleCamerasChange}
          onCamerasLoaded={handleCamerasLoaded}
          selectedCameraId={selectedFeedId}
          refreshTrigger={camerasRefreshTrigger}
          goTo={null}
        />
      </Box>

      {/* ✅ Side panel sits above map */}
      <SideTab side="left" open={open} onToggle={() => setOpen((v) => !v)}>
        {allFeeds.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" sx={{ mb: 2 }}>
              No Cameras Available
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Click the pencil icon in the bottom-right corner, then click on the map to place your first camera.
            </Typography>
          </Box>
        ) : selectedFeedId === null ? (
          <>
            {aggregateData ? (
              <>
                <Box className="feed-details" sx={{ mb: 2, mt: 6 }}>
                  <Typography variant="h4">Total Data</Typography>
                  <Typography variant="body1">
                    Showing data from {aggregateData.cameraCount} camera{aggregateData.cameraCount !== 1 ? 's' : ''} visible in map
                  </Typography>
                </Box>

                <Divider />

                <Box className="feed-data">
                  <Box className="feed-aggregates">
                    <List>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <DirectionsCarIcon />
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalVehicles} Vehicles`} />
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <CarCrashIcon sx={{ color: 'red' }} />
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalOccurrences} Occurrences`} />
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <DirectionsIcon />
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalSigns} Traffic Signs`} />
                      </ListItem>
                    </List>
                  </Box>

                  {aggregateData.allBehaviors.length > 0 && (
                    <Box className="feed-behavior-list">
                      <List>
                        {aggregateData.allBehaviors.map((value: string) => (
                          <ListItemText key={value} primary={value} />
                        ))}
                      </List>
                    </Box>
                  )}

                  {aggregateData.allSignClasses.length > 0 && (
                    <Box className="feed-behavior-list">
                      <List>
                        {aggregateData.allSignClasses.map((signClass: string, index: number) => (
                          <ListItemText key={`sign-${index}`} primary={signClass} />
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Table onVideoFileSelect={handleVideoFileSelect} hideUpload cameraId={null} visibleCameraIds={visibleCameraIds} />
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  p: 4,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h5" sx={{ mb: 2 }}>
                  No Cameras in View
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Pan or zoom the map to see camera data
                </Typography>
              </Box>
            )}
          </>
        ) : loadingFeedData ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4 }}>
            <Typography variant="h6">Loading camera data...</Typography>
          </Box>
        ) : selectedFeedData ? (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                bgcolor: 'black',
                width: '100%',
                height: 480,
                mb: 4,
                position: 'relative',
              }}
            >
              {videoThumbnail ? (
                <Box component="img" src={videoThumbnail} alt="Video thumbnail" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : videoSrc ? (
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Thumbnail unavailable
                </Typography>
              ) : (
                <Typography variant="h5" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Select a video to view thumbnail
                </Typography>
              )}
            </Box>

            <Box className="feed-details" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isEditingName ? (
                  <TextField
                    variant="standard"
                    value={newFeedName}
                    onChange={(e) => setNewFeedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                    }}
                    sx={{ '& .MuiInputBase-input': { p: 0, fontSize: '1.5rem', fontWeight: 700 } }}
                  />
                ) : (
                  <Typography variant="h4" onClick={startEdit} sx={{ cursor: 'pointer' }}>
                    Feed #{selectedFeedData.id} - {selectedFeedData.name}
                  </Typography>
                )}

                <IconButton onClick={isEditingName ? saveName : startEdit} size="small" sx={{ p: 0 }}>
                  {isEditingName ? <CheckIcon color="primary" /> : <EditIcon fontSize="small" />}
                </IconButton>
              </Box>

              <Typography variant="h5">{selectedFeedData.location}</Typography>
              <Typography variant="h5">
                {selectedFeedData.lng}°E, {selectedFeedData.lat}°N
              </Typography>
              <Typography variant="body1">Latest Video Uploaded: {selectedFeedData.latestUpload}</Typography>
            </Box>

            <Divider />

            <Box className="feed-data">
              {displayData && (
                <>
                  <Box className="feed-aggregates">
                    <List>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <DirectionsCarIcon />
                        </ListItemAvatar>
                        <ListItemText primary={`${displayData.vehicles} Vehicles`} />
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <CarCrashIcon sx={{ color: 'red' }} />
                        </ListItemAvatar>
                        <ListItemText primary={`${displayData.occurrences} Occurences`} />
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <DirectionsIcon />
                        </ListItemAvatar>
                        <ListItemText primary={`${displayData.signs || 0} Traffic Signs`} />
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <LocalTaxiIcon sx={{ color: displayData.jeepneyHotspot ? '#4CAF50' : '#000000ff' }} />
                        </ListItemAvatar>
                        <ListItemText primary={`Jeepney Hotspot: ${displayData.jeepneyHotspot ? 'Yes' : 'No'}`} />
                      </ListItem>
                    </List>
                  </Box>
                </>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Table onVideoFileSelect={handleVideoFileSelect} cameraId={selectedFeedId} />
          </>
        ) : null}
      </SideTab>
    </>
  );
}