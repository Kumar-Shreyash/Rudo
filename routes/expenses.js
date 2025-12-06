const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const expenseController = require('../controllers/expenseController');
const { body } = require('express-validator');

router.use(authenticate);

// Create expense
router.post(
  '/',
  [
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
    body('paidBy').isInt().withMessage('Valid payer ID is required'),
    body('splitType').isIn(['EQUAL', 'EXACT', 'PERCENT']).withMessage('Valid split type is required'),
    body('participants').isArray({ min: 1 }).withMessage('At least one participant is required'),
    body('groupId').optional().isInt()
  ],
  expenseController.createExpense
);

// Get expenses
router.get('/', expenseController.getExpenses);

// Get expense by ID
router.get('/:id', expenseController.getExpenseById);

// Update expense
router.put(
  '/:id',
  [
    body('description').optional().trim().notEmpty(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('splitType').optional().isIn(['EQUAL', 'EXACT', 'PERCENT']),
    body('participants').optional().isArray({ min: 1 })
  ],
  expenseController.updateExpense
);

// Delete expense
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;

