"use client";

import { Box, Typography, Button } from "@mui/material";
import { useRouter } from "next/navigation";

import MapIcon from "@mui/icons-material/Map";
import DashboardIcon from "@mui/icons-material/Dashboard";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";

import styles from "./menuBar.module.css";

interface MenuBarProps {
  activeView?: "analytics" | "edit";
  onViewChange?: (view: "analytics" | "edit") => void;
}

export default function MenuBar({ activeView = "analytics", onViewChange }: MenuBarProps) {
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
        <Button
          className={styles.menuButton}
          startIcon={<DashboardIcon />}
          onClick={() => onViewChange?.("analytics")}
          sx={activeView === "analytics" ? { bgcolor: "rgba(255,255,255,0.1) !important" } : {}}
        >
          Analytics
        </Button>

        <Button
          className={styles.menuButton}
          startIcon={<EditIcon />}
          onClick={() => onViewChange?.("edit")}
          sx={activeView === "edit" ? { bgcolor: "rgba(255,255,255,0.1) !important" } : {}}
        >
          Edit
        </Button>

        <Button className={styles.menuButton} startIcon={<MapIcon />} onClick={() => router.push('/mapper')}>
          Map
        </Button>

        <Button className={styles.menuButton} startIcon={<LogoutIcon />} onClick={handleSignOut}>
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}
