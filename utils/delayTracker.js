const { getDistanceInMeters, parseTimeToMinutes } = require('./geo');

// Distance threshold to consider a train inside a station (300 meters)
const STATION_RADIUS_METERS = 300; 

// Minimum speed (km/h) to filter out stationary non-passenger users
const MIN_TRAIN_SPEED_KMH = 10; 

async function processTrainLocationUpdate(trainDoc, lat, lng, speed, nowTimestamp) {
    // 1. Filter out static noise (user sitting at home selecting train)
    if (speed < MIN_TRAIN_SPEED_KMH) {
        return {
            delayMinutes: trainDoc.calculatedDelayMinutes,
            nextStation: trainDoc.nextStation
        };
    }

    const stations = trainDoc.stations || [];
    if (stations.length === 0) {
        return { delayMinutes: 0, nextStation: 'Unknown' };
    }

    let closestStation = null;
    let minDistance = Infinity;

    // 2. Find closest station along the route
    for (const station of stations) {
        const dist = getDistanceInMeters(
            lat,
            lng,
            station.location.latitude,
            station.location.longitude
        );

        if (dist < minDistance) {
            minDistance = dist;
            closestStation = station;
        }
    }

    // 3. Check if train is currently at/inside station radius
    if (closestStation && minDistance <= STATION_RADIUS_METERS) {
        const now = new Date(nowTimestamp);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const scheduledMinutes = parseTimeToMinutes(closestStation.scheduledArrivalTime);

        // Delay calculation (Current Time - Scheduled Time)
        let delayMinutes = currentMinutes - scheduledMinutes;

        // Ensure negative delays (early trains) are bounded or handled
        if (delayMinutes < -60) {
            // Edge case: Overnight midnight rollover
            delayMinutes += 1440;
        }

        // Determine next station in sequence
        const currentSeq = closestStation.sequenceOrder;
        const nextStationDoc = stations.find(s => s.sequenceOrder === currentSeq + 1);
        const nextStationName = nextStationDoc ? nextStationDoc.stationName : "Final Destination";

        return {
            delayMinutes: Math.max(0, delayMinutes), // Display 0 if on-time or early
            nextStation: nextStationName,
            arrivedStation: closestStation.stationName
        };
    }

    return {
        delayMinutes: trainDoc.calculatedDelayMinutes,
        nextStation: trainDoc.nextStation
    };
}

module.exports = { processTrainLocationUpdate };