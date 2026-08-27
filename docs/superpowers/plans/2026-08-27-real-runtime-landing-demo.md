# Real Runtime Landing Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the GitHub Pages mock monitor with the byte-identical v0.7.2 Credit Monitor runtime in an isolated simulated workspace, then strengthen the landing page around that truthful demo.

**Architecture:** A raw-byte synchronization script mirrors seven canonical `/src` files into `docs/demo/runtime/`; verification rejects any hash drift. A tiny in-memory Chrome adapter loads between the real runtime dependencies and `content.js`, so the real component owns all product UI and interactions while GitHub Pages supplies only simulated storage and sync responses. The landing embeds the same demo document twice: a pointer-inert, non-focusable hero presentation and a fully interactive main iframe.

**Tech Stack:** Static HTML5, modern CSS, vanilla JavaScript, Python 3 standard library, Node.js built-in test runner, Python `unittest`, SHA-256, in-app browser QA.

**Spec:** `docs/superpowers/specs/2026-08-27-real-runtime-landing-demo-design.md`

## Global Constraints

- Keep `manifest.json`, all canonical files under `src/`, and `docs/downloads/lovable-credit-monitor-v0.7.2.zip` byte-for-byte unchanged.
- Treat `/src` as the only runtime source of truth; never hand-edit `docs/demo/runtime/`.
- Copy runtime files with `Path.read_bytes()` and `Path.write_bytes()` and hash raw bytes; never use text-mode reads/writes for synchronization.
- The hero iframe must use `tabindex="-1"`, be pointer-inert, and expose no duplicate keyboard interaction surface.
- The main iframe remains keyboard- and pointer-interactive and has title `Interactive Credit Monitor demo`.
- The landing must not own view, settings, palette, theme, usage, countdown, sync, or drag state.
- The adapter may define only `chrome.storage.local.get`, `chrome.storage.local.set`, `chrome.storage.onChanged.addListener`, and `chrome.runtime.sendMessage`.
- Use supplied `lovable.svg` and `github.svg`; normalize only the GitHub visible path fill to pure `#FFFFFF`, preserving geometry.
- All landing-only non-brand icons must use genuine filled Boxicons; reuse canonical paths from `src/icons.js` where available.
- Preserve existing unrelated working-tree changes. Supersede only the fake-demo-specific `docs/demo.js`, `tests/test_docs_interface.py`, and `tests/demo_interaction.test.mjs` edits after replacement tests exist and fail for the right reason.
- Use TDD for every behavior change: write one failing test, confirm the intended failure, implement minimally, then rerun the focused and full suites.

---

### Task 1: Raw-byte runtime synchronization and drift detection

**Files:**
- Create: `scripts/sync_demo_runtime.py`
- Create: `tests/test_demo_runtime_sync.py`
- Create: `docs/demo/runtime/panel.css`
- Create: `docs/demo/runtime/state.js`
- Create: `docs/demo/runtime/collector.js`
- Create: `docs/demo/runtime/brand.js`
- Create: `docs/demo/runtime/icons.js`
- Create: `docs/demo/runtime/sync.js`
- Create: `docs/demo/runtime/content.js`
- Modify: `scripts/verify_repository.py`
- Modify: `tests/test_verify_repository.py`

**Interfaces:**
- Produces: `RUNTIME_FILES: tuple[str, ...]`, `copy_runtime(source_root: Path, destination_root: Path) -> None`, `verify_runtime(source_root: Path, destination_root: Path) -> list[str]`, and CLI `python scripts/sync_demo_runtime.py [--check]`.
- Consumes: canonical bytes from `src/<name>`.
- Produces for later tasks: deployable runtime URLs under `demo/runtime/` and `verify_demo_runtime()` in repository verification.

- [ ] **Step 1: Capture the working-tree boundary**

Run:

```powershell
git status --short
git diff -- docs/demo.js tests/test_docs_interface.py
Get-FileHash manifest.json, src\*.js, src\panel.css -Algorithm SHA256
```

