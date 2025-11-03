'use client';

import React, { useState } from 'react'; 
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

const INITIAL_FEEDS = [
  { 
    id: 1, 
    name: "Churchill Street Camera", 
    lat: 14.19, 
    lng: 127.98,
    location: "Churchill Street, Taguig, Philippines", 
    latestUpload: "19 October, 2025", 
    vehicles: 96, 
    occurrences: 24, 
    behaviors: ["Speeding", "Swerving", "Abrupt Stopping"] 
  },
  { 
    id: 2, 
    name: "Market Avenue Camera", 
    lat: 14.22, 
    lng: 127.95,
    location: "Market Avenue, Pasig, Philippines", 
    latestUpload: "21 October, 2025", 
    vehicles: 150, 
    occurrences: 10, 
    behaviors: ["Tailgating", "Lane Drifting", "Aggressive Merging"] 
  }
];

export default function MapPage() {
  const [open, setOpen] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string | null>(null); 
  
  const [allFeeds, setAllFeeds] = useState(INITIAL_FEEDS);
  
  const [selectedFeedId, setSelectedFeedId] = useState(INITIAL_FEEDS[0].id);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  
  const selectedFeed = allFeeds.find(feed => feed.id === selectedFeedId) || INITIAL_FEEDS[0];

  const handleVideoFileSelect = (url: string) => {
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(url);
  };

  const handleCameraClick = (cameraId: number) => {
    setSelectedFeedId(cameraId);
    setVideoSrc(null); 
    setIsEditingName(false);
  };
  
  const handleNewCameraAdded = (id: number, lat: number, lng: number) => {
    const newFeed = {
      id: id, 
      name: `Dynamic Camera ${id}`, 
      lat: lat, 
      lng: lng,
      location: `New Location at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`, 
      latestUpload: new Date().toLocaleDateString(), 
      vehicles: 0, 
      occurrences: 0, 
      behaviors: ["No Data"] 
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
      />
      <SideTab side="left" open={open} onToggle={() => setOpen(!open)}>
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
              {selectedFeed.behaviors.map((value) => (
                <ListItemText key={value} primary={value}></ListItemText>
              ))}
            </List>
          </Box>
        </Box>
        
        <Divider sx={{marginBottom:2}} />

        <Table onVideoFileSelect={handleVideoFileSelect} /> 

      </SideTab>
    </>
  )
}