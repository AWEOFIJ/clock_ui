# Architecture & Technical Design: clock_ui

**Project**: `clock_ui`  
**Companion File**: [`requirements.md`](./requirements.md)  
**Status**: Approved Architecture (Ready for Implementation)

---

## 1. System Architecture

The project follows a clean separation-of-concerns model suitable for client-side web development:

```
[ Browser Client ]
        │
        ├── index.html ───────── Semantic DOM Structure & Accessibility
        ├── style.css  ───────── CSS Variables, Glassmorphism, Animations & Themes
        ├── app.js     ───────── State Management, DOM Engine, Web Audio & Events
        │       │
        │       ├── fetch('./projects.json') ──────> Local JSON Catalog
        │       ├── fetch(Open-Meteo API)    ──────> Live Weather Conditions
        │       ├── fetch('/api/stdtime')    ──────> Same-origin proxy ──> stdtime.gov.tw
        │       ├── Web Audio API            ──────> Procedural Clock Ticks
        │       └── localStorage             ──────> Single State Tree Persistence
        │
[ GitHub Repository ] ───────── Push to main ───> GitHub Pages Auto-Deployment
```

---

## 2. Directory & File Organization

```text
d:\clock_ui\
├── index.html               # Main entrypoint & semantic structure
├── style.css                # Design tokens, themes, glass card & drawer styles
├── app.js                   # Consolidated state, DOM controller & async logic
├── projects.json            # Dynamic portfolio data (AIoT projects catalog)
├── tools/serve.py           # Static dev server + same-origin /api/stdtime proxy
├── docs/screenshot.png      # Preview image referenced by README.md
├── README.md                # Quick start, calibration notes & deployment guide
├── requirements.md          # Formal functional & non-functional requirements
├── design.md                # System design & API contracts
└── .agents/                 # Workspace customizations & skills
    └── skills/
        ├── grill-me/        # Grilling interview skill
        └── grilling/        # Core grilling engine
```

---

## 3. Data Contracts & Schemas

### 3.1 `projects.json` Schema
The projects catalog is structured for straightforward client-side rendering:

```json
[
  {
    "id": "aiot-edge-vision",
    "title": "Edge AI Vision Inspection",
    "category": "Edge Computing",
    "badge": "Featured",
    "description": "Real-time defect detection running YOLOv8 on NVIDIA Jetson Orin Nano with sub-15ms latency.",
    "techStack": ["Python", "YOLOv8", "TensorRT", "Jetson", "MQTT"],
    "githubUrl": "https://github.com/AWEOFIJ",
    "demoUrl": "#"
  }
]
```

### 3.2 Single State Tree (`localStorage`)
All client preferences are serialized as a single JSON string in `localStorage` under key `'aiot_user_state'`:

```typescript
interface UserState {
  name: string;             // e.g. "AWEOFIJ"
  tagline: string;          // e.g. "AIoT Pioneer • Instructor"
  theme: "aurora" | "minimal" | "sunset";
  format24h: boolean;       // true: 24h, false: 12h
  soundEnabled: boolean;    // Web Audio tick toggle
  selectedCity: string;     // key in CITY_COORDINATES
  zenMode: boolean;         // true: full-screen minimal clock
}
```

### 3.3 City Coordinates Map (Taiwan AIoT Hubs)
```javascript
const CITY_COORDINATES = {
  taichung: { name: 'Taichung', lat: 24.1477, lon: 120.6736 },
  taipei:   { name: 'Taipei',   lat: 25.0330, lon: 121.5654 },
  hsinchu:  { name: 'Hsinchu',  lat: 24.8138, lon: 120.9675 },
  tainan:   { name: 'Tainan',   lat: 22.9997, lon: 120.2270 },
  kaohsiung:{ name: 'Kaohsiung',lat: 22.6273, lon: 120.3014 }
};
```

---

## 4. API Integration: Open-Meteo Weather

### 4.1 Endpoint Specification
- **URL**: `https://api.open-meteo.com/v1/forecast`
- **Parameters**:
  - `latitude`: Float
  - `longitude`: Float
  - `current`: `temperature_2m,weather_code`
  - `timezone`: `Asia/Taipei`