Record the source hashes in the task notes and do not stage unrelated `.impeccable`, `.agents`, `.codex`, or `.opencode` content.

- [ ] **Step 2: Write failing raw-byte synchronization tests**

Create `tests/test_demo_runtime_sync.py` with real temporary files, including non-UTF8/newline-sensitive bytes:

```python
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import sync_demo_runtime


class DemoRuntimeSyncTests(unittest.TestCase):
    def test_copy_runtime_preserves_exact_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            mirror = root / "docs" / "demo" / "runtime"
            source.mkdir(parents=True)
            fixture = b"line-one\nline-two\r\n\x80\xff"
            for name in sync_demo_runtime.RUNTIME_FILES:
                (source / name).write_bytes(fixture + name.encode("ascii"))

            sync_demo_runtime.copy_runtime(source, mirror)

            for name in sync_demo_runtime.RUNTIME_FILES:
                self.assertEqual((mirror / name).read_bytes(), fixture + name.encode("ascii"))

    def test_verify_runtime_reports_changed_and_missing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "src"
            mirror = root / "runtime"
            source.mkdir()
            mirror.mkdir()
            for name in sync_demo_runtime.RUNTIME_FILES:
                payload = f"canonical:{name}".encode("ascii")
                (source / name).write_bytes(payload)
                (mirror / name).write_bytes(payload)
            (mirror / "content.js").write_bytes(b"drift")
            (mirror / "icons.js").unlink()

            self.assertEqual(
                sync_demo_runtime.verify_runtime(source, mirror),
                ["content.js: hash mismatch", "icons.js: missing mirror"],
            )

    def test_repository_runtime_check_passes_for_generated_mirror(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "sync_demo_runtime.py"), "--check"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
```

Add a `verify_demo_runtime()` test to `tests/test_verify_repository.py` that calls the real verifier and a temporary-root test that makes one mirror byte differ and expects an `AssertionError` naming the file.

- [ ] **Step 3: Run the focused tests and confirm the intended failure**

Run:

```powershell
python -m unittest tests.test_demo_runtime_sync tests.test_verify_repository -v
```

Expected: import or attribute failure because `sync_demo_runtime.py` and `verify_demo_runtime()` do not exist.

- [ ] **Step 4: Implement raw-byte synchronization**

Create `scripts/sync_demo_runtime.py` with this boundary:

```python
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "src"
DESTINATION_ROOT = ROOT / "docs" / "demo" / "runtime"
RUNTIME_FILES = (
    "panel.css",
    "state.js",
    "collector.js",
    "brand.js",
    "icons.js",
    "sync.js",
    "content.js",
)


def digest_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def copy_runtime(source_root: Path, destination_root: Path) -> None:
    destination_root.mkdir(parents=True, exist_ok=True)
    for name in RUNTIME_FILES:
        (destination_root / name).write_bytes((source_root / name).read_bytes())


def verify_runtime(source_root: Path, destination_root: Path) -> list[str]:
    failures: list[str] = []
    for name in RUNTIME_FILES:
        source_path = source_root / name
        mirror_path = destination_root / name
        if not source_path.exists():
            failures.append(f"{name}: missing source")
        elif not mirror_path.exists():
            failures.append(f"{name}: missing mirror")
        elif digest_bytes(source_path.read_bytes()) != digest_bytes(mirror_path.read_bytes()):
            failures.append(f"{name}: hash mismatch")
    extras = sorted(
        path.name
        for path in destination_root.iterdir()
        if path.is_file() and path.name not in RUNTIME_FILES
    ) if destination_root.exists() else []
    failures.extend(f"{name}: unexpected mirror" for name in extras)
    return sorted(failures)
```

The CLI calls `verify_runtime()` for `--check`, prints each mismatch, and exits 1; without `--check`, it calls `copy_runtime()` and then verifies the result.

