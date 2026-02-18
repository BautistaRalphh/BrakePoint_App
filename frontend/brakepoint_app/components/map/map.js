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

export default function Map({ onCameraClick, onCameraAdd, onVisibleCamerasChange, selectedCameraId }) { 
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isAddingCamera, setIsAddingCamera] = useState(false);
    const [isRemovingCamera, setIsRemovingCamera] = useState(false);
    const [isAddingPoint, setIsAddingPoint] = useState(false);
    const [isRemovingPoint, setIsRemovingPoint] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [polygonPoints, setPolygonPoints] = useState([]);
    const [completedPolygons, setCompletedPolygons] = useState([]);
    const [selectedPolygonIndex, setSelectedPolygonIndex] = useState(null);
    const [isAssigningCamera, setIsAssigningCamera] = useState(false);
    const [showPolygonModal, setShowPolygonModal] = useState(false);
    const [showSuccessNotification, setShowSuccessNotification] = useState(false);
    const isRemovingCameraRef = useRef(false);
    const isAssigningCameraRef = useRef(false);
    const selectedPolygonIndexRef = useRef(null);
    const completedPolygonsRef = useRef([]);
    const camerasRef = useRef([]);
    const isLoadingCameras = useRef(false);
    
    const style = 'https://tiles.openfreemap.org/styles/liberty';
    const lng = 120.9842;
    const lat = 14.5995;
    const zoom = 10;

    const getAuthToken = () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('access_token');
        }
        return null;
    };

    useEffect(() => {
        isRemovingCameraRef.current = isRemovingCamera;
    }, [isRemovingCamera]);

    useEffect(() => {
        isAssigningCameraRef.current = isAssigningCamera;
        selectedPolygonIndexRef.current = selectedPolygonIndex;
    }, [isAssigningCamera, selectedPolygonIndex]);

    useEffect(() => {
        completedPolygonsRef.current = completedPolygons;
    }, [completedPolygons]);

    useEffect(() => {
        camerasRef.current.forEach(camera => {
            if (camera.element) {
                if (selectedCameraId === camera.id) {
                    camera.element.style.color = '#2196F3';
                } else {
                    camera.element.style.color = '#999';
                }
            }
        });
    }, [cameras, selectedCameraId]);

    useEffect(() => {
        camerasRef.current.forEach(camera => {
            if (camera.element) {
                if (selectedCameraId === camera.id) {
                    camera.element.style.color = '#2196F3';
                } else {
                    camera.element.style.color = '#999';
                }
            }
        });
        
        if (map.current) {
            renderPolygonLayers();
        }
    }, [selectedCameraId]);

    useEffect(() => {
        loadCamerasFromDatabase();
    }, []);

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

    const loadCamerasFromDatabase = async () => {
        if (isLoadingCameras.current) {
            return;
        }
        
        try {
            isLoadingCameras.current = true;
            
            const token = getAuthToken();
            if (!token) {
                isLoadingCameras.current = false;
                return;
            }
            
            const response = await fetch('http://127.0.0.1:8000/brakepoint/api/cameras/', {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.cameras) {
                    camerasRef.current.forEach(c => c.marker?.remove());
                    
                    setCameras([]);
                    camerasRef.current = [];
                    
                    const addCameras = () => {
                        data.cameras.forEach(cam => {
                            addCameraFromData(cam.lat, cam.lng, cam.id);
                        });
                        
                        // Load polygons from cameras
                        const polygons = data.cameras
                            .filter(cam => cam.polygon && cam.polygon.length > 0)
                            .map(cam => ({
                                points: cam.polygon,
                                cameraId: cam.id
                            }));
                        
                        if (polygons.length > 0) {
                            setTimeout(() => {
                                setCompletedPolygons(polygons);
                            }, 100);
                        }
                    };
                    
                    if (map.current && map.current.loaded()) {
                        addCameras();
                    } else if (map.current) {
                        map.current.once('load', addCameras);
                    }
                }
            } else {
                const errorText = await response.text();
            }
        } catch (error) {
        } finally {
            isLoadingCameras.current = false;
        }
    };

    const updateVisibleCameras = () => {
        if (!map.current || !onVisibleCamerasChange) return;
        
        const bounds = map.current.getBounds();
        const visibleCameras = camerasRef.current.filter(camera => {
            return bounds.contains([camera.lng, camera.lat]);
        });
        
        const visibleCameraIds = visibleCameras.map(c => c.id);
        onVisibleCamerasChange(visibleCameraIds);
    };

    useEffect(() => {
        if (!map.current) return;
        
        const handleMapUpdate = () => {
            updateVisibleCameras();
        };
        
        map.current.on('moveend', handleMapUpdate);
        map.current.on('zoomend', handleMapUpdate);
        
        if (map.current.loaded()) {
            updateVisibleCameras();
        } else {
            map.current.once('load', updateVisibleCameras);
        }
        
        return () => {
            if (map.current) {
                map.current.off('moveend', handleMapUpdate);
                map.current.off('zoomend', handleMapUpdate);
            }
        };
    }, [cameras]);

    const addCamera = async (lat, lng) => {
        try {
            const token = getAuthToken();
            if (!token) {
                return;
            }
            
            const response = await fetch('http://127.0.0.1:8000/brakepoint/api/cameras/', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    lat, 
                    lng
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.camera) {
                    addCameraFromData(data.camera.lat, data.camera.lng, data.camera.id);
                    
                    if (onCameraAdd) {
                        onCameraAdd(data.camera.id, data.camera.lat, data.camera.lng, data.camera);
                    }
                }
            }
        } catch (error) {
        }
    };

    const addCameraFromData = (lat, lng, id) => {
        const el = document.createElement('div');
        el.className = 'camera-marker';
        el.style.cursor = 'pointer';
        el.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" 
                      fill="currentColor" 
                      stroke="#fff" 
                      stroke-width="0.5"/>
            </svg>
        `;
        el.style.color = '#2196F3';
        el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
        
        const marker = new maplibregl.Marker({ element: el, draggable: false, anchor: 'center' }).setLngLat([lng, lat]).addTo(map.current);
        
        const cameraObj = { id, marker, lat, lng, element: el };
        
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isAssigningCameraRef.current && selectedPolygonIndexRef.current !== null) {
                const polygonIndex = selectedPolygonIndexRef.current;
                const polygon = completedPolygonsRef.current[polygonIndex];
                
                if (polygon) {
                    setCompletedPolygons(prev => prev.map((poly, idx) => 
                        idx === polygonIndex ? { ...poly, cameraId: id } : poly
                    ));
                    
                    savePolygonToCamera(id, polygon.points);
                    setIsAssigningCamera(false);
                    setSelectedPolygonIndex(null);
                    setShowPolygonModal(false);
                    setShowSuccessNotification(true);
                    setTimeout(() => setShowSuccessNotification(false), 3000);
                }
            } else if (isRemovingCameraRef.current) { 
                removeCamera(id); 
            } else if (onCameraClick) {
                onCameraClick(id);
            }
        });
        
        camerasRef.current = [...camerasRef.current, cameraObj];
        
        setCameras(prev => [...prev, cameraObj]);
    };

    const removeCamera = async (cameraId) => {
        try {
            const token = getAuthToken();
            if (!token) {
                return;
            }
            
            const response = await fetch(`http://127.0.0.1:8000/brakepoint/api/cameras/${cameraId}/`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const camera = camerasRef.current.find(c => c.id == cameraId);
                
                if (camera && camera.marker) {
                    const markerElement = camera.marker.getElement();
                    const markerParent = markerElement?.parentNode;
                    
                    if (markerElement && markerParent) {
                        markerParent.removeChild(markerElement);
                    }
                    
                    camera.marker.remove();
                }
                
                camerasRef.current = camerasRef.current.filter(c => c.id != cameraId);
                
                setCameras(prev => prev.filter(c => c.id != cameraId));
            }
        } catch (error) {
        }
    };
    
    const renderPolygonLayers = () => {
        if (!map.current) {
            return;
        }
        
        const layersToRemove = ['polygon-fill', 'polygon-line', 'polygon-points', 'polygon-points-clickable', 'polygon-guide'];
        const sourcesToRemove = ['polygon', 'polygon-points', 'polygon-guide'];
        layersToRemove.forEach(layer => { if (map.current.getLayer(layer)) { try { map.current.removeLayer(layer); } catch (e) {} } });
        sourcesToRemove.forEach(source => { if (map.current.getSource(source)) { try { map.current.removeSource(source); } catch (e) {} } });
        const polygonFeatures = [];
        const lineFeatures = [];
        const pointFeatures = [];
        completedPolygons.forEach((polygon, polygonIndex) => {
            if (!polygon.points || !Array.isArray(polygon.points)) {
                return;
            }
            
            polygonFeatures.push({
                type: 'Feature',
                properties: { polygonIndex: polygonIndex, cameraId: polygon.cameraId || null },
                geometry: { type: 'Polygon', coordinates: [[...polygon.points, polygon.points[0]]] }
            });
            polygon.points.forEach((coord, i) => {
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
            map.current.addLayer({ 
                id: 'polygon-fill', 
                type: 'fill', 
                source: 'polygon', 
                paint: { 
                    'fill-color': '#2196F3', 
                    'fill-opacity': [
                        'case',
                        ['==', ['get', 'cameraId'], null],
                        selectedCameraId === null ? 0.05 : 0.05,
                        ['==', ['get', 'cameraId'], selectedCameraId],
                        0.3,
                        0.05
                    ]
                } 
            });
            map.current.addLayer({ 
                id: 'polygon-line', 
                type: 'line', 
                source: 'polygon', 
                paint: { 
                    'line-color': '#1976D2', 
                    'line-width': 3,
                    'line-opacity': [
                        'case',
                        ['==', ['get', 'cameraId'], null],
                        selectedCameraId === null ? 0.2 : 0.2,
                        ['==', ['get', 'cameraId'], selectedCameraId],
                        1,
                        0.2
                    ]
                } 
            });
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
        } catch (err) { }
    };

    const clearGuideline = () => {
        if (!map.current) return;
        try {
            if (map.current.getLayer('polygon-guide')) { map.current.removeLayer('polygon-guide'); }
            if (map.current.getSource('polygon-guide')) { map.current.removeSource('polygon-guide'); }
        } catch (e) {}
    };

    const handleMapClick = (e) => {
        if (!isEditMode && !isAddingCamera && !isAddingPoint && !isRemovingPoint && !isRemovingCamera && !isAssigningCamera) {
            const features = map.current.queryRenderedFeatures(e.point, { layers: ['polygon-fill'] });
            if (features.length > 0) {
                const polygonIndex = features[0].properties.polygonIndex;
                setSelectedPolygonIndex(polygonIndex);
                setShowPolygonModal(true);
                return;
            }
        }
        
        if (isAddingCamera) {
            addCamera(e.lngLat.lat, e.lngLat.lng);
        } else if (isAddingPoint) {
            if (polygonPoints.length >= 3) {
                const features = map.current.queryRenderedFeatures(e.point, { layers: ['polygon-points', 'polygon-points-clickable'] });
                if (features.length > 0 && features[0].properties.index === 0 && !features[0].properties.isCompleted) {
                    setCompletedPolygons(prev => [...prev, { points: [...polygonPoints], cameraId: null }]);
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

    const savePolygonToCamera = async (cameraId, polygonPoints) => {
        try {
            const token = getAuthToken();
            if (!token) {
                return;
            }
            
            await fetch(`http://127.0.0.1:8000/brakepoint/api/cameras/${cameraId}/polygon/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ polygon: polygonPoints })
            });
        } catch (error) {
        }
    };

    const handleAssignCamera = () => {
        setShowPolygonModal(false);
        setIsAssigningCamera(true);
    };

    const handleDeletePolygon = () => {
        if (selectedPolygonIndex !== null) {
            const polygon = completedPolygons[selectedPolygonIndex];
            
            if (polygon.cameraId) {
                savePolygonToCamera(polygon.cameraId, null);
            }
            
            setCompletedPolygons(prev => prev.filter((_, idx) => idx !== selectedPolygonIndex));
            setSelectedPolygonIndex(null);
            setShowPolygonModal(false);
        }
    };

    const handleCloseModal = () => {
        setShowPolygonModal(false);
        setSelectedPolygonIndex(null);
        setIsAssigningCamera(false);
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
        else if (isAssigningCamera) {
            canvas.style.cursor = 'pointer';
        }
        
        map.current.on('click', handleMapClick);
        
        if (isAddingPoint) { map.current.on('mousemove', handleMouseMove); }
        else { clearGuideline(); }
        return () => {
            if (map.current) {
                map.current.off('click', handleMapClick);
                map.current.off('mousemove', handleMouseMove);
            }
        };
    }, [isAddingCamera, isRemovingCamera, isAddingPoint, isRemovingPoint, isAssigningCamera, isEditMode, polygonPoints, completedPolygons]);

    useEffect(() => { 
        if (map.current) {
            renderPolygonLayers();
        }
    }, [polygonPoints, completedPolygons, selectedCameraId]);

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
            {isAssigningCamera && (
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000, backgroundColor: 'rgba(22, 27, 76, 0.7)', color: 'white', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: '16px'}}>
                    Click on the camera you want this polygon to be assigned
                </div>
            )}
            {showSuccessNotification && (
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000, backgroundColor: 'rgba(76, 175, 80, 0.7)', color: 'white', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>✓</span>
                    Success!
                </div>
            )}
            {showPolygonModal && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2000, backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: '300px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>Polygon Options</h3>
                    {isAssigningCamera ? (
                        <p style={{ margin: '0 0 16px 0', color: '#666' }}>Click on a camera to assign it to this polygon</p>
                    ) : (
                        <p style={{ margin: '0 0 16px 0', color: '#666' }}>
                            {selectedPolygonIndex !== null && completedPolygons[selectedPolygonIndex]?.cameraId 
                                ? `Assigned to Camera ${completedPolygons[selectedPolygonIndex].cameraId}` 
                                : 'No camera assigned'}
                        </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!isAssigningCamera && (
                            <>
                                <button onClick={handleAssignCamera} style={{ padding: '12px', backgroundColor: '#161b4cff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                                    {selectedPolygonIndex !== null && completedPolygons[selectedPolygonIndex]?.cameraId ? 'Reassign Camera' : 'Assign to Camera'}
                                </button>
                                <button onClick={handleDeletePolygon} style={{ padding: '12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Delete Polygon</button>
                                <button onClick={handleCloseModal} style={{ padding: '12px', backgroundColor: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                            </>
                        )}
                        {isAssigningCamera && (
                            <button onClick={handleCloseModal} style={{ padding: '12px', backgroundColor: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export { toggleEditButton };