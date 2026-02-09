import { Box, Typography } from "@mui/material";
import "./analyticsCard.css";

type DataView = "pie" | "line" | "text";

type ACProps = {
  headerText: string;
  icon?: React.ReactNode;
  variant?: DataView;
  valueText?: React.ReactNode;
  lineChart?: React.ReactNode;
  pieChart?: React.ReactNode;
};

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

export default function AnalyticsCard({ headerText, icon, variant = "text", valueText, lineChart, pieChart }: ACProps) {
  return (
    <Box className="ac-container">
      <Box className="ac-header">
        <Typography variant="h6">{headerText}</Typography>
        <Box className="ac-icon" sx={{ display: "grid", placeItems: "center" }}>{icon ?? null}</Box>
      </Box>

      <Box className="ac-content">
        {variant === "text" && (
          <Box className="ac-text">
            <Typography variant="h3">{valueText ?? "—"}</Typography>
          </Box>
        )}

        {variant === "line" && <Box className ="ac-line">{lineChart ?? <Fallback label="No line chart provided" />}</Box>}

        {variant === "pie" && <Box className="ac-pie">{pieChart ?? <Fallback label="No pie chart provided" />}</Box>}
      </Box>
    </Box>
  );
}

