const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const groupController = require('../controllers/groupController');
const { body } = require('express-validator');

router.use(authenticate);

// Create group
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Group name is required'),
    body('description').optional().trim()
  ],
  groupController.createGroup
);

// Get user's groups
router.get('/', groupController.getUserGroups);

// Get group by ID
router.get('/:id', groupController.getGroupById);

// Update group
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim()
  ],
  groupController.updateGroup
);

// Delete group
router.delete('/:id', groupController.deleteGroup);

// Add member to group
router.post(
  '/:id/members',
  [
    body('userId').isInt().withMessage('Valid user ID is required')
  ],
  groupController.addMember
);

// Remove member from group
router.delete('/:id/members/:userId', groupController.removeMember);

// Get group members
router.get('/:id/members', groupController.getGroupMembers);

module.exports = router;

