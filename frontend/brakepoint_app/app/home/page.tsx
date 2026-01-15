'use client';

import { useState } from "react";
import { AppBar, Toolbar, IconButton, Box, Button, TextField, Typography, Paper } from '@mui/material';
import Link from 'next/link';

export default function HomePage() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar
        position="static"
        sx={{ backgroundColor: '#161b4cff' }}
      >
        <Toolbar sx={{ marginLeft: "auto", mr: 6.5, display: 'flex', gap: 1 }}>
          {/*we can take inspo from the Mapillary home page hehe*/}
          <Button color="inherit" component={Link} href="/home"> Home </Button>
          <Button color="inherit" > Project Overview </Button>
          <Button color="inherit" > Documentation </Button>
          <Button color="inherit" > FAQs </Button>
          <Button color="inherit" component={Link} href="/logIn"> Login </Button>
          <Button color="inherit" component={Link} href="/signUp"> SignUp </Button>
        </Toolbar>
      </AppBar>

      
      <Box
        display="flex"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 9, ml: 5 }}
        // sx={{ mt: 8, px: 8 }}
      >
        <Box sx={{ flex: 1, pr: 4 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Welcome to BrakePoint
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            {/* Empowering road planners and engineers with data-driven insights to design safer, efficient road networks. */}
            BrakePoint is a smart decision support tool designed to improve road safety and optimize traffic planning through data-driven solutions.
          </Typography>
        </Box>


        <Box
          sx={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Box sx={{position: 'relative' }}>
            {/* <iframe
              width="560"
              height="315"
              src="placeholder" //  replace with GIF demo video of brakepoint
              title="YouTube video player"

              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            // referrerpolicy="strict-origin-when-cross-origin"
            //  allowfullscreen
            >
            </iframe> */}
            <Box
              component="img"
              sx={{
                height: 300,
                width: 500,
                maxHeight: { xs: 300, md: 300 },
                maxWidth: { xs: 500, md: 500 },
                backgroundColor: 'lightgray'
              }}
            />
          </Box>
        </Box>
      </Box>




    </Box>
  );
}