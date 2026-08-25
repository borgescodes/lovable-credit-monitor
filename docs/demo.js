(() => {
  'use strict';

  const demoState = {
    limit: 100,
    used: 64,
    remaining: 36,
    resetLabel: '6d 18h',
    view: 'full',
    theme: 'original'
  };

  const monitor = document.querySelector('#credit-monitor-demo');
  const viewButtons = Array.from(document.querySelectorAll('[data-view]'));
  const themeButtons = Array.from(document.querySelectorAll('[data-theme]')).filter((node) => node.matches('button'));

  if (!monitor) return;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function usagePercent() {
    if (!demoState.limit) return 0;
    return clamp(Math.round((demoState.used / demoState.limit) * 100), 0, 100);
  }

  function updateValues() {
    const percent = usagePercent();
    const values = {
      remaining: String(demoState.remaining),
      used: String(demoState.used),
      limit: String(demoState.limit),
      percent: `${percent}%`,
      reset: demoState.resetLabel
    };

    Object.entries(values).forEach(([key, value]) => {
      monitor.querySelectorAll(`[data-value="${key}"]`).forEach((node) => {
        node.textContent = value;
      });
    });

    monitor.querySelectorAll('[data-progress]').forEach((node) => {
      node.style.width = `${percent}%`;
    });

    const circumference = 2 * Math.PI * 34;
    const remainingRatio = clamp(demoState.remaining / demoState.limit, 0, 1);
    monitor.querySelectorAll('[data-ring]').forEach((node) => {
      node.style.strokeDasharray = String(circumference);
      node.style.strokeDashoffset = String(circumference * (1 - remainingRatio));
    });
  }

  function setPressed(buttons, activeButton) {
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', button === activeButton ? 'true' : 'false');
    });
  }

  function setView(view, button) {
    if (!['full', 'compact', 'minimal', 'ring'].includes(view)) return;
    demoState.view = view;
    monitor.dataset.view = view;
    setPressed(viewButtons, button);
  }

  function setTheme(theme, button) {
    if (!['original', 'red', 'juparana', 'mono'].includes(theme)) return;
    demoState.theme = theme;
    monitor.dataset.theme = theme;
    setPressed(themeButtons, button);
  }

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view, button));
  });

  themeButtons.forEach((button) => {
    button.addEventListener('click', () => setTheme(button.dataset.theme, button));
  });

  updateValues();
})();
