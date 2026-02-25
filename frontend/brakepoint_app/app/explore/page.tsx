"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import "./style.css";
import { IconButton,Box} from "@mui/material";
import { useRouter } from "next/navigation";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Map = dynamic(() => import("@components/map/map"), { ssr: false });

export default function Explore() {
  const router = useRouter();

  return (
    <Box>
      <IconButton
        onClick={() => router.push("/dashboard")}
        sx={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1001,
          bgcolor: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
          "&:hover": { bgcolor: "#f5f5f5" },
        }}
      >
        <ArrowBackIcon />
      </IconButton>

      <Map mode="explore" refreshTrigger={0} />
    </Box>
  );
}
