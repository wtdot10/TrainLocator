require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

const connectDB = require('./config/mongoodbconfig');
const Train = require('./models/Train');
const LocationHistory = require('./models/LocationHistory');
const { processTrainLocationUpdate } = require('./utils/delayTracker');

// Connect to MongoDB
connectDB();

const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// In-Memory Tracking Maps
const trainPassengers = {}; // Train Name -> Set of Socket IDs
const socketTrainMap = {};  // Socket ID -> Train Name

// --- DATABASE SEEDING ---
// Seeds default train routes with station coordinates and schedules if DB is empty
async function seedInitialTrains() {
    try {
        const count = await Train.countDocuments();
        if (count === 0) {
            await Train.insertMany([
                {
                    trainName: "Subarna Express",
                    departure: "Dhaka",
                    destination: "Chittagong",
                    departureTime: "16:30",
                    color: "red",
                    stations: [
                        { stationName: "Dhaka Kamalapur", location: { latitude: 23.7314, longitude: 90.4262 }, scheduledArrivalTime: "16:30", sequenceOrder: 1 },
                        { stationName: "Biman Bandar", location: { latitude: 23.8519, longitude: 90.4078 }, scheduledArrivalTime: "16:55", sequenceOrder: 2 },
                        { stationName: "Joydebpur Jn", location: { latitude: 23.9999, longitude: 90.4203 }, scheduledArrivalTime: "17:25", sequenceOrder: 3 },
                        { stationName: "Chittagong", location: { latitude: 22.3355, longitude: 91.8318 }, scheduledArrivalTime: "21:50", sequenceOrder: 4 }
                    ]
                },
                {
                    trainName: "Parabat Express",
                    departure: "Dhaka",
                    destination: "Sylhet",
                    departureTime: "06:20",
                    color: "blue",
                    stations: [
                        { stationName: "Dhaka Kamalapur", location: { latitude: 23.7314, longitude: 90.4262 }, scheduledArrivalTime: "06:20", sequenceOrder: 1 },
                        { stationName: "Biman Bandar", location: { latitude: 23.8519, longitude: 90.4078 }, scheduledArrivalTime: "06:45", sequenceOrder: 2 },
                        { stationName: "Joydebpur Jn", location: { latitude: 23.9999, longitude: 90.4203 }, scheduledArrivalTime: "07:15", sequenceOrder: 3 },
                        { stationName: "Sylhet", location: { latitude: 24.8898, longitude: 91.8697 }, scheduledArrivalTime: "13:00", sequenceOrder: 4 }
                    ]
                },
                {
                    trainName: "Ekota Express",
                    departure: "Dhaka",
                    destination: "Panchagarh",
                    departureTime: "10:15",
                    color: "green",
                    stations: [
                        { stationName: "Dhaka Kamalapur", location: { latitude: 23.7314, longitude: 90.4262 }, scheduledArrivalTime: "10:15", sequenceOrder: 1 },
                        { stationName: "Joydebpur Jn", location: { latitude: 23.9999, longitude: 90.4203 }, scheduledArrivalTime: "11:05", sequenceOrder: 2 },
                        { stationName: "Panchagarh", location: { latitude: 26.3354, longitude: 88.5517 }, scheduledArrivalTime: "21:00", sequenceOrder: 3 }
                    ]
                },
                {
                    trainName: "Tista Express",
                    departure: "Dhaka",
                    destination: "Dewanganj",
                    departureTime: "07:30",
                    color: "orange",
                    stations: [
                        { stationName: "Dhaka Kamalapur", location: { latitude: 23.7314, longitude: 90.4262 }, scheduledArrivalTime: "07:30", sequenceOrder: 1 },
                        { stationName: "Joydebpur Jn", location: { latitude: 23.9999, longitude: 90.4203 }, scheduledArrivalTime: "08:20", sequenceOrder: 2 },
                        { stationName: "Dewanganj", location: { latitude: 25.1482, longitude: 89.7847 }, scheduledArrivalTime: "14:00", sequenceOrder: 3 }
                    ]
                }
            ]);
            console.log("Initial train schedules seeded into MongoDB.");
        }
    } catch (err) {
        console.error("Seeding error:", err);
    }
}
seedInitialTrains();

