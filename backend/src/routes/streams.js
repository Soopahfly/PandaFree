'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../auth');
const { getDb } = require('../db');
const streamManager = require('../streamManager');

router.use(authenticate);

// GET /api/streams
router.get('/', (req, res) => {
  const cameras = getDb().prepare('SELECT * FROM cameras').all();
  res.json(cameras);
});

// POST /api/streams  — add external RTSP or Bambu camera
router.post('/', async (req, res) => {
  const { name, url, printerId, type } = req.body || {};
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

  const id = uuidv4();
  const streamType = type || 'rtsp';
  getDb().prepare(`
    INSERT INTO cameras (id, name, url, printer_id, type) VALUES (?, ?, ?, ?, ?)
  `).run(id, name, url, printerId || null, streamType);

  await streamManager.addStream(id, name, url);
  res.status(201).json({ id, name, url, type: streamType });
});

// POST /api/streams/bambu  — auto-configure Bambu built-in camera
router.post('/bambu', async (req, res) => {
  const { printerId } = req.body || {};
  if (!printerId) return res.status(400).json({ error: 'printerId required' });

  const db = getDb();
  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(printerId);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });

  // Bambu camera URL format for go2rtc
  const url = `rtsps://bblp:${printer.access_code}@${printer.ip}:322`;
  const id = uuidv4();
  const name = `${printer.name} (Built-in Camera)`;

  db.prepare(`
    INSERT OR REPLACE INTO cameras (id, name, url, printer_id, type) VALUES (?, ?, ?, ?, 'bambu')
  `).run(id, name, url, printerId);

  await streamManager.addStream(id, name, url);
  res.status(201).json({ id, name, url, type: 'bambu' });
});

// DELETE /api/streams/:id
router.delete('/:id', async (req, res) => {
  const cam = getDb().prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id);
  if (!cam) return res.status(404).json({ error: 'Camera not found' });
  getDb().prepare('DELETE FROM cameras WHERE id = ?').run(req.params.id);
  await streamManager.removeStream(req.params.id);
  res.json({ ok: true });
});

// GET /api/streams/:id/webrtc-url  — return viewer URL for frontend
router.get('/:id/webrtc-url', (req, res) => {
  // Frontend uses go2rtc directly via /streams/ prefix (proxied by nginx)
  res.json({ url: `/streams/api/ws?src=${req.params.id}` });
});

module.exports = router;