Import this module as `from scripts.sync_demo_runtime import DESTINATION_ROOT, SOURCE_ROOT, verify_runtime` in `scripts/verify_repository.py` and add `verify_demo_runtime()` to its check list. Do not duplicate file lists or hashing logic.

- [ ] **Step 5: Generate mirrors and turn the tests green**

Run:

```powershell
python scripts/sync_demo_runtime.py
python -m unittest tests.test_demo_runtime_sync tests.test_verify_repository -v
python scripts/sync_demo_runtime.py --check
```

Expected: all focused tests pass and the check reports seven matching files.

- [ ] **Step 6: Commit the synchronization boundary**

```powershell
git add scripts/sync_demo_runtime.py scripts/verify_repository.py tests/test_demo_runtime_sync.py tests/test_verify_repository.py docs/demo/runtime
git commit -m "build: mirror demo runtime from canonical source"
```

---

### Task 2: Minimal Chrome adapter and deterministic simulated sync

**Files:**
- Create: `docs/demo/demo-adapter.js`
- Create: `tests/demo_adapter.test.mjs`

**Interfaces:**
- Consumes: `globalThis.LCMState.monthKey`, `globalThis.LCMSync.USAGE_KEY`, `globalThis.LCMSync.SYNC_KEY`.
- Produces: the four-method `globalThis.chrome` adapter used by canonical `content.js`.
- Behavior: initial snapshot `1267 / 1400`; `LCM_MANUAL_SYNC` resolves after 800 ms and emits Chrome-shaped local storage changes for `1274 / 1400` and live sync state.

- [ ] **Step 1: Write adapter behavior tests against the real script**

Create `tests/demo_adapter.test.mjs`. Execute `docs/demo/demo-adapter.js` in `vm.createContext()` with canonical key names, a fixed `Date`, and captured timers. Test observable adapter behavior, not source text:

```js
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
  assert.deepEqual(await responsePromise, { ok: true });
  const stored = await context.chrome.storage.local.get(null);
  assert.equal(stored.lovableCreditMonitorUsageV6.used, 1274);
  assert.equal(stored.lovableCreditMonitorSyncV6.status, 'live');
  assert.equal(observed.at(-1).area, 'local');
  assert.deepEqual(observed.at(-1).changes.lovableCreditMonitorUsageV6.oldValue.used, 1267);
  assert.deepEqual(observed.at(-1).changes.lovableCreditMonitorUsageV6.newValue.used, 1274);
});
```

Also test `get(null)`, `get(string)`, `get(array)`, `get(object defaults)`, successful UI preference persistence through `set`, harmless registration/activity messages, and unsupported messages returning `{ok: false}` without network access.

- [ ] **Step 2: Run the Node test and confirm it fails because the adapter is missing**

```powershell
node --test tests/demo_adapter.test.mjs
```

- [ ] **Step 3: Implement the minimal adapter**

Implement an IIFE that creates a private `Map`/plain object store, clones values with `structuredClone` or JSON-safe cloning, and emits only changed keys. Preload current data with the real state API:

```js
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
```

Preload `syncKey` with `{status: 'live', lastSuccessAt: now.toISOString(), requestedAt: null, reason: 'demo'}` so the canonical status derivation starts healthy. Keep the `chrome` object structurally limited to `storage.local.get`, `storage.local.set`, `storage.onChanged.addListener`, and `runtime.sendMessage`; do not add test hooks to production.

For manual sync, call the adapter's own `chrome.storage.local.set()` with both updated keys after exactly 800 ms. Do not export test-only reset functions, inject DOM, or call `fetch`, XHR, WebSocket, `sendBeacon`, `postMessage`, or browser extension APIs outside this shim.

- [ ] **Step 4: Turn adapter tests green and run the mirror check**

```powershell
node --test tests/demo_adapter.test.mjs
python scripts/sync_demo_runtime.py --check
```

