'use client';

import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';


import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';

import ModeEditIcon from '@mui/icons-material/ModeEdit';
import PolylineIcon from '@mui/icons-material/Polyline';
import PolylineOutlinedIcon from '@mui/icons-material/PolylineOutlined';

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

        const editToggle = new toggleEditButton(setIsEditMode);
        const addPolygonNode = new addPolygonNodeButton();
        const deletePolygonNode = new deletePolygonNodeButton();

        map.current.addControl(editToggle, 'bottom-right');
        map.current.addControl(addPolygonNode, 'bottom-right');
        map.current.addControl(deletePolygonNode, 'bottom-right');

    }, [lng, lat, zoom]);

    console.log(isEditMode);

    return (
      <div className="map-wrap">
        <div ref={mapContainer} className="map" />
      </div>

    );

}

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

    ReactDOM.createRoot(editButton).render(
      <ModeEditIcon sx={{width: 16}} />
    );

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

class addPolygonNodeButton {
  constructor() {

  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const addPolygonNodeButton = document.createElement('button');
    addPolygonNodeButton.title = 'Add Polygon Node';

    ReactDOM.createRoot(addPolygonNodeButton).render(
      <PolylineIcon sx={{width: 16}} />
    );

    addPolygonNodeButton.onclick = () => {
      addPolygonNodeButton.style.backgroundColor = '#e0e4e9ff';
    };

    this._container.appendChild(addPolygonNodeButton);
    return this._container;
  }

}

class deletePolygonNodeButton {
  constructor() {

  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const deletePolygonNodeButton = document.createElement('button');
    deletePolygonNodeButton.title = 'Add Polygon Node';

    ReactDOM.createRoot(deletePolygonNodeButton).render(
      <PolylineOutlinedIcon sx={{width: 16}} />
    );

    deletePolygonNodeButton.onclick = () => {
      deletePolygonNodeButton.style.backgroundColor = '#e0e4e9ff';
    };

    this._container.appendChild(deletePolygonNodeButton);
    return this._container;
  }
}

class addFeedButton {
  constructor() {

  }
}

class deleteFeedButton {
  constructor() {

  }
}
