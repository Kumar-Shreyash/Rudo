const db = require('../config/database');
const debtSimplifier = require('../services/debtSimplifier');

const getBalances = async (req, res) => {
  try {
    const { groupId } = req.query;

    let query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        o.id as owes_to_id,
        o.name as owes_to_name,
        b.amount,
        b.group_id,
        g.name as group_name
      FROM balances b
      JOIN users u ON b.user_id = u.id
      JOIN users o ON b.owes_to = o.id
      LEFT JOIN groups g ON b.group_id = g.id
      WHERE b.amount != 0
    `;

    const params = [];

    if (groupId) {
      // Check if user is group member
      const [members] = await db.pool.query(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, req.user.id]
      );
      if (members.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
      query += ' AND b.group_id = ?';
      params.push(groupId);
    } else {
      // Get balances involving the user
      query += ' AND (b.user_id = ? OR b.owes_to = ?)';
      params.push(req.user.id, req.user.id);
    }

    query += ' ORDER BY ABS(b.amount) DESC';

    const [balances] = await db.pool.query(query, params);

    res.json({
      balances: balances.map(b => ({
        user: {
          id: b.user_id,
          name: b.user_name
        },
        owesTo: {
          id: b.owes_to_id,
          name: b.owes_to_name
        },
        amount: parseFloat(b.amount),
        group: b.group_id ? {
          id: b.group_id,
          name: b.group_name
        } : null
      }))
    });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: 'Failed to get balances' });
  }
};

const simplifyDebts = async (req, res) => {
  try {
    const { groupId } = req.query;

    // Get all balances
    let query = `
      SELECT 
        b.user_id,
        b.owes_to,
        b.amount,
        b.group_id,
        u.name as user_name,
        o.name as owes_to_name
      FROM balances b
      JOIN users u ON b.user_id = u.id
      JOIN users o ON b.owes_to = o.id
      WHERE b.amount != 0
    `;

    const params = [];

    if (groupId) {
      // Check if user is group member
      const [members] = await db.pool.query(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, req.user.id]
      );
      if (members.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
      query += ' AND b.group_id = ?';
      params.push(groupId);
    } else {
      // Get balances for all users (global simplification)
      // In a real app, you might want to restrict this to user's groups
    }

    const [balances] = await db.pool.query(query, params);

    if (balances.length === 0) {
      return res.json({ simplifiedPayments: [] });
    }

    // Build graph for debt simplification
    const balancesMap = new Map();
    for (const balance of balances) {
      const key = `${balance.user_id}-${balance.owes_to}`;
      balancesMap.set(key, parseFloat(balance.amount));
    }

    // Simplify debts
    const simplifiedPayments = debtSimplifier.simplify(balances);

    res.json({
      simplifiedPayments: simplifiedPayments.map(p => ({
        from: {
          id: p.from,
          name: balances.find(b => b.user_id === p.from)?.user_name
        },
        to: {
          id: p.to,
          name: balances.find(b => b.owes_to === p.to)?.owes_to_name
        },
        amount: p.amount
      })),
      originalTransactions: balances.length,
      simplifiedTransactions: simplifiedPayments.length,
      reduction: balances.length - simplifiedPayments.length
    });
  } catch (error) {
    console.error('Simplify debts error:', error);
    res.status(500).json({ error: 'Failed to simplify debts' });
  }
};

module.exports = {
  getBalances,
  simplifyDebts
};

