"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Container,
  Typography,
  TextField,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Snackbar,
  Alert,
  LinearProgress,
} from "@mui/material";
import { useRouter } from "next/navigation";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useNotifications } from "@/contexts/NotificationContext";

import MenuBar from "@/components/dashboard/menuBar";

import { getSavedLocations } from "@/lib/api/api";

type Loc = { id: number; name: string; lat: number; lng: number; zoom?: number; bearing?: number; pitch?: number };

export default function DashboardPage() {
  const { notifications, markAsRead, clearAll, unreadCount } = useNotifications();
  const [locations, setLocations] = useState<Loc[]>([
    { id: 1, name: "Manila City Hall", lat: 14.5995, lng: 120.9842, zoom: 15, bearing: 0, pitch: 45 },
    { id: 2, name: "Quezon City Circle", lat: 14.6542, lng: 121.0493, zoom: 16, bearing: 90, pitch: 60 },
    { id: 3, name: "Makati Business District", lat: 14.5547, lng: 121.0244, zoom: 17, bearing: 180, pitch: 50 },
    { id: 4, name: "BGC The Fort", lat: 14.5507, lng: 121.047, zoom: 16, bearing: 45, pitch: 55 },
    { id: 5, name: "EDSA Ortigas", lat: 14.5816, lng: 121.0577, zoom: 15, bearing: 270, pitch: 40 },
  ]);
  const [q, setQ] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedLoc, setSelectedLoc] = useState<Loc | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");

  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, loc: Loc) => {
    setAnchorEl(event.currentTarget);
    setSelectedLoc(loc);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedLoc(null);
  };

  const handleEdit = () => {
    if (selectedLoc) {
      setEditName(selectedLoc.name);
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleEditSave = () => {
    if (selectedLoc && editName.trim() !== "") {
      setLocations((prev) => prev.map((l) => (l.id === selectedLoc.id ? { ...l, name: editName.trim() } : l)));
      setEditDialogOpen(false);
      setEditName("");
    }
  };

  const handleDelete = () => {
    if (selectedLoc) {
      setDeleteDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDeleteConfirm = () => {
    if (selectedLoc) {
      setLocations((prev) => prev.filter((l) => l.id !== selectedLoc.id));
      setDeleteDialogOpen(false);
    }
  };

  const handleNavigateToMap = (url: string) => {
    setIsNavigating(true);
    router.push(url);
  };

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

  useEffect(() => {
    getSavedLocations()
      .then((data) => {
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations);
        }
      })
      .catch(() => {});

    router.prefetch("/map");
  }, []);

  const filtered = locations.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));

  if (isNavigating) {
    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e8eaf6",
          zIndex: 9999,
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <Box
            sx={{
              width: 50,
              height: 50,
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #161b4cff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></Box>
          <Typography variant="h6" style={{ color: "#161b4cff" }}>
            Loading...
          </Typography>
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
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <MenuBar></MenuBar>

      <IconButton
        onClick={handleNotificationClick}
        sx={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          backgroundColor: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          "&:hover": {
            backgroundColor: "#f5f5f5",
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
            mt: 1,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e0e0e0" }}>
          <Typography variant="h6">Notifications</Typography>
          {notifications.length > 0 && (
            <Typography variant="caption" sx={{ color: "primary.main", cursor: "pointer" }} onClick={handleClearAll}>
              Clear All
            </Typography>
          )}
        </Box>

        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </MenuItem>
        ) : (
          notifications.map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => !notification.processing && handleNotificationRead(notification.id)}
              sx={{
                backgroundColor: notification.read ? "transparent" : "#f5f5f5",
                borderLeft: notification.read ? "none" : "4px solid #161b4cff",
                "&:hover": {
                  backgroundColor: notification.read ? "#fafafa" : "#e8e8e8",
                },
                cursor: notification.processing ? "default" : "pointer",
              }}
            >
              <Box sx={{ width: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  {notification.processing ? (
                    <HourglassEmptyIcon
                      sx={{
                        width: 20,
                        height: 20,
                        color: "#FF9800",
                        animation: "spin 2s linear infinite",
                        "@keyframes spin": {
                          "0%": { transform: "rotate(0deg)" },
                          "100%": { transform: "rotate(360deg)" },
                        },
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: notification.success ? "#4CAF50" : "#f44336",
                      }}
                    />
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
                        {notification.data?.yolo_results && <> - {notification.data.yolo_results.total_unique || 0} vehicles</>}
                        {notification.data?.sign_results && <>, {notification.data.sign_results.unique_signs || 0} signs</>}
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
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info" sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

        

      <Container sx={{ py: 4 }}>
        <Typography variant="h5" fontWeight={"bold"} gutterBottom>
          Dashboard
        </Typography>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <TextField placeholder="Search locations..." value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
          <Button onClick={() => handleNavigateToMap("/map")} variant="contained" sx={{ backgroundColor: "#161b4cff" }}>
            New
          </Button>
        </div>

        {filtered.length === 0 ? (
          <Typography color="text.secondary">No saved locations found.</Typography>
        ) : (
          <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={2}>
            {filtered.map((loc) => (
              <Card
                key={loc.id}
                sx={{
                  border: "1px solid #ddd",
                  borderRadius: 2,
                  p: 1,
                  boxShadow: 1,
                  backgroundColor: "white",
                  position: "relative",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                  }}
                >
                  <IconButton aria-label="more-options" onClick={(e) => handleMenuOpen(e, loc)}>
                    <MoreVertIcon />
                  </IconButton>
                </Box>

                <CardContent>
                  <Typography variant="h6" fontWeight={"bold"}>
                    {loc.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Latitude: {loc.lat}, Longitude: {loc.lng}
                  </Typography>
                  <Typography variant="body2">Zoom: {loc.zoom}</Typography>
                  <Typography variant="body2">Bearing: {loc.bearing}°</Typography>
                  <Typography variant="body2">Pitch: {loc.pitch}°</Typography>
                </CardContent>

                <CardActions>
                  <Button
                    onClick={() => handleNavigateToMap(`/map?focus=${encodeURIComponent(JSON.stringify(loc))}`)}
                    variant="contained"
                    sx={{ backgroundColor: "#161b4cff" }}
                  >
                    Monitor
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={handleEdit}>Edit Name</MenuItem>
          <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
            Delete
          </MenuItem>
        </Menu>

        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Location Name</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Location Name"
              type="text"
              fullWidth
              variant="outlined"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleEditSave();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} variant="contained" sx={{ backgroundColor: "#161b4cff" }}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Location</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete "{selectedLoc?.name}"? This action cannot be undone.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} variant="contained" color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>

      <style jsx>{`
        .processing-dots {
          display: inline-block;
          animation: processingDots 1.5s infinite;
        }

        @keyframes processingDots {
          0%,
          20% {
            content: ".";
          }
          40% {
            content: "..";
          }
          60%,
          100% {
            content: "...";
          }
        }
      `}</style>
    </Box>
  );
}
