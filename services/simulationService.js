const Train = require('../models/Train');

// Helper: Linearly interpolate between two points
function interpolate(start, end, progress) {
    return start + (end - start) * progress;
}

// In-memory runtime state for active trains
const liveTrainStates = {};

function initSimulation(io) {
    // Run simulation loop every 3 seconds
    setInterval(async () => {
        try {
            const trains = await Train.find({});

            for (const train of trains) {
                if (!train.stations || train.stations.length < 2) continue;

                const trainId = train._id.toString();

                // Initialize runtime state for new trains
                if (!liveTrainStates[trainId]) {
                    liveTrainStates[trainId] = {
                        currentSegmentIndex: 0, // Current station segment (Station A -> Station B)
                        progress: 0,            // Progress from 0.0 (Station A) to 1.0 (Station B)
                        speed: 60,              // Speed in km/h
                        isMoving: true
                    };
                }

                const state = liveTrainStates[trainId];
                const currentStop = train.stations[state.currentSegmentIndex];
                const nextStop = train.stations[state.currentSegmentIndex + 1];

                // If train reaches end of route, restart route loop
                if (!nextStop) {
                    state.currentSegmentIndex = 0;
                    state.progress = 0;
                    continue;
                }

                // Advance train progress along segment (incrementing ~5% per tick)
                state.progress += 0.05;

                // Move to next station segment when progress reaches 100%
                if (state.progress >= 1) {
                    state.progress = 0;
                    state.currentSegmentIndex++;
                }

                // Interpolate active GPS coordinates
                const currentLat = interpolate(
                    currentStop.location.latitude,
                    nextStop.location.latitude,
                    state.progress
                );
                const currentLng = interpolate(
                    currentStop.location.longitude,
                    nextStop.location.longitude,
                    state.progress
                );

                const updatePayload = {
                    trainId: train._id,
                    trainNumber: train.trainNumber,
                    trainName: train.trainName,
                    color: train.color,
                    latitude: currentLat,
                    longitude: currentLng,
                    speed: state.speed,
                    nextStation: nextStop.stationName,
                    updatedAt: new Date()
                };

                // Broadcast live location update to all connected clients
                io.emit('trainLocationUpdate', updatePayload);

                // Optional: Async background sync to MongoDB (throttled)
                if (Math.random() < 0.2) {
                    await Train.findByIdAndUpdate(train._id, {
                        lastKnownLocation: {
                            latitude: currentLat,
                            longitude: currentLng,
                            speed: state.speed,
                            updatedAt: new Date()
                        },
                        nextStation: nextStop.stationName
                    });
                }
            }
        } catch (err) {
            console.error("Simulation Error:", err.message);
        }
    }, 3000);
}

module.exports = { initSimulation };