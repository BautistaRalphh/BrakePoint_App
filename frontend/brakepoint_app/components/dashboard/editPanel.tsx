"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  Chip,
  Stack,
  Divider,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
  Paper,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import { authFetch } from "@/lib/authFetch";

interface Camera {
  id: number;
  name: string;
  tags: string[];
}

interface VideoRecord {
  id: number;
  filename: string;
  uploaded_at: string;
  vehicles: number;
  speeding_count: number;
  swerving_count: number;
  abrupt_stopping_count: number;
}

interface VideoDraft extends VideoRecord {
  dirty: boolean;
}

export default function EditPanel() {
  /* --- camera list ------------------------------------------------ */
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<number | "">("");
  const [loadingCams, setLoadingCams] = useState(true);

  /* --- videos for selected camera --------------------------------- */
  const [videos, setVideos] = useState<VideoDraft[]>([]);
  const [loadingVids, setLoadingVids] = useState(false);

  /* --- tags for selected camera ----------------------------------- */
  const [tags, setTags] = useState<string[]>([]);
  const [tagsDirty, setTagsDirty] = useState(false);
  const [newTag, setNewTag] = useState("");

  /* --- feedback --------------------------------------------------- */
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>({
    open: false,
    msg: "",
    severity: "success",
  });

  /* --- fetch cameras ---------------------------------------------- */
  const fetchCameras = useCallback(async () => {
    setLoadingCams(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCameras(
        (json.cameras ?? json).map((c: any) => ({
          id: c.id,
          name: c.name,
          tags: c.tags ?? [],
        }))
      );
    } catch {
    } finally {
      setLoadingCams(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  /* --- fetch videos when camera changes --------------------------- */
  const fetchVideos = useCallback(async (camId: number) => {
    setLoadingVids(true);
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${camId}/videos/`
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setVideos(
        (json.videos ?? []).map((v: any) => ({
          id: v.id,
          filename: v.filename,
          uploaded_at: v.uploaded_at,
          vehicles: v.vehicles,
          speeding_count: v.speeding_count,
          swerving_count: v.swerving_count,
          abrupt_stopping_count: v.abrupt_stopping_count,
          dirty: false,
        }))
      );
    } catch {
      setVideos([]);
    } finally {
      setLoadingVids(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCamId === "") return;
    fetchVideos(selectedCamId);
    const cam = cameras.find((c) => c.id === selectedCamId);
    setTags(cam?.tags ?? []);
    setTagsDirty(false);
  }, [selectedCamId, cameras, fetchVideos]);

  /* --- helpers ----------------------------------------------------- */
  const updateVideoField = (idx: number, field: keyof VideoRecord, raw: string) => {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    setVideos((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: val, dirty: true } : v))
    );
  };

  /* --- save one video --------------------------------------------- */
  const saveVideo = async (draft: VideoDraft) => {
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/videos/${draft.id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicles: draft.vehicles,
            speeding_count: draft.speeding_count,
            swerving_count: draft.swerving_count,
            abrupt_stopping_count: draft.abrupt_stopping_count,
          }),
        }
      );
      if (!res.ok) throw new Error();
      setVideos((prev) => prev.map((v) => (v.id === draft.id ? { ...v, dirty: false } : v)));
      setSnack({ open: true, msg: `Saved "${draft.filename}"`, severity: "success" });
    } catch {
      setSnack({ open: true, msg: `Failed to save "${draft.filename}"`, severity: "error" });
    }
  };

  /* --- save all dirty videos -------------------------------------- */
  const saveAllVideos = async () => {
    const dirty = videos.filter((v) => v.dirty);
    for (const d of dirty) await saveVideo(d);
  };

  /* --- save tags -------------------------------------------------- */
  const saveTags = async () => {
    if (selectedCamId === "") return;
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${selectedCamId}/tags/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        }
      );
      if (!res.ok) throw new Error();
      setTagsDirty(false);
      // update local camera list
      setCameras((prev) =>
        prev.map((c) => (c.id === selectedCamId ? { ...c, tags: [...tags] } : c))
      );
      setSnack({ open: true, msg: "Tags saved", severity: "success" });
    } catch {
      setSnack({ open: true, msg: "Failed to save tags", severity: "error" });
    }
  };

  const addTag = () => {
    const t = newTag.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setNewTag("");
    setTagsDirty(true);
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
    setTagsDirty(true);
  };

  /* --- save everything -------------------------------------------- */
  const handleSaveAll = async () => {
    await saveAllVideos();
    if (tagsDirty) await saveTags();
  };

  const hasDirty = videos.some((v) => v.dirty) || tagsDirty;

  return (
    <Box sx={{ flex: 1, p: 4, overflowY: "auto", maxHeight: "100vh" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h3">Edit</Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!hasDirty}
          onClick={handleSaveAll}
          sx={{
            bgcolor: "#1d1f3f",
            "&:hover": { bgcolor: "#2a2d5a" },
            borderRadius: 3,
            textTransform: "none",
          }}
        >
          Save All Changes
        </Button>
      </Box>

      {/* Camera selector */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="edit-cam-label">Select Camera</InputLabel>
        <Select
          labelId="edit-cam-label"
          value={selectedCamId}
          label="Select Camera"
          onChange={(e) => setSelectedCamId(e.target.value as number)}
          sx={{ borderRadius: 3 }}
        >
          {loadingCams ? (
            <MenuItem disabled>Loading…</MenuItem>
          ) : cameras.length === 0 ? (
            <MenuItem disabled>No cameras</MenuItem>
          ) : (
            cameras.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {selectedCamId !== "" && (
        <>
          {/* -------- Tags section -------- */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
              Camera Tags
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
              {tags.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No tags yet
                </Typography>
              )}
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => removeTag(tag)}
                  sx={{
                    bgcolor: "#1d1f3f",
                    color: "#fff",
                    "& .MuiChip-deleteIcon": { color: "rgba(255,255,255,0.6)" },
                  }}
                />
              ))}
            </Box>

            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                size="small"
                placeholder="New tag…"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
              <IconButton onClick={addTag} size="small" sx={{ bgcolor: "#1d1f3f", color: "#fff", "&:hover": { bgcolor: "#2a2d5a" }, borderRadius: 2 }}>
                <AddIcon fontSize="small" />
              </IconButton>
              {tagsDirty && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={saveTags}
                  sx={{ borderRadius: 2, textTransform: "none", borderColor: "#1d1f3f", color: "#1d1f3f" }}
                >
                  Save Tags
                </Button>
              )}
            </Box>
          </Paper>

          {/* -------- Videos section -------- */}
          <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
            Videos
          </Typography>

          {loadingVids ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} sx={{ color: "#1d1f3f" }} />
            </Box>
          ) : videos.length === 0 ? (
            <Typography color="text.secondary">No videos for this camera.</Typography>
          ) : (
            <Stack spacing={2}>
              {videos.map((vid, idx) => (
                <Paper
                  key={vid.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    borderColor: vid.dirty ? "#1d1f3f" : undefined,
                    borderWidth: vid.dirty ? 2 : 1,
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {vid.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Uploaded {new Date(vid.uploaded_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!vid.dirty}
                      onClick={() => saveVideo(vid)}
                      startIcon={<SaveIcon />}
                      sx={{
                        bgcolor: "#1d1f3f",
                        "&:hover": { bgcolor: "#2a2d5a" },
                        borderRadius: 2,
                        textTransform: "none",
                      }}
                    >
                      Save
                    </Button>
                  </Box>

                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <TextField
                      label="Vehicles"
                      type="number"
                      size="small"
                      value={vid.vehicles}
                      onChange={(e) => updateVideoField(idx, "vehicles", e.target.value)}
                      inputProps={{ min: 0 }}
                      sx={{ width: 130, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                    <TextField
                      label="Speeding"
                      type="number"
                      size="small"
                      value={vid.speeding_count}
                      onChange={(e) => updateVideoField(idx, "speeding_count", e.target.value)}
                      inputProps={{ min: 0 }}
                      sx={{ width: 130, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                    <TextField
                      label="Swerving"
                      type="number"
                      size="small"
                      value={vid.swerving_count}
                      onChange={(e) => updateVideoField(idx, "swerving_count", e.target.value)}
                      inputProps={{ min: 0 }}
                      sx={{ width: 130, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                    <TextField
                      label="Abrupt Stopping"
                      type="number"
                      size="small"
                      value={vid.abrupt_stopping_count}
                      onChange={(e) => updateVideoField(idx, "abrupt_stopping_count", e.target.value)}
                      inputProps={{ min: 0 }}
                      sx={{ width: 150, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
        </>
      )}

      {/* Snackbar feedback */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
