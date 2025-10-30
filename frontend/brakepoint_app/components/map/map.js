'use client';

import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';

export default function Map() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [isEditMode, setIsEditMode] = useState(false);
    
    const style = 'https://tiles.openfreemap.org/styles/bright';
    const lng = 120.9842;
    const lat = 14.5995
    const zoom = 10;
    
    useEffect(() => {
        if (map.current) return; // stops map from intializing more than once

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: style,
            center: [lng, lat],
            zoom: zoom
        });

        map.current.addControl(new maplibregl.NavigationControl({
            visualizePitch: true 
        }), 'bottom-right');

    }, [lng, lat, zoom]);


    return (
    <div className="map-wrap">
      <div ref={mapContainer} className="map" />
    </div>
  );

}

class editToggleButton {

}

