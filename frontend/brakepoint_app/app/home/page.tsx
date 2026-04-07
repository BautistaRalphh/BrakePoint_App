'use client';

import { AppBar, Toolbar, Box, Button, Typography } from '@mui/material';
import Link from 'next/link';

export default function HomePage() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="sticky" sx={{ backgroundColor: '#161b4cff' }}>
        <Toolbar sx={{ marginLeft: 'auto', mr: 6.5, display: 'flex', gap: 1 }}>
          <Button color="inherit" component={Link} href="/home">Home</Button>
          <Button color="inherit" component={Link} href="/project-overview">Project Overview</Button>
          <Button color="inherit" component={Link} href="/logIn">Login</Button>
          <Button color="inherit" component={Link} href="/signUp">Sign Up</Button>
        </Toolbar>
      </AppBar>

      <Box
        display="flex"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 9, ml: 5, mr: 5 }}
      >
        <Box sx={{ flex: 1, pr: 4 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Welcome to BrakePoint
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            BrakePoint is a smart decision support tool designed to improve road safety and
            optimize traffic planning through data-driven solutions.
          </Typography>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Box sx={{ width: 560, height: 315 }}>
            <iframe
              width="560"
              height="315"
              src="https://www.youtube.com/embed/fpXu5m3qUFs"
              title="BrakePoint Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 0, borderRadius: 8, display: 'block' }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}