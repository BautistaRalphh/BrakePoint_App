"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import ModeEditIcon from "@mui/icons-material/ModeEdit";

type MapMode = "explore" | "map" | "heatmap" | "dashboard";
type ToolMode = "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint" | "assignCamera";

type Camera = {
  id: number | string;
  lat: number;
  lng: number;
  polygon?: [number, number][];
};

type DashboardMarker = {
  id: number | string;
  lat: number;
  lng: number;
  label?: string;
  popupTitle?: string;
  popupBody?: string;
};

type CompletedPolygon = {
  points: [number, number][];
  cameraId: number | string | null;
};

type MapProps = {
  mode: MapMode;

  dashboardMarkers?: DashboardMarker[];
  onDashboardMarkerClick?: (id: DashboardMarker["id"]) => void;

  onCameraClick?: (cameraId: Camera["id"]) => void;
  onCameraAdd?: (cameraId: Camera["id"], lat: number, lng: number, camera: Camera) => void;
  onVisibleCamerasChange?: (visibleCameraIds: Camera["id"][]) => void;
  onCamerasLoaded?: (cameras: Camera[]) => void;
  selectedCameraId?: Camera["id"] | null;

  refreshTrigger: number;
  goTo?: [number, number] | null;

  onMapReady?: (map: maplibregl.Map) => void;
};

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

class ToggleEditButton implements maplibregl.IControl {
  private onToggle: (isEdit: boolean) => void;
  private container: HTMLElement | null = null;
  private isEditMode = false;

  constructor(onToggle: (isEdit: boolean) => void) {
    this.onToggle = onToggle;
  }

  onAdd() {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const btn = document.createElement("button");
    btn.title = "Toggle Edit Mode";
    ReactDOM.createRoot(btn).render(<ModeEditIcon sx={{ width: 16 }} />);

    btn.onclick = () => {
      this.isEditMode = !this.isEditMode;
      btn.style.backgroundColor = this.isEditMode ? "#e0e4e9ff" : "";
      this.onToggle(this.isEditMode);
    };

    this.container.appendChild(btn);
    return this.container;
  }

  onRemove() {
    this.container?.parentNode?.removeChild(this.container);
    this.container = null;
  }
}

type DashMarkerEntry = {
  marker: maplibregl.Marker;
  popup?: maplibregl.Popup;
  popupRoot?: ReactDOM.Root;
  el: HTMLElement;
  labelEl: HTMLElement;
};

type CameraMarkerEntry = {
  id: number | string;
  marker: maplibregl.Marker;
  lat: number;
  lng: number;
  element: HTMLElement;
};


function ensureClosedRing(points: [number, number][]) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

