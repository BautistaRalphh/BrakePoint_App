"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import "./style.css";
import { Autocomplete, TextField, IconButton, Badge, Menu, MenuItem, Box, Typography, Snackbar, Alert, LinearProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";

const Map = dynamic(() => import("@/components/map/map.js"), { ssr: false });

export default function Explore() {
  const router = useRouter();
  const { notifications, markAsRead, clearAll, unreadCount } = useNotifications();
  const [isNavigating, setIsNavigating] = useState(false);

  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleNotificationRead = (id: number) => {
    markAsRead(id);
  };

  const handleClearAll = () => {
    clearAll();
    setNotificationAnchor(null);
  };

  if (isNavigating) {
    return (
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
          <div style={{ color: '#161b4cff', fontSize: '1.25rem', fontWeight: 500 }}>Loading...</div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
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
          zIndex: 1001,
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          '&:hover': {
            backgroundColor: '#f5f5f5',
          },
        }}
      >
        <ArrowBackIcon />
      </IconButton>

      <IconButton
        onClick={handleNotificationClick}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1001,
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          '&:hover': {
            backgroundColor: '#f5f5f5',
          },
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleNotificationClose}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: 350,
            mt: 1
          }
        }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h6">Notifications</Typography>
          {notifications.length > 0 && (
            <Typography 
              variant="caption" 
              sx={{ color: 'primary.main', cursor: 'pointer' }}
              onClick={handleClearAll}
            >
              Clear All
            </Typography>
          )}
        </Box>
        
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">No notifications</Typography>
          </MenuItem>
        ) : (
          notifications.map((notification) => (
            <MenuItem 
              key={notification.id}
              onClick={() => !notification.processing && handleNotificationRead(notification.id)}
              sx={{
                backgroundColor: notification.read ? 'transparent' : '#f5f5f5',
                borderLeft: notification.read ? 'none' : '4px solid #161b4cff',
                '&:hover': {
                  backgroundColor: notification.read ? '#fafafa' : '#e8e8e8',
                },
                cursor: notification.processing ? 'default' : 'pointer'
              }}
            >
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {notification.processing ? (
                    <HourglassEmptyIcon 
                      sx={{ 
                        width: 20, 
                        height: 20, 
                        color: '#FF9800',
                        animation: 'spin 2s linear infinite',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }} 
                    />
                  ) : (
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      backgroundColor: notification.success ? '#4CAF50' : '#f44336' 
                    }} />
                  )}
                  <Typography variant="subtitle2" sx={{ fontWeight: notification.read ? 400 : 600 }}>
                    {notification.videoName}
                  </Typography>
                </Box>
                
                {notification.processing ? (
                  <Typography variant="caption" color="text.secondary">
                    Processing video<span className="processing-dots">...</span>
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {notification.success ? (
                      <>
                        ✓ Processing completed successfully
                        {notification.data?.yolo_results && (
                          <> - {notification.data.yolo_results.total_unique || 0} vehicles</>
                        )}
                        {notification.data?.sign_results && (
                          <>, {notification.data.sign_results.unique_signs || 0} signs</>
                        )}
                      </>
                    ) : (
                      <>✗ Processing failed</>
                    )}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Autocomplete
          freeSolo
          className="location-search"
          disableClearable
          options={["hi", "hello", "what's up?"]}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search for the area you want to monitor."
              sx={{border: "none"}}
              slotProps={{
                input: {
                  ...params.InputProps,
                  type: "search",
                },
              }}
            />
          )}
        />
      <Map mode="explore" onCameraClick={null} onCameraAdd={null} onVisibleCamerasChange={0} onCamerasLoaded={null} selectedCameraId={null} refreshTrigger={null} />
      
      <style jsx>{`
        .processing-dots {
          display: inline-block;
          animation: processingDots 1.5s infinite;
        }
        
        @keyframes processingDots {
          0%, 20% {
            content: '.';
          }
          40% {
            content: '..';
          }
          60%, 100% {
            content: '...';
          }
        }
      `}</style>
    </>
  );
}
