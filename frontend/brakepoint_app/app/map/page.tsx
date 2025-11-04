'use client';

import React, { useState, useEffect, useRef } from 'react'; 
import dynamic from 'next/dynamic';
import { Divider, Box, Typography, List, ListItem, ListItemAvatar, ListItemText, TextField, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';

import ToggleDrawer from '@components/map/toggleDrawer';
import SideTab from '@components/map/sideTab';
import Table from '@components/ui/table'; 

import './style.css';

import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CarCrashIcon from '@mui/icons-material/CarCrash';

const Map = dynamic(() => import('@/components/map/map.js'), { ssr: false });

export default function MapPage() {
  const [open, setOpen] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string | null>(null); 
  
  const [allFeeds, setAllFeeds] = useState<any[]>([]);
  
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const selectedFeedIdRef = useRef<number | null>(null);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  
  const [visibleCameraIds, setVisibleCameraIds] = useState<number[]>([]);

  useEffect(() => {
    selectedFeedIdRef.current = selectedFeedId;
    console.log('selectedFeedId changed to:', selectedFeedId);
  }, [selectedFeedId]);
  
  const selectedFeed = allFeeds.find(feed => feed.id === selectedFeedId);

  const visibleFeeds = allFeeds.filter(feed => visibleCameraIds.includes(feed.id));
  const aggregateData = visibleFeeds.length > 0 ? {
    totalVehicles: visibleFeeds.reduce((sum, feed) => sum + feed.vehicles, 0),
    totalOccurrences: visibleFeeds.reduce((sum, feed) => sum + feed.occurrences, 0),
    allBehaviors: Array.from(new Set(visibleFeeds.flatMap(feed => feed.behaviors))).filter(b => b !== 'No Data'),
    cameraCount: visibleFeeds.length
  } : null;

  useEffect(() => {
    const loadCameras = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No authentication token found');
        return;
      }

      try {
        const response = await fetch('http://127.0.0.1:8000/brakepoint/api/cameras/', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.cameras) {
            const formattedCameras = data.cameras.map((cam: any) => ({
              id: cam.id,
              name: cam.name,
              lat: cam.lat,
              lng: cam.lng,
              location: cam.location,
              latestUpload: cam.latest_upload || 'No uploads yet',
              vehicles: cam.vehicles,
              occurrences: cam.occurrences,
              behaviors: cam.behaviors.length > 0 ? cam.behaviors : ['No Data']
            }));
            
            setAllFeeds(formattedCameras);
            if (formattedCameras.length > 0) {
              setSelectedFeedId(null);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load cameras:', error);
      }
    };

    loadCameras();
  }, []);

  const handleVideoFileSelect = (url: string) => {
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(url);
  };

  const handleCameraClick = (cameraId: number) => {
    console.log('Camera clicked:', cameraId);
    console.log('Currently selected (from ref):', selectedFeedIdRef.current);
    
    if (selectedFeedIdRef.current === cameraId) {
      console.log('Deselecting camera');
      setSelectedFeedId(null);
    } else {
      console.log('Selecting camera');
      setSelectedFeedId(cameraId);
    }
    setVideoSrc(null); 
    setIsEditingName(false);
  };

  const handleVisibleCamerasChange = (visibleIds: number[]) => {
    setVisibleCameraIds(visibleIds);
  };
  
  const handleNewCameraAdded = (id: number, lat: number, lng: number, cameraData: any) => {
    const newFeed = {
      id: id, 
      name: cameraData.name || `Dynamic Camera ${id}`, 
      lat: lat, 
      lng: lng,
      location: cameraData.location || `New Location at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`, 
      latestUpload: cameraData.latest_upload || new Date().toLocaleDateString(), 
      vehicles: cameraData.vehicles || 0, 
      occurrences: cameraData.occurrences || 0, 
      behaviors: cameraData.behaviors || ["No Data"] 
    };

    setAllFeeds(prevFeeds => [...prevFeeds, newFeed]);
    setSelectedFeedId(id);
    setIsEditingName(false);
  };
  
  const startEdit = () => {
    setNewFeedName(selectedFeed.name);
    setIsEditingName(true);
  };

  const saveName = () => {
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
  };


  return (
    <>
      <Map 
        cameraLocations={allFeeds} 
        onCameraClick={handleCameraClick} 
        onCameraAdd={handleNewCameraAdded}
        onVisibleCamerasChange={handleVisibleCamerasChange}
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
              Click the edit button on the map and click on the map to add your first camera
            </Typography>
          </Box>
        ) : !selectedFeed ? (
          <>
            {aggregateData ? (
              <>
                <Box className="feed-details" sx={{marginBottom:2}}>
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
                    </List>
                  </Box>

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

                <Table onVideoFileSelect={handleVideoFileSelect} /> 
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
                </List>
              </Box>

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