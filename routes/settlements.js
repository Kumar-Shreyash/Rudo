const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const settlementController = require('../controllers/settlementController');
const { body } = require('express-validator');

router.use(authenticate);

// Create settlement
router.post(
  '/',
  [
    body('paidBy').isInt().withMessage('Valid payer ID is required'),
    body('paidTo').isInt().withMessage('Valid payee ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
    body('groupId').optional().isInt(),
    body('notes').optional().trim()
  ],
  settlementController.createSettlement
);

// Get settlements
router.get('/', settlementController.getSettlements);

// Get settlement by ID
router.get('/:id', settlementController.getSettlementById);

module.exports = router;

