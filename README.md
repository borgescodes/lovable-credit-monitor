<div align="center">
  <img src="docs/assets/credit-monitor-default.svg" width="110" alt="Credit Monitor logo" />

# Credit Monitor

**A privacy-first, unofficial browser extension for monitoring personal Lovable credit usage without leaving your workspace.**

[Live demo](https://borgescodes.github.io/lovable-credit-monitor/) · [Download v0.7.2](https://borgescodes.github.io/lovable-credit-monitor/downloads/lovable-credit-monitor-v0.7.2.zip) · [Changelog](CHANGELOG.md)

![Version](https://img.shields.io/badge/version-0.7.2-0f172a?style=flat-square)
![Manifest](https://img.shields.io/badge/Chrome-Manifest%20V3-0f172a?style=flat-square&logo=googlechrome)
![License](https://img.shields.io/badge/license-MIT-0f172a?style=flat-square)

</div>

## Overview

Credit Monitor adds a compact usage surface to Lovable and synchronizes your personal monthly credit usage from **Settings > People**. It is designed to stay out of the way: no external server, no analytics, no account system, and no page automation beyond reading the People view that already contains your usage data.

The extension stores its state locally in the browser and can reuse an existing People tab or open one in the background when a manual sync is requested.

> **Unofficial project.** Credit Monitor is an independent project and is not affiliated with or endorsed by Lovable.

## Product demo

The GitHub Pages site provides an interactive, fictional preview of the extension UI. It demonstrates the available views and themes without connecting to Lovable or using browser-extension APIs.

**Demo:** https://borgescodes.github.io/lovable-credit-monitor/

## Highlights

- **Four views:** Full, Compact, Minimal and Ring.
- **Four palettes:** Original, Red, Juparana and Black & White.
- **Adaptive appearance:** Auto, Light and Dark modes.
- **Passive synchronization:** reads the row marked `(you)` from Lovable People settings.
- **Manual Sync:** refreshes the authoritative People usage when requested.
- **Local-first state:** values and UI preferences are stored with `chrome.storage.local`.
- **Edge-aware positioning:** the floating monitor grows inward when it is close to a viewport edge.
- **Refined motion:** short opacity/translate/scale transitions, progress animation and count-up feedback.
- **Reduced motion:** automatically respects `prefers-reduced-motion`.
- **No application interception:** does not hook `fetch`, XHR, keyboard events or Lovable editor routes.

## Privacy and permissions

Credit Monitor has no backend and does not transmit your usage data to a project-owned server.

The extension requests only:

| Permission | Why it is used |
| --- | --- |
| `storage` | Stores the latest usage snapshot, sync state and UI preferences locally. |
| `alarms` | Schedules lightweight synchronization work in the Manifest V3 service worker. |
| `https://lovable.dev/*` | Reads Lovable project and People pages needed to locate your personal usage. |
| `https://*.lovable.dev/*` | Supports Lovable subdomains using the same synchronization flow. |

## Install

### Chrome

1. [Download the latest ZIP](https://borgescodes.github.io/lovable-credit-monitor/downloads/lovable-credit-monitor-v0.7.2.zip).
2. Extract the ZIP to a permanent folder.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked**.
6. Select the extracted folder containing `manifest.json`.

### Edge

1. Download and extract the same ZIP.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the folder containing `manifest.json`.

## How synchronization works

Credit Monitor treats the Lovable **People** screen as the authoritative source. It looks only for the row marked `(you)`, reads the monthly usage and `Credit limit`, then stores the resulting snapshot locally.

When possible, an already-open People tab is reused. Manual Sync can open the People page in the background if no reusable tab exists. Editor, preview and development pages are not reloaded by the extension.

## Repository structure

```text
lovable-credit-monitor/
├── assets/                  # Extension icons and brand asset
├── src/                     # Extension runtime source
├── docs/                    # GitHub Pages product demo
│   ├── assets/
│   ├── downloads/
│   │   └── lovable-credit-monitor-v0.7.2.zip
│   ├── index.html
│   ├── styles.css
│   └── demo.js
├── scripts/                 # Publication-readiness verification
├── manifest.json            # Chrome Extension Manifest V3
├── EXTENSION_README.md      # Original v0.7.2 extension documentation
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Development

The runtime extension source in `manifest.json`, `src/` and `assets/` is imported directly from the supplied v0.7.2 package. Repository presentation files and the Pages demo are intentionally separated from the runtime extension.

To validate the repository before publishing:

```bash
python3 scripts/verify_repository.py
```

The verifier checks manifest metadata, extension source hashes, distribution ZIP boundaries, demo asset references and common accidental-secret patterns.

## Current version

**0.7.2**

See [CHANGELOG.md](CHANGELOG.md) for the verified release history available from the supplied archive.

## License

MIT © 2026 Pedro Borges.

---

Credit Monitor is an unofficial independent tool and is not affiliated with or endorsed by Lovable.
