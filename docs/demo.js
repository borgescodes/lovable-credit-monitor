(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  document.querySelectorAll('main > .section:not(.hero), .site-footer').forEach((element) => {
    element.classList.add('reveal');
  });
  document.querySelectorAll('.hero-runtime-shell').forEach((element) => {
    element.setAttribute('data-parallax', '');
  });

  const revealElements = Array.from(document.querySelectorAll('.reveal'));
  const showReveal = (element) => {
    element.classList.remove('is-pending');
    element.classList.add('is-visible');
  };

  if (typeof window.IntersectionObserver !== 'function') {
    revealElements.forEach(showReveal);
  } else {
    const revealObserver = new window.IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        showReveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    revealElements.forEach((element) => {
      element.classList.add('is-pending');
      revealObserver.observe(element);
    });
  }

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const parallaxElements = Array.from(document.querySelectorAll('[data-parallax]'));
    let animationFrame = 0;

    window.addEventListener('pointermove', (event) => {
      if (animationFrame) return;
      animationFrame = 1;
      window.requestAnimationFrame(() => {
        const horizontal = (event.clientX / window.innerWidth - 0.5) * 5;
        const vertical = (event.clientY / window.innerHeight - 0.5) * -4;
        parallaxElements.forEach((element) => {
          element.style.transform = `perspective(1200px) rotateX(${vertical.toFixed(2)}deg) rotateY(${horizontal.toFixed(2)}deg)`;
        });
        animationFrame = 0;
      });
    });

    window.addEventListener('pointerleave', () => {
      parallaxElements.forEach((element) => {
        element.style.transform = '';
      });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    if (anchor.classList.contains('skip-link')) return;
    anchor.addEventListener('click', (event) => {
      const target = document.getElementById(anchor.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
