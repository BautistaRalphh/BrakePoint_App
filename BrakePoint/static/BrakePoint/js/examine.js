document.addEventListener('DOMContentLoaded', function () {
    // Initialize map
    const map = L.map('map', {
        center: [14.5995, 120.9842],
        zoom: 10,
        zoomControl: false 
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create suggestions dropdown
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'search-suggestions';
    suggestionsContainer.id = 'search-suggestions';

    // Add suggestions container after the search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        console.log('Search input found:', searchInput);
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';
        const parent = searchInput.parentNode;
        parent.insertBefore(wrapper, searchInput);
        wrapper.appendChild(searchInput);
        wrapper.appendChild(suggestionsContainer);
        
        console.log('Suggestions container added:', suggestionsContainer);
    } else {
        console.error('Search input not found!');
    }

    let debounceTimer;
    let currentSuggestions = [];

    // Fetch suggestions from Nominatim
    function fetchSuggestions(query) {
        if (query.length < 3) {
            hideSuggestions();
            return;
        }

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                currentSuggestions = data;
                showSuggestions(data);
            })
            .catch(error => {
                console.error('Error fetching suggestions:', error);
            });
    }

    // Show suggestions dropdown
    function showSuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        if (suggestions.length === 0) {
            hideSuggestions();
            return;
        }

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';

            // Format display name
            const displayName = suggestion.display_name;
            const parts = displayName.split(',');
            const mainName = parts[0];
            const details = parts.slice(1, 3).join(',');

            item.innerHTML = `
                <div class="suggestion-main">${mainName}</div>
                <div class="suggestion-details">${details}</div>
            `;

            item.addEventListener('click', () => {
                selectSuggestion(suggestion);
            });

            suggestionsContainer.appendChild(item);
        });

        suggestionsContainer.style.display = 'block';
    }

    function hideSuggestions() {
        suggestionsContainer.style.display = 'none';
    }

    // Select a suggestion
    function selectSuggestion(suggestion) {
        searchInput.value = suggestion.display_name.split(',')[0];
        hideSuggestions();
        
        const lat = parseFloat(suggestion.lat);
        const lon = parseFloat(suggestion.lon);
        
        // Zoom to location
        map.setView([lat, lon], 24);
    }

    // Search function
    function searchLocation() {
        const query = searchInput.value;
        if (!query) {
            return; 
        }

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);
                    
                    // Zoom to location
                    map.setView([lat, lon], 17);
                } else {
                    console.log('Location not found for:', query);
                }
            })
            .catch(error => {
                console.error('Error searching:', error);
            });
    }
    
    if (searchInput) {
        // Input event for live suggestions
        searchInput.addEventListener('input', function (e) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchSuggestions(e.target.value);
            }, 300);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                hideSuggestions();
                searchLocation();
            } else if (e.key === 'Escape') {
                hideSuggestions();
            }
        });

        document.addEventListener('click', function (e) {
            if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                hideSuggestions();
            }
        });
    }

    // Selection box functionality
    let isSelecting = false;
    let selectionBox = null;
    let startPoint = null;

    // Listen for 's' key press
    document.addEventListener('keydown', function (e) {
        if (e.key.toLowerCase() === 's' && !isSelecting && !searchInput.contains(document.activeElement)) {
            e.preventDefault();
            startSelectionMode();
        }
    });

    function startSelectionMode() {
        // Change cursor to crosshair
        map.getContainer().style.cursor = 'crosshair';
        
        // Add temporary instruction text
        const instruction = document.createElement('div');
        instruction.id = 'selection-instruction';
        instruction.innerHTML = 'Click and drag to select area to zoom into';
        instruction.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
        `;
        document.body.appendChild(instruction);

        setTimeout(() => {
            const inst = document.getElementById('selection-instruction');
            if (inst) inst.remove();
        }, 3000);

        const mapContainer = map.getContainer();
        
        mapContainer.addEventListener('mousedown', onMouseDown);
        mapContainer.addEventListener('mousemove', onMouseMove);
        mapContainer.addEventListener('mouseup', onMouseUp);
        
        map.dragging.disable();
    }

    function onMouseDown(e) {
        if (e.button !== 0) return; 
        
        isSelecting = true;
        startPoint = { x: e.clientX, y: e.clientY };

        // Create selection box
        selectionBox = document.createElement('div');
        selectionBox.style.cssText = `
            position: fixed;
            border: 2px solid #00ff00;
            background: rgba(0, 255, 0, 0.1);
            z-index: 9998;
            pointer-events: none;
        `;
        document.body.appendChild(selectionBox);

        e.preventDefault();
    }

    function onMouseMove(e) {
        if (!isSelecting || !selectionBox) return;

        const currentPoint = { x: e.clientX, y: e.clientY };
        
        const left = Math.min(startPoint.x, currentPoint.x);
        const top = Math.min(startPoint.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }

    function onMouseUp(e) {
        if (!isSelecting || !selectionBox) return;

        const currentPoint = { x: e.clientX, y: e.clientY };
        
        const left = Math.min(startPoint.x, currentPoint.x);
        const top = Math.min(startPoint.y, currentPoint.y);
        const right = Math.max(startPoint.x, currentPoint.x);
        const bottom = Math.max(startPoint.y, currentPoint.y);

        // Convert screen coordinates to map coordinates
        const mapContainer = map.getContainer();
        const mapRect = mapContainer.getBoundingClientRect();
        
        const topLeft = map.containerPointToLatLng([left - mapRect.left, top - mapRect.top]);
        const bottomRight = map.containerPointToLatLng([right - mapRect.left, bottom - mapRect.top]);

        // Only zoom if selection is large enough (at least 20x20 pixels)
        if (Math.abs(right - left) > 20 && Math.abs(bottom - top) > 20) {
            map.fitBounds([
                [bottomRight.lat, topLeft.lng],  
                [topLeft.lat, bottomRight.lng]   
            ]);
        }

        endSelectionMode();
    }

    function endSelectionMode() {
        isSelecting = false;
        
        // Remove selection box
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }

        const instruction = document.getElementById('selection-instruction');
        if (instruction) instruction.remove();

        map.getContainer().style.cursor = '';

        // Remove event listeners
        const mapContainer = map.getContainer();
        mapContainer.removeEventListener('mousedown', onMouseDown);
        mapContainer.removeEventListener('mousemove', onMouseMove);
        mapContainer.removeEventListener('mouseup', onMouseUp);

        // Re-enable map dragging
        map.dragging.enable();

        startPoint = null;
    }

    // End selection mode on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isSelecting) {
            endSelectionMode();
        }
    });
});