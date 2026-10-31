/* Desk Deck — phone client.
   Pages are a native scroll-snap track (swipe follows the finger). All glyphs are
   inline SVG from ICONS (no emoji). Themes are token sets in styles.css. */

'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORE_KEY = 'deskdeck.v2';
const DEMO = /[?&]demo\b/.test(location.search);
const MODES = [
  { id: 'clock', icon: 'clock', label: 'Clock' },
  { id: 'ambient', icon: 'layout', label: 'Ambient' },
  { id: 'weather', icon: 'cloud-sun', label: 'Weather' },
  { id: 'stats', icon: 'activity', label: 'PC' },
  { id: 'agents', icon: 'gauge', label: 'Agents' },
  { id: 'deck', icon: 'grid', label: 'Deck' },
  { id: 'music', icon: 'music', label: 'Music' },
];

// One stroke-based icon family: 24×24, 1.6px, round caps.
const ICONS = {
  brand: '<rect x="3.4" y="4.6" width="17.2" height="12" rx="3"/><circle cx="12" cy="10.6" r="2.4"/><path d="M9.6 20h4.8M12 16.6V20"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.4 2"/>',
  grid: '<rect x="3.4" y="3.4" width="7.2" height="7.2" rx="2"/><rect x="13.4" y="3.4" width="7.2" height="7.2" rx="2"/><rect x="3.4" y="13.4" width="7.2" height="7.2" rx="2"/><rect x="13.4" y="13.4" width="7.2" height="7.2" rx="2"/>',
  layout: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.2"/><path d="M3.4 9.8h17.2M10.8 9.8v10.8"/>',
  activity: '<path d="M3 12.6h3.4l2.3-6.4 3.7 11.6 2.4-5.2H21"/>',
  gauge: '<path d="M4.6 16.6a8.4 8.4 0 1 1 14.8 0"/><path d="M12 16.6 15.4 10"/><circle cx="12" cy="16.6" r="1.1"/>',
  music: '<path d="M9.2 17.8V6.4l9.6-1.9v11.3"/><circle cx="6.6" cy="17.9" r="2.6"/><circle cx="16.2" cy="15.8" r="2.6"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/>',
  moon: '<path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z"/>',
  cloud: '<path d="M6.8 18.4h9.9a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.5-1.3 3.5 3.5 0 0 0 .2 8.9Z"/>',
  'cloud-sun': '<path d="M9.4 19.4h8.4a3.6 3.6 0 0 0 .4-7.2 5.2 5.2 0 0 0-10-1.2 3.3 3.3 0 0 0 1.2 8.4Z"/><circle cx="6.8" cy="6.6" r="2.2"/><path d="M6.8 2.6v1M2.8 6.6h1M3.9 3.7l.7.7M9.7 3.7l-.7.7"/>',
  'cloud-moon': '<path d="M9.4 19.4h8.4a3.6 3.6 0 0 0 .4-7.2 5.2 5.2 0 0 0-10-1.2 3.3 3.3 0 0 0 1.2 8.4Z"/><path d="M9.6 8.4A3.4 3.4 0 0 1 5 3.8a3.5 3.5 0 1 0 4.6 4.6Z"/>',
  'cloud-drizzle': '<path d="M6.8 15.4h9.9a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.5-1.3 3.5 3.5 0 0 0 .2 8.9Z"/><path d="M9 18.2l-.6 2.2M12.4 18.2l-.6 2.2M15.8 18.2l-.6 2.2"/>',
  'cloud-rain': '<path d="M6.8 15.4h9.9a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.5-1.3 3.5 3.5 0 0 0 .2 8.9Z"/><path d="M9 18.2l-.9 2.6M12.4 18.2l-.9 2.6M15.8 18.2l-.9 2.6"/>',
  'cloud-snow': '<path d="M6.8 15.4h9.9a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.5-1.3 3.5 3.5 0 0 0 .2 8.9Z"/><path stroke-width="2.2" d="M9.2 19.2h.01M12.4 20.8h.01M15.6 19.2h.01"/>',
  'cloud-lightning': '<path d="M6.8 15.4h9.9a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.5-1.3 3.5 3.5 0 0 0 .2 8.9Z"/><path d="M13.4 16.4l-3.2 4.8h3.6l-.7 3"/>',
  fog: '<path d="M3.6 9.4h10.8M6.4 13.4h14M3.6 17.4h11.6"/>',
  droplet: '<path d="M12 3.6c3.1 3.7 5.6 6.7 5.6 9.6a5.6 5.6 0 0 1-11.2 0c0-2.9 2.5-5.9 5.6-9.6Z"/>',
  wind: '<path d="M3.6 8.6h9.4a3 3 0 1 0-3-3M3.6 12.6h13.6a3 3 0 1 1-3 3M3.6 16.6h6.2"/>',
  thermometer: '<path d="M14.2 15V5.2a2.2 2.2 0 0 0-4.4 0V15a4.2 4.2 0 1 0 4.4 0Z"/><path d="M12 9.8v7.4"/>',
  sunrise: '<path d="M3.4 19h17.2M7.2 19a4.8 4.8 0 0 1 9.6 0"/><path d="M12 4.2v3.4M9.6 6.6 12 4.2l2.4 2.4"/>',
  sunset: '<path d="M3.4 19h17.2M7.2 19a4.8 4.8 0 0 1 9.6 0"/><path d="M12 3.6V7M9.6 4.6 12 7l2.4-2.4"/>',
  pin: '<path d="M12 20.8s6.4-6.2 6.4-11a6.4 6.4 0 1 0-12.8 0c0 4.8 6.4 11 6.4 11Z"/><circle cx="12" cy="9.8" r="2.4"/>',
  cpu: '<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2.4"/><rect x="10.2" y="10.2" width="3.6" height="3.6" rx="1"/><path d="M9.6 3.2v3.4M14.4 3.2v3.4M9.6 17.4v3.4M14.4 17.4v3.4M3.2 9.6h3.4M3.2 14.4h3.4M17.4 9.6h3.4M17.4 14.4h3.4"/>',
  gpu: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="2.8"/><path d="M12 3.6v5.6M12 14.8v5.6M3.6 12h5.6M14.8 12h5.6"/>',
  memory: '<rect x="3.4" y="7.2" width="17.2" height="9.6" rx="2.2"/><path d="M7.4 10.8v2.4M10.6 10.8v2.4M13.8 10.8v2.4M17 10.8v2.4"/>',
  network: '<path d="M7.5 4.2v15.6m0 0-3-3m3 3 3-3M16.5 19.8V4.2m0 0-3 3m3-3 3 3"/>',
  'arrow-down': '<path d="M12 4.6v14.8m0 0-5.4-5.4M12 19.4l5.4-5.4"/>',
  'arrow-up': '<path d="M12 19.4V4.6m0 0L6.6 10M12 4.6l5.4 5.4"/>',
  storage: '<rect x="3.4" y="4.6" width="17.2" height="6.2" rx="2"/><rect x="3.4" y="13.2" width="17.2" height="6.2" rx="2"/><path d="M7 7.7h.01M7 16.3h.01"/>',
  code: '<path d="m9.2 7.6-4 4.4 4 4.4M14.8 7.6l4 4.4-4 4.4"/><path d="M13.4 5.4l-2.8 13.2"/>',
  folder: '<path d="M3.6 7.6a2.2 2.2 0 0 1 2.2-2.2h3.3l1.9 2.1h7.2a2.2 2.2 0 0 1 2.2 2.2v7a2.2 2.2 0 0 1-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2Z"/>',
  'folder-open': '<path d="M3.6 8.4V6.9a2.1 2.1 0 0 1 2.1-2.1h3.2l1.8 2h6.4a2.1 2.1 0 0 1 2.1 2.1v1.5"/><path d="M3.1 9.6h17.4l-2.2 8.1a2 2 0 0 1-1.9 1.5H6.4a2 2 0 0 1-1.9-1.5Z"/>',
  terminal: '<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.6"/><path d="m7.2 9.6 2.8 2.4-2.8 2.4M12.6 14.8h4.4"/>',
  globe: '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.3 2.3 3.6 5.3 3.6 8.4s-1.3 6.1-3.6 8.4c-2.3-2.3-3.6-5.3-3.6-8.4S9.7 5.9 12 3.6Z"/>',
  media: '<rect x="3.2" y="4.8" width="17.6" height="14.4" rx="3"/><path d="M10.2 9.4v5.2l4.3-2.6-4.3-2.6Z"/><path d="M17 9.6v4.8"/>',
  'volume-2': '<path d="M4.2 9.6h2.9l4.7-3.8v12.4l-4.7-3.8H4.2z"/><path d="M15.2 9.2a4.6 4.6 0 0 1 0 5.6M17.8 6.6a8.2 8.2 0 0 1 0 10.8"/>',
  'volume-1': '<path d="M4.2 9.6h2.9l4.7-3.8v12.4l-4.7-3.8H4.2z"/><path d="M15.2 9.2a4.6 4.6 0 0 1 0 5.6"/>',
  'volume-x': '<path d="M4.2 9.6h2.9l4.7-3.8v12.4l-4.7-3.8H4.2z"/><path d="m15.4 9.8 4.4 4.4M19.8 9.8l-4.4 4.4"/>',
  camera: '<path d="M4.9 8.9h2.2l1.5-2.1h6.8l1.5 2.1h2.2a1.9 1.9 0 0 1 1.9 1.9v6.3a1.9 1.9 0 0 1-1.9 1.9H4.9A1.9 1.9 0 0 1 3 17.1v-6.3a1.9 1.9 0 0 1 1.9-1.9Z"/><circle cx="12" cy="13.4" r="3.1"/>',
  lock: '<rect x="4.6" y="10.2" width="14.8" height="9.6" rx="2.4"/><path d="M8.2 10.2V7.6a3.8 3.8 0 0 1 7.6 0v2.6"/>',
  sliders: '<path d="M4 8.4h7.6M16.4 8.4H20M4 15.6h3.6M12.4 15.6H20"/><circle cx="14.2" cy="8.4" r="2.3"/><circle cx="10.2" cy="15.6" r="2.3"/>',
  x: '<path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20.4 4.4v4.2h-4.2"/>',
  external: '<path d="M14.2 4.4h5.4v5.4M19.6 4.8 11.8 12.6"/><path d="M18.6 14v4.4a2.2 2.2 0 0 1-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2V7.6a2.2 2.2 0 0 1 2.2-2.2H10"/>',
  alert: '<path d="M12 3.8 2.6 20h18.8L12 3.8Z"/><path d="M12 10v4M12 17h.01"/>',
};

