'use strict';

const mqtt = require('mqtt');
const EventEmitter = require('events');

const RECONNECT_MIN = 2000;
const RECONNECT_MAX = 30000;

class MqttPrinterClient extends EventEmitter {
  constructor({ id, name, ip, serial, accessCode }) {
    super();
    this.id = id;
    this.name = name;
    this.ip = ip;
    this.serial = serial;
    this.accessCode = accessCode;
    this.client = null;
    this.state = this._defaultState();
    this.connected = false;
    this._reconnectDelay = RECONNECT_MIN;
    this._destroyed = false;
  }

  _defaultState() {
    return {
      connected: false,
      printStatus: 'offline',
      gcodeState: 'IDLE',
      fileName: '',
      progress: 0,
      layer: 0,
      totalLayers: 0,
      remainSecs: 0,
      nozzleTemp: 0,
      nozzleTempTarget: 0,
      bedTemp: 0,
      bedTempTarget: 0,
      chamberTemp: 0,
      fanSpeed: 0,
      auxFanSpeed: 0,
      chamberFanSpeed: 0,
      speedLevel: 1,
      lightOn: false,
      ams: [],
      errors: [],
      lastUpdate: null,
    };
  }

  connect() {
    if (this._destroyed) return;
    const url = `mqtts://${this.ip}:8883`;
    console.log(`[MQTT] Connecting to ${this.name} at ${url}`);

    this.client = mqtt.connect(url, {
      username: 'bblp',
      password: this.accessCode,
      clientId: `pandafree_${this.serial}_${Date.now()}`,
      rejectUnauthorized: false,
      reconnectPeriod: 0, // manual reconnect
      connectTimeout: 10000,
    });

    this.client.on('connect', () => {
      console.log(`[MQTT] Connected: ${this.name}`);
      this._reconnectDelay = RECONNECT_MIN;
      this.connected = true;
      this.state.connected = true;
      this.state.printStatus = 'idle';
      this.emit('connected');

      // Subscribe to printer report topic
      this.client.subscribe(`device/${this.serial}/report`, { qos: 0 });

      // Request full status dump
      this._pushAll();
    });

    this.client.on('message', (_topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        this._handleMessage(msg);
      } catch (e) {
        console.warn(`[MQTT] Parse error from ${this.name}:`, e.message);
      }
    });

    this.client.on('error', (err) => {
      console.warn(`[MQTT] Error on ${this.name}:`, err.message);
    });

