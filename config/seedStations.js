const Station = require('../models/Station');

const mymensinghToJoydebpurStations = [
    { stationName: "Mymensingh Jn", stationCode: "MSH", location: { latitude: 24.7471, longitude: 90.4203 } },
    { stationName: "Fatema Nagar", stationCode: "FTN", location: { latitude: 24.6473, longitude: 90.4355 } },
    { stationName: "Aulianagar", stationCode: "ALN", location: { latitude: 24.5823, longitude: 90.4501 } },
    { stationName: "Gafargaon", stationCode: "GFG", location: { latitude: 24.4333, longitude: 90.5511 } },
    { stationName: "Mashakhali", stationCode: "MSK", location: { latitude: 24.3312, longitude: 90.5284 } },
    { stationName: "Kaoraid", stationCode: "KRD", location: { latitude: 24.2381, longitude: 90.4801 } },
    { stationName: "Sreepur", stationCode: "SRP", location: { latitude: 24.2001, longitude: 90.4705 } },
    { stationName: "Izzatpur", stationCode: "IZT", location: { latitude: 24.1132, longitude: 90.4512 } },
    { stationName: "Rajendrapur", stationCode: "RJP", location: { latitude: 24.0805, longitude: 90.4411 } },
    { stationName: "Bhawal Gazipur", stationCode: "BGZ", location: { latitude: 24.0301, longitude: 90.4312 } },
    { stationName: "Joydebpur Jn", stationCode: "JDB", location: { latitude: 23.9999, longitude: 90.4203 } }
];

async function seedStations() {
    try {
        for (const st of mymensinghToJoydebpurStations) {
            await Station.updateOne(
                { stationName: st.stationName },
                { $setOnInsert: st },
                { upsert: true }
            );
        }
        console.log("📍 All Mymensingh to Joydebpur master stations seeded.");
    } catch (err) {
        console.error("Error seeding stations:", err);
    }
}

module.exports = seedStations;