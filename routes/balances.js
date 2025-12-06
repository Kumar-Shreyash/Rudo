const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const balanceController = require('../controllers/balanceController');

router.use(authenticate);

// Get balances
router.get('/', balanceController.getBalances);

// Simplify debts
router.get('/simplify', balanceController.simplifyDebts);

module.exports = router;

