'use strict';

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'pandafree.db');

let db;

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      serial TEXT NOT NULL,
      access_code TEXT NOT NULL,
      model TEXT DEFAULT 'Unknown',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS cameras (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      printer_id TEXT REFERENCES printers(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'rtsp',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS token_blocklist (
      jti TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `);

  // Migrate: add role column to existing DBs that don't have it
  const cols = db.pragma('table_info(users)').map(c => c.name);
  if (!cols.includes('role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
    console.log('[DB] Migrated users table: added role column');
  }

  // Seed admin user if none exist
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (count.c === 0) {
    const { v4: uuidv4 } = require('uuid');
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'changeme';
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(uuidv4(), username, hash, 'admin');
    console.log(`[DB] Created admin user: ${username}`);
  } else {
    // Ensure there is at least one admin
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get();
    if (adminCount.c === 0) {
      const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
      if (firstUser) {
        db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(firstUser.id);
        console.log('[DB] Promoted first user to admin');
      }
    }
  }

  console.log('[DB] Initialized at', DB_PATH);
  return db;
}

// ── User CRUD helpers ────────────────────────────────────────────────────────

function listUsers() {
  return getDb().prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all();
}

function getUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

async function createUser(username, password, role = 'user') {
  const { v4: uuidv4 } = require('uuid');
  const hash = await bcrypt.hash(password, 12);
  getDb().prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(uuidv4(), username, hash, role);
}

async function changePassword(id, newPassword) {
  const hash = await bcrypt.hash(newPassword, 12);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
}

function deleteUser(id) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

module.exports = { initDb, getDb, listUsers, getUserById, createUser, changePassword, deleteUser };
