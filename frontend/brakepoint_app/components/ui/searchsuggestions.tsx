"use client";

import * as React from "react";
import { Autocomplete, TextField } from "@mui/material";
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
      renderInput={(params) => (
        <TextField
          {...params}
          label="" // hide label…
          placeholder="Search for the area you want to monitor." // …use placeholder instead
          slotProps={{
            input: {
              ...params.InputProps,
              type: "search",
            },
          }}
        />
      )}
    />
  );
}
