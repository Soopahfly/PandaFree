'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../auth');
const { getDb } = require('../db');
const { printerManager } = require('../printerManager');

// All routes require auth
router.use(authenticate);

// GET /api/printers
router.get('/', (req, res) => {
  const db = getDb();
  const printers = db.prepare('SELECT id, name, ip, serial, model, created_at FROM printers').all();
  const state = printerManager.getAllState();
  const result = printers.map(p => ({ ...p, state: state[p.id] || null }));
  res.json(result);
});

// POST /api/printers
router.post('/', (req, res) => {
  const { name, ip, serial, accessCode, model } = req.body || {};
  if (!name || !ip || !serial || !accessCode) {
    return res.status(400).json({ error: 'name, ip, serial, and accessCode are required' });
  }
  const db = getDb();
  const id = uuidv4();
  try {
    db.prepare(`
      INSERT INTO printers (id, name, ip, serial, access_code, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, ip, serial, accessCode, model || 'Unknown');
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Printer with this serial already exists' });
    }
    throw e;
  }
  const row = db.prepare('SELECT * FROM printers WHERE id = ?').get(id);
  printerManager.addPrinter(row);
  res.status(201).json({ id, name, ip, serial, model: model || 'Unknown' });
});

// DELETE /api/printers/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });
  db.prepare('DELETE FROM printers WHERE id = ?').run(req.params.id);
  printerManager.removePrinter(req.params.id);
  res.json({ ok: true });
});

// GET /api/printers/:id/state
router.get('/:id/state', (req, res) => {
  const state = printerManager.getState(req.params.id);
  if (!state) return res.status(404).json({ error: 'Printer not found or offline' });
  res.json(state);
});

// POST /api/printers/:id/command
router.post('/:id/command', (req, res) => {
  const { command, params } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command is required' });
  try {
    printerManager.sendCommand(req.params.id, command, params || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
