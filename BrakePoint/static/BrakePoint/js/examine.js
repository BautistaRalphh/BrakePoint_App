document.addEventListener('DOMContentLoaded', function () {
    // Initialize map
    const map = L.map('map', {
        center: [14.5995, 120.9842],
        zoom: 10,
        zoomControl: false // Disable default position
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Search function
    function searchLocation() {
        const query = document.getElementById('search-input').value;
        if (!query) {
            alert('Please enter a location to search');
            return;
        }

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    // Move map to location
                    map.setView([lat, lon], 15);

                } else {
                    alert('Location not found. Please try a different search.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error searching for location.');
            });
    }

    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    if (searchBtn) searchBtn.addEventListener('click', searchLocation);
    if (searchInput) searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') searchLocation();
    });
});