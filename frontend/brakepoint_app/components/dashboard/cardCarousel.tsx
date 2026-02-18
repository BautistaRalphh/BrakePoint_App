"use client";

import { Box, Typography } from "@mui/material";
import LocationCard from "./locationCard";
import type { Loc } from "@/lib/api/locations";

import "./cardCarousel.css";


type CarouselProps = {
  locations: Loc[];
  onSelect?: (loc: Loc) => void;
};

export default function CardCarousel({ locations, onSelect }: CarouselProps) {
  return (
    <Box className="carousel-container">
      {locations.map((loc) => {
        return (
          <Box className="carousel-card-container" key={loc.id} >
            <LocationCard loc={loc} onClick={() => onSelect?.(loc)} />
          </Box>
        );
      })}
    </Box>
  );
}
