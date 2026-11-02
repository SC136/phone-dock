// Desk Deck — a local server that turns a spare phone into a desk dock.
//
//   node server.js        then open the printed URL on the phone
//
// Serves the dashboard UI and four local APIs:
//   /api/stats   PC load / temps / memory / network / processes (polled + SSE)
//   /api/weather Open-Meteo forecast (keyless), cached
//   /api/actions runs a button from config.streamDeck on this PC
//   /api/lastfm  now playing + recent scrobbles (own API key, read-only)

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import si from 'systeminformation';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  port: 4321,
  title: 'Desk Deck',
  clock: { hour24: true, showSeconds: false, showDate: true },
  weather: {
    location: '', // city name, e.g. "Kathmandu". Leave empty to use the phone's location.
    units: 'metric', // metric (°C, km/h) | imperial (°F, mph)
    refreshMinutes: 10,
  },
  display: {
    theme: 'obsidian', // obsidian | graphite | nord | ember | material | arasaka
    dimAfterMinutes: 5,
    keepAwake: true,
    accent: '', // "" = the theme's own accent
    brandMark: true, // logo in the header
    brandWordmark: 'auto', // "Desk Deck" title: true | false | "auto" (hide on narrow headers)
    // AMOLED care: nudge the whole UI around and let the panel go truly black now and then.
    burnIn: {
      enabled: true,
      driftPixels: 6, // max shift in CSS px (the dim clock drifts twice as far)
      driftEverySeconds: 60, // how often it moves
      blankEveryMinutes: 20, // 0 = never blank
      blankSeconds: 25, // length of each full-black rest
    },
  },
  streamDeck: {
    columns: 4,
    buttons: [
      { id: 'vscode', label: 'VS Code', icon: 'code', action: { type: 'launch', target: 'code' } },
      { id: 'files', label: 'Explorer', icon: 'folder', action: { type: 'launch', target: 'explorer' } },
      { id: 'terminal', label: 'Terminal', icon: 'terminal', action: { type: 'launch', target: 'wt' } },
      { id: 'browser', label: 'YouTube', icon: 'globe', action: { type: 'url', target: 'https://www.youtube.com' } },
      { id: 'vol-up', label: 'Volume +', icon: 'volume-2', action: { type: 'keys', value: 'volume_up' } },
      { id: 'vol-down', label: 'Volume −', icon: 'volume-1', action: { type: 'keys', value: 'volume_down' } },
      { id: 'mute', label: 'Mute', icon: 'volume-x', action: { type: 'keys', value: 'mute' } },
      { id: 'media', label: 'Play / Pause', icon: 'media', action: { type: 'keys', value: 'play_pause' } },
      { id: 'snip', label: 'Screenshot', icon: 'camera', action: { type: 'launch', target: 'snippingtool' } },
      { id: 'projects', label: 'Projects', icon: 'folder-open', action: { type: 'launch', target: 'explorer', args: 'C:\\code' } },
      { id: 'taskmgr', label: 'Task Mgr', icon: 'activity', action: { type: 'launch', target: 'taskmgr' } },
      { id: 'lock', label: 'Lock PC', icon: 'lock', action: { type: 'shell', target: 'rundll32.exe user32.dll,LockWorkStation' } },
    ],
  },
  lastfm: {
    username: '',
    apiKey: '', // https://www.last.fm/api/account/create
    refreshSeconds: 30,
  },
  agents: {
    // A local AI router (9Router, n9router, LiteLLM, OmniRoute…) that tracks the
    // quota your coding agents burn. The dock only ever reads from it.
    label: '9Router',
    baseUrl: 'http://127.0.0.1:20128',
    apiKey: '', // the router's model API key (sk-…)
    password: '', // the router's dashboard password: its usage endpoints need a login
    refreshSeconds: 60,
    // Extra endpoints to try, relative to baseUrl. The first two are 9Router's.
    paths: ['/api/usage', '/api/usage/history', '/api/usage/providers', '/api/quota', '/api/stats', '/api/limits'],
  },
};

function merge(base, over) {
  if (Array.isArray(over)) return over;
  if (over && typeof over === 'object') {
    const out = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge(base[k], v) : v;
    return out;
  }
  return over === undefined ? base : over;
}

function loadConfig() {
  let raw = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
      console.warn(`[config] config.json is not valid JSON (${err.message}) — using defaults.`);
    }
  } else {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log('[config] wrote a fresh config.json — edit it to taste.');
  }
  return merge(DEFAULT_CONFIG, raw);
}

