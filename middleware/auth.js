const admin = require('../config/firebase');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    };

    // Get or create user in database
    const [users] = await db.pool.query(
      'SELECT * FROM users WHERE firebase_uid = ?',
      [decodedToken.uid]
    );

    if (users.length === 0) {
      // Create user if doesn't exist
      const [result] = await db.pool.query(
        'INSERT INTO users (firebase_uid, email, name) VALUES (?, ?, ?)',
        [decodedToken.uid, decodedToken.email || '', decodedToken.name || '']
      );
      req.user.id = result.insertId;
    } else {
      req.user.id = users[0].id;
      // Update user info if changed
      if (decodedToken.email !== users[0].email || decodedToken.name !== users[0].name) {
        await db.pool.query(
          'UPDATE users SET email = ?, name = ? WHERE id = ?',
          [decodedToken.email || users[0].email, decodedToken.name || users[0].name, users[0].id]
        );
      }
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };

