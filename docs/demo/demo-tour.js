(function attachDemoTour(root) {
  'use strict';

  const params = new root.URLSearchParams(root.location?.search || '');
  const surface = params.get('surface') || 'interactive';
  const SELECTORS = Object.freeze({
    panel: '#lcm-panel',
    mode: '#lcm-panel button[aria-label="Change view"]',
    minimal: '#lcm-panel .lcm-minimal-surface',
    ring: '#lcm-panel .lcm-ring-surface',
    appearance: '#lcm-panel button[aria-label="Appearance"]',
  });
  const TOUR_STEPS = Object.freeze([
    Object.freeze({ target: 'mode', moveMs: 720, pauseMs: 850 }),
    Object.freeze({ target: 'mode', moveMs: 620, pauseMs: 900 }),
    Object.freeze({ target: 'minimal', action: 'dblclick', moveMs: 650, pauseMs: 950 }),
    Object.freeze({ target: 'ring', moveMs: 620, pauseMs: 850 }),
    Object.freeze({ target: 'minimal', moveMs: 620, pauseMs: 1050 }),
    Object.freeze({ target: 'appearance', moveMs: 700, pauseMs: 1200 }),
    Object.freeze({ target: 'appearance', moveMs: 560, pauseMs: 700 }),
  ]);

  function shouldRun(candidateSurface, reducedMotion) {
    return candidateSurface === 'hero' && reducedMotion !== true;
  }

  function shouldRunInteractiveHint(candidateSurface, reducedMotion) {
    return candidateSurface === 'interactive' && reducedMotion !== true;
  }

  const api = Object.freeze({ SELECTORS, TOUR_STEPS, shouldRun, shouldRunInteractiveHint });
  root.LCMDemoTour = api;

  const documentRef = root.document;
  if (!documentRef?.body) return;
  documentRef.body.dataset.surface = surface;

  const reducedMotion = typeof root.matchMedia === 'function'
    && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!shouldRun(surface, reducedMotion) && !shouldRunInteractiveHint(surface, reducedMotion)) return;

  const cursor = documentRef.createElement('span');
  cursor.className = 'demo-guide-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<svg viewBox="0 0 28 32" aria-hidden="true"><path d="M3 2.5 23.2 20l-9.2 1.5 5.1 8-5 2.8-5-8-6 7.2Z" /></svg>';
  documentRef.body.appendChild(cursor);

  let timer = 0;
  let stepIndex = 0;
  let interactiveHintStopped = false;

  function schedule(delay, callback) {
    if (timer) root.clearTimeout(timer);
    timer = root.setTimeout(callback, delay);
  }

  function visibleTarget(selector) {
    const candidates = Array.from(documentRef.querySelectorAll(selector));
    return candidates.find((element) => {
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      const visibility = typeof root.getComputedStyle === 'function'
        ? root.getComputedStyle(element).visibility
        : 'visible';
      return visibility !== 'hidden';
    }) || null;
  }

  function moveCursorTo(element, duration) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + (rect.width * 0.56);
    const y = rect.top + (rect.height * 0.56);
    cursor.style.setProperty?.('--demo-cursor-duration', `${duration}ms`);
    cursor.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    cursor.classList.add('is-visible');
  }

  function pulseCursor() {
    cursor.classList.add('is-clicking');
    root.setTimeout(() => cursor.classList.remove('is-clicking'), 340);
  }

  function activateTarget(element, action = 'click') {
    pulseCursor();
    if (action === 'dblclick' && typeof root.MouseEvent === 'function') {
      element.dispatchEvent?.(new root.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    } else {
      element.click?.();
    }
  }

  function runHeroStep() {
    if (documentRef.hidden) {
      schedule(500, runHeroStep);
      return;
    }

    if (stepIndex >= TOUR_STEPS.length) {
      cursor.classList.remove('is-visible');
      stepIndex = 0;
      schedule(1800, runHeroStep);
      return;
    }

    const step = TOUR_STEPS[stepIndex];
    const target = visibleTarget(SELECTORS[step.target]);
    if (!target) {
      schedule(180, runHeroStep);
      return;
    }

    moveCursorTo(target, step.moveMs);
    schedule(step.moveMs, () => {
      activateTarget(target, step.action);
      stepIndex += 1;
      schedule(step.pauseMs, runHeroStep);
    });
  }

  function stopInteractiveHint(panel) {
    interactiveHintStopped = true;
    if (timer) root.clearTimeout(timer);
    cursor.classList.remove('is-visible', 'is-clicking');
    panel?.classList?.remove('demo-interaction-focus');
  }

  function runInteractiveHint() {
    if (interactiveHintStopped) return;
    if (documentRef.hidden) {
      schedule(500, runInteractiveHint);
      return;
    }

    const panel = visibleTarget(SELECTORS.panel);
    const target = visibleTarget(SELECTORS.mode);
    if (!panel || !target) {
      schedule(180, runInteractiveHint);
      return;
    }

    if (panel.dataset.demoHintBound !== 'true') {
      panel.dataset.demoHintBound = 'true';
      panel.addEventListener?.('pointerdown', () => stopInteractiveHint(panel), { once: true });
      panel.addEventListener?.('keydown', () => stopInteractiveHint(panel), { once: true });
    }

    panel.classList.add('demo-interaction-focus');
    moveCursorTo(target, 760);
    schedule(760, () => {
      pulseCursor();
      root.setTimeout(() => {
        if (interactiveHintStopped) return;
        cursor.classList.remove('is-visible');
        panel.classList.remove('demo-interaction-focus');
        schedule(5200, runInteractiveHint);
      }, 520);
    });
  }

  documentRef.addEventListener?.('visibilitychange', () => {
    if (documentRef.hidden) return;
    if (shouldRun(surface, reducedMotion) && stepIndex === 0) schedule(500, runHeroStep);
    if (shouldRunInteractiveHint(surface, reducedMotion) && !interactiveHintStopped) schedule(700, runInteractiveHint);
  });

  if (shouldRun(surface, reducedMotion)) schedule(1200, runHeroStep);
  if (shouldRunInteractiveHint(surface, reducedMotion)) schedule(900, runInteractiveHint);
})(globalThis);
