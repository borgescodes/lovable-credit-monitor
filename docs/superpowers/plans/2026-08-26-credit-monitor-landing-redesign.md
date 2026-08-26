# Credit Monitor Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the static Credit Monitor landing page as an Instrument Panel / Confidence Layer that clarifies the product mechanism, privacy boundary, and manual installation without changing extension behavior.

**Architecture:** Keep the site dependency-free and static. Replace the landing markup and styles in place, retain `docs/demo.js` as the existing fictional-demo state controller unless an accessibility defect requires a minimal patch, and add repository-level contract tests that validate the redesigned information architecture and CSS quality floor.

**Tech Stack:** Semantic HTML5, modern CSS, vanilla JavaScript, Python `unittest`, Impeccable detector, in-app browser inspection.

**Spec:** `docs/superpowers/specs/2026-08-26-credit-monitor-landing-redesign-design.md`

## Global Constraints

- Preserve extension source under `src/`, Manifest permissions, sync logic, storage behavior, credit calculations, view semantics, positioning behavior, and release ZIP contents.
- Preserve v0.7.2, the existing download filename, Chrome/Edge scope, the affiliation disclaimer, and all privacy facts.
- Keep all landing-page copy in English.
- Use only HTML/CSS for installation illustrations; do not imply that they are real browser screenshots.
- Keep the demo fictional, static, and disconnected from Lovable and extension APIs.
- Add no remote font, analytics, runtime, or asset dependency.
- Meet WCAG AA text contrast, 44px mobile touch targets, keyboard access, visible focus, reduced motion, and 320px minimum-width support.
- Use at most two batched screenshot/repair rounds for the complete desktop/mobile finish cycle.

## File Structure

- `docs/index.html`: semantic content, direction contract, confidence journey, interactive demo markup, installation illustrations, and verified product copy.
- `docs/styles.css`: Instrument Panel visual system, responsive layouts, accessible states, and motion grammar.
- `docs/demo.js`: existing demo state transitions; modify only if browser verification exposes an accessibility issue.
- `tests/test_docs_interface.py`: static contract tests for content structure, installation guidance, demo choices, CSS quality, and prohibited dependencies.
- `DESIGN.md`: generated after the final visual review from the implementation that actually ships.
- `.impeccable/review/desktop.png`: validated desktop capture at 1440px.
- `.impeccable/review/mobile.png`: validated mobile capture at 390px.

---

### Task 1: Encode the Confidence Journey in Semantic HTML

**Files:**

- Create: `tests/test_docs_interface.py`
- Modify: `docs/index.html`
- Verify unchanged: `docs/demo.js`

**Interfaces:**

- Consumes: the existing download path `downloads/lovable-credit-monitor-v0.7.2.zip`, logo path `assets/credit-monitor-default.svg`, and demo selectors `[data-view]`, `[data-theme]`, `[data-value]`, `[data-progress]`, and `[data-ring]`.
- Produces: stable section anchors `#mechanism`, `#demo`, `#privacy`, and `#install`; installation structure `.install-walkthrough`; direction seed `690409fa`; unchanged demo control values `full`, `compact`, `minimal`, `ring`, `original`, `red`, `juparana`, and `mono`.

- [ ] **Step 1: Write failing landing structure tests**

Create `tests/test_docs_interface.py` with the exact initial contract:

