const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user',
            points INTEGER DEFAULT 30,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
    (err) => {
        if (err) {
            console.error('Error creating users table: ' + err.message);
        } else {
            // Check if columns exist (for migration)
            db.all("PRAGMA table_info(users)", (err, rows) => {
                if (err) return;
                const columns = rows.map(r => r.name);
                if (!columns.includes('points')) {
                    db.run("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 30", (err) => {
                         if (!err) console.log("Added points column");
                    });
                }
                if (!columns.includes('role')) {
                    db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {
                        if (!err) console.log("Added role column");
                        // Create default admin if role column was just added or table is fresh
                        // But strictly, we might want to ensure at least one admin exists.
                        // For simplicity, I'll let the user manually update DB or I can insert a default admin.
                    });
                }
                if (!columns.includes('ip_address')) {
                    db.run("ALTER TABLE users ADD COLUMN ip_address TEXT", (err) => {
                        if (!err) console.log("Added ip_address column");
                    });
                }
            });
        }
    });
  }
});

module.exports = db;
