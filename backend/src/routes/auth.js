'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { loginUser, signToken, blockToken, authenticate } = require('../auth');
const { getDb, changePassword } = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = await loginUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user.id, user.username, user.role);
  res.json({ token, username: user.username, role: user.role });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  const header = req.headers.authorization;
  if (header) blockToken(header.slice(7));
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, role: user.role });
});

// PUT /api/auth/password — change own password
router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(403).json({ error: 'Current password is incorrect' });
  await changePassword(user.id, newPassword);
  res.json({ ok: true });
});

module.exports = router;
