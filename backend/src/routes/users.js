'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate } = require('../auth');
const { getDb, listUsers, createUser, changePassword, deleteUser, getUserById } = require('../db');

// Middleware: admin only
function requireAdmin(req, res, next) {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.sub);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /api/users — list all users (admin)
router.get('/', authenticate, requireAdmin, (_req, res) => {
  res.json(listUsers());
});

// POST /api/users — create user (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  const validatedRole = role === 'admin' ? 'admin' : 'user';
  try {
    await createUser(username, password, validatedRole);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    throw e;
  }
});

// DELETE /api/users/:id — delete user (admin, cannot delete self)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  deleteUser(req.params.id);
  res.json({ ok: true });
});

// PUT /api/users/:id/password — admin reset any user's password
router.put('/:id/password', authenticate, requireAdmin, async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await changePassword(req.params.id, password);
  res.json({ ok: true });
});

module.exports = router;
