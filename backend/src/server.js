'use strict';

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { initDb } = require('./db');
const authRouter = require('./routes/auth');
const printersRouter = require('./routes/printers');
const streamsRouter = require('./routes/streams');
const usersRouter = require('./routes/users');
const { printerManager } = require('./printerManager');
const { verifyToken } = require('./auth');
const streamManager = require('./streamManager');

const PORT = process.env.PORT || 3000;

async function main() {
  // Init database & seed admin user
  initDb();
  // Seed go2rtc config from stored cameras
  streamManager.initStreams();

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/printers', printersRouter);
  app.use('/api/streams', streamsRouter);
  app.use('/api/users', usersRouter);

  // HTTP server
  const server = http.createServer(app);

  // WebSocket server – live printer state broadcasts
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Authenticate via ?token= query param
    const url = new URL(req.url, `http://localhost`);
    const token = url.searchParams.get('token');
    if (!token || !verifyToken(token)) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('error', () => {});

    // Send current full state on connect
    const state = printerManager.getAllState();
    ws.send(JSON.stringify({ type: 'full_state', payload: state }));
  });

  // Heartbeat to detect dead sockets
  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  // Broadcast to all authenticated WS clients
  printerManager.on('stateUpdate', (printerId, state) => {
    const msg = JSON.stringify({ type: 'printer_update', printerId, payload: state });
    wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  });

  // Boot printer connections from DB
  await printerManager.loadFromDb();

  server.listen(PORT, () => {
    console.log(`[PandaFree] Backend listening on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[PandaFree] Shutting down...');
    printerManager.disconnectAll();
    server.close(() => process.exit(0));
  });
}

main().catch(err => {
  console.error('[PandaFree] Fatal startup error:', err);
  process.exit(1);
});
