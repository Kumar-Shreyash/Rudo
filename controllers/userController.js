const db = require('../config/database');

const getProfile = async (req, res) => {
  try {
    const [users] = await db.pool.query(
      'SELECT id, firebase_uid, email, name, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

const getBalances = async (req, res) => {
  try {
    const { groupId } = req.query;
    
    let query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        o.id as owes_to_id,
        o.name as owes_to_name,
        o.email as owes_to_email,
        b.amount,
        b.group_id,
        g.name as group_name
      FROM balances b
      JOIN users u ON b.user_id = u.id
      JOIN users o ON b.owes_to = o.id
      LEFT JOIN groups g ON b.group_id = g.id
      WHERE b.user_id = ? AND b.amount != 0
    `;
    
    const params = [req.user.id];
    
    if (groupId) {
      query += ' AND b.group_id = ?';
      params.push(groupId);
    }
    
    query += ' ORDER BY b.amount DESC';
    
    const [balances] = await db.pool.query(query, params);
    
    // Calculate net balance
    const [netBalance] = await db.pool.query(
      `SELECT 
        SUM(CASE WHEN user_id = ? THEN -amount ELSE 0 END) as total_owed,
        SUM(CASE WHEN owes_to = ? THEN amount ELSE 0 END) as total_owed_to_me
      FROM balances
      WHERE (user_id = ? OR owes_to = ?) AND amount != 0
      ${groupId ? 'AND group_id = ?' : ''}`,
      groupId 
        ? [req.user.id, req.user.id, req.user.id, req.user.id, groupId]
        : [req.user.id, req.user.id, req.user.id, req.user.id]
    );
    
    res.json({
      balances: balances.map(b => ({
        user: {
          id: b.user_id,
          name: b.user_name,
          email: b.user_email
        },
        owesTo: {
          id: b.owes_to_id,
          name: b.owes_to_name,
          email: b.owes_to_email
        },
        amount: parseFloat(b.amount),
        group: b.group_id ? {
          id: b.group_id,
          name: b.group_name
        } : null
      })),
      netBalance: {
        totalOwed: parseFloat(netBalance[0].total_owed || 0),
        totalOwedToMe: parseFloat(netBalance[0].total_owed_to_me || 0),
        net: parseFloat(netBalance[0].total_owed_to_me || 0) - parseFloat(netBalance[0].total_owed || 0)
      }
    });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: 'Failed to get balances' });
  }
};

const registerFCMToken = async (req, res) => {
  try {
    const { token, deviceInfo } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }
    
    await db.pool.query(
      `INSERT INTO fcm_tokens (user_id, token, device_info)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
       token = VALUES(token),
       device_info = VALUES(device_info),
       updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, token, deviceInfo || null]
    );
    
    res.json({ success: true, message: 'FCM token registered' });
  } catch (error) {
    console.error('Register FCM token error:', error);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
};

module.exports = {
  getProfile,
  getBalances,
  registerFCMToken
};

