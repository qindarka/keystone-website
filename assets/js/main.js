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
