'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Divider, Box, Typography, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import ToggleDrawer from '@components/map/toggleDrawer';
import SideTab from '@components/map/sideTab';
import Table from '@components/ui/table';

import './style.css';

import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CarCrashIcon from '@mui/icons-material/CarCrash';

const Map = dynamic(() => import('@/components/map/map.js'), { ssr: false });

export default function MapPage() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Map/>
      <SideTab side="left" open={open} onToggle={() => setOpen(!open)}>
        <Box sx={{display:'flex',alignItems: 'center', justifyContent: 'center', color:'white', bgcolor: 'black', width: '100%', height: 480, marginBottom: 4}}> Video Placeholder </Box>
        <Box className="feed-details" sx={{marginBottom:2}}>
          <Typography variant="h4"> Feed #1 </Typography>
          <Typography variant="h5"> Churchill Street, Taguig, Philippines  </Typography>
          <Typography variant="h5"> 127.98°E, 14.19°N  </Typography>
          <Typography variant="body1" > Latest Video Uploaded: 19 October, 2025  </Typography>
        </Box>

        <Divider/>

        <Box className="feed-data">
          <Box className="feed-aggregates" >
            <List>
              <ListItem disableGutters>
                <ListItemAvatar>
                  <DirectionsCarIcon/>
                </ListItemAvatar>

                <ListItemText primary={`96 Vehicles`}></ListItemText>
              </ListItem>
              <ListItem disableGutters>
                <ListItemAvatar>
                  <CarCrashIcon sx={{color:'red'}}/>
                </ListItemAvatar>

                <ListItemText primary={`24 Occurences`}></ListItemText>
              </ListItem>
            </List>
          </Box>

          <Box className="feed-behavior-list">
            <List>
              {["Speeding", "Swerving", "Abrupt Stopping"].map((value) => (
                <ListItemText key={value} primary={value}></ListItemText>
              ))}
            </List>
          </Box>
        </Box>
        
        <Divider sx={{marginBottom:2}} />

        <Table/>


      </SideTab>


      
    </>
    
  )

}