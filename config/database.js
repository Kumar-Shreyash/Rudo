const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '!Debashrita12!',
  database: process.env.DB_NAME || 'RUDO',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const initialize = async () => {
  try {
    // Create database if it doesn't exist
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "!Debashrita12!",
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || "RUDO"}`
    );
    await connection.end();

    // Create tables
    await createTables();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

const createTables = async () => {
  const queries = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firebase_uid VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_firebase_uid (firebase_uid)
    )`,

    // Groups table
    `CREATE TABLE IF NOT EXISTS groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_created_by (created_by)
    )`,

    // Group members table
    `CREATE TABLE IF NOT EXISTS group_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      user_id INT NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_group_user (group_id, user_id),
      INDEX idx_group_id (group_id),
      INDEX idx_user_id (user_id)
    )`,

    // Expenses table
    `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      paid_by INT NOT NULL,
      group_id INT,
      split_type ENUM('EQUAL', 'EXACT', 'PERCENT') NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_paid_by (paid_by),
      INDEX idx_group_id (group_id),
      INDEX idx_created_by (created_by)
    )`,

    // Expense participants table
    `CREATE TABLE IF NOT EXISTS expense_participants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      expense_id INT NOT NULL,
      user_id INT NOT NULL,
      share_amount DECIMAL(10, 2) NOT NULL,
      share_percent DECIMAL(5, 2),
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_expense_user (expense_id, user_id),
      INDEX idx_expense_id (expense_id),
      INDEX idx_user_id (user_id)
    )`,

    // Balances table
    `CREATE TABLE IF NOT EXISTS balances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      owes_to INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      group_id INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (owes_to) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      UNIQUE KEY unique_balance (user_id, owes_to, group_id),
      INDEX idx_user_id (user_id),
      INDEX idx_owes_to (owes_to),
      INDEX idx_group_id (group_id)
    )`,

    // Settlements table
    `CREATE TABLE IF NOT EXISTS settlements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      paid_by INT NOT NULL,
      paid_to INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      group_id INT,
      notes TEXT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_to) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_paid_by (paid_by),
      INDEX idx_paid_to (paid_to),
      INDEX idx_group_id (group_id)
    )`,

    // FCM tokens table (for notifications)
    `CREATE TABLE IF NOT EXISTS fcm_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(500) NOT NULL,
      device_info TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_token (user_id, token),
      INDEX idx_user_id (user_id)
    )`
  ];

  for (const query of queries) {
    await pool.query(query);
  }
};

module.exports = {
  pool,
  initialize
};

