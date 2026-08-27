(function attachState(root) {
  'use strict';

  const DEFAULT_LIMIT = null;
  const HISTORY_LIMIT = 1000;
  const PROMPT_WINDOW_MS = 5 * 60 * 1000;
  const OBSERVATION_KEY_LIMIT = 300;

  const THEME_PALETTES = {
    dark: {
      bg: '#0B1018',
      bg2: '#0F1724',
      card: '#131D2B',
      cardHover: '#182638',
      fg: '#F8FAFC',
      muted: '#A7B3C6',
      border: '#2A3A50',
      inputBg: '#111927',
      inputFg: '#F8FAFC',
      inputBorder: '#31435C',
      progressTrack: '#1D2B3D',
      primaryButtonBg: '#51D9FF',
      primaryButtonFg: '#06131A',
      accent: '#24C8FF',
      accent2: '#4F7CFF',
      focus: '#70E5FF',
      shadow: 'rgba(0, 0, 0, 0.48)',
    },
    light: {
      bg: '#F7F9FC',
      bg2: '#EEF3F9',
      card: '#FFFFFF',
      cardHover: '#F1F5FA',
      fg: '#0B1220',
      muted: '#526075',
      border: '#D3DCE8',
      inputBg: '#FFFFFF',
      inputFg: '#0B1220',
      inputBorder: '#C8D2E0',
      progressTrack: '#DCE7F3',
      primaryButtonBg: '#0A66E8',
      primaryButtonFg: '#FFFFFF',
      accent: '#0078E8',
      accent2: '#2F5FFF',
      focus: '#005FC7',
      shadow: 'rgba(39, 57, 78, 0.18)',
    },
  };

  function monthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${month}`;
  }

  function localDayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  function daysUntilMonthReset(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const nextReset = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return Math.max(1, Math.round((nextReset.getTime() - today.getTime()) / 86400000));
  }

  function formatResetCountdown(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const nextReset = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
    let remaining = Math.max(0, nextReset.getTime() - d.getTime());
    const days = Math.floor(remaining / 86400000);
    remaining -= days * 86400000;
    const hours = Math.floor(remaining / 3600000);
    remaining -= hours * 3600000;
    const minutes = Math.floor(remaining / 60000);
    remaining -= minutes * 60000;
    const seconds = Math.floor(remaining / 1000);
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(days)}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
  }

  function shouldAnimateSync(previousSignature, nextSignature, requested, reducedMotion) {
    return requested === true
      && reducedMotion !== true
      && Boolean(nextSignature)
      && previousSignature !== nextSignature;
  }

  function normalizeThemePreference(value) {
    const normalized = String(value || '').toLowerCase();
    return normalized === 'light' || normalized === 'dark' ? normalized : 'auto';
  }

  function normalizePalettePreference(value) {
    const normalized = String(value || '').toLowerCase();
    return ['original', 'red', 'juparana', 'mono'].includes(normalized) ? normalized : 'original';
  }

  function resolveThemePreference(preference, pageTheme, systemDark = false) {
    const normalized = normalizeThemePreference(preference);
    if (normalized !== 'auto') return normalized;
    if (pageTheme === 'light' || pageTheme === 'dark') return pageTheme;
    return systemDark ? 'dark' : 'light';
  }

  function hexToRgb(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return null;
    const value = Number.parseInt(match[1], 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const channel = (value) => {
      const s = value / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(foreground, background) {
    const a = relativeLuminance(foreground);
    const b = relativeLuminance(background);
    if (a === null || b === null) return 0;
    const lighter = Math.max(a, b);
    const darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeUiState(ui) {
    const raw = ui && typeof ui === 'object' ? ui : {};
    const isV3 = Number(raw.uiVersion) >= 3;
    const validModes = new Set(['full', 'compact', 'minimal', 'ring']);
    let mode = null;

    if (raw.mode === 'icon') {
      mode = 'ring';
    } else if (isV3 && validModes.has(raw.mode)) {
      mode = raw.mode;
    } else if (raw.mode === 'minimal') {
      mode = 'minimal';
    } else if (raw.mode === 'compact') {
      mode = 'full';
    } else if (typeof raw.collapsed === 'boolean') {
      mode = raw.collapsed ? 'minimal' : 'full';
    }

    const position = raw.position && Number.isFinite(Number(raw.position.x)) && Number.isFinite(Number(raw.position.y))
      ? { x: Number(raw.position.x), y: Number(raw.position.y) }
      : null;
    const lastExpandedMode = raw.lastExpandedMode === 'compact' || raw.lastExpandedMode === 'full'
      ? raw.lastExpandedMode
      : (mode === 'compact' ? 'compact' : 'full');

    return {
      uiVersion: 9,
      mode: mode || 'full',
      lastExpandedMode,
      settingsOpen: mode === 'full' && raw.settingsOpen === true,
      position,
      theme: normalizeThemePreference(raw.theme),
      palette: normalizePalettePreference(raw.palette),
    };
  }

  function nextUiMode(mode) {
    if (mode === 'full') return 'compact';
    if (mode === 'compact') return 'minimal';
    if (mode === 'minimal') return 'full';
    if (mode === 'ring') return 'minimal';
    return 'full';
  }

  function clampPanelPosition(position, panelRect, viewport, margin = 8) {
    const width = Math.max(0, Number(panelRect?.width) || 0);
    const height = Math.max(0, Number(panelRect?.height) || 0);
    const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
    const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
    const safeMargin = Math.max(0, Number(margin) || 0);
    const maxX = Math.max(safeMargin, viewportWidth - width - safeMargin);
    const maxY = Math.max(safeMargin, viewportHeight - height - safeMargin);
    const x = Math.min(maxX, Math.max(safeMargin, Number(position?.x) || 0));
    const y = Math.min(maxY, Math.max(safeMargin, Number(position?.y) || 0));
    return { x, y };
  }

  function reflowPanelPosition(position, previousRect, nextRect, previousViewport, nextViewport, margin = 10, edgeThreshold = 32) {
    const safeMargin = Math.max(0, Number(margin) || 0);
    const threshold = Math.max(safeMargin, Number(edgeThreshold) || safeMargin);
    const prevWidth = Math.max(0, Number(previousRect?.width) || 0);
    const prevHeight = Math.max(0, Number(previousRect?.height) || 0);
    const nextWidth = Math.max(0, Number(nextRect?.width) || 0);
    const nextHeight = Math.max(0, Number(nextRect?.height) || 0);
    const prevViewportWidth = Math.max(0, Number(previousViewport?.width) || 0);
    const prevViewportHeight = Math.max(0, Number(previousViewport?.height) || 0);
    const x = Number.isFinite(Number(position?.x)) ? Number(position.x) : safeMargin;
    const y = Number.isFinite(Number(position?.y)) ? Number(position.y) : safeMargin;

    const leftGap = Math.max(0, x);
    const rightGap = Math.max(0, prevViewportWidth - (x + prevWidth));
    const topGap = Math.max(0, y);
    const bottomGap = Math.max(0, prevViewportHeight - (y + prevHeight));

    let nextX = x;
    let nextY = y;

    if (Math.min(leftGap, rightGap) <= threshold) {
      if (rightGap < leftGap) nextX = Math.max(safeMargin, Number(nextViewport?.width) - nextWidth - rightGap);
      else nextX = leftGap;
    }
    if (Math.min(topGap, bottomGap) <= threshold) {
      if (bottomGap < topGap) nextY = Math.max(safeMargin, Number(nextViewport?.height) - nextHeight - bottomGap);
      else nextY = topGap;
    }

    return clampPanelPosition(
      { x: nextX, y: nextY },
      { width: nextWidth, height: nextHeight },
      nextViewport,
      safeMargin,
    );
  }

  function createDefaultState(limit = DEFAULT_LIMIT) {
    const numericLimit = Number(limit);
    const normalizedLimit = Number.isFinite(numericLimit) && numericLimit > 0 ? numericLimit : null;
    return {
      config: { monthlyLimit: normalizedLimit },
      usage: {
        currentUsed: null,
        currentLimit: normalizedLimit,
        currentMonthKey: null,
        lastObservedAt: null,
        lastSource: null,
      },
      pendingPrompt: null,
      observationKeys: [],
      history: [],
      collector: {
        personLabel: null,
        lastSyncAt: null,
      },
      ui: normalizeUiState(),
    };
  }

  function markPendingPrompt(state, prompt, now = new Date()) {
    const next = clone(state);
    next.pendingPrompt = {
      id: prompt.id,
      createdAt: now.toISOString(),
      url: prompt.url || null,
      projectLabel: prompt.projectLabel || null,
    };
    return next;
  }

  function rolloverIfNeeded(state, now) {
    const next = clone(state);
    const currentKey = monthKey(now);
    if (next.usage.currentMonthKey && next.usage.currentMonthKey !== currentKey) {
      next.usage.currentUsed = 0;
      next.usage.currentLimit = next.config.monthlyLimit;
      next.usage.lastObservedAt = now.toISOString();
      next.usage.lastSource = 'reset';
      next.pendingPrompt = null;
      next.observationKeys = [];
    }
    if (!Array.isArray(next.observationKeys)) next.observationKeys = [];
    next.usage.currentMonthKey = currentKey;
    return next;
  }

  function applyCollectorSnapshot(state, snapshot, now = new Date()) {
    const used = Number(snapshot?.used);
    const limit = Number(snapshot?.limit);
    let next = rolloverIfNeeded(state, now);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(limit) || limit <= 0) return next;

    next.config.monthlyLimit = limit;
    next.usage.currentUsed = used;
    next.usage.currentLimit = limit;
    next.usage.currentMonthKey = monthKey(now);
    next.usage.lastObservedAt = now.toISOString();
    next.usage.lastSource = 'people';
    next.pendingPrompt = null;
    next.collector = {
      ...(next.collector || {}),
      personLabel: snapshot?.personLabel || next.collector?.personLabel || null,
      lastSyncAt: now.toISOString(),
    };
    return next;
  }

  function calibrateUsage(state, calibration, now = new Date()) {
    const next = rolloverIfNeeded(state, now);
    const limit = Number(calibration?.limit);
    const used = Number(calibration?.used);
    if (!Number.isFinite(limit) || limit <= 0) return next;
    if (!Number.isFinite(used) || used < 0 || used > limit) return next;

    next.config.monthlyLimit = limit;
    next.usage.currentLimit = limit;
    next.usage.currentUsed = used;
    next.usage.currentMonthKey = monthKey(now);
    next.usage.lastObservedAt = now.toISOString();
    next.usage.lastSource = 'manual';
    next.pendingPrompt = null;
    next.observationKeys = [];
    return next;
  }

  function pendingPromptIsFresh(pendingPrompt, now) {
    if (!pendingPrompt || !pendingPrompt.createdAt) return false;
    const age = now.getTime() - new Date(pendingPrompt.createdAt).getTime();
    return age >= 0 && age <= PROMPT_WINDOW_MS;
  }

  function appendUsageEvent(next, event) {
    next.history.push(event);
    if (next.history.length > HISTORY_LIMIT) {
      next.history = next.history.slice(next.history.length - HISTORY_LIMIT);
    }
  }

  function applyUsageObservation(state, observation, now = new Date()) {
    let next = rolloverIfNeeded(state, now);
    const used = Number(observation.used);
    const observedLimit = Number(observation.limit);
    if (!Number.isFinite(used) || used < 0) return { state: next, event: null };

    const previousUsed = Number.isFinite(next.usage.currentUsed) ? next.usage.currentUsed : null;
    if (Number.isFinite(observedLimit) && observedLimit > 0) next.usage.currentLimit = observedLimit;

    if (previousUsed !== null && used < previousUsed) {
      if (next.pendingPrompt && !pendingPromptIsFresh(next.pendingPrompt, now)) next.pendingPrompt = null;
      return { state: next, event: null };
    }

    next.usage.currentUsed = used;
    next.usage.lastObservedAt = now.toISOString();
    next.usage.lastSource = observation.source || null;

    if (previousUsed === null || used === previousUsed) {
      if (next.pendingPrompt && !pendingPromptIsFresh(next.pendingPrompt, now)) next.pendingPrompt = null;
      return { state: next, event: null };
    }

    const delta = used - previousUsed;
    const freshPrompt = pendingPromptIsFresh(next.pendingPrompt, now) ? next.pendingPrompt : null;
    const event = {
      id: `usage-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      observedAt: now.toISOString(),
      monthKey: monthKey(now),
      usedBefore: previousUsed,
      usedAfter: used,
      delta,
      source: observation.source || 'manual',
      promptId: freshPrompt ? freshPrompt.id : null,
      projectLabel: freshPrompt ? freshPrompt.projectLabel : null,
    };

    appendUsageEvent(next, event);
    next.pendingPrompt = null;
    return { state: next, event };
  }

  function applyUsageDelta(state, observation, now = new Date()) {
    let next = rolloverIfNeeded(state, now);
    const delta = Number(observation?.delta);
    const previousUsed = Number.isFinite(next.usage.currentUsed) ? Number(next.usage.currentUsed) : null;
    const freshPrompt = pendingPromptIsFresh(next.pendingPrompt, now) ? next.pendingPrompt : null;
    const observationId = typeof observation?.observationId === 'string' && observation.observationId.trim()
      ? observation.observationId.trim()
      : null;

    if (!Number.isFinite(delta) || delta <= 0 || previousUsed === null) {
      if (next.pendingPrompt && !pendingPromptIsFresh(next.pendingPrompt, now)) next.pendingPrompt = null;
      return { state: next, event: null };
    }

    if (observationId && next.observationKeys.includes(observationId)) {
      return { state: next, event: null };
    }

    if (observationId) {
      next.observationKeys.push(observationId);
      if (next.observationKeys.length > OBSERVATION_KEY_LIMIT) {
        next.observationKeys = next.observationKeys.slice(next.observationKeys.length - OBSERVATION_KEY_LIMIT);
      }
    }

    const usedAfter = Math.round((previousUsed + delta) * 1000) / 1000;
    next.usage.currentUsed = usedAfter;
    next.usage.currentLimit = next.config.monthlyLimit;
    next.usage.lastObservedAt = now.toISOString();
    next.usage.lastSource = observation.source || 'network';

    const event = {
      id: `usage-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      observedAt: now.toISOString(),
      monthKey: monthKey(now),
      usedBefore: previousUsed,
      usedAfter,
      delta,
      source: observation.source || 'network',
      observationId,
      promptId: freshPrompt ? freshPrompt.id : null,
      projectLabel: freshPrompt ? (freshPrompt.projectLabel || null) : null,
    };

    appendUsageEvent(next, event);
    if (freshPrompt) next.pendingPrompt = null;
    else if (next.pendingPrompt && !pendingPromptIsFresh(next.pendingPrompt, now)) next.pendingPrompt = null;
    return { state: next, event };
  }

  function dailySpend(state, now = new Date()) {
    const targetDay = localDayKey(now);
    return (state.history || []).reduce((sum, event) => {
      if (!event || !Number.isFinite(Number(event.delta)) || Number(event.delta) <= 0 || !event.observedAt) return sum;
      return localDayKey(new Date(event.observedAt)) === targetDay ? sum + Number(event.delta) : sum;
    }, 0);
  }

  function lastPromptCost(state, now = new Date()) {
    const currentKey = monthKey(now);
    const history = Array.isArray(state?.history) ? state.history : [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const event = history[i];
      if (Number(event?.delta) <= 0) continue;
      const eventMonth = event.monthKey || (event.observedAt ? monthKey(new Date(event.observedAt)) : null);
      if (eventMonth === currentKey) return Number(event.delta);
    }
    return null;
  }

  function quotaSummary(state) {
    const rawLimit = Number(state?.config?.monthlyLimit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;
    const used = Number.isFinite(state?.usage?.currentUsed) ? Number(state.usage.currentUsed) : 0;
    if (limit === null) return { used, limit: null, remaining: null, percentage: 0 };
    const remaining = Math.max(0, Math.round((limit - used) * 1000) / 1000);
    const percentage = (used / limit) * 100;
    return { used, limit, remaining, percentage };
  }

  const api = {
    DEFAULT_LIMIT,
    HISTORY_LIMIT,
    PROMPT_WINDOW_MS,
    OBSERVATION_KEY_LIMIT,
    THEME_PALETTES,
    monthKey,
    daysUntilMonthReset,
    formatResetCountdown,
    shouldAnimateSync,
    normalizeThemePreference,
    normalizePalettePreference,
    resolveThemePreference,
    contrastRatio,
    normalizeUiState,
    nextUiMode,
    clampPanelPosition,
    reflowPanelPosition,
    createDefaultState,
    rolloverIfNeeded,
    applyCollectorSnapshot,
    calibrateUsage,
    markPendingPrompt,
    applyUsageObservation,
    applyUsageDelta,
    dailySpend,
    lastPromptCost,
    quotaSummary,
  };

  root.LCMState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