function icon(name, cls = '') {
  const body = ICONS[name];
  if (!body) return name ? `<span class="icon-text">${escapeHtml(name)}</span>` : '';
  const classes = cls ? `ico ${cls}` : 'ico';
  return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const WEATHER_ICON = {
  0: 'sun',
  1: 'sun',
  2: 'cloud-sun',
  3: 'cloud',
  45: 'fog',
  48: 'fog',
  51: 'cloud-drizzle',
  53: 'cloud-drizzle',
  55: 'cloud-rain',
  56: 'cloud-rain',
  57: 'cloud-rain',
  61: 'cloud-drizzle',
  63: 'cloud-rain',
  65: 'cloud-rain',
  66: 'cloud-rain',
  67: 'cloud-rain',
  71: 'cloud-snow',
  73: 'cloud-snow',
  75: 'cloud-snow',
  77: 'cloud-snow',
  80: 'cloud-drizzle',
  81: 'cloud-rain',
  82: 'cloud-rain',
  85: 'cloud-snow',
  86: 'cloud-snow',
  95: 'cloud-lightning',
  96: 'cloud-lightning',
  99: 'cloud-lightning',
};

function weatherIcon(code, isDay = true) {
  const day = WEATHER_ICON[code] || 'cloud';
  if (isDay) return day;
  return { sun: 'moon', 'cloud-sun': 'cloud-moon' }[day] || day;
}

const THEMES = [
  { id: 'obsidian', name: 'Obsidian', note: 'Black, hairlines, azure', bg: '#000000', surface: '#0c0d10', accent: '#6ea0ff', muted: '#9097a3' },
  { id: 'material', name: 'Material', note: 'Tonal, rounded, warm', bg: '#140f0d', surface: '#231917', accent: '#ffb4a1', muted: '#d8c2bc' },
  { id: 'ember', name: 'Ember', note: 'Amber terminal', bg: '#000000', surface: '#120c05', accent: '#ffab4a', muted: '#b98748' },
  { id: 'arasaka', name: 'Arasaka', note: 'Black and signal red', bg: '#000000', surface: '#14070a', accent: '#ff2b3d', muted: '#a77d82' },
];
const FONTS = [
  { id: 'outfit', name: 'Outfit', family: "'Outfit'" },
  { id: 'theme', name: 'Theme original', family: null },
];
const DEFAULT_FONT = 'outfit';
const DEFAULT_THEME = 'obsidian';
const ACCENTS = ['#6ea0ff', '#3ddc97', '#ffb84d', '#ff5d6c', '#c39bff', '#f3f5f9'];

const DEFAULT_SETTINGS = { accent: '', theme: null, hour24: null, showSeconds: null, dimMinutes: null, keepAwake: null, burnIn: null, fullscreen: null, hideDock: false, font: DEFAULT_FONT };

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

const state = {
  config: null,
  stats: null,
  weather: null,
  weatherError: null,
  weatherAt: 0,
  lastfm: null,
  lastfmError: null,
  lastfmAt: 0,
  agents: null,
  agentsError: null,
  agentsAt: 0,
  modeIndex: 0,
  settings: { ...DEFAULT_SETTINGS, ...readStore() },
  lastActivity: Date.now(),
  dimmed: false,
  blanked: false,
  online: false,
  lastStatsAt: 0,
  cpuHistory: [],
  procKey: '',
  diskKey: '',
};

const DOM = {};
let wakeLock = null;
let toastTimer = 0;

const eff = {
  theme: () => {
    const id = state.settings.theme || state.config?.display?.theme || DEFAULT_THEME;
    return THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME;
  },
  accent: () => state.settings.accent || state.config?.display?.accent || '',
  hour24: () => state.settings.hour24 ?? state.config?.clock?.hour24 ?? true,
  showSeconds: () => state.settings.showSeconds ?? state.config?.clock?.showSeconds ?? false,
  dimMinutes: () => state.settings.dimMinutes ?? state.config?.display?.dimAfterMinutes ?? 5,
  keepAwake: () => state.settings.keepAwake ?? state.config?.display?.keepAwake ?? true,
  fullscreen: () => state.settings.fullscreen ?? state.config?.display?.fullscreen ?? true,
};

const themeDef = () => THEMES.find((t) => t.id === eff.theme()) || THEMES[0];

// Light accents need dark ink on top of them, and the other way round.
function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#000';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.58 ? '#000' : '#fff';
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, '0');

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function fmtBytes(bytes, digits = 1) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = Math.abs(bytes);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 || v >= 100 ? 0 : digits)} ${units[i]}`;
}

const fmtRate = (bytes) => `${fmtBytes(bytes)}/s`;

function fmtUptime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function relTime(ts) {
  if (!ts) return '';
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1d' : `${days}d`;
}

// Open-Meteo returns local wall-clock strings like "2025-06-10T15:00".
function clockTime(iso, withMinutes = true) {
  const time = String(iso || '').split('T')[1] || '';
  const h = Number(time.slice(0, 2));
  const m = time.slice(3, 5);
  if (!Number.isFinite(h)) return '';
  if (eff.hour24()) return withMinutes ? `${pad2(h)}:${m}` : pad2(h);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return withMinutes ? `${h12}:${m} ${suffix}` : `${h12}${suffix}`;
}

const hourOf = (iso) => Number(String(iso || '').split('T')[1]?.slice(0, 2));

function dayLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso || '') : d.toLocaleDateString(undefined, { weekday: 'short' });
}

async function jget(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    throw err;
  }
  return data;
}

function severity(percent) {
  const v = Number(percent) || 0;
  return v >= 90 ? 'bad' : v >= 70 ? 'warn' : '';
}

function setBar(node, percent) {
  if (!node) return;
  node.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
  node.classList.remove('warn', 'bad');
  const level = severity(percent);
  if (level) node.classList.add(level);
}

function toast(message, kind = '') {
  const node = $('#toast');
  node.textContent = message;
  node.className = `show ${kind}`.trim();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.className = '';
  }, 2400);
}

function writeStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.settings));
  } catch {
    /* storage unavailable in private mode */
  }
}
const fmtNum = (v) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
};

// A reset can arrive as an epoch stamp (s or ms) or already as a duration.
function fmtReset(value) {
  if (value == null) return '';
  let ms;
  if (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value)) {
    ms = Date.parse(value);
    if (!Number.isFinite(ms)) return value;
  }
  const n = Number(value);
  if (ms !== undefined) {
    /* ISO string already parsed */
  } else if (!Number.isFinite(n)) return '';
  else if (n > 1e12) ms = n;
  else if (n > 1e9) ms = n * 1000;
  else ms = Date.now() + n * 1000;
  const diff = ms - Date.now();
  if (diff <= 0) return 'now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `in ${hours}h ${mins % 60}m`;
  return `in ${Math.round(hours / 24)}d`;
}

// small shared bits ----------------------------------------------------------

const RING_R = 42;
function ring(pct, { id = '', cls = '' } = {}) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="rb" cx="50" cy="50" r="${RING_R}"/><circle class="rf ${cls}${severity(v) ? ` ${severity(v)}` : ''}" ${
    id ? `id="${id}"` : ''
  } cx="50" cy="50" r="${RING_R}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - v}"/></svg>`;
}

