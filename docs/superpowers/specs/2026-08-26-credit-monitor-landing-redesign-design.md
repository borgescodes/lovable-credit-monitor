# Credit Monitor Landing Page Redesign

## Objective

Redesign the static landing page under `docs/` using the approved **Instrument Panel / Confidence Layer** direction. The result must make the product mechanism immediately understandable, turn privacy into a clear evidence chain, and make manual installation feel bounded and recoverable without changing the browser extension's business rules or runtime behavior.

## Approved Decisions

- Visual direction: Instrument Panel / Confidence Layer.
- Build workflow: code-first.
- Installation proof: illustrated walkthrough authored in HTML/CSS.
- Language: English throughout the landing page.
- Surface mode: Persuade.
- Direction seed: `690409fa`; the user-pinned direction overrides the concept assignment.

## Scope

The implementation may change:

- `docs/index.html` structure, semantic markup, landing-page copy, and illustrative content.
- `docs/styles.css` visual system, layout, responsive behavior, motion, and accessibility styles.
- `docs/demo.js` only when required to preserve or improve presentation-state accessibility for the existing fictional demo.

The implementation must not change:

- Extension source under `src/`.
- Manifest permissions, sync logic, storage behavior, credit calculations, view semantics, or positioning behavior.
- Release archive contents or download filename.
- Product version, affiliation disclaimer, privacy claims, or supported browsers.
- The fictional values and four-view/four-palette behavior of the current demo.

## Design Thesis

Credit Monitor should feel like a trustworthy instrument embedded in a working environment, not a generic neon developer-tool landing page. The page turns every major claim into visible evidence: the opening shows the instrument at work, the synchronization section shows the data path, the privacy section shows the boundary, and the installation section shows the exact manual process and expected result.

The experience rejects a conventional sequence of oversized hero, interchangeable feature cards, and repeated download CTAs. Instead, the page uses a continuous confidence journey:

1. Understand the remaining-credit signal.
2. See the monitor inside the Lovable workspace.
3. Understand where the data comes from and where it stays.
4. Explore display modes without cognitive overload.
5. Complete manual installation with visual guidance and a recovery path.

## Direction Contract

The implementation will place this contract as the first child of `<body>` in `docs/index.html`:

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

## Information Architecture

### 1. Header

Keep the logo and product name. Use compact anchors for Demo, Privacy, and Install plus a restrained source link. On mobile, retain access to Install rather than prioritizing View source alone.

### 2. First Viewport

The left side contains the unofficial-extension status, version, a one-line product hook, plain-language supporting copy, primary download, and secondary demo link. The right side is an oversized workspace/instrument composition using existing product imagery and code-native UI.

A trust rail remains visible at the bottom of the opening composition and states only verified facts: Chrome & Edge, local-only state, no account, and unofficial distribution.

### 3. Mechanism and Evidence

Replace the broad proof strip and part of the feature catalogue with a three-stage data-flow explanation:

1. Credit Monitor reads the signed-in row marked `(you)` from Settings > People.
2. The usage snapshot and preferences remain in `chrome.storage.local`.
3. The monitor renders the remaining-credit signal inside the workspace.

The visual uses a single horizontal evidence rail on desktop and a vertical sequence on mobile. It must not imply real-time network interception or a proprietary backend.

### 4. Interactive Demo

Keep the existing workspace demo and all eight outcomes. Reduce cognitive competition by presenting View as the primary control and Appearance as secondary customization. Mark Full as the recommended starting view. Mobile controls wrap into comfortable 44px targets rather than horizontal ribbons.

The demo remains labeled as fictional and disconnected from Lovable.

### 5. Product Capabilities

Condense six equally weighted cards into three evidence-led capability groups:

- Stay informed: four views and edge-aware placement.
- Stay authoritative: People as the source and manual sync when requested.
- Stay private: local storage, no project backend, and reduced interference.

Supporting details may appear as short telemetry rows rather than separate decorative cards.

### 6. Privacy Boundary

Lead with plain language: the extension reads the user's displayed usage, stores it in the browser, and does not send it to a project-owned service. Follow with the existing focused-permissions proof and four specific non-behaviors. The manifest excerpt remains secondary evidence rather than the headline.

### 7. Installation Walkthrough

Add a pre-install context block that states:

- Desktop Chrome or Edge is required.
- The extension is installed manually and is not listed in either browser store.
- The extracted folder containing `manifest.json` is the folder selected by Load unpacked.

