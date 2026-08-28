---
name: Credit Monitor
description: A privacy-first Lovable credit monitor presented as a calm desktop instrument panel.
colors:
  page: "#06090d"
  page-raised: "#091019"
  panel: "#0b121b"
  panel-raised: "#101a26"
  line: "rgba(154, 196, 224, 0.18)"
  line-strong: "rgba(154, 212, 239, 0.34)"
  text: "#f4f9fc"
  muted: "#9aabba"
  faint: "#6d7d8c"
  cyan: "#42d7ff"
  cyan-deep: "#2878ff"
  green: "#57d6a1"
  danger: "#ff6577"
typography:
  display:
    fontFamily: "Segoe UI Variable, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 6.8vw, 5.8rem)"
    fontWeight: 760
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Segoe UI Variable, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 4.5rem)"
    fontWeight: 740
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Segoe UI Variable, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.55
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.12em"
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
spacing:
  compact: "10px"
  control: "12px"
  standard: "16px"
  spacious: "28px"
components:
  button-primary:
    backgroundColor: "{colors.cyan}"
    textColor: "#031218"
    rounded: "13px"
    padding: "0 18px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "13px"
    padding: "0 18px"
    height: "44px"
  segmented-active:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  monitor-card:
    backgroundColor: "#0c121c"
    textColor: "#f8fbff"
    rounded: "15px"
    padding: "10px"
---

# Design System: Credit Monitor

## Overview

**Creative North Star: "Instrument Panel / Confidence Layer"**

Credit Monitor renders product truth as a calm technical reading: a deep, desktop-first field of near-black surfaces where remaining credits, status, and proof are easier to inspect than to ignore. The world is precise rather than flashy—measurement ticks, concentric rings, tabular numerals, browser-window framing, and evidence rails make the landing page feel like a trustworthy operating surface.

Cyan is reserved for active telemetry and the primary path forward; green confirms healthy status. Layered panels, restrained glows, and fine blue-gray rules provide hierarchy without turning the page into a generic neon developer-tool landing page. The overall voice remains concise, technically credible, privacy-first, and explicit about limitations.

**Key Characteristics:**

- Near-black instrument surfaces with fine blue-gray evidence lines.
- Cyan active readings and actions; green only for confirmation or healthy status.
- Variable sans headlines paired with tabular monospace labels and values.
- A real mirrored Credit Monitor runtime framed by a clearly fictional workspace; the product interface is proof, not a landing-page reimplementation.
- Dense desktop evidence rails that stack cleanly into an explicit mobile sequence.
- Supplied brand geometry and compact filled Boxicons instead of improvised outline glyphs.

## Colors

The palette is a cool, low-luminance measurement field: tonal surfaces establish confidence, while scarce colored signals communicate state.

### Primary

- **Active Telemetry Cyan:** Used for primary downloads, selected/recommended controls, measurement markers, progress, and keyboard focus.
- **Deep Telemetry Blue:** Extends cyan gradients and the page atmosphere without competing with the active signal.

### Secondary

- **Confirmed State Green:** Used for synced, enabled, and on-track states; it is not a general-purpose action color.
- **Exception Rose:** Reserved for a danger state when the product needs one.

### Neutral

- **Instrument Black:** The page base and deepest recessed field.
- **Raised Black:** A subtly lifted page field for compact controls and inset surfaces.
- **Panel Navy:** The default container surface for windows, cards, and walkthrough illustrations.
- **Raised Panel Navy:** Header bars and selected controls inside a panel.
- **Evidence Line:** Low-contrast dividers that organize dense information without box-heavy UI.
- **Strong Evidence Line:** The more legible boundary for major rails and framed instruments.
- **Calibrated White:** Primary reading and heading text.
- **Measured Gray:** Explanatory copy and secondary interface text.
- **Faint Gray:** Nonessential metadata, ticks, and inactive instrumentation.

### Named Rules

**The Signal Scarcity Rule.** Cyan identifies activity, selection, focus, progress, and the primary action; green identifies a healthy confirmation. Do not use either as broad decorative fill.

