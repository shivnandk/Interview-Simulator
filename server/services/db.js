const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../interview.sqlite');
const db = new sqlite3.Database(dbPath);

function initDB() {
    db.serialize(() => {
        db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        config TEXT,
        video_enabled INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Migration: Add config column if it doesn't exist (for existing tables)
        db.all("PRAGMA table_info(sessions)", (err, rows) => {
            if (err) return;
            const hasConfig = rows.some(row => row.name === 'config');
            if (!hasConfig) {
                db.run("ALTER TABLE sessions ADD COLUMN config TEXT");
            }
        });

        db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      )
    `);
    });
}

function createSession(sessionId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT INTO sessions (id) VALUES (?)");
        stmt.run(sessionId, function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
        stmt.finalize();
    });
}

function addMessage(sessionId, role, content) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)");
        stmt.run(sessionId, role, content, function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
        stmt.finalize();
    });
}

function getRecentMessages(sessionId, limit = 10) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
            [sessionId, limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows.reverse());
            }
        );
    });
}

function getAllSessions() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM sessions ORDER BY started_at DESC", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function updateSessionConfig(sessionId, config) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("UPDATE sessions SET config = ? WHERE id = ?");
        stmt.run(JSON.stringify(config), sessionId, function (err) {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

function getSessionConfig(sessionId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT config FROM sessions WHERE id = ?", [sessionId], (err, row) => {
            if (err) reject(err);
            else resolve(row?.config ? JSON.parse(row.config) : null);
        });
    });
}

function getFullHistory(sessionId) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY id ASC",
            [sessionId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = {
    initDB,
    createSession,
    updateSessionConfig,
    getSessionConfig,
    addMessage,
    getRecentMessages,
    getAllSessions,
    getFullHistory
};