```python
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "docs" / "index.html"
CSS_PATH = ROOT / "docs" / "styles.css"
JS_PATH = ROOT / "docs" / "demo.js"


class LandingStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = HTML_PATH.read_text(encoding="utf-8")
        cls.css = CSS_PATH.read_text(encoding="utf-8")
        cls.js = JS_PATH.read_text(encoding="utf-8")

    def test_direction_contract_survives_in_html(self):
        for marker in ("THESIS:", "OWN-WORLD:", "STORY:", "FIRST VIEWPORT:", "FORM:", "FINISH:"):
            self.assertIn(marker, self.html)
        self.assertIn("690409fa", self.html)

    def test_confidence_journey_has_stable_sections(self):
        for section_id in ("mechanism", "demo", "privacy", "install"):
            self.assertRegex(self.html, rf'<section[^>]+id="{section_id}"')

    def test_installation_walkthrough_is_truthful_and_actionable(self):
        self.assertIn('class="install-walkthrough"', self.html)
        self.assertIn("Desktop Chrome or Edge", self.html)
        self.assertIn("Developer mode", self.html)
        self.assertIn("Load unpacked", self.html)
        self.assertIn("manifest.json", self.html)
        self.assertIn("not listed in the Chrome Web Store or Edge Add-ons", self.html)

    def test_demo_preserves_all_existing_choices(self):
        for value in ("full", "compact", "minimal", "ring"):
            self.assertRegex(self.html, rf'data-view="{value}"')
        for value in ("original", "red", "juparana", "mono"):
            self.assertRegex(self.html, rf'data-theme="{value}"')
        self.assertIn("All values are fictional", self.html)

    def test_static_site_does_not_gain_remote_dependencies(self):
        self.assertNotRegex(self.html, r'<script[^>]+src="https?://')
        self.assertNotRegex(self.html, r'<link[^>]+href="https?://')
        self.assertNotRegex(self.css, r'@import\s+url\(["\']?https?://')


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests and verify they fail for the missing redesign contract**

Run:

```powershell
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests.test_docs_interface -v
```

Expected: FAIL in `test_direction_contract_survives_in_html`, `test_confidence_journey_has_stable_sections`, and `test_installation_walkthrough_is_truthful_and_actionable` because the incumbent page does not contain the new contract or structures.

- [ ] **Step 3: Replace the landing information architecture**

Edit `docs/index.html` and preserve the exact direction comment as the first child of `<body>`:

```html
<!--
THESIS: Credit usage becomes a calm instrument reading, not another generic extension landing page.
OWN-WORLD: Near-black instrument surfaces, cyan active telemetry, green confirmation, concentric credit rings, measurement ticks, evidence rails, and tabular numerals.
STORY: See remaining credits, understand the People-to-local-storage path, explore the monitor, then install with visual proof and recovery guidance.
FIRST VIEWPORT: A concise offer and download action sit left of an oversized monitor-in-workspace instrument; a trust rail closes the viewport.
FORM: Instrument Panel / Confidence Layer, user-pinned direction, seed 690409fa.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->
```

Use this semantic section order and these stable navigation labels:

```html
<header class="site-header">
  <a class="brand-lockup" href="#top" aria-label="Credit Monitor home">Credit Monitor</a>
  <nav class="header-actions" aria-label="Primary navigation">
    <a href="#demo">Demo</a><a href="#privacy">Privacy</a><a href="#install">Install</a>
    <a href="https://github.com/borgescodes/lovable-credit-monitor">View source</a>
  </nav>
</header>
<main id="main">
  <section class="hero section" id="top"></section>
  <section class="mechanism-section section" id="mechanism"></section>
  <section class="demo-section section" id="demo"></section>
  <section class="capabilities-section section" id="features"></section>
  <section class="privacy-section section" id="privacy"></section>
  <section class="install-section section" id="install"></section>
  <section class="final-cta section"></section>
</main>
<footer class="site-footer">
  <p>Unofficial independent project. Not affiliated with or endorsed by Lovable.</p>
  <a href="https://github.com/borgescodes">Built by Pedro Borges</a>
</footer>
```

Populate the hero with the verified offer, existing download URL, existing workspace/monitor composition, and a trust rail containing Chrome & Edge, local-only state, no account required, and unofficial distribution. Populate `#mechanism` with the exact People → local storage → workspace sequence from the spec. Move the existing demo subtree into `#demo` without renaming any JavaScript selectors. Populate the remaining sections with the exact capability, privacy, installation, and final-action content from the approved spec.

For the illustrated installation walkthrough, use three semantic articles with code-native browser/folder shapes:

```html
<div class="install-walkthrough" aria-label="Illustrated manual installation guide">
  <article class="install-step" data-step="01">
    <div class="install-illustration download-illustration" aria-hidden="true">
      <span class="archive-chip">ZIP</span><span class="illustration-arrow">→</span>
      <span class="folder-shape"><i></i><b>manifest.json</b></span>
    </div>
    <h3>Download and extract</h3>
    <p>Keep the extracted folder—the one containing <code>manifest.json</code>—in a permanent location.</p>
  </article>
  <article class="install-step" data-step="02">
    <div class="install-illustration browser-illustration" aria-hidden="true">
      <span class="browser-address">chrome://extensions</span>
      <span class="developer-toggle">Developer mode <i></i></span>
    </div>
    <h3>Open Extensions</h3>
    <p>Open <code>chrome://extensions</code> or <code>edge://extensions</code>, then enable <strong>Developer mode</strong>.</p>
  </article>
  <article class="install-step" data-step="03">
    <div class="install-illustration result-illustration" aria-hidden="true">
      <span class="load-unpacked-control">Load unpacked</span>
      <span class="extension-result"><img src="assets/credit-monitor-default.svg" alt="" />Credit Monitor <b>Enabled</b></span>
    </div>
    <h3>Load the folder</h3>
    <p>Choose <strong>Load unpacked</strong> and select the extracted folder that contains <code>manifest.json</code>.</p>
  </article>
</div>
```

State verbatim that the installation requires **Desktop Chrome or Edge** and that the project is **not listed in the Chrome Web Store or Edge Add-ons**. Keep the existing download link and source URL unchanged.

