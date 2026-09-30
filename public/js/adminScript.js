let currentTrainId = null;
        let masterStations = [];

        // Load Master Stations on page startup
        async function fetchMasterStations() {
            const res = await fetch('/admin/api/stations');
            masterStations = await res.json();
        }
        fetchMasterStations();

        // Add Master Station to DB
        async function addMasterStation(e) {
            e.preventDefault();
            const body = {
                stationName: document.getElementById("m-name").value,
                stationCode: document.getElementById("m-code").value,
                latitude: document.getElementById("m-lat").value,
                longitude: document.getElementById("m-lng").value
            };

            const res = await fetch('/admin/api/stations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await res.json();
            if (res.ok) {
                alert(result.message);
                document.getElementById("master-station-form").reset();
                await fetchMasterStations(); // Refresh local list
            } else {
                alert("Error: " + result.error);
            }
        }

        // Load Route for Selected Train
        async function loadTrainRoute() {
            const select = document.getElementById("train-select");
            currentTrainId = select.value;
            const form = document.getElementById("route-form");
            const deleteBtn = document.getElementById("delete-btn");
            const container = document.getElementById("stations-container");

            if (!currentTrainId) {
                form.style.display = "none";
                deleteBtn.style.display = "none";
                return;
            }

            deleteBtn.style.display = "block";
            const res = await fetch(`/admin/api/trains/${currentTrainId}`);
            const train = await res.json();

            container.innerHTML = "";
            form.style.display = "block";

            if (train.stations && train.stations.length > 0) {
                train.stations.forEach(st => addStationRow(st));
            } else {
                addStationRow();
            }
        }

        // Add Station Stop Row with Auto-Fill Dropdown
        function addStationRow(data = {}) {
            const container = document.getElementById("stations-container");
            const rowCount = container.children.length + 1;

            const row = document.createElement("div");
            row.className = "station-row";

            let dropdownOptions = `<option value="">-- Select Master Station --</option>`;
            masterStations.forEach(m => {
                const selected = m.stationName === data.stationName ? 'selected' : '';
                dropdownOptions += `<option value="${m._id}" data-name="${m.stationName}" data-lat="${m.location.latitude}" data-lng="${m.location.longitude}" ${selected}>${m.stationName} (${m.stationCode || 'N/A'})</option>`;
            });

            row.innerHTML = `
                <input type="number" placeholder="Seq" class="st-seq" value="${data.sequenceOrder || rowCount}" style="width: 50px;" required>
                <select class="st-select" onchange="autoFillCoordinates(this)">
                    ${dropdownOptions}
                </select>
                <input type="text" placeholder="Station Name" class="st-name" value="${data.stationName || ''}" required readonly>
                <input type="number" step="any" placeholder="Latitude" class="st-lat" value="${data.location?.latitude || ''}" required readonly style="width: 110px;">
                <input type="number" step="any" placeholder="Longitude" class="st-lng" value="${data.location?.longitude || ''}" required readonly style="width: 110px;">
                <input type="time" placeholder="Arrival Time" class="st-time" value="${data.scheduledArrivalTime || ''}" required>
                <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">✕</button>
            `;
            container.appendChild(row);
        }

        // Auto-Fill Lat/Lng when station selected from dropdown
        function autoFillCoordinates(selectEl) {
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            const row = selectEl.parentElement;

            if (selectedOpt.value) {
                row.querySelector(".st-name").value = selectedOpt.getAttribute("data-name");
                row.querySelector(".st-lat").value = selectedOpt.getAttribute("data-lat");
                row.querySelector(".st-lng").value = selectedOpt.getAttribute("data-lng");
            } else {
                row.querySelector(".st-name").value = "";
                row.querySelector(".st-lat").value = "";
                row.querySelector(".st-lng").value = "";
            }
        }

        // Create Train
        async function createTrain(e) {
            e.preventDefault();
            const body = {
                trainNumber: document.getElementById("new-num").value,
                trainName: document.getElementById("new-name").value,
                color: document.getElementById("new-color").value,
                departure: document.getElementById("new-dept").value,
                destination: document.getElementById("new-dest").value,
                departureTime: document.getElementById("new-time").value
            };

            const res = await fetch('/admin/api/trains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await res.json();
            if (res.ok) {
                alert(result.message);
                window.location.reload();
            } else {
                alert("Error: " + result.error);
            }
        }

        // Save Route Stops
        async function saveRoute(e) {
            e.preventDefault();
            const rows = document.querySelectorAll(".station-row");
            const stations = [];

            rows.forEach(row => {
                stations.push({
                    sequenceOrder: parseInt(row.querySelector(".st-seq").value),
                    stationName: row.querySelector(".st-name").value.trim(),
                    location: {
                        latitude: parseFloat(row.querySelector(".st-lat").value),
                        longitude: parseFloat(row.querySelector(".st-lng").value)
                    },
                    scheduledArrivalTime: row.querySelector(".st-time").value
                });
            });

            const res = await fetch(`/admin/api/trains/${currentTrainId}/route`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stations })
            });

            const result = await res.json();
            if (res.ok) {
                alert("Route updated successfully!");
            } else {
                alert("Error: " + result.error);
            }
        }

        // Delete Train
        async function deleteTrain() {
            if (!currentTrainId) return;
            if (confirm("Are you sure you want to delete this train?")) {
                const res = await fetch(`/admin/api/trains/${currentTrainId}`, { method: 'DELETE' });
                const result = await res.json();
                if (res.ok) {
                    alert(result.message);
                    window.location.reload();
                } else {
                    alert("Error: " + result.error);
                }
            }
        }

document.getElementById("new-color").addEventListener("input", (e) => {
    document.getElementById("color-hex-label").textContent = e.target.value.toUpperCase();
});