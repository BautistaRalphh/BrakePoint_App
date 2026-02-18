"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Box, Grid, Typography, Paper, Stack } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import CarCrashOutlinedIcon from "@mui/icons-material/CarCrashOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";

import AnalyticsCard from "./analyticsCard";
import CardCarousel from "./cardCarousel";

import dynamic from "next/dynamic";
const Map = dynamic(() => import("../map/map"), { ssr: false });

import { getSavedLocationsMock, saveLocationsMock, type Loc } from "@/lib/api/locations";

import "./analytics.css";

export default function Analytics() {
  const router = useRouter();

  const [locations, setLocations] = useState<Loc[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<Loc | null>(null);

  const vehicleBreakdown = [
    { id: 0, value: 420, label: "Cars" },
    { id: 1, value: 120, label: "Motorcycles" },
    { id: 2, value: 60, label: "Trucks" },
    { id: 3, value: 40, label: "Buses" },
  ];

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

      <Box className="analytics-card-container">
        <Grid container spacing={{ xs: 2, md: 2 }} alignItems="stretch" sx={{ height: "100%" }}>
          <Grid size={{ xs: 12, md: 3 }} display="flex" sx={{ minWidth: 0 }}>
            <Stack spacing={2} width="100%" height="100%">
              <AnalyticsCard
                headerText="Total vehicle count"
                icon={<DirectionsCarFilledOutlinedIcon />}
                variant="text"
                valueText="500"
              ></AnalyticsCard>
              <AnalyticsCard headerText="Total ADB count" icon={<CarCrashOutlinedIcon />} variant="text" valueText="500"></AnalyticsCard>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3, lg: 3 }} display="flex" sx={{ minWidth: 0 }}>
            <Stack spacing={2} width="100%" height="100%">
              <AnalyticsCard
                compact
                headerText="Speeding incidents per 1,000 vehicles"
                icon={<SpeedOutlinedIcon />}
                variant="text"
                valueText="500"
              ></AnalyticsCard>
              <AnalyticsCard
                compact
                headerText="Abrupt stopping events per 1,000 vehicles"
                icon={<SpeedOutlinedIcon />}
                variant="text"
                valueText="500"
              ></AnalyticsCard>
              <AnalyticsCard
                compact
                headerText="Swerving events per 1,000 vehicles"
                icon={<SpeedOutlinedIcon />}
                variant="text"
                valueText="500"
              ></AnalyticsCard>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }} display="flex" sx={{ minWidth: 0 }}>
            <Box sx={{ minHeight: { xs: 720, md: "100%" }, width: "100%", borderRadius: 2, overflow: "hidden" }}>
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

      <CardCarousel locations={locations} />
    </Box>
  );
}