export default function MapView({
  mode,
  dashboardMarkers,
  onDashboardMarkerClick,
  onCameraClick,
  onCameraAdd,
  onVisibleCamerasChange,
  onCamerasLoaded,
  selectedCameraId,
  refreshTrigger,
  goTo,
  onMapReady,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("none");

  const [showPolygonModal, setShowPolygonModal] = useState(false);

  const [cameras, setCameras] = useState<CameraMarkerEntry[]>([]);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [completedPolygons, setCompletedPolygons] = useState<CompletedPolygon[]>([]);
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(null);

  const toolModeRef = useLatestRef(toolMode);
  const selectedPolygonIndexRef = useLatestRef(selectedPolygonIndex);
  const completedPolygonsRef = useLatestRef(completedPolygons);
  const polygonPointsRef = useLatestRef(polygonPoints);

  const camerasRef = useRef<CameraMarkerEntry[]>([]);
  const isLoadingCameras = useRef(false);

  const dashboardRegistryRef = useRef<Map<string, DashMarkerEntry>>(new Map());
  const openDashboardPopupRef = useRef<maplibregl.Popup | null>(null);
  const editControlRef = useRef<ToggleEditButton | null>(null);

  const style = "https://tiles.openfreemap.org/styles/liberty";
  const lng = 120.9842;
  const lat = 14.5995;
  const zoom = 10;

  const isAssigningCamera = toolMode === "assignCamera";

  const getAuthToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("access_token");
    }
    return null;
  };


  const createMap = useCallback(() => {
    return new maplibregl.Map({
      container: mapContainer.current!,
      style,
      center: [lng, lat],
      zoom,
      pitch: 0,
    });
  }, []);

  const add3DBuildingsLayer = useCallback((map: maplibregl.Map) => {
    const layers = map.getStyle().layers ?? [];
    const firstSymbolId = layers.find((l) => l.type === "symbol")?.id;

    if (!map.getSource("openmaptiles")) return;

    if (!map.getLayer("3d-buildings")) {
      map.addLayer(
        {
          id: "3d-buildings",
          source: "openmaptiles",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "render_height"]],
            "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "render_min_height"]],
            "fill-extrusion-opacity": 0.6,
          },
        },
        firstSymbolId,
      );
    }
  }, []);

  const addHeatmapLayers = useCallback((map: maplibregl.Map) => {
    if (!map.getSource("earthquakes")) {
      map.addSource("earthquakes", {
        type: "geojson",
        data: "https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson",
      });
    }

    if (!map.getLayer("earthquakes-heat")) {
      map.addLayer({
        id: "earthquakes-heat",
        type: "heatmap",
        source: "earthquakes",
        maxzoom: 9,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "mag"], 0, 0, 6, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            0.2,
            "rgb(103,169,207)",
            0.4,
            "rgb(209,229,240)",
            0.6,
            "rgb(253,219,199)",
            0.8,
            "rgb(239,138,98)",
            1,
            "rgb(178,24,43)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0],
        },
      });
    }

    if (!map.getLayer("earthquakes-point")) {
      map.addLayer({
        id: "earthquakes-point",
        type: "circle",
        source: "earthquakes",
        minzoom: 7,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            ["interpolate", ["linear"], ["get", "mag"], 1, 1, 6, 4],
            16,
            ["interpolate", ["linear"], ["get", "mag"], 1, 5, 6, 50],
          ],
          "circle-stroke-color": "white",
          "circle-stroke-width": 1,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 1],
        },
      });
    }
  }, []);

  const removeHeatmapLayers = useCallback((map: maplibregl.Map) => {
    if (map.getLayer("earthquakes-point")) map.removeLayer("earthquakes-point");
    if (map.getLayer("earthquakes-heat")) map.removeLayer("earthquakes-heat");
    if (map.getSource("earthquakes")) map.removeSource("earthquakes");
  }, []);

  // --- Dashboard markers (same approach) ---
  const toKey = (id: number | string) => String(id);

  const cleanupDashEntry = (entry: DashMarkerEntry) => {
    try {
      entry.popupRoot?.unmount();
    } catch {}
    try {
      entry.popup?.remove();
    } catch {}
    try {
      entry.marker.remove();
    } catch {}
  };

  const makeDashboardMarkerElement = (label: string | undefined) => {
    const el = document.createElement("div");
    el.className = "dash-marker";

    const pin = document.createElement("div");
    pin.className = "dash-marker__pin";

    const labelEl = document.createElement("div");
    labelEl.className = "dash-marker__label";
    labelEl.textContent = label ?? "";

    pin.appendChild(labelEl);
    el.appendChild(pin);

    return { el, labelEl };
  };

  const openDashboardPopup = (map: maplibregl.Map, entry: DashMarkerEntry, m: DashboardMarker) => {
    openDashboardPopupRef.current?.remove();
    openDashboardPopupRef.current = null;

    const host = document.createElement("div");
    host.style.width = "320px";

    const popup = new maplibregl.Popup({
      offset: 16,
      closeButton: true,
      closeOnClick: true,
      maxWidth: "360px",
    }).setDOMContent(host);

    const root = ReactDOM.createRoot(host);
    root.render(
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{m.popupTitle ?? m.label ?? "Marker"}</div>
        {m.popupBody ? (
          <div style={{ fontSize: 13, opacity: 0.85 }}>{m.popupBody}</div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
          </div>
        )}
      </div>,
    );

    popup.on("close", () => {
      try {
        root.unmount();
      } catch {}
    });

    entry.marker.setPopup(popup);
    entry.popup = popup;
    entry.popupRoot = root;

    openDashboardPopupRef.current = popup;
    entry.marker.togglePopup();
  };
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const map = createMap();
    mapRef.current = map;
    onMapReady?.(map);

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    map.once("load", () => {
      add3DBuildingsLayer(map);
    });

    return () => {
      openDashboardPopupRef.current?.remove();
      openDashboardPopupRef.current = null;

      const reg = dashboardRegistryRef.current;
      for (const entry of reg.values()) cleanupDashEntry(entry);
      reg.clear();

      camerasRef.current.forEach((c) => c.marker?.remove());
      camerasRef.current = [];
      setCameras([]);

      try {
        map.remove();
      } catch {}

      mapRef.current = null;
      editControlRef.current = null;
    };
  }, [createMap, add3DBuildingsLayer, onMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (mode !== "heatmap") removeHeatmapLayers(map);
      if (mode === "heatmap") addHeatmapLayers(map);

      if (mode === "map") {
        if (!editControlRef.current) {
          editControlRef.current = new ToggleEditButton(setIsEditMode);
          map.addControl(editControlRef.current, "bottom-right");
        }
      } else {
        if (editControlRef.current) {
          map.removeControl(editControlRef.current);
          editControlRef.current = null;
        }
        setIsEditMode(false);
        setToolMode("none");
      }

      if (mode !== "map") {
        setShowPolygonModal(false);
        setSelectedPolygonIndex(null);
        setPolygonPoints([]);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [mode, addHeatmapLayers, removeHeatmapLayers]);

  useEffect(() => {
    if (!goTo) return;
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: goTo,
      zoom: 18,
      duration: 1200,
      essential: true,
    });
  }, [goTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();
    canvas.classList.remove("map-crosshair", "map-remove");
    canvas.style.cursor = "";

    if (!isEditMode) return;

    if (toolMode === "addCamera" || toolMode === "addPoint") canvas.classList.add("map-crosshair");
    if (toolMode === "removeCamera" || toolMode === "removePoint") canvas.classList.add("map-remove");
    if (toolMode === "assignCamera") canvas.style.cursor = "pointer";
  }, [toolMode, isEditMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reg = dashboardRegistryRef.current;

    if (mode !== "dashboard") {
      openDashboardPopupRef.current?.remove();
      openDashboardPopupRef.current = null;

      for (const entry of reg.values()) cleanupDashEntry(entry);
      reg.clear();
      return;
    }

    const markers = dashboardMarkers ?? [];
    const incomingKeys = new Set(markers.map((m) => toKey(m.id)));

    for (const m of markers) {
      const key = toKey(m.id);
      const existing = reg.get(key);

      if (!existing) {
        const { el, labelEl } = makeDashboardMarkerElement(m.label);

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([m.lng, m.lat])
          .addTo(map);

        const entry: DashMarkerEntry = { marker, el, labelEl };
        reg.set(key, entry);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onDashboardMarkerClick?.(m.id);
          openDashboardPopup(map, entry, m);
        });
      } else {
        existing.marker.setLngLat([m.lng, m.lat]);
        const nextLabel = m.label ?? "";
        if (existing.labelEl.textContent !== nextLabel) existing.labelEl.textContent = nextLabel;
      }
    }

    for (const [key, entry] of reg.entries()) {
      if (!incomingKeys.has(key)) {
        cleanupDashEntry(entry);
        reg.delete(key);
      }
    }
  }, [mode, dashboardMarkers, onDashboardMarkerClick]);

  const removeCamera = useCallback(async (cameraId: number | string) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`http://127.0.0.1:8000/brakepoint/api/cameras/${cameraId}/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const cam = camerasRef.current.find((c) => String(c.id) === String(cameraId));
      cam?.marker?.remove();

      camerasRef.current = camerasRef.current.filter((c) => String(c.id) !== String(cameraId));
      setCameras((prev) => prev.filter((c) => String(c.id) !== String(cameraId)));
    } catch {}
  }, []);

  const savePolygonToCamera = useCallback(async (cameraId: number | string, points: [number, number][]) => {
    const token = getAuthToken();
    if (!token) return false;

    const res = await fetch(`http://127.0.0.1:8000/brakepoint/api/cameras/${cameraId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ polygon: points }),
    });

    return res.ok;
  }, []);

  const addCameraFromData = useCallback(
    (cameraLat: number, cameraLng: number, id: number | string) => {
      const map = mapRef.current;
      if (!map) return;

      const el = document.createElement("div");
      el.className = "camera-marker";
      el.style.cursor = "pointer";
      el.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                fill="currentColor"
                stroke="#fff"
                stroke-width="0.5"/>
        </svg>
      `;
      el.style.color = "#999";
      el.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.3))";

      const marker = new maplibregl.Marker({ element: el, draggable: false, anchor: "center" })
        .setLngLat([cameraLng, cameraLat])
        .addTo(map);

      const cameraObj: CameraMarkerEntry = { id, marker, lat: cameraLat, lng: cameraLng, element: el };

      el.addEventListener("click", async (e) => {
        e.stopPropagation();

        if (toolModeRef.current === "removeCamera") {
          removeCamera(id);
          return;
        }

        if (toolModeRef.current === "assignCamera") {
          const polyIdx = selectedPolygonIndexRef.current;
          if (polyIdx == null) return;

          const poly = completedPolygonsRef.current[polyIdx];
          if (!poly) return;

          const ok = await savePolygonToCamera(id, poly.points);
          if (!ok) return;

          setCompletedPolygons((prev) =>
            prev.map((p, i) => (i === polyIdx ? { ...p, cameraId: id } : p)),
          );

          setToolMode("none");
          setShowPolygonModal(false);
          setSelectedPolygonIndex(null);

          return;
        }

        onCameraClick?.(id);
      });

      camerasRef.current = [...camerasRef.current, cameraObj];
      setCameras((prev) => [...prev, cameraObj]);
    },
    [onCameraClick, removeCamera, savePolygonToCamera, completedPolygonsRef, selectedPolygonIndexRef, toolModeRef],
  );

  const loadCamerasFromDatabase = useCallback(async () => {
    if (isLoadingCameras.current) return;

    try {
      isLoadingCameras.current = true;

      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("http://127.0.0.1:8000/brakepoint/api/cameras/", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (!data?.success || !data?.cameras) return;

      camerasRef.current.forEach((c) => c.marker?.remove());
      camerasRef.current = [];
      setCameras([]);

      data.cameras.forEach((cam: Camera) => addCameraFromData(cam.lat, cam.lng, cam.id));

      const polygons: CompletedPolygon[] = data.cameras
        .filter((cam: Camera) => cam.polygon && cam.polygon.length > 0)
        .map((cam: Camera) => ({ points: cam.polygon as [number, number][], cameraId: cam.id }));

      setCompletedPolygons(polygons);
      onCamerasLoaded?.(data.cameras);
    } finally {
      isLoadingCameras.current = false;
    }
  }, [addCameraFromData, onCamerasLoaded]);

  useEffect(() => {
    if (mode !== "map" && mode !== "heatmap") return;
    loadCamerasFromDatabase();
  }, [mode, loadCamerasFromDatabase]);

  useEffect(() => {
    if (mode !== "map") return;
    if (refreshTrigger > 0 && mapRef.current) loadCamerasFromDatabase();
  }, [mode, refreshTrigger, loadCamerasFromDatabase]);

  const addCamera = useCallback(
    async (cameraLat: number, cameraLng: number) => {
      try {
        const token = getAuthToken();
        if (!token) return;

        const response = await fetch("http://127.0.0.1:8000/brakepoint/api/cameras/", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat: cameraLat, lng: cameraLng }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data?.success || !data?.camera) return;

        addCameraFromData(data.camera.lat, data.camera.lng, data.camera.id);
        onCameraAdd?.(data.camera.id, data.camera.lat, data.camera.lng, data.camera);
      } catch {}
    },
    [addCameraFromData, onCameraAdd],
  );

  const updateVisibleCameras = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();

    const visible = camerasRef.current
      .filter((c) => bounds.contains([c.lng, c.lat]))
      .map((c) => c.id);

    onVisibleCamerasChange?.(visible);
  }, [onVisibleCamerasChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMoveEnd = () => updateVisibleCameras();
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    updateVisibleCameras();

    return () => {
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onMoveEnd);
    };
  }, [updateVisibleCameras]);

  const renderPolygonLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const safeRemoveLayer = (id: string) => {
      if (map.getLayer(id)) map.removeLayer(id);
    };
    const safeRemoveSource = (id: string) => {
      if (map.getSource(id)) map.removeSource(id);
    };

    safeRemoveLayer("polygon-guide");
    safeRemoveSource("polygon-guide");

    safeRemoveLayer("polygon-fill");
    safeRemoveLayer("polygon-line");
    safeRemoveSource("polygons");

    safeRemoveLayer("polygon-points");
    safeRemoveLayer("polygon-points-clickable");
    safeRemoveSource("polygon-points");

    const polygonFeatures = completedPolygonsRef.current.map((p, idx) => ({
      type: "Feature" as const,
      properties: {
        polygonIndex: idx,
        cameraId: p.cameraId ?? null,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [ensureClosedRing(p.points)],
      },
    }));

    map.addSource("polygons", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: polygonFeatures,
      } as any,
    });

    map.addLayer({
      id: "polygon-fill",
      type: "fill",
      source: "polygons",
      paint: {
        "fill-opacity": 0.22,
      },
    });

    map.addLayer({
      id: "polygon-line",
      type: "line",
      source: "polygons",
      paint: {
        "line-width": 2,
      },
    });

    const pointFeatures: any[] = [];

    polygonPointsRef.current.forEach((pt, i) => {
      pointFeatures.push({
        type: "Feature",
        properties: {
          index: i,
          isCompleted: false,
        },
        geometry: { type: "Point", coordinates: pt },
      });
    });

    completedPolygonsRef.current.forEach((p, polygonIndex) => {
      p.points.forEach((pt, i) => {
        pointFeatures.push({
          type: "Feature",
          properties: {
            index: i,
            polygonIndex,
            isCompleted: true,
          },
          geometry: { type: "Point", coordinates: pt },
        });
      });
    });

    map.addSource("polygon-points", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: pointFeatures,
      } as any,
    });

    map.addLayer({
      id: "polygon-points",
      type: "circle",
      source: "polygon-points",
      paint: {
        "circle-radius": 5,
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
      },
    });

    map.addLayer({
      id: "polygon-points-clickable",
      type: "circle",
      source: "polygon-points",
      paint: {
        "circle-radius": 12,
        "circle-opacity": 0,
      },
    });
  }, [completedPolygonsRef, polygonPointsRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => renderPolygonLayers();
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [renderPolygonLayers, completedPolygons, polygonPoints]);


  const clearGuideline = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("polygon-guide")) map.removeLayer("polygon-guide");
    if (map.getSource("polygon-guide")) map.removeSource("polygon-guide");
  }, []);

  const renderGuideline = useCallback((e: maplibregl.MapMouseEvent) => {
    const map = mapRef.current;
    if (!map) return;

    const pts = polygonPointsRef.current;
    if (toolModeRef.current !== "addPoint" || pts.length === 0) {
      clearGuideline();
      return;
    }

    const last = pts[pts.length - 1];
    const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    const data = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [last, cursor],
          },
        },
      ],
    };

    if (!map.getSource("polygon-guide")) {
      map.addSource("polygon-guide", { type: "geojson", data: data as any });
      map.addLayer({
        id: "polygon-guide",
        type: "line",
        source: "polygon-guide",
        paint: {
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
    } else {
      (map.getSource("polygon-guide") as maplibregl.GeoJSONSource).setData(data as any);
    }
  }, [polygonPointsRef, toolModeRef, clearGuideline]);

  useEffect(() => {
    if (toolMode !== "addPoint") clearGuideline();
  }, [toolMode, clearGuideline]);


  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: maplibregl.MapMouseEvent) => {
      const activeTool = toolModeRef.current;

      if (activeTool === "none" && !isEditMode && mode === "map") {
        const features = map.queryRenderedFeatures(e.point, { layers: ["polygon-fill"] });
        if (features.length > 0) {
          const idx = Number(features[0].properties?.polygonIndex);
          if (!Number.isNaN(idx)) {
            setSelectedPolygonIndex(idx);
            setShowPolygonModal(true);
          }
        }
        return;
      }

      if (!isEditMode && activeTool !== "none") return;

      if (activeTool === "addCamera") {
        await addCamera(e.lngLat.lat, e.lngLat.lng);
        return;
      }

      if (activeTool === "addPoint") {
        if (polygonPointsRef.current.length >= 3) {
          const hit = map.queryRenderedFeatures(e.point, {
            layers: ["polygon-points", "polygon-points-clickable"],
          });

          if (hit.length > 0) {
            const props: any = hit[0].properties ?? {};
            const idx = Number(props.index);
            const isCompleted = props.isCompleted === true || props.isCompleted === "true";

            if (!isCompleted && idx === 0) {
              const newPoly: CompletedPolygon = {
                points: [...polygonPointsRef.current],
                cameraId: null,
              };
              setCompletedPolygons((prev) => [...prev, newPoly]);
              setPolygonPoints([]);
              clearGuideline();
              setShowSuccessNotification(true);
              window.setTimeout(() => setShowSuccessNotification(false), 900);
              return;
            }
          }
        }

        setPolygonPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
        return;
      }

      if (activeTool === "removePoint") {
        const hit = map.queryRenderedFeatures(e.point, {
          layers: ["polygon-points", "polygon-points-clickable"],
        });

        if (hit.length > 0) {
          const props: any = hit[0].properties ?? {};
          const idx = Number(props.index);
          const isCompleted = props.isCompleted === true || props.isCompleted === "true";
          if (!isCompleted && !Number.isNaN(idx)) {
            setPolygonPoints((prev) => prev.filter((_, i) => i !== idx));
          }
        }
      }
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isEditMode) return;
      if (toolModeRef.current === "addPoint") renderGuideline(e);
    };

    map.on("click", handleMapClick);
    map.on("mousemove", handleMouseMove);

    return () => {
      map.off("click", handleMapClick);
      map.off("mousemove", handleMouseMove);
    };
  }, [addCamera, clearGuideline, isEditMode, mode, renderGuideline, toolModeRef, polygonPointsRef]);


  useEffect(() => {
    const selected = selectedCameraId != null ? String(selectedCameraId) : null;
    for (const c of camerasRef.current) {
      const isSel = selected != null && String(c.id) === selected;
      c.element.style.color = isSel ? "#161b4c" : "#999";
      c.element.style.transform = isSel ? "scale(1.08)" : "scale(1)";
    }
  }, [selectedCameraId, cameras]);

  const beginAssignCamera = useCallback(() => {
    if (selectedPolygonIndexRef.current == null) return;
    setShowPolygonModal(false);
    setToolMode("assignCamera");
  }, [selectedPolygonIndexRef]);

  const cancelPolygonModal = useCallback(() => {
    setShowPolygonModal(false);
    setSelectedPolygonIndex(null);
    setToolMode("none");
  }, []);

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="map-wrap">
      <div ref={mapContainer} className="map" />

      {isEditMode && mode === "map" && (
        <div
          className="edit-toolbar"
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            gap: "8px",
            backgroundColor: "white",
            padding: "8px",
            borderRadius: "4px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          <button
            onClick={() => setToolMode((cur) => (cur === "addCamera" ? "none" : "addCamera"))}
            style={{
              padding: "8px 16px",
              backgroundColor: toolMode === "addCamera" ? "#4CAF50" : "white",
              color: toolMode === "addCamera" ? "white" : "black",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: toolMode === "addCamera" ? "bold" : "normal",
            }}
          >
            + Camera
          </button>

          <button
            onClick={() => setToolMode((cur) => (cur === "removeCamera" ? "none" : "removeCamera"))}
            style={{
              padding: "8px 16px",
              backgroundColor: toolMode === "removeCamera" ? "#f44336" : "white",
              color: toolMode === "removeCamera" ? "white" : "black",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: toolMode === "removeCamera" ? "bold" : "normal",
            }}
          >
            - Camera
          </button>

          <button
            onClick={() => setToolMode((cur) => (cur === "addPoint" ? "none" : "addPoint"))}
            style={{
              padding: "8px 16px",
              backgroundColor: toolMode === "addPoint" ? "#4CAF50" : "white",
              color: toolMode === "addPoint" ? "white" : "black",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: toolMode === "addPoint" ? "bold" : "normal",
            }}
          >
            + Polygon
          </button>

          <button
            onClick={() => setToolMode((cur) => (cur === "removePoint" ? "none" : "removePoint"))}
            style={{
              padding: "8px 16px",
              backgroundColor: toolMode === "removePoint" ? "#f44336" : "white",
              color: toolMode === "removePoint" ? "white" : "black",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: toolMode === "removePoint" ? "bold" : "normal",
            }}
          >
            - Point
          </button>
        </div>
      )}

      {isAssigningCamera && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            backgroundColor: "rgba(22, 27, 76, 0.7)",
            color: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            fontSize: "16px",
          }}
        >
          Click on the camera you want this polygon to be assigned
        </div>
      )}

      {showPolygonModal && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2000,
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            minWidth: "300px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "bold" }}>Polygon Options</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={beginAssignCamera}
              style={{
                padding: "12px",
                backgroundColor: "#161b4cff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Assign to Camera
            </button>

            <button
              onClick={cancelPolygonModal}
              style={{
                padding: "12px",
                backgroundColor: "#9e9e9e",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { ToggleEditButton };