- [ ] **Step 5: Commit the adapter**

```powershell
git add docs/demo/demo-adapter.js tests/demo_adapter.test.mjs
git commit -m "feat: simulate Chrome storage for real demo runtime"
```

---

### Task 3: Isolated Lovable-like demo workspace and runtime load order

**Files:**
- Create: `docs/demo/index.html`
- Create: `docs/demo/demo-workspace.css`
- Create: `docs/assets/lovable.svg` from `C:\Users\pedro.borges\Downloads\lovable.svg`
- Modify: `tests/test_docs_interface.py`

**Interfaces:**
- Produces: `demo/index.html?surface=hero` and `demo/index.html?surface=interactive`.
- Consumes: generated runtime files and the adapter from Tasks 1–2.

- [ ] **Step 1: Replace obsolete demo tests with failing iframe-runtime contracts**

In `tests/test_docs_interface.py`, add a second parser for `docs/demo/index.html` and tests that assert:

```python
def test_demo_loads_real_runtime_after_adapter(self):
    sources = [attrs.get("src") for tag, attrs in self.demo_parser.tags if tag == "script"]
    self.assertEqual(sources, [
        "runtime/state.js",
        "runtime/collector.js",
        "runtime/brand.js",
        "runtime/icons.js",
        "runtime/sync.js",
        "demo-adapter.js",
        "runtime/content.js",
    ])

def test_demo_workspace_labels_truth_and_uses_lovable_brand(self):
    self.assertIn("Real interface · simulated usage data", self.demo_html)
    self.assertEqual(len(self.demo_tags("img", src="../assets/lovable.svg")), 1)

def test_demo_document_never_reimplements_monitor_markup(self):
    classes = " ".join(attrs.get("class", "") for _, attrs in self.demo_parser.tags)
    self.assertNotIn("credit-monitor", classes)
    self.assertNotIn("monitor-full", classes)
    self.assertNotIn("lcm-view", classes)
    self.assertNotIn('id="lcm-panel"', self.demo_html)
```

Remove the fake-demo assertions for external view/theme controls. Keep unrelated navigation, download, installation, semantic, and accessibility tests intact.

- [ ] **Step 2: Run the focused HTML tests and confirm missing demo files fail**

```powershell
python -m unittest tests.test_docs_interface -v
```

- [ ] **Step 3: Copy the supplied Lovable asset without modification**

Use `apply_patch` to create `docs/assets/lovable.svg` with the exact supplied SVG text. Allow only the terminal newline that repository patching may add; verify every supplied SVG byte before that newline remains identical:

```powershell
$source = [IO.File]::ReadAllBytes('C:\Users\pedro.borges\Downloads\lovable.svg')
$shipped = [IO.File]::ReadAllBytes('docs\assets\lovable.svg')
$sourceText = [Text.Encoding]::UTF8.GetString($source).TrimEnd("`r", "`n")
$shippedText = [Text.Encoding]::UTF8.GetString($shipped).TrimEnd("`r", "`n")
if ($sourceText -cne $shippedText) { throw 'Lovable asset geometry or paint drifted' }
```

- [ ] **Step 4: Build the demo document and scoped workspace**

Create semantic fictional workspace markup with a top bar, supplied Lovable mark, project label, sidebar, code/build canvas, conversation panel, and the persistent truth label. Keep all workspace selectors under `.demo-workspace`; never target `#lcm-panel` or `.lcm-*` from `demo-workspace.css`.

Load CSS in this order:

```html
<link rel="stylesheet" href="demo-workspace.css">
<link rel="stylesheet" href="runtime/panel.css">
```

Load scripts in the exact tested order and use `defer` consistently. Set a Lovable project-shaped URL only in visible fictional copy; do not attempt to change `location` or emulate People DOM.

- [ ] **Step 5: Turn iframe structure tests green**

```powershell
python -m unittest tests.test_docs_interface -v
python scripts/verify_repository.py
```

