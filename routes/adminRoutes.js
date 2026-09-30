const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const stationController = require('../controllers/stationController');

// Page routes
router.get('/', adminController.renderAdminPage);

// Train API endpoints
router.get('/api/trains/:id', adminController.getTrainById);
router.post('/api/trains', adminController.createTrain);
router.put('/api/trains/:id/route', adminController.updateTrainRoute);
router.delete('/api/trains/:id', adminController.deleteTrain);

// Master Station API endpoints
router.get('/api/stations', stationController.getAllStations);
router.post('/api/stations', stationController.addMasterStation);

module.exports = router;