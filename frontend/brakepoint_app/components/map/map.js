'use client';

import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
import ModeEditIcon from '@mui/icons-material/ModeEdit';

class toggleEditButton {
    constructor(onToggle) {
        this._onToggle = onToggle;
        this._container = null;
        this._isEditMode = false;
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const editButton = document.createElement('button');
        editButton.title = 'Toggle Edit Mode';
        ReactDOM.createRoot(editButton).render(<ModeEditIcon sx={{width: 16}} />);
        editButton.onclick = () => {
            this._isEditMode = !this._isEditMode;
            editButton.style.backgroundColor = this._isEditMode ? '#e0e4e9ff' : '';
            this._onToggle(this._isEditMode);
        };
        this._container.appendChild(editButton);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

export default function Map({ cameraLocations = [], onCameraClick, onCameraAdd }) { 
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isAddingCamera, setIsAddingCamera] = useState(false);
    const [isRemovingCamera, setIsRemovingCamera] = useState(false);
    const [isAddingPoint, setIsAddingPoint] = useState(false);
    const [isRemovingPoint, setIsRemovingPoint] = useState(false);
    const [cameras, setCameras] = useState([]);
    const cameraIdCounter = useRef(0);
    const [polygonPoints, setPolygonPoints] = useState([]);
    const [completedPolygons, setCompletedPolygons] = useState([]);
    const isRemovingCameraRef = useRef(false);
    
    const style = 'https://tiles.openfreemap.org/styles/liberty';
    const lng = 120.9842;
    const lat = 14.5995;
    const zoom = 10;
    
    const onCameraClickRef = useRef(onCameraClick);
    const onCameraAddRef = useRef(onCameraAdd); 
    
    useEffect(() => {
        onCameraClickRef.current = onCameraClick;
        onCameraAddRef.current = onCameraAdd;
    }, [onCameraClick, onCameraAdd]);

    useEffect(() => {
        if (!map.current) return; 

        const addInitialCameras = () => {
            cameras.forEach(c => c.marker.remove());
            setCameras([]);
            cameraLocations.forEach(data => addCameraFromData(data.lat, data.lng, data.id));
        };
        
        if (map.current.loaded()) {
            addInitialCameras();
        } else if (map.current) {
            map.current.once('load', addInitialCameras);
        }
    }, [mapContainer.current, cameraLocations]); 

    useEffect(() => {
        if (map.current) return;
        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: style,
            center: [lng, lat],
            zoom: zoom,
            pitch: 45,
            bearing: 0,
            antialias: true,
            maxPitch: 85,
            hash: false,
            trackResize: true,
            preserveDrawingBuffer: false,
            refreshExpiredTiles: false,
            fadeDuration: 0
        });
        map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
        const editToggle = new toggleEditButton(setIsEditMode);
        map.current.addControl(editToggle, 'bottom-right');
        
        loadCamerasFromStorage(); 

        map.current.on('load', () => {
            const layers = map.current.getStyle().layers;
            let firstSymbolId;
            for (const layer of layers) {
                if (layer.type === 'symbol') { firstSymbolId = layer.id; break; }
            }
            map.current.addLayer({
                'id': '3d-buildings',
                'source': 'openmaptiles',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#aaa',
                    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_height']],
                    'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_min_height']],
                    'fill-extrusion-opacity': 0.6
                }
            }, firstSymbolId);
        });
    }, []);

    const addCamera = (lat, lng) => {
        const id = cameraIdCounter.current++;
        const el = document.createElement('div');
        el.className = 'camera-marker';
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#2196F3';
        el.style.border = '1px solid #000';
        el.style.cursor = 'pointer';
        const marker = new maplibregl.Marker({ element: el, draggable: false }).setLngLat([lng, lat]).addTo(map.current);
        
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onCameraClickRef.current) {
                onCameraClickRef.current(id);
            }
            if (isRemovingCameraRef.current) { removeCamera(id); }
        });
        
        const newCamera = { id, marker, lat, lng };
        
        if (onCameraAddRef.current) {
             onCameraAddRef.current(id, lat, lng); 
        }
        
        setCameras(prev => {
            const updated = [...prev, newCamera];
            saveCamerasToStorage(updated);
            return updated;
        });
    };

    const addCameraFromData = (lat, lng, id) => {
        const el = document.createElement('div');
        el.className = 'camera-marker';
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#2196F3';
        el.style.border = '1px solid #000';
        el.style.cursor = 'pointer';
        const marker = new maplibregl.Marker({ element: el, draggable: false }).setLngLat([lng, lat]).addTo(map.current);
        
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onCameraClickRef.current) {
                onCameraClickRef.current(id); 
            }
            if (isRemovingCameraRef.current) { removeCamera(id); }
        });
        
        setCameras(prev => [...prev, { id, marker, lat, lng }]);
    };

    const removeCamera = (cameraId) => {
        setCameras(prev => {
            const camera = prev.find(c => c.id === cameraId);
            if (camera) { camera.marker.remove(); }
            const updated = prev.filter(c => c.id !== cameraId);
            saveCamerasToStorage(updated);
            return updated;
        });
    };

    const saveCamerasToStorage = (cameraList) => {
        const data = cameraList.map(c => ({ id: c.id, lat: c.lat, lng: c.lng }));
        localStorage.setItem('mapCameras', JSON.stringify(data));
    };

    const loadCamerasFromStorage = () => {
        const saved = localStorage.getItem('mapCameras');
        if (!saved) return;
        try {
            const data = JSON.parse(saved);
            const addCameras = () => {
                data.forEach(d => addCameraFromData(d.lat, d.lng, d.id));
                if (data.length) { cameraIdCounter.current = Math.max(...data.map(c => c.id)) + 1; }
            };
            if (map.current && map.current.loaded()) {
                addCameras();
            } else if (map.current) {
                map.current.once('load', addCameras);
            }
        } catch (err) { console.error('Failed to load cameras:', err); }
    };
    
    const renderPolygonLayers = () => {
        if (!map.current || !map.current.loaded()) return;
        const layersToRemove = ['polygon-fill', 'polygon-line', 'polygon-points', 'polygon-points-clickable', 'polygon-guide'];
        const sourcesToRemove = ['polygon', 'polygon-points', 'polygon-guide'];
        layersToRemove.forEach(layer => { if (map.current.getLayer(layer)) { try { map.current.removeLayer(layer); } catch (e) {} } });
        sourcesToRemove.forEach(source => { if (map.current.getSource(source)) { try { map.current.removeSource(source); } catch (e) {} } });
        const polygonFeatures = [];
        const lineFeatures = [];
        const pointFeatures = [];
        completedPolygons.forEach((polygon) => {
            polygonFeatures.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[...polygon, polygon[0]]] }
            });
            polygon.forEach((coord, i) => {
                pointFeatures.push({
                    type: 'Feature',
                    properties: { index: i, isCompleted: true },
                    geometry: { type: 'Point', coordinates: coord }
                });
            });
        });
        if (polygonPoints.length >= 2) {
            lineFeatures.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: polygonPoints }
            });
        }
        polygonPoints.forEach((coord, i) => {
            pointFeatures.push({
                type: 'Feature',
                properties: { index: i, isCompleted: false },
                geometry: { type: 'Point', coordinates: coord }
            });
        });
        if (polygonFeatures.length > 0) {
            map.current.addSource('polygon', { type: 'geojson', data: { type: 'FeatureCollection', features: polygonFeatures } });
            map.current.addLayer({ id: 'polygon-fill', type: 'fill', source: 'polygon', paint: { 'fill-color': '#2196F3', 'fill-opacity': 0.3 } });
            map.current.addLayer({ id: 'polygon-line', type: 'line', source: 'polygon', paint: { 'line-color': '#1976D2', 'line-width': 3 } });
        } else if (lineFeatures.length > 0) {
            map.current.addSource('polygon', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
            map.current.addLayer({ id: 'polygon-line', type: 'line', source: 'polygon', paint: { 'line-color': '#2196F3', 'line-width': 3 } });
        }
        if (pointFeatures.length > 0) {
            map.current.addSource('polygon-points', { type: 'geojson', data: { type: 'FeatureCollection', features: pointFeatures } });
            map.current.addLayer({ id: 'polygon-points-clickable', type: 'circle', source: 'polygon-points', paint: { 'circle-radius': 20, 'circle-color': 'transparent', 'circle-opacity': 0 } });
            map.current.addLayer({ id: 'polygon-points', type: 'circle', source: 'polygon-points', paint: { 'circle-radius': ['case', ['all', ['==', ['get', 'index'], 0], ['==', ['get', 'isCompleted'], false], ['>=', ['literal', polygonPoints.length], 3]], 14, 9], 'circle-color': '#2196F3', 'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['all', ['==', ['get', 'index'], 0], ['==', ['get', 'isCompleted'], false], ['>=', ['literal', polygonPoints.length], 3]], 4, 3] } });
        }
    };

    const renderGuideline = (e) => {
        if (!map.current || !map.current.loaded() || !isAddingPoint) return;
        try {
            if (polygonPoints.length === 0) {
                const guideData = { type: 'Feature', geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] } };
                if (map.current.getSource('polygon-guide')) {
                    if (map.current.getLayer('polygon-guide')) { map.current.removeLayer('polygon-guide'); }
                    map.current.removeSource('polygon-guide');
                }
                map.current.addSource('polygon-guide', { type: 'geojson', data: guideData });
                map.current.addLayer({ id: 'polygon-guide', type: 'circle', source: 'polygon-guide', paint: { 'circle-radius': 6, 'circle-color': '#2196F3', 'circle-opacity': 0.5 } });
            } else {
                const lastPoint = polygonPoints[polygonPoints.length - 1];
                const guideData = { type: 'Feature', geometry: { type: 'LineString', coordinates: [lastPoint, [e.lngLat.lng, e.lngLat.lat]] } };
                if (map.current.getSource('polygon-guide')) {
                    if (map.current.getLayer('polygon-guide')) { map.current.removeLayer('polygon-guide'); }
                    map.current.removeSource('polygon-guide');
                }
                map.current.addSource('polygon-guide', { type: 'geojson', data: guideData });
                map.current.addLayer({ id: 'polygon-guide', type: 'line', source: 'polygon-guide', paint: { 'line-color': '#2196F3', 'line-width': 2, 'line-dasharray': [3, 3], 'line-opacity': 0.7 } });
            }
        } catch (err) { console.error('Error rendering guideline:', err); }
    };

    const clearGuideline = () => {
        if (!map.current) return;
        try {
            if (map.current.getLayer('polygon-guide')) { map.current.removeLayer('polygon-guide'); }
            if (map.current.getSource('polygon-guide')) { map.current.removeSource('polygon-guide'); }
        } catch (e) {}
    };

    const handleMapClick = (e) => {
        if (isAddingCamera) {
            addCamera(e.lngLat.lat, e.lngLat.lng);
        } else if (isAddingPoint) {
            if (polygonPoints.length >= 3) {
                const features = map.current.queryRenderedFeatures(e.point, { layers: ['polygon-points', 'polygon-points-clickable'] });
                if (features.length > 0 && features[0].properties.index === 0 && !features[0].properties.isCompleted) {
                    setCompletedPolygons(prev => [...prev, [...polygonPoints]]);
                    setPolygonPoints([]);
                    return;
                }
            }
            const coords = [e.lngLat.lng, e.lngLat.lat];
            setPolygonPoints(prev => [...prev, coords]);
        } else if (isRemovingPoint) {
            const features = map.current.queryRenderedFeatures(e.point, { layers: ['polygon-points', 'polygon-points-clickable'] });
            if (features.length > 0 && !features[0].properties.isCompleted) {
                const clickedIndex = features[0].properties.index;
                setPolygonPoints(prev => prev.filter((_, i) => i !== clickedIndex));
            }
        }
    };

    const handleMouseMove = (e) => {
        if (isAddingPoint) { renderGuideline(e); }
    };

    const startAddingCamera = () => { setIsAddingCamera(true); setIsRemovingCamera(false); setIsAddingPoint(false); setIsRemovingPoint(false); isRemovingCameraRef.current = false; };
    const stopAddingCamera = () => { setIsAddingCamera(false); };
    const startRemovingCamera = () => { setIsRemovingCamera(true); setIsAddingCamera(false); setIsAddingPoint(false); setIsRemovingPoint(false); isRemovingCameraRef.current = true; };
    const stopRemovingCamera = () => { setIsRemovingCamera(false); isRemovingCameraRef.current = false; };
    const startAddingPoint = () => { setIsAddingPoint(true); setIsRemovingPoint(false); setIsAddingCamera(false); setIsRemovingCamera(false); };
    const stopAddingPoint = () => { setIsAddingPoint(false); clearGuideline(); };
    const startRemovingPoint = () => { setIsRemovingPoint(true); setIsAddingPoint(false); setIsAddingCamera(false); setIsRemovingCamera(false); };
    const stopRemovingPoint = () => { setIsRemovingPoint(false); };

    useEffect(() => {
        if (!map.current) return;
        map.current.off('click', handleMapClick);
        map.current.off('mousemove', handleMouseMove);
        
        const canvas = map.current.getCanvas();
        canvas.classList.remove('map-crosshair', 'map-remove');
        
        if (isAddingCamera || isAddingPoint) { 
            canvas.classList.add('map-crosshair');
        }
        else if (isRemovingCamera || isRemovingPoint) { 
            canvas.classList.add('map-remove');
        }
        
        if (isAddingCamera || isAddingPoint || isRemovingPoint) { map.current.on('click', handleMapClick); }
        if (isAddingPoint) { map.current.on('mousemove', handleMouseMove); }
        else { clearGuideline(); }
        return () => {
            if (map.current) {
                map.current.off('click', handleMapClick);
                map.current.off('mousemove', handleMouseMove);
            }
        };
    }, [isAddingCamera, isRemovingCamera, isAddingPoint, isRemovingPoint, polygonPoints, completedPolygons]);

    useEffect(() => { renderPolygonLayers(); }, [polygonPoints, completedPolygons]);

    useEffect(() => {
        if (!isEditMode) {
            stopAddingCamera(); stopRemovingCamera(); stopAddingPoint(); stopRemovingPoint();
        }
    }, [isEditMode]);

    return (
        <div className="map-wrap">
            <div ref={mapContainer} className="map" />
            {isEditMode && (
                <div className="edit-toolbar" style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: '8px', backgroundColor: 'white', padding: '8px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    <button onClick={() => { if (isAddingCamera) { stopAddingCamera(); } else { startAddingCamera(); } }} style={{ padding: '8px 16px', backgroundColor: isAddingCamera ? '#4CAF50' : 'white', color: isAddingCamera ? 'white' : 'black', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: isAddingCamera ? 'bold' : 'normal' }}>+ Camera</button>
                    <button onClick={() => { if (isRemovingCamera) { stopRemovingCamera(); } else { startRemovingCamera(); } }} style={{ padding: '8px 16px', backgroundColor: isRemovingCamera ? '#f44336' : 'white', color: isRemovingCamera ? 'white' : 'black', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: isRemovingCamera ? 'bold' : 'normal' }}>- Camera</button>
                    <button onClick={() => { if (isAddingPoint) { stopAddingPoint(); } else { startAddingPoint(); } }} style={{ padding: '8px 16px', backgroundColor: isAddingPoint ? '#4CAF50' : 'white', color: isAddingPoint ? 'white' : 'black', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: isAddingPoint ? 'bold' : 'normal' }}>+ Point</button>
                    <button onClick={() => { if (isRemovingPoint) { stopRemovingPoint(); } else { startRemovingPoint(); } }} style={{ padding: '8px 16px', backgroundColor: isRemovingPoint ? '#f44336' : 'white', color: isRemovingPoint ? 'white' : 'black', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: isRemovingPoint ? 'bold' : 'normal' }}>- Point</button>
                </div>
            )}
        </div>
    );
}

export { toggleEditButton };