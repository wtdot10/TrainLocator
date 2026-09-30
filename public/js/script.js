const socket = io();

const searchInput = document.getElementById("search-input");
const trainList = document.getElementById("trainList");
let selectedTrain = "";
let watchId = null;

// Initial map position set to Bangladesh center coordinates
const map = L.map("map").setView([23.6850, 90.3563], 16);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

const esri = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles © Esri — Source: Esri, USGS, NOAA",
        maxZoom: 20
    }
);

osm.addTo(map);

// User location marker tracking
let userMarker = null;

// Custom pulse/blue icon for user location
const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: '<div class="user-dot"></div>'
});

// Helper function to render/update the "Your Location" marker
function updateUserMarker(lat, lng) {
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        userMarker = L.marker([lat, lng], { icon: userIcon })
            .addTo(map)
            .bindPopup("<b>📍 Your Location</b>");
    }
}

// Try centering map on the user's initial location
// Fetch initial user location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            updateUserMarker(userLat, userLng);

            // Focus map on user location if no train has been selected yet
            if (!selectedTrain) {
                map.setView([userLat, userLng], 13);
            }
        },
        (error) => {
            console.warn("Could not retrieve initial user location, using default center.", error.message);
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000
        }
    );
};

const baseMaps = {
    "OpenStreetMap": osm,
    "Esri World Imagery": esri
};

const overlayMaps = {};
const layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);

const markers = {};
const trainPaths = {};
const routeLines = {};
const hasCenteredMap = {};

document.querySelectorAll("#trainList li").forEach(item => {
    item.addEventListener("click", () => {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        selectedTrain = item.textContent.trim();
        searchInput.value = selectedTrain;
        trainList.style.display = "none";

        startLocationSharing();
    });
});

searchInput.addEventListener("focus", () => {
    trainList.style.display = "block";
});

searchInput.addEventListener("keyup", () => {
    const value = searchInput.value.toLowerCase();
    document.querySelectorAll("#trainList li").forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(value) ? "block" : "none";
    });
});

function startLocationSharing() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            updateUserMarker(position.coords.latitude, position.coords.longitude);
            socket.emit("trainLocation", {
                trainName: selectedTrain,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0 // speed in km/h
            });
        },
        (error) => {
            console.error("Geolocation error:", error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );
}

socket.on('trainUpdate', (data) => {
    const id = data.trainName;

    let confidence = "Low";
    if (data.passengerCount >= 10) confidence = "High";
    else if (data.passengerCount >= 3) confidence = "Medium";

    const popupContent = `
        <div>
            <h3>🚆 ${data.trainName}</h3>
            <p><strong>Delay:</strong> ${data.delay || 'On Time'}</p>
            <p><strong>Speed:</strong> ${ Math.round(data.speed * 3.6) || 0} km/h</p>
            <p><strong>Next Station:</strong> ${data.nextStation || 'Final Stop'}</p>
            <p><strong>Active Trackers:</strong> <span id="count-${id}">${data.passengerCount || 1}</span></p>
            <p><strong>Confidence:</strong> ${confidence}</p>
            <p class="last-update" data-timestamp="${data.updatedAt}">
                🕒 Updated ${timeAgo(data.updatedAt)}
            </p>
        </div>`;

    if (!trainPaths[id]) {
        trainPaths[id] = [];
        routeLines[id] = L.polyline([], {
            color: getTrainColor(id),
            weight: 4
        }).addTo(map);

        overlayMaps[id] = routeLines[id];
        layerControl.addOverlay(routeLines[id], `🚆 ${id}`);
    }

    trainPaths[id].push([data.latitude, data.longitude]);
    routeLines[id].setLatLngs(trainPaths[id]);

    // Center map only once for the user's selected train
    if (id === selectedTrain && !hasCenteredMap[id]) {
        map.setView([data.latitude, data.longitude], 14);
        hasCenteredMap[id] = true;
    }

    if (markers[id]) {
        markers[id].setLatLng([data.latitude, data.longitude]);
        markers[id].setPopupContent(popupContent);
    } else {
        markers[id] = L.marker([data.latitude, data.longitude],
            {icon: createTrainIcon(data.trainName)})
            .addTo(map)
            .bindPopup(popupContent);
    }
});

socket.on('passengerCountUpdate', (data) => {
    const countElement = document.getElementById(`count-${data.trainName}`);
    if (countElement) {
        countElement.textContent = data.passengerCount;
    }
});

// Request persistent locations from server as soon as connected
socket.on('connect', () => {
    socket.emit('getInitialTrainLocations');
});

function timeAgo(timestamp) {
    if (!timestamp) return "Just now";
    const time = Number(timestamp);
    if (isNaN(time)) return "Just now";

    const seconds = Math.floor((Date.now() - time) / 1000);

    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds} sec ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day ago`;
}

function getTrainColor(trainName) {
    const colors = {
        "Subarna Express": "red",
        "Parabat Express": "blue",
        "Ekota Express": "green",
        "Tista Express": "orange"
    };
    return colors[trainName] || "purple";
}

function createTrainIcon(trainName) {
return L.divIcon({
className: '',
html: `
<div class="train-marker">
<div class="train-icon">🚆</div>
<div class="train-label">${trainName}</div>
</div>
`,
iconSize: [120, 40],
iconAnchor: [20, 20]
});
}


setInterval(() => {
    document.querySelectorAll(".last-update").forEach(el => {
        const ts = Number(el.dataset.timestamp);
        el.textContent = `🕒 Updated ${timeAgo(ts)}`;
    });
}, 1000);