const db = require('../config/database');
const { validationResult } = require('express-validator');
const balanceService = require('../services/balanceService');
const notificationService = require('../services/notificationService');

const createExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { description, amount, paidBy, groupId, splitType, participants } = req.body;

    // Validate participants
    if (splitType === 'EQUAL' && participants.length === 0) {
      return res.status(400).json({ error: 'At least one participant is required' });
    }

    if (splitType === 'EXACT') {
      const totalExact = participants.reduce((sum, p) => sum + (parseFloat(p.shareAmount) || 0), 0);
      if (Math.abs(totalExact - parseFloat(amount)) > 0.01) {
        return res.status(400).json({ error: 'Sum of exact shares must equal total amount' });
      }
    }

    if (splitType === 'PERCENT') {
      const totalPercent = participants.reduce((sum, p) => sum + (parseFloat(p.sharePercent) || 0), 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        return res.status(400).json({ error: 'Sum of percentages must equal 100' });
      }
    }

    // Validate group membership if groupId provided
    if (groupId) {
      const [groupMembers] = await db.pool.query(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, req.user.id]
      );
      if (groupMembers.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Validate all participants are group members
      const participantIds = participants.map(p => p.userId);
      const [members] = await db.pool.query(
        `SELECT user_id FROM group_members WHERE group_id = ? AND user_id IN (${participantIds.map(() => '?').join(',')})`,
        [groupId, ...participantIds]
      );
      if (members.length !== participantIds.length) {
        return res.status(400).json({ error: 'All participants must be group members' });
      }
    }

    // Validate all participants exist
    const participantIds = participants.map(p => p.userId);
    const [users] = await db.pool.query(
      `SELECT id FROM users WHERE id IN (${participantIds.map(() => '?').join(',')})`,
      participantIds
    );
    if (users.length !== participantIds.length) {
      return res.status(400).json({ error: 'One or more participants are invalid' });
    }

    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create expense
      const [expenseResult] = await connection.query(
        'INSERT INTO expenses (description, amount, paid_by, group_id, split_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [description, amount, paidBy, groupId || null, splitType, req.user.id]
      );

      const expenseId = expenseResult.insertId;

      // Calculate shares
      let shares = [];
      if (splitType === 'EQUAL') {
        const shareAmount = parseFloat(amount) / participants.length;
        shares = participants.map(p => ({
          userId: p.userId,
          shareAmount: shareAmount,
          sharePercent: null
        }));
      } else if (splitType === 'EXACT') {
        shares = participants.map(p => ({
          userId: p.userId,
          shareAmount: parseFloat(p.shareAmount),
          sharePercent: null
        }));
      } else if (splitType === 'PERCENT') {
        shares = participants.map(p => ({
          userId: p.userId,
          shareAmount: (parseFloat(amount) * parseFloat(p.sharePercent)) / 100,
          sharePercent: parseFloat(p.sharePercent)
        }));
      }

      // Insert participants
      for (const share of shares) {
        await connection.query(
          'INSERT INTO expense_participants (expense_id, user_id, share_amount, share_percent) VALUES (?, ?, ?, ?)',
          [expenseId, share.userId, share.shareAmount, share.sharePercent]
        );
      }

      await connection.commit();

      // Update balances
      await balanceService.updateBalancesForExpense(expenseId);

      // Send notifications
      const notifyUserIds = participants.filter(p => p.userId !== paidBy).map(p => p.userId);
      for (const userId of notifyUserIds) {
        await notificationService.notifyExpenseAdded(userId, expenseId, groupId);
      }

      const [expenses] = await connection.query(
        `SELECT e.*, 
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('userId', ep.user_id, 'shareAmount', ep.share_amount, 'sharePercent', ep.share_percent))
          FROM expense_participants ep WHERE ep.expense_id = e.id) as participants
         FROM expenses e WHERE e.id = ?`,
        [expenseId]
      );

      res.status(201).json({ expense: expenses[0] });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

