(function createDemoChromeAdapter() {
  'use strict';

  const usageKey = globalThis.LCMSync.USAGE_KEY;
  const syncKey = globalThis.LCMSync.SYNC_KEY;
  const now = new Date();
  const initialUsage = {
    used: 1267,
    limit: 1400,
    monthKey: globalThis.LCMState.monthKey(now),
    observedAt: now.toISOString(),
    source: 'people',
    personLabel: 'Demo builder (you)',
    usageHeader: `${now.toLocaleString('en-US', { month: 'long' })} usage`,
  };
  const initialSync = {
    status: 'live',
    lastSuccessAt: now.toISOString(),
    requestedAt: null,
    reason: 'demo',
  };
  const store = new Map([
    [usageKey, initialUsage],
    [syncKey, initialSync],
  ]);
  const changeListeners = new Set();

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function valuesFor(keys) {
    const result = {};
    if (keys === null || keys === undefined) {
      for (const [key, value] of store) result[key] = clone(value);
      return result;
    }
    if (typeof keys === 'string') {
      if (store.has(keys)) result[keys] = clone(store.get(keys));
      return result;
    }
    if (Array.isArray(keys)) {
      keys.forEach((key) => {
        if (store.has(key)) result[key] = clone(store.get(key));
      });
      return result;
    }
    if (keys && typeof keys === 'object') {
      Object.entries(keys).forEach(([key, defaultValue]) => {
        result[key] = store.has(key) ? clone(store.get(key)) : clone(defaultValue);
      });
    }
    return result;
  }

  const local = {
    async get(keys) {
      return valuesFor(keys);
    },
    async set(items) {
      const changes = {};
      Object.entries(items || {}).forEach(([key, value]) => {
        const oldValue = store.has(key) ? store.get(key) : undefined;
        const nextValue = clone(value);
        if (sameValue(oldValue, nextValue)) return;
        store.set(key, nextValue);
        changes[key] = { oldValue: clone(oldValue), newValue: clone(nextValue) };
      });
      if (Object.keys(changes).length) {
        changeListeners.forEach((listener) => listener(changes, 'local'));
      }
    },
  };

  const chrome = {
    storage: {
      local,
      onChanged: {
        addListener(listener) {
          changeListeners.add(listener);
        },
      },
    },
    runtime: {
      sendMessage(message) {
        if (message?.type === 'LCM_MANUAL_SYNC') {
          return new Promise((resolve) => {
            setTimeout(() => {
              const syncNow = new Date();
              void chrome.storage.local.set({
                [usageKey]: {
                  ...initialUsage,
                  used: 1274,
                  observedAt: syncNow.toISOString(),
                },
                [syncKey]: {
                  status: 'live',
                  lastSuccessAt: syncNow.toISOString(),
                  requestedAt: null,
                  reason: 'manual',
                },
              }).then(() => resolve({ ok: true }));
            }, 800);
          });
        }
        if (message?.type === 'LCM_REGISTER_CONTEXT' || message?.type === 'LCM_USER_ACTIVE') {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      },
    },
  };

  globalThis.chrome = chrome;
})();
