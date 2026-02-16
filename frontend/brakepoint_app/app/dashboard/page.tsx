"use client";

import { Box, Typography } from "@mui/material";

import Notification from "@components/notifications";
import MenuBar from "@/components/dashboard/menuBar";
import Analytics from "@/components/dashboard/analytics";

import "./style.css";

export default function DashboardPage() {

  return (
    <Box className="dashboard-container">
      <Notification />
      <MenuBar />
      <Analytics />
    </Box>
  );
}