- [ ] **Step 6: Commit the demo workspace**

```powershell
git add docs/demo/index.html docs/demo/demo-workspace.css docs/assets/lovable.svg tests/test_docs_interface.py
git commit -m "feat: run real Credit Monitor inside demo workspace"
```

---

### Task 4: Landing markup, supplied GitHub mark, and runtime ownership

**Files:**
- Modify: `docs/index.html`
- Create: `docs/assets/github.svg` from `C:\Users\pedro.borges\Downloads\github.svg` with path fill normalized to `#FFFFFF`
- Modify: `tests/test_docs_interface.py`
- Delete: `tests/demo_interaction.test.mjs`

**Interfaces:**
- Consumes: `demo/index.html?surface=hero` and `demo/index.html?surface=interactive`.
- Produces: one non-interactive hero preview and one fully interactive demo, both GitHub Pages-relative.

- [ ] **Step 1: Write failing landing ownership and brand tests**

Replace the obsolete subprocess test with assertions on the actual page boundary:

```python
def test_landing_has_presentation_only_hero_and_interactive_main_demo(self):
    hero = self.tags("iframe", **{"class": "hero-runtime-frame"})
    demo = self.tags("iframe", **{"class": "interactive-runtime-frame"})
    self.assertEqual(hero[0][1].get("tabindex"), "-1")
    self.assertEqual(hero[0][1].get("aria-hidden"), "true")
    self.assertEqual(hero[0][1].get("src"), "demo/index.html?surface=hero")
    self.assertNotIn("tabindex", demo[0][1])
    self.assertEqual(demo[0][1].get("title"), "Interactive Credit Monitor demo")

def test_landing_does_not_own_product_controls_or_state(self):
    forbidden = (
        'class="credit-monitor"', "monitor-full", "monitor-compact",
        "monitor-minimal", "monitor-ring", "data-view=", "data-theme=",
        "limit: 100", "used: 64", "remaining: 36", "AVAILABLE",
    )
    for value in forbidden:
        self.assertNotIn(value, self.html)

def test_supplied_brand_assets_are_used(self):
    self.assertIn('src="assets/lovable.svg"', self.html)
    self.assertIn('src="assets/github.svg"', self.html)
    github = (ROOT / "docs" / "assets" / "github.svg").read_text(encoding="utf-8")
    self.assertIn('fill="#FFFFFF"', github)
    self.assertNotIn('fill="#1b1f23"', github)
```

Add a test that parses `docs/demo.js` and asserts the landing script has no selectors or state keys for `#lcm-panel`, `.credit-monitor`, `[data-view]`, `[data-theme]`, `used`, `limit`, `remaining`, `palette`, or `sync`.

- [ ] **Step 2: Run the focused tests and confirm they fail against the fake demo**

```powershell
python -m unittest tests.test_docs_interface -v
```

Expected: failures identify external product controls, fake markup/state, missing iframes, and missing brand assets.

- [ ] **Step 3: Normalize and install the GitHub asset**

Use `apply_patch` to preserve the supplied `viewBox`, path `d`, and fill rules while changing the visible path from `#1b1f23` to `#FFFFFF`. Do not apply filters, gradients, masks, or cyan tint.

- [ ] **Step 4: Replace landing HTML with the approved evidence journey**

Keep the existing direction-contract comment as the first body child but update `FIRST VIEWPORT` to name the live runtime iframe. Build semantic sections in this order: `top`, `mechanism`, `demo`, `features`, `privacy`, `install`, final action. Preserve factual version/download/disclaimer copy and all existing public routes.

Hero iframe requirements:

```html
<iframe
  class="hero-runtime-frame"
  src="demo/index.html?surface=hero"
  title="Credit Monitor interface preview"
  tabindex="-1"
  aria-hidden="true"
  loading="eager">
</iframe>
```

