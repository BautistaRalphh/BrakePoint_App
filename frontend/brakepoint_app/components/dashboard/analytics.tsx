"use client";
import { Box, Grid, Typography, Paper, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import CarCrashOutlinedIcon from "@mui/icons-material/CarCrashOutlined";
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import AnalyticsCard from "./analyticsCard";
import "./analytics.css";

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: "#ffffff",
  display: "flex",
  flexDirection: "column",
  padding: 32,
  gap: 24,
  flex: 1,
  width: "100%",
}));

export default function Analytics() {
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

      <Grid container spacing={4} alignItems="stretch">
        <Grid size={8} display="flex">
          <Stack spacing={2} width="100%">
            <AnalyticsCard
              headerText="Total vehicle count"
              icon={<DirectionsCarFilledOutlinedIcon />}
              variant="text"
              valueText="500"
            ></AnalyticsCard>
            <AnalyticsCard headerText="Total ADB count" icon={<CarCrashOutlinedIcon />} variant="text" valueText="500"></AnalyticsCard>
          </Stack>
        </Grid>

        <Grid size={4} display="flex">
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
      </Grid>
    </Box>
  );
}
