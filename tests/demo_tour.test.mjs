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
  addEventListener() {}
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

test('hero tour uses the real runtime controls, including ring mode, and returns to full view', () => {
  const { root } = runTour({ search: '?surface=hero' });
  const { SELECTORS, TOUR_STEPS } = root.LCMDemoTour;

  assert.match(SELECTORS.mode, /Change view/);
  assert.match(SELECTORS.minimal, /lcm-minimal-surface/);
  assert.match(SELECTORS.ring, /lcm-ring-surface/);
  assert.match(SELECTORS.appearance, /Appearance/);
  assert.deepEqual(
    Array.from(TOUR_STEPS, (step) => [step.target, step.action || 'click']),
    [
      ['mode', 'click'],
      ['mode', 'click'],
      ['minimal', 'dblclick'],
      ['ring', 'click'],
      ['minimal', 'click'],
      ['appearance', 'click'],
      ['appearance', 'click'],
    ],
  );
});

test('hero tour and interactive visual hint are independent and respect reduced motion', () => {
  const hero = runTour({ search: '?surface=hero', reduced: false });
  const interactive = runTour({ search: '?surface=interactive', reduced: false });
  const reduced = runTour({ search: '?surface=interactive', reduced: true });

  assert.equal(hero.root.LCMDemoTour.shouldRun('hero', false), true);
  assert.equal(hero.root.LCMDemoTour.shouldRunInteractiveHint('hero', false), false);
  assert.equal(hero.body.children.length, 1);

  assert.equal(interactive.root.LCMDemoTour.shouldRun('interactive', false), false);
  assert.equal(interactive.root.LCMDemoTour.shouldRunInteractiveHint('interactive', false), true);
  assert.equal(interactive.body.children.length, 1);

  assert.equal(reduced.root.LCMDemoTour.shouldRunInteractiveHint('interactive', true), false);
  assert.equal(reduced.body.children.length, 0);
});

test('demo section keeps the standard heading and removes textual interaction instructions', () => {
  const landing = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  const hintCss = fs.readFileSync(path.join(ROOT, 'docs', 'interaction-hints.css'), 'utf8');

  assert.match(landing, /class="section-heading"[\s\S]*?<h2>Veja funcionando\.<\/h2>/);
  assert.doesNotMatch(landing, /A demo é interativa|Interativo · clique para testar|class="interactive-hint"/);
  assert.doesNotMatch(hintCss, /\.interactive-hint/);
});

test('interactive demo turns the workspace into an animated skeleton while keeping the monitor in focus', () => {
  const tourCss = fs.readFileSync(path.join(ROOT, 'docs', 'demo', 'demo-tour.css'), 'utf8');

  assert.match(tourCss, /body\[data-surface="interactive"\][\s\S]*\.workspace-topbar[\s\S]*\.workspace-shell[\s\S]*opacity:/);
  assert.match(tourCss, /demo-skeleton-shimmer/);
  assert.match(tourCss, /#lcm-panel\.demo-interaction-focus::after/);
  assert.doesNotMatch(tourCss, /#lcm-panel\s*\{[^}]*opacity:\s*0\.[0-9]+/s);
  assert.match(tourCss, /prefers-reduced-motion:\s*reduce/);
});

test('runtime demo loads the visual guidance after the real extension runtime', () => {
  const demoHtml = fs.readFileSync(path.join(ROOT, 'docs', 'demo', 'index.html'), 'utf8');
  const tourCss = fs.readFileSync(path.join(ROOT, 'docs', 'demo', 'demo-tour.css'), 'utf8');

  assert.match(demoHtml, /href="demo-tour\.css"/);
  const runtimeIndex = demoHtml.indexOf('runtime/content.js');
  const tourIndex = demoHtml.indexOf('demo-tour.js');
  assert.ok(runtimeIndex >= 0 && tourIndex > runtimeIndex);
  assert.match(tourCss, /demo-guide-cursor/);
});
