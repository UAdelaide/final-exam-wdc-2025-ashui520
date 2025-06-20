const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// Login route: Handle user login requests
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM Users WHERE username = ?', 
      [username]
    );

    if (rows.length === 0) {
      await connection.end();
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];
    
    // Plain text password comparison
    if (password !== user.password_hash) {
      await connection.end();
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Store user information in session on successful login
    req.session.user = {
      userId: user.user_id,
      username: user.username,
      role: user.role
    };

    await connection.end();
    res.json({ 
      message: 'Login successful', 
      redirectTo: user.role === 'owner' ? '/owner-dashboard.html' : '/walker-dashboard.html' 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout route: Clear session information
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// Login status check route: Return user login status
router.get('/status', (req, res) => {
  if (req.session.user) {
    res.json({ 
      isLoggedIn: true,
      user: {
        username: req.session.user.username,
        role: req.session.user.role
      }
    });
  } else {
    res.json({ isLoggedIn: false });
  }
});

module.exports = router;