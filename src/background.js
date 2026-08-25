'use strict';

importScripts('sync.js');

const Sync = globalThis.LCMSync;
const AUTO_SYNC_ALARM = 'lcm-people-auto-sync';
const LOVABLE_TAB_PATTERNS = [
  'https://lovable.dev/*',
  'https://*.lovable.dev/*',
];

let ensureInFlight = null;

async function getTabById(tabId) {
  if (!Number.isInteger(Number(tabId)) || Number(tabId) < 0) return null;
  try {
    return await chrome.tabs.get(Number(tabId));
  } catch (_) {
    return null;
  }
}

async function getSyncState() {
  const stored = await chrome.storage.local.get(Sync.SYNC_KEY);
  return Sync.normalizeSyncState(stored[Sync.SYNC_KEY]);
}

async function writeSyncState(patch) {
  const current = await getSyncState();
  const next = Sync.normalizeSyncState({ ...current, ...patch });
  await chrome.storage.local.set({ [Sync.SYNC_KEY]: next });
  return next;
}

function tabUrl(tab) {
  return tab?.url || tab?.pendingUrl || null;
}

async function listLovableTabs() {
  return chrome.tabs.query({ url: LOVABLE_TAB_PATTERNS });
}

function matchingPeopleTab(tabs, peopleUrl) {
  return (tabs || []).find((tab) => {
    const value = tabUrl(tab);
    if (!Sync.isPeopleUrl(value)) return false;
    return Sync.peopleUrlFromUrl(value) === peopleUrl;
  }) || null;
}

async function resolveExistingPeopleTab(current, tabs, peopleUrl) {
  const pinned = await getTabById(current.collectorTabId);
  if (pinned && Sync.isPeopleUrl(tabUrl(pinned))) return pinned;

  const anyPeople = (tabs || []).find((tab) => Sync.isPeopleUrl(tabUrl(tab)));
  if (anyPeople) return anyPeople;

  return matchingPeopleTab(tabs, peopleUrl);
}

async function ensureCollectorInternal(options = {}) {
  const reason = options.reason || 'automatic';
  const forceReload = options.forceReload === true;
  const createIfMissing = options.createIfMissing === true && Sync.shouldCreateCollector(reason);
  const markSyncing = options.markSyncing === true;
  const current = await getSyncState();
  const tabs = await listLovableTabs();
  const candidateUrls = tabs.map(tabUrl).filter(Boolean);
  const peopleUrl = Sync.choosePeopleUrl({
    sourceUrl: options.sourceUrl,
    storedPeopleUrl: current.peopleUrl,
    candidateUrls,
  });

  if (!peopleUrl) {
    await writeSyncState({
      status: 'unavailable',
      peopleUrl: null,
      requestedAt: null,
      reason,
    });
    return { ok: false, reason: 'people-url-unavailable' };
  }

  if (markSyncing) {
    await writeSyncState({
      status: 'syncing',
      peopleUrl,
      requestedAt: new Date().toISOString(),
      reason,
    });
  } else if (current.peopleUrl !== peopleUrl) {
    await writeSyncState({ peopleUrl, reason });
  }

  let peopleTab = await resolveExistingPeopleTab(current, tabs, peopleUrl);
  let created = false;

  if (!peopleTab && createIfMissing) {
    peopleTab = await chrome.tabs.create({
      url: peopleUrl,
      active: false,
    });
    created = true;
  }

  if (!peopleTab) {
    if (createIfMissing) {
      await writeSyncState({
        status: 'unavailable',
        peopleUrl,
        requestedAt: null,
        collectorTabId: null,
        reason,
      });
    } else if (current.peopleUrl !== peopleUrl || current.collectorTabId !== null) {
      await writeSyncState({
        peopleUrl,
        collectorTabId: null,
        reason,
      });
    }
    return { ok: false, reason: 'people-tab-unavailable', peopleUrl };
  }

  const resolvedPeopleUrl = Sync.peopleUrlFromUrl(tabUrl(peopleTab)) || peopleUrl;
  await writeSyncState({
    peopleUrl: resolvedPeopleUrl,
    collectorTabId: Number.isInteger(Number(peopleTab.id)) ? Number(peopleTab.id) : null,
    reason,
  });

  if (forceReload && !created) {
    await chrome.tabs.reload(peopleTab.id);
  }

  return {
    ok: true,
    peopleUrl: resolvedPeopleUrl,
    tabId: peopleTab.id,
    created,
    reloaded: forceReload && !created,
  };
}

function ensureCollector(options = {}) {
  if (ensureInFlight) return ensureInFlight.then(() => ensureCollector(options));
  ensureInFlight = ensureCollectorInternal(options)
    .catch(async () => {
      try {
        await writeSyncState({
          status: 'unavailable',
          requestedAt: null,
          reason: options.reason || 'automatic',
        });
      } catch (_) {
        // Storage failure is non-fatal.
      }
      return { ok: false, reason: 'collector-operation-failed' };
    })
    .finally(() => {
      ensureInFlight = null;
    });
  return ensureInFlight;
}

async function ensureAlarm() {
  const existing = await chrome.alarms.get(AUTO_SYNC_ALARM);
  if (existing) return;
  chrome.alarms.create(AUTO_SYNC_ALARM, { periodInMinutes: 0.5 });
}

async function startupSync() {
  await ensureAlarm();
  return { ok: true, dormant: true };
}

chrome.runtime.onInstalled.addListener(() => {
  void startupSync();
});

chrome.runtime.onStartup.addListener(() => {
  void startupSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AUTO_SYNC_ALARM) return;
  void ensureCollector({
    reason: 'periodic',
    forceReload: true,
    createIfMissing: false,
    markSyncing: false,
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'LCM_REGISTER_CONTEXT') {
    void ensureCollector({
      reason: 'context',
      sourceUrl: message.url || tabUrl(sender.tab),
      forceReload: false,
      createIfMissing: false,
      markSyncing: false,
    }).then(sendResponse);
    return true;
  }

  if (message?.type === 'LCM_USER_ACTIVE') {
    void ensureCollector({
      reason: 'user-active',
      sourceUrl: message.url || tabUrl(sender.tab),
      forceReload: true,
      createIfMissing: true,
      markSyncing: true,
    }).then(sendResponse);
    return true;
  }

  if (message?.type === 'LCM_MANUAL_SYNC') {
    void ensureCollector({
      reason: 'manual',
      sourceUrl: message.url || tabUrl(sender.tab),
      forceReload: true,
      createIfMissing: true,
      markSyncing: true,
    }).then(sendResponse);
    return true;
  }

  return false;
});


chrome.tabs.onRemoved.addListener((tabId) => {
  void getSyncState().then((current) => {
    if (current.collectorTabId !== Number(tabId)) return;
    return writeSyncState({ collectorTabId: null });
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[Sync.USAGE_KEY]) return;
  const snapshot = changes[Sync.USAGE_KEY].newValue;
  if (snapshot?.source !== 'people') return;
  void writeSyncState({
    status: 'live',
    requestedAt: null,
    lastSuccessAt: snapshot.observedAt || new Date().toISOString(),
    reason: 'collector',
  });
});

void ensureAlarm();
