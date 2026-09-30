const mongoose = require('mongoose');

const MasterStationSchema = new mongoose.Schema({
    stationName: { type: String, required: true, unique: true },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    district: { type: String, default: '' },
    stationCode: { type: String, uppercase: true }
}, { timestamps: true });

module.exports = mongoose.model('Station', MasterStationSchema);