// --- SOCKET.IO EVENT HANDLERS ---
io.on('connection', (socket) => {

    socket.on("trainLocation", async (data) => {
        const trainName = data.trainName;
        if (!trainName) return;

        // Switch user to new train if they selected a different one
        const previousTrain = socketTrainMap[socket.id];
        if (previousTrain && previousTrain !== trainName) {
            if (trainPassengers[previousTrain]) {
                trainPassengers[previousTrain].delete(socket.id);
            }
        }

        // Register socket to train
        socketTrainMap[socket.id] = trainName;
        if (!trainPassengers[trainName]) trainPassengers[trainName] = new Set();
        trainPassengers[trainName].add(socket.id);

        const currentPassengerCount = trainPassengers[trainName].size;
        const now = Date.now();

        try {
            // 1. Log GPS ping into LocationHistory collection
            await LocationHistory.create({
                trainName,
                socketId: socket.id,
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed || 0,
                timestamp: new Date(now)
            });

            // 2. Fetch train from DB
            let trainDoc = await Train.findOne({ trainName });

            let delayText = "On Time";
            let nextStationName = "Pending";

            if (trainDoc) {
                // 3. Process location to automatically calculate delay & station sequence
                const calculation = await processTrainLocationUpdate(
                    trainDoc,
                    data.latitude,
                    data.longitude,
                    data.speed || 0,
                    now
                );

                delayText = calculation.delayMinutes > 0 
                    ? `+${calculation.delayMinutes} min` 
                    : 'On Time';
                nextStationName = calculation.nextStation;

                // 4. Update Train status in DB
                trainDoc.calculatedDelayMinutes = calculation.delayMinutes;
                trainDoc.nextStation = calculation.nextStation;
                trainDoc.lastKnownLocation = {
                    latitude: data.latitude,
                    longitude: data.longitude,
                    speed: data.speed || 0,
                    updatedAt: new Date(now)
                };
                await trainDoc.save();
            }

            // 5. Broadcast real-time update to all clients
            io.emit("trainUpdate", {
                id: socket.id,
                trainName: data.trainName,
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed || 0,
                delay: delayText,
                nextStation: nextStationName,
                passengerCount: currentPassengerCount,
                updatedAt: now
            });

        } catch (err) {
            console.error("Error processing train location ping:", err);
        }
    });

    socket.on('disconnect', () => {
        const trainName = socketTrainMap[socket.id];

        if (trainName && trainPassengers[trainName]) {
            trainPassengers[trainName].delete(socket.id);
            const remainingCount = trainPassengers[trainName].size;

            if (remainingCount === 0) {
                delete trainPassengers[trainName];
            }

            // Broadcast active passenger count update
            io.emit("passengerCountUpdate", {
                trainName: trainName,
                passengerCount: remainingCount
            });
        }

        delete socketTrainMap[socket.id];
        io.emit('user_left', socket.id);
    });
});

// --- EXPRESS HTTP ROUTES ---

// Map View (Live tracking page)
app.get('/', async (req, res) => {
    try {
        const trains = await Train.find({});
        res.render('index', { page: 'home', trains });
    } catch (error) {
        console.error("Home route error:", error);
        res.status(500).send("Database Error");
    }
});

// Timetable View (Train schedules page)
app.get('/schedules', async (req, res) => {
    try {
        const trains = await Train.find({});
        res.render('schedules', { page: 'schedules', trains });
    } catch (error) {
        console.error("Schedules route error:", error);
        res.status(500).send("Database Error");
    }
});

// --- SERVER INITIALIZATION ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});