const Train = require('../models/Train');

// Render Admin Page
exports.renderAdminPage = async (req, res) => {
    try {
        const trains = await Train.find({}).sort({ trainName: 1 });
        res.render('admin', { page: 'admin', trains });
    } catch (err) {
        console.error("Admin Page Error:", err);
        res.status(500).send("Database Error");
    }
};

// Get single train details with route stops
exports.getTrainById = async (req, res) => {
    try {
        const train = await Train.findById(req.params.id);
        if (!train) return res.status(404).json({ error: "Train not found" });
        res.json(train);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create a New Train
exports.createTrain = async (req, res) => {
    try {
        const { trainName, departure, destination, departureTime, color } = req.body;

        if (!trainName || !departure || !destination || !departureTime) {
            return res.status(400).json({ error: "Please fill in all required fields." });
        }

        // Check if train with the same name already exists
        const existingTrain = await Train.findOne({ trainName: trainName.trim() });
        if (existingTrain) {
            return res.status(400).json({ error: "A train with this name already exists." });
        }

        const newTrain = new Train({
            trainName: trainName.trim(),
            departure: departure.trim(),
            destination: destination.trim(),
            departureTime,
            color: color || 'purple',
            stations: [] // Initialize with empty route stops
        });

        await newTrain.save();
        res.status(201).json({ message: "Train created successfully!", train: newTrain });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update Train Station Sequence & Route Stops
exports.updateTrainRoute = async (req, res) => {
    try {
        const { stations } = req.body;

        if (!Array.isArray(stations)) {
            return res.status(400).json({ error: "Invalid station format" });
        }

        // Sort stations by sequence order
        stations.sort((a, b) => a.sequenceOrder - b.sequenceOrder);

        const updatedTrain = await Train.findByIdAndUpdate(
            req.params.id,
            { stations: stations },
            { new: true, runValidators: true }
        );

        if (!updatedTrain) return res.status(404).json({ error: "Train not found" });

        res.json({ message: "Train route updated successfully", train: updatedTrain });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete a Train
exports.deleteTrain = async (req, res) => {
    try {
        const deletedTrain = await Train.findByIdAndDelete(req.params.id);
        if (!deletedTrain) return res.status(404).json({ error: "Train not found" });

        res.json({ message: "Train deleted successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};