const config = loadConfig();

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'forbidden' });
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'not found' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// PC stats — sampled on three cadences and pushed to the phone over SSE
// ---------------------------------------------------------------------------

const stats = {
  at: 0,
  cpu: { load: 0, cores: os.cpus().length, brand: '', temp: null, speed: os.cpus()[0]?.speed || null },
  gpu: {},
  mem: {},
  net: { iface: '', rx: 0, tx: 0 },
  disks: [],
  procs: [],
  os: { host: os.hostname(), platform: `${os.type()} ${os.release()}` },
  uptime: os.uptime(),
};
const sseClients = new Set();
const busy = { fast: false, medium: false, slow: false };
let netIface = null;

const round1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

function broadcast() {
  if (!sseClients.size) return;
  const payload = `data: ${JSON.stringify(stats)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

async function fastSample() {
  if (busy.fast) return;
  busy.fast = true;
  try {
    const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);
    stats.cpu.load = round1(load.currentLoad) ?? 0;
    stats.cpu.cores = load.cpus?.length || stats.cpu.cores;
    const used = mem.active || mem.used || 0;
    stats.mem = {
      total: mem.total,
      used,
      percent: round1((used / mem.total) * 100) ?? 0,
      swapTotal: mem.swaptotal || 0,
      swapUsed: mem.swapused || 0,
    };
    if (!netIface) {
      const def = await si.networkInterfaceDefault().catch(() => null);
      netIface = typeof def === 'string' ? def : def?.iface || null;
    }
    const nics = await si.networkStats(netIface || undefined).catch(() => []);
    const nic = nics?.[0] || {};
    stats.net = {
      iface: nic.iface || netIface || '—',
      rx: Math.max(0, nic.rx_sec ?? 0),
      tx: Math.max(0, nic.tx_sec ?? 0),
    };
    stats.uptime = os.uptime();
    stats.at = Date.now();
    broadcast();
  } catch (err) {
    console.warn('[stats] fast sample failed:', err.message);
  } finally {
    busy.fast = false;
  }
}

const WIN_THERMAL_SCRIPT = `
try {
  $samples = (Get-Counter "\\\\Thermal Zone Information(*)\\\\High Precision Temperature" -ErrorAction Stop).CounterSamples
  $target = $samples | Where-Object { $_.InstanceName -match "thrm|cpu|pkg|package" } | Select-Object -First 1
  if (-not $target) { $target = $samples | Sort-Object CookedValue -Descending | Select-Object -First 1 }
  if ($target -and $target.CookedValue -gt 2732) {
    [math]::Round(($target.CookedValue - 2732) / 10)
    exit
  }
} catch {}
try {
  $samples = (Get-Counter "\\\\Thermal Zone Information(*)\\\\Temperature" -ErrorAction Stop).CounterSamples
  $target = $samples | Where-Object { $_.InstanceName -match "thrm|cpu|pkg|package" } | Select-Object -First 1
  if (-not $target) { $target = $samples | Sort-Object CookedValue -Descending | Select-Object -First 1 }
  if ($target -and $target.CookedValue -gt 273) {
    [math]::Round($target.CookedValue - 273.15)
    exit
  }
} catch {}
`;

function getWindowsCpuTemp() {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', WIN_THERMAL_SCRIPT],
      { timeout: 3000, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const val = parseInt(stdout.trim(), 10);
        resolve(!isNaN(val) && val > 0 && val < 125 ? val : null);
      }
    );
  });
}

// ponytail: reads Windows Performance Counter thermal zone; upgrade if vendor SDK (Intel XTU/NVAPI) is needed.
async function readCpuTemperature() {
  if (isWindows) {
    const winTemp = await getWindowsCpuTemp().catch(() => null);
    if (winTemp != null) return winTemp;
  }
  const siTemp = await si.cpuTemperature().catch(() => ({}));
  return siTemp.main > 0 ? Math.round(siTemp.main) : siTemp.max > 0 ? Math.round(siTemp.max) : null;
}

async function mediumSample() {
  if (busy.medium) return;
  busy.medium = true;
  try {
    const [temp, fsList, procs] = await Promise.all([
      readCpuTemperature(),
      si.fsSize().catch(() => []),
      si.processes().catch(() => ({ list: [] })),
    ]);
    stats.cpu.temp = temp;
    stats.disks = (fsList || [])
      .filter((d) => d.size > 0)
      .map((d) => ({ mount: d.mount, use: round1(d.use) ?? 0, used: d.used, size: d.size }))
      .slice(0, 4);
    stats.procs = (procs.list || [])
      .filter((p) => p.name && !/^(system idle process|idle)$/i.test(p.name))
      .slice()
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 6)
      .map((p) => ({ name: p.name, cpu: round1(p.cpu) ?? 0, mem: round1(p.mem) ?? 0 }));
    broadcast();
  } catch (err) {
    console.warn('[stats] medium sample failed:', err.message);
  } finally {
    busy.medium = false;
  }
}

async function slowSample() {
  if (busy.slow) return;
  busy.slow = true;
  try {
    const gfx = await si.graphics().catch(() => ({}));
    const ctrl = (gfx.controllers || [])[0];
    if (ctrl) {
      stats.gpu = {
        name: ctrl.model || '',
        temp: ctrl.temperatureGpu > 0 ? Math.round(ctrl.temperatureGpu) : null,
        load: ctrl.utilizationGpu >= 0 ? round1(ctrl.utilizationGpu) : null,
        vram: ctrl.vram || null,
      };
      broadcast();
    }
  } catch (err) {
    console.warn('[stats] slow sample failed:', err.message);
  } finally {
    busy.slow = false;
  }
}

async function primeCpuInfo() {
  try {
    const cpu = await si.cpu();
    stats.cpu.brand = [cpu.manufacturer, cpu.brand].filter(Boolean).join(' ').trim();
  } catch {
    /* brand is cosmetic */
  }
}

setInterval(fastSample, 2000);
setInterval(mediumSample, 6000);
setInterval(slowSample, 20000);
setInterval(() => {
  for (const res of sseClients) {
    try {
      res.write(': ping\n\n');
    } catch {
      sseClients.delete(res);
    }
  }
}, 25000);

// ---------------------------------------------------------------------------
// weather — Open-Meteo, no API key
// ---------------------------------------------------------------------------

const WMO = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

const wmo = (code) => WMO[code] || '—';

const weatherCache = new Map(); // key -> { at, data }
const geoCache = new Map(); // city -> coords
const ipLocation = { tried: false, value: null };

// No city configured? Guess from the PC's public IP (the phone can't share GPS over plain http).
async function detectLocation() {
  if (ipLocation.tried) return ipLocation.value;
  ipLocation.tried = true;
  const keep = (value) => {
    ipLocation.value = value;
    return value;
  };
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const d = await res.json();
      if (d && !d.error && Number.isFinite(d.latitude)) {
        return keep({
          latitude: d.latitude,
          longitude: d.longitude,
          label: [d.city || d.region, d.country_name].filter(Boolean).join(', '),
        });
      }
    }
  } catch {
    /* fall through to the second provider */
  }
  try {
    const res = await fetch('http://ip-api.com/json/?fields=status,city,country,lat,lon', {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const d = await res.json();
      if (d?.status === 'success') {
        return keep({
          latitude: d.lat,
          longitude: d.lon,
          label: [d.city, d.country].filter(Boolean).join(', '),
        });
      }
    }
  } catch {
    /* no location available at all */
  }
  return keep(null);
}

async function geocodeCity(city) {
  const key = city.toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`geocoding failed (${res.status})`);
  const data = await res.json();
  const hit = data.results?.[0];
  if (!hit) throw new Error(`no weather location found for "${city}"`);
  const found = {
    latitude: hit.latitude,
    longitude: hit.longitude,
    label: [hit.name, hit.country].filter(Boolean).join(', '),
  };
  geoCache.set(key, found);
  return found;
}

function normalizeWeather(raw, label) {
  const c = raw.current || {};
  const desc = wmo(c.weather_code);
  const isDay = c.is_day === 1;
  const hours = raw.hourly?.time || [];
  const hit = hours.findIndex((t) => t >= (c.time || ''));
  const start = hit >= 0 ? hit : 0;
  const hourly = hours.slice(start, start + 12).map((t, i) => ({
    time: t,
    temp: raw.hourly.temperature_2m?.[start + i] ?? null,
    pop: raw.hourly.precipitation_probability?.[start + i] ?? null,
    code: raw.hourly.weather_code?.[start + i] ?? 0,
    now: i === 0,
  }));
  const daily = (raw.daily?.time || []).slice(0, 7).map((d, i) => ({
    date: d,
    min: raw.daily.temperature_2m_min?.[i] ?? null,
    max: raw.daily.temperature_2m_max?.[i] ?? null,
    code: raw.daily.weather_code?.[i] ?? 0,
    pop: raw.daily.precipitation_probability_max?.[i] ?? null,
    sunrise: raw.daily.sunrise?.[i] ?? null,
    sunset: raw.daily.sunset?.[i] ?? null,
  }));
  return {
    label,
    timezone: raw.timezone,
    units: {
      temp: raw.current_units?.temperature_2m || '°C',
      wind: raw.current_units?.wind_speed_10m || 'km/h',
    },
    current: {
      time: c.time,
      temp: c.temperature_2m ?? null,
      feels: c.apparent_temperature ?? null,
      humidity: c.relative_humidity_2m ?? null,
      wind: c.wind_speed_10m ?? null,
      code: c.weather_code ?? 0,
      isDay,
      desc,
    },
    hourly,
    daily,
    updated: Date.now(),
  };
}

async function getWeather({ lat, lon, label } = {}) {
  let coords;
  let name = label;
  let approximate = false;
  if (typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon)) {
    coords = { latitude: lat, longitude: lon };
    name = name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  } else if (config.weather.location) {
    const geo = await geocodeCity(config.weather.location);
    coords = geo;
    name = geo.label;
  } else {
    const auto = await detectLocation();
    if (!auto) {
      const err = new Error('no weather location configured');
      err.code = 'NO_LOCATION';
      throw err;
    }
    coords = auto;
    name = auto.label;
    approximate = true;
  }

  const key = `${coords.latitude},${coords.longitude},${config.weather.units}`;
  const cached = weatherCache.get(key);
  const ttl = Math.max(1, config.weather.refreshMinutes || 10) * 60_000;
  if (cached && Date.now() - cached.at < ttl) {
    return { ...cached.data, label: name || cached.data.label, approximate };
  }

  const imperial = config.weather.units === 'imperial';
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_min,temperature_2m_max,sunrise,sunset,precipitation_probability_max',
    temperature_unit: imperial ? 'fahrenheit' : 'celsius',
    wind_speed_unit: imperial ? 'mph' : 'kmh',
    timezone: 'auto',
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`weather request failed (${res.status})`);
  const data = { ...normalizeWeather(await res.json(), name || 'Weather'), approximate };
  weatherCache.set(key, { at: Date.now(), data });
  return data;
}

// ---------------------------------------------------------------------------
// stream deck actions — only ids that exist in config.json can ever run
// ---------------------------------------------------------------------------

const MEDIA_KEYS = { volume_up: 175, volume_down: 174, mute: 173, next: 176, prev: 177, play_pause: 179 };
const DETACHED = { detached: true, stdio: 'ignore', windowsHide: true };

// Media keys go through user32 keybd_event: WScript's SendKeys only types characters
// and cannot produce VK_VOLUME_* codes. One PowerShell process is kept alive (and
// the C# compiled once) so a button press answers in milliseconds.
const KEY_HELPER = `
$sig = '[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);'
Add-Type -MemberDefinition $sig -Name Keys -Namespace Dock
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $vk = [byte]([int]$line)
  [Dock.Keys]::keybd_event($vk, 0, 1, [UIntPtr]::Zero)
  [Dock.Keys]::keybd_event($vk, 0, 3, [UIntPtr]::Zero)
}`;
let keyHelper = null;

function pressMediaKey(code) {
  if (!keyHelper || keyHelper.killed || keyHelper.exitCode !== null) {
    keyHelper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', KEY_HELPER], {
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
    });
    keyHelper.on('error', () => {
      keyHelper = null;
    });
    keyHelper.stdin.on('error', () => {});
    keyHelper.on('exit', () => {
      keyHelper = null;
    });
  }
  keyHelper.stdin.write(`${code}\n`);
}

function runAction(action = {}) {
  const type = action.type;
  const target = String(action.target ?? '').trim();
  const args = action.args ? [String(action.args)] : [];

  if (type === 'launch') {
    if (!target) throw new Error('launch needs a "target"');
    if (isWindows) spawn(target, args, { ...DETACHED, shell: true }).unref();
    else spawn(target, args, DETACHED).unref();
    return `Launching ${target}`;
  }
  if (type === 'url') {
    if (!/^https?:\/\//i.test(target)) throw new Error('url needs an http(s) target');
    if (isWindows) spawn('rundll32.exe', ['url.dll,FileProtocolHandler', target], DETACHED).unref();
    else spawn(isMac ? 'open' : 'xdg-open', [target], DETACHED).unref();
    return `Opening ${target}`;
  }
  if (type === 'shell') {
    if (!target) throw new Error('shell needs a "target" command');
    if (isWindows) spawn('cmd.exe', ['/d', '/s', '/c', target], { ...DETACHED, shell: false }).unref();
    else spawn('/bin/sh', ['-c', target], DETACHED).unref();
    return 'Command sent';
  }
  if (type === 'keys') {
    const code = MEDIA_KEYS[String(action.value ?? '').trim()];
    if (!code) throw new Error(`keys value must be one of: ${Object.keys(MEDIA_KEYS).join(', ')}`);
    if (!isWindows) throw new Error('keys actions are Windows-only');
    pressMediaKey(code);
    return 'Key sent';
  }
  throw new Error(`unknown action type "${type}"`);
}

// ---------------------------------------------------------------------------
// last.fm — now playing + recent scrobbles (read-only)
// ---------------------------------------------------------------------------

// Last.fm hands back this generic star image when it has no real cover art.
const LASTFM_PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';
const artCache = new Map(); // "artist – track" -> url | null
let lastfmState = { at: 0, data: null };

async function lastfm(method, params = {}) {
  if (!config.lastfm.apiKey) throw new Error('Last.fm is not set up yet — add lastfm.apiKey to config.json.');
  if (!config.lastfm.username) throw new Error('Last.fm username missing — set lastfm.username in config.json.');
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.search = new URLSearchParams({
    method,
    user: config.lastfm.username,
    api_key: config.lastfm.apiKey,
    format: 'json',
    ...params,
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    // 6 = user not found, 10 = invalid API key, 26 = suspended API key
    const err = new Error(data.message || `Last.fm error ${data.error}`);
    err.code = `LASTFM_${data.error}`;
    throw err;
  }
  if (!res.ok) throw new Error(`Last.fm request failed (${res.status})`);
  return data;
}

function pickArt(images = []) {
  const best = [...(images || [])].reverse().find((i) => i?.['#text']);
  const url = best?.['#text'];
  if (!url || url.includes(LASTFM_PLACEHOLDER)) return null;
  return url;
}

// Last.fm has no cover art for some tracks — ask iTunes, which needs no key.
async function itunesArt(artist, track) {
  if (!artist || !track) return null;
  try {
    const url = new URL('https://itunes.apple.com/search');
    url.search = new URLSearchParams({ term: `${artist} ${track}`, media: 'music', entity: 'song', limit: '5' }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const want = norm(track);
    const wantArtist = norm(artist);
    const hits = data.results || [];
    const hit =
      hits.find((r) => norm(r.trackName) === want && norm(r.artistName).includes(wantArtist.slice(0, 6))) ||
      hits.find((r) => norm(r.trackName) === want);
    const art = hit?.artworkUrl100;
    return art ? art.replace(/\/100x100bb\.(jpg|png)$/i, '/600x600bb.$1') : null;
  } catch {
    return null;
  }
}

async function artwork(images, artist, track) {
  const direct = pickArt(images);
  if (direct) return direct;
  const key = `${artist} – ${track}`.toLowerCase();
  if (!artCache.has(key)) {
    if (artCache.size > 300) artCache.delete(artCache.keys().next().value);
    artCache.set(key, await itunesArt(artist, track));
  }
  return artCache.get(key);
}

function normalizeScrobble(t, art) {
  return {
    name: t.name,
    artist: t.artist?.['#text'] || t.artist?.name || '',
    album: t.album?.['#text'] || '',
    art,
    url: t.url || '',
    nowPlaying: t['@attr']?.nowplaying === 'true',
    ts: t.date?.uts ? Number(t.date.uts) * 1000 : null,
    playedAt: t.date?.['#text'] || '',
  };
}

async function getLastfm() {
  const ttlMs = Math.max(5, config.lastfm.refreshSeconds || 30) * 1000;
  if (lastfmState.data && Date.now() - lastfmState.at < ttlMs) return lastfmState.data;

  const recentRes = await lastfm('user.getrecenttracks', { limit: '8' });
  const raw = recentRes.recenttracks?.track || [];
  const tracks = Array.isArray(raw) ? raw : [raw];
  const recent = await Promise.all(
    tracks.map(async (t) => normalizeScrobble(t, await artwork(t.image, t.artist?.['#text'], t.name)))
  );

  let topArtists = [];
  try {
    const top = await lastfm('user.gettopartists', { period: '7day', limit: '6' });
    const rawTop = top.topartists?.artist || [];
    topArtists = (Array.isArray(rawTop) ? rawTop : [rawTop]).map((a) => ({
      name: a.name,
      playcount: Number(a.playcount || 0),
      art: pickArt(a.image),
      url: a.url || '',
    }));
  } catch (err) {
    console.warn('[lastfm] top artists unavailable:', err.message);
  }

  const nowPlaying = recent.find((t) => t.nowPlaying) || null;
  const data = {
    configured: true,
    user: config.lastfm.username,
    profileUrl: `https://www.last.fm/user/${encodeURIComponent(config.lastfm.username)}`,
    nowPlaying,
    lastPlayed: nowPlaying ? null : recent[0] || null,
    recent: recent.filter((t) => !t.nowPlaying).slice(0, 6),
    topArtists,
    totalScrobbles: Number(recentRes.recenttracks?.['@attr']?.total || 0),
    updated: Date.now(),
  };
  lastfmState = { at: Date.now(), data };
  return data;
}

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// coding agents — usage + quota windows from a local 9Router (read-only)
// ---------------------------------------------------------------------------

