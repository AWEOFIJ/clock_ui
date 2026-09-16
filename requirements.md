# Requirements Specification: clock_ui — AIoT Personal Portal & Dynamic Timekeeper

**Project Identifier**: `clock_ui`  
**Project Name**: `clock_ui`  
**Role**: AWEOFIJ Personal Portal & Timekeeper  
**Author**: AWEOFIJ  
**Target Milestone**: Lecture 2 (Browser, HTML, CSS, Modern JS, Fetch API, DOM, LocalStorage, GitHub Pages)

---

## 1. Project Purpose & Scope

The purpose of this project is to build an aesthetically stunning, modern personal portal and dynamic timekeeper that serves as:
1. **Teacher Demo**: A high-impact personal portal showcasing AIoT identity, projects, and live context.
2. **Student Milestone (DIC-1)**: A pedagogical reference demonstrating the core web progression:
   $$\text{Browser} \longrightarrow \text{HTML/CSS} \longrightarrow \text{JavaScript} \longrightarrow \text{Fetch API / JSON} \longrightarrow \text{DOM Manipulation} \longrightarrow \text{LocalStorage} \longrightarrow \text{GitHub Pages}$$

---

## 2. Functional Requirements (FR)

### FR-1: Hero Timekeeper & Personal Identity
- **FR-1.1**: Real-time clock updating smoothly every second with hours, minutes, seconds, milliseconds, and UNIX timestamp.
- **FR-1.2**: Taiwan national standard time calibration against **stdtime.gov.tw** (國家時間與頻率標準實驗室, NML) with network RTT compensation, clock drift/offset calculation ($\Delta$), manual "Sync Now" trigger, and automated hourly re-calibration. Because stdtime.gov.tw sends no CORS header, the browser reaches it through a same-origin proxy (`/api/stdtime`); when that is unavailable the app falls back to a CORS-enabled public source and labels the active one.
- **FR-1.3**: 12-Hour vs. 24-Hour format toggle with persistent state.
- **FR-1.4**: Dynamic, time-aware greeting badge (e.g., *Good morning*, *Good afternoon*, *Good evening*, *Good night*).
- **FR-1.5**: Full formatted date, ISO week number, and day-of-year calculation.
- **FR-1.6**: Inline editable Name and Tagline with instant saving to state.

### FR-2: Environmental Context (Live Weather API)
- **FR-2.1**: Real-time weather integration displaying current temperature, weather icon, and city name (e.g., `26°C ⛅ · Taichung`).
- **FR-2.2**: Integration with the keyless, open **Open-Meteo API** (`https://api.open-meteo.com`).
- **FR-2.3**: Preset city selector supporting common Taiwanese tech hubs (Taichung, Taipei, Hsinchu, Tainan, Kaohsiung).
- **FR-2.4**: Graceful error fallback displaying offline/cached status if network or API is unavailable.

### FR-3: Drawer / Modal Portfolio Explorer
- **FR-3.1**: Clean Hero preservation: The primary screen remains distraction-free; secondary content lives in a slide-out glass drawer.
- **FR-3.2**: Three structured drawer tabs:
  - **Projects**: Grid of featured AIoT hardware/software works.
  - **About**: Personal bio, academic background, research interests (AI, IoT, Edge Computing), and skills badges.
  - **Connect**: Direct links to GitHub, LinkedIn, Email, and Course Portal.
- **FR-3.3**: Drawer opened via discrete action buttons on the home screen; closed via overlay click, Close button, or <kbd>ESC</kbd> key.

### FR-4: Asynchronous Data Loading (`projects.json`)
- **FR-4.1**: Project data must **not** be hard-coded in HTML.
- **FR-4.2**: Client-side `fetch('./projects.json')` asynchronously loads the project catalog.
- **FR-4.3**: Dynamically generates project cards in the DOM with category tag, title, description, tech stack badges, and action links.

### FR-5: Unified State Management (`localStorage`)
- **FR-5.1**: All user preferences must be managed as a single consolidated JavaScript state object and persisted in `localStorage` under key `aiot_user_state`.
- **FR-5.2**: Persisted fields: `name`, `tagline`, `theme`, `format24h`, `soundEnabled`, `selectedCity`, `zenMode`.

### FR-6: Ambient Audio (Web Audio API)
- **FR-6.1**: A discrete sound toggle button in the top navigation (🔊 / 🔇), default muted.
- **FR-6.2**: Generates a soft mechanical clock tick using browser-native Web Audio API synthesis (zero external audio file dependencies).
- **FR-6.3**: Sound state is saved to persistent preferences.

### FR-7: Zen / Ambient Display Mode
- **FR-7.1**: Pressing <kbd>Z</kbd> or clicking the Zen icon hides all drawer buttons, header controls, and status bars, transforming the screen into an ambient desk clock.
- **FR-7.2**: Exited via <kbd>ESC</kbd> or <kbd>Z</kbd>.

---

## 3. Non-Functional Requirements (NFR)

### NFR-1: Zero-Dependency Architecture
- Built strictly with standard **Vanilla HTML5**, **CSS3 (Custom Properties & Glassmorphism)**, and **ES6+ JavaScript**.
- No Node.js build steps, no webpack/vite requirement, and no `node_modules`. Double-clickable locally and directly deployable to GitHub Pages.

### NFR-2: Performance & Responsiveness
- Initial DOM load and render in under 50ms.
- 60fps smooth clock hand/seconds ring animation.
- Fully responsive across mobile (375px+), tablet, laptop, and ultra-wide displays.

### NFR-3: Visual Identity & Themes
- Default **AIoT Cyber Ambient** dark theme featuring deep space tones and subtle animated glowing gradient orbs.
- Integrated alternative themes (Apple/Swiss Minimalist, Solar Twilight) configurable via CSS custom properties.

### NFR-4: Educational Clarity
- Codebase must be organized and annotated with educational comments explaining:
  1. DOM selection and event handling.
  2. Asynchronous `fetch` and JSON data parsing.
  3. Canvas/SVG procedural rendering.
  4. LocalStorage serialization and state hydration.
