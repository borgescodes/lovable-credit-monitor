(function startCreditMonitor() {
  'use strict';

  const LEGACY_KEY = 'lovableCreditMonitorState';
  const USAGE_KEY = 'lovableCreditMonitorUsageV6';
  const UI_KEY = 'lovableCreditMonitorUiV6';
  const PANEL_ID = 'lcm-panel';
  const LINKEDIN_URL = 'https://www.linkedin.com/in/pedro-borgesdev/';
  const GITHUB_URL = 'https://github.com/borgescodes';
  const COLLECTOR_SCAN_MS = 4000;
  const COLLECTOR_HEARTBEAT_MS = 20000;
  const ROUTE_CHECK_MS = 1000;
  const COUNTDOWN_TICK_MS = 1000;
  const DRAG_MARGIN = 8;
  const DRAG_THRESHOLD = 4;
  const EDGE_MARGIN = 10;
  const EDGE_THRESHOLD = 32;
  const ENTRY_ANIMATION_MS = 720;
  const COUNT_UP_MS = 880;
  const MINIMAL_DOUBLE_CLICK_MS = 220;

  const State = globalThis.LCMState;
  const Collector = globalThis.LCMPeopleCollector;
  const Icons = globalThis.LCMIcons;
  const Brand = globalThis.LCMBrand;
  const Sync = globalThis.LCMSync;
  if (!State || !Collector || !Icons || !Brand || !Sync || !chrome?.storage?.local) return;

  let state = State.createDefaultState();
  let usageSnapshot = null;
  let syncState = Sync.normalizeSyncState(null);
  let panel = null;
  let fields = {};
  let themeObserver = null;
  let collectorObserver = null;
  let collectorDebounce = 0;
  let collectorInterval = 0;
  let lastCollectorWriteAt = 0;
  let lastRoute = location.href;
  let viewportObserver = null;
  let viewportRaf = 0;
  let viewportPersistTimer = 0;
  let entryAnimationTimer = 0;
  let lastViewportSize = { width: window.innerWidth, height: window.innerHeight };
  let countAnimation = 0;
  let lastAnimatedSignature = '';
  let suppressSurfaceClickUntil = 0;
  let minimalClickTimer = 0;
  let collectorWakeArmed = false;

  function numberText(value, maximumFractionDigits = 1) {
    if (value === null || value === undefined || value === '') return '...';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '...';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(numeric);
  }

  function decimalPlaces(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.abs(numeric - Math.round(numeric)) > 0.0001 ? 1 : 0;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function boxIcon(name, extraClass = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('lcm-svg-icon');
    if (extraClass) svg.classList.add(extraClass);
    svg.innerHTML = Icons[name] || '';
    return svg;
  }

  function iconButton(iconName, label, className = '') {
    const button = createElement('button', `lcm-icon-button lcm-no-drag ${className}`.trim());
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.appendChild(boxIcon(iconName));
    return button;
  }

  function externalIconLink(url, iconName, label) {
    const link = createElement('a', 'lcm-social lcm-no-drag');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', label);
    link.title = label;
    link.appendChild(boxIcon(iconName));
    return link;
  }

  function registerField(name, element) {
    if (!fields[name]) fields[name] = [];
    fields[name].push(element);
    return element;
  }

  function buildLogo(className = '') {
    const wrap = createElement('span', `lcm-logo-wrap ${className}`.trim());
    const svg = Brand.createLogoSvg(document);
    if (svg) wrap.appendChild(svg);
    return wrap;
  }

  function buildDragGrip() {
    const grip = createElement('span', 'lcm-drag-grip lcm-drag-handle');
    grip.title = 'Move';
    grip.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) grip.appendChild(createElement('span', 'lcm-drag-dot'));
    return grip;
  }

  function currentSignature(snapshot = usageSnapshot) {
    if (!snapshot) return '';
    return `${snapshot.monthKey || ''}|${Number(snapshot.used)}|${Number(snapshot.limit)}`;
  }

  function snapshotIsCurrent(snapshot, now = new Date()) {
    return Boolean(snapshot
      && Number.isFinite(Number(snapshot.used))
      && Number.isFinite(Number(snapshot.limit))
      && Number(snapshot.limit) > 0
      && snapshot.monthKey === State.monthKey(now));
  }

  function snapshotIsOfficial(snapshot = usageSnapshot) {
    return snapshot?.source === 'people' && snapshotIsCurrent(snapshot);
  }

  function collectorFreshness(now = Date.now()) {
    return Sync.deriveDisplayStatus(syncState, {
      hasCurrentOfficialSnapshot: snapshotIsOfficial(),
      observedAt: usageSnapshot?.observedAt || null,
    }, now);
  }

  function normalizeUsageSnapshot(raw, now = new Date()) {
    if (!raw || !Number.isFinite(Number(raw.used)) || !Number.isFinite(Number(raw.limit)) || Number(raw.limit) <= 0) return null;
    return {
      used: Number(raw.used),
      limit: Number(raw.limit),
      personLabel: raw.personLabel ? String(raw.personLabel) : null,
      usageHeader: raw.usageHeader ? String(raw.usageHeader) : null,
      monthKey: raw.monthKey || State.monthKey(now),
      observedAt: raw.observedAt || null,
      source: raw.source === 'people' ? 'people' : (raw.source || 'legacy'),
    };
  }

  function applySnapshotToState(snapshot, now = new Date()) {
    if (snapshotIsCurrent(snapshot, now)) {
      state = State.applyCollectorSnapshot(state, snapshot, now);
      return;
    }
    if (snapshot && Number.isFinite(Number(snapshot.limit)) && Number(snapshot.limit) > 0) {
      state.config.monthlyLimit = Number(snapshot.limit);
      state.usage.currentLimit = Number(snapshot.limit);
    }
    state = State.rolloverIfNeeded(state, now);
  }

  async function loadStoredState() {
    const stored = await chrome.storage.local.get([USAGE_KEY, UI_KEY, LEGACY_KEY, Sync.SYNC_KEY]);
    const legacy = stored[LEGACY_KEY] || null;
    state = State.createDefaultState();
    state.ui = State.normalizeUiState(stored[UI_KEY] || legacy?.ui);
    syncState = Sync.normalizeSyncState(stored[Sync.SYNC_KEY]);

    const official = normalizeUsageSnapshot(stored[USAGE_KEY]);
    if (official) {
      usageSnapshot = official;
      applySnapshotToState(official);
    }
  }

  async function persistUi() {
    try {
      await chrome.storage.local.set({ [UI_KEY]: state.ui });
    } catch (_) {
      // UI persistence failure is non-fatal and must never affect Lovable.
    }
  }

  function sameOfficialValues(a, b) {
    return Boolean(a && b
      && Number(a.used) === Number(b.used)
      && Number(a.limit) === Number(b.limit)
      && a.monthKey === b.monthKey);
  }

  function acceptUsageSnapshot(raw, options = {}) {
    const next = normalizeUsageSnapshot(raw);
    if (!next) return false;
    const changed = !sameOfficialValues(usageSnapshot, next) || !snapshotIsOfficial(usageSnapshot);
    usageSnapshot = next;
    applySnapshotToState(next);
    renderCollectorStatus();
    renderUsage({ animate: options.animate === true && changed });
    return changed;
  }

  function extractPeopleSnapshotFromDocument() {
    const containers = Array.from(document.querySelectorAll('table,[role="table"],[role="grid"]'));

    for (const container of containers) {
      let headers = [];
      let rows = [];

      if (container.tagName === 'TABLE') {
        const headerRow = container.querySelector('thead tr') || container.querySelector('tr');
        if (headerRow) {
          headers = Array.from(headerRow.querySelectorAll('th,td')).map((cell) => cell.textContent || '');
        }
        rows = Array.from(container.querySelectorAll('tbody tr'))
          .map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent || ''));
        if (!rows.length) {
          rows = Array.from(container.querySelectorAll('tr'))
            .filter((row) => row !== headerRow)
            .map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent || ''));
        }
      } else {
        headers = Array.from(container.querySelectorAll('[role="columnheader"]')).map((cell) => cell.textContent || '');
        rows = Array.from(container.querySelectorAll('[role="row"]'))
          .map((row) => Array.from(row.querySelectorAll('[role="cell"],[role="gridcell"],[role="rowheader"]')).map((cell) => cell.textContent || ''))
          .filter((row) => row.length > 0);
      }

      const extracted = Collector.extractPeopleUsage(headers, rows);
      if (extracted) return extracted;
    }
    return null;
  }

  async function scanPeopleCollector() {
    if (!Collector.isPeopleSettingsUrl(location.href)) return false;
    const extracted = extractPeopleSnapshotFromDocument();
    if (!extracted) return false;

    const now = new Date();
    const next = {
      ...extracted,
      monthKey: State.monthKey(now),
      observedAt: now.toISOString(),
      source: 'people',
    };
    const changed = !sameOfficialValues(usageSnapshot, next) || !snapshotIsOfficial(usageSnapshot);
    const heartbeatDue = Date.now() - lastCollectorWriteAt >= COLLECTOR_HEARTBEAT_MS;
    if (!changed && !heartbeatDue) return true;

    lastCollectorWriteAt = Date.now();
    try {
      await chrome.storage.local.set({ [USAGE_KEY]: next });
      acceptUsageSnapshot(next, { animate: changed });
    } catch (_) {
      // The collector is read-only with respect to Lovable. Storage failure is ignored.
    }
    return true;
  }

  function mutationIsOutsidePanel(record) {
    const target = record.target?.nodeType === Node.ELEMENT_NODE
      ? record.target
      : record.target?.parentElement;
    return !(target instanceof Element) || !target.closest(`#${PANEL_ID}`);
  }

  function scheduleCollectorScan() {
    if (!Collector.isPeopleSettingsUrl(location.href)) return;
    clearTimeout(collectorDebounce);
    collectorDebounce = window.setTimeout(() => { void scanPeopleCollector(); }, 260);
  }

  function startCollectorObserver() {
    if (collectorObserver || !Collector.isPeopleSettingsUrl(location.href) || !document.body) return;
    collectorObserver = new MutationObserver((records) => {
      if (records.some(mutationIsOutsidePanel)) scheduleCollectorScan();
    });
    collectorObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    scheduleCollectorScan();
  }

  function stopCollectorObserver() {
    collectorObserver?.disconnect();
    collectorObserver = null;
    clearTimeout(collectorDebounce);
    collectorDebounce = 0;
  }

  function refreshCollectorRole() {
    if (Collector.isPeopleSettingsUrl(location.href)) {
      startCollectorObserver();
    } else {
      stopCollectorObserver();
    }
  }

  function detectPageTheme() {
    const nodes = [document.documentElement, document.body].filter(Boolean);
    for (const node of nodes) {
      const explicit = `${node.getAttribute?.('data-theme') || ''} ${node.getAttribute?.('data-color-scheme') || ''}`.toLowerCase();
      if (/\bdark\b/.test(explicit) || node.classList?.contains('dark')) return 'dark';
      if (/\blight\b/.test(explicit) || node.classList?.contains('light')) return 'light';
    }
    const bodyColor = document.body ? getComputedStyle(document.body).backgroundColor : '';
    const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(bodyColor);
    if (match) {
      const luminance = (Number(match[1]) * 0.299 + Number(match[2]) * 0.587 + Number(match[3]) * 0.114) / 255;
      return luminance < 0.48 ? 'dark' : 'light';
    }
    return null;
  }

  function resolvedTheme() {
    const systemDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    return State.resolveThemePreference(state.ui.theme, detectPageTheme(), systemDark);
  }

  function applyTheme() {
    if (!panel) return;
    const theme = resolvedTheme();
    panel.dataset.theme = theme;
    panel.dataset.palette = State.normalizePalettePreference(state.ui.palette);
    panel.style.colorScheme = theme;
    (fields.themeButtons || []).forEach((button) => {
      button.dataset.active = button.dataset.themeChoice === state.ui.theme ? 'true' : 'false';
    });
    (fields.paletteButtons || []).forEach((button) => {
      button.dataset.active = button.dataset.paletteChoice === state.ui.palette ? 'true' : 'false';
    });
  }

  function installThemeWatchers() {
    if (typeof MutationObserver === 'function') {
      themeObserver = new MutationObserver(() => {
        if (state.ui.theme === 'auto') applyTheme();
      });
      [document.documentElement, document.body].filter(Boolean).forEach((node) => {
        themeObserver.observe(node, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-scheme', 'style'] });
      });
    }
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (state.ui.theme === 'auto') applyTheme();
      });
    }
  }

  function buildBrand() {
    const brand = createElement('div', 'lcm-brand');
    brand.appendChild(buildLogo());
    const text = createElement('div', 'lcm-brand-copy');
    text.appendChild(createElement('strong', 'lcm-title', 'Credit Monitor'));
    const usage = createElement('span', 'lcm-usage-tag', 'Usage');
    const dot = registerField('statusDots', createElement('span', 'lcm-live-dot'));
    usage.appendChild(dot);
    text.appendChild(usage);
    brand.appendChild(text);
    return brand;
  }

  function viewportSize() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function capturePanelLayout() {
    if (!panel) return null;
    const rect = panel.getBoundingClientRect();
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      viewport: viewportSize(),
    };
  }

  function handleSettingsToggle() {
    const previous = capturePanelLayout();
    const previousMode = state.ui.mode;
    if (state.ui.mode !== 'full') {
      state.ui.mode = 'full';
      state.ui.lastExpandedMode = 'full';
      state.ui.settingsOpen = true;
    } else {
      state.ui.settingsOpen = !state.ui.settingsOpen;
    }
    void persistUi();
    renderShell({
      animateEntry: previousMode !== state.ui.mode,
      forceValueAnimation: previousMode !== state.ui.mode,
      positionReference: previous,
    });
  }

  function registerProjectContext() {
    try {
      void chrome.runtime.sendMessage({
        type: 'LCM_REGISTER_CONTEXT',
        url: location.href,
      });
    } catch (_) {
      // Background coordination is best-effort and never blocks Lovable.
    }
  }

  function armCollectorWakeOnUserActivity() {
    if (collectorWakeArmed || Collector.isPeopleSettingsUrl(location.href) || !Sync.peopleUrlFromUrl(location.href)) return;
    collectorWakeArmed = true;
    const wake = () => {
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
      collectorWakeArmed = false;
      try {
        void chrome.runtime.sendMessage({
          type: 'LCM_USER_ACTIVE',
          url: location.href,
        });
      } catch (_) {
        // Background coordination is best-effort and never blocks Lovable.
      }
    };
    window.addEventListener('pointerdown', wake, { capture: true, once: true });
    window.addEventListener('keydown', wake, { capture: true, once: true });
  }

  async function requestManualSync() {
    if (collectorFreshness() === 'syncing') return;
    syncState = Sync.normalizeSyncState({
      ...syncState,
      status: 'syncing',
      requestedAt: new Date().toISOString(),
      reason: 'manual',
    });
    renderCollectorStatus();
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LCM_MANUAL_SYNC',
        url: location.href,
      });
      if (!response?.ok) {
        syncState = Sync.normalizeSyncState({
          ...syncState,
          status: 'unavailable',
          requestedAt: null,
          reason: 'manual',
        });
        renderCollectorStatus();
      }
    } catch (_) {
      syncState = Sync.normalizeSyncState({
        ...syncState,
        status: 'stale',
        requestedAt: null,
        reason: 'manual',
      });
      renderCollectorStatus();
    }
  }

  function cycleMode() {
    const previous = capturePanelLayout();
    const next = State.nextUiMode(state.ui.mode);
    state.ui.mode = next;
    if (next === 'full' || next === 'compact') state.ui.lastExpandedMode = next;
    if (next !== 'full') state.ui.settingsOpen = false;
    void persistUi();
    renderShell({ animateEntry: true, forceValueAnimation: true, positionReference: previous });
  }

  function setModeFromSurface(mode) {
    const previous = capturePanelLayout();
    state.ui.mode = mode;
    if (mode === 'full' || mode === 'compact') state.ui.lastExpandedMode = mode;
    state.ui.settingsOpen = false;
    void persistUi();
    renderShell({ animateEntry: true, forceValueAnimation: true, positionReference: previous });
  }

  function handleMinimalClick() {
    if (Date.now() < suppressSurfaceClickUntil) return;
    clearTimeout(minimalClickTimer);
    minimalClickTimer = window.setTimeout(() => {
      minimalClickTimer = 0;
      setModeFromSurface('compact');
    }, MINIMAL_DOUBLE_CLICK_MS);
  }

  function handleMinimalDoubleClick(event) {
    if (Date.now() < suppressSurfaceClickUntil) return;
    event?.preventDefault?.();
    clearTimeout(minimalClickTimer);
    minimalClickTimer = 0;
    setModeFromSurface('ring');
  }

  function returnRingToMinimal() {
    if (Date.now() < suppressSurfaceClickUntil) return;
    setModeFromSurface('minimal');
  }

  function buildHeader(compact = false) {
    const header = createElement('div', compact ? 'lcm-header lcm-header-compact' : 'lcm-header');
    header.appendChild(buildDragGrip());
    header.appendChild(buildBrand());
    const actions = createElement('div', 'lcm-actions');
    const settings = iconButton('bxs-cog', 'Appearance');
    settings.addEventListener('click', handleSettingsToggle);
    fields.settingsButtons = fields.settingsButtons || [];
    fields.settingsButtons.push(settings);
    actions.appendChild(settings);
    const sync = iconButton('bxs-refresh-cw-dot', 'Sync credits', 'lcm-sync-button');
    sync.addEventListener('click', () => { void requestManualSync(); });
    fields.syncButtons = fields.syncButtons || [];
    fields.syncButtons.push(sync);
    actions.appendChild(sync);
    const mode = iconButton('bxs-layer', 'Change view');
    mode.addEventListener('click', cycleMode);
    actions.appendChild(mode);
    header.appendChild(actions);
    return header;
  }

  function buildHero(extraClass = '') {
    const hero = createElement('div', `lcm-hero ${extraClass}`.trim());
    const row = createElement('div', 'lcm-hero-row');
    const remainingWrap = createElement('div', 'lcm-remaining-wrap');
    remainingWrap.appendChild(registerField('remaining', createElement('strong', 'lcm-remaining', '...')));
    remainingWrap.appendChild(createElement('span', 'lcm-left-label', 'left'));
    row.appendChild(remainingWrap);
    row.appendChild(registerField('percent', createElement('strong', 'lcm-percent', '...')));
    hero.appendChild(row);

    const track = createElement('div', 'lcm-progress-track');
    const progress = registerField('progress', createElement('div', 'lcm-progress'));
    progress.appendChild(createElement('span', 'lcm-progress-glow'));
    track.appendChild(progress);
    hero.appendChild(track);
    hero.appendChild(registerField('usedLimit', createElement('span', 'lcm-used-limit', '... / ...')));
    return hero;
  }

  function buildResetCard(compact = false) {
    const card = createElement('div', compact ? 'lcm-reset-card lcm-reset-compact' : 'lcm-reset-card');
    const icon = createElement('span', 'lcm-clock-orb');
    icon.appendChild(boxIcon('bxs-time-five'));
    card.appendChild(icon);
    const copy = createElement('div', 'lcm-reset-copy');
    copy.appendChild(createElement('span', 'lcm-reset-label', 'RESET IN'));
    copy.appendChild(registerField('countdown', createElement('strong', 'lcm-countdown', '--d : --h : --m : --s')));
    card.appendChild(copy);
    return card;
  }

  function buildAppearanceDrawer() {
    const drawer = createElement('div', 'lcm-settings');
    const inner = createElement('div', 'lcm-settings-inner');
    const row = createElement('div', 'lcm-theme-row');
    row.appendChild(createElement('span', 'lcm-theme-label', 'APPEARANCE'));

    const controls = createElement('div', 'lcm-appearance-controls');
    const paletteGroup = createElement('div', 'lcm-palette-group');
    const palettes = [
      ['original', 'Original'],
      ['red', 'Red'],
      ['juparana', 'Juparanã'],
      ['mono', 'Black & White'],
    ];
    fields.paletteButtons = [];
    for (const [choice, label] of palettes) {
      const button = createElement('button', 'lcm-palette-button lcm-no-drag');
      button.type = 'button';
      button.dataset.paletteChoice = choice;
      button.setAttribute('aria-label', `${label} palette`);
      button.title = label;
      button.appendChild(createElement('span', 'lcm-palette-swatch'));
      button.addEventListener('click', () => {
        state.ui.palette = choice;
        void persistUi();
        applyTheme();
      });
      fields.paletteButtons.push(button);
      paletteGroup.appendChild(button);
    }
    controls.appendChild(paletteGroup);

    const themeGroup = createElement('div', 'lcm-theme-group');
    const choices = [
      ['auto', 'bxs-adjust', 'Auto'],
      ['light', 'bxs-sun', 'Light'],
      ['dark', 'bxs-moon', 'Dark'],
    ];
    fields.themeButtons = [];
    for (const [choice, icon, label] of choices) {
      const button = iconButton(icon, label, 'lcm-theme-button');
      button.dataset.themeChoice = choice;
      button.addEventListener('click', () => {
        state.ui.theme = choice;
        void persistUi();
        applyTheme();
      });
      fields.themeButtons.push(button);
      themeGroup.appendChild(button);
    }
    controls.appendChild(themeGroup);
    row.appendChild(controls);
    inner.appendChild(row);
    drawer.appendChild(inner);
    return drawer;
  }

  function buildAttribution() {
    const footer = createElement('div', 'lcm-attribution');
    footer.appendChild(createElement('span', 'lcm-developed-line', 'Developed by Pedro Borges'));
    footer.appendChild(createElement('span', 'lcm-attribution-divider', '|'));
    const links = createElement('div', 'lcm-socials');
    links.appendChild(externalIconLink(GITHUB_URL, 'bxl-github', 'GitHub'));
    links.appendChild(externalIconLink(LINKEDIN_URL, 'bxl-linkedin-square', 'LinkedIn'));
    footer.appendChild(links);
    return footer;
  }

  function buildFullView() {
    const view = createElement('div', 'lcm-view lcm-view-full');
    view.appendChild(buildHeader(false));
    const body = createElement('div', 'lcm-body');
    body.appendChild(buildHero());
    body.appendChild(buildResetCard(false));
    body.appendChild(buildAppearanceDrawer());
    body.appendChild(buildAttribution());
    view.appendChild(body);
    return view;
  }

  function buildCompactView() {
    const view = createElement('div', 'lcm-view lcm-view-compact');
    view.appendChild(buildHeader(true));
    const body = createElement('div', 'lcm-body lcm-body-compact');
    body.appendChild(buildHero('lcm-hero-compact'));
    body.appendChild(buildResetCard(true));
    view.appendChild(body);
    return view;
  }

  function buildMinimalView() {
    const view = createElement('div', 'lcm-view lcm-view-minimal');
    view.appendChild(buildDragGrip());
    const surface = createElement('button', 'lcm-minimal-surface lcm-no-drag');
    surface.type = 'button';
    surface.setAttribute('aria-label', 'Open compact view. Double click for ring view');
    surface.addEventListener('click', handleMinimalClick);
    surface.addEventListener('dblclick', handleMinimalDoubleClick);
    const top = createElement('div', 'lcm-minimal-top');
    top.appendChild(registerField('remaining', createElement('strong', 'lcm-minimal-remaining', '...')));
    top.appendChild(registerField('percent', createElement('span', 'lcm-minimal-percent', '...')));
    surface.appendChild(top);
    surface.appendChild(registerField('usedLimit', createElement('span', 'lcm-minimal-used-limit', '... / ...')));
    const track = createElement('div', 'lcm-progress-track lcm-minimal-track');
    track.appendChild(registerField('progress', createElement('div', 'lcm-progress')));
    surface.appendChild(track);
    view.appendChild(surface);
    return view;
  }

  function buildRingView() {
    const view = createElement('div', 'lcm-view lcm-view-ring');
    view.appendChild(buildDragGrip());
    const surface = createElement('button', 'lcm-ring-surface lcm-no-drag');
    surface.type = 'button';
    surface.setAttribute('aria-label', 'Return to minimal view');
    surface.addEventListener('click', returnRingToMinimal);

    const visual = createElement('span', 'lcm-ring-visual');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 80 80');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('lcm-ring-svg');

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', '40');
    track.setAttribute('cy', '40');
    track.setAttribute('r', '31');
    track.setAttribute('pathLength', '100');
    track.classList.add('lcm-ring-track');
    svg.appendChild(track);

    const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progress.setAttribute('cx', '40');
    progress.setAttribute('cy', '40');
    progress.setAttribute('r', '31');
    progress.setAttribute('pathLength', '100');
    progress.setAttribute('stroke-dasharray', '100');
    progress.setAttribute('stroke-dashoffset', '100');
    progress.classList.add('lcm-ring-progress');
    registerField('ringProgress', progress);
    svg.appendChild(progress);

    visual.appendChild(svg);
    visual.appendChild(registerField('ringValue', createElement('strong', 'lcm-ring-value', '...')));
    surface.appendChild(visual);
    view.appendChild(surface);
    return view;
  }

  function buildPanel() {
    if (document.getElementById(PANEL_ID)) return;
    fields = {};
    panel = createElement('section', 'lcm-card');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Credit Monitor');
    panel.appendChild(createElement('span', 'lcm-ambient-light'));
    panel.appendChild(buildFullView());
    panel.appendChild(buildCompactView());
    panel.appendChild(buildMinimalView());
    panel.appendChild(buildRingView());
    document.body.appendChild(panel);
    installDragging();
    installViewportGuard();
  }

  function usageSummary() {
    return State.quotaSummary(state);
  }

  function setUsageDisplay(values) {
    const remainingDigits = decimalPlaces(values.remaining);
    const usedDigits = decimalPlaces(values.used);
    const limitDigits = decimalPlaces(values.limit);
    (fields.remaining || []).forEach((element) => {
      element.textContent = numberText(values.remaining, remainingDigits);
    });
    (fields.ringValue || []).forEach((element) => {
      element.textContent = numberText(values.remaining, remainingDigits);
    });
    (fields.percent || []).forEach((element) => {
      element.textContent = `${numberText(values.percentage, 0)}%`;
    });
    (fields.usedLimit || []).forEach((element) => {
      element.textContent = `${numberText(values.used, usedDigits)} / ${numberText(values.limit, limitDigits)}`;
    });
  }

  function setRingProgress(remaining, limit, animate) {
    const safeLimit = Number(limit);
    const safeRemaining = Number(remaining);
    const ratio = Number.isFinite(safeLimit) && safeLimit > 0 && Number.isFinite(safeRemaining)
      ? Math.max(0, Math.min(1, safeRemaining / safeLimit))
      : 0;
    const strokeDashoffset = String(100 - (ratio * 100));
    (fields.ringProgress || []).forEach((element) => {
      if (!animate) {
        element.style.transition = 'none';
        element.style.strokeDashoffset = strokeDashoffset;
        requestAnimationFrame(() => { element.style.transition = ''; });
        return;
      }
      element.style.transition = 'none';
      element.style.strokeDashoffset = '100';
      void element.getBoundingClientRect();
      requestAnimationFrame(() => {
        element.style.transition = '';
        element.style.strokeDashoffset = strokeDashoffset;
      });
    });
  }

  function setProgressWidth(percentage, animate) {
    const width = `${Math.max(0, Math.min(100, percentage))}%`;
    (fields.progress || []).forEach((element) => {
      if (!animate) {
        element.style.transition = 'none';
        element.style.width = width;
        requestAnimationFrame(() => { element.style.transition = ''; });
        return;
      }
      element.style.transition = 'none';
      element.style.width = '0%';
      void element.offsetWidth;
      requestAnimationFrame(() => {
        element.style.transition = '';
        element.style.width = width;
      });
    });
  }

  function setRingValue(value) {
    const digits = decimalPlaces(value);
    (fields.ringValue || []).forEach((element) => {
      element.textContent = numberText(value, digits);
    });
  }

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function renderUsage(options = {}) {
    if (!panel) return;
    const hasReading = Number.isFinite(state.usage.currentUsed);
    const summary = usageSummary();
    if (!hasReading) {
      (fields.remaining || []).forEach((element) => { element.textContent = '...'; });
      (fields.percent || []).forEach((element) => { element.textContent = '...'; });
      (fields.usedLimit || []).forEach((element) => { element.textContent = '... / ...'; });
      (fields.ringValue || []).forEach((element) => { element.textContent = '...'; });
      setProgressWidth(0, false);
      setRingProgress(0, 1, false);
      return;
    }

    const target = {
      remaining: summary.remaining,
      used: summary.used,
      limit: summary.limit,
      percentage: Math.max(0, Math.min(100, summary.percentage)),
    };
    const signature = currentSignature();
    const forceValueAnimation = options.forceValueAnimation === true;
    const shouldAnimate = forceValueAnimation
      ? !reducedMotion() && Boolean(signature)
      : State.shouldAnimateSync(
        lastAnimatedSignature,
        signature,
        options.animate === true,
        reducedMotion(),
      );
    cancelAnimationFrame(countAnimation);

    if (!shouldAnimate) {
      setUsageDisplay(target);
      setProgressWidth(target.percentage, false);
      setRingProgress(target.remaining, target.limit, false);
      return;
    }
    lastAnimatedSignature = signature;

    setUsageDisplay({ remaining: 0, used: 0, limit: 0, percentage: 0 });
    setProgressWidth(target.percentage, true);
    setRingProgress(target.remaining, target.limit, true);
    const start = performance.now();
    const tick = (time) => {
      const raw = Math.min(1, Math.max(0, (time - start) / COUNT_UP_MS));
      const eased = 1 - Math.pow(1 - raw, 3);
      setUsageDisplay({
        remaining: target.remaining * eased,
        used: target.used * eased,
        limit: target.limit * eased,
        percentage: target.percentage * eased,
      });
      if (raw < 1) countAnimation = requestAnimationFrame(tick);
      else setUsageDisplay(target);
    };
    countAnimation = requestAnimationFrame(tick);
    panel.dataset.synced = 'true';
    window.setTimeout(() => {
      if (panel) panel.dataset.synced = 'false';
    }, 1100);
  }

  function renderCountdown() {
    const value = State.formatResetCountdown(new Date());
    (fields.countdown || []).forEach((element) => { element.textContent = value; });
  }

  function renderCollectorStatus() {
    if (!panel) return;
    const freshness = collectorFreshness();
    const titles = {
      syncing: 'Syncing People usage...',
      live: 'People collector live',
      stale: 'People collector data is stale',
      unavailable: 'People collector unavailable',
    };
    const title = titles[freshness] || titles.unavailable;
    panel.dataset.syncStatus = freshness;
    (fields.statusDots || []).forEach((dot) => {
      dot.dataset.status = freshness;
      dot.title = title;
    });
    (fields.syncButtons || []).forEach((button) => {
      button.disabled = freshness === 'syncing';
      button.setAttribute('aria-busy', freshness === 'syncing' ? 'true' : 'false');
      button.title = freshness === 'syncing' ? 'Syncing credits...' : 'Sync credits';
    });
  }

  function triggerViewEntryAnimation() {
    if (!panel || reducedMotion()) return;
    clearTimeout(entryAnimationTimer);
    delete panel.dataset.entering;
    void panel.offsetWidth;
    panel.dataset.entering = 'true';
    entryAnimationTimer = window.setTimeout(() => {
      if (panel) delete panel.dataset.entering;
    }, ENTRY_ANIMATION_MS);
  }

  function applyEdgeAwareLayout(previous) {
    if (!panel || !previous?.rect || !state.ui.position) {
      applySavedPosition();
      return;
    }
    const nextRect = panel.getBoundingClientRect();
    const nextViewport = viewportSize();
    const next = State.reflowPanelPosition(
      { x: previous.rect.left, y: previous.rect.top },
      { width: previous.rect.width, height: previous.rect.height },
      { width: nextRect.width, height: nextRect.height },
      previous.viewport || nextViewport,
      nextViewport,
      EDGE_MARGIN,
      EDGE_THRESHOLD,
    );
    state.ui.position = next;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${next.x}px`;
    panel.style.top = `${next.y}px`;
    void persistUi();
  }

  function renderShell(options = {}) {
    if (!panel) return;
    panel.dataset.mode = state.ui.mode;
    panel.dataset.settings = state.ui.settingsOpen && state.ui.mode === 'full' ? 'open' : 'closed';
    (fields.settingsButtons || []).forEach((button) => {
      button.setAttribute('aria-expanded', panel.dataset.settings === 'open' ? 'true' : 'false');
    });
    applyTheme();
    if (options.positionReference) applyEdgeAwareLayout(options.positionReference);
    else {
      applySavedPosition();
      ensurePanelVisible();
    }
    renderUsage({
      animate: options.forceValueAnimation === true,
      forceValueAnimation: options.forceValueAnimation === true,
    });
    renderCountdown();
    renderCollectorStatus();
    if (options.animateEntry === true) triggerViewEntryAnimation();
    scheduleEnsurePanelVisible();
  }

  function applySavedPosition() {
    if (!panel) return;
    const position = state.ui.position;
    if (!position) {
      panel.style.left = '';
      panel.style.top = '';
      panel.style.right = '16px';
      panel.style.bottom = '16px';
      return;
    }
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
  }

  function ensurePanelVisible() {
    if (!panel || !panel.isConnected) return;
    const rect = panel.getBoundingClientRect();
    const clamped = State.clampPanelPosition(
      { x: rect.left, y: rect.top },
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
      DRAG_MARGIN,
    );
    const moved = Math.abs(rect.left - clamped.x) > 0.5 || Math.abs(rect.top - clamped.y) > 0.5;
    if (!moved) return;
    state.ui.position = clamped;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${clamped.x}px`;
    panel.style.top = `${clamped.y}px`;
    void persistUi();
  }

  function scheduleEnsurePanelVisible() {
    cancelAnimationFrame(viewportRaf);
    viewportRaf = requestAnimationFrame(() => {
      viewportRaf = requestAnimationFrame(ensurePanelVisible);
    });
  }

  function handleViewportResize() {
    const nextViewport = viewportSize();
    if (panel && state.ui.position) {
      const rect = panel.getBoundingClientRect();
      const next = State.reflowPanelPosition(
        state.ui.position,
        { width: rect.width, height: rect.height },
        { width: rect.width, height: rect.height },
        lastViewportSize,
        nextViewport,
        EDGE_MARGIN,
        EDGE_THRESHOLD,
      );
      state.ui.position = next;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = `${next.x}px`;
      panel.style.top = `${next.y}px`;
      clearTimeout(viewportPersistTimer);
      viewportPersistTimer = window.setTimeout(() => void persistUi(), 140);
    }
    lastViewportSize = nextViewport;
    scheduleEnsurePanelVisible();
  }

  function installViewportGuard() {
    if (typeof ResizeObserver === 'function' && panel) {
      viewportObserver = new ResizeObserver(scheduleEnsurePanelVisible);
      viewportObserver.observe(panel);
    }
    window.addEventListener('resize', handleViewportResize);
  }

  function installDragging() {
    if (!panel) return;
    panel.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const handle = target.closest('.lcm-drag-handle');
      if (!handle || !panel.contains(handle)) return;

      const startRect = panel.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      const pointerId = event.pointerId;
      panel.setPointerCapture?.(pointerId);
      panel.dataset.dragging = 'true';

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        moveEvent.preventDefault();
        const clamped = State.clampPanelPosition(
          { x: startRect.left + dx, y: startRect.top + dy },
          { width: startRect.width, height: startRect.height },
          { width: window.innerWidth, height: window.innerHeight },
          DRAG_MARGIN,
        );
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = `${clamped.x}px`;
        panel.style.top = `${clamped.y}px`;
      };

      const finish = () => {
        panel.removeEventListener('pointermove', onMove);
        panel.removeEventListener('pointerup', finish);
        panel.removeEventListener('pointercancel', finish);
        panel.dataset.dragging = 'false';
        panel.releasePointerCapture?.(pointerId);
        if (!moved) return;
        suppressSurfaceClickUntil = Date.now() + 250;
        const rect = panel.getBoundingClientRect();
        state.ui.position = State.clampPanelPosition(
          { x: rect.left, y: rect.top },
          { width: rect.width, height: rect.height },
          { width: window.innerWidth, height: window.innerHeight },
          DRAG_MARGIN,
        );
        applySavedPosition();
        void persistUi();
      };

      panel.addEventListener('pointermove', onMove);
      panel.addEventListener('pointerup', finish);
      panel.addEventListener('pointercancel', finish);
    });
  }

  function handleUsageStorageChange(change) {
    const next = normalizeUsageSnapshot(change?.newValue);
    if (!next) return;
    const changed = !sameOfficialValues(usageSnapshot, next) || !snapshotIsOfficial(usageSnapshot);
    usageSnapshot = next;
    applySnapshotToState(next);
    renderCollectorStatus();
    renderUsage({ animate: changed });
  }

  function handleSyncStorageChange(change) {
    syncState = Sync.normalizeSyncState(change?.newValue);
    renderCollectorStatus();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[USAGE_KEY]) handleUsageStorageChange(changes[USAGE_KEY]);
    if (changes[Sync.SYNC_KEY]) handleSyncStorageChange(changes[Sync.SYNC_KEY]);
  });

  function tickClockAndRollover() {
    const before = state.usage.currentMonthKey;
    state = State.rolloverIfNeeded(state, new Date());
    renderCountdown();
    renderCollectorStatus();
    if (before && before !== state.usage.currentMonthKey) renderUsage({ animate: true });
  }

  async function initialize() {
    try {
      await loadStoredState();
    } catch (_) {
      state = State.createDefaultState();
    }
    buildPanel();
    renderShell({
      animateEntry: true,
      forceValueAnimation: Number.isFinite(state.usage.currentUsed),
    });
    installThemeWatchers();
    registerProjectContext();
    armCollectorWakeOnUserActivity();
    refreshCollectorRole();
    if (Collector.isPeopleSettingsUrl(location.href)) void scanPeopleCollector();

    collectorInterval = window.setInterval(() => {
      if (Collector.isPeopleSettingsUrl(location.href)) void scanPeopleCollector();
    }, COLLECTOR_SCAN_MS);

    window.setInterval(() => {
      if (location.href === lastRoute) return;
      lastRoute = location.href;
      registerProjectContext();
      armCollectorWakeOnUserActivity();
      refreshCollectorRole();
      if (Collector.isPeopleSettingsUrl(location.href)) window.setTimeout(() => void scanPeopleCollector(), 500);
    }, ROUTE_CHECK_MS);


    window.setInterval(tickClockAndRollover, COUNTDOWN_TICK_MS);
  }

  void initialize();
})();
