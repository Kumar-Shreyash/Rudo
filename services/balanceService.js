const db = require('../config/database');

const updateBalancesForExpense = async (expenseId) => {
  try {
    // Get expense details
    const [expenses] = await db.pool.query(
      `SELECT e.*, 
       (SELECT JSON_ARRAYAGG(JSON_OBJECT('userId', ep.user_id, 'shareAmount', ep.share_amount))
        FROM expense_participants ep WHERE ep.expense_id = e.id) as participants
       FROM expenses e WHERE e.id = ?`,
      [expenseId]
    );

    if (expenses.length === 0) return;

    const expense = expenses[0];
    const participants = JSON.parse(expense.participants || '[]');
    const paidBy = expense.paid_by;
    const groupId = expense.group_id;

    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update balances for each participant
      // Only create balances for participants who didn't pay (they owe the payer)
      for (const participant of participants) {
        const userId = participant.userId;
        const shareAmount = parseFloat(participant.shareAmount);

        // If participant is not the payer, they owe the payer their share
        if (userId !== paidBy) {
          await updateBalance(connection, userId, paidBy, shareAmount, groupId);
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update balances for expense error:', error);
    throw error;
  }
};

const updateBalance = async (connection, userId, owesTo, amount, groupId) => {
  // Check if balance exists
  const [existing] = await connection.query(
    'SELECT * FROM balances WHERE user_id = ? AND owes_to = ? AND (group_id = ? OR (group_id IS NULL AND ? IS NULL))',
    [userId, owesTo, groupId, groupId]
  );

  if (existing.length > 0) {
    const newAmount = parseFloat(existing[0].amount) + parseFloat(amount);
    if (Math.abs(newAmount) < 0.01) {
      // Balance is effectively zero, delete it
      await connection.query(
        'DELETE FROM balances WHERE id = ?',
        [existing[0].id]
      );
    } else {
      await connection.query(
        'UPDATE balances SET amount = ? WHERE id = ?',
        [newAmount, existing[0].id]
      );
    }
  } else {
    await connection.query(
      'INSERT INTO balances (user_id, owes_to, amount, group_id) VALUES (?, ?, ?, ?)',
      [userId, owesTo, amount, groupId]
    );
  }
};

const recalculateBalances = async (groupId, userId) => {
  try {
    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete existing balances for the group/user
      if (groupId) {
        await connection.query('DELETE FROM balances WHERE group_id = ?', [groupId]);
      } else if (userId) {
        await connection.query(
          'DELETE FROM balances WHERE (user_id = ? OR owes_to = ?) AND group_id IS NULL',
          [userId, userId]
        );
      }  

      // Recalculate from expenses
      let query = `
        SELECT e.*,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('userId', ep.user_id, 'shareAmount', ep.share_amount))
          FROM expense_participants ep WHERE ep.expense_id = e.id) as participants
        FROM expenses e
        WHERE 1=1
      `;
      const params = [];

      if (groupId) {
        query += ' AND e.group_id = ?';
        params.push(groupId);
      } else if (userId) {
        query += ' AND (e.paid_by = ? OR e.id IN (SELECT expense_id FROM expense_participants WHERE user_id = ?)) AND e.group_id IS NULL';
        params.push(userId, userId);
      }

      const [expenses] = await connection.query(query, params);

      for (const expense of expenses) {
        const participants = JSON.parse(expense.participants || '[]');
        const paidBy = expense.paid_by;

        for (const participant of participants) {
          const participantUserId = participant.userId;
          const shareAmount = parseFloat(participant.shareAmount);

          if (participantUserId !== paidBy) {
            await updateBalance(
              connection,
              participantUserId,
              paidBy,
              shareAmount,
              groupId
            );
          }
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Recalculate balances error:', error);
    throw error;
  }
};

module.exports = {
  updateBalancesForExpense,
  recalculateBalances
};

