/* First Class Agency — shared interactions */

(() => {
  // Sticky header scroll state
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 16) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const sheet = document.querySelector('.mobile-nav');
  if (toggle && sheet) {
    toggle.addEventListener('click', () => sheet.classList.toggle('open'));
    sheet.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => sheet.classList.remove('open'))
    );
  }

  // Reveal on scroll
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
  );
  document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => io.observe(el));

  // Hero cursor-follow gradient
  const hero = document.querySelector('.hero');
  if (hero && !window.matchMedia('(pointer: coarse)').matches) {
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      hero.style.setProperty('--mx', `${x}%`);
      hero.style.setProperty('--my', `${y}%`);
    });
  }

  // Magnetic primary CTAs (light effect)
  document.querySelectorAll('.btn--primary, .btn--lg').forEach((btn) => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // Mark active nav link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a, .mobile-nav a, .hub-side a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();