**The Evidence-Line Rule.** Prefer low-contrast rules and tonal shifts to hard card outlines. Strong rules frame only consequential rails, instruments, and permission proof.

## Typography

**Display Font:** Segoe UI Variable, with Segoe UI and system sans fallbacks.

**Body Font:** Segoe UI Variable, with Segoe UI and system sans fallbacks.

**Label/Mono Font:** ui-monospace, SFMono-Regular, Consolas, monospace.

**Character:** The variable sans keeps the product readable and compact at large scale; monospace introduces the visual discipline of a measured readout. Tabular numerals prevent numbers, versions, and telemetry from visually jumping as values change.

### Hierarchy

- **Display** (760, `clamp(3.5rem, 6.8vw, 5.8rem)`, 0.99): Hero promise only; tightly tracked and balanced over a maximum 630px measure.
- **Headline** (740, `clamp(2.6rem, 5vw, 4.5rem)`, 0.99): Section promises and privacy statement; compact section headings use the observed smaller clamp.
- **Body** (400, 16px, 1.55): Default reading text; prominent ledes are 18px with 1.7 line-height and stay within 66ch.
- **Label** (700, 10px, `0.12em`, uppercase where specified): Instrument labels, control headings, versions, and sequence numbers.

### Named Rules

**The Readout Rule.** Use monospace for values, labels, URLs, versions, code, and evidence metadata—not for explanatory paragraphs or campaign headlines.

## Layout

The desktop canvas is capped at 1180px and generally uses `calc(100% - 40px)` side gutters. The hero is a two-column composition with a `.92fr / 1.08fr` copy-to-instrument ratio, followed by a four-part trust rail; major sections use 126px top spacing and pair a large promise with concise proof. Its runtime frame is a pointer-inert presentation surface, while the later demo frame remains fully interactive. Both load the same `docs/demo/` document, so scale and framing may change without creating a second product implementation.

Information is organized in equal evidence strips—three-column mechanism, capability, and installation sequences—with 1px dividers carrying most separation. At 980px, the hero and primary content grids become single-column and the trust rail becomes two columns. At 700px, gutters reduce to 28px, evidence strips become a vertical sequence, the workspace sidebar disappears, and controls wrap. At 430px, control choices become two-column grids and the monitor scales from its top-right anchor.

**The Rail-First Rule.** Use a framed or divided rail for ordered proof and comparable facts; reserve broad open space for headings, hero copy, and the final call to action.

## Elevation & Depth

Depth is structural and restrained. The page uses tonal layering first—page, raised page, panel, and raised panel—then applies deep soft black shadows to browser windows, the workspace shell, permissions proof, and the floating monitor. Cyan glows are small, state-bound signal halos rather than ambient decoration.

Motion follows the same discipline: landing reveals, fine-pointer hero perspective, and smooth anchor movement clarify entry or location without animating product state. Continuous landing motion is confined to telemetry/orbit accents and transform/opacity work. When reduced motion is requested, the landing skips enhancement setup, exposes reveal content immediately, removes parallax and decorative animation, and leaves the mirrored runtime's own reduced-motion rules in control of its interface.

### Shadow Vocabulary

- **Instrument lift** (`0 34px 90px rgba(0, 0, 0, .42)`): Main browser-like hero window.
- **Workspace lift** (`0 30px 82px rgba(0, 0, 0, .34)`): Demo workspace shell.
- **Floating monitor lift** (`0 20px 52px rgba(0, 0, 0, .46)`): The movable monitor widget and ring.
- **Primary-action glow** (`0 10px 30px rgba(66, 215, 255, .18)`): Primary action at rest; it grows only on hover.

### Named Rules

**The Contained Glow Rule.** Glows belong to the active control or telemetry marker they explain. Do not wash entire backgrounds or neutral cards in cyan.

**The Ownership-Bound Motion Rule.** The landing may move its own framing and decoration, but it never reaches into the iframe or animates Credit Monitor state. Reduced motion disables nonessential movement at both the landing and runtime boundaries.

## Shapes

