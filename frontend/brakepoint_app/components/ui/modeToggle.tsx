import { Box, Switch, styled } from "@mui/material";

const ModeSwitch = styled(Switch)(({ theme }) => ({
  "& .MuiSwitch-root": {
    width: 144,
    height: 144,
    padding: "4px",
    zIndex: 1000,
    position: "fixed",
    top: 16,
    right: 16,
    backgroundColor: "blue",
  },

  "& .MuiSwitch-track": {
    "&::after": {
      content: "'Monitoring'",
    },
    "&::before": {
      content: "'Configuration'",
    },
  },
}));

export default function ModeToggle() {
  return (
    <Box>
      <ModeSwitch></ModeSwitch>
    </Box>
  );
}