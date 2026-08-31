import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.join(ROOT, 'docs', 'demo', 'demo-tour.js');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
}

class FakeElement {
  constructor() {
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.attributes = new Map();
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getBoundingClientRect() { return { left: 100, top: 100, width: 40, height: 30 }; }
}

function runTour({ search = '?surface=interactive', reduced = false } = {}) {
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const body = new FakeElement();
  const document = {
    body,
    hidden: false,
    createElement() { return new FakeElement(); },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const root = {
    document,
    location: { search },
    matchMedia() { return { matches: reduced }; },
    setTimeout() { return 1; },
    clearTimeout() {},
    getComputedStyle() { return { visibility: 'visible' }; },
    URLSearchParams,
  };
  root.globalThis = root;
  vm.runInNewContext(source, root);
  return { root, body };
}

test('hero tour uses the real runtime controls and returns to full view', () => {
  const { root } = runTour({ search: '?surface=hero' });
  const { SELECTORS, TOUR_STEPS } = root.LCMDemoTour;

  assert.match(SELECTORS.mode, /Change view/);
  assert.match(SELECTORS.minimal, /lcm-minimal-surface/);
  assert.match(SELECTORS.appearance, /Appearance/);
  assert.deepEqual(
    Array.from(TOUR_STEPS, (step) => step.target),
    ['mode', 'mode', 'minimal', 'appearance', 'appearance'],
  );
});

test('automatic tour runs only on hero and respects reduced motion', () => {
  const hero = runTour({ search: '?surface=hero', reduced: false });
  const interactive = runTour({ search: '?surface=interactive', reduced: false });
  const reduced = runTour({ search: '?surface=hero', reduced: true });

  assert.equal(hero.root.LCMDemoTour.shouldRun('hero', false), true);
  assert.equal(hero.body.children.length, 1);
  assert.equal(interactive.root.LCMDemoTour.shouldRun('interactive', false), false);
  assert.equal(interactive.body.children.length, 0);
  assert.equal(reduced.root.LCMDemoTour.shouldRun('hero', true), false);
  assert.equal(reduced.body.children.length, 0);
});

test('landing clearly marks the interactive demo without changing the hero shell behavior', () => {
  const landing = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  const hintCss = fs.readFileSync(path.join(ROOT, 'docs', 'interaction-hints.css'), 'utf8');

  assert.match(landing, /A demo é interativa\. Clique na extensão e teste os controles\. Os dados são simulados\./);
  assert.match(landing, /class="interactive-hint"/);
  assert.match(landing, /Interativo · clique para testar/);
  assert.match(landing, /href="interaction-hints\.css"/);
  assert.match(hintCss, /pointer-events:\s*none/);
  assert.doesNotMatch(hintCss, /hero-runtime-shell/);
});

test('runtime demo loads the hero tour after the real extension runtime', () => {
  const demoHtml = fs.readFileSync(path.join(ROOT, 'docs', 'demo', 'index.html'), 'utf8');
  const tourCss = fs.readFileSync(path.join(ROOT, 'docs', 'demo', 'demo-tour.css'), 'utf8');

  assert.match(demoHtml, /href="demo-tour\.css"/);
  const runtimeIndex = demoHtml.indexOf('runtime/content.js');
  const tourIndex = demoHtml.indexOf('demo-tour.js');
  assert.ok(runtimeIndex >= 0 && tourIndex > runtimeIndex);
  assert.match(tourCss, /demo-guide-cursor/);
  assert.match(tourCss, /prefers-reduced-motion:\s*reduce/);
});