The frame wrapper also receives `inert`, and CSS in Task 5 applies `pointer-events: none`. The main frame has no `inert`, no `aria-hidden`, and no negative tabindex:

```html
<iframe
  class="interactive-runtime-frame"
  src="demo/index.html?surface=interactive"
  title="Interactive Credit Monitor demo"
  loading="lazy">
</iframe>
```

Use filled Boxicon paths for every landing interface icon and the supplied brand assets for Lovable/GitHub. Remove the entire fake monitor DOM and all external product controls.

- [ ] **Step 5: Replace fake-demo JavaScript without losing unrelated behavior**

Do not edit `docs/demo.js` yet beyond removing fake state and fake interaction functions; Task 5 adds landing-only behavior test-first. Delete `tests/demo_interaction.test.mjs` only after `tests/test_docs_interface.py` passes the new ownership tests.

- [ ] **Step 6: Turn markup/ownership tests green**

```powershell
python -m unittest tests.test_docs_interface -v
python scripts/verify_repository.py
```

- [ ] **Step 7: Commit the truthful landing structure**

```powershell
git add docs/index.html docs/assets/github.svg docs/demo.js tests/test_docs_interface.py
git rm --cached --ignore-unmatch tests/demo_interaction.test.mjs
git commit -m "feat: embed real runtime in Credit Monitor landing"
```

---

### Task 5: Landing motion, responsive framing, and accessible interaction polish

**Files:**
- Modify: `docs/styles.css`
- Modify: `docs/demo.js`
- Modify: `tests/test_docs_interface.py`
- Create: `tests/landing_motion.test.mjs`

**Interfaces:**
- Produces: landing-only reveal/parallax behavior using `.reveal`, `[data-parallax]`, and IntersectionObserver.
- Does not consume or mutate iframe document state.

- [ ] **Step 1: Write failing motion and style contract tests**

Add Python style-boundary tests for `.hero-runtime-frame { pointer-events: none; }`, 44 px controls, `overflow-x: clip`, responsive iframe scaling at 768/430/375 widths, pure-white GitHub icon treatment, and reduced-motion overrides for parallax/orbit/reveal translation.

Create `tests/landing_motion.test.mjs` with a small fake document/IntersectionObserver. Assert that the real `docs/demo.js`:

- marks intersecting `.reveal` elements visible;
- leaves all content visible when IntersectionObserver is unavailable;
- applies pointer parallax only to `[data-parallax]` on fine-pointer devices;
- never queries inside an iframe or references Credit Monitor state;
- performs no work when reduced motion matches.

The mutation caught by each test is a broken reveal fallback, reduced-motion violation, or accidental landing ownership of runtime state.

- [ ] **Step 2: Run tests and confirm the current landing behavior fails**

```powershell
python -m unittest tests.test_docs_interface -v
node --test tests/landing_motion.test.mjs
```

- [ ] **Step 3: Implement the established Instrument Panel visual system**

Rebuild `docs/styles.css` around the documented tokens: `#06090d`, `#091019`, `#0b121b`, `#101a26`, `#f4f9fc`, `#9aabba`, `#42d7ff`, `#2878ff`, and `#57d6a1`. Use evidence rails and tonal surfaces instead of generic card grids. Keep cyan scarce and green confirmation-only.

Required frame behavior:

```css
.hero-runtime-frame {
  pointer-events: none;
  user-select: none;
}

.demo-frame {
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .instrument-orbit,
  .telemetry-pulse { animation: none; }
  .reveal { opacity: 1; transform: none; transition: none; }
  [data-parallax] { transform: none !important; }
}
```

Use only opacity/transform for continuous/reveal motion. Ensure source/download buttons lift 1–2 px, press back to baseline, and retain visible focus. Keep the GitHub image itself white in all pseudo/state selectors.

- [ ] **Step 4: Implement landing-only JavaScript**

