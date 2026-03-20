import { Box, Typography } from "@mui/material";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import { LineChart } from "@mui/x-charts/LineChart";
import "./analyticsCard.css";

type DataView = "pie" | "line" | "text";

type ACProps = {
  headerText: string;
  icon?: React.ReactNode;
  variant?: DataView;
  valueText?: React.ReactNode;
  data?: ChartData[];
  compact?: boolean;
};

export type ChartData = {
  label: string;
  value: number;
};

function EmptyPie({ compact, label = "", pieId = "empty-pie-chart" }: { compact: boolean; label?: string; pieId?: string }) {
  const chartSize = compact
    ? { width: 180, height: 160, innerRadius: 35, outerRadius: 70 }
    : { width: 240, height: 220, innerRadius: 45, outerRadius: 90 };

  return (
    <Box sx={{ position: "relative", width: "100%", minHeight: chartSize.height, display: "grid", placeItems: "center" }}>
      <PieChart
        width={chartSize.width}
        height={chartSize.height}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        series={[
          {
            id: pieId,
            data: [
              {
                id: 0,
                label: "No data found",
                value: 1,
                color: "#e5e7eb",
              },
            ],
            innerRadius: compact ? 35 : 45,
            outerRadius: compact ? 70 : 90,
            paddingAngle: 0,
            cornerRadius: 0,
          },
        ]}
      />

      {/* Center label */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: "#9ca3af",
            fontWeight: 500,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

function DefaultPie({ data, compact, pieId = "pie-chart" }: { data: ChartData[]; compact: boolean; pieId?: string }) {
  const cleaned = useMemo(
    () => data.map((d) => ({ ...d, value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0 })).filter((d) => d.value > 0),
    [data],
  );

  if (!cleaned.length) {
    return <EmptyPie compact={compact} pieId={`${pieId}-empty`} />;
  }
  return (
    <PieChart
      height={compact ? 160 : 220}
      margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
      series={[
        {
          id: pieId,
          data: cleaned.map((d, i) => ({
            id: i,
            label: d.label,
            value: d.value,
          })),
          innerRadius: compact ? 35 : 45,
          outerRadius: compact ? 70 : 90,
          paddingAngle: 2,
          cornerRadius: 0,
          valueFormatter: (item) => `${item.value}`,
        },
      ]}
    />
  );
}

function Fallback({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: "100%",
        border: "1px dashed rgba(0,0,0,0.2)",
        borderRadius: 2,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export default function AnalyticsCard({ headerText, icon, variant = "text", valueText, data, compact = false }: ACProps) {
  return (
    <Box className="ac-container">
      <Box className="ac-header">
        <Typography variant={compact ? "body2" : "h6"} fontWeight={600}>
          {headerText}
        </Typography>
        <Box className="ac-icon" sx={{ display: "grid", placeItems: "center" }}>
          {icon ?? null}
        </Box>
      </Box>

      <Box className="ac-content">
        {variant === "text" && (
          <Box className="ac-text">
            <Typography variant={compact ? "h5" : "h4"} fontWeight={700}>
              {valueText ?? "—"}
            </Typography>
          </Box>
        )}

        {variant === "pie" && (
          <Box className="ac-pie">
            <DefaultPie data={data ?? []} compact={compact} pieId={`${headerText}-pie`} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
