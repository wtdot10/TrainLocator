const { getDistanceInMeters, parseTimeToMinutes } = require('./geo');

const STATION_RADIUS_METERS = 500; // 500m arrival radius
const MIN_TRAIN_SPEED_KMH = 5;

async function processTrainLocationUpdate(trainDoc, lat, lng, speed, nowTimestamp) {
    const stations = trainDoc.stations || [];
    if (stations.length === 0) {
        return { delayMinutes: 0, nextStation: 'Unknown' };
    }

    // Sort stations sequentially
    stations.sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    let nearestStation = null;
    let minDistance = Infinity;

    // Find nearest station
    for (const station of stations) {
        const dist = getDistanceInMeters(lat, lng, station.location.latitude, station.location.longitude);
        if (dist < minDistance) {
            minDistance = dist;
            nearestStation = station;
        }
    }

    let delayMinutes = trainDoc.calculatedDelayMinutes || 0;
    let nextStationName = trainDoc.nextStation || stations[0].stationName;

    // 1. Calculate Delay when inside station radius
    if (nearestStation && minDistance <= STATION_RADIUS_METERS) {
        const now = new Date(nowTimestamp);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const scheduledMinutes = parseTimeToMinutes(nearestStation.scheduledArrivalTime);

        let calcDelay = currentMinutes - scheduledMinutes;
        if (calcDelay < -60) calcDelay += 1440; // Overnight fix

        delayMinutes = Math.max(0, calcDelay);

        // Advance next station
        const nextSeq = nearestStation.sequenceOrder + 1;
        const nextDoc = stations.find(s => s.sequenceOrder === nextSeq);
        nextStationName = nextDoc ? nextDoc.stationName : "Final Destination";
    } else if (nearestStation) {
        // 2. Determine Next Station while train is en-route
        // If passenger is moving towards the next stop in sequence
        const currentSeq = nearestStation.sequenceOrder;
        const nextDoc = stations.find(s => s.sequenceOrder === currentSeq + 1);
        nextStationName = nextDoc ? nextDoc.stationName : nearestStation.stationName;
    }

    return {
        delayMinutes,
        nextStation: nextStationName
    };
}

module.exports = { processTrainLocationUpdate };