const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Verify token endpoint
router.get('/verify', authenticate, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      firebaseUid: req.user.firebaseUid,
      email: req.user.email,
      name: req.user.name
    }
  });
});

module.exports = router;

