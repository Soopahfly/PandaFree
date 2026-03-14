'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = '24h';

function signToken(userId, username, role = 'user') {
  const { v4: uuidv4 } = require('uuid');
  const jti = uuidv4();
  return jwt.sign({ sub: userId, username, role, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Check blocklist
    const blocked = getDb()
      .prepare('SELECT 1 FROM token_blocklist WHERE jti = ?')
      .get(decoded.jti);
    if (blocked) return null;
    return decoded;
  } catch {
    return null;
  }
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const decoded = verifyToken(header.slice(7));
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = decoded;
  next();
}

async function loginUser(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;
  return user;
}

function blockToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.jti || !decoded?.exp) return;
    getDb()
      .prepare('INSERT OR IGNORE INTO token_blocklist (jti, expires_at) VALUES (?, ?)')
      .run(decoded.jti, decoded.exp);
  } catch { /* ignore */ }
}

function cleanBlocklist() {
  getDb()
    .prepare('DELETE FROM token_blocklist WHERE expires_at < ?')
    .run(Math.floor(Date.now() / 1000));
}

// Clean expired tokens every hour
setInterval(cleanBlocklist, 3600 * 1000);

module.exports = { signToken, verifyToken, authenticate, loginUser, blockToken };