const getExpenses = async (req, res) => {
  try {
    const { groupId } = req.query;

    let query = `
      SELECT e.*,
        u.name as paid_by_name,
        u.email as paid_by_email,
        g.name as group_name,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('userId', ep.user_id, 'shareAmount', ep.share_amount, 'sharePercent', ep.share_percent))
         FROM expense_participants ep WHERE ep.expense_id = e.id) as participants
      FROM expenses e
      INNER JOIN users u ON e.paid_by = u.id
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE 1=1
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
      query += ' AND e.group_id = ?';
      params.push(groupId);
    } else {
      // Get expenses where user is participant or payer
      query += ` AND (e.paid_by = ? OR e.id IN (SELECT expense_id FROM expense_participants WHERE user_id = ?))`;
      params.push(req.user.id, req.user.id);
    }

    query += ' ORDER BY e.created_at DESC';

    const [expenses] = await db.pool.query(query, params);

    res.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to get expenses' });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const [expenses] = await db.pool.query(
      `SELECT e.*,
        u.name as paid_by_name,
        u.email as paid_by_email,
        g.name as group_name,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('userId', ep.user_id, 'shareAmount', ep.share_amount, 'sharePercent', ep.share_percent))
         FROM expense_participants ep WHERE ep.expense_id = e.id) as participants
       FROM expenses e
       INNER JOIN users u ON e.paid_by = u.id
       LEFT JOIN groups g ON e.group_id = g.id
       WHERE e.id = ?`,
      [id]
    );

    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Check if user has access
    const expense = expenses[0];
    if (expense.group_id) {
      const [members] = await db.pool.query(
        'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
        [expense.group_id, req.user.id]
      );
      if (members.length === 0) {
        return res.status(403).json({ error: 'You do not have access to this expense' });
      }
    } else {
      // Check if user is participant or creator
      const [participants] = await db.pool.query(
        'SELECT * FROM expense_participants WHERE expense_id = ? AND user_id = ?',
        [id, req.user.id]
      );
      if (participants.length === 0 && expense.created_by !== req.user.id && expense.paid_by !== req.user.id) {
        return res.status(403).json({ error: 'You do not have access to this expense' });
      }
    }

    res.json({ expense: expenses[0] });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to get expense' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { description, amount, splitType, participants } = req.body;

    // Get expense
    const [expenses] = await db.pool.query('SELECT * FROM expenses WHERE id = ?', [id]);
    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = expenses[0];

    // Check if user can update (creator or payer)
    if (expense.created_by !== req.user.id && expense.paid_by !== req.user.id) {
      return res.status(403).json({ error: 'Only creator or payer can update expense' });
    }

    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update expense fields
      const updates = [];
      const params = [];

      if (description) {
        updates.push('description = ?');
        params.push(description);
      }
      if (amount) {
        updates.push('amount = ?');
        params.push(amount);
      }
      if (splitType) {
        updates.push('split_type = ?');
        params.push(splitType);
      }

      if (updates.length > 0) {
        params.push(id);
        await connection.query(
          `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      // Update participants if provided
      if (participants) {
        // Delete old participants
        await connection.query('DELETE FROM expense_participants WHERE expense_id = ?', [id]);

        // Calculate and insert new participants
        const finalAmount = amount || expense.amount;
        const finalSplitType = splitType || expense.split_type;

        let shares = [];
        if (finalSplitType === 'EQUAL') {
          const shareAmount = parseFloat(finalAmount) / participants.length;
          shares = participants.map(p => ({
            userId: p.userId,
            shareAmount: shareAmount,
            sharePercent: null
          }));
        } else if (finalSplitType === 'EXACT') {
          shares = participants.map(p => ({
            userId: p.userId,
            shareAmount: parseFloat(p.shareAmount),
            sharePercent: null
          }));
        } else if (finalSplitType === 'PERCENT') {
          shares = participants.map(p => ({
            userId: p.userId,
            shareAmount: (parseFloat(finalAmount) * parseFloat(p.sharePercent)) / 100,
            sharePercent: parseFloat(p.sharePercent)
          }));
        }

        for (const share of shares) {
          await connection.query(
            'INSERT INTO expense_participants (expense_id, user_id, share_amount, share_percent) VALUES (?, ?, ?, ?)',
            [id, share.userId, share.shareAmount, share.sharePercent]
          );
        }
      }

      await connection.commit();

      // Recalculate balances
      await balanceService.updateBalancesForExpense(id);

      const [updatedExpenses] = await connection.query(
        `SELECT e.*,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('userId', ep.user_id, 'shareAmount', ep.share_amount, 'sharePercent', ep.share_percent))
          FROM expense_participants ep WHERE ep.expense_id = e.id) as participants
         FROM expenses e WHERE e.id = ?`,
        [id]
      );

      res.json({ expense: updatedExpenses[0] });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    // Get expense
    const [expenses] = await db.pool.query('SELECT * FROM expenses WHERE id = ?', [id]);
    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = expenses[0];

    // Check if user can delete (creator or payer)
    if (expense.created_by !== req.user.id && expense.paid_by !== req.user.id) {
      return res.status(403).json({ error: 'Only creator or payer can delete expense' });
    }

    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete expense (cascade will handle participants)
      await connection.query('DELETE FROM expenses WHERE id = ?', [id]);

      await connection.commit();

      // Recalculate balances for the group or users
      await balanceService.recalculateBalances(expense.group_id, expense.paid_by);

      res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense
};

