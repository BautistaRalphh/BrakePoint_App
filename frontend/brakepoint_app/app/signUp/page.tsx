'use client';

import { useState } from "react";
import { Box, Button, TextField, Typography, Paper } from '@mui/material';

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  

   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    console.log("Submitted:", { username, password });
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{ backgroundColor: "#f5f5f5" }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: 400,
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" align="center" sx={{ mb:2 }}>
          <b>Sign Up</b>
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            margin="normal"
            color="secondary" //  can change to diff color when focused
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <TextField
            fullWidth
            label="Email"
            variant="outlined"
            margin="normal"
            color="secondary" //  can change to diff color when focused
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            color="secondary" //  can change to diff color when focused
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 2, mb: 1, backgroundColor: "#161b4cff" }}
          >
            Sign Up
          </Button>
        </Box>

        <Typography align="center" variant="body2" sx={{ mt: 2 }}>
          Already have an account?{" "}
          <a href="/logIn" style={{ color: "#161b4cff", textDecoration: "underline" }}>
            Login here
          </a>
        </Typography>
      </Paper>
    </Box>
  );
}

