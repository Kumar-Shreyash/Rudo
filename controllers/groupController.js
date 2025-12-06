const db = require('../config/database');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');

const createGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    const connection = await db.pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create group
      const [result] = await connection.query(
        'INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)',
        [name, description || null, req.user.id]
      );

      const groupId = result.insertId;

      // Add creator as admin member
      await connection.query(
        'INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, ?)',
        [groupId, req.user.id, true]
      );

      await connection.commit();

      const [groups] = await connection.query(
        'SELECT * FROM groups WHERE id = ?',
        [groupId]
      );

      res.status(201).json({ group: groups[0] });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

const getUserGroups = async (req, res) => {
  try {
    const [groups] = await db.pool.query(
      `SELECT g.*, gm.is_admin
       FROM groups g
       INNER JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );

    res.json({ groups });
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
};

const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is member
    const [members] = await db.pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const [groups] = await db.pool.query('SELECT * FROM groups WHERE id = ?', [id]);

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ group: groups[0], isAdmin: members[0].is_admin });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
};

const updateGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    // Check if user is admin or creator
    const [members] = await db.pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND is_admin = ?',
      [id, req.user.id, true]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Only admins can update groups' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    await db.pool.query(
      `UPDATE groups SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [groups] = await db.pool.query('SELECT * FROM groups WHERE id = ?', [id]);
    res.json({ group: groups[0] });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is creator
    const [groups] = await db.pool.query(
      'SELECT * FROM groups WHERE id = ? AND created_by = ?',
      [id, req.user.id]
    );

    if (groups.length === 0) {
      return res.status(403).json({ error: 'Only group creator can delete the group' });
    }

    await db.pool.query('DELETE FROM groups WHERE id = ?', [id]);
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

const addMember = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { userId } = req.body;

    // Check if requester is admin
    const [members] = await db.pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND is_admin = ?',
      [id, req.user.id, true]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    // Check if user exists
    const [users] = await db.pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const [existing] = await db.pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    await db.pool.query(
      'INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, ?)',
      [id, userId, false]
    );

    // Send notification
    await notificationService.notifyUserAddedToGroup(userId, id);

    res.status(201).json({ message: 'Member added successfully' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
};

const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    // Check if requester is admin or creator
    const [groups] = await db.pool.query(
      'SELECT * FROM groups WHERE id = ?',
      [id]
    );

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isCreator = groups[0].created_by === req.user.id;
    const [members] = await db.pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, req.user.id]
    );

    const isAdmin = members.length > 0 && members[0].is_admin;

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only admins or creators can remove members' });
    }

    // Cannot remove creator
    if (parseInt(userId) === groups[0].created_by) {
      return res.status(400).json({ error: 'Cannot remove group creator' });
    }

    await db.pool.query(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

const getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is member
    const [userMember] = await db.pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (userMember.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const [members] = await db.pool.query(
      `SELECT u.id, u.firebase_uid, u.email, u.name, gm.is_admin, gm.joined_at
       FROM group_members gm
       INNER JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY gm.is_admin DESC, gm.joined_at ASC`,
      [id]
    );

    res.json({ members });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ error: 'Failed to get group members' });
  }
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  getGroupMembers
};

