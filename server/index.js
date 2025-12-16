const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_secret_key_here'; // In production, use environment variable

app.use(cors());
app.use(bodyParser.json());

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'] || req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ error: 'No token provided' });
    }
    // Remove Bearer if present
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;

    jwt.verify(tokenString, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.userId = decoded.id;
        next();
    });
};

// Register Endpoint
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 8);

    const sql = 'INSERT INTO users (username, password, points, role) VALUES (?, ?, ?, ?)';
    // Default points 30, default role user
    const params = [username, hashedPassword, 30, 'user'];

    db.run(sql, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: 'User registered successfully',
            userId: this.lastID
        });
    });
});

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ token: null, error: 'Invalid password' });
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY, {
            expiresIn: 86400 // 24 hours
        });

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                points: user.points,
                role: user.role
            },
            token: token
        });
    });
});

// Get Current User Info
app.get('/api/me', verifyToken, (req, res) => {
    const sql = 'SELECT id, username, points, role FROM users WHERE id = ?';
    db.get(sql, [req.userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

// Deduct Points
app.post('/api/deduct-points', verifyToken, (req, res) => {
    const cost = 10;
    
    // Transaction-like behavior
    db.serialize(() => {
        db.get('SELECT points FROM users WHERE id = ?', [req.userId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'User not found' });
            
            if (row.points < cost) {
                return res.status(400).json({ error: '积分不足，无法生成图片' });
            }
            
            db.run('UPDATE users SET points = points - ? WHERE id = ?', [cost, req.userId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                // Return updated points
                db.get('SELECT points FROM users WHERE id = ?', [req.userId], (err, updatedRow) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, points: updatedRow.points });
                });
            });
        });
    });
});

// Admin: Get All Users
app.get('/api/admin/users', verifyToken, (req, res) => {
    // Check if admin
    db.get('SELECT role FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Require Admin Role' });
        }
        
        db.all('SELECT id, username, points, role, created_at FROM users', [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

// Admin: Update User Points
app.post('/api/admin/update-points', verifyToken, (req, res) => {
    const { userId, points } = req.body;
    
    // Check if admin
    db.get('SELECT role FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Require Admin Role' });
        }
        
        db.run('UPDATE users SET points = ? WHERE id = ?', [points, userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Points updated successfully' });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
