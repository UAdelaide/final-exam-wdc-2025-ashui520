const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const port = 8080;

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'DogWalkService',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    await connection.query('DELETE FROM WalkRatings');
    await connection.query('DELETE FROM WalkApplications');
    await connection.query('DELETE FROM WalkRequests');
    await connection.query('DELETE FROM Dogs');
    await connection.query('DELETE FROM Users');
    
    await connection.query(`
      INSERT INTO Users (username, email, password_hash, role) VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('daveowner', 'dave@example.com', 'hashed101', 'owner'),
      ('evewalker', 'eve@example.com', 'hashed112', 'walker')
    `);
    
    await connection.query(`
      INSERT INTO Dogs (owner_id, name, size) VALUES
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Charlie', 'large'),
      ((SELECT user_id FROM Users WHERE username = 'daveowner'), 'Lucy', 'small'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Buddy', 'medium')
    `);
    
    await connection.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
      ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Charlie'), '2025-06-11 10:00:00', 60, 'Central Park', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Lucy'), '2025-06-12 14:00:00', 30, 'Riverside', 'completed'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Buddy'), '2025-06-13 16:30:00', 45, 'Hilltop', 'open')
    `);
    
    await connection.query(`
      INSERT INTO WalkApplications (request_id, walker_id, status) VALUES
      (1, (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'pending'),
      (3, (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
      (5, (SELECT user_id FROM Users WHERE username = 'evewalker'), 'pending')
    `);
    
    await connection.query(`
      INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) VALUES
      (2, (SELECT user_id FROM Users WHERE username = 'bobwalker'), 
          (SELECT user_id FROM Users WHERE username = 'carol123'), 5, 'Great service!'),
      (4, (SELECT user_id FROM Users WHERE username = 'bobwalker'), 
          (SELECT user_id FROM Users WHERE username = 'daveowner'), 4, 'Good walker')
    `);
    
    connection.release();
  } catch (err) {
    throw err;
  }
}

app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, 
             wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.username AS walker_username,
        COUNT(wr.rating_id) AS total_ratings,
        AVG(wr.rating) AS average_rating,
        COUNT(DISTINCT CASE WHEN wa.status = 'accepted' THEN wa.request_id END) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRatings wr ON u.user_id = wr.walker_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id, u.username
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summary' });
  }
});

initializeDatabase().then(() => {
  app.listen(port, () => {});
});