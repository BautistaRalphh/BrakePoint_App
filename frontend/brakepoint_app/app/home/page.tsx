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
          <Button color="inherit" > About </Button>
          <Button color="inherit" > Developers </Button>
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
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed accumsan orci lectus, finibus consectetur lacus pellentesque eget. Sed et facilisis nibh, non vulputate orci. Proin eu metus rutrum, tincidunt est in, volutpat lorem. Pellentesque fringilla ultrices augue. Vestibulum ultricies sagittis velit, dignissim tincidunt orci molestie sed.
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
            <iframe
              width="560"
              height="315"
              src="https://www.youtube.com/embed/aN-wS7a-RnE?si=yWMDo3L31dQ8zW0i" //  replace with GIF demo video of brakepoint
              title="YouTube video player"

              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            // referrerpolicy="strict-origin-when-cross-origin"
            //  allowfullscreen
            >
            </iframe>
          </Box>
        </Box>
      </Box>




    </Box>
  );
}