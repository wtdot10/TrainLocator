const Train = require('../models/Train');
const Station = require('../models/Station');

const trainData = [
    {
        trainNumber: "44",
        trainName: "Balaka Express (Mymensingh -> Joydebpur)",
        departure: "Mymensingh Jn",
        destination: "Joydebpur Jn",
        departureTime: "06:45",
        color: "#008080",
        // All intermediate stations listed explicitly
        stops: [
            { stationName: "Mymensingh Jn", scheduledArrivalTime: "06:45", isSkipped: false },
            { stationName: "Fatema Nagar", scheduledArrivalTime: null, isSkipped: true },
            { stationName: "Aulianagar", scheduledArrivalTime: null, isSkipped: true },
            { stationName: "Gafargaon", scheduledArrivalTime: "07:25", isSkipped: false },
            { stationName: "Mashakhali", scheduledArrivalTime: null, isSkipped: true },
            { stationName: "Kaoraid", scheduledArrivalTime: "07:50", isSkipped: false },
            { stationName: "Sreepur", scheduledArrivalTime: "08:10", isSkipped: false },
            { stationName: "Izzatpur", scheduledArrivalTime: null, isSkipped: true },
            { stationName: "Rajendrapur", scheduledArrivalTime: null, isSkipped: true },
            { stationName: "Bhawal Gazipur", scheduledArrivalTime: null, isSkipped: true },
            { stationName: "Joydebpur Jn", scheduledArrivalTime: "08:45", isSkipped: false }
        ]
    }
];

async function seedTrains() {
    try {
    for (const trainInfo of trainData) {
        const formattedStations = [];

        for (let i = 0; i < trainInfo.stops.length; i++) {
            const stop = trainInfo.stops[i];
            const masterStation = await Station.findOne({ stationName: stop.stationName });

            if (masterStation) {
                formattedStations.push({
                    stationName: masterStation.stationName,
                    location: masterStation.location,
                    scheduledArrivalTime: stop.scheduledArrivalTime,
                    sequenceOrder: i + 1,
                    isSkipped: stop.isSkipped
                });
            }
        }

        await Train.updateOne(
            { trainNumber: trainInfo.trainNumber },
            { $set: { ...trainInfo, stations: formattedStations } },
            { upsert: true }
        );
    }
 console.log("📍 Train seeded.");

}
    catch (err) {
        console.error("Error seeding trains:", err);
    }
}

module.exports = seedTrains;