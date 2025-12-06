const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.use(authenticate);

// Get current user profile
router.get('/me', userController.getProfile);

// Get user balances
router.get('/balances', userController.getBalances);

// Register FCM token (optional)
router.post('/fcm-token', userController.registerFCMToken);

module.exports = router;

