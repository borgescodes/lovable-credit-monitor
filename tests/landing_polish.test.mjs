import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'docs', 'styles.css'), 'utf8');
const product = fs.readFileSync(path.join(ROOT, 'PRODUCT.md'), 'utf8');

test('landing ships one consolidated stylesheet and preserves section hierarchy', () => {
  assert.match(html, /href="styles\.css"/);
  assert.doesNotMatch(html, /interaction-hints\.css/);
  assert.match(html, /<h2>Veja funcionando\.<\/h2>/);
});

test('polish removes legacy landing scaffolding and decorative measurement stripes', () => {
  for (const obsolete of ['.hero-trust-rail', '.workspace-shell', '.final-cta', 'repeating-linear-gradient']) {
    assert.doesNotMatch(css, new RegExp(obsolete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('hero preview and operable demo use distinct depth treatments', () => {
  assert.match(css, /\.hero-runtime-shell\s*\{[^}]*border:\s*0;[^}]*box-shadow:\s*0 24px 56px/s);
  assert.match(css, /\.interactive-runtime-shell\s*\{[^}]*border:\s*1px solid var\(--line-strong\);[^}]*box-shadow:\s*none/s);
});

test('privacy proof stays a balanced four-item grid without nested-card styling', () => {
  assert.match(css, /\.privacy-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.privacy-list\s*\{[^}]*font-size:\s*14px/s);
  assert.match(css, /\.permissions-card\s*\{[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.permissions-note\s*\{[^}]*border-radius:\s*0/s);
});

test('product context matches the Portuguese public landing', () => {
  assert.doesNotMatch(product, /public copy remains entirely in English/i);
  assert.match(product, /public copy remains entirely in Brazilian Portuguese/i);
});
