// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// Reveal-on-scroll
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && reveals.length) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => io.observe(el));
} else {
  reveals.forEach(el => el.classList.add('visible'));
}

// Year stamp in footer
document.querySelectorAll('[data-year]').forEach(el => {
  el.textContent = new Date().getFullYear();
});

// Pre-select contact form topic from ?topic= query parameter
const topicParam = new URLSearchParams(location.search).get('topic');
if (topicParam) {
  const topicSelect = document.getElementById('topic');
  if (topicSelect) {
    const wanted = topicParam.toLowerCase();
    Array.from(topicSelect.options).forEach(opt => {
      if (opt.value.toLowerCase() === wanted || opt.text.toLowerCase() === wanted) {
        topicSelect.value = opt.value;
      }
    });
  }
}

// Highlight active nav link by current path
const path = location.pathname.replace(/\/$/, '') || '/';
document.querySelectorAll('.nav-links a').forEach(a => {
  const href = a.getAttribute('href') || '';
  const normalized = href.replace(/\/$/, '') || '/';
  if (normalized === path || (path === '/' && normalized === '/index.html')) {
    a.classList.add('active');
  }
});

// "Live" counters on the operations snapshot — each element with
// [data-counter] picks a random starting value between data-min/data-max,
// animates up to it from zero, then ticks +1 at a random interval
// between data-tick-min/data-tick-max (ms).
(function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const fmt = n => n.toLocaleString('en-US');

  counters.forEach(el => {
    const min = parseInt(el.dataset.min, 10);
    const max = parseInt(el.dataset.max, 10);
    const tickMin = parseInt(el.dataset.tickMin, 10) || 10000;
    const tickMax = parseInt(el.dataset.tickMax, 10) || 30000;
    if (Number.isNaN(min) || Number.isNaN(max)) return;

    let current = rand(min, max);

    // Initial roll-up from 0 to `current` (skipped for reduced motion)
    if (reduceMotion) {
      el.textContent = fmt(current);
    } else {
      const duration = 1400;
      const start = performance.now();
      const to = current;
      (function step(t) {
        const p = Math.min((t - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.floor(to * eased));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = fmt(to);
      })(start);
    }

    // Keep ticking while the page is open. Pauses automatically when
    // the tab is hidden (setTimeout throttles), resumes when visible.
    function tick() {
      setTimeout(() => {
        current += 1;
        if (reduceMotion) {
          el.textContent = fmt(current);
        } else {
          // Brief "bump" — gold flash + slight lift, then settle back
          el.style.transition = 'color 0.25s, transform 0.25s';
          el.style.color = '#ffcb55';
          el.style.transform = 'translateY(-3px)';
          el.textContent = fmt(current);
          setTimeout(() => {
            el.style.color = '';
            el.style.transform = '';
          }, 350);
        }
        tick();
      }, rand(tickMin, tickMax));
    }
    setTimeout(tick, 1800); // give the initial roll-up time to finish
  });
})();
