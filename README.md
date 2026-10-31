# Desk Deck

> A spare phone → a fullscreen desk companion. One swipe between seven live pages.

A tiny Node server runs on your PC. The phone opens the page over Wi-Fi and stays there — no app store, no cloud, no subscription. Pure black canvas so the AMOLED pixels that aren't drawing anything are literally off.

---

## What's on screen

| Page | What you see |
|---|---|
| **Clock** | Huge time + date. Idles to a dim orange night-clock after a few minutes. |
| **Ambient** | Everything at once: clock, PC vitals, agent quota bars, media controls. |
| **Weather** | Current conditions + 12-hour hourly + 7-day forecast. No API key. |
| **PC Stats** | CPU · GPU · RAM · disk · network, live sparkline, top processes. |
| **Agents** | Per-account quota bars and token totals from your local AI router (9Router). |
| **Deck** | Buttons that launch apps, open URLs or fire media/volume keys on the PC. |
| **Music** | Last.fm now-playing with album art, recent scrobbles, top artists. |

Flip between pages with a **left-right swipe**. Portrait and landscape both fit one screen — nothing scrolls.

---

## Themes

Each theme changes fonts, corner shape, label style *and* colour — not just a palette swap.

| Theme | Vibe | Font |
|---|---|---|
| **Obsidian** | Pure black, azure accent, hairline cards | Space Grotesk + JetBrains Mono |
| **Material** | M3 tonal surfaces, rounded, sentence-case | Figtree |
| **Ember** | Amber terminal, `>` prompt labels, square | JetBrains Mono |
| **Arasaka** | Black + signal red, uppercase, tracked | Archivo |

Default font across all themes: **Outfit** (self-hosted, 32 KB latin WOFF2). Switch to "Theme original" in Settings to restore a theme's native typeface.

---

## Quick start

```bash
git clone https://github.com/SC136/phone-dock
cd phone-dock
npm install
npm start
```

The terminal prints the URL:

```
Open on the phone (same Wi-Fi):
  http://192.168.1.x:4321
```

Copy that into Chrome on the phone, then **Add to Home screen** to run it without browser chrome.

### Fullscreen on Android (Chrome)

1. Go to `chrome://flags` → search `unsafely-treat-insecure-origin-as-secure` → add `http://<your-pc-ip>:4321` → enable → relaunch.
2. Open the URL → ⋮ → *Add to Home screen*.
3. Launch from the home screen icon — it opens fullscreen.
4. Double-tap the clock face to also hide the dock bar at the bottom.

> **Firewall?** Allow Node.js on private networks when Windows asks, or add an inbound TCP rule for port 4321.

---

## Configuration

`config.json` is created on first run and is **gitignored** — it holds your keys and passwords, never commit it.

```jsonc
{
  "port": 4321,
  "clock": { "hour24": true, "showSeconds": false, "showDate": true },
  "weather": {
    "location": "Mumbai",   // city name; "" = guess from PC's IP
    "units": "metric"       // metric | imperial
  },
  "display": {
    "theme": "obsidian",    // obsidian | material | ember | arasaka
    "dimAfterMinutes": 5,
    "burnIn": {
      "enabled": true,
      "driftPixels": 6,
      "blankEveryMinutes": 20,
      "blankSeconds": 25
    }
  },
  "agents": {
    "baseUrl": "http://127.0.0.1:20128", // your AI router's dashboard URL
    "password": "",                       // dashboard login password
    "apiKey": ""                          // sk-… model API key
  },
  "lastfm": {
    "username": "",
    "apiKey": ""   // https://www.last.fm/api/account/create
  },
  "streamDeck": {
    "columns": 4,
    "buttons": [
      { "id": "vscode", "label": "VS Code", "icon": "code",
        "action": { "type": "launch", "target": "code" } }
    ]
  }
}
```

---

## Stream deck actions

| type | does | example |
|---|---|---|
| `launch` | opens an app | `"code"`, `"explorer"`, `"wt"` |
| `url` | opens a URL in the default browser | `"https://github.com"` |
| `shell` | runs a shell command | `"rundll32.exe user32.dll,LockWorkStation"` |
| `keys` | fires a media/volume key | `volume_up` · `volume_down` · `mute` · `play_pause` · `next` · `prev` |

Media keys go through a persistent PowerShell `keybd_event` P/Invoke process — they work regardless of which app has focus.

**Security:** the phone can only trigger button IDs that exist in `config.json`. No arbitrary commands from the network.

---

## PC stats

Powered by the `systeminformation` npm package.

- **CPU temperature** — only readable from an elevated process. Run `npm start` from an **Administrator** terminal to see it.
- **GPU** — works out of the box on NVIDIA (`nvidia-smi`). Intel/AMD integrated GPUs report model + VRAM but not sensors; install [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) for those.

---

## AMOLED burn-in protection

Two independent layers, both on by default, both togglable per-phone in Settings:

- **Drift** — the whole UI walks a few pixels every minute so nothing burns the same pixels. Applied as a CSS `transform` on the root element.
- **Black rests** — after 20 idle minutes the panel goes true `#000` for 25 seconds (pixels physically off). Any tap cancels it immediately.

---

## Troubleshooting

| symptom | fix |
|---|---|
| Phone shows nothing | firewall, same Wi-Fi, correct IP, PC not asleep |
| Stats stay at zero / dot goes red | SSE dropped — reload the page |
| Agents page blank | 9Router not running, or wrong password/URL in config |
| CPU temp missing | run as Administrator |
| Deck buttons do nothing | check the terminal — every press logs; app not in PATH is the usual cause |
| Chrome won't install PWA | enable `#unsafely-treat-insecure-origin-as-secure` in chrome://flags |
| Blank screen when opening multiple tabs | Chrome limits ~6 connections per host — close other tabs pointing at port 4321 |

---

## Project layout

```
server.js                   Node server: static files, SSE, all /api routes
public/
  index.html                seven page sections + overlay scaffolding
  app.js                    icon set, rendering, swipe, settings, all live logic
  styles.css                design system: tokens, themes, layout, responsive
  sw.js                     service worker (PWA install + offline shell)
  manifest.webmanifest      PWA manifest (display: fullscreen)
  fonts/                    Outfit · Space Grotesk · JetBrains Mono · Figtree · Archivo
config.json                 your settings — created on first run, never committed
```
