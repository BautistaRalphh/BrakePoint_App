"use client";

import { Box } from "@mui/material";
import LocationCard from "./locationCard";
import type { CameraSummary } from "./analytics";

import "./cardCarousel.css";

type CarouselProps = {
  cameras: CameraSummary[];
  onSelect?: (cam: CameraSummary) => void;
};

export default function CardCarousel({ cameras, onSelect }: CarouselProps) {
  return (
    <Box className="carousel-container">
      {cameras.map((cam) => (
        <Box className="carousel-card-container" key={cam.id}>
          <LocationCard camera={cam} onClick={() => onSelect?.(cam)} />
        </Box>
      ))}
    </Box>
  );
}
