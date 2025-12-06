const admin = require('../config/firebase');
const db = require('../config/database');

const getFCMTokens = async (userId) => {
  try {
    const [tokens] = await db.pool.query(
      'SELECT token FROM fcm_tokens WHERE user_id = ?',
      [userId]
    );
    return tokens.map(t => t.token);
  } catch (error) {
    console.error('Get FCM tokens error:', error);
    return [];
  }
};

const sendNotification = async (tokens, title, body, data = {}) => {
  if (tokens.length === 0) return;

  const message = {
    notification: {
      title,
      body
    },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    },
    tokens
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications`);
    
    // Remove invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      if (failedTokens.length > 0) {
        await db.pool.query(
          `DELETE FROM fcm_tokens WHERE token IN (${failedTokens.map(() => '?').join(',')})`,
          failedTokens
        );
      }
    }
  } catch (error) {
    console.error('Send notification error:', error);
  }
};

const notifyUserAddedToGroup = async (userId, groupId) => {
  try {
    const [groups] = await db.pool.query('SELECT name FROM groups WHERE id = ?', [groupId]);
    const groupName = groups.length > 0 ? groups[0].name : 'a group';

    const tokens = await getFCMTokens(userId);
    await sendNotification(
      tokens,
      'Added to Group',
      `You have been added to ${groupName}`,
      { type: 'group_added', groupId: groupId.toString() }
    );
  } catch (error) {
    console.error('Notify user added to group error:', error);
  }
};

const notifyExpenseAdded = async (userId, expenseId, groupId) => {
  try {
    const [expenses] = await db.pool.query(
      'SELECT description, amount FROM expenses WHERE id = ?',
      [expenseId]
    );
    
    if (expenses.length === 0) return;

    const expense = expenses[0];
    const tokens = await getFCMTokens(userId);
    
    await sendNotification(
      tokens,
      'New Expense',
      `${expense.description} - $${parseFloat(expense.amount).toFixed(2)}`,
      {
        type: 'expense_added',
        expenseId: expenseId.toString(),
        groupId: groupId ? groupId.toString() : ''
      }
    );
  } catch (error) {
    console.error('Notify expense added error:', error);
  }
};

const notifySettlement = async (userId, settlementId, groupId) => {
  try {
    const [settlements] = await db.pool.query(
      `SELECT s.amount, pb.name as paid_by_name
       FROM settlements s
       INNER JOIN users pb ON s.paid_by = pb.id
       WHERE s.id = ?`,
      [settlementId]
    );

    if (settlements.length === 0) return;

    const settlement = settlements[0];
    const tokens = await getFCMTokens(userId);

    await sendNotification(
      tokens,
      'Settlement Recorded',
      `${settlement.paid_by_name} paid you $${parseFloat(settlement.amount).toFixed(2)}`,
      {
        type: 'settlement',
        settlementId: settlementId.toString(),
        groupId: groupId ? groupId.toString() : ''
      }
    );
  } catch (error) {
    console.error('Notify settlement error:', error);
  }
};

module.exports = {
  notifyUserAddedToGroup,
  notifyExpenseAdded,
  notifySettlement
};

