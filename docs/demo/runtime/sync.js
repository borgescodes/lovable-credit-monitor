(function attachLovableCreditMonitorSync(root) {
  'use strict';

  const SYNC_KEY = 'lovableCreditMonitorSyncV6';
  const USAGE_KEY = 'lovableCreditMonitorUsageV6';
  const SYNC_TIMEOUT_MS = 25000;
  const STALE_MS = 90000;

  function isLovableHost(hostname) {
    return hostname === 'lovable.dev' || hostname.endsWith('.lovable.dev');
  }

  function peopleUrlFromUrl(value) {
    try {
      const url = new URL(String(value));
      if (url.protocol !== 'https:' || !isLovableHost(url.hostname)) return null;
      const match = url.pathname.match(/^\/projects\/([^/]+)/i);
      if (!match) return null;
      return `${url.origin}/projects/${match[1]}/settings/people`;
    } catch (_) {
      return null;
    }
  }

  function isPeopleUrl(value) {
    try {
      const url = new URL(String(value));
      return url.protocol === 'https:'
        && isLovableHost(url.hostname)
        && /^\/projects\/[^/]+\/settings\/people\/?$/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function choosePeopleUrl(input = {}) {
    const candidates = Array.isArray(input.candidateUrls) ? input.candidateUrls.filter(Boolean) : [];
    const existingPeople = candidates.find(isPeopleUrl);
    if (existingPeople) return peopleUrlFromUrl(existingPeople);

    const fromSource = peopleUrlFromUrl(input.sourceUrl);
    if (fromSource) return fromSource;

    const stored = peopleUrlFromUrl(input.storedPeopleUrl);
    if (stored) return stored;

    for (const candidate of candidates) {
      const derived = peopleUrlFromUrl(candidate);
      if (derived) return derived;
    }
    return null;
  }


  function shouldCreateCollector(reason) {
    const normalized = String(reason || '').toLowerCase();
    return normalized === 'manual' || normalized === 'user-active';
  }

  function normalizeSyncState(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    const valid = new Set(['syncing', 'live', 'stale', 'unavailable']);
    return {
      status: valid.has(value.status) ? value.status : 'unavailable',
      peopleUrl: peopleUrlFromUrl(value.peopleUrl),
      requestedAt: value.requestedAt ? String(value.requestedAt) : null,
      lastSuccessAt: value.lastSuccessAt ? String(value.lastSuccessAt) : null,
      reason: value.reason ? String(value.reason) : null,
      collectorTabId: Number.isInteger(Number(value.collectorTabId)) && Number(value.collectorTabId) >= 0
        ? Number(value.collectorTabId)
        : null,
    };
  }

  function ageMs(value, nowMs) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) && time > 0 ? nowMs - time : Number.POSITIVE_INFINITY;
  }

  function deriveDisplayStatus(rawSyncState, snapshotInfo = {}, nowMs = Date.now()) {
    const syncState = normalizeSyncState(rawSyncState);
    const now = Number(nowMs);
    if (syncState.status === 'syncing') {
      return ageMs(syncState.requestedAt, now) <= SYNC_TIMEOUT_MS ? 'syncing' : 'stale';
    }

    if (snapshotInfo.hasCurrentOfficialSnapshot === true
      && ageMs(snapshotInfo.observedAt, now) <= STALE_MS) {
      return 'live';
    }

    if (syncState.status === 'unavailable' && snapshotInfo.hasCurrentOfficialSnapshot !== true) {
      return 'unavailable';
    }
    return 'stale';
  }

  const api = {
    SYNC_KEY,
    USAGE_KEY,
    SYNC_TIMEOUT_MS,
    STALE_MS,
    peopleUrlFromUrl,
    isPeopleUrl,
    choosePeopleUrl,
    shouldCreateCollector,
    normalizeSyncState,
    deriveDisplayStatus,
  };

  root.LCMSync = Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
