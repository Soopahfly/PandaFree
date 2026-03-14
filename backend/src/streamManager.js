'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const GO2RTC_CONFIG_PATH = process.env.GO2RTC_CONFIG || '/config/go2rtc.yml';
const GO2RTC_URL = process.env.GO2RTC_URL || 'http://go2rtc:1984';

function loadConfig() {
  try {
    const raw = fs.readFileSync(GO2RTC_CONFIG_PATH, 'utf8');
    return yaml.load(raw) || {};
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(GO2RTC_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(GO2RTC_CONFIG_PATH, yaml.dump(config), 'utf8');
}

async function reloadGo2rtc() {
  try {
    // go2rtc does not have a reload API — it auto-watches the config file on filesystem changes.
    // We just write the file and go2rtc picks it up within ~1s.
    console.log('[Streams] go2rtc config updated');
  } catch (e) {
    console.warn('[Streams] Could not notify go2rtc:', e.message);
  }
}

async function addStream(id, name, url) {
  const config = loadConfig();
  if (!config.streams) config.streams = {};
  config.streams[id] = url;
  saveConfig(config);
  await reloadGo2rtc();
  console.log(`[Streams] Added stream: ${id} (${name}) → ${url}`);
}

async function removeStream(id) {
  const config = loadConfig();
  if (config.streams) {
    delete config.streams[id];
    saveConfig(config);
    await reloadGo2rtc();
  }
  console.log(`[Streams] Removed stream: ${id}`);
}

function initStreams() {
  // Ensure config file exists on startup, seeds from DB
  const { getDb } = require('./db');
  const config = loadConfig();
  const cameras = getDb().prepare('SELECT * FROM cameras').all();
  config.streams = config.streams || {};
  for (const cam of cameras) {
    config.streams[cam.id] = cam.url;
  }
  config.api = { listen: ':1984' };
  config.rtsp = { listen: ':8554' };
  config.webrtc = { listen: ':8555' };
  saveConfig(config);
  console.log(`[Streams] Initialized ${cameras.length} stream(s)`);
}

module.exports = { addStream, removeStream, initStreams };
