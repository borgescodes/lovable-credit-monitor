import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const adapterPath = new URL('../docs/demo/demo-adapter.js', import.meta.url);
const fixedNow = '2026-08-27T12:00:00.000Z';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

class FixedDate extends Date {
  constructor(...args) {
    super(args.length ? args[0] : fixedNow);
  }

  static now() {
    return new Date(fixedNow).getTime();
  }
}

function loadAdapter() {
  const timers = [];
  const context = vm.createContext({
    Date: FixedDate,
    LCMState: { monthKey: () => '2026-08' },
    LCMSync: {
      USAGE_KEY: 'lovableCreditMonitorUsageV6',
      SYNC_KEY: 'lovableCreditMonitorSyncV6',
    },
    structuredClone,
    setTimeout(callback, delay) {
      timers.push({ callback, delay, ran: false });
      return timers.length;
    },
  });
  context.__runTimer = (delay) => {
    const timer = timers.find((candidate) => candidate.delay === delay && !candidate.ran);
    assert.ok(timer, `expected a pending ${delay}ms timer`);
    timer.ran = true;
    timer.callback();
  };
  vm.runInContext(fs.readFileSync(adapterPath, 'utf8'), context, { filename: 'docs/demo/demo-adapter.js' });
  return context;
}

test('preloads a current official People snapshot', async () => {
  const context = loadAdapter();
  const stored = await context.chrome.storage.local.get(['lovableCreditMonitorUsageV6']);
  assert.deepEqual(stored.lovableCreditMonitorUsageV6, {
    used: 1267,
    limit: 1400,
    monthKey: '2026-08',
    observedAt: '2026-08-27T12:00:00.000Z',
    source: 'people',
    personLabel: 'Demo builder (you)',
    usageHeader: 'August usage',
  });
});

test('manual sync writes through storage and notifies real listeners', async () => {
  const context = loadAdapter();
  const observed = [];
  context.chrome.storage.onChanged.addListener((changes, area) => observed.push({ changes, area }));
  const responsePromise = context.chrome.runtime.sendMessage({ type: 'LCM_MANUAL_SYNC' });
  context.__runTimer(800);
  assert.deepEqual(plain(await responsePromise), { ok: true });
  const stored = await context.chrome.storage.local.get(null);
  assert.equal(stored.lovableCreditMonitorUsageV6.used, 1274);
  assert.equal(stored.lovableCreditMonitorSyncV6.status, 'live');
  assert.equal(observed.at(-1).area, 'local');
  assert.deepEqual(observed.at(-1).changes.lovableCreditMonitorUsageV6.oldValue.used, 1267);
  assert.deepEqual(observed.at(-1).changes.lovableCreditMonitorUsageV6.newValue.used, 1274);
});

test('storage get supports null, string, arrays, and object defaults', async () => {
  const context = loadAdapter();
  const storage = context.chrome.storage.local;
  const all = await storage.get(null);
  assert.equal(all.lovableCreditMonitorUsageV6.used, 1267);
  assert.deepEqual(plain(await storage.get('missing')), {});
  assert.equal((await storage.get(['lovableCreditMonitorUsageV6', 'missing'])).lovableCreditMonitorUsageV6.limit, 1400);
  assert.deepEqual(plain(await storage.get({ missing: { persisted: false } })), { missing: { persisted: false } });
});

test('storage set persists UI preferences and reports Chrome-shaped changes', async () => {
  const context = loadAdapter();
  const observed = [];
  context.chrome.storage.onChanged.addListener((changes, area) => observed.push({ changes, area }));
  const preference = { uiVersion: 9, mode: 'compact', theme: 'dark' };
  await context.chrome.storage.local.set({ lovableCreditMonitorUiV6: preference });
  const stored = await context.chrome.storage.local.get('lovableCreditMonitorUiV6');
  assert.deepEqual(stored.lovableCreditMonitorUiV6, preference);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].area, 'local');
  assert.ok(Object.hasOwn(observed[0].changes.lovableCreditMonitorUiV6, 'oldValue'));
  assert.equal(observed[0].changes.lovableCreditMonitorUiV6.oldValue, undefined);
  assert.deepEqual(plain(observed[0].changes.lovableCreditMonitorUiV6.newValue), preference);
});

test('registration and activity messages are harmless while unknown messages fail closed', async () => {
  const context = loadAdapter();
  assert.deepEqual(plain(await context.chrome.runtime.sendMessage({ type: 'LCM_REGISTER_CONTEXT', url: 'https://lovable.dev/projects/demo' })), { ok: true });
  assert.deepEqual(plain(await context.chrome.runtime.sendMessage({ type: 'LCM_USER_ACTIVE', url: 'https://lovable.dev/projects/demo' })), { ok: true });
  assert.deepEqual(plain(await context.chrome.runtime.sendMessage({ type: 'UNSUPPORTED' })), { ok: false });
});
