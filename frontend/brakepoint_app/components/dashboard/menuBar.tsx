"use client";

import { Box, Typography, Button } from "@mui/material";
import { useRouter } from "next/navigation";

import MapIcon from "@mui/icons-material/Map";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PlaceIcon from "@mui/icons-material/Place";
import LogoutIcon from "@mui/icons-material/Logout";

import styles from "./menuBar.module.css";

export default function MenuBar() {
  const router = useRouter();

  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    router.push("/logIn");
  };

  return (
    <Box className={styles.menuContainer}>
      <Typography variant="h3" className={styles.brakePoint}>BrakePoint</Typography>

      <Box className={styles.buttonContainer}>
        <Button className={styles.menuButton} startIcon={<DashboardIcon />}>
          Analytics
          
        </Button>

        <Button className={styles.menuButton} startIcon={<LogoutIcon />} onClick={handleSignOut}>
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}
