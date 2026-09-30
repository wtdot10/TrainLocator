const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
    stationName: { type: String, required: true },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    scheduledArrivalTime: { type: String, required: true }, // Format "HH:mm" e.g., "07:30"
    sequenceOrder: { type: Number, required: true } // 1 for 1st station, 2 for 2nd, etc.
});

const TrainSchema = new mongoose.Schema({
    trainName: { type: String, required: true, unique: true },
    departure: { type: String, required: true },
    destination: { type: String, required: true },
    color: { type: String, default: 'purple' },

    stations: [StationSchema], // Station sequence list

    // Calculated dynamic state
    calculatedDelayMinutes: { type: Number, default: 0 },
    nextStation: { type: String, default: 'Pending' },
    lastKnownLocation: {
        latitude: Number,
        longitude: Number,
        speed: Number,
        updatedAt: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('Train', TrainSchema);