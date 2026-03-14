'use strict';

const EventEmitter = require('events');
const { MqttPrinterClient } = require('./mqttClient');
const { getDb } = require('./db');

class PrinterManager extends EventEmitter {
  constructor() {
    super();
    this._printers = new Map(); // id → MqttPrinterClient
  }

  async loadFromDb() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM printers').all();
    for (const row of rows) {
      this._addClient(row);
    }
    console.log(`[PrinterManager] Loaded ${rows.length} printer(s) from DB`);
  }

  _addClient(row) {
    const client = new MqttPrinterClient({
      id: row.id,
      name: row.name,
      ip: row.ip,
      serial: row.serial,
      accessCode: row.access_code,
    });

    client.on('stateUpdate', (state) => {
      this.emit('stateUpdate', row.id, state);
    });

    client.on('connected', () => {
      this.emit('stateUpdate', row.id, client.getFullState());
    });

    client.on('disconnected', () => {
      this.emit('stateUpdate', row.id, client.getFullState());
    });

    this._printers.set(row.id, client);
    client.connect();
    return client;
  }

  addPrinter(printerRow) {
    if (this._printers.has(printerRow.id)) return;
    this._addClient(printerRow);
  }

  removePrinter(id) {
    const client = this._printers.get(id);
    if (!client) return;
    client.destroy();
    this._printers.delete(id);
  }

  sendCommand(id, command, params = {}) {
    const client = this._printers.get(id);
    if (!client) throw new Error(`Printer ${id} not found`);
    switch (command) {
      case 'pause':  client.pause(); break;
      case 'resume': client.resume(); break;
      case 'stop':   client.stop(); break;
      case 'setSpeedLevel': client.setSpeedLevel(params.level); break;
      case 'setLight':      client.setLight(params.on); break;
      case 'setFanSpeed':   client.setFanSpeed(params.fanType, params.speed); break;
      case 'setTemperature': client.setTemperature(params.type, params.temp); break;
      default: throw new Error(`Unknown command: ${command}`);
    }
  }

  getState(id) {
    const client = this._printers.get(id);
    if (!client) return null;
    return client.getFullState();
  }

  getAllState() {
    const result = {};
    for (const [id, client] of this._printers) {
      result[id] = client.getFullState();
    }
    return result;
  }

  disconnectAll() {
    for (const client of this._printers.values()) {
      client.destroy();
    }
    this._printers.clear();
  }
}

// Singleton
const printerManager = new PrinterManager();
module.exports = { printerManager };
