"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import "./style.css";
import { Autocomplete, TextField, IconButton } from "@mui/material";
import SearchLocation, { LocationSuggestion } from "@components/ui/searchsuggestions";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter } from "next/navigation";

const Map = dynamic(() => import("@/components/map/map.js"), { ssr: false });

export default function Explore() {
  const [target, setTarget] = React.useState<[number, number] | null>(null);

  const handleSelect = (s: LocationSuggestion) => {
    setTarget([s.center.lon, s.center.lat]); // [lng, lat]
  };

  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  if (isNavigating) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
          zIndex: 9999,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 50,
              height: 50,
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #161b4cff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></div>
          <div style={{ color: "#161b4cff", fontSize: "1.25rem", fontWeight: 500 }}>Loading...</div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>  
      <div className="navigation">
        <IconButton
          className="back-button"
          onClick={() => {
            setIsNavigating(true);
            router.back();
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <SearchLocation onSelect={handleSelect} />
      </div>

      <Map
        mode="explore"
        onCameraClick={null}
        goTo={target ?? undefined}
        onCameraAdd={null}
        onVisibleCamerasChange={0}
        onCamerasLoaded={null}
        selectedCameraId={null}
      />
    </>
  );
}
