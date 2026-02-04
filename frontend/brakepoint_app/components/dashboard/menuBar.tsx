import { Box, Typography, Button } from "@mui/material";

import MapIcon from "@mui/icons-material/Map";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PlaceIcon from "@mui/icons-material/Place";
import LogoutIcon from "@mui/icons-material/Logout";

import "./menuBar.css";

export default function MenuBar() {
  return (
    <Box className="menu-container">
      <Typography variant="h3" className="brakepoint">BrakePoint</Typography>

      <Box className="button-container">
        <Button className="menu-button" startIcon={<DashboardIcon />}>
          <Typography >Analytics</Typography>
          
        </Button>

        <Button className="menu-button" startIcon={<PlaceIcon />}>
          <Typography>Locations</Typography>
        </Button>

        <Button className="menu-button" startIcon={<MapIcon />}>
          <Typography>Map Overview</Typography>
        </Button>

        <Button className="menu-button" startIcon={<LogoutIcon />}>
          <Typography>Sign Out</Typography>
        </Button>
      </Box>
    </Box>
  );
}