`docs/demo.js` should initialize reveal observers, subtle hero perspective on fine-pointer desktop, and anchor scrolling. Gate continuous effects with `matchMedia('(prefers-reduced-motion: reduce)')`. Never use `iframe.contentDocument`, `postMessage`, Chrome APIs, runtime selectors, or product state keys.

- [ ] **Step 5: Turn motion/style tests green and run the full suite**

```powershell
node --test tests/demo_adapter.test.mjs tests/landing_motion.test.mjs
python -m unittest discover -s tests -v
python scripts/sync_demo_runtime.py --check
python scripts/verify_repository.py
```

- [ ] **Step 6: Commit landing presentation**

```powershell
git add docs/styles.css docs/demo.js tests/test_docs_interface.py tests/landing_motion.test.mjs
git commit -m "feat: animate and adapt real runtime landing"
```

---

### Task 6: Repository truth, documentation, and complete static verification

**Files:**
- Modify: `scripts/verify_repository.py`
- Modify: `tests/test_verify_repository.py`
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Modify: `.impeccable/surfaces/docs-index-html.md`

**Interfaces:**
- Produces: repository verification that resolves nested demo references, forbids network escape, validates brand assets, and proves runtime mirror hashes.

- [ ] **Step 1: Write failing repository verification cases**

Add temporary-fixture tests that prove verification fails when:

- an iframe `src` escapes `docs/`;
- `docs/demo/index.html` references a missing runtime file;
- `demo-adapter.js` gains `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or a remote URL;
- a generated runtime byte changes;
- the GitHub visible path is not `#FFFFFF`;
- the ZIP name or required contents change.

Add a passing test for the complete current repository.

- [ ] **Step 2: Run focused verification tests and confirm the missing checks fail**

```powershell
python -m unittest tests.test_verify_repository -v
```

- [ ] **Step 3: Extend verification without weakening existing checks**

Teach asset-reference validation to recursively inspect both `docs/index.html` and `docs/demo/index.html`, resolving each URL relative to its owning document. Keep the existing no-network/analytics rules and extend them to `docs/demo/demo-adapter.js` and the iframe HTML. Call the shared raw-byte `verify_runtime()` function and report mismatches through the existing `fail()` path.

Verify `docs/assets/lovable.svg` matches the approved supplied SVG geometry/paint digest recorded in the verifier/test fixture, and inspect `docs/assets/github.svg` for the preserved viewBox/path geometry plus pure-white fill. Do not require external attachment paths at future verification time.

- [ ] **Step 4: Update durable product/design truth**

Update `PRODUCT.md` to say the public demo uses the real mirrored interface/runtime with simulated in-memory usage and no Lovable connection. Update `DESIGN.md` only with the completed hero/demo framing, real-runtime ownership, supplied brand-asset, filled-Boxicon, disciplined-motion, and reduced-motion rules. Update the surface brief so proof now names the real runtime rather than a fictional reimplementation.

- [ ] **Step 5: Run complete non-browser verification**

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tests -v
python scripts/sync_demo_runtime.py --check
python scripts/verify_repository.py
git diff --exit-code -- manifest.json src docs/downloads/lovable-credit-monitor-v0.7.2.zip
```

The final `git diff` command is expected to show no changes for protected extension/distribution paths.

- [ ] **Step 6: Commit repository truth and docs**

```powershell
git add scripts/verify_repository.py tests/test_verify_repository.py PRODUCT.md DESIGN.md .impeccable/surfaces/docs-index-html.md
git commit -m "docs: record real runtime demo contract"
```

---

### Task 7: Browser interaction matrix, visual finish, and final verification

**Files:**
- Modify if findings require one bounded batch: `docs/index.html`, `docs/styles.css`, `docs/demo.js`, `docs/demo/index.html`, `docs/demo/demo-workspace.css`, `docs/demo/demo-adapter.js`, and corresponding tests first.
- Update captures: `.impeccable/review/desktop.png`, `.impeccable/review/mobile.png`, plus required-width captures.

**Interfaces:**
- Consumes: locally served `docs/` site.
- Produces: browser evidence for the complete acceptance matrix and final reviewer packet.

- [ ] **Step 1: Load the craft floor immediately before UI edits**

Read `.agents/skills/impeccable/reference/craft-floor.md` completely, apply its quality floor, and do not modify UI before this point in the execution session.

- [ ] **Step 2: Start a local static server and open the landing**

```powershell
python -m http.server 4173 --directory docs
```

Open `http://127.0.0.1:4173/` with the in-app browser and confirm all requests stay under the local `docs/` origin.

