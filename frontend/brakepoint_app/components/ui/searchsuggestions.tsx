"use client";

import * as React from "react";
import { Autocomplete, TextField, Box, Typography, CircularProgress } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import "./searchsuggestions.css";

export type LocationSuggestion = {
  id: string;
  primary: string;
  secondary?: string;
  center: { lat: number; lon: number };
};

type Props = {
  onSelect: (s: LocationSuggestion) => void;
};

export default function SearchLocation({ onSelect }: Props) {
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/suggestions?q=${encodeURIComponent(query)}`,
          { method: "GET" } 
        );
        const data = (await res.json()) as LocationSuggestion[];
        setOptions(data);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <Autocomplete
      className="location-search"
      freeSolo
      disableClearable
      clearOnBlur={false}
      loading={loading}
      options={options}
      getOptionLabel={(o) => (typeof o === "string" ? o : `${o.primary}${o.secondary ? `, ${o.secondary}` : ""}`)}
      onInputChange={(_, v) => setQuery(v)}
      onChange={(_, v) => {
        if (v && typeof v !== "string") onSelect(v);
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
            <LocationOnIcon sx={{ color: '#161b4cff', fontSize: 20 }} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500, color: '#161b4cff' }}>
                {option.primary}
              </Typography>
              {option.secondary && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {option.secondary}
                </Typography>
              )}
            </Box>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label=""
          placeholder="Search for the area you want to monitor."
          InputProps={{
            ...params.InputProps,
            type: "search",
            startAdornment: (
              <SearchIcon sx={{ color: '#161b4cff', mr: 1, fontSize: 24 }} />
            ),
            endAdornment: (
              <React.Fragment>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </React.Fragment>
            ),
          }}
        />
      )}
    />
  );
}