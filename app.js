require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

const connectDB = require('./config/mongoodbconfig');
const Train = require('./models/Train');
const LocationHistory = require('./models/LocationHistory');

// Connect to MongoDB
connectDB();

const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const trainPassengers = {};
const socketTrainMap = {};

// Helper: Seed initial trains if database is empty
async function seedInitialTrains() {
    const count = await Train.countDocuments();
    if (count === 0) {
        await Train.insertMany([
            { trainName: "Subarna Express", departure: "Dhaka", destination: "Chittagong", departureTime: "16:30", color: "red" },
            { trainName: "Parabat Express", departure: "Dhaka", destination: "Sylhet", departureTime: "06:20", color: "blue" },
            { trainName: "Ekota Express", departure: "Dhaka", destination: "Panchagarh", departureTime: "10:15", color: "green" },
            { trainName: "Tista Express", departure: "Dhaka", destination: "Dewanganj", departureTime: "07:30", color: "orange" }
        ]);
        console.log("Initial train schedules seeded into MongoDB.");
    }
}
seedInitialTrains();

// --- SOCKET.IO REAL-TIME PERSISTENCE ---
io.on('connection', (socket) => {

    socket.on("trainLocation", async (data) => {
        const trainName = data.trainName;
        if (!trainName) return;

        // Switch socket train registration
        const previousTrain = socketTrainMap[socket.id];
        if (previousTrain && previousTrain !== trainName) {
            if (trainPassengers[previousTrain]) {
                trainPassengers[previousTrain].delete(socket.id);
            }
        }

        socketTrainMap[socket.id] = trainName;
        if (!trainPassengers[trainName]) trainPassengers[trainName] = new Set();
        trainPassengers[trainName].add(socket.id);

        const currentPassengerCount = trainPassengers[trainName].size;
        const now = new Date();

        // 1. Save ping log to LocationHistory
        try {
            await LocationHistory.create({
                trainName,
                socketId: socket.id,
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed || 0,
                timestamp: now
            });

            // 2. Update current train state in DB
            await Train.findOneAndUpdate(
                { trainName },
                {
                    lastKnownLocation: {
                        latitude: data.latitude,
                        longitude: data.longitude,
                        speed: data.speed || 0,
                        updatedAt: now
                    }
                }
            );
        } catch (err) {
            console.error("Database save error:", err);
        }

        // 3. Broadcast to all connected clients
        io.emit("trainUpdate", {
            id: socket.id,
            ...data,
            delay: "+42 min",
            nextStation: "Joydebpur Jn",
            passengerCount: currentPassengerCount,
            updatedAt: now.getTime()
        });
    });

    socket.on('disconnect', () => {
        const trainName = socketTrainMap[socket.id];

        if (trainName && trainPassengers[trainName]) {
            trainPassengers[trainName].delete(socket.id);
            const remainingCount = trainPassengers[trainName].size;

            if (remainingCount === 0) {
                delete trainPassengers[trainName];
            }

            io.emit("passengerCountUpdate", {
                trainName: trainName,
                passengerCount: remainingCount
            });
        }

        delete socketTrainMap[socket.id];
        io.emit('user_left', socket.id);
    });
});

// --- EXPRESS ROUTES ---

// Map View (fetches active trains & full train list from DB)
app.get('/', async (req, res) => {
    try {
        const trains = await Train.find({});
        res.render('index', { page: 'home', trains });
    } catch (error) {
        res.status(500).send("Database Error");
    }
});

// Timetable View (dynamic list from database)
app.get('/schedules', async (req, res) => {
    try {
        const trains = await Train.find({});
        res.render('schedules', { page: 'schedules', trains });
    } catch (error) {
        res.status(500).send("Database Error");
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));