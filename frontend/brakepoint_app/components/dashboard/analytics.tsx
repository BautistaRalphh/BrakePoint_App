"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Box, Grid, Typography, Paper, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import CarCrashOutlinedIcon from "@mui/icons-material/CarCrashOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import AnalyticsCard from "./analyticsCard";

import dynamic from "next/dynamic";
const Map = dynamic(() => import("../map/map"), { ssr: false });

import { getSavedLocationsMock, saveLocationsMock, type Loc } from "@/lib/api/locations";

import "./analytics.css";

export default function Analytics() {
  const router = useRouter();

  const [locations, setLocations] = useState<Loc[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<Loc | null>(null);

  useEffect(() => {
    getSavedLocationsMock()
      .then((data) => {
        setLocations(data.locations ?? []);
        setSelectedLoc((prev) => prev ?? data.locations?.[0] ?? null);
      })
      .catch(() => {
        setLocations([]);
      });

    router.prefetch("/map");
  }, [router]);

  const dashboardMarkers = useMemo(
    () =>
      locations.map((l) => ({
        id: l.id,
        lat: l.lat,
        lng: l.lng,
        label: l.name,
      })),
    [locations],
  );

  const handleDashboardMarkerClick = (id: number | string) => {
    const loc = locations.find((l) => String(l.id) === String(id));
    if (!loc) return;
    setSelectedLoc(loc);
  };

  const persist = async (next: Loc[]) => {
    setLocations(next);
    await saveLocationsMock(next);
  };

  return (
    <Box className="analytics-container">
      <Box className="analytics-header">
        <Typography variant="h3">Analytics</Typography>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker label="Start Date" />
        </LocalizationProvider>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker label="End Date" />
        </LocalizationProvider>
      </Box>

      <Grid container spacing={4}>
        <Grid size={3}>
          <Stack spacing={2} width="100%">
            <AnalyticsCard headerText="Total vehicle count" icon={<DirectionsCarFilledOutlinedIcon />} variant="text" valueText="500"></AnalyticsCard>
            <AnalyticsCard headerText="Total ADB count" icon={<CarCrashOutlinedIcon />} variant="text" valueText="500"></AnalyticsCard>
          </Stack>
        </Grid>

        <Grid size={3}>
          <Stack spacing={2}>
            <AnalyticsCard
              headerText="Speeding incidents per 1,000 vehicles"
              icon={<SpeedOutlinedIcon />}
              variant="text"
              valueText="500"
            ></AnalyticsCard>
            <AnalyticsCard
              headerText="Abrupt stopping events per 1,000 vehicles"
              icon={<SpeedOutlinedIcon />}
              variant="text"
              valueText="500"
            ></AnalyticsCard>
            <AnalyticsCard
              headerText="Swerving events per 1,000 vehicles"
              icon={<SpeedOutlinedIcon />}
              variant="text"
              valueText="500"
            ></AnalyticsCard>
          </Stack>
        </Grid>

        <Grid size={6} display="flex" sx={{ minHeight: 420 }}>
          <Box sx={{ height: "75vh", width: "100%", borderRadius: 2, overflow: "hidden" }}>
            <Map
              mode="dashboard"
              refreshTrigger={0}
              dashboardMarkers={dashboardMarkers}
              onDashboardMarkerClick={handleDashboardMarkerClick}
              goTo={selectedLoc ? [selectedLoc.lng, selectedLoc.lat] : null}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
