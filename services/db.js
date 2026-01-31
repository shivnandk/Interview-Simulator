const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../interview.sqlite');
const db = new sqlite3.Database(dbPath);

function initDB() {
    db.serialize(() => {
        db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        video_enabled INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

module.exports = {
    initDB,
    createSession,
    addMessage,
    getRecentMessages
};
