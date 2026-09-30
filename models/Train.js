const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
    stationName: { type: String, required: true },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    scheduledArrivalTime: { type: String, required: true },
    sequenceOrder: { type: Number, required: true }
});

const TrainSchema = new mongoose.Schema({
    trainNumber: { type: String, required: true, unique: true }, // e.g., "705", "706"
    trainName: { type: String, required: true },                 // e.g., "Balaka Express"
    departure: { type: String, required: true },
    destination: { type: String, required: true },
    departureTime: { type: String, required: true },
    color: { type: String, default: '#800080' },
    
    stations: [StationSchema],

    calculatedDelayMinutes: { type: Number, default: 0 },
    nextStation: { type: String, default: 'Pending' },
    lastKnownLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        speed: { type: Number, default: 0 },
        updatedAt: { type: Date }
    }
}, { timestamps: true });

module.exports = mongoose.model('Train', TrainSchema);