"use client";

import * as React from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createTheme, ThemeOptions } from "@mui/material/styles";
import { Montserrat } from "next/font/google";

export const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

export const themeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    primary: {
      main: "#1d1f3f",
    },
    secondary: {
      main: "#f50057",
    },
    background: {
      default: "#dde0de",
    },
  },
  typography: {
    overline: {
      fontFamily: "Montserrat",
    },
    caption: {
      fontFamily: "Montserrat",
    },
    body2: {
      fontFamily: "Montserrat",
    },
    body1: {
      fontFamily: "Montserrat",
    },
    subtitle2: {
      fontFamily: "Montserrat",
    },
    subtitle1: {
      fontFamily: "Montserrat",
    },
    h6: {
      fontFamily: "Montserrat",
    },
    h5: {
      fontFamily: "Montserrat",
    },
    h4: {
      fontFamily: "Montserrat",
      fontWeight: 400,
    },
    h3: {
      fontFamily: "Montserrat",
      fontWeight: 600,
    },
    h2: {
      fontFamily: "Montserrat",
      fontWeight: 800,
    },
    h1: {
      fontFamily: "Montserrat",
      fontWeight: 1000,
    },
    fontFamily: "Montserrat",
  },
  spacing: 8,
  shape: {
    borderRadius: 16,
  },
};

const theme = createTheme(themeOptions);

export default function Theme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
