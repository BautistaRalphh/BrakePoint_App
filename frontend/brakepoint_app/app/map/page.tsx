'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'; 
import dynamic from 'next/dynamic';
import { Divider, Box, Typography, List, ListItem, ListItemAvatar, ListItemText, TextField, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';

import ToggleDrawer from '@components/map/toggleDrawer';
import SideTab from '@components/map/sideTab';
import Table from '@components/ui/table'; 

import './style.css';

import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CarCrashIcon from '@mui/icons-material/CarCrash';
import DirectionsIcon from '@mui/icons-material/Directions';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';

const Map = dynamic(() => import('@/components/map/map.js'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#e8eaf6',
      zIndex: 9999
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: 50, 
          height: 50, 
          border: '4px solid #f3f3f3', 
          borderTop: '4px solid #161b4cff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }}></div>
        <Typography variant="h6" style={{ color: '#161b4cff' }}>Loading...</Typography>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
});

export default function MapPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string | null>(null); 
  const [isNavigating, setIsNavigating] = useState(false);
  
  const [allFeeds, setAllFeeds] = useState<any[]>([]);
  
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const selectedFeedIdRef = useRef<number | null>(null);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  
  const [visibleCameraIds, setVisibleCameraIds] = useState<number[]>([]);
  const [camerasLoaded, setCamerasLoaded] = useState(false);

  useEffect(() => {
    selectedFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId]);
  
  const selectedFeed = useMemo(() => 
    allFeeds.find(feed => feed.id === selectedFeedId),
    [allFeeds, selectedFeedId]
  );

  const visibleFeeds = useMemo(() => 
    allFeeds.filter(feed => visibleCameraIds.includes(feed.id)),
    [allFeeds, visibleCameraIds]
  );

  const aggregateData = useMemo(() => {
    if (visibleFeeds.length === 0) return null;
    
    return {
      totalVehicles: visibleFeeds.reduce((sum, feed) => sum + feed.vehicles, 0),
      totalOccurrences: visibleFeeds.reduce((sum, feed) => sum + feed.occurrences, 0),
      totalSigns: visibleFeeds.reduce((sum, feed) => sum + (feed.signs || 0), 0),
      allBehaviors: Array.from(new Set(visibleFeeds.flatMap(feed => feed.behaviors))).filter(b => b !== 'No Data'),
      allSignClasses: Array.from(new Set(visibleFeeds.flatMap(feed => feed.signClasses || []))),
      hasJeepneyHotspot: visibleFeeds.some(feed => feed.jeepneyHotspot),
      cameraCount: visibleFeeds.length
    };
  }, [visibleFeeds]);

  const handleCamerasLoaded = useCallback((cameras: any[]) => {
    const formattedCameras = cameras.map((cam: any) => ({
      id: cam.id,
      name: cam.name,
      lat: cam.lat,
      lng: cam.lng,
      location: cam.location,
      latestUpload: cam.latest_upload || 'No uploads yet',
      vehicles: cam.vehicles,
      occurrences: cam.occurrences,
      behaviors: cam.behaviors.length > 0 ? cam.behaviors : ['No Data'],
      signs: cam.signs || 0,
      signClasses: cam.sign_classes || [],
      jeepneyHotspot: cam.jeepney_hotspot || false
    }));
    
    setAllFeeds(formattedCameras);
    setCamerasLoaded(true);
    if (formattedCameras.length > 0) {
      setSelectedFeedId(null);
    }
  }, []);

  const handleVideoFileSelect = useCallback((url: string) => {
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(url);
  }, [videoSrc]);

  const handleCameraClick = useCallback((cameraId: number) => {
    if (selectedFeedIdRef.current === cameraId) {
      setSelectedFeedId(null);
    } else {
      setSelectedFeedId(cameraId);
    }
    setVideoSrc(null); 
    setIsEditingName(false);
  }, []);

  const handleVisibleCamerasChange = useCallback((visibleIds: number[]) => {
    setVisibleCameraIds(visibleIds);
  }, []);
  
  const handleNewCameraAdded = useCallback((id: number, lat: number, lng: number, cameraData: any) => {
    const newFeed = {
      id: id, 
      name: cameraData.name || `Dynamic Camera ${id}`, 
      lat: lat, 
      lng: lng,
      location: cameraData.location || `New Location at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`, 
      latestUpload: cameraData.latest_upload || new Date().toLocaleDateString(), 
      vehicles: cameraData.vehicles || 0, 
      occurrences: cameraData.occurrences || 0, 
      behaviors: cameraData.behaviors || ["No Data"],
      signs: cameraData.signs || 0,
      signClasses: cameraData.sign_classes || [],
      jeepneyHotspot: cameraData.jeepney_hotspot || false
    };

    setAllFeeds(prevFeeds => [...prevFeeds, newFeed]);
    setSelectedFeedId(id);
    setIsEditingName(false);
  }, []);
  
  const startEdit = useCallback(() => {
    setNewFeedName(selectedFeed.name);
    setIsEditingName(true);
  }, [selectedFeed]);

  const saveName = useCallback(() => {
    if (newFeedName.trim() === selectedFeed.name || newFeedName.trim() === '') {
      setIsEditingName(false);
      return;
    }

    setAllFeeds(prevFeeds => 
      prevFeeds.map(feed => 
        feed.id === selectedFeedId ? { ...feed, name: newFeedName.trim() } : feed
      )
    );

    setIsEditingName(false);
  }, [newFeedName, selectedFeed, selectedFeedId]);


  if (isNavigating) {
    return (
      <Box sx={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        zIndex: 9999
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ 
            width: 50, 
            height: 50, 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid #161b4cff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></Box>
          <Typography variant="h6" style={{ color: '#161b4cff' }}>Loading...</Typography>
        </Box>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </Box>
    );
  }

  return (
    <>
      <IconButton
        onClick={() => {
          setIsNavigating(true);
          router.back();
        }}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          '&:hover': {
            backgroundColor: '#f5f5f5',
          },
        }}
      >
        <ArrowBackIcon />
      </IconButton>
      <Map 
        mode = "map"
        onCameraClick={handleCameraClick} 
        onCameraAdd={handleNewCameraAdded}
        onVisibleCamerasChange={handleVisibleCamerasChange}
        goTo={undefined}
        onCamerasLoaded={handleCamerasLoaded}
        selectedCameraId={selectedFeedId}
      />
      <SideTab side="left" open={open} onToggle={() => setOpen(!open)}>
        {allFeeds.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            padding: 4,
            textAlign: 'center'
          }}>
            <Typography variant="h5" sx={{ marginBottom: 2 }}>
              No Cameras Available
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Click the pencil icon in the bottom-right corner, then click on the map to place your first camera.
            </Typography>
          </Box>
        ) : !selectedFeed ? (
          <>
            {aggregateData ? (
              <>
                <Box className="feed-details" sx={{marginBottom:2, marginTop: 6}}>
                  <Typography variant="h4">Total Data</Typography>
                  <Typography variant="body1">
                    Showing data from {aggregateData.cameraCount} camera{aggregateData.cameraCount !== 1 ? 's' : ''} visible in map
                  </Typography>
                </Box>

                <Divider/>

                <Box className="feed-data">
                  <Box className="feed-aggregates">
                    <List>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <DirectionsCarIcon/>
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalVehicles} Vehicles`}></ListItemText>
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <CarCrashIcon sx={{color:'red'}}/>
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalOccurrences} Occurrences`}></ListItemText>
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <DirectionsIcon/>
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalSigns} Traffic Signs`}></ListItemText>
                      </ListItem>
                    </List>
                  </Box>

                  {aggregateData.allSignClasses.length > 0 && (
                    <Box sx={{marginTop: 2, marginBottom: 2}}>
                      <Typography variant="h6" sx={{marginBottom: 1}}>Sign Classes Detected:</Typography>
                      <Box className="feed-behavior-list">
                        <List>
                          {aggregateData.allSignClasses.map((signClass: string, index: number) => (
                            <ListItemText key={index} primary={`• ${signClass}`}></ListItemText>
                          ))}
                        </List>
                      </Box>
                    </Box>
                  )}

                  {aggregateData.allBehaviors.length > 0 && (
                    <Box className="feed-behavior-list">
                      <List>
                        {aggregateData.allBehaviors.map((value: string) => (
                          <ListItemText key={value} primary={value}></ListItemText>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
                
                <Divider sx={{marginBottom:2}} />

                <Table onVideoFileSelect={handleVideoFileSelect} hideUpload={true} /> 
              </>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                padding: 4,
                textAlign: 'center'
              }}>
                <Typography variant="h5" sx={{ marginBottom: 2 }}>
                  No Cameras in View
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Pan or zoom the map to see camera data
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <>
        <Box 
          sx={{
            display:'flex',
            alignItems: 'center', 
            justifyContent: 'center', 
            color:'white', 
            bgcolor: 'black', 
            width: '100%', 
            height: 480, 
            marginBottom: 4
          }}
        >
          {videoSrc ? (
            <video 
              controls 
              width="100%" 
              height="100%" 
              src={videoSrc} 
              style={{ objectFit: 'cover' }} 
            />
          ) : (
            <Typography variant="h5">Video Placeholder</Typography>
          )}
        </Box>
        
        {selectedFeed && (
          <>
            <Box className="feed-details" sx={{marginBottom:2}}>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isEditingName ? (
                  <TextField
                    variant="standard"
                    value={newFeedName}
                    onChange={(e) => setNewFeedName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
                    sx={{ '& .MuiInputBase-input': { padding: 0, fontSize: '1.5rem', fontWeight: 700 } }}
                  />
                ) : (
                  <Typography variant="h4" onClick={startEdit} sx={{ cursor: 'pointer' }}> 
                    Feed #{selectedFeed.id} - {selectedFeed.name}
                  </Typography>
                )}
                
                <IconButton 
                  onClick={isEditingName ? saveName : startEdit} 
                  size="small"
                  sx={{ p: 0 }}
                >
                  {isEditingName ? <CheckIcon color="primary" /> : <EditIcon fontSize="small" />}
                </IconButton>
              </Box>

              <Typography variant="h5"> {selectedFeed.location}  </Typography>
              <Typography variant="h5"> {selectedFeed.lng}°E, {selectedFeed.lat}°N  </Typography>
              <Typography variant="body1" > Latest Video Uploaded: {selectedFeed.latestUpload}  </Typography>
            </Box>

            <Divider/>

            <Box className="feed-data">
              <Box className="feed-aggregates" >
                <List>
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <DirectionsCarIcon/>
                    </ListItemAvatar>
                    <ListItemText primary={`${selectedFeed.vehicles} Vehicles`}></ListItemText>
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <CarCrashIcon sx={{color:'red'}}/>
                    </ListItemAvatar>
                    <ListItemText primary={`${selectedFeed.occurrences} Occurences`}></ListItemText>
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <DirectionsIcon/>
                    </ListItemAvatar>
                    <ListItemText primary={`${selectedFeed.signs || 0} Traffic Signs`}></ListItemText>
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <LocalTaxiIcon sx={{color: selectedFeed.jeepneyHotspot ? '#4CAF50' : '#000000ff'}}/>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={`Jeepney Hotspot: ${selectedFeed.jeepneyHotspot ? 'Yes' : 'No'}`}
                      sx={{color: selectedFeed.jeepneyHotspot ? '#4CAF50' : 'text.secondary'}}
                    ></ListItemText>
                  </ListItem>
                </List>
              </Box>

              {selectedFeed.signClasses && selectedFeed.signClasses.length > 0 && (
                <Box sx={{marginTop: 2, marginBottom: 2}}>
                  <Typography variant="h6" sx={{marginBottom: 1}}>Sign Classes Detected:</Typography>
                  <Box className="feed-behavior-list">
                    <List>
                      {selectedFeed.signClasses.map((signClass: string, index: number) => (
                        <ListItemText key={index} primary={`• ${signClass}`}></ListItemText>
                      ))}
                    </List>
                  </Box>
                </Box>
              )}

              <Box className="feed-behavior-list">
                <List>
                  {selectedFeed.behaviors.map((value: string) => (
                    <ListItemText key={value} primary={value}></ListItemText>
                  ))}
                </List>
              </Box>
            </Box>
            
            <Divider sx={{marginBottom:2}} />

            <Table onVideoFileSelect={handleVideoFileSelect} /> 
          </>
        )}
        </>
        )}
      </SideTab>
    </>
  )
}