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

connectDB();

const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const trainPassengers = {};
const socketTrainMap = {};

// 3 Hours Expiration Constant
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

io.on('connection', (socket) => {

    // When client connects, send last known locations of trains updated within 3 hours
    socket.on("getInitialTrainLocations", async () => {
        try {
            const trains = await Train.find({
                "lastKnownLocation.updatedAt": { $gte: new Date(Date.now() - THREE_HOURS_MS) }
            });

            trains.forEach(train => {
                if (train.lastKnownLocation && train.lastKnownLocation.latitude) {
                    socket.emit("trainUpdate", {
                        id: socket.id,
                        trainName: train.trainName,
                        latitude: train.lastKnownLocation.latitude,
                        longitude: train.lastKnownLocation.longitude,
                        speed: train.lastKnownLocation.speed || 0,
                        delay: train.calculatedDelayMinutes > 0 ? `+${train.calculatedDelayMinutes} min` : 'On Time',
                        nextStation: train.nextStation,
                        passengerCount: trainPassengers[train.trainName] ? trainPassengers[train.trainName].size : 0,
                        updatedAt: new Date(train.lastKnownLocation.updatedAt).getTime(),
                        isHistorical: true // Flag to indicate cached/last-known position
                    });
                }
            });
        } catch (err) {
            console.error("Error fetching initial locations:", err);
        }
    });

    socket.on("trainLocation", async (data) => {
        const trainName = data.trainName;
        if (!trainName) return;

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
        const now = Date.now();

        try {
            await LocationHistory.create({
                trainName,
                socketId: socket.id,
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed || 0,
                timestamp: new Date(now)
            });

            let trainDoc = await Train.findOne({ trainName });

            let delayText = "On Time";
            let nextStationName = "Pending";

            if (trainDoc) {
                const calculation = await processTrainLocationUpdate(
                    trainDoc,
                    data.latitude,
                    data.longitude,
                    data.speed || 0,
                    now
                );

                delayText = calculation.delayMinutes > 0 ? `+${calculation.delayMinutes} min` : 'On Time';
                nextStationName = calculation.nextStation;

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

            io.emit("trainUpdate", {
                id: socket.id,
                trainName: data.trainName,
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed || 0,
                delay: delayText,
                nextStation: nextStationName,
                passengerCount: currentPassengerCount,
                updatedAt: now,
                isHistorical: false
            });

        } catch (err) {
            console.error("Error processing train update:", err);
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

            io.emit("passengerCountUpdate", {
                trainName: trainName,
                passengerCount: remainingCount
            });
        }

        delete socketTrainMap[socket.id];
        io.emit('user_left', socket.id);
    });
});

app.get('/', async (req, res) => {
    try {
        const trains = await Train.find({});
        res.render('index', { page: 'home', trains });
    } catch (error) {
        res.status(500).send("Database Error");
    }
});

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