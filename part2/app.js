const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'DogWalkService'
};

// Middleware configuration
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));
app.use(cookieParser());
app.use(session({
  secret: 'dogWalkingServiceSecret', // Replace with a secure secret key
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 1000 } // Session expires in 24 hours
}));

// Global middleware to check login status
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.user;
  next();
});

// Route imports
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');

// Route registration
app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// Middleware for unauthenticated users: Redirect to login page if not logged in
app.get('/*', (req, res, next) => {
  if (!req.session.user && req.path !== '/' && !req.path.startsWith('/api')) {
    res.redirect('/');
  } else {
    next();
  }
});

module.exports = app;