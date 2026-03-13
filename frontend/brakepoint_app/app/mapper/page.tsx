"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import dynamic from "next/dynamic";
import {
  Divider,
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";
import { authFetch } from "@/lib/authFetch";

import ToggleDrawer from "@components/map/toggleDrawer";
import SideTab from "@components/map/sideTab";
import Table from "@components/ui/table";
import CameraTags from "@components/ui/cameraTags";

import "./style.css";

import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import CarCrashIcon from "@mui/icons-material/CarCrash";
import LocalTaxiIcon from "@mui/icons-material/LocalTaxi";

const Map = dynamic(() => import("@components/map/map"), { ssr: false });

type DrawMode = "none" | "drawPolygon" | "editPolygon" | "deletePolygon";

export default function MapPage() {
  const router = useRouter();
  const { trackVideoProcessing, showToast } = useNotifications();
  const [open, setOpen] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const [allFeeds, setAllFeeds] = useState<any[]>([]);

  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const selectedFeedIdRef = useRef<number | null>(null);

  const [goTo, setGoTo] = useState<[number, number] | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newFeedName, setNewFeedName] = useState("");

  const [visibleCameraIds, setVisibleCameraIds] = useState<number[]>([]);
  const [camerasLoaded, setCamerasLoaded] = useState(false);
  const [selectedFeedData, setSelectedFeedData] = useState<any>(null);
  const [selectedVideoData, setSelectedVideoData] = useState<any>(null);
  const [aggregatedVideoData, setAggregatedVideoData] = useState<any>(null);
  const [loadingFeedData, setLoadingFeedData] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [camerasRefreshTrigger, setCamerasRefreshTrigger] = useState(0);

  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [draftPoly, setDraftPoly] = useState<[number, number][]>([]); 
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    mapInstanceRef.current = map;
    setTimeout(() => map.resize(), 0);
  }, []);

  useEffect(() => {
    selectedFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId]);

  const selectedFeed = useMemo(() => allFeeds.find((feed) => feed.id === selectedFeedId), [allFeeds, selectedFeedId]);

  useEffect(() => {
    const fetchCameraData = async () => {
      if (selectedFeedId === null) {
        setSelectedFeedData(null);
        return;
      }

      setLoadingFeedData(true);
      try {
        const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/`);

        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.cameras) {
            const cameraId = Number(selectedFeedId);
            
            const camera = data.cameras.find((cam: any) => cam.id === cameraId);
            if (camera) {
              setSelectedFeedData({
                id: camera.id,
                name: camera.name,
                lat: camera.lat,
                lng: camera.lng,
                location: camera.location,
                latestUpload: camera.latest_upload || "No uploads yet",
                vehicles: camera.vehicles || 0,
                occurrences: camera.occurrences || 0,
                behaviors: camera.behaviors && camera.behaviors.length > 0 ? camera.behaviors : ["No Data"],
                signs: camera.signs || 0,
                signClasses: camera.sign_classes || [],
                jeepneyHotspot: camera.latest_video?.jeepney_hotspot || false,
              });

              setGoTo([camera.lng, camera.lat]);
            }
          }
        } else {
          console.error("Failed to fetch camera data:", response.statusText);
          setSelectedFeedData(null);
        }
      } catch (error) {
        console.error("Error fetching camera data:", error);
        setSelectedFeedData(null);
      } finally {
        setLoadingFeedData(false);
      }
    };

    fetchCameraData();
  }, [selectedFeedId, refreshTrigger]);

  useEffect(() => {
    const fetchLatestVideo = async () => {
      if (selectedFeedId === null) {
        setSelectedVideoData(null);
        return;
      }

      try {
        const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${selectedFeedId}/videos/`);

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.videos && data.videos.length > 0) {
            const latestVideo = data.videos[0];
            const occurrences = (latestVideo.speeding_count || 0) + (latestVideo.swerving_count || 0) + (latestVideo.abrupt_stopping_count || 0);
            setSelectedVideoData({
              vehicles: latestVideo.vehicles || 0,
              occurrences: occurrences,
              behaviors: latestVideo.behaviors || ["No Data"],
              signs: latestVideo.signs || 0,
              signClasses: latestVideo.sign_classes || [],
              jeepneyHotspot: latestVideo.jeepney_hotspot || false,
              speeding: latestVideo.speeding_count || 0,
              swerving: latestVideo.swerving_count || 0,
              abruptStop: latestVideo.abrupt_stopping_count || 0,
              duration: latestVideo.duration_seconds || 0,
              videoName: latestVideo.filename || "Unknown",
            });

            if (latestVideo.thumbnail) {
              setVideoThumbnail(latestVideo.thumbnail);
              setVideoSrc("placeholder");
            } else {
              setVideoThumbnail(null);
              setVideoSrc(null);
            }
          } else {
            setSelectedVideoData(null);
            setVideoThumbnail(null);
            setVideoSrc(null);
          }
        }
      } catch (error) {
        console.error("Error fetching latest video:", error);
      }
    };

    fetchLatestVideo();
  }, [selectedFeedId, refreshTrigger]);

  // Fetch and aggregate all videos from visible cameras
  useEffect(() => {
    const fetchAggregatedVideos = async () => {
      if (visibleCameraIds.length === 0) {
        setAggregatedVideoData(null);
        return;
      }

      try {
        // Fetch videos from all visible cameras in parallel
        const videoPromises = visibleCameraIds.map((cameraId) =>
          authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/videos/`).then((res) => res.json()),
        );

        const results = await Promise.all(videoPromises);

        const allVideos = results.flatMap((result) => (result.success && result.videos ? result.videos : []));

        if (allVideos.length > 0) {
          const totalVehicles = allVideos.reduce((sum, video) => sum + (video.vehicles || 0), 0);
          const totalSpeeding = allVideos.reduce((sum, video) => sum + (video.speeding_count || 0), 0);
          const totalSwerving = allVideos.reduce((sum, video) => sum + (video.swerving_count || 0), 0);
          const totalAbruptStop = allVideos.reduce((sum, video) => sum + (video.abrupt_stopping_count || 0), 0);
          const totalSigns = allVideos.reduce((sum, video) => sum + (video.signs || 0), 0);
          const totalOccurrences = totalSpeeding + totalSwerving + totalAbruptStop;

          const allBehaviors = new Set<string>();
          allVideos.forEach((video) => {
            if (video.speeding_count > 0) allBehaviors.add("Speeding");
            if (video.swerving_count > 0) allBehaviors.add("Swerving");
            if (video.abrupt_stopping_count > 0) allBehaviors.add("Abrupt Stopping");
          });

          const allSignClasses = new Set<string>();
          allVideos.forEach((video) => {
            if (video.sign_classes && Array.isArray(video.sign_classes)) {
              video.sign_classes.forEach((sc: string) => allSignClasses.add(sc));
            }
          });

          const hasJeepneyHotspot = allVideos.some((video) => video.jeepney_hotspot);

          setAggregatedVideoData({
            totalVehicles,
            totalOccurrences,
            totalSigns,
            allBehaviors: Array.from(allBehaviors),
            allSignClasses: Array.from(allSignClasses),
            hasJeepneyHotspot,
            cameraCount: visibleCameraIds.length,
          });
        } else {
          setAggregatedVideoData(null);
        }
      } catch (error) {
        console.error("Error fetching aggregated videos:", error);
      }
    };

    fetchAggregatedVideos();
  }, [visibleCameraIds, refreshTrigger]);

  const visibleFeeds = useMemo(() => allFeeds.filter((feed) => visibleCameraIds.includes(feed.id)), [allFeeds, visibleCameraIds]);

  const aggregateData = useMemo(() => {
    if (aggregatedVideoData) {
      return aggregatedVideoData;
    }

    if (visibleFeeds.length === 0) return null;

    return {
      totalVehicles: visibleFeeds.reduce((sum, feed) => sum + feed.vehicles, 0),
      totalOccurrences: visibleFeeds.reduce((sum, feed) => sum + feed.occurrences, 0),
      totalSigns: visibleFeeds.reduce((sum, feed) => sum + (feed.signs || 0), 0),
      allBehaviors: Array.from(new Set(visibleFeeds.flatMap((feed) => feed.behaviors))).filter((b) => b !== "No Data"),
      allSignClasses: Array.from(new Set(visibleFeeds.flatMap((feed) => feed.signClasses || []))),
      hasJeepneyHotspot: visibleFeeds.some((feed) => feed.jeepneyHotspot),
      cameraCount: visibleFeeds.length,
    };
  }, [aggregatedVideoData, visibleFeeds]);

  const handleCamerasLoaded = useCallback((cameras: any[]) => {
    const formattedCameras = cameras.map((cam: any) => ({
      id: cam.id,
      name: cam.name,
      lat: cam.lat,
      lng: cam.lng,
      location: cam.location,
      latestUpload: cam.latest_upload || "No uploads yet",
      vehicles: cam.vehicles,
      occurrences: cam.occurrences,
      behaviors: cam.behaviors.length > 0 ? cam.behaviors : ["No Data"],
      signs: cam.signs || 0,
      signClasses: cam.sign_classes || [],
      jeepneyHotspot: cam.latest_video?.jeepney_hotspot || false,
    }));

    setAllFeeds(formattedCameras);
    setCamerasLoaded(true);
    if (formattedCameras.length > 0) {
      setSelectedFeedId(null);
    }
  }, []);

  const handleVideoFileSelect = useCallback(
    (url: string, thumbnail?: string) => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      if (videoThumbnail && videoThumbnail.startsWith("blob:")) {
        URL.revokeObjectURL(videoThumbnail);
      }
      setVideoSrc(url);
      setVideoThumbnail(thumbnail || null);
    },
    [videoSrc, videoThumbnail],
  );

  const handleCameraClick = useCallback((cameraId: number) => {
    if (selectedFeedIdRef.current === cameraId) {
      setSelectedFeedId(null);
    } else {
      setSelectedFeedId(cameraId);
    }
    setVideoSrc(null);
    setVideoThumbnail(null);
    setSelectedVideoData(null);
    setIsEditingName(false);
  }, []);

  const handleVisibleCamerasChange = useCallback((visibleIds: number[]) => {
    setVisibleCameraIds(visibleIds);
  }, []);

  const handleNewCameraAdded = useCallback((id: number, lat: number, lng: number, cameraData: any) => {
    const newFeed = {
      id: id,
      name: cameraData.name || `Dynamic Camera ${id}`,
      lat: lat,
      lng: lng,
      location: cameraData.location || `New Location at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
      latestUpload: cameraData.latest_upload || new Date().toLocaleDateString(),
      vehicles: cameraData.vehicles || 0,
      occurrences: cameraData.occurrences || 0,
      behaviors: cameraData.behaviors || ["No Data"],
      signs: cameraData.signs || 0,
      signClasses: cameraData.sign_classes || [],
      jeepneyHotspot: cameraData.latest_video?.jeepney_hotspot || false,
    };

    setAllFeeds((prevFeeds) => [...prevFeeds, newFeed]);
    setSelectedFeedId(id);
    setIsEditingName(false);
  }, []);

  const handleVideoUploadComplete = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
    setCamerasRefreshTrigger((prev) => prev + 1);
  }, []);


  const handleUploadStart = useCallback(
    (videoName: string) => {
      showToast(`Uploading "${videoName}"…`, "info");
    },
    [showToast],
  );

  const handleProcessingStart = useCallback(
    (videoName: string, videoId: number) => {
      showToast(`"${videoName}" uploaded — processing started`, "info");
      trackVideoProcessing(videoName, videoId);
    },
    [showToast, trackVideoProcessing],
  );

  const handleProcessingComplete = useCallback(
  (videoName: string, success: boolean, data?: any) => {
    if (success) {
      showToast(`"${videoName}" processed successfully`, "success");
    } else {
      showToast(`"${videoName}" — ${data?.error || "Processing failed"}`, "error");
    }
  },
  [showToast],
);

  const handleVideoSelect = useCallback((videoData: any) => {
    if (!videoData) {
      setSelectedVideoData(null);
      setVideoSrc(null);
      setVideoThumbnail(null);
      return;
    }

    const occurrences = (videoData.speeding || 0) + (videoData.swerving || 0) + (videoData.abrupt_stop || 0);

    const behaviors = [];
    if (videoData.speeding > 0) behaviors.push("Speeding");
    if (videoData.swerving > 0) behaviors.push("Swerving");
    if (videoData.abrupt_stop > 0) behaviors.push("Abrupt Stopping");

    setSelectedVideoData({
      vehicles: videoData.vehicles || 0,
      occurrences: occurrences,
      behaviors: behaviors.length > 0 ? behaviors : ["No Data"],
      signs: videoData.signs || 0,
      signClasses: videoData.sign_classes || [],
      jeepneyHotspot: videoData.jeepney_hotspot || false,
      speeding: videoData.speeding || 0,
      swerving: videoData.swerving || 0,
      abruptStop: videoData.abrupt_stop || 0,
      duration: videoData.duration || 0,
      videoName: videoData.video_name || "Unknown",
    });

    if (videoData.thumbnail) {
      setVideoThumbnail(videoData.thumbnail);
      setVideoSrc("placeholder"); 
    } else {
      setVideoThumbnail(null);
      setVideoSrc(null);
    }
  }, []);

  const handleMultipleVideoSelect = useCallback((videoDataArray: any[]) => {
    if (!videoDataArray || videoDataArray.length === 0) {
      setSelectedVideoData(null);
      return;
    }

    const totalVehicles = videoDataArray.reduce((sum, video) => sum + (video.vehicles || 0), 0);
    const totalSpeeding = videoDataArray.reduce((sum, video) => sum + (video.speeding || 0), 0);
    const totalSwerving = videoDataArray.reduce((sum, video) => sum + (video.swerving || 0), 0);
    const totalAbruptStop = videoDataArray.reduce((sum, video) => sum + (video.abrupt_stop || 0), 0);
    const totalSigns = videoDataArray.reduce((sum, video) => sum + (video.signs || 0), 0);
    const totalOccurrences = totalSpeeding + totalSwerving + totalAbruptStop;

    const behaviors = [];
    if (totalSpeeding > 0) behaviors.push("Speeding");
    if (totalSwerving > 0) behaviors.push("Swerving");
    if (totalAbruptStop > 0) behaviors.push("Abrupt Stopping");

    const allSignClasses = new Set<string>();
    videoDataArray.forEach((video) => {
      if (video.sign_classes && Array.isArray(video.sign_classes)) {
        video.sign_classes.forEach((sc: string) => allSignClasses.add(sc));
      }
    });

    const hasJeepneyHotspot = videoDataArray.some((video) => video.jeepney_hotspot);

    setSelectedVideoData({
      vehicles: totalVehicles,
      occurrences: totalOccurrences,
      behaviors: behaviors.length > 0 ? behaviors : ["No Data"],
      signs: totalSigns,
      signClasses: Array.from(allSignClasses),
      jeepneyHotspot: hasJeepneyHotspot,
      speeding: totalSpeeding,
      swerving: totalSwerving,
      abruptStop: totalAbruptStop,
      duration: 0,
      videoName: `${videoDataArray.length} videos selected`,
    });
  }, []);

  const displayData = useMemo(() => {
    if (selectedVideoData) {
      return selectedVideoData;
    }
    if (selectedFeedData) {
      return {
        vehicles: selectedFeedData.vehicles,
        occurrences: selectedFeedData.occurrences,
        behaviors: selectedFeedData.behaviors,
        signs: selectedFeedData.signs,
        signClasses: selectedFeedData.signClasses,
        jeepneyHotspot: selectedFeedData.jeepneyHotspot,
      };
    }
    return null;
  }, [selectedVideoData, selectedFeedData]);

  const startEdit = useCallback(() => {
    if (!selectedFeedData) return;
    setNewFeedName(selectedFeedData.name);
    setIsEditingName(true);
  }, [selectedFeedData]);

  const saveName = useCallback(() => {
    if (!selectedFeedData || newFeedName.trim() === selectedFeedData.name || newFeedName.trim() === "") {
      setIsEditingName(false);
      return;
    }

    setAllFeeds((prevFeeds) => prevFeeds.map((feed) => (feed.id === selectedFeedId ? { ...feed, name: newFeedName.trim() } : feed)));

    setSelectedFeedData((prev: any) => (prev ? { ...prev, name: newFeedName.trim() } : null));

    setIsEditingName(false);
  }, [newFeedName, selectedFeedData, selectedFeedId]);

  if (isNavigating) {
    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
          zIndex: 9999,
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <Box
            sx={{
              width: 50,
              height: 50,
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #161b4cff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></Box>
          <Typography variant="h6" style={{ color: "#161b4cff" }}>
            Loading...
          </Typography>
        </Box>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </Box>
    );
  }

  return (
    <>
      {/* Back to Dashboard button */}
      <IconButton
        onClick={() => router.push("/dashboard")}
        sx={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1001,
          bgcolor: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
          "&:hover": { bgcolor: "#f5f5f5" },
        }}
      >
        <ArrowBackIcon />
      </IconButton>
      <Box sx={{ height: "100vh", width: "100vw", position: "fixed", top: 0, left: 0, zIndex: 0 }}>
        <Map
          mode="map"
          onCameraClick={handleCameraClick}
          onCameraAdd={handleNewCameraAdded}
          onVisibleCamerasChange={handleVisibleCamerasChange}
          onCamerasLoaded={handleCamerasLoaded}
          selectedCameraId={selectedFeedId}
          refreshTrigger={camerasRefreshTrigger}
          goTo={goTo}
          onMapReady={handleMapReady}
          showMapillarySigns
        />
      </Box>
      <SideTab side="left" open={open} onToggle={() => setOpen(!open)}>
        {allFeeds.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: 4,
              textAlign: "center",
            }}
          >
            <Typography variant="h5" sx={{ marginBottom: 2 }}>
              No Cameras Available
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Click the pencil icon in the bottom-right corner, then click on the map to place your first camera.
            </Typography>
          </Box>
        ) : selectedFeedId === null ? (
          <>
            {aggregateData ? (
              <>
                <Box className="feed-details" sx={{ marginBottom: 2, marginTop: 6 }}>
                  <Typography variant="h4">Total Data</Typography>
                  <Typography variant="body1">
                    Showing data from {aggregateData.cameraCount} camera{aggregateData.cameraCount !== 1 ? "s" : ""} visible in map
                  </Typography>
                </Box>

                <Divider />

                <Box className="feed-data">
                  <Box className="feed-aggregates">
                    <List>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <DirectionsCarIcon />
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalVehicles} Vehicles`}></ListItemText>
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <CarCrashIcon sx={{ color: "red" }} />
                        </ListItemAvatar>
                        <ListItemText primary={`${aggregateData.totalOccurrences} Occurrences`}></ListItemText>
                      </ListItem>
                    </List>
                  </Box>

                  {aggregateData.allBehaviors.length > 0 && (
                    <Box className="feed-behavior-list">
                      <List>
                        {aggregateData.allBehaviors.map((value: string) => (
                          <ListItemText key={value} primary={value}></ListItemText>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ marginBottom: 2 }} />

                <Table onVideoFileSelect={handleVideoFileSelect} hideUpload={true} cameraId={null} visibleCameraIds={visibleCameraIds} />
              </>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  padding: 4,
                  textAlign: "center",
                }}
              >
                <Typography variant="h5" sx={{ marginBottom: 2 }}>
                  No Cameras in View
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Pan or zoom the map to see camera data
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <>
            {loadingFeedData ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  padding: 4,
                }}
              >
                <Typography variant="h6">Loading camera data...</Typography>
              </Box>
            ) : selectedFeedData ? (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    bgcolor: "black",
                    width: "100%",
                    height: 480,
                    marginBottom: 4,
                    position: "relative",
                  }}
                >
                  {videoThumbnail ? (
                    <Box
                      component="img"
                      src={videoThumbnail}
                      alt="Video thumbnail"
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        cursor: "pointer",
                      }}
                    />
                  ) : videoSrc ? (
                    <Typography variant="body1" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
                      Thumbnail unavailable
                    </Typography>
                  ) : (
                    <Typography variant="h5" sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
                      Select a video to view thumbnail
                    </Typography>
                  )}
                </Box>

                {selectedFeedData && (
                  <>
                    <Box className="feed-details" sx={{ marginBottom: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {isEditingName ? (
                          <TextField
                            variant="standard"
                            value={newFeedName}
                            onChange={(e) => setNewFeedName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveName();
                            }}
                            sx={{ "& .MuiInputBase-input": { padding: 0, fontSize: "1.5rem", fontWeight: 700 } }}
                          />
                        ) : (
                          <Typography variant="h4" onClick={startEdit} sx={{ cursor: "pointer" }}>
                            Feed #{selectedFeedData.id} - {selectedFeedData.name}
                          </Typography>
                        )}

                        <IconButton onClick={isEditingName ? saveName : startEdit} size="small" sx={{ p: 0 }}>
                          {isEditingName ? <CheckIcon color="primary" /> : <EditIcon fontSize="small" />}
                        </IconButton>
                      </Box>

                      <Typography variant="h5"> {selectedFeedData.location} </Typography>
                      <Typography variant="h5">
                        {" "}
                        {selectedFeedData.lng}°E, {selectedFeedData.lat}°N{" "}
                      </Typography>
                      <Typography variant="body1"> Latest Video Uploaded: {selectedFeedData.latestUpload} </Typography>
                      {selectedVideoData && (
                        <Typography variant="body2" sx={{ color: "primary.main", fontStyle: "italic", mt: 1 }}>
                          Viewing: {selectedVideoData.videoName}
                        </Typography>
                      )}
                    </Box>

                    <Divider />

                    <Box className="feed-data">
                      {displayData && (
                        <>
                          <Box className="feed-aggregates">
                            <List>
                              <ListItem disableGutters>
                                <ListItemAvatar>
                                  <DirectionsCarIcon />
                                </ListItemAvatar>
                                <ListItemText primary={`${displayData.vehicles} Vehicles`}></ListItemText>
                              </ListItem>
                              <ListItem disableGutters>
                                <ListItemAvatar>
                                  <CarCrashIcon sx={{ color: "red" }} />
                                </ListItemAvatar>
                                <ListItemText primary={`${displayData.occurrences} Occurences`}></ListItemText>
                              </ListItem>
                              <ListItem disableGutters>
                                <ListItemAvatar>
                                  <LocalTaxiIcon sx={{ color: displayData.jeepneyHotspot ? "#4CAF50" : "#000000ff" }} />
                                </ListItemAvatar>
                                <ListItemText
                                  primary={`Jeepney Hotspot: ${displayData.jeepneyHotspot ? "Yes" : "No"}`}
                                  sx={{ color: displayData.jeepneyHotspot ? "#4CAF50" : "text.secondary" }}
                                ></ListItemText>
                              </ListItem>
                            </List>
                          </Box>

                          {displayData.behaviors.filter((b: string) => b !== "No Data").length > 0 && (
                            <Box className="feed-behavior-list">
                              <List>
                                {displayData.behaviors
                                  .filter((b: string) => b !== "No Data")
                                  .map((value: string, index: number) => (
                                    <ListItemText key={`${value}-${index}`} primary={value}></ListItemText>
                                  ))}
                              </List>
                            </Box>
                          )}

                          <CameraTags cameraId={selectedFeedId} />
                        </>
                      )}
                    </Box>

                    <Divider sx={{ marginBottom: 2 }} />

                    <Table
                      onVideoFileSelect={handleVideoFileSelect}
                      cameraId={selectedFeedId}
                      onUploadComplete={handleVideoUploadComplete}
                      onUploadStart={handleUploadStart}
                      onProcessingStart={handleProcessingStart}
                      onProcessingComplete={handleProcessingComplete}
                      onVideoSelect={handleVideoSelect}
                      onMultipleVideoSelect={handleMultipleVideoSelect}
                    />
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </SideTab>

    </>
  );
}
