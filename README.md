# Desk Deck

Turn a spare phone into a desk dock. A small Node server runs on your PC; the phone opens a fullscreen web app over Wi-Fi and becomes a clock, weather station, PC monitor, coding-agent dashboard, stream deck and Last.fm display — all in a single swipeable screen, no browser chrome.

![Desk Deck on Xiaomi Mi A3](https://user-images.githubusercontent.com/placeholder/desk-deck-preview.png)

```
Clock    huge time + date, fades to a night clock when idle
Ambient  one-screen overview: clock · PC vitals · agent quotas · media controls
Weather  current conditions, 12-hour hourly, 7-day forecast (Open-Meteo, no key needed)
PC       CPU / RAM / GPU / disk / network, live CPU sparkline, top processes
Agents   per-account quota bars + token usage for 9Router (or any OpenAI-proxy router)
Deck     buttons that launch apps, open URLs or fire media/volume keys on the PC
Music    Last.fm now-playing + album art, recent scrobbles, top artists
```

Navigation is a **left-right swipe**. No tap-buttons to flip between modes. A slim dock at the bottom (side rail in landscape) lets you jump straight to any page.

---

## Design

- **OLED first.** Canvas is pure `#000` — pixels not drawing anything are physically off. No gradients, no glows, no drop shadows anywhere.
- **Outfit by default.** Google's Outfit (variable, self-hosted as a 32 KB WOFF2 latin subset) is used for all UI text. Switching to "Theme original" in Settings restores each theme's own typeface.
- **Four themes, not just four palettes.** Each theme changes fonts, corner shapes, label style *and* colour. They look genuinely different:
  - **Obsidian** — pure black, azure accent, hairline cards, Space Grotesk UI + JetBrains Mono readouts.
  - **Material** — Material 3 tonal surfaces, 28 px corners, sentence-case labels, Figtree, tonal pill on the active dock icon.
  - **Ember** — amber terminal feel, JetBrains Mono everywhere, `>` prompt-style labels, square boxes.
  - **Arasaka** — black and signal red, square corners, uppercase tracked Archivo, red edge rules.
- **Icons, never emoji.** Every glyph is an inline SVG from the `ICONS` map in `public/app.js` — 24×24, 1.6 px stroke, `currentColor`. Deck buttons use an icon name from that set.
- **Double-tap to go truly fullscreen.** Double-tap anywhere on the Clock or Ambient page to hide the dock nav bar. Double-tap again to bring it back. A toast confirms each toggle.
- **AMOLED burn-in care.** The whole UI drifts a few pixels every minute (so static text never burns the same pixels). Every 20 idle minutes the panel goes true `#000` for 25 seconds (pixels off), then comes back. Both protections are on by default and switchable per-phone in Settings.

---

## Quick start

```bash
npm install        # one dependency: systeminformation
npm start
```

The console prints the URL:

```
Open on the phone (same Wi-Fi):
  http://192.168.1.x:4321
On this PC:
  http://127.0.0.1:4321
```

### Making it fullscreen on Android

Chrome on Android hides the address bar when you scroll, but the phone's system bars stay. To get a truly fullscreen experience:

1. Open the dock URL in Chrome on the phone.
2. Tap ⋮ → **Add to Home screen** to install it as a PWA. Chrome installs a minimal WebAPK and launches the page without any browser chrome.
3. Before installing: go to `chrome://flags`, search for `unsafely-treat-insecure-origin-as-secure`, add `http://<your-PC-IP>:4321` to the list and enable it. This allows the service worker and PWA install on plain HTTP over LAN.
4. Once on the home screen, tap the icon. It opens fullscreen.
5. Double-tap the clock face to also hide the dock bar at the bottom — pure screen.

> **Nothing loads on the phone?** Windows Firewall is blocking Node. Allow it on *private* networks when Windows asks, or add an inbound TCP rule for port 4321. Make sure the phone is on the same Wi-Fi as the PC (not a guest network), and the PC isn't asleep.

> **Keep the screen on.** The dock uses the Screen Wake Lock API. Make sure Chrome has the Wake Lock permission, or go to `chrome://settings/content/wakeLock` and allow your PC's address.

---

## Optimised for Xiaomi Mi A3

Layouts are tuned for the Mi A3's 360×780 dp screen in both orientations:

- **Portrait (360×780):** each page fills the screen exactly — no vertical scroll, no wasted gap.
- **Landscape (780×360):** the dock moves to a side rail on the left; each page switches to a 2-column grid. All content still fits without scrolling.

The Mi A3 has an AMOLED panel, so OLED-first design and burn-in protection are especially relevant here.

---

## Configuration — `config.json`

Created with defaults on first run, re-read every start. Edit it and restart the server. **Never commit this file** — it holds your API keys and passwords (it is in `.gitignore`).

```jsonc
{
  "port": 4321,
  "title": "Desk Deck",
  "clock": { "hour24": true, "showSeconds": false, "showDate": true },
  "weather": {
    "location": "Mumbai",       // city name; "" = guess from PC's public IP
    "units": "metric",          // metric (°C, km/h) | imperial (°F, mph)
    "refreshMinutes": 10
  },
  "display": {
    "theme": "obsidian",        // obsidian | material | ember | arasaka
    "dimAfterMinutes": 5,       // 0 = never dim
    "keepAwake": true,
    "accent": "",               // "" = use the theme's accent colour
    "brandMark": true,          // show the ◈ logo mark in the dock
    "brandWordmark": "auto",    // "auto" | true | false
    "burnIn": {
      "enabled": true,
      "driftPixels": 6,
      "driftEverySeconds": 60,
      "blankEveryMinutes": 20,
      "blankSeconds": 25
    }
  },
  "streamDeck": {
    "columns": 4,
    "buttons": [
      // see "Stream deck" section below for all action types
      { "id": "vscode", "label": "VS Code", "icon": "code",
        "action": { "type": "launch", "target": "code" } }
    ]
  },
  "agents": {
    "label": "9Router",                 // displayed in the Agents page header
    "baseUrl": "http://127.0.0.1:20128",// URL of your 9Router / OpenAI-proxy dashboard
    "password": "",                     // dashboard login password
    "apiKey": "",                       // your model API key (sk-…) — for the API header
    "refreshSeconds": 60
  },
  "lastfm": {
    "username": "",             // your Last.fm username
    "apiKey": "",               // https://www.last.fm/api/account/create
    "refreshSeconds": 30
  }
}
```

Theme, accent, clock format, dim timer, burn-in and wake lock are also in the phone's Settings sheet, stored on the phone — so each phone can look different from the same server.

---

## Coding agents / 9Router

The **Agents** page shows per-account quota bars and token-usage history from a locally-running AI router (tested with [9Router](https://github.com/9router)).

Setup:
1. Set `agents.baseUrl` to your router's local address (e.g. `http://127.0.0.1:20128`).
2. Set `agents.password` to the router's dashboard login password.
3. Set `agents.apiKey` to your API key if the router's usage endpoints require one.
4. Restart the server.

The server logs in to the dashboard (POST `/api/auth/login`), then polls `/api/usage/history` for totals and per-connection quota data. Login has a 10-minute cooldown on failure to prevent account lockout.

Preview without a running router: open `/?demo` — the Agents page fills with sample data.

---

## Stream deck

### Action types

| type | what it does | `target` example |
|---|---|---|
| `launch` | starts an app (`args` is optional) | `"code"`, `"explorer"`, `"wt"` |
| `url` | opens an https URL in the default browser | `"https://github.com"` |
| `shell` | runs a shell command | `"rundll32.exe user32.dll,LockWorkStation"` |
| `keys` | fires a Windows media / volume key | see table below |

### Key names

| value | key |
|---|---|
| `volume_up` | raise volume |
| `volume_down` | lower volume |
| `mute` | toggle mute |
| `play_pause` | play / pause |
| `next` | next track |
| `prev` | previous track |

Media keys are sent via a persistent PowerShell process that calls `keybd_event` through P/Invoke — so they work regardless of which app has focus.

**Security:** the phone can only trigger button *ids* that exist in `config.json`. No arbitrary command ever comes from the network. Anyone on your Wi-Fi who opens the page can press buttons, so keep `shell` entries to things you're fine with a houseguest firing. Never expose port 4321 to the internet.

### Icon names

```
brand  clock  grid  activity  music  sun  moon  cloud  cloud-sun  cloud-moon
cloud-drizzle  cloud-rain  cloud-snow  cloud-lightning  fog  droplet  wind
thermometer  sunrise  sunset  pin  cpu  gpu  memory  network  arrow-down  arrow-up
storage  code  folder  folder-open  terminal  globe  media  volume-2  volume-1
volume-x  camera  lock  sliders  x  refresh  external  alert  layout
```

To add your own, add a path string to `ICONS` in `public/app.js`:

```js
myIcon: '<path d="M4 12h16"/>',
```

---

## PC stats on Windows

Most values come straight from the OS via the `systeminformation` package.

- **CPU temperature** needs an elevated process. Start the server from an **Administrator** terminal and it shows up; otherwise the card hides it.
- **GPU** data comes from `nvidia-smi` (NVIDIA) or the vendor's WMI provider. Intel/AMD integrated GPUs usually report the model and VRAM but not sensors — install [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) for richer data.

---

## Last.fm

1. Create an API key (free, instant): <https://www.last.fm/api/account/create>
2. Put your username and the key in `config.json` under `lastfm.username` / `lastfm.apiKey`.
3. Restart. The Music page fills in automatically.

Scrobbles come from whatever you already listen with (Spotify, YouTube Music, foobar2000, Plex, …). This is **read-only** — transport lives on the Deck's media-key buttons. Cover art comes from Last.fm, falling back to the keyless iTunes Search API.

---

## Weather

Open-Meteo is keyless. The server geocodes `weather.location` and requests that exact coordinate. Leave it empty to guess from the PC's public IP (labelled "approx" on-screen).

---

## Burn-in care (AMOLED)

Two independent protections, both on by default, both togglable per-phone in Settings:

- **Drift** — every `driftEverySeconds` the entire UI shifts one step in a square of ±`driftPixels`, with a 3-second ease so you never see it move. The night clock drifts twice as far. Applied as a CSS `transform` on `#app`, so layout, hit areas and the indicator all move together.
- **Black rests** — after `blankEveryMinutes` of no input the panel fades to true `#000` for `blankSeconds` (pixels physically off). Any tap cancels immediately.

---

## Fonts

All self-hosted in `public/fonts/` as latin-subset WOFF2 (SIL Open Font License). Works offline.

| family | used by | role |
|---|---|---|
| **Outfit** | default (all themes) | UI text, numbers, clock |
| Space Grotesk | Obsidian theme original | UI + display |
| JetBrains Mono | Ember, readouts | numbers, terminal labels |
| Figtree | Material theme original | UI, tabular figures |
| Archivo | Arasaka theme original | UI + display |

Switch between **Outfit** (default) and **Theme original** in Settings → Font.

---

## Themes

`html[data-theme='…']` swaps a block of design tokens in `public/styles.css` (colours, fonts, corner radii, label case and prefix, number weight). To add a theme: copy a token block, then add a matching entry to `THEMES` in `public/app.js`.

---

## Project layout

| file | what it does |
|---|---|
| `server.js` | static host, SSE stats stream, weather/lastfm/agents/actions APIs |
| `public/index.html` | seven mode sections + overlay scaffolding |
| `public/app.js` | icon set, mode switching, rendering, swipe, wake lock, dimmer, settings |
| `public/styles.css` | design system: theme tokens, flat surfaces, swipe layout, responsive |
| `public/sw.js` | service worker — makes the page installable as a PWA |
| `public/manifest.webmanifest` | PWA manifest (`"display": "fullscreen"`) |
| `public/fonts/` | five font families (latin subset WOFF2, SIL OFL) |
| `config.json` | your settings — created on first run, **never committed** |

---

## Troubleshooting

| symptom | fix |
|---|---|
| Phone shows nothing / spins | firewall rule, same Wi-Fi, PC awake, correct IP from the console |
| Stats stay at zero / dot goes red | SSE dropped — reload the page |
| Clock right, Agents blank | 9Router not running, or wrong password / base URL in `config.json` |
| `Last.fm error 6 User not found` | typo in `lastfm.username` |
| `Last.fm error 10 Invalid API Key` | re-copy `lastfm.apiKey` |
| CPU temp missing | run `npm start` from an Administrator terminal |
| Deck buttons do nothing | check the terminal — every press logs; app not in PATH is the usual cause |
| Chrome won't install as PWA | enable `#unsafely-treat-insecure-origin-as-secure` in `chrome://flags` and add your PC's LAN URL |
| Blank screen after opening multiple tabs | Chrome limits ~6 connections per host — close other tabs pointing at port 4321 |
