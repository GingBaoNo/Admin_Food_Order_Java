const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboard.controller');

router.get('/', controller.dashboard); // Route cho dashboard

module.exports = router;