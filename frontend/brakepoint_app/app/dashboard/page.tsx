"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
 
  Typography,
  
} from "@mui/material";
import { useRouter } from "next/navigation";


import Notification from "@components/notifications"
import MenuBar from "@/components/dashboard/menuBar";
import Analytics from "@/components/dashboard/analytics";

import "./style.css"

import { getSavedLocations } from "@/lib/api/api";

type Loc = { id: number; name: string; lat: number; lng: number; zoom?: number; bearing?: number; pitch?: number };

export default function DashboardPage() {
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

 

  // useEffect(() => {
  //   getSavedLocations()
  //     .then((data) => {
  //       if (data.locations && data.locations.length > 0) {
  //         setLocations(data.locations);
  //       }
  //     })
  //     .catch(() => {});

  //   router.prefetch("/map");
  // }, []);

  const filtered = locations.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));

  // if (isNavigating) {
  //   return (
  //     <Box
  //       sx={{
  //         position: "fixed",
  //         top: 0,
  //         left: 0,
  //         right: 0,
  //         bottom: 0,
  //         display: "flex",
  //         alignItems: "center",
  //         justifyContent: "center",
  //         backgroundColor: "#e8eaf6",
  //         zIndex: 9999,
  //       }}
  //     >
  //       <Box sx={{ textAlign: "center" }}>
  //         <Box
  //           sx={{
  //             width: 50,
  //             height: 50,
  //             border: "4px solid #f3f3f3",
  //             borderTop: "4px solid #161b4cff",
  //             borderRadius: "50%",
  //             animation: "spin 1s linear infinite",
  //             margin: "0 auto 16px",
  //           }}
  //         ></Box>
  //         <Typography variant="h6" style={{ color: "#161b4cff" }}>
  //           Loading...
  //         </Typography>
  //       </Box>
  //       <style>{`
  //         @keyframes spin {
  //           0% { transform: rotate(0deg); }
  //           100% { transform: rotate(360deg); }
  //         }
  //       `}</style>
  //     </Box>
  //   );
  // }

  return (
    <Box className = "dashboard-container">
      <Notification/>
      <MenuBar/>
      <Analytics/>
    </Box>
  );
}