- [ ] **Step 4: Run the structure and existing repository tests**

Run:

```powershell
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests.test_docs_interface tests.test_verify_repository -v
```

Expected: all landing structure tests and the existing static-demo test PASS.

- [ ] **Step 5: Run the publication verifier**

Run:

```powershell
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/verify_repository.py
```

Expected: exit 0 with manifest, hash, ZIP, demo reference, static-demo, secret-scan, and README checks reporting success.

- [ ] **Step 6: Commit the semantic redesign**

```powershell
git add -- docs/index.html tests/test_docs_interface.py
git commit -m "feat: restructure landing confidence journey"
```

---

### Task 2: Build the Instrument Panel Visual System

**Files:**

- Modify: `tests/test_docs_interface.py`
- Modify: `docs/styles.css`

**Interfaces:**

- Consumes: semantic classes and IDs produced by Task 1.
- Produces: CSS tokens `--page`, `--panel`, `--panel-raised`, `--line`, `--text`, `--muted`, `--cyan`, `--green`, `--touch-target`, and `--max`; responsive layouts at 980px, 700px, and 430px; transform/opacity motion only.

- [ ] **Step 1: Add failing CSS quality-floor tests**

Append to `tests/test_docs_interface.py`:

```python
class LandingStyleContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.css = CSS_PATH.read_text(encoding="utf-8")

    def test_touch_target_token_is_44px(self):
        self.assertRegex(self.css, r'--touch-target:\s*44px')

    def test_layout_width_is_not_animated(self):
        transitions = re.findall(r'transition\s*:[^;]+;', self.css)
        self.assertTrue(transitions)
        for declaration in transitions:
            self.assertNotRegex(declaration, r'\bwidth\b')

    def test_reduced_motion_is_supported(self):
        self.assertIn("@media (prefers-reduced-motion: reduce)", self.css)
        self.assertIn("animation: none", self.css)

    def test_instrument_system_has_required_components(self):
        for selector in (".trust-rail", ".evidence-rail", ".instrument-plate", ".install-illustration"):
            self.assertIn(selector, self.css)

    def test_mobile_layout_covers_430px(self):
        self.assertIn("@media (max-width: 430px)", self.css)
```

- [ ] **Step 2: Run the CSS tests and verify they fail**

Run:

```powershell
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests.test_docs_interface.LandingStyleContractTests -v
```

Expected: FAIL for the missing `--touch-target`, new component selectors, and remaining width transitions.

- [ ] **Step 3: Replace the page-level tokens and component grammar**

Rebuild `docs/styles.css` around this exact token foundation:

```css
:root {
  color-scheme: dark;
  --page: #06090d;
  --page-raised: #091019;
  --panel: #0b121b;
  --panel-raised: #101a26;
  --line: rgba(154, 196, 224, 0.18);
  --line-strong: rgba(154, 212, 239, 0.34);
  --text: #f4f9fc;
  --muted: #9aabba;
  --faint: #687887;
  --cyan: #42d7ff;
  --cyan-deep: #2878ff;
  --green: #57d6a1;
  --danger: #ff6577;
  --touch-target: 44px;
  --max: 1180px;
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  font-family: "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
}
```

Use `ui-monospace, "SFMono-Regular", Consolas, monospace` only for telemetry labels, versioning, code, permissions, and tabular values. Remove the full-page generic grid. Create instrument identity with bounded measurement ticks, concentric rings, evidence lines, and opaque plates attached to meaningful sections.

Implement `.trust-rail`, `.evidence-rail`, `.instrument-plate`, and `.install-illustration` as structural components. Do not turn every section into a rounded card; use borders and surface changes only where they explain containment or sequence.

- [ ] **Step 4: Implement responsive and accessible interaction styling**

Set every `.segmented button`, `.theme-chip`, navigation control, and installation action to `min-height: var(--touch-target)`. At 700px and below, stack the demo control groups and allow their buttons to wrap. At 430px and below, use two-column choice grids so all options remain visible without horizontal scrolling.

Use the following motion rule:

```css
.credit-monitor,
.monitor-view,
.button,
.theme-chip,
.segmented button {
  transition-property: transform, opacity, color, background-color, border-color, box-shadow;
  transition-duration: 180ms;
  transition-timing-function: cubic-bezier(.2, .8, .2, 1);
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation: none !important;
    transition-duration: 0.001ms !important;
  }
}
```

Remove every transition declaration containing `width`. Keep progress changes functional as immediate width updates and retain ring progress through `stroke-dashoffset`.

- [ ] **Step 5: Run CSS and full static tests**

Run:

```powershell
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests.test_docs_interface tests.test_verify_repository -v
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/verify_repository.py
```

Expected: all tests PASS and the repository verifier exits 0.

