const mongoose = require('mongoose');

const TrainSchema = new mongoose.Schema({
    trainName: { 
        type: String, 
        required: true, 
        unique: true 
    },
    departure: { type: String, required: true },
    destination: { type: String, required: true },
    departureTime: { type: String, required: true },
    color: { type: String, default: 'purple' },
    
    // Live tracking state updated in real-time
    currentDelay: { type: String, default: 'On Time' },
    nextStation: { type: String, default: 'Pending' },
    lastKnownLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        speed: { type: Number, default: 0 },
        updatedAt: { type: Date }
    }
}, { timestamps: true });

module.exports = mongoose.model('Train', TrainSchema);