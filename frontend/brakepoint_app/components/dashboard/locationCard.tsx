"use client";

import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import CarCrashOutlinedIcon from "@mui/icons-material/CarCrashOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import type { Loc } from "@/lib/api/locations";
import "./locationCard.css";

type LCProps = {
  image?: React.ReactNode;
  loc: Loc;
  onClick?: () => void;
};

export default function LocationCard({ image, loc, onClick }: LCProps) {
  return (
    <Box className="lc-container">
      {/* <Box className="lc-image"></Box> */}

      <Box className="lc-header">
        <Typography variant="h6" fontWeight={700}>{loc.name}</Typography>
      </Box>

      <Box className="lc-content">
        <Box className="lc-subtitle">
          <Typography variant="subtitle1">{loc.lng ?? "—"}</Typography>
          <Typography variant="subtitle1">{loc.lat ?? "—"}</Typography>
        </Box>
        <Box className="lc-statistics">
          <List>
            <ListItem disablePadding>
              <ListItemIcon>
                <DirectionsCarFilledOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="500"></ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon>
                <CarCrashOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="500"></ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon>
                <SpeedOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="500"></ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon>
                <SpeedOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="500"></ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemIcon>
                <SpeedOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="500"></ListItemText>
            </ListItem>
          </List>
        </Box>
      </Box>
    </Box>
  );
}
