"use client";

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Chip } from "@mui/material";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import SwapCallsIcon from "@mui/icons-material/SwapCalls";
import PanToolOutlinedIcon from "@mui/icons-material/PanToolOutlined";
import type { SubAreaSummary } from "./analytics";
import "./locationCard.css";

type LCProps = {
  camera: SubAreaSummary;
  onClick?: () => void;
};

export default function LocationCard({ camera, onClick }: LCProps) {
  return (
    <Box className="lc-container" onClick={onClick} sx={{ cursor: onClick ? "pointer" : "default" }}>
      {/* Thumbnail */}
      {camera.thumbnail ? (
        <Box
          component="img"
          src={camera.thumbnail.startsWith("data:") ? camera.thumbnail : `data:image/jpeg;base64,${camera.thumbnail}`}
          alt={camera.name}
          sx={{
            width: "100%",
            height: 140,
            objectFit: "cover",
            borderRadius: "12px",
            mb: 1,
          }}
        />
      ) : (
        <Box
          sx={{
            width: "100%",
            height: 140,
            borderRadius: "12px",
            mb: 1,
            bgcolor: "#eef0ef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">No thumbnail</Typography>
        </Box>
      )}

      <Box className="lc-header">
        <Typography variant="h6" fontWeight={700}>{camera.name}</Typography>
      </Box>

      <Box className="lc-content">
        <Box className="lc-subtitle">
          <Typography variant="body2" color="text.secondary">
            {camera.location || `${camera.lat.toFixed(4)}°, ${camera.lng.toFixed(4)}°`}
          </Typography>
        </Box>
        <Box className="lc-statistics">
          <List dense>
            <ListItem disablePadding>
              <ListItemIcon sx={{ minWidth: 36, color: "#1d1f3f" }}>
                <DirectionsCarFilledOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${camera.vehicles.toLocaleString()} vehicles`}
              />
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon sx={{ minWidth: 36, color: "#f57c00" }}>
                <ReportProblemOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${camera.adb.toLocaleString()} ADB total`}
              />
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon sx={{ minWidth: 36, color: "#5c6bc0" }}>
                <SpeedOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${camera.speeding.toLocaleString()} speeding`}
              />
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon sx={{ minWidth: 36, color: "#ef5350" }}>
                <SwapCallsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${camera.swerving.toLocaleString()} swerving`}
              />
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon sx={{ minWidth: 36, color: "#ffa726" }}>
                <PanToolOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={`${camera.abrupt_stopping.toLocaleString()} abrupt stops`}
              />
            </ListItem>
          </List>
        </Box>

        {camera.tags && camera.tags.length > 0 && (
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {camera.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  fontSize: "0.68rem",
                  height: 20,
                  bgcolor: "#1d1f3f",
                  color: "#fff",
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