- [ ] **Step 6: Commit the visual system**

```powershell
git add -- docs/styles.css tests/test_docs_interface.py
git commit -m "feat: add instrument panel visual system"
```

---

### Task 3: Audit, Polish, and Document the Shipping Surface

**Files:**

- Modify if required by evidence: `docs/index.html`
- Modify if required by evidence: `docs/styles.css`
- Modify only for demonstrated accessibility defects: `docs/demo.js`
- Modify if required by fixes: `tests/test_docs_interface.py`
- Create: `.impeccable/review/desktop.png`
- Create: `.impeccable/review/mobile.png`
- Create: `DESIGN.md`

**Interfaces:**

- Consumes: the complete landing build and direction contract from Tasks 1–2.
- Produces: verified desktop/mobile captures, one detector result, a finish-review disposition, and durable design-system documentation.

- [ ] **Step 1: Run the full pre-browser verification suite**

Run:

```powershell
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests -v
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/verify_repository.py
git diff --check
```

Expected: zero test failures, verifier exit 0, and no whitespace errors.

- [ ] **Step 2: Start a temporary static server and inspect one batched browser round**

Serve `docs/` from `http://127.0.0.1:4173/` using Node's built-in HTTP modules. In a fresh browser tab, inspect:

- 1440px desktop: first viewport, evidence rail, demo, privacy, installation, and final action.
- 390px mobile: reading order, 44px targets, demo wrapping, installation illustrations, and footer.
- 320px mobile: `document.documentElement.scrollWidth <= window.innerWidth`.
- Keyboard: skip link, navigation, all demo controls, download links, and visible focus.
- Demo: every view and palette updates the monitor and `aria-pressed` state.
- Reduced motion: emulate `prefers-reduced-motion: reduce` and confirm nonessential animation stops.

Save valid full-page captures from the document top as `.impeccable/review/desktop.png` and `.impeccable/review/mobile.png`. Open each saved image once and confirm it is neither blank nor partially loaded. Stop the temporary server after capture.

- [ ] **Step 3: Run the Impeccable audit and detector once**

Load and follow `.agents/skills/impeccable/reference/audit.md`, then run:

```powershell
node .agents/skills/impeccable/scripts/detect.mjs --json docs
```

Treat exit 2 as findings, not command failure. Record exact rule names and locations. Fix mechanical accessibility, responsive, performance, and design-detector findings in one batch; document any intentional false positive.

- [ ] **Step 4: Run the Impeccable polish pass**

Load and follow `.agents/skills/impeccable/reference/craft-floor.md` immediately before UI edits and `.agents/skills/impeccable/reference/polish.md` for the final quality pass. Compare both captures against the direction contract. Fix hierarchy, typography, spacing rhythm, touch comfort, awkward wrapping, and any remaining generic visual tells in one batch.

Do not change extension behavior, product facts, download targets, or the demo's eight outcomes during polish.

- [ ] **Step 5: Confirm with the second and final screenshot round**

Repeat the 1440px and 390px captures over the same files. Reopen both screenshots and confirm that every named audit/polish defect is visibly resolved. Do not start a third self-polish loop.

- [ ] **Step 6: Dispatch the required finish reviewer**

Spawn the Impeccable finish reviewer in a fresh, non-forked context with:

- Original request and approved A+A+A choices.
- Target `docs/index.html`.
- Desktop and mobile screenshot paths.
- Direction contract and seed `690409fa`.
- Detector findings and intentional exceptions.
- Craft-floor reference path.
- No approved raster comp because this is code-first.

If the disposition is `fix`, apply one batched fix, recapture the same viewports, and request a verdict on the named fixes. Follow `recapture`, `rebuild`, or `ship` exactly as defined by the Impeccable workflow.

- [ ] **Step 7: Document the built design system**

After the final correction, dispatch the Impeccable documenter with the project root, `docs/index.html`, direction contract, `PRODUCT.md`, and `.agents/skills/impeccable/reference/document.md`. Verify that it writes `DESIGN.md` from the shipped implementation rather than the pre-build intention.

- [ ] **Step 8: Run final completion verification**

Run fresh:

```powershell
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests -v
& 'C:\Users\pedro.borges\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/verify_repository.py
git diff --check
git status --short
```

Expected: zero test failures, verifier exit 0, no whitespace errors, and only intentional task files changed.

- [ ] **Step 9: Commit the audited shipping result**

```powershell
git add -- docs/index.html docs/styles.css docs/demo.js tests/test_docs_interface.py DESIGN.md .impeccable/review/desktop.png .impeccable/review/mobile.png
git commit -m "feat: polish credit monitor landing page"
```

Omit `docs/demo.js` from staging when browser evidence did not require a change. Stage only captures and Impeccable artifacts that are intended to be versioned by the repository.
