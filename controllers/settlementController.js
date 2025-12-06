const db = require('../config/database');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');

const createSettlement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paidBy, paidTo, amount, groupId, notes } = req.body;

    // Validate users exist
    const [users] = await db.pool.query(
      'SELECT id FROM users WHERE id IN (?, ?)',
      [paidBy, paidTo]
    );
    if (users.length !== 2) {
      return res.status(400).json({ error: 'Invalid users' });
    }

    // Validate group membership if groupId provided
    if (groupId) {
      const [members] = await db.pool.query(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id IN (?, ?)',
        [groupId, paidBy, paidTo]
      );
      if (members.length !== 2) {
        return res.status(400).json({ error: 'Both users must be group members' });
      }
    }

    // Check if user is authorized (must be one of the parties)
    if (req.user.id !== paidBy && req.user.id !== paidTo) {
      return res.status(403).json({ error: 'You can only create settlements involving yourself' });
    }

    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create settlement
      const [result] = await connection.query(
        'INSERT INTO settlements (paid_by, paid_to, amount, group_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [paidBy, paidTo, amount, groupId || null, notes || null, req.user.id]
      );

      const settlementId = result.insertId;

      // Update balances (settlement reduces debt)
      // paidBy pays paidTo, so paidBy's debt to paidTo decreases
      const [existingBalances] = await connection.query(
        'SELECT * FROM balances WHERE user_id = ? AND owes_to = ? AND (group_id = ? OR (group_id IS NULL AND ? IS NULL))',
        [paidBy, paidTo, groupId, groupId]
      );

      if (existingBalances.length > 0) {
        const newAmount = parseFloat(existingBalances[0].amount) - parseFloat(amount);
        if (Math.abs(newAmount) < 0.01) {
          await connection.query('DELETE FROM balances WHERE id = ?', [existingBalances[0].id]);
        } else if (newAmount < 0) {
          // Debt reversed, swap the balance
          await connection.query('DELETE FROM balances WHERE id = ?', [existingBalances[0].id]);
          await connection.query(
            'INSERT INTO balances (user_id, owes_to, amount, group_id) VALUES (?, ?, ?, ?)',
            [paidTo, paidBy, Math.abs(newAmount), groupId]
          );
        } else {
          await connection.query(
            'UPDATE balances SET amount = ? WHERE id = ?',
            [newAmount, existingBalances[0].id]
          );
        }
      } else {
        // No existing balance, create reverse balance (paidTo now owes paidBy)
        await connection.query(
          'INSERT INTO balances (user_id, owes_to, amount, group_id) VALUES (?, ?, ?, ?)',
          [paidTo, paidBy, parseFloat(amount), groupId]
        );
      }

      await connection.commit();

      // Send notifications
      const notifyUserId = req.user.id === paidBy ? paidTo : paidBy;
      await notificationService.notifySettlement(notifyUserId, settlementId, groupId);

      const [settlements] = await connection.query(
        `SELECT s.*,
         pb.name as paid_by_name,
         pb.email as paid_by_email,
         pt.name as paid_to_name,
         pt.email as paid_to_email,
         g.name as group_name
         FROM settlements s
         INNER JOIN users pb ON s.paid_by = pb.id
         INNER JOIN users pt ON s.paid_to = pt.id
         LEFT JOIN groups g ON s.group_id = g.id
         WHERE s.id = ?`,
        [settlementId]
      );

      res.status(201).json({ settlement: settlements[0] });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create settlement error:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
};

const getSettlements = async (req, res) => {
  try {
    const { groupId } = req.query;

    let query = `
      SELECT s.*,
       pb.name as paid_by_name,
       pb.email as paid_by_email,
       pt.name as paid_to_name,
       pt.email as paid_to_email,
       g.name as group_name
      FROM settlements s
      INNER JOIN users pb ON s.paid_by = pb.id
      INNER JOIN users pt ON s.paid_to = pt.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE (s.paid_by = ? OR s.paid_to = ?)
    `;

    const params = [req.user.id, req.user.id];

    if (groupId) {
      // Check if user is group member
      const [members] = await db.pool.query(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, req.user.id]
      );
      if (members.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
      query += ' AND s.group_id = ?';
      params.push(groupId);
    }

    query += ' ORDER BY s.created_at DESC';

    const [settlements] = await db.pool.query(query, params);

    res.json({ settlements });
  } catch (error) {
    console.error('Get settlements error:', error);
    res.status(500).json({ error: 'Failed to get settlements' });
  }
};

const getSettlementById = async (req, res) => {
  try {
    const { id } = req.params;

    const [settlements] = await db.pool.query(
      `SELECT s.*,
       pb.name as paid_by_name,
       pb.email as paid_by_email,
       pt.name as paid_to_name,
       pt.email as paid_to_email,
       g.name as group_name
       FROM settlements s
       INNER JOIN users pb ON s.paid_by = pb.id
       INNER JOIN users pt ON s.paid_to = pt.id
       LEFT JOIN groups g ON s.group_id = g.id
       WHERE s.id = ?`,
      [id]
    );

    if (settlements.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    const settlement = settlements[0];

    // Check if user has access
    if (settlement.paid_by !== req.user.id && settlement.paid_to !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this settlement' });
    }

    res.json({ settlement });
  } catch (error) {
    console.error('Get settlement error:', error);
    res.status(500).json({ error: 'Failed to get settlement' });
  }
};

module.exports = {
  createSettlement,
  getSettlements,
  getSettlementById
};

