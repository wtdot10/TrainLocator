const mongoose = require('mongoose');

const LocationHistorySchema = new mongoose.Schema({
    trainName: { type: String, required: true },
    socketId: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    speed: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LocationHistory', LocationHistorySchema);