- **Zero API Key Required**: Fully public, HTTPS compliant, CORS enabled.

### 4.2 WMO Weather Code Mapping
Translates raw meteorological codes into icons and human-readable text:
- `0`: `☀️ Clear sky`
- `1, 2, 3`: `⛅ Partly cloudy`
- `45, 48`: `🌫️ Foggy`
- `51..67`: `🌧️ Rainy`
- `71..77`: `❄️ Snow`
- `95..99`: `⛈️ Thunderstorm`

---

## 5. UI/UX & Layout Architecture

### 5.1 Top Navigation Toolbar
- **Left**: Live Weather Badge (`⛅ 26°C · Taichung ▾`) with click-to-select city dropdown.
- **Right Controls**:
  1. Sound Toggle (`🔊` / `🔇`) — Web Audio clock tick.
  2. Theme Toggle (`🎨`) — Cycles Aurora $\leftrightarrow$ Minimal $\leftrightarrow$ Sunset.
  3. Zen Mode Toggle (`⛶`) — Fullscreen ambient desk clock (<kbd>Z</kbd>).

### 5.2 Hero Glass Card
- **Header**: Avatar with dynamic monogram (`AW`), live time-aware greeting badge, editable name, and tagline.
- **Clock Centerpiece**:
  - Crisp digital time (`HH : MM : SS`).
  - stdtime.gov.tw national standard time calibration bar with dynamic offset ($\Delta$), latency indicator (RTT), and manual calibration button.
  - High-precision UNIX timestamp & milliseconds indicator.
- **Date Strip**: Full localized date, ISO week number, and day of the year.
- **Navigation Buttons**:
  - `[ 📂 Projects ]` — Opens the projects catalog drawer.
  - `[ 👤 About ]` — Opens bio & research focus drawer.
  - `[ 🔗 Connect ]` — Opens contact & GitHub channels drawer.

### 5.3 Drawer Component (`#drawerContainer`)
- Slide-in panel from the right with glassmorphic backdrop filter (`blur(24px)`).
- Tab navigation to effortlessly switch between **Projects**, **About**, and **Connect**.
- Responsive layout: Full-screen modal on mobile devices (<640px), 480px side drawer on desktop.

### 5.4 Mobile Adaptations (`@media (max-width: 600px)`)
The card is laid out for one narrow column; the rules below keep every element inside its own rounded container down to 360px.

| Element | Mobile behaviour |
|---|---|
| `.clock-display-container` | `max-width: 100%` (the desktop 290px cap left the sync bar and subbar ~45px too narrow) |
| `.sync-banner` | Stacks label over metrics (`flex-direction: column`, 16px radius); pills and label are `white-space: nowrap`, metrics wrap between pills, never inside one |
| `.clock-subbar` | Wraps between items with the `.divider-dot` separators hidden — "UNIX / ms" on one line, "Source" on the next, instead of each value breaking mid-string |
| `.portal-nav` / `.portal-btn` | `flex: 1 1 auto` + centred labels: Projects / About / Connect share one row at ≥375px, and the wrap to two rows (Connect full width) still reads as deliberate at 360px |
| `.top-nav` | 40px icon buttons, tighter weather pill, so the row never collides with the weather badge |
| `.time-label` | 0.68rem (≈10.9px) instead of 0.62rem (9.9px) |
| `.toggle-pill`, `.action-btn`, `.portal-btn`, `.sync-now-btn`, drawer tabs | Raised to 34–40px min-height for touch |

---

## 6. Procedural Audio Engine (Web Audio API)

To keep the project strictly zero-dependency with no external audio file loading:
```javascript
class TickAudioEngine {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime); // High soft click
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);      // Very quiet
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.03); // 30ms transient
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }
}
```

---

## 7. Deployment Plan (GitHub Pages)

1. Push all files (`index.html`, `style.css`, `app.js`, `projects.json`) to GitHub repository root.
2. In GitHub Repository: **Settings** $\rightarrow$ **Pages** $\rightarrow$ Source: **Deploy from a branch** (`main` / root).
3. The site becomes globally accessible at `https://<username>.github.io/<repo>/` in ~60 seconds with SSL enabled.
