/**
 * AWEOFIJ • AIoT Personal Portal & Dynamic Timekeeper (L2Web)
 * Educational & Architectural Reference Implementation
 * 
 * Core Features:
 * 1. Single Consolidated State Management (localStorage)
 * 2. Real-Time High-Precision Clock Engine (requestAnimationFrame)
 * 3. Live Environmental Weather Integration (Open-Meteo REST API)
 * 4. Asynchronous Portfolio Data Loader (fetch('./projects.json'))
 * 5. Procedural Web Audio API Clock Synthesizer
 * 6. Responsive Glassmorphic Drawer & Theme Switcher
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. City Coordinates & Weather Code Mappings
  // =========================================================================
  const CITY_COORDINATES = {
    taichung:  { name: 'Taichung',  lat: 24.1477, lon: 120.6736 },
    taipei:    { name: 'Taipei',    lat: 25.0330, lon: 121.5654 },
    hsinchu:   { name: 'Hsinchu',   lat: 24.8138, lon: 120.9675 },
    tainan:    { name: 'Tainan',    lat: 22.9997, lon: 120.2270 },
    kaohsiung: { name: 'Kaohsiung', lat: 22.6273, lon: 120.3014 }
  };

  const WMO_WEATHER_MAP = {
    0:  { icon: '☀️', desc: 'Clear' },
    1:  { icon: '🌤️', desc: 'Mainly Clear' },
    2:  { icon: '⛅', desc: 'Partly Cloudy' },
    3:  { icon: '☁️', desc: 'Overcast' },
    45: { icon: '🌫️', desc: 'Fog' },
    48: { icon: '🌫️', desc: 'Depositing Rime' },
    51: { icon: '🌦️', desc: 'Light Drizzle' },
    53: { icon: '🌦️', desc: 'Moderate Drizzle' },
    55: { icon: '🌧️', desc: 'Dense Drizzle' },
    61: { icon: '🌧️', desc: 'Slight Rain' },
    63: { icon: '🌧️', desc: 'Moderate Rain' },
    65: { icon: '🌧️', desc: 'Heavy Rain' },
    71: { icon: '🌨️', desc: 'Slight Snow' },
    80: { icon: '🌦️', desc: 'Rain Showers' },
    95: { icon: '⛈️', desc: 'Thunderstorm' }
  };

  const THEMES = ['aurora', 'minimal', 'sunset'];

  // =========================================================================
  // 2. Unified State Management (LocalStorage Single State Tree)
  // =========================================================================
  const STORAGE_KEY = 'aiot_user_state';

  const defaultState = {
    name: 'AWEOFIJ',
    tagline: 'AIoT Pioneer • Instructor',
    theme: 'aurora',
    format24h: true,
    soundEnabled: false,
    selectedCity: 'taichung',
    zenMode: false
  };

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name === 'Huan Chen') {
          parsed.name = 'AWEOFIJ';
        }
        return { ...defaultState, ...parsed };
      }
    } catch (err) {
      console.warn('Could not parse saved user state, using defaults.', err);
    }
    return { ...defaultState };
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save state to localStorage:', err);
    }
  }

  // =========================================================================
  // 3. Web Audio API Clock Synthesizer
  // =========================================================================
  class TickAudioEngine {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTick() {
      if (!state.soundEnabled || !this.ctx || this.ctx.state !== 'running') return;

      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // High mechanical transient click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.025);

        // Soft volume envelope
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.025);
      } catch (err) {
        console.debug('Audio tick synthesis skipped:', err);
      }
    }
  }

  const audio = new TickAudioEngine();

  // =========================================================================
  // 3.5 Standard Time Calibration Engine (stdtime.gov.tw)
  // =========================================================================
  let clockOffsetMs = 0; // serverTime - localDeviceTime
  let lastSyncSource = 'stdtime.gov.tw';
  let lastRtt = 0;
  let isCalibrating = false;

  // Source order matters: the first one that answers wins.
  //
  // 1. /api/stdtime — same-origin proxy to Taiwan's national standard time
  //    service (NML, stdtime.gov.tw). It MUST be server-side: stdtime.gov.tw
  //    returns no Access-Control-Allow-Origin header, so the browser blocks a
  //    direct fetch. `tools/serve.py` serves this endpoint locally; on a purely
  //    static host it 404s and we fall through to the next source.
  // 2. timeapi.io — CORS-enabled public fallback.
  //    CAREFUL: its `dateTime` field carries no timezone suffix
  //    ("2026-09-16T13:56:23.2168639"), so Date.parse() would read it as
  //    *local* time and shift the clock by the UTC offset (8h in Taiwan).
  //    Always build the instant from the numeric UTC fields instead.
  const TIME_SOURCES = [
    {
      id: 'stdtime-proxy',
      name: 'stdtime.gov.tw',
      url: '/api/stdtime',
      parse: (json) => Date.parse(json.serverTime)
    },
    {
      id: 'timeapi',
      name: 'timeapi.io (UTC)',
      url: 'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
      parse: (json) => Date.UTC(json.year, json.month - 1, json.day,
                                json.hour, json.minute, json.seconds, json.milliSeconds)
    }
  ];

  async function fetchTimeSample(source) {
    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(source.url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const end = performance.now();
    const rtt = end - start;
    const serverMs = source.parse(json);
    const estimatedServerAtReceive = serverMs + (rtt / 2);
    return {
      serverMs: estimatedServerAtReceive,
      rtt,
      clientReceiveMs: Date.now()
    };
  }

  async function calibrateTime() {
    if (isCalibrating) return;
    isCalibrating = true;

    if (dom.syncDot) dom.syncDot.className = 'sync-dot syncing';
    if (dom.syncIcon) dom.syncIcon.classList.add('spinning');
    if (dom.syncStatusText) dom.syncStatusText.textContent = 'Syncing stdtime...';

    let success = false;

    for (const source of TIME_SOURCES) {
      try {
        const samples = [];
        for (let i = 0; i < 3; i++) {
          try {
            const sample = await fetchTimeSample(source);
            samples.push({
              offset: sample.serverMs - sample.clientReceiveMs,
              rtt: sample.rtt
            });
          } catch {
            // drop this sample and try the next one
          }
          await new Promise(r => setTimeout(r, 60));
        }

        if (samples.length > 0) {
          // Keep the sample with the SMALLEST round-trip, not the median offset.
          // stdtime.gov.tw occasionally stalls for ~1s; with only two timestamps
          // the best we can do is correct by RTT/2, so a slow sample injects a
          // phantom offset of up to half its RTT (measured: clock ran 1.9s fast
          // at RTT 3.1s). The fastest round trip suffers the least queueing, so
          // it yields the truest offset - the classic minimum-filter choice.
          const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));

          clockOffsetMs = Math.round(best.offset);
          lastSyncSource = source.name;
          lastRtt = Math.round(best.rtt);
          success = true;
          break;
        }
      } catch (err) {
        console.warn(`Time source ${source.name} unavailable:`, err);
      }
    }

    isCalibrating = false;
    if (dom.syncIcon) dom.syncIcon.classList.remove('spinning');

    if (success) {
      if (dom.syncDot) dom.syncDot.className = 'sync-dot';
      if (dom.syncStatusText) dom.syncStatusText.textContent = `${lastSyncSource}`;
      if (dom.syncSourceLabel) dom.syncSourceLabel.textContent = `Source: ${lastSyncSource}`;
      if (dom.syncRttPill) dom.syncRttPill.textContent = `RTT: ${lastRtt}ms`;
      const sign = clockOffsetMs >= 0 ? '+' : '';
      const offsetSec = (clockOffsetMs / 1000).toFixed(3);
      if (dom.syncOffsetPill) dom.syncOffsetPill.textContent = `Δ: ${sign}${offsetSec}s`;
      showToast(`Time calibrated with ${lastSyncSource} (${sign}${offsetSec}s)`, '⏱️');
    } else {
      if (dom.syncDot) dom.syncDot.className = 'sync-dot error';
      if (dom.syncStatusText) dom.syncStatusText.textContent = 'Device Time (Offline)';
    }
  }

  function scheduleHourlyResync() {
    const nowLocal = Date.now();
    const nowSynced = nowLocal + clockOffsetMs;
    const d = new Date(nowSynced);
    d.setMinutes(0, 0, 0);
    const nextHour = d.getTime() + 3600000;
    const delay = Math.max(5000, nextHour - nowSynced);
    setTimeout(async () => {
      await calibrateTime();
      scheduleHourlyResync();
    }, delay);
  }

  // =========================================================================
  // 4. DOM Elements Cache
  // =========================================================================
  const dom = {
    body: document.body,
    // Clock
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    colon1: document.getElementById('colon1'),
    colon2: document.getElementById('colon2'),
    meridiemContainer: document.getElementById('meridiemContainer'),
    meridiem: document.getElementById('meridiem'),
    epochTime: document.getElementById('epochTime'),
    milliseconds: document.getElementById('milliseconds'),

    // Standard Time Calibration UI
    syncBanner: document.getElementById('syncBanner'),
    syncDot: document.getElementById('syncDot'),
    syncStatusText: document.getElementById('syncStatusText'),
    syncOffsetPill: document.getElementById('syncOffsetPill'),
    syncRttPill: document.getElementById('syncRttPill'),
    syncNowBtn: document.getElementById('syncNowBtn'),
    syncIcon: document.getElementById('syncIcon'),
    syncSourceLabel: document.getElementById('syncSourceLabel'),

    // Profile & Greeting
    greetingIcon: document.getElementById('greetingIcon'),
    greetingText: document.getElementById('greetingText'),
    userName: document.getElementById('userName'),
    userTagline: document.getElementById('userTagline'),
    avatarInitials: document.getElementById('avatarInitials'),
    editNameBtn: document.getElementById('editNameBtn'),

    // Calendar Badges
    fullDate: document.getElementById('fullDate'),
    weekBadge: document.getElementById('weekBadge'),
    dayOfYearBadge: document.getElementById('dayOfYearBadge'),
    timezoneBadge: document.getElementById('timezoneBadge'),

    // Weather Widget
    weatherWidget: document.getElementById('weatherWidget'),
    weatherPillBtn: document.getElementById('weatherPillBtn'),
    weatherIcon: document.getElementById('weatherIcon'),
    weatherTemp: document.getElementById('weatherTemp'),
    weatherCityLabel: document.getElementById('weatherCityLabel'),
    cityDropdown: document.getElementById('cityDropdown'),

    // Top Controls
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    soundOffIcon: document.querySelector('.sound-off-icon'),
    soundOnIcon: document.querySelector('.sound-on-icon'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeTooltip: document.getElementById('themeTooltip'),
    zenModeBtn: document.getElementById('zenModeBtn'),

    // Format & Action Toolbar
    btn24h: document.getElementById('btn24h'),
    btn12h: document.getElementById('btn12h'),
    copyTimeBtn: document.getElementById('copyTimeBtn'),
    toastContainer: document.getElementById('toastContainer'),

    // Portal Triggers & Drawer
    openProjectsBtn: document.getElementById('openProjectsBtn'),
    openAboutBtn: document.getElementById('openAboutBtn'),
    openConnectBtn: document.getElementById('openConnectBtn'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    drawerPanel: document.getElementById('drawerPanel'),
    closeDrawerBtn: document.getElementById('closeDrawerBtn'),
    drawerTabs: document.querySelectorAll('.drawer-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    projectsGrid: document.getElementById('projectsGrid'),
    projectsCount: document.getElementById('projectsCount')
  };



  // =========================================================================
  // 5. Toast Notifications
  // =========================================================================
  function showToast(message, icon = '✓') {
    if (!dom.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  // =========================================================================
  // 6. Time & Calendar Calculations
  // =========================================================================
  function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function getISOWeekNumber(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  }

  function getTimezoneAbbr() {
    try {
      const offsetMinutes = new Date().getTimezoneOffset();
      const offsetHours = -offsetMinutes / 60;
      const sign = offsetHours >= 0 ? '+' : '';
      return `GMT${sign}${offsetHours}`;
    } catch {
      return 'UTC';
    }
  }

  function getGreeting(hours24) {
    if (hours24 >= 5 && hours24 < 12) {
      return { text: 'Good morning', icon: '🌅' };
    } else if (hours24 >= 12 && hours24 < 17) {
      return { text: 'Good afternoon', icon: '☀️' };
    } else if (hours24 >= 17 && hours24 < 22) {
      return { text: 'Good evening', icon: '🌆' };
    } else {
      return { text: 'Good night', icon: '🌙' };
    }
  }

  function updateInitials(name) {
    if (!dom.avatarInitials) return;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      dom.avatarInitials.textContent = 'AW';
    } else if (parts.length === 1) {
      dom.avatarInitials.textContent = parts[0].slice(0, 2).toUpperCase();
    } else {
      dom.avatarInitials.textContent = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
  }

  // =========================================================================
  // 7. Live Clock Engine
  // =========================================================================
  let lastSecond = -1;

  function renderClock() {
    const nowSynced = Date.now() + clockOffsetMs;
    const now = new Date(nowSynced);
    const rawHours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ms = now.getMilliseconds();
    const epoch = Math.floor(nowSynced / 1000);

    // Format Hours based on 12/24 preference
    let displayHours = rawHours;
    let ampm = '';

    if (state.format24h) {
      displayHours = String(rawHours).padStart(2, '0');
      if (dom.meridiemContainer) dom.meridiemContainer.style.display = 'none';
    } else {
      ampm = rawHours >= 12 ? 'PM' : 'AM';
      displayHours = rawHours % 12;
      displayHours = displayHours ? displayHours : 12;
      displayHours = String(displayHours).padStart(2, '0');
      if (dom.meridiemContainer) {
        dom.meridiemContainer.style.display = 'block';
        if (dom.meridiem) dom.meridiem.textContent = ampm;
      }
    }

    // Update DOM Numbers
    dom.hours.textContent = displayHours;
    dom.minutes.textContent = String(minutes).padStart(2, '0');
    dom.seconds.textContent = String(seconds).padStart(2, '0');
    dom.milliseconds.textContent = String(ms).padStart(3, '0');
    dom.epochTime.textContent = epoch;

    // Live Clock Offset Indicator
    if (dom.syncOffsetPill && isCalibrating === false) {
      const sign = clockOffsetMs >= 0 ? '+' : '';
      const offsetSec = (clockOffsetMs / 1000).toFixed(3);
      dom.syncOffsetPill.textContent = `Δ: ${sign}${offsetSec}s`;
    }

    // Tick Event once per second
    if (seconds !== lastSecond) {
      lastSecond = seconds;

      // Play soft mechanical tick if sound is enabled
      audio.playTick();

      // Update greeting and dates
      const greeting = getGreeting(rawHours);
      if (dom.greetingText) dom.greetingText.textContent = greeting.text;
      if (dom.greetingIcon) dom.greetingIcon.textContent = greeting.icon;

      if (dom.fullDate) {
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dom.fullDate.textContent = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
      }

      if (dom.weekBadge) dom.weekBadge.textContent = `Week ${getISOWeekNumber(now)}`;
      if (dom.dayOfYearBadge) dom.dayOfYearBadge.textContent = `Day ${getDayOfYear(now)}`;
      if (dom.timezoneBadge) dom.timezoneBadge.textContent = getTimezoneAbbr();
    }

    requestAnimationFrame(renderClock);
  }

  // =========================================================================
  // 8. Open-Meteo Weather API Integration
  // =========================================================================
  async function fetchLiveWeather(cityKey) {
    const city = CITY_COORDINATES[cityKey] || CITY_COORDINATES.taichung;
    dom.weatherCityLabel.textContent = city.name;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&timezone=Asia%2FTaipei`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

      const data = await res.json();
      if (data.current) {
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const weatherInfo = WMO_WEATHER_MAP[code] || { icon: '⛅', desc: 'Partly Cloudy' };

        dom.weatherTemp.textContent = `${temp}°C`;
        dom.weatherIcon.textContent = weatherInfo.icon;
        dom.weatherPillBtn.title = `${city.name}: ${weatherInfo.desc}, ${temp}°C`;
      }
    } catch (err) {
      console.warn('Weather fetch failed, fallback to offline state:', err);
      dom.weatherTemp.textContent = '26°C';
      dom.weatherIcon.textContent = '⛅';
    }
  }

  function setCity(cityKey) {
    if (!CITY_COORDINATES[cityKey]) return;
    state.selectedCity = cityKey;
    saveState();

    // Update active dropdown item
    document.querySelectorAll('.city-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.city === cityKey);
    });

    fetchLiveWeather(cityKey);
    dom.weatherWidget.classList.remove('open');
    showToast(`Weather updated for ${CITY_COORDINATES[cityKey].name}`, '🌤️');
  }

  // =========================================================================
  // 9. Asynchronous Projects Catalog (`projects.json` Fetch)
  // =========================================================================
  const DEFAULT_PROJECTS_FALLBACK = [
    {
      id: "edge-vision-defect-detection",
      title: "Edge AI Industrial Vision Inspection",
      category: "Edge Computing",
      badge: "Featured",
      description: "Real-time surface defect inspection pipeline deploying optimized YOLOv8 on NVIDIA Jetson Orin Nano with TensorRT acceleration and sub-12ms inference.",
      techStack: ["YOLOv8", "TensorRT", "Jetson Orin", "Python", "MQTT"],
      githubUrl: "https://github.com/AWEOFIJ",
      demoUrl: "#"
    },
    {
      id: "tinyml-environmental-sensor-node",
      title: "TinyML Low-Power Environmental Node",
      category: "TinyML & Sensors",
      badge: "Hardware",
      description: "Ultra-low power anomaly detection sensor node built on ESP32-S3 and BME680, transmitting telemetry over LoRaWAN with 18-month battery autonomy.",
      techStack: ["ESP32-S3", "TensorFlow Lite Micro", "LoRaWAN", "FreeRTOS", "C++"],
      githubUrl: "https://github.com/AWEOFIJ",
      demoUrl: "#"
    },
    {
      id: "digital-twin-factory-dashboard",
      title: "Smart Factory Digital Twin & Telemetry",
      category: "AIoT Platforms",
      badge: "System",
      description: "Three.js digital twin visualization platform coupled with an event-driven MQTT broker and TimescaleDB for live industrial sensor monitoring.",
      techStack: ["FastAPI", "TimescaleDB", "MQTT", "Three.js", "WebSocket"],
      githubUrl: "https://github.com/AWEOFIJ",
      demoUrl: "#"
    },
    {
      id: "ble-mesh-indoor-positioning",
      title: "BLE Mesh Asset Tracking & Positioning",
      category: "Wireless Networks",
      badge: "Research",
      description: "Indoor RSSI fingerprinting and trilateration engine across a multi-hop Bluetooth Low Energy mesh network achieving 1.2m localization accuracy.",
      techStack: ["BLE 5.2", "Zephyr RTOS", "Python", "NumPy", "Kalman Filter"],
      githubUrl: "https://github.com/AWEOFIJ",
      demoUrl: "#"
    }
  ];

  async function loadProjects() {
    try {
      const res = await fetch('./projects.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const projects = await res.json();

      if (dom.projectsCount) dom.projectsCount.textContent = projects.length;
      renderProjects(projects);
    } catch (err) {
      console.warn('Could not load projects.json via fetch, using fallback:', err);
      if (dom.projectsCount) dom.projectsCount.textContent = DEFAULT_PROJECTS_FALLBACK.length;
      renderProjects(DEFAULT_PROJECTS_FALLBACK);
    }
  }

  function renderProjects(projects) {
    if (!dom.projectsGrid) return;
    dom.projectsGrid.innerHTML = '';

    projects.forEach(project => {
      const card = document.createElement('article');
      card.className = 'project-card';

      const techBadges = (project.techStack || [])
        .map(tag => `<span class="project-tag">${tag}</span>`)
        .join('');

      card.innerHTML = `
        <div class="project-meta">
          <span class="project-category">${project.category || 'AIoT'}</span>
          ${project.badge ? `<span class="project-badge">${project.badge}</span>` : ''}
        </div>
        <h3 class="project-title">${project.title}</h3>
        <p class="project-desc">${project.description}</p>
        <div class="project-tags">${techBadges}</div>
        <div class="project-actions">
          <a href="${project.githubUrl || '#'}" target="_blank" rel="noopener noreferrer" class="project-link-btn">
            <span>Code Repo</span> ↗
          </a>
        </div>
      `;
      dom.projectsGrid.appendChild(card);
    });
  }

  // =========================================================================
  // 10. Drawer & Tab Controller
  // =========================================================================
  function openDrawer(tabName = 'projects') {
    dom.body.classList.add('drawer-open');
    switchDrawerTab(tabName);
  }

  function closeDrawer() {
    dom.body.classList.remove('drawer-open');
  }

  function switchDrawerTab(targetTab) {
    dom.drawerTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === targetTab);
    });

    dom.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `pane${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`);
    });
  }

  // =========================================================================
  // 11. Preferences & Interactivity Handlers
  // =========================================================================
  function setFormat(is24h) {
    state.format24h = is24h;
    saveState();

    if (is24h) {
      dom.btn24h.classList.add('active');
      dom.btn12h.classList.remove('active');
    } else {
      dom.btn12h.classList.add('active');
      dom.btn24h.classList.remove('active');
    }
  }

  function cycleTheme() {
    const currentIndex = THEMES.indexOf(state.theme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    state.theme = THEMES[nextIndex];
    dom.body.dataset.theme = state.theme;
    saveState();

    const label = state.theme.charAt(0).toUpperCase() + state.theme.slice(1);
    if (dom.themeTooltip) dom.themeTooltip.textContent = `Theme: ${label}`;
    showToast(`Switched to ${label} theme`, '🎨');
  }

  function toggleSound() {
    audio.init();
    state.soundEnabled = !state.soundEnabled;
    saveState();
    updateSoundUI();

    showToast(state.soundEnabled ? 'Clock tick sound enabled' : 'Sound muted', state.soundEnabled ? '🔊' : '🔇');
  }

  function updateSoundUI() {
    if (state.soundEnabled) {
      dom.soundOffIcon.style.display = 'none';
      dom.soundOnIcon.style.display = 'block';
      dom.soundToggleBtn.classList.add('active-state');
    } else {
      dom.soundOffIcon.style.display = 'block';
      dom.soundOnIcon.style.display = 'none';
      dom.soundToggleBtn.classList.remove('active-state');
    }
  }

  function toggleZenMode() {
    state.zenMode = !state.zenMode;
    dom.body.classList.toggle('zen-active', state.zenMode);
    if (state.zenMode) closeDrawer();
  }

  function copyCurrentTimestamp() {
    const now = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
    const tz = getTimezoneAbbr();
    const copyText = `${state.name} • ${dateStr} ${dom.hours.textContent}:${dom.minutes.textContent}:${dom.seconds.textContent} (${tz})`;

    navigator.clipboard.writeText(copyText).then(() => {
      showToast('Current time copied to clipboard!', '📋');
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = copyText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Current time copied to clipboard!', '📋');
    });
  }

  // =========================================================================
  // 12. Inline Editable Fields
  // =========================================================================
  function setupEditableField(element, stateKey, onSaveCallback) {
    if (!element) return;

    function enableEdit() {
      element.setAttribute('contenteditable', 'true');
      element.focus();

      const range = document.createRange();
      range.selectNodeContents(element);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function saveEdit() {
      element.removeAttribute('contenteditable');
      const cleanValue = element.textContent.trim();
      if (cleanValue) {
        state[stateKey] = cleanValue;
        saveState();
        if (onSaveCallback) onSaveCallback(cleanValue);
      } else {
        element.textContent = state[stateKey];
      }
    }

    element.addEventListener('click', enableEdit);
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        element.textContent = state[stateKey];
        element.removeAttribute('contenteditable');
      }
    });
    element.addEventListener('blur', saveEdit);
  }

  // =========================================================================
  // 13. Event Listeners Initialization
  // =========================================================================
  function initListeners() {
    // 12h/24h toggle
    dom.btn24h.addEventListener('click', () => setFormat(true));
    dom.btn12h.addEventListener('click', () => setFormat(false));

    // Theme & Sound & Zen
    dom.themeToggleBtn.addEventListener('click', cycleTheme);
    dom.soundToggleBtn.addEventListener('click', toggleSound);
    dom.zenModeBtn.addEventListener('click', toggleZenMode);
    dom.copyTimeBtn.addEventListener('click', copyCurrentTimestamp);

    // Weather dropdown toggle & city options
    dom.weatherPillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.weatherWidget.classList.toggle('open');
    });

    document.querySelectorAll('.city-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setCity(btn.dataset.city);
      });
    });

    document.addEventListener('click', (e) => {
      if (!dom.weatherWidget.contains(e.target)) {
        dom.weatherWidget.classList.remove('open');
      }
    });

    // Drawer Triggers
    dom.openProjectsBtn.addEventListener('click', () => openDrawer('projects'));
    dom.openAboutBtn.addEventListener('click', () => openDrawer('about'));
    dom.openConnectBtn.addEventListener('click', () => openDrawer('connect'));

    dom.closeDrawerBtn.addEventListener('click', closeDrawer);
    dom.drawerOverlay.addEventListener('click', closeDrawer);

    dom.drawerTabs.forEach(tab => {
      tab.addEventListener('click', () => switchDrawerTab(tab.dataset.tab));
    });

    // Standard Time Calibration
    if (dom.syncNowBtn) {
      dom.syncNowBtn.addEventListener('click', () => {
        calibrateTime();
      });
    }

    // Inline edit name & tagline
    dom.editNameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.userName.click();
    });

    setupEditableField(dom.userName, 'name', (newName) => {
      updateInitials(newName);
      showToast(`Name updated to "${newName}"`, '✨');
    });

    setupEditableField(dom.userTagline, 'tagline', () => {
      showToast('Tagline updated', '✨');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true') {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'z') {
        toggleZenMode();
      } else if (key === 't') {
        setFormat(!state.format24h);
      } else if (key === 'c') {
        copyCurrentTimestamp();
      } else if (key === 's') {
        calibrateTime();
      } else if (e.key === 'Escape') {
        if (dom.body.classList.contains('drawer-open')) {
          closeDrawer();
        } else if (state.zenMode) {
          toggleZenMode();
        }
      }
    });
  }

  // =========================================================================
  // 14. Application Bootstrapper
  // =========================================================================
  function bootstrap() {
    // Hydrate DOM from unified state
    dom.body.dataset.theme = state.theme;
    dom.userName.textContent = state.name;
    dom.userTagline.textContent = state.tagline;
    updateInitials(state.name);
    setFormat(state.format24h);
    updateSoundUI();

    const themeLabel = state.theme.charAt(0).toUpperCase() + state.theme.slice(1);
    if (dom.themeTooltip) dom.themeTooltip.textContent = `Theme: ${themeLabel}`;

    // Initialize Event Listeners
    initListeners();

    // Asynchronous API and data loading
    fetchLiveWeather(state.selectedCity || 'taichung');
    loadProjects();

    // Standard Time Calibration (initial calibration & hourly resync)
    // Wait for the load event before the first calibration: while the page is
    // still parsing/laying out, the main thread is busy for hundreds of ms and
    // fetch callbacks are queued behind it. That inflates the measured
    // round-trip (measured: 468ms right after load vs ~60ms once settled), and
    // since the correction is only RTT/2, the inflation lands directly in the
    // clock offset. Calibrating on an idle thread avoids it.
    const startCalibration = () => {
      calibrateTime();
      scheduleHourlyResync();
    };
    if (document.readyState === 'complete') {
      startCalibration();
    } else {
      window.addEventListener('load', startCalibration, { once: true });
    }

    // Start Live Clock
    requestAnimationFrame(renderClock);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
