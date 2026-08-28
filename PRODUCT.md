# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Credit Monitor serves people who build with Lovable in Chrome or Edge and need to keep personal monthly credit usage visible without leaving the workspace. The public landing page must help first-time visitors evaluate an unofficial extension, understand its privacy model, and complete a manual desktop installation with confidence.

## Product Purpose

Credit Monitor adds a compact, movable usage surface to Lovable. It reads the signed-in user's monthly usage and credit limit from Lovable Settings > People, stores the snapshot locally, and keeps remaining credits visible while the user works.

Success means the visitor can quickly understand what the extension does, why its data flow is limited, and how to install it without changing the extension's runtime behavior.

## Positioning

The extension treats Lovable's People screen as the authoritative source, reads only the row marked `(you)`, and keeps its state in `chrome.storage.local`. It does not operate a project-owned backend, intercept application traffic, inject keyboard events, or automate Lovable editor routes.

## Operating Context

- Chrome and Edge desktop browsers using Manifest V3.
- Lovable project workspaces and Settings > People.
- Passive synchronization after relevant Lovable activity and explicit manual sync when requested.
- Direct ZIP distribution followed by Developer mode and Load unpacked installation.
- Four monitor views: Full, Compact, Minimal, and Ring.
- Four palettes: Original, Red, Juparanã, and Black & White, combined with Auto, Light, and Dark appearance modes in the extension runtime.

## Capabilities and Constraints

- The landing page is static HTML, CSS, and JavaScript under `docs/` and is published separately from the extension runtime.
- The public demo runs a byte-for-byte mirror of the real Credit Monitor interface/runtime inside a fictional Lovable workspace. A local adapter supplies fictional usage through simulated, in-memory Chrome storage; the demo never connects to Lovable, a project backend, the network, or a visitor's browser-extension APIs.
- Runtime source, synchronization rules, state semantics, permissions, and extension behavior must remain unchanged unless a presentation defect makes a minimal change necessary.
- The extension is unofficial and independent, with no affiliation or endorsement claim from Lovable.
- The public copy remains entirely in English.
- Installation proof is authored as truthful HTML/CSS illustration; it must not imply browser-store distribution or capabilities the extension does not have.

## Brand Commitments

- Product name: Credit Monitor.
- Existing extension logo assets under `assets/` remain recognizable and unchanged; the landing uses the supplied Lovable mark and the supplied GitHub geometry with its visible path filled pure white.
- Voice: concise, technically credible, calm, privacy-first, and explicit about limitations.
- Approved landing-page direction: Instrument Panel / Confidence Layer.
- The visual identity should feel specific to credit telemetry and trustworthy manual installation, not like a generic neon developer-tool landing page.

## Evidence on Hand

- Real interactive product demo in `docs/demo/`, embedded twice by `docs/index.html`: once as an inert hero presentation and once as the operable main demo.
- Generated runtime mirror in `docs/demo/runtime/`, verified byte-for-byte against `src/panel.css` and the related canonical runtime files.
- Verified permission and synchronization descriptions in `README.md`, `EXTENSION_README.md`, and `manifest.json`.
- Existing downloadable release at `docs/downloads/lovable-credit-monitor-v0.7.2.zip`.
- Existing logo and icon assets in `docs/assets/`.
- No testimonials, usage analytics, customer logos, browser-store listing, compatibility benchmarks, or real installation screenshots are available; future work must not fabricate them.

## Product Principles

1. Show the product mechanism before making broad claims.
2. Translate privacy into plain language, then provide technical proof.
3. Make manual installation understandable, bounded, and recoverable.
4. Keep the extension visible without making it intrusive.
5. Preserve product truth and label all demonstration data as fictional.

## Accessibility & Inclusion

The landing page must support keyboard navigation, visible focus, semantic heading order, WCAG AA text contrast, comfortable mobile touch targets, browser zoom, and `prefers-reduced-motion`. Installation guidance must not assume prior browser-extension development experience.