Create three illustrated HTML/CSS frames:

1. Download and extract the ZIP.
2. Open the browser's Extensions page and enable Developer mode.
3. Choose Load unpacked and select the extracted folder containing `manifest.json`.

Finish with a small expected-result panel showing Credit Monitor in the extensions list and a recovery note linking to the repository documentation/source. The illustration must be visibly schematic and must not masquerade as a real browser screenshot.

### 8. Final Action and Footer

The final action pairs the download with a requirements/instructions link instead of repeating two generic CTAs. Keep the unofficial-project disclaimer and author/source attribution.

## Visual System

### Color

- Page ground: near-black navy rather than pure black.
- Primary surface: opaque blue-black instrument panels; avoid broad glassmorphism.
- Active data/action: electric cyan with sufficient contrast.
- Confirmation: green, used only for local/success/synced evidence.
- Supporting text: cool gray with WCAG AA contrast.
- Warm colors appear only inside existing palette demonstrations, not as general brand accents.

### Typography

Use a humanist system sans stack for narrative copy and a system monospace stack for telemetry, versioning, permissions, labels, and tabular values. Do not add a remote font dependency. Headings should use controlled width, strong weight contrast, and less extreme negative tracking than the incumbent hero.

### Components

- Evidence rail: thin structural lines connecting labeled facts.
- Instrument plate: opaque, precise surface containing telemetry or a walkthrough step.
- Credit ring: concentric measurement element for remaining-credit emphasis.
- Telemetry row: label/value pair with tabular numerals.
- Primary action: cyan-filled button used once per major decision region.
- Secondary action: text or outlined control with lower salience.

Repeated content must not become a uniform grid of interchangeable rounded cards.

### Motion

Use one orchestrated reveal grammar based on opacity and transform. Demo state changes may animate scale and opacity but must not transition layout width. Preserve content visibility without JavaScript and disable nonessential animation under `prefers-reduced-motion`.

## Responsive Behavior

- Desktop reference: 1440px wide.
- Mobile reference: 390px wide.
- The first viewport becomes a single-column narrative on narrow screens, with the product instrument still visible before the first major section ends.
- Demo and installation controls use at least 44px touch targets.
- No global horizontal overflow at 320px or wider.
- Evidence rails become vertical sequences without depending on horizontal scrolling.
- Long technical strings wrap safely without shrinking body text below comfortable reading size.

## Accessibility

- Preserve and improve the skip link and semantic landmark structure.
- Keep a single `<h1>` and logical heading order.
- Provide text labels for every functional control.
- Maintain visible `:focus-visible` indicators.
- Use `aria-pressed` for demo choices and ensure selected state is not communicated by color alone.
- Keep decorative diagrams hidden from assistive technology when their meaning is already expressed in adjacent text.
- Meet WCAG AA contrast for body text and controls.
- Respect `prefers-reduced-motion` and browser zoom up to 200%.

## Copy Rules

- English only.
- Use plain language before implementation terminology.
- Preserve factual qualifiers such as unofficial, fictional demo data, and not browser-store listed.
- Do not introduce testimonials, adoption numbers, performance benchmarks, compatibility guarantees, or security certifications.
- Prefer concrete verbs: reads, stores, renders, downloads, extracts, selects.

## Verification Strategy

Implementation is accepted only after:

1. Repository verification passes using the bundled Python runtime or an equivalent available Python executable.
2. Static asset and anchor references resolve.
3. Existing demo choices still produce all four views and four palettes with correct `aria-pressed` state.
4. Browser inspection succeeds at 1440px desktop and 390px mobile, plus a 320px overflow check.
5. Keyboard navigation, focus visibility, heading order, touch-target sizing, and reduced motion are audited.
6. The Impeccable detector runs once on the changed `docs` target and mechanical findings are resolved or documented.
7. A final polish pass compares desktop/mobile captures against the direction contract.
8. The finish reviewer returns a resolved disposition and the built visual system is documented in `DESIGN.md`.

## Acceptance Criteria

- A first-time visitor can identify the product, privacy posture, and primary action in the first viewport.
- Installation prerequisites and the three-step manual process are visually understandable without prior extension-development knowledge.
- The demo is easier to scan on mobile while preserving all existing outcomes.
- Privacy claims progress from plain-language explanation to technical proof.
- The page feels authored around credit instrumentation rather than generic developer-tool decoration.
- No business rule, permission, download target, runtime source file, or extension behavior changes.
