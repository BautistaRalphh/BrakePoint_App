"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import "./style.css";
import { Autocomplete, TextField } from "@mui/material";

const Map = dynamic(() => import("@/components/map/map.js"), { ssr: false });

export default function Explore() {
  return (
    <>
      <Autocomplete
          freeSolo
          className="location-search"
          disableClearable
          options={["hi", "hello", "what's up?"]}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search for the area you want to monitor."
              sx={{border: "none"}}
              slotProps={{
                input: {
                  ...params.InputProps,
                  type: "search",
                },
              }}
            />
          )}
        />
      <Map mode="explore" onCameraClick={null} onCameraAdd={null} onVisibleCamerasChange={0} />
    </>
  );
}
