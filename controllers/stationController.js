const Station = require('../models/Station');

// Fetch all master stations for dropdown auto-complete
exports.getAllStations = async (req, res) => {
    try {
        const stations = await Station.find({}).sort({ stationName: 1 });
        res.json(stations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add a new master station to DB
exports.addMasterStation = async (req, res) => {
    try {
        const { stationName, stationCode, latitude, longitude, district } = req.body;

        if (!stationName || !latitude || !longitude) {
            return res.status(400).json({ error: "Station name, latitude, and longitude are required." });
        }

        const existing = await Station.findOne({ stationName: stationName.trim() });
        if (existing) {
            return res.status(400).json({ error: "Station already exists in Master DB." });
        }

        const newStation = new Station({
            stationName: stationName.trim(),
            stationCode: stationCode ? stationCode.toUpperCase().trim() : '',
            district: district ? district.trim() : '',
            location: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            }
        });

        await newStation.save();
        res.status(201).json({ message: "Master station added successfully!", station: newStation });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};