"use client";

import { useState } from "react";
import { Box } from "@mui/material";

import MenuBar from "@/components/dashboard/menuBar";
import Analytics from "@/components/dashboard/analytics";
import EditPanel from "@/components/dashboard/editPanel";

import "./style.css";

export default function DashboardPage() {
  const [activeView, setActiveView] = useState<"analytics" | "edit">("analytics");

  return (
    <Box className="dashboard-container">
      <MenuBar activeView={activeView} onViewChange={setActiveView} />
      {activeView === "analytics" ? <Analytics /> : <EditPanel />}
    </Box>
  );
}
