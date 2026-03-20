"use client";

import { Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import LocationCard from "./locationCard";
import type { SubAreaSummary } from "./analytics";

import "./cardCarousel.css";

type CarouselProps = {
  subareas: SubAreaSummary[];
  onSelect?: (subarea: SubAreaSummary) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyRoute?: string;
};

export default function CardCarousel({
  subareas,
  onSelect,
  emptyTitle = "No Sub-Areas Yet",
  emptyDescription = "Switch to Configuration mode and draw a sub-area to begin.",
  emptyRoute = "/explore",
}: CarouselProps) {
  const router = useRouter();
  const isEmpty = subareas.length === 0;

  const handleEmptyClick = useCallback(() => {
    router.push(emptyRoute);
  }, [router, emptyRoute]);

  const handleEmptyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEmptyClick();
      }
    },
    [handleEmptyClick],
  );

  return (
    <Box className={`carousel-container ${isEmpty ? "carousel-container--empty" : ""}`}>
      {isEmpty ? (
        <Box className="carousel-empty-wrapper">
          <Box
            className="carousel-empty"
            role="button"
            tabIndex={0}
            onClick={handleEmptyClick}
            onKeyDown={handleEmptyKeyDown}
          >
            <Typography variant="h4" className="carousel-empty__title">
              {emptyTitle}
            </Typography>

            <Typography variant="body1" className="carousel-empty__description">
              {emptyDescription}
            </Typography>
          </Box>
        </Box>
      ) : (
        subareas.map((subarea) => (
          <Box className="carousel-card-container" key={subarea.id}>
            <LocationCard camera={subarea} onClick={() => onSelect?.(subarea)} />
          </Box>
        ))
      )}
    </Box>
  );
}