function setRing(node, pct) {
  if (!node) return;
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  node.setAttribute('stroke-dashoffset', String(100 - v));
  node.classList.remove('warn', 'bad');
  const level = severity(v);
  if (level) node.classList.add(level);
}

const label = (iconName, text, aside = '') =>
  `<div class="label">${icon(iconName)}<span class="truncate">${text}</span>${aside ? `<span class="aside">${aside}</span>` : ''}</div>`;

const pageTitle = (title, sub = '') => `<div class="page-title"><h1>${title}</h1><span class="sub">${sub}</span></div>`;

const artBlock = (url, cls = '') =>
  `<div class="art ${cls}">${icon('music')}${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.remove()" />` : ''}</div>`;

function emptyState({ iconName, title, text, steps = [], actions = '' }) {
  return `<div class="card empty">
    ${icon(iconName)}
    <h3>${title}</h3>
    ${text ? `<p>${text}</p>` : ''}
    ${steps.length ? `<ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : ''}
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </div>`;
}

const timeParts = (now = new Date()) => {
  const h24 = eff.hour24();
  let hour = now.getHours();
  let suffix = '';
  if (!h24) {
    suffix = hour < 12 ? 'AM' : 'PM';
    hour = hour % 12 === 0 ? 12 : hour % 12;
  }
  return { h: h24 ? pad2(hour) : String(hour), m: pad2(now.getMinutes()), suffix, secs: now.getSeconds() };
};

const todayLabel = (now = new Date()) => now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// ---------------------------------------------------------------------------
// shell: theme, dock, paging
// ---------------------------------------------------------------------------

function applyTheme() {
  const root = document.documentElement;
  const t = themeDef();
  root.dataset.theme = t.id;
  const pinned = eff.accent();
  if (pinned) {
    root.style.setProperty('--accent', pinned);
    root.style.setProperty('--on-accent', inkFor(pinned));
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--on-accent');
  }
  $('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  const font = FONTS.some((f) => f.id === state.settings.font) ? state.settings.font : DEFAULT_FONT;
  if (font === 'theme') delete root.dataset.font;
  else root.dataset.font = font;
}

function buildDock() {
  $('#dock-items').innerHTML = MODES.map(
    (m, i) => `<button class="dock-item${i === state.modeIndex ? ' active' : ''}" data-i="${i}" aria-label="${m.label}">${icon(m.icon)}</button>`
  ).join('');
  $('#btn-settings').innerHTML = `${icon('sliders')}<i class="dock-dot"></i>`;
  $('#sheet-close').innerHTML = icon('x');
}

const pageWidth = () => DOM.stage.clientWidth || window.innerWidth;

function goto(index, { smooth = true } = {}) {
  const i = Math.max(0, Math.min(MODES.length - 1, index));
  DOM.stage.scrollTo({ left: i * pageWidth(), behavior: smooth ? 'smooth' : 'auto' });
  if (!smooth) activate(i);
}

// Runs whenever the visible page changes (swipe, tap or key).
function activate(index) {
  if (index === state.modeIndex && DOM.activated) return;
  DOM.activated = true;
  state.modeIndex = index;
  const id = MODES[index].id;
  document.body.dataset.mode = id;
  $$('.dock-item').forEach((n, i) => n.classList.toggle('active', i === index));
  try {
    localStorage.setItem(`${STORE_KEY}.mode`, String(index));
  } catch {
    /* ignore */
  }
  poke();

  if (id === 'weather' || id === 'ambient') {
    if (Date.now() - state.weatherAt > 300000) loadWeather({ soft: true });
  }
  if (id === 'music' || id === 'ambient') {
    if (Date.now() - state.lastfmAt > 30000) loadLastfm({ soft: true });
  }
  if ((id === 'agents' || id === 'ambient') && Date.now() - state.agentsAt > 60000) loadAgents({ soft: true });
}

// Double-tapping the clock or Ambient hides the dock for a true full screen; swipe
// still changes page, and a double tap again brings the dock back.
function applyDock() {
  document.documentElement.classList.toggle('nodock', Boolean(state.settings.hideDock));
  requestAnimationFrame(() => goto(state.modeIndex, { smooth: false }));
}

function watchDoubleTap() {
  let last = { t: 0, x: 0, y: 0 };
  document.addEventListener(
    'pointerup',
    (e) => {
      const page = e.target.closest?.('.page[data-mode="clock"], .page[data-mode="ambient"]');
      if (!page || e.target.closest('button, a')) return;
      const now = Date.now();
      const near = Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40;
      if (now - last.t < 320 && near) {
        last = { t: 0, x: 0, y: 0 };
        state.settings.hideDock = !state.settings.hideDock;
        writeStore();
        applyDock();
        toast(state.settings.hideDock ? 'Dock hidden. Double-tap to bring it back' : 'Dock shown');
        return;
      }
      last = { t: now, x: e.clientX, y: e.clientY };
    },
    { passive: true }
  );
}

function watchPaging() {
  let raf = 0;
  DOM.stage.addEventListener(
    'scroll',
    () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const i = Math.round(DOM.stage.scrollLeft / pageWidth());
        if (i !== state.modeIndex && i >= 0 && i < MODES.length) activate(i);
      });
    },
    { passive: true }
  );
  // Rotating the phone changes the page width: stay on the same page.
  window.addEventListener('resize', () => goto(state.modeIndex, { smooth: false }));
}

// ---------------------------------------------------------------------------
// settings sheet
// ---------------------------------------------------------------------------

function openSheet() {
  DOM.sheet.hidden = false;
  renderSheet();
}

function closeSheet() {
  DOM.sheet.hidden = true;
}

function setting(title, sub, control, cls = '') {
  return `<div class="setting${cls ? ` ${cls}` : ''}"><div><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>${control}</div>`;
}

const toggle = (key, on) => `<button class="switch" data-toggle="${key}" aria-pressed="${on}" aria-label="toggle"></button>`;

