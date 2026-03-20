"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Box, Grid, Typography, Stack, CircularProgress, Chip } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";

import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import SwapCallsIcon from "@mui/icons-material/SwapCalls";
import PanToolOutlinedIcon from "@mui/icons-material/PanToolOutlined";

import AnalyticsCard from "./analyticsCard";
import CardCarousel from "./cardCarousel";

import dynamic from "next/dynamic";
const Map = dynamic(() => import("../map/map"), { ssr: false });

import "./analytics.css";
import { authFetch } from "@/lib/authFetch";

export type CameraSummary = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  location: string;
  total_videos: number;
  vehicles: number;
  speeding: number;
  swerving: number;
  abrupt_stopping: number;
  adb: number;
  thumbnail: string | null;
  tags: string[];
};

type Totals = {
  vehicles: number;
  adb: number;
  speeding: number;
  swerving: number;
  abrupt_stopping: number;
};

type BreakdownEntry = { label: string; value: number };

function fmtRate(count: number, total: number): string {
  if (total === 0) return "0";
  return ((count / total) * 1000).toFixed(1);
}

export default function Analytics() {
  const router = useRouter();

  const [totals, setTotals] = useState<Totals>({ vehicles: 0, adb: 0, speeding: 0, swerving: 0, abrupt_stopping: 0 });
  const [breakdown, setBreakdown] = useState<BreakdownEntry[]>([]);
  const [cameras, setCameras] = useState<CameraSummary[]>([]);
  const [selectedCam, setSelectedCam] = useState<CameraSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Fetch dashboard summary from real API
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) {
        params.set("start", startDate.format("YYYY-MM-DD"));
      }

      if (endDate) {
        params.set("end", endDate.format("YYYY-MM-DD"));
      }

      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard-summary/?${params}`);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();

      if (json.success) {
        setTotals(json.totals);
        setCameras(json.cameras ?? []);
        setSelectedCam((prev) => prev ?? json.cameras?.[0] ?? null);

        const bd: BreakdownEntry[] = Object.entries(json.vehicle_breakdown ?? {}).map(([label, value]) => ({ label, value: value as number }));
        setBreakdown(bd);
      }
    } catch {
      /* keep previous state */
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    router.prefetch("/map");
    router.prefetch("/monitoring");
  }, [router]);

  // Collect all unique tags across cameras
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    cameras.forEach((c) => (c.tags ?? []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [cameras]);

  // Filter cameras by selected tags
  const filteredCameras = useMemo(() => {
    if (selectedTags.length === 0) return cameras;
    return cameras.filter((c) => selectedTags.every((tag) => (c.tags ?? []).includes(tag)));
  }, [cameras, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const dashboardMarkers = useMemo(() => cameras.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, label: c.name })), [cameras]);

  const handleMarkerClick = (id: number | string) => {
    const cam = cameras.find((c) => String(c.id) === String(id));
    if (cam) setSelectedCam(cam);
  };

  const v = totals.vehicles;

  return (
    <Box className="analytics-container">
      <Box className="analytics-header">
        <Typography variant="h3">Analytics</Typography>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <DatePicker
              label="From"
              value={startDate}
              onChange={(v) => {
                if (!v) {
                  setStartDate(null);
                  return;
                }
                if (endDate && v.isAfter(endDate)) return;
                setStartDate(v);
              }}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    bgcolor: "#fff",
                    minWidth: 140,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  },
                },
              }}
            />

            <DatePicker
              label="To"
              value={endDate}
              onChange={(v) => {
                if (!v) {
                  setEndDate(null);
                  return;
                }
                if (startDate && v.isBefore(startDate)) return;
                setEndDate(v);
              }}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    bgcolor: "#fff",
                    minWidth: 140,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  },
                },
              }}
            />
          </Box>
        </LocalizationProvider>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400, gap: 2 }}>
          <CircularProgress size={32} sx={{ color: "#1d1f3f" }} />
          <Typography color="text.secondary">Loading dashboard…</Typography>
        </Box>
      ) : (
        <>
          <Box className="analytics-card-container">
            <Grid container spacing={{ xs: 2, md: 2 }} alignItems="stretch" sx={{ height: "100%" }}>
              <Grid size={{ xs: 12, md: 3 }} display="flex" sx={{ minWidth: 0 }}>
                <Stack spacing={2} width="100%" height="100%">
                  <AnalyticsCard
                    headerText="Total vehicle count"
                    icon={<DirectionsCarFilledOutlinedIcon />}
                    variant="pie"
                    valueText={v.toLocaleString()}
                    data={breakdown}
                  />
                  <AnalyticsCard
                    headerText="Total ADB count"
                    icon={<ReportProblemOutlinedIcon />}
                    variant="text"
                    valueText={totals.adb.toLocaleString()}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }} display="flex" sx={{ minWidth: 0 }}>
                <Stack spacing={2} width="100%" height="100%">
                  <AnalyticsCard compact headerText="Speeding" icon={<SpeedOutlinedIcon />} variant="text" valueText={fmtRate(totals.speeding, v)} />
                  <AnalyticsCard compact headerText="Swerving" icon={<SwapCallsIcon />} variant="text" valueText={fmtRate(totals.swerving, v)} />
                  <AnalyticsCard
                    compact
                    headerText="Abrupt stopping"
                    icon={<PanToolOutlinedIcon />}
                    variant="text"
                    valueText={fmtRate(totals.abrupt_stopping, v)}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }} display="flex" sx={{ minWidth: 0 }}>
                <Box sx={{ minHeight: { xs: 720, md: "100%" }, width: "100%", borderRadius: 2, overflow: "hidden" }}>
                  <Map
                    mode="dashboard"
                    refreshTrigger={0}
                    dashboardMarkers={dashboardMarkers}
                    onDashboardMarkerClick={handleMarkerClick}
                    goTo={selectedCam ? [selectedCam.lng, selectedCam.lat] : null}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>

          <CardCarousel
            cameras={filteredCameras}
            onSelect={(c) => router.push(`/monitoring?cameraId=${c.id}`)}
            emptyTitle="No Sub-Areas Yet"
            emptyDescription="Enter explore mode and draw a sub-area to begin."
          />

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, fontWeight: 600 }}>
                Filter by tag:
              </Typography>
              {allTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                  onClick={() => toggleTag(tag)}
                  sx={{
                    fontSize: "0.75rem",
                    height: 26,
                    cursor: "pointer",
                    ...(selectedTags.includes(tag)
                      ? { bgcolor: "#1d1f3f", color: "#fff", "&:hover": { bgcolor: "#2a2d5a" } }
                      : { borderColor: "#999", color: "#555", "&:hover": { bgcolor: "#eee" } }),
                  }}
                />
              ))}
              {selectedTags.length > 0 && (
                <Chip
                  label="Clear"
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedTags([])}
                  sx={{ fontSize: "0.7rem", height: 24, borderColor: "#ccc", color: "#999" }}
                />
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
