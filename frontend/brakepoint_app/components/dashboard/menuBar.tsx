"use client";

import { Box, Typography, Button } from "@mui/material";

import MapIcon from "@mui/icons-material/Map";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PlaceIcon from "@mui/icons-material/Place";
import LogoutIcon from "@mui/icons-material/Logout";

import styles from "./menuBar.module.css";

export default function MenuBar() {
  return (
    <Box className={styles.menuContainer}>
      <Typography variant="h3" className={styles.brakePoint}>BrakePoint</Typography>

      <Box className={styles.buttonContainer}>
        <Button className={styles.menuButton} startIcon={<DashboardIcon />}>
          Analytics
          
        </Button>

        <Button className={styles.menuButton} startIcon={<PlaceIcon />}>
         Locations
        </Button>

        <Button className={styles.menuButton} startIcon={<MapIcon />}>
          Map Overview
        </Button>

        <Button className={styles.menuButton} startIcon={<LogoutIcon />}>
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}