The form language pairs softly rounded technical containers with circular readings and dots. Reusable radii are compact at 10px, standard at 16px, and large at 24px; primary buttons use a specific 13px corner and monitor shells use 15px. Pills are reserved for status, progress, and tiny tags, while rings, orbits, marks, and window dots are fully circular.

**The Instrument Geometry Rule.** Use rounded rectangles for surfaces and controls, circles for status or measurement, and thin straight rules for sequence and evidence. Avoid ornamental diagonal clipping or exaggerated glass treatment.

## Components

### Buttons

Calm, compact, and decisively readable at a 44px minimum touch target.

- **Shape:** Gently rounded (13px); small ghost buttons use the compact radius.
- **Primary:** Cyan fill with near-black text, `0 18px` horizontal padding, a right-side icon where a download action benefits from it, and the source’s cyan shadow.
- **Hover / Focus:** Hover lifts 2px and brightens the cyan; focus uses a 2px cyan outline with a 3px offset.
- **Secondary / Ghost:** Panel fill with a fine line border; hover lifts the panel tone and strengthens the border.

### Segmented Controls and Theme Chips

Compact 44px controls let the interactive demo expose real configuration without becoming a form. At rest they are muted and transparent; hover uses the raised panel. The pressed state is text-bright, line-framed, and softly lifted. Palette chips include small circular color evidence rather than large swatches.

### Cards / Containers

Panel navy containers are framed by evidence lines and rounded at 16px or 24px depending on scale. Workspace and browser shells use a raised top bar, a darker internal canvas, and deep structural lift. Internal cards are tonal, not glossy; divider rules describe their hierarchy.

### Navigation

The header is a compact horizontal instrument rail: brand lockup at left, muted text links and a source action at right. The hero label uses the supplied Lovable mark; the source action preserves the supplied GitHub viewBox/path geometry with a pure-white visible fill in every interaction state. Links brighten on hover; on small screens, secondary links and the source action recede while the Install link remains available.

### Credit Monitor Widget

The signature component is the canonical Credit Monitor runtime, mirrored byte-for-byte from `src/` into `docs/demo/runtime/` and hosted inside a simulated in-memory Chrome environment. It is a dark floating meter with a three-dot grip, compact product header, tabular balance, gradient progress, and a status card. Its four real forms—Full, Compact, Minimal, and Ring—preserve the same active-accent and confirmation grammar. The runtime owns monitor markup, state, controls, transitions, and theme tokens; the landing owns only the iframe frame and surrounding proof.

### Evidence Rails

Trust facts, data-path proof, capability evidence, and installation steps share a divided-rail construction. They use order labels, concise headings, fine boundaries, and filled Boxicon geometry whose solid silhouettes remain legible at compact sizes. The installation sequence includes illustrative browser and file-system primitives, never simulated product screenshots presented as documentary evidence.

## Do's and Don'ts

### Do:

- **Do** use the near-black surface stack and blue-gray evidence lines to separate information before introducing another card.
- **Do** reserve cyan for active telemetry, focus, progress, selection, and the primary action; reserve green for a confirmed healthy result.
- **Do** pair large balanced sans headlines with monospace labels, code, URLs, versions, and tabular values.
- **Do** present product proof as bounded, ordered evidence rails or browser/workspace instruments.
- **Do** frame the mirrored runtime as an inert hero presentation and a separate operable demo without crossing the iframe boundary.
- **Do** preserve the supplied Lovable geometry, supplied GitHub geometry with pure-white fill, and filled Boxicon treatment.
- **Do** preserve 44px minimum interactive targets and the observed reduced-motion behavior.

### Don't:

- **Don't** turn the landing page into a generic neon developer-tool interface or use cyan as an all-purpose background color.
- **Don't** add broad ambient glows, frosted-glass effects, or decorative gradients that compete with telemetry.
- **Don't** use green for calls to action or treat status confirmation as a general accent.
- **Don't** replace the evidence rails with testimonial cards, browser-store badges, or unverified social proof.
- **Don't** recreate Credit Monitor markup, controls, state, or motion in landing-page code.
- **Don't** present fictional demo data or HTML/CSS walkthrough illustrations as live product or browser screenshots.
