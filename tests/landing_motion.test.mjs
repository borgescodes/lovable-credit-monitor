import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'docs', 'demo.js'), 'utf8');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor({ href = null } = {}) {
    this.classList = new FakeClassList();
    this.href = href;
    this.listeners = new Map();
    this.attributes = new Map();
    this.style = { transform: '' };
    this.scrollOptions = null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type, event = {}) {
    this.listeners.get(type)?.({ currentTarget: this, ...event });
  }

  getAttribute(name) {
    if (name === 'href') return this.href;
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 200, height: 100 };
  }

  scrollIntoView(options) {
    this.scrollOptions = options;
  }
}

function runLanding({ reduced = false, finePointer = true, supportsObserver = true } = {}) {
  const reveal = new FakeElement();
  const parallax = new FakeElement();
  const anchor = new FakeElement({ href: '#demo' });
  const skipAnchor = new FakeElement({ href: '#main' });
  skipAnchor.classList.add('skip-link');
  const target = new FakeElement();
  const queries = [];
  const observers = [];
  const windowListeners = new Map();
  const document = {
    querySelectorAll(selector) {
      queries.push(selector);
      if (/iframe|contentDocument|contentWindow|lcm|credit-monitor/i.test(selector)) {
        throw new Error(`Landing queried outside its ownership boundary: ${selector}`);
      }
      if (selector === '.reveal') return [reveal];
      if (selector === '[data-parallax]') return [parallax];
      if (selector === 'main > .section:not(.hero), .site-footer') return [reveal];
      if (selector === '.hero-runtime-shell') return [parallax];
      if (selector === 'a[href^="#"]') return [anchor, skipAnchor];
      return [];
    },
    getElementById(id) {
      return id === 'demo' ? target : null;
    },
  };

  class FakeIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      observers.push(this);
    }

    observe(element) {
      this.observed.push(element);
    }

    unobserve(element) {
      this.observed = this.observed.filter((candidate) => candidate !== element);
    }

    trigger(entries) {
      this.callback(entries, this);
    }
  }

  const window = {
    document,
    IntersectionObserver: supportsObserver ? FakeIntersectionObserver : undefined,
    matchMedia(query) {
      if (query === '(prefers-reduced-motion: reduce)') return { matches: reduced };
      if (query === '(hover: hover) and (pointer: fine)') return { matches: finePointer };
      return { matches: false };
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      windowListeners.get(type)?.(event);
    },
    innerWidth: 1000,
    innerHeight: 800,
  };

  vm.runInNewContext(SOURCE, { window, document });
  return { anchor, observers, parallax, queries, reveal, skipAnchor, target, window, windowListeners };
}

test('an intersecting reveal becomes visible', () => {
  const fixture = runLanding();
  assert.equal(fixture.observers.length, 1);
  assert.deepEqual(fixture.observers[0].observed, [fixture.reveal]);

  fixture.observers[0].trigger([{ target: fixture.reveal, isIntersecting: true }]);

  assert.equal(fixture.reveal.classList.contains('is-visible'), true);
  assert.equal(fixture.reveal.classList.contains('is-pending'), false);
});

test('reveal content remains visible without IntersectionObserver', () => {
  const fixture = runLanding({ supportsObserver: false });

  assert.equal(fixture.reveal.classList.contains('is-visible'), true);
  assert.equal(fixture.reveal.classList.contains('is-pending'), false);
});

test('fine-pointer movement transforms only declared parallax elements', () => {
  const fixture = runLanding();
  assert.equal(fixture.queries.includes('[data-parallax]'), true);
  assert.equal(fixture.parallax.listeners.size, 0);

  fixture.window.dispatch('pointermove', { clientX: 1000, clientY: 0 });
  assert.match(fixture.parallax.style.transform, /^perspective\(1200px\) rotateX\(/);

  fixture.window.dispatch('pointerleave');
  assert.equal(fixture.parallax.style.transform, '');

  const coarse = runLanding({ finePointer: false });
  assert.equal(coarse.queries.includes('[data-parallax]'), false);
  assert.equal(coarse.windowListeners.size, 0);
});

test('landing adds progressive motion hooks after the reduced-motion gate', () => {
  const fixture = runLanding();

  assert.equal(fixture.reveal.classList.contains('reveal'), true);
  assert.equal(fixture.parallax.getAttribute('data-parallax'), '');
});

test('landing code never crosses into iframe or Credit Monitor state ownership', () => {
  assert.doesNotThrow(() => runLanding());
  assert.doesNotMatch(
    SOURCE,
    /contentDocument|contentWindow|postMessage|chrome\.|#lcm-panel|credit-monitor|\b(?:used|limit|remaining|palette|sync)\b/i,
  );
});

test('reduced motion exits before observers, parallax, or scripted scrolling', () => {
  const fixture = runLanding({ reduced: true });

  assert.deepEqual(fixture.queries, []);
  assert.equal(fixture.observers.length, 0);
  assert.equal(fixture.reveal.listeners.size, 0);
  assert.equal(fixture.parallax.listeners.size, 0);
  assert.equal(fixture.anchor.listeners.size, 0);
});

test('same-page anchors scroll to their landing target', () => {
  const fixture = runLanding();
  let prevented = false;

  fixture.anchor.dispatch('click', {
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(fixture.target.scrollOptions.behavior, 'smooth');
  assert.equal(fixture.target.scrollOptions.block, 'start');
});

test('skip link keeps native fragment focus behavior', () => {
  const fixture = runLanding();

  assert.equal(fixture.skipAnchor.listeners.has('click'), false);
});