    this.client.on('close', () => {
      if (this._destroyed) return;
      this.connected = false;
      this.state.connected = false;
      this.state.printStatus = 'offline';
      this.emit('disconnected');
      this._scheduleReconnect();
    });
  }

  _scheduleReconnect() {
    if (this._destroyed) return;
    console.log(`[MQTT] Reconnecting ${this.name} in ${this._reconnectDelay}ms`);
    setTimeout(() => {
      if (!this._destroyed) this.connect();
    }, this._reconnectDelay);
    // Exponential backoff
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX);
  }

  _handleMessage(msg) {
    const print = msg?.print;
    if (!print) return;

    // Map Bambu JSON fields → normalized state
    if (print.gcode_state !== undefined)     this.state.gcodeState = print.gcode_state;
    if (print.mc_percent !== undefined)      this.state.progress = print.mc_percent;
    if (print.layer_num !== undefined)       this.state.layer = print.layer_num;
    if (print.total_layer_num !== undefined) this.state.totalLayers = print.total_layer_num;
    if (print.mc_remaining_time !== undefined) this.state.remainSecs = print.mc_remaining_time * 60;
    if (print.subtask_name !== undefined)    this.state.fileName = print.subtask_name;
    if (print.nozzle_temper !== undefined)   this.state.nozzleTemp = print.nozzle_temper;
    if (print.nozzle_target_temper !== undefined) this.state.nozzleTempTarget = print.nozzle_target_temper;
    if (print.bed_temper !== undefined)      this.state.bedTemp = print.bed_temper;
    if (print.bed_target_temper !== undefined)    this.state.bedTempTarget = print.bed_target_temper;
    if (print.chamber_temper !== undefined)  this.state.chamberTemp = print.chamber_temper;
    if (print.cooling_fan_speed !== undefined) this.state.fanSpeed = Math.round(Number(print.cooling_fan_speed) / 15 * 100);
    if (print.big_fan1_speed !== undefined)  this.state.auxFanSpeed = Math.round(Number(print.big_fan1_speed) / 15 * 100);
    if (print.big_fan2_speed !== undefined)  this.state.chamberFanSpeed = Math.round(Number(print.big_fan2_speed) / 15 * 100);
    if (print.spd_lvl !== undefined)         this.state.speedLevel = print.spd_lvl;

    // Lights
    if (Array.isArray(print.lights_report)) {
      const chamberLight = print.lights_report.find(l => l.node === 'chamber_light');
      if (chamberLight) this.state.lightOn = chamberLight.mode === 'on';
    }

    // AMS
    if (print.ams?.ams) {
      this.state.ams = print.ams.ams.map(unit => ({
        id: unit.id,
        trays: (unit.tray || []).map(t => ({
          id: t.id,
          type: t.tray_type,
          color: t.tray_color ? `#${t.tray_color.substring(0, 6)}` : null,
          name: t.tray_sub_brands || t.tray_type || 'Unknown',
          remain: t.remain,
        })),
      }));
    }

    // Errors
    if (Array.isArray(print.hms)) {
      this.state.errors = print.hms.map(e => ({ code: e.code, msg: e.note || 'Printer error' }));
    }

    // Derive human-readable print status
    this.state.printStatus = this._deriveStatus(this.state.gcodeState);
    this.state.lastUpdate = Date.now();
    this.emit('stateUpdate', this.state);
  }

  _deriveStatus(gcodeState) {
    if (!this.connected) return 'offline';
    const map = {
      IDLE: 'idle',
      PREPARE: 'preparing',
      RUNNING: 'printing',
      PAUSE: 'paused',
      FINISH: 'finished',
      FAILED: 'failed',
    };
    return map[gcodeState] || 'idle';
  }

  _pushAll() {
    this._publish({ pushing: { sequence_id: '1', command: 'pushall' } });
  }

  _publish(payload) {
    if (!this.client?.connected) return;
    this.client.publish(
      `device/${this.serial}/request`,
      JSON.stringify(payload),
      { qos: 0 }
    );
  }

  // ---- Control Commands ----

  pause()  { this._publish({ print: { sequence_id: '1', command: 'pause' } }); }
  resume() { this._publish({ print: { sequence_id: '1', command: 'resume' } }); }
  stop()   { this._publish({ print: { sequence_id: '1', command: 'stop' } }); }

  setSpeedLevel(level) {
    // 1=silent, 2=standard, 3=sport, 4=ludicrous
    this._publish({ print: { sequence_id: '1', command: 'print_speed', param: String(level) } });
  }

  setLight(on) {
    this._publish({
      system: {
        sequence_id: '1',
        command: 'ledctrl',
        led_node: 'chamber_light',
        led_mode: on ? 'on' : 'off',
        led_on_time: 500,
        led_off_time: 500,
        loop_times: 0,
        interval_time: 0,
      },
    });
  }

  setFanSpeed(fanType, speed) {
    // fanType: 'part_fan' | 'aux_fan' | 'chamber_fan'
    // speed: 0-100
    const value = Math.round((speed / 100) * 255);
    this._publish({ print: { sequence_id: '1', command: 'system', target: fanType, value } });
  }

  setTemperature(type, temp) {
    // type: 'nozzle' | 'bed'
    const cmd = type === 'nozzle' ? 'set_nozzle_temp' : 'set_bed_temp';
    this._publish({ print: { sequence_id: '1', command: cmd, target_temper: temp } });
  }

  getFullState() {
    return { ...this.state, id: this.id, name: this.name, ip: this.ip, serial: this.serial };
  }

  destroy() {
    this._destroyed = true;
    this.client?.end(true);
    this.removeAllListeners();
  }
}

module.exports = { MqttPrinterClient };