- [ ] **Step 3: Exercise the real runtime inside the main iframe**

At desktop width, interact through the iframe and record each observable result:

1. Initial Full view shows `133` remaining, `91%`, and `1,267 / 1,400`.
2. Change View cycles Full → Compact → Minimal.
3. Minimal single click opens Compact.
4. Return to Minimal, then double-click opens Ring.
5. Ring click returns to Minimal.
6. Full view settings opens the real drawer.
7. Original, Red, Juparanã, and Black & White change `#lcm-panel[data-palette]`.
8. Auto, Light, and Dark change the real runtime theme state.
9. Sync immediately shows syncing/spinning status, then after about 800 ms shows `126`, `91%`, and `1,274 / 1,400` with real count/progress/pulse feedback.
10. Countdown text changes after one second.
11. Drag grip moves the panel and edge clamping keeps it visible.
12. Keyboard navigation reaches real iframe controls; focus is visible.
13. The hero iframe cannot receive pointer input or keyboard focus.

- [ ] **Step 4: Inspect the responsive matrix in one bounded round**

Capture and inspect 1440, 1280, 1024, 768, 430, and 375 px widths. Confirm no horizontal document overflow, minimum 44 px landing controls, readable framed desktop simulation on mobile, correct supplied brand assets, pure-white GitHub mark, and no hidden/half-loaded reveal states.

Emulate reduced motion and confirm landing parallax/orbit/reveal translation stop while state changes remain understandable. Check the browser console after desktop and mobile runs; no errors or unhandled rejections are acceptable.

- [ ] **Step 5: Run one detector pass and one batched correction round**

```powershell
node .agents/skills/impeccable/scripts/detect.mjs --json docs/index.html docs/styles.css docs/demo.js docs/demo/index.html docs/demo/demo-workspace.css
```

For any behavior defect, write and fail a regression test before editing. Apply all material fixes in one batch, rerun the focused tests, then recapture desktop/mobile once. Do not start open-ended polishing.

- [ ] **Step 6: Run the Impeccable finish reviewer and documenter**

Provide the original request, approved spec, direction contract, detector findings, `.impeccable/review/desktop.png`, `.impeccable/review/mobile.png`, required-width captures, and the craft-floor path to the shipped finish reviewer with no inherited conversation history. Follow its `recapture`, `rebuild`, `fix`, or `ship` disposition exactly. After the final correction, run the shipped documenter so `DESIGN.md` records the built surface rather than intention.

- [ ] **Step 7: Run final evidence commands**

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tests -v
python scripts/sync_demo_runtime.py --check
python scripts/verify_repository.py
git diff --check
git diff --exit-code -- manifest.json src docs/downloads/lovable-credit-monitor-v0.7.2.zip
git status --short
```

Read every exit code and full output. Compare final canonical source hashes to Task 1's baseline. Report the exact test counts, repository verifier result, reviewer disposition, browser matrix, protected-file status, and any unrelated pre-existing working-tree changes still present.

- [ ] **Step 8: Commit the verified final batch if corrections were needed**

```powershell
git add docs tests scripts PRODUCT.md DESIGN.md .impeccable/surfaces/docs-index-html.md .impeccable/review
git commit -m "fix: close real runtime landing review"
```

Do not stage unrelated `.agents`, `.codex`, `.opencode`, critique, or capture-part files.