function renderSheet() {
  const cfg = state.config || {};
  const location = cfg.weather?.location;
  const burn = burnCfg();
  const burnSub = !burn.enabled
    ? 'Off — static pixels stay put'
    : `Drift ±${burn.driftPixels}px every ${burn.driftEverySeconds}s${
        burn.blankEveryMinutes && burn.blankSeconds ? ` · black ${burn.blankSeconds}s after ${burn.blankEveryMinutes}m idle` : ''
      }`;

  DOM.sheetBody.innerHTML = `
    <div class="sec">
      ${label('layout', 'Look')}
      <div class="themes">
        ${THEMES.map(
          (t) => `<button class="theme${t.id === eff.theme() ? ' active' : ''}" data-theme="${t.id}" aria-pressed="${t.id === eff.theme()}" style="background:${t.bg}">
            <span class="pv" style="background:${t.surface}"><i style="background:${t.muted}"></i><i style="background:${t.accent}"></i></span>
            <span><b>${t.name}</b><small>${t.note}</small></span>
          </button>`
        ).join('')}
      </div>
      ${setting(
        'Accent',
        'Overrides the theme colour',
        `<div class="swatches">
          <button class="swatch auto${eff.accent() ? '' : ' active'}" data-accent="" style="background:${themeDef().accent}" aria-label="Theme accent"></button>
          ${ACCENTS.map((c) => `<button class="swatch${eff.accent().toLowerCase() === c ? ' active' : ''}" data-accent="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
        </div>`,
        'col'
      )}
    </div>
    <div class="sec">
      ${label('layout', 'Font')}
      <div class="fonts">
        ${FONTS.map((f) => `<button class="font-card${(state.settings.font || DEFAULT_FONT) === f.id ? ' active' : ''}" data-font="${f.id}" aria-pressed="${(state.settings.font || DEFAULT_FONT) === f.id}"><b style="${f.family ? `font-family:${f.family},sans-serif` : ''}">14:57</b><span>${f.name}</span></button>`).join('')}
      </div>
    </div>
    <div class="sec">
      ${label('clock', 'Clock')}
      ${setting('24-hour time', eff.hour24() ? '17:42' : '5:42 PM', toggle('hour24', eff.hour24()))}
      ${setting('Seconds bar', 'Thin progress line under the time', toggle('showSeconds', eff.showSeconds()))}
    </div>
    <div class="sec">
      ${label('moon', 'Screen')}
      ${setting('Fullscreen', 'Hides the browser bars on your first tap', toggle('fullscreen', eff.fullscreen()))}
      ${setting('Keep awake', 'Wake Lock while the dock is open', toggle('keepAwake', eff.keepAwake()))}
      ${setting(
        'Dim after',
        'Fades to a night clock when untouched',
        `<select class="field" id="set-dim">${[0, 1, 5, 15, 30]
          .map((m) => `<option value="${m}"${Number(eff.dimMinutes()) === m ? ' selected' : ''}>${m === 0 ? 'never' : `${m} min`}</option>`)
          .join('')}</select>`
      )}
      ${setting('Burn-in protection', burnSub, toggle('burnIn', burn.enabled))}
    </div>
    <div class="sec">
      ${label('globe', 'Connections')}
      ${setting(
        'Weather',
        location ? escapeHtml(location) : state.weather?.label ? `~${escapeHtml(state.weather.label)} (guessed from IP)` : 'Set <code>weather.location</code>',
        `<button class="btn" id="set-weather-refresh">${icon('refresh')}Refresh</button>`
      )}
      ${setting(
        'Last.fm',
        cfg.lastfm?.configured ? `Connected as ${escapeHtml(cfg.lastfm.username)}` : 'Add <code>lastfm</code> keys in config.json',
        `<button class="btn" id="set-lastfm-refresh">${icon('refresh')}Refresh</button>`
      )}
      ${setting(
        'Coding agents',
        cfg.agents?.configured ? `${escapeHtml(cfg.agents.label || 'Router')} · ${escapeHtml(cfg.agents.baseUrl || '')}` : `Add <code>agents.password</code> for ${escapeHtml(cfg.agents?.label || 'your router')}`,
        `<button class="btn" id="set-agents-refresh">${icon('refresh')}Refresh</button>`
      )}
      ${setting('Server', `${escapeHtml(window.location.host)} · ${state.online ? 'live' : 'offline'}`, `<button class="btn" id="set-reload">${icon('refresh')}Reload</button>`)}
    </div>`;

  $$('[data-toggle]', DOM.sheetBody).forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.toggle;
      const next = btn.getAttribute('aria-pressed') !== 'true';
      state.settings[key] = next;
      writeStore();
      renderClock();
      renderSheet();
      if (key === 'keepAwake') next ? requestWakeLock() : releaseWakeLock();
      if (key === 'fullscreen' && !next && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      if (key === 'burnIn') {
        driftStep = 0;
        driftAt = Date.now();
        applyDrift({ reset: true });
        if (!next) endBlank();
      }
    };
  });
  $('#set-dim', DOM.sheetBody).onchange = (e) => {
    state.settings.dimMinutes = Number(e.target.value);
    writeStore();
    poke();
  };
  $$('[data-theme]', DOM.sheetBody).forEach((btn) => {
    btn.onclick = () => {
      state.settings.theme = btn.dataset.theme;
      writeStore();
      applyTheme();
      renderSheet();
    };
  });
  $$('[data-font]', DOM.sheetBody).forEach((btn) => {
    btn.onclick = () => {
      state.settings.font = btn.dataset.font;
      writeStore();
      applyTheme();
      renderSheet();
    };
  });
  $$('[data-accent]', DOM.sheetBody).forEach((btn) => {
    btn.onclick = () => {
      state.settings.accent = btn.dataset.accent;
      writeStore();
      applyTheme();
      renderSheet();
    };
  });
  $('#set-weather-refresh', DOM.sheetBody).onclick = () => (loadWeather({ force: true }), toast('Refreshing weather'));
  $('#set-lastfm-refresh', DOM.sheetBody).onclick = () => (loadLastfm({ force: true }), toast('Refreshing Last.fm'));
  $('#set-agents-refresh', DOM.sheetBody).onclick = () => (loadAgents({ force: true }), toast('Reading agent usage'));
  $('#set-reload', DOM.sheetBody).onclick = () => location.reload();
}

// ---------------------------------------------------------------------------
// clock
// ---------------------------------------------------------------------------

function clockShell() {
  if (DOM.clockBuilt) return;
  DOM.clockBody.innerHTML = `
    <div class="ck">
      <div class="ck-date" id="ck-date"></div>
      <div class="ck-time num-flat">
        <span class="ck-h" id="ck-h">--</span><span class="ck-sep">:</span><span class="ck-m" id="ck-m">--</span><span class="ck-suffix" id="ck-suffix"></span>
      </div>
      <div class="ck-secs" id="ck-secs"><i></i></div>
      <div class="ck-foot" id="ck-foot"></div>
    </div>`;
  DOM.clockBuilt = true;
}

function renderClock() {
  clockShell();
  const now = new Date();
  const t = timeParts(now);
  const set = (id, value) => {
    const n = $(id);
    if (n && n.textContent !== value) n.textContent = value;
  };
  set('#ck-h', t.h);
  set('#ck-m', t.m);
  set('#ck-suffix', t.suffix);
  set('#ck-date', todayLabel(now));
  DOM.dimTime.textContent = `${t.h}:${t.m}${t.suffix ? ` ${t.suffix}` : ''}`;

  const secs = $('#ck-secs');
  secs.hidden = !eff.showSeconds();
  $('i', secs).style.width = `${((t.secs + 1) / 60) * 100}%`;

  const w = state.weather?.current;
  const s = state.stats;
  const chips = [
    w ? { icon: w.isDay ? 'sun' : 'moon', text: `${Math.round(w.temp)}°` } : null,
    s?.cpu ? { icon: 'cpu', text: `${Math.round(s.cpu.load)}%` } : null,
    s?.cpu?.temp != null ? { icon: 'thermometer', text: `${s.cpu.temp}°C` } : null,
    s?.mem ? { icon: 'memory', text: `${Math.round(s.mem.percent)}%` } : null,
  ].filter(Boolean);
  const key = chips.map((c) => c.text).join('|');
  if (key !== DOM.clockFootKey) {
    DOM.clockFootKey = key;
    $('#ck-foot').innerHTML = chips.map((c) => `<span class="chip">${icon(c.icon)}<span class="num">${c.text}</span></span>`).join('');
  }
}

// ---------------------------------------------------------------------------
// weather
// ---------------------------------------------------------------------------

async function loadWeather({ soft = false, force = false } = {}) {
  try {
    state.weather = await jget('/api/weather');
    state.weatherError = null;
  } catch (err) {
    state.weatherError = err;
    if (!soft || force) state.weather = null;
  }
  state.weatherAt = Date.now();
  renderWeather();
  renderClock();
  renderAmbient();
}

function renderWeather() {
  const body = DOM.weatherBody;
  const w = state.weather;

  if (!w) {
    const err = state.weatherError;
    const noLocation = err?.code === 'NO_LOCATION';
    body.innerHTML = emptyState({
      iconName: 'pin',
      title: noLocation ? 'Where should the weather come from?' : 'Weather unavailable',
      text: noLocation
        ? 'Set <code>weather.location</code> in <code>config.json</code> to a city (for example <code>"Mumbai"</code>) and restart the server.'
        : escapeHtml(err?.message || 'The weather service could not be reached.'),
      actions: `<button class="btn primary" id="wx-retry">${icon('refresh')}Try again</button><button class="btn" id="wx-settings">${icon('sliders')}Settings</button>`,
    });
    $('#wx-retry').onclick = () => loadWeather({ force: true });
    $('#wx-settings').onclick = openSheet;
    return;
  }

  const c = w.current;
  const today = w.daily?.[0] || {};
  const sunrise = hourOf(today.sunrise);
  const sunset = hourOf(today.sunset);
  const isNightAt = (iso) => {
    const h = hourOf(iso);
    return Number.isFinite(h) && Number.isFinite(sunrise) && Number.isFinite(sunset) && (h < sunrise || h >= sunset);
  };
  const facts = [
    c.feels != null ? ['thermometer', `${Math.round(c.feels)}°`, 'Feels like'] : null,
    c.humidity != null ? ['droplet', `${Math.round(c.humidity)}%`, 'Humidity'] : null,
    c.wind != null ? ['wind', `${Math.round(c.wind)}`, `Wind ${w.units?.wind || ''}`] : null,
    today.sunrise ? ['sunrise', clockTime(today.sunrise), 'Sunrise'] : null,
    today.sunset ? ['sunset', clockTime(today.sunset), 'Sunset'] : null,
    today.pop != null ? ['cloud-rain', `${Math.round(today.pop)}%`, 'Rain'] : null,
  ].filter(Boolean);

  const lows = (w.daily || []).map((d) => d.min).filter(Number.isFinite);
  const highs = (w.daily || []).map((d) => d.max).filter(Number.isFinite);
  const weekMin = lows.length ? Math.min(...lows) : 0;
  const weekMax = highs.length ? Math.max(...highs) : 1;
  const span = Math.max(1, weekMax - weekMin);

  body.innerHTML = `
    <div class="card wx-hero">
      <div class="wx-place">${icon('pin')}<span>${escapeHtml(w.label)}${w.approximate ? ' · approx' : ''}</span></div>
      <div class="wx-main">
        <div class="wx-temp num-flat">${Math.round(c.temp)}<sup>${w.units?.temp || '°C'}</sup></div>
        <div class="wx-glyph">${icon(weatherIcon(c.code, c.isDay))}</div>
      </div>
      <div class="wx-desc">${escapeHtml(c.desc)}</div>
      ${today.max != null ? `<div class="wx-range">H ${Math.round(today.max)}°  ·  L ${Math.round(today.min)}°</div>` : ''}
    </div>
    <div class="wx-facts">
      ${facts.map(([ic, value, name]) => `<div class="card fact">${icon(ic)}<b>${escapeHtml(value)}</b><span>${escapeHtml(name)}</span></div>`).join('')}
    </div>
    <div class="card wx-hours">
      ${label('clock', 'Next hours')}
      <div class="hours">
        ${(w.hourly || [])
          .map(
            (h) => `<div class="hour${h.now ? ' now' : ''}">
          <span class="t">${h.now ? 'Now' : clockTime(h.time, false)}</span>
          ${icon(weatherIcon(h.code, h.now ? c.isDay : !isNightAt(h.time)))}
          <b>${h.temp != null ? `${Math.round(h.temp)}°` : '—'}</b>
          <span class="pop">${h.pop > 10 ? `${Math.round(h.pop)}%` : ''}</span>
        </div>`
          )
          .join('')}
      </div>
    </div>
    <div class="card wx-days">
      ${label('layout', `${(w.daily || []).length} days`)}
      <div class="days">
        ${(w.daily || [])
          .map((d, i) => {
            const lo = Number.isFinite(d.min) ? d.min : weekMin;
            const hi = Number.isFinite(d.max) ? d.max : weekMax;
            const left = ((lo - weekMin) / span) * 100;
            const width = Math.max(8, ((hi - lo) / span) * 100);
            return `<div class="day">
              <span class="n">${i === 0 ? 'Today' : dayLabel(d.date)}</span>
              ${icon(weatherIcon(d.code, true))}
              <span class="rng"><span>${Math.round(lo)}°</span><span class="rb"><i style="left:${left}%;width:${width}%"></i></span><b>${Math.round(hi)}°</b></span>
              <span class="p">${d.pop > 10 ? `${Math.round(d.pop)}%` : ''}</span>
            </div>`;
          })
          .join('')}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// pc stats
// ---------------------------------------------------------------------------

function tile(id, iconName, name) {
  return `<div class="card tile">
    <div class="label" id="${id}-label">${icon(iconName)}<span class="truncate">${name}</span></div>
    <div class="ring">${ring(0, { id: `${id}-ring` })}<div class="ring-c"><div class="ring-v"><span id="${id}-v">—</span><small id="${id}-u">%</small></div></div></div>
    <div class="foot truncate" id="${id}-foot">—</div>
  </div>`;
}

function statsShell() {
  if (DOM.statsBuilt) return;
  DOM.statsBody.innerHTML = `
        <div class="grid-2">
      ${tile('st-cpu', 'cpu', 'CPU')}
      ${tile('st-mem', 'memory', 'Memory')}
      ${tile('st-gpu', 'gpu', 'GPU')}
      <div class="card tile">
        ${label('network', 'Network', '<span id="st-net-tag"></span>')}
        <div class="net" style="grid-template-columns:1fr;gap:14px;margin:auto 0;width:100%">
          <div>${icon('arrow-down')}<span id="st-rx">—</span></div>
          <div>${icon('arrow-up')}<span id="st-tx">—</span></div>
        </div>
        <div class="foot" id="st-up">—</div>
      </div>
    </div>
    <div class="st-rest">
    <div class="card chart">
      ${label('activity', 'CPU load', '<span id="st-peak"></span>')}
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <line class="grid" x1="0" y1="10" x2="100" y2="10"/><line class="grid" x1="0" y1="20" x2="100" y2="20"/><line class="grid" x1="0" y1="30" x2="100" y2="30"/>
        <polygon class="area" id="st-area" points=""/><polyline class="line" id="st-line" points=""/>
      </svg>
    </div>
    <div class="card st-storage">
      ${label('storage', 'Storage')}
      <div class="rows" id="st-disks"></div>
      <div class="kvs" id="st-kv"></div>
    </div>
    <div class="card">
      ${label('terminal', 'Top processes', '<span>CPU · MEM</span>')}
      <div class="procs" id="st-procs"></div>
    </div>
    </div>`;
  DOM.statsBuilt = true;
}

function setText(sel, value) {
  const n = $(sel);
  if (n && n.textContent !== String(value)) n.textContent = value;
}

function renderStats() {
  statsShell();
  const s = state.stats;
  if (!s) return;
  const clean = (v, n = 20) => String(v || '').replace(/\(R\)|\(TM\)|CPU|Processor|GPU|Graphics/gi, '').replace(/\s+/g, ' ').trim().slice(0, n);

  const cpu = s.cpu || {};
  const load = Math.round(cpu.load || 0);
  setText('#st-cpu-v', load);
  setRing($('#st-cpu-ring'), load);
  setText('#st-cpu-foot', `${cpu.cores || '—'} threads${cpu.temp != null ? ` · ${cpu.temp}°C` : ''}`);

  const mem = s.mem || {};
  setText('#st-mem-v', Math.round(mem.percent || 0));
  setRing($('#st-mem-ring'), mem.percent || 0);
  setText('#st-mem-foot', mem.total ? `${fmtBytes(mem.used)} / ${fmtBytes(mem.total)}` : '—');

  const gpu = s.gpu || {};
  const gpuLabel = $('#st-gpu-label');
  const slot = gpu.load != null || gpu.temp != null ? 'gpu' : 'swap';
  if (gpuLabel && gpuLabel.dataset.slot !== slot) {
    gpuLabel.dataset.slot = slot;
    gpuLabel.innerHTML = `${icon(slot === 'gpu' ? 'gpu' : 'storage')}<span class="truncate">${slot === 'gpu' ? 'GPU' : 'Swap'}</span>`;
  }
  if (slot === 'gpu' && gpu.load != null) {
    setText('#st-gpu-v', Math.round(gpu.load));
    setText('#st-gpu-u', '%');
    setRing($('#st-gpu-ring'), gpu.load);
    setText('#st-gpu-foot', gpu.temp != null ? `${gpu.temp}°C` : 'load');
  } else if (slot === 'gpu') {
    setText('#st-gpu-v', gpu.temp);
    setText('#st-gpu-u', '°C');
    setRing($('#st-gpu-ring'), gpu.temp);
    setText('#st-gpu-foot', 'temperature');
  } else {
    const swapPct = mem.swapTotal ? (mem.swapUsed / mem.swapTotal) * 100 : 0;
    setText('#st-gpu-v', Math.round(swapPct));
    setText('#st-gpu-u', '%');
    setRing($('#st-gpu-ring'), swapPct);
    setText('#st-gpu-foot', mem.swapTotal ? `${fmtBytes(mem.swapUsed)} / ${fmtBytes(mem.swapTotal)}` : 'no swap');
  }

  setText('#st-rx', fmtRate(s.net?.rx));
  setText('#st-tx', fmtRate(s.net?.tx));
  setText('#st-net-tag', s.net?.iface || '');
  setText('#st-up', `up ${fmtUptime(s.uptime)}`);
  setText('#st-host', s.os?.host || 'this pc');

  state.cpuHistory.push(load);
  if (state.cpuHistory.length > 60) state.cpuHistory.shift();
  const h = state.cpuHistory;
  if (h.length > 1) {
    const pts = h.map((v, i) => `${((i / (h.length - 1)) * 100).toFixed(2)},${(38 - (Math.min(100, v) / 100) * 34).toFixed(2)}`).join(' ');
    $('#st-line').setAttribute('points', pts);
    $('#st-area').setAttribute('points', `0,40 ${pts} 100,40`);
    setText('#st-peak', `peak ${Math.max(...h)}%`);
  }

  const disks = s.disks || [];
  const diskKey = disks.map((d) => `${d.mount}:${d.use}`).join('|');
  if (diskKey !== state.diskKey) {
    state.diskKey = diskKey;
    $('#st-disks').innerHTML = disks.length
      ? disks
          .map(
            (d) => `<div class="rowbar"><div class="top"><b>${escapeHtml(d.mount)}</b><span class="num">${fmtBytes(d.size - d.used)} free · ${d.use}%</span></div>
            <div class="bar"><i class="${severity(d.use)}" style="width:${Math.min(100, d.use)}%"></i></div></div>`
          )
          .join('')
      : '<div class="foot">no disks reported</div>';
  }

  const procs = (s.procs || []).slice(0, 5);
  const procKey = procs.map((p) => `${p.name}${Math.round(p.cpu || 0)}`).join('|');
  if (procKey !== state.procKey) {
    state.procKey = procKey;
    $('#st-procs').innerHTML = procs.length
      ? procs
          .map(
            (p, i) => `<div class="proc"><span class="r">${pad2(i + 1)}</span><span class="truncate">${escapeHtml(p.name)}</span>
            <span class="num">${Number(p.cpu || 0).toFixed(1)}%</span><span class="num">${Number(p.mem || 0).toFixed(1)}%</span></div>`
          )
          .join('')
      : '<div class="foot">no process data</div>';
  }

  const kv = [
    ['Host', s.os?.host],
    ['Uptime', fmtUptime(s.uptime)],
    ['CPU', cpu.brand ? clean(cpu.brand, 22) : null],
    ['Clock', cpu.speed ? `${(cpu.speed / 1000).toFixed(2)} GHz` : null],
    ['CPU temp', cpu.temp != null ? `${cpu.temp}°C` : null],
  ].filter(([, v]) => v);
  const kvHtml = kv.map(([k, v]) => `<div class="kv"><span>${escapeHtml(k)}</span><span class="num">${escapeHtml(v)}</span></div>`).join('');
  if ($('#st-kv').dataset.html !== kvHtml) {
    $('#st-kv').dataset.html = kvHtml;
    $('#st-kv').innerHTML = kvHtml;
  }
}

// ---------------------------------------------------------------------------
// stream deck
// ---------------------------------------------------------------------------

function buildDeck() {
  const deck = state.config?.streamDeck;
  if (!deck) {
    DOM.deckBody.innerHTML = pageTitle('Deck') + emptyState({ iconName: 'alert', title: 'Deck unavailable', text: 'The server did not answer. Reload the page.' });
    return;
  }
  const cols = Math.max(2, Math.min(Number(deck.columns) || 3, 3));
  DOM.deckBody.innerHTML = `
    ${pageTitle('Deck', `${deck.buttons.length} keys`)}
    <div class="keys" style="--cols:${cols};--cols-l:${Math.min(6, (Number(deck.columns) || 4) + 2)}">
      ${deck.buttons
        .map((b) => `<button class="key" data-id="${escapeHtml(b.id)}">${icon(b.icon)}<span>${escapeHtml(b.label || b.id)}</span></button>`)
        .join('')}
    </div>`;
  $$('.key', DOM.deckBody).forEach((node) => node.addEventListener('click', () => pressAction(node)));
}

async function pressAction(node) {
  const id = node.dataset.id;
  node.classList.add('pressed');
  setTimeout(() => node.classList.remove('pressed'), 160);
  if (navigator.vibrate) navigator.vibrate(12);
  poke();
  try {
    const res = await fetch(`/api/actions/${encodeURIComponent(id)}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    toast(data.message || 'Done');
    node.classList.add('ok');
    setTimeout(() => node.classList.remove('ok'), 500);
  } catch (err) {
    toast(`${id}: ${err.message}`, 'err');
  }
}

// ---------------------------------------------------------------------------
// music (Last.fm)
// ---------------------------------------------------------------------------

async function loadLastfm({ soft = false, force = false } = {}) {
  try {
    state.lastfm = await jget('/api/lastfm');
    state.lastfmError = null;
  } catch (err) {
    state.lastfmError = err;
    if (!soft || force) state.lastfm = null;
  }
  state.lastfmAt = Date.now();
  renderMusic();
  renderAmbient();
}

function renderMusic() {
  const body = DOM.musicBody;
  const d = state.lastfm;
  const configured = Boolean(d && d.configured !== false);

  if (!configured) {
    const missing = d?.missing || [];
    body.innerHTML =
      pageTitle('Music') +
      emptyState({
        iconName: state.lastfmError ? 'alert' : 'music',
        title: state.lastfmError ? 'Last.fm could not be read' : 'Connect Last.fm',
        text: state.lastfmError ? escapeHtml(state.lastfmError.message) : 'Shows what you are playing right now, from any player that scrobbles.',
        steps: state.lastfmError
          ? []
          : [
              'Create a free API key at last.fm/api/account/create',
              `Put ${missing.length ? missing.map((k) => `<code>lastfm.${escapeHtml(k)}</code>`).join(' and ') : 'your username and key'} in <code>config.json</code>`,
              'Restart the server',
            ],
        actions: `<button class="btn primary" id="m-retry">${icon('refresh')}Retry</button>`,
      });
    $('#m-retry').onclick = () => loadLastfm({ force: true });
    return;
  }

  const playing = d.nowPlaying;
  const track = playing || d.lastPlayed;
  const recent = (d.recent || []).filter((r) => !(track && r.ts === track.ts && r.name === track.name)).slice(0, 5);
  const top = d.topArtists || [];

  body.innerHTML = `
    ${pageTitle('Music', d.totalScrobbles ? `${Number(d.totalScrobbles).toLocaleString()} scrobbles` : escapeHtml(d.user || ''))}
    <div class="card np">
      ${artBlock(track?.art)}
      <div class="np-text">
        <span class="live${playing ? ' on' : ''}"><i></i>${playing ? 'Now playing' : track ? `Last played ${relTime(track.ts)} ago` : 'Nothing playing'}</span>
        <div class="np-title">${escapeHtml(track?.name || 'Start something')}</div>
        ${track ? `<div class="np-artist">${escapeHtml(track.artist)}</div><div class="np-album">${escapeHtml(track.album || '')}</div>` : '<div class="np-album">Any player that scrobbles to Last.fm will show up here.</div>'}
      </div>
    </div>
    ${
      recent.length
        ? `<div class="card m-recent">${label('clock', 'Recently played')}<div class="tracks">${recent
            .map(
              (r) => `<div class="track">${artBlock(r.art)}<span style="min-width:0"><b class="truncate">${escapeHtml(r.name)}</b><small class="truncate">${escapeHtml(r.artist)}</small></span><time>${relTime(r.ts)}</time></div>`
            )
            .join('')}</div></div>`
        : ''
    }
    ${
      top.length
        ? `<div class="card m-artists">${label('activity', 'Top artists · 7 days')}<div class="artists">${top
            .map((a) => `<div class="artist">${artBlock(a.art)}<b class="truncate">${escapeHtml(a.name)}</b><small>${a.playcount} plays</small></div>`)
            .join('')}</div></div>`
        : ''
    }`;
}

// ---------------------------------------------------------------------------
// coding agents — quota + token usage from a local router
// ---------------------------------------------------------------------------

async function loadAgents({ soft = false, force = false } = {}) {
  try {
    state.agents = await jget(`/api/agents${force ? '?refresh=1' : ''}`);
    state.agentsError = null;
  } catch (err) {
    state.agentsError = err;
    if (!soft || force) state.agents = null;
  }
  state.agentsAt = Date.now();
  renderAgents();
  renderAmbient();
}

// `?demo` shows how the page looks with sample data, so the layout can be judged
// without a router.
function demoAgents() {
  const h = 3600000;
  const w = (name, percent, inHours, total = 100) => ({ name, used: Math.round((percent / 100) * total), total, unit: '', percent, reset: new Date(Date.now() + inHours * h).toISOString() });
  return {
    configured: true,
    reachable: true,
    source: '9Router',
    updated: Date.now(),
    totals: { requests: 8749, tokensInput: 2615042870, tokensOutput: 4459205, tokensCache: 2284717368, cost: 856.11 },
    providers: [
      { name: 'antigravity', requests: 7300, tokens: 2423323513, cost: 731.58 },
      { name: 'opencode', requests: 1010, tokens: 118059130, cost: 8.31 },
      { name: 'zed', requests: 139, tokens: 69003642, cost: 111.04 },
      { name: 'kilocode', requests: 107, tokens: 938981, cost: 0 },
    ],
    accounts: [
      { provider: 'codex', label: 'work', plan: 'free', limitReached: true, windows: [w('session', 100, 400)] },
      { provider: 'antigravity', label: 'main', plan: 'Antigravity', windows: [w('Gemini (Weekly)', 21, 30), w('Claude & GPT (Weekly)', 6, 30), w('Gemini 3.8 Flash (High)', 0, 6)] },
      { provider: 'kiro', label: 'Account 1', plan: 'KIRO FREE', windows: [w('credit', 16, 9, 50)] },
    ],
    last10: [0, 0, 1, 3, 2, 0, 4, 6, 2, 1],
    recent: [
      { at: Date.now() - 6 * 60000, model: 'gemini-3.8-flash-high', provider: 'antigravity', tokens: 18420, ok: true },
      { at: Date.now() - 19 * 60000, model: 'kilo-auto/free', provider: 'kilocode', tokens: 960, ok: true },
      { at: Date.now() - 52 * 60000, model: 'qfmodel', provider: 'qoder', tokens: 158, ok: false },
    ],
  };
}

const providerName = (id) => String(id || '').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function acctRow(a) {
  const w = a.windows[0];
  const pct = Math.round(w.percent);
  const extra = a.windows.length > 1 ? ` +${a.windows.length - 1}` : '';
  const reset = w.reset ? fmtReset(w.reset).replace('in ', '') : '';
  return `<div class="arow${a.limitReached || pct >= 100 ? ' hit' : ''}">
    <div class="top"><b><span class="pn">${escapeHtml(providerName(a.provider))}</span>${a.label ? `<span class="lab">${escapeHtml(a.label)}</span>` : ''}</b><span class="num">${pct}%${reset ? `<span class="rs"> · ${escapeHtml(reset)}</span>` : ''}</span></div>
    <div class="bar"><i class="${severity(pct)}" style="width:${Math.max(2, pct)}%"></i></div>
    <div class="sub"><span>${escapeHtml(w.name)}${extra}</span><span>${reset ? `resets ${escapeHtml(reset)}` : ''}</span></div>
  </div>`;
}

function renderAgents() {
  const body = DOM.agentsBody;
  let d = state.agents;
  const cfgInfo = state.config?.agents || {};
  if (DEMO && !(d && d.reachable)) d = demoAgents();
  const name = escapeHtml(d?.source || cfgInfo.label || 'router');
  const actions = `<button class="btn primary" id="ag-retry">${icon('refresh')}Try again</button><button class="btn" id="ag-settings">${icon('sliders')}Settings</button>`;
  const wire = () => {
    $('#ag-retry').onclick = () => loadAgents({ force: true });
    $('#ag-settings').onclick = openSheet;
  };

  if (!d && !state.agentsError && !state.agentsAt) {
    body.innerHTML = pageTitle('Agents');
    return;
  }

  if (!d || state.agentsError) {
    body.innerHTML =
      pageTitle('Agents') +
      emptyState({ iconName: 'gauge', title: 'No answer from the dock server', text: escapeHtml(state.agentsError?.message || 'Reload the page.'), actions });
    wire();
    return;
  }

  if (!d.reachable) {
    body.innerHTML =
      pageTitle('Agents', name) +
      emptyState({
        iconName: 'gauge',
        title: d.configured ? `Could not read ${name} usage` : `Connect ${name}`,
        text: d.configured ? escapeHtml(d.error || 'The router refused the request.') : 'See your coding-agent quota and token use at a glance.',
        steps: d.configured ? [] : [`Put your ${name} dashboard password in <code>agents.password</code> in <code>config.json</code>`, 'Restart the server'],
        actions,
      });
    wire();
    return;
  }

  const t = d.totals || {};
  const stats = [
    ['Requests', t.requests, ''],
    ['Spend', t.cost, '$'],
    ['Tokens in', t.tokensInput, ''],
    ['Tokens out', t.tokensOutput, ''],
  ].filter(([, v]) => v != null);
  const accounts = d.accounts || [];
  const maxReq = Math.max(1, ...(d.providers || []).map((p) => p.requests));

  body.innerHTML = `
    ${pageTitle('Agents', `${name}${d.updated ? ` · ${relTime(d.updated)} ago` : ''}`)}
    <div class="ag-grid">
      ${stats.length ? `<div class="ag-stats">${stats.map(([n, v, pre]) => `<div class="card stat"><span>${n}</span><b>${pre}${fmtNum(v)}</b></div>`).join('')}</div>` : ''}
      <div class="card ag-accts">
        ${label('gauge', 'Quota · most used window', `<span>${accounts.length} accounts</span>`)}
        ${
          accounts.length
            ? `<div class="alist">${accounts.map(acctRow).join('')}</div>`
            : `<p style="color:var(--muted);margin:10px 0 0;font-size:14px">${d.quotaLoading ? 'Reading provider quotas. The first read takes about 30 seconds.' : 'No provider reported a quota window.'}</p>`
        }
      </div>
      ${
        (d.providers || []).length
          ? `<div class="card ag-prov">${label('layout', 'By provider', '<span>requests</span>')}<div class="rows">${d.providers
              .slice(0, 3)
              .map(
                (p) => `<div class="rowbar"><div class="top"><b class="truncate">${escapeHtml(providerName(p.name))}</b><span class="num">${fmtNum(p.requests)} · $${p.cost.toFixed(0)}</span></div>
                <div class="bar"><i style="width:${Math.max(2, (p.requests / maxReq) * 100)}%"></i></div></div>`
              )
              .join('')}</div></div>`
          : ''
      }
    </div>`;
}

// ---------------------------------------------------------------------------
// ambient — clock, weather, now playing and PC on one screen
// ---------------------------------------------------------------------------

function ambientShell() {
  if (DOM.ambientBuilt) return;
  DOM.ambientBody.innerHTML = `
    <div class="amb">
      <div class="amb-top">
        <div><div class="amb-time" id="ab-time">--:--</div><div class="amb-date" id="ab-date"></div></div>
        <div class="amb-wx" id="ab-wx"></div>
      </div>
      <div class="card amb-np" id="ab-track"></div>
      <div class="card amb-ctl" id="ab-ctl" hidden></div>
      <div class="amb-cards">
        <div class="card">${label('cpu', 'This PC')}<div class="mini" id="ab-pc"></div></div>
        <div class="card">${label('gauge', 'Agent quota', '<span id="ab-ag-note"></span>')}<div class="mini" id="ab-agents"></div></div>
      </div>
      <div class="amb-foot" id="ab-foot"></div>
    </div>`;
  DOM.ambientBody.addEventListener('click', (e) => {
    const key = e.target.closest('.amb-key');
    if (key) pressAction(key);
  });
  DOM.ambientBuilt = true;
}

const miniRow = (name, value, pct) =>
  pct == null
    ? `<div class="row plain"><span>${escapeHtml(name)}</span><b class="num">${escapeHtml(value)}</b></div>`
    : `<div class="row"><span class="truncate">${escapeHtml(name)}</span><div class="bar"><i class="${severity(pct)}" style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></i></div><b class="num">${escapeHtml(value)}</b></div>`;

// Media and volume keys from the deck, as big buttons under the now-playing card.
const AMBIENT_KEYS = ['volume-1', 'media', 'volume-x', 'volume-2'];
function renderAmbientControls() {
  const node = $('#ab-ctl');
  const buttons = (state.config?.streamDeck?.buttons || []).filter((b) => AMBIENT_KEYS.includes(b.icon));
  if (!node || !buttons.length || node.dataset.built === String(buttons.length)) return;
  node.dataset.built = String(buttons.length);
  node.hidden = false;
  buttons.sort((x, y) => AMBIENT_KEYS.indexOf(x.icon) - AMBIENT_KEYS.indexOf(y.icon));
  node.innerHTML = buttons.map((b) => `<button class="amb-key" data-id="${escapeHtml(b.id)}" aria-label="${escapeHtml(b.label || b.id)}">${icon(b.icon)}</button>`).join('');
}

function renderAmbient() {
  ambientShell();
  renderAmbientControls();
  const w = state.weather;
  const s = state.stats;
  const d = state.lastfm;
  const c = w?.current;

  $('#ab-wx').innerHTML = c
    ? `${icon(weatherIcon(c.code, c.isDay))}<b>${Math.round(c.temp)}${escapeHtml(w.units?.temp || '°C')}</b>`
    : '';

  const cpu = s?.cpu || {};
  const mem = s?.mem || {};
  const disk = s?.disks?.[0];
  $('#ab-pc').innerHTML = s
    ? miniRow('CPU', `${Math.round(cpu.load || 0)}%`, cpu.load) +
      miniRow('Memory', `${Math.round(mem.percent || 0)}%`, mem.percent) +
      (disk ? miniRow(`Disk ${disk.mount}`, `${disk.use}%`, disk.use) : '') +
      miniRow('Network', `↓ ${fmtRate(s.net?.rx)}   ·   ↑ ${fmtRate(s.net?.tx)}`)
    : '<div class="row plain"><span>Waiting for the first sample</span></div>';

  // The quota windows closest to running out, one per account.
  const ag = state.agents;
  const accounts = ag?.reachable ? (ag.accounts || []).slice(0, 4) : [];
  const counts = {};
  accounts.forEach((a) => (counts[a.provider] = (counts[a.provider] || 0) + 1));
  $('#ab-ag-note').textContent = ag?.reachable ? `${(ag.accounts || []).length} accounts` : '';
  $('#ab-agents').innerHTML = accounts.length
    ? accounts
        .map((a) => {
          const pct = Math.round(a.windows[0].percent);
          const name = `${providerName(a.provider)}${counts[a.provider] > 1 && a.label ? ` ${a.label}` : ''}`;
          return miniRow(name, `${pct}%`, pct);
        })
        .join('')
    : `<div class="row plain"><span>${ag?.reachable ? 'No quota windows yet' : 'Agents not connected'}</span></div>`;

  const track = d?.nowPlaying || d?.lastPlayed;
  const configured = Boolean(d && d.configured !== false);
  $('#ab-track').innerHTML = track
    ? `${artBlock(track.art)}<span style="min-width:0"><b class="truncate">${escapeHtml(track.name)}</b><small class="truncate">${escapeHtml(track.artist)}</small></span>
       <span class="live${d.nowPlaying ? ' on' : ''}"><i></i>${d.nowPlaying ? 'Playing' : relTime(track.ts)}</span>`
    : `${artBlock(null)}<span><b>${configured ? 'Nothing playing' : 'Music not connected'}</b><small>${configured ? escapeHtml(d?.user || '') : 'Add Last.fm in config.json'}</small></span><span></span>`;

  $('#ab-foot').innerHTML = [
    w?.label ? `<span>${icon('pin')}${escapeHtml(w.label)}</span>` : '',
    s?.net?.iface ? `<span>${icon('network')}${escapeHtml(s.net.iface)}</span>` : '',
    s?.uptime ? `<span>${icon('clock')}up ${fmtUptime(s.uptime)}</span>` : '',
  ].join('');

  ambientClock();
}

function ambientClock() {
  const time = $('#ab-time');
  if (!time) return;
  const now = new Date();
  const t = timeParts(now);
  const text = `${t.h}:${t.m}${t.suffix ? ` ${t.suffix}` : ''}`;
  if (time.textContent !== text) time.textContent = text;
  setText('#ab-date', todayLabel(now));
}
async function requestWakeLock() {
  if (!('wakeLock' in navigator) || !eff.keepAwake()) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener?.('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null; // denied, or the page is not visible
  }
}

function releaseWakeLock() {
  try {
    wakeLock?.release();
  } catch {
    /* already released */
  }
  wakeLock = null;
}
const BURN_DEFAULTS = {
  enabled: true,
  driftPixels: 6,
  driftEverySeconds: 60,
  blankEveryMinutes: 20,
  blankSeconds: 25,
};

let driftStep = 0;
let driftAt = 0;
let lastBlankAt = Date.now();
let blankUntil = 0;

function burnCfg() {
  const c = state.config?.display?.burnIn || {};
  const num = (key, min, max) => {
    const raw = c[key];
    const n = Number(raw);
    if (raw === null || raw === '' || !Number.isFinite(n)) return BURN_DEFAULTS[key];
    return Math.max(min, Math.min(max, n));
  };
  return {
    enabled: state.settings.burnIn ?? (typeof c.enabled === 'boolean' ? c.enabled : true),
    driftPixels: num('driftPixels', 0, 24),
    driftEverySeconds: num('driftEverySeconds', 10, 3600),
    blankEveryMinutes: num('blankEveryMinutes', 0, 720),
    blankSeconds: num('blankSeconds', 0, 300),
  };
}

// Clockwise walk around a square of ±radius, so the shift migrates over the
// whole area instead of snapping between two extremes.
const DRIFT_POINTS = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [1, 0.5],
  [1, 1],
  [0.5, 1],
  [0, 1],
  [-0.5, 1],
  [-1, 1],
  [-1, 0.5],
  [-1, 0],
  [-1, -0.5],
  [-1, -1],
  [-0.5, -1],
  [0, -1],
  [0.5, -1],
];

function applyDrift({ reset = false } = {}) {
  const root = document.documentElement.style;
  const cfg = burnCfg();
  if (!cfg.enabled || !cfg.driftPixels) {
    root.setProperty('--drift-x', '0px');
    root.setProperty('--drift-y', '0px');
    return;
  }
  const [x, y] = DRIFT_POINTS[driftStep++ % DRIFT_POINTS.length];
  root.setProperty('--drift-x', reset ? '0px' : `${(x * cfg.driftPixels).toFixed(1)}px`);
  root.setProperty('--drift-y', reset ? '0px' : `${(y * cfg.driftPixels).toFixed(1)}px`);
}

function startBlank(ms) {
  state.blanked = true;
  blankUntil = Date.now() + ms;
  DOM.blank.classList.add('on');
}

function endBlank() {
  state.blanked = false;
  lastBlankAt = Date.now();
  DOM.blank.classList.remove('on');
}

function burnTick() {
  const cfg = burnCfg();
  const now = Date.now();

  if (!cfg.enabled) {
    if (state.blanked) endBlank();
    return;
  }

  if (now - driftAt >= cfg.driftEverySeconds * 1000) {
    driftAt = now;
    applyDrift();
  }

  if (state.blanked) {
    if (now >= blankUntil) endBlank();
    return;
  }

  const every = cfg.blankEveryMinutes * 60000;
  if (!every || !cfg.blankSeconds) return;
  if (now - state.lastActivity < every) return;
  if (now - lastBlankAt < every) return;
  startBlank(cfg.blankSeconds * 1000);
}

// ---------------------------------------------------------------------------
// live link, wake lock, dimming
// ---------------------------------------------------------------------------

function setOnline(ok) {
  if (state.online === ok) return;
  state.online = ok;
  DOM.app.classList.toggle('offline', !ok);
}

// Browsers allow only ~6 connections per host. A background tab that keeps its live
// stream open would starve new page loads, so the stream is dropped while hidden.
let eventSource = null;

function connectEvents() {
  if (eventSource) return;
  eventSource = new EventSource('/api/events');
  eventSource.onopen = () => setOnline(true);
  eventSource.onerror = () => setOnline(false);
  eventSource.onmessage = (event) => {
    try {
      state.stats = JSON.parse(event.data);
    } catch {
      return;
    }
    state.lastStatsAt = Date.now();
    setOnline(true);
    renderStats();
    renderClock();
    renderAmbient();
  };
}

function disconnectEvents() {
  eventSource?.close();
  eventSource = null;
}


// A plain-HTTP page cannot become an installed fullscreen app, so the page asks
// for fullscreen itself. Browsers only allow that from a tap, hence the listener.
function enterFullscreen() {
  if (!eff.fullscreen() || document.fullscreenElement || !document.fullscreenEnabled) return;
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}

function poke() {
  state.lastActivity = Date.now();
  if (state.blanked) endBlank();
  if (state.dimmed) {
    state.dimmed = false;
    DOM.dimmer.hidden = true;
    requestWakeLock();
  }
}

function checkDim() {
  const minutes = Number(eff.dimMinutes()) || 0;
  if (!minutes || state.dimmed) return;
  if (Date.now() - state.lastActivity > minutes * 60000) {
    state.dimmed = true;
    DOM.dimmer.hidden = false;
    closeSheet();
    renderClock();
    releaseWakeLock();
  }
}

function refreshIfStale() {
  if (Date.now() - state.weatherAt > 600000) loadWeather({ soft: true });
  if (Date.now() - state.lastfmAt > 60000) loadLastfm({ soft: true });
}

function heartbeat() {
  if (state.lastStatsAt && Date.now() - state.lastStatsAt > 15000) setOnline(false);
  const id = MODES[state.modeIndex].id;
  if ((id === 'music' || id === 'ambient') && Date.now() - state.lastfmAt > 30000) loadLastfm({ soft: true });
  if (id === 'agents' && Date.now() - state.agentsAt > 60000) loadAgents({ soft: true });
  checkDim();
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

function cacheDom() {
  DOM.app = $('#app');
  DOM.stage = $('#stage');
  DOM.clockBody = $('#clock-body');
  DOM.ambientBody = $('#ambient-body');
  DOM.weatherBody = $('#weather-body');
  DOM.statsBody = $('#stats-body');
  DOM.agentsBody = $('#agents-body');
  DOM.deckBody = $('#deck-body');
  DOM.musicBody = $('#music-body');
  DOM.dimmer = $('#dimmer');
  DOM.dimTime = $('#dim-time');
  DOM.blank = $('#blank');
  DOM.sheet = $('#sheet');
  DOM.sheetBody = $('#sheet-body');
}

function bindEvents() {
  $('#dock-items').addEventListener('click', (e) => {
    const btn = e.target.closest('.dock-item');
    if (btn) goto(Number(btn.dataset.i));
  });
  $('#btn-settings').onclick = openSheet;
  $('#sheet-close').onclick = closeSheet;
  DOM.sheet.addEventListener('click', (e) => {
    if (e.target === DOM.sheet) closeSheet();
  });
  DOM.dimmer.addEventListener('click', poke);
  watchPaging();
  watchDoubleTap();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'ArrowRight') goto(state.modeIndex + 1);
    if (e.key === 'ArrowLeft') goto(state.modeIndex - 1);
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= MODES.length) goto(n - 1);
  });

  window.addEventListener('pagehide', disconnectEvents);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') disconnectEvents();
    if (document.visibilityState === 'visible') {
      connectEvents();
      poke();
      requestWakeLock();
      refreshIfStale();
    }
  });
  document.addEventListener('pointerdown', poke, { passive: true });
  document.addEventListener('pointerup', enterFullscreen, { passive: true });
}

async function init() {
  cacheDom();
  bindEvents();
  applyTheme();
  buildDock();
  document.documentElement.classList.toggle('nodock', Boolean(state.settings.hideDock));
  renderClock();
  renderStats();
  renderAmbient();

  let start = 0;
  try {
    start = Number(localStorage.getItem(`${STORE_KEY}.mode`)) || 0;
  } catch {
    /* ignore */
  }
  goto(Math.max(0, Math.min(MODES.length - 1, start)), { smooth: false });

  connectEvents();
  setInterval(() => {
    renderClock();
    ambientClock();
  }, 1000);
  setInterval(heartbeat, 10000);
  setInterval(burnTick, 1000);
  requestWakeLock();

  try {
    state.config = await jget('/api/config');
    document.title = state.config.title || 'Desk Deck';
  } catch {
    state.config = null;
  }
  applyTheme();
  driftAt = Date.now();
  applyDrift({ reset: true });
  buildDeck();
  renderClock();
  renderAmbient();
  loadWeather();
  loadLastfm();
  loadAgents({ soft: true });
  poke();
}

// Registering a worker is what lets Chrome offer a real fullscreen install.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

init();