const agentsCache = { at: 0, data: null };
const routerSession = { cookie: '', error: '', failedAt: 0 };
const LOGIN_COOLDOWN_MS = 10 * 60 * 1000;
const quotaCache = { at: 0, accounts: [], loading: false };
const QUOTA_TTL_MS = 5 * 60 * 1000;

// One login attempt per cooldown, win or lose: a wrong password counts toward the
// router's lockout, so a failure must never turn into a retry loop.
async function routerLogin(base, password) {
  if (routerSession.failedAt && Date.now() - routerSession.failedAt < LOGIN_COOLDOWN_MS) return;
  try {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(4000),
    });
    const body = await res.json().catch(() => ({}));
    const cookies = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).filter(Boolean);
    if (res.ok && cookies.length) {
      routerSession.cookie = cookies.join('; ');
      routerSession.error = '';
      routerSession.failedAt = 0;
      return;
    }
    routerSession.error = body.error || `HTTP ${res.status}`;
  } catch (err) {
    routerSession.error = err.message;
  }
  routerSession.failedAt = Date.now();
}

async function routerGet(base, path, timeoutMs = 4000) {
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json', Cookie: routerSession.cookie },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('unauthorized');
    err.unauthorized = true;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// One provider's quota windows, normalised: only windows that actually have a
// ceiling, worst (most used) first.
function normaliseQuotas(raw) {
  const out = [];
  for (const [key, q] of Object.entries(raw?.quotas || {})) {
    if (!q || q.unlimited) continue;
    const total = num(q.total);
    const used = num(q.used);
    let percent = null;
    if (total && used != null) percent = Math.min(100, (used / total) * 100);
    else if (num(q.remainingPercentage) != null) percent = 100 - q.remainingPercentage;
    if (percent == null || (total === 0 && used === 0)) continue;
    out.push({ name: q.displayName || key, used, total, unit: q.unit || '', percent, reset: q.resetAt || null });
  }
  return out.sort((x, y) => y.percent - x.percent);
}

const accountLabel = (c) => {
  const who = String(c.displayName || c.name || c.email || '').split('@')[0].trim();
  return who.slice(0, 22);
};

function combineAntigravity(accounts) {
  const agAccounts = accounts.filter((a) => a.provider === 'antigravity');
  if (agAccounts.length <= 1) return accounts;

  const others = accounts.filter((a) => a.provider !== 'antigravity');
  const windowMap = new Map();

  for (const acct of agAccounts) {
    for (const w of acct.windows) {
      const existing = windowMap.get(w.name);
      if (!existing) {
        windowMap.set(w.name, {
          name: w.name,
          used: w.used || 0,
          total: w.total || 0,
          unit: w.unit || '',
          resets: w.reset ? [w.reset] : [],
        });
      } else {
        existing.used += w.used || 0;
        existing.total += w.total || 0;
        if (w.reset) existing.resets.push(w.reset);
      }
    }
  }

  const combinedWindows = Array.from(windowMap.values())
    .map((w) => {
      const percent = w.total > 0 ? Math.min(100, (w.used / w.total) * 100) : 0;
      const reset = w.resets.length ? w.resets.sort()[0] : null;
      return { name: w.name, used: w.used, total: w.total, unit: w.unit, percent, reset };
    })
    .sort((x, y) => y.percent - x.percent);

  const combined = {
    provider: 'antigravity',
    label: `${agAccounts.length} accounts`,
    plan: agAccounts[0]?.plan || 'Antigravity',
    limitReached: agAccounts.every((a) => a.limitReached),
    windows: combinedWindows,
  };

  return [...others, combined].sort((x, y) => y.windows[0].percent - x.windows[0].percent);
}

// Quota windows come from the upstream providers, so each call can take seconds.
// Refresh them in the background and always answer from the cache.
async function refreshQuotas(base) {
  if (quotaCache.loading) return;
  quotaCache.loading = true;
  try {
    const { connections = [] } = await routerGet(base, '/api/providers', 6000);
    const active = connections.filter((c) => c.isActive !== false);
    const accounts = [];
    let next = 0;
    const worker = async () => {
      while (next < active.length) {
        const c = active[next++];
        try {
          const raw = await routerGet(base, `/api/usage/${encodeURIComponent(c.id)}`, 20000);
          const windows = normaliseQuotas(raw);
          if (windows.length) accounts.push({ provider: c.provider, label: accountLabel(c), plan: raw.plan || '', limitReached: Boolean(raw.limitReached), windows });
        } catch {
          /* provider has no usage API, or it timed out */
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    quotaCache.accounts = combineAntigravity(accounts);
    quotaCache.at = Date.now();
    agentsCache.at = 0; // let the next read pick the new accounts up
  } catch {
    quotaCache.at = Date.now();
  } finally {
    quotaCache.loading = false;
  }
}

async function readAgents({ force = false } = {}) {
  const cfg = config.agents || {};
  const ttl = Math.max(15, Number(cfg.refreshSeconds) || 60) * 1000;
  if (!force && agentsCache.data && Date.now() - agentsCache.at < ttl) return agentsCache.data;

  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  const result = {
    configured: Boolean(cfg.password),
    source: cfg.label || 'router',
    baseUrl: base,
    updated: Date.now(),
    reachable: false,
    totals: null,
    providers: [],
    accounts: [],
    recent: [],
    last10: [],
    error: null,
  };
  const finish = () => {
    agentsCache.at = Date.now();
    agentsCache.data = result;
    return result;
  };

  if (!base) {
    result.error = 'agents.baseUrl is not set in config.json';
    return finish();
  }
  if (!cfg.password) {
    result.error = 'Usage needs the dashboard password: set agents.password in config.json.';
    return finish();
  }

  if (!routerSession.cookie) await routerLogin(base, cfg.password);
  if (!routerSession.cookie) {
    result.error = routerSession.error ? `Dashboard login failed: ${routerSession.error}` : `Nothing answered on ${base}. Is the router running?`;
    return finish();
  }

  let history;
  try {
    history = await routerGet(base, '/api/usage/history');
  } catch (err) {
    if (err.unauthorized) {
      // Session expired: sign in again once (the cooldown guards the lockout).
      routerSession.cookie = '';
      await routerLogin(base, cfg.password);
      try {
        if (routerSession.cookie) history = await routerGet(base, '/api/usage/history');
      } catch {
        /* handled below */
      }
    }
    if (!history) {
      result.error = routerSession.error ? `Dashboard login failed: ${routerSession.error}` : `Could not read usage from ${base}.`;
      return finish();
    }
  }

  result.reachable = true;
  result.totals = {
    requests: num(history.totalRequests),
    tokensInput: num(history.totalPromptTokens),
    tokensOutput: num(history.totalCompletionTokens),
    tokensCache: num(history.totalCachedTokens),
    cost: num(history.totalCost),
  };
  result.providers = Object.entries(history.byProvider || {})
    .map(([name, v]) => ({
      name: name.replace(/-[0-9a-f]{8}-.*$/, ''),
      requests: num(v.requests) || 0,
      tokens: (num(v.promptTokens) || 0) + (num(v.completionTokens) || 0),
      cost: num(v.cost) || 0,
    }))
    .sort((x, y) => y.requests - x.requests)
    .slice(0, 8);
  result.last10 = (history.last10Minutes || []).map((m) => num(m.requests) || 0);
  result.recent = (history.recentRequests || []).slice(0, 6).map((r) => ({
    at: r.timestamp ? Date.parse(r.timestamp) : null,
    model: r.model,
    provider: r.provider,
    tokens: (num(r.promptTokens) || 0) + (num(r.completionTokens) || 0),
    ok: r.status === 'ok',
  }));
  result.accounts = quotaCache.accounts;
  result.quotaAt = quotaCache.at || null;
  result.quotaLoading = quotaCache.loading || !quotaCache.at;

  if (!quotaCache.loading && Date.now() - quotaCache.at > QUOTA_TTL_MS) refreshQuotas(base);
  return finish();
}

function publicConfig() {
  return {
    title: config.title,
    clock: config.clock,
    display: config.display,
    weather: { location: config.weather.location, units: config.weather.units },
    streamDeck: {
      columns: config.streamDeck.columns,
      buttons: config.streamDeck.buttons.map((b) => ({ id: b.id, label: b.label, icon: b.icon })),
    },
    agents: {
      label: config.agents?.label || 'router',
      configured: Boolean(config.agents?.password),
      baseUrl: config.agents?.baseUrl || '',
    },
    lastfm: {
      configured: Boolean(config.lastfm.apiKey && config.lastfm.username),
      username: config.lastfm.username,
      profileUrl: config.lastfm.username ? `https://www.last.fm/user/${encodeURIComponent(config.lastfm.username)}` : '',
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  try {
    if (pathname === '/api/config') return sendJson(res, 200, publicConfig());

    if (pathname === '/api/stats') return sendJson(res, 200, stats);

    if (pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      res.write('retry: 3000\n\n');
      res.write(`data: ${JSON.stringify(stats)}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (pathname === '/api/weather') {
      const lat = url.searchParams.has('lat') ? Number(url.searchParams.get('lat')) : undefined;
      const lon = url.searchParams.has('lon') ? Number(url.searchParams.get('lon')) : undefined;
      const label = url.searchParams.get('label') || undefined;
      const data = await getWeather({ lat, lon, label });
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/agents') {
      const data = await readAgents({ force: url.searchParams.has('refresh') });
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/lastfm') {
      const missing = [];
      if (!config.lastfm.apiKey) missing.push('apiKey');
      if (!config.lastfm.username) missing.push('username');
      if (missing.length) return sendJson(res, 200, { configured: false, missing });
      const data = await getLastfm();
      return sendJson(res, 200, data);
    }

    if (pathname.startsWith('/api/actions/') && req.method === 'POST') {
      const id = pathname.slice('/api/actions/'.length);
      const button = config.streamDeck.buttons.find((b) => b.id === id);
      if (!button) return sendJson(res, 404, { ok: false, error: `no button "${id}" in config.json` });
      const message = runAction(button.action);
      console.log(`[action] ${button.label}: ${message}`);
      return sendJson(res, 200, { ok: true, message });
    }

    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'unknown endpoint' });
    return serveStatic(res, pathname);
  } catch (err) {
    const status = err.status && err.status >= 400 ? err.status : 500;
    if (pathname.startsWith('/api/')) {
      console.warn(`[api] ${pathname} -> ${err.message}`);
      return sendJson(res, status, { ok: false, error: err.message, code: err.code });
    }
    return sendJson(res, 500, { error: err.message });
  }
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const nic of list || []) {
      if (nic.family === 'IPv4' && !nic.internal) out.push(nic.address);
    }
  }
  return out;
}

server.listen(config.port, '0.0.0.0', async () => {
  await primeCpuInfo();
  fastSample();
  mediumSample();
  slowSample();
  readAgents().catch(() => {});

  const urls = lanAddresses().map((ip) => `  http://${ip}:${config.port}`);
  console.log(`\n${config.title} is running.\n`);
  console.log('Open on the phone (same Wi-Fi):');
  console.log(urls.length ? urls.join('\n') : '  (no LAN address found — check your Wi-Fi)');
  console.log('\nOn this PC:');
  console.log(`  http://127.0.0.1:${config.port}`);
  if (!config.lastfm.apiKey || !config.lastfm.username) {
    console.log('\nLast.fm: not set up yet — see README.md (lastfm.apiKey + lastfm.username in config.json).');
  }
  if (!config.weather.location) {
    const auto = await detectLocation();
    console.log(
      auto
        ? `\nWeather: no weather.location set — using an approximate location (${auto.label}).\nSet weather.location in config.json for the exact city.`
        : '\nWeather: set weather.location in config.json (could not detect a city automatically).'
    );
  }
  console.log('\nFirst run on the phone but nothing loads? Allow Node.js through the Windows firewall\nfor private networks, or add a rule for TCP port ' + config.port + '.\n');

  if (isWindows && process.stdin.isTTY) {
    console.log("Press [h] to send to system tray (frees this terminal)\n");
    setupTrayKey();
  }
});

function setupTrayKey() {
  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
      if (key === '\u0003') {
        process.exit(0);
      }
      if (key.toLowerCase() === 'h' || key.toLowerCase() === 't') {
        console.log('\n[tray] Moving to system tray... You can now close this terminal.\n');
        const psScript = path.join(ROOT, 'tray.ps1');
        spawn(
          'powershell.exe',
          ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', psScript],
          {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          }
        ).unref();
        setTimeout(() => {
          process.exit(0);
        }, 300);
      }
    });
  } catch {
    /* stdin not a TTY or raw mode unavailable */
  }
}
