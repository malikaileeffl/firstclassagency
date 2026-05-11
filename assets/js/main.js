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

  // Ambient flow-field particle background — hub pages only.
  // Vanilla port of the React flow-field component, in First Class brand blue.
  if (window.location.pathname.includes('/agent/') &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    mountFlowField();
  }

  function mountFlowField() {
    const wrap = document.createElement('div');
    wrap.className = 'flow-bg';
    wrap.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    document.body.prepend(wrap);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Read theme — affects trail color (the alpha-rect we paint each frame to fade old strokes)
    const themeAttr = () => document.documentElement.getAttribute('data-theme') || 'dark';
    let theme = themeAttr();

    const PARTICLE_COUNT = 500;
    const PARTICLE_COLOR = { r: 0, g: 144, b: 206 };   // #0090ce (brand accent)
    const TRAIL_ALPHA = 0.08;                          // lower = longer trails
    const SPEED = 0.9;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles = [];
    let raf = 0;
    const mouse = { x: -1000, y: -1000 };

    function makeParticle() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        age: 0,
        life: Math.random() * 200 + 100,
      };
    }

    function resetParticle(p) {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
      p.vx = 0; p.vy = 0;
      p.age = 0;
      p.life = Math.random() * 200 + 100;
    }

    function init() {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(makeParticle());
    }

    function step() {
      // Trail-fade rect — colored to match the active theme so old dots blend back into the bg
      if (theme === 'light') {
        ctx.fillStyle = 'rgba(244, 246, 250, ' + TRAIL_ALPHA + ')';
      } else {
        ctx.fillStyle = 'rgba(13, 13, 14, ' + TRAIL_ALPHA + ')';
      }
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Flow-field angle from position (cheap pseudo-noise)
        const angle = (Math.cos(p.x * 0.005) + Math.sin(p.y * 0.005)) * Math.PI;
        p.vx += Math.cos(angle) * 0.2 * SPEED;
        p.vy += Math.sin(angle) * 0.2 * SPEED;

        // Mouse repulsion
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const R = 150;
        if (dist < R) {
          const force = (R - dist) / R;
          p.vx -= dx * force * 0.05;
          p.vy -= dy * force * 0.05;
        }

        // Move + friction
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.95; p.vy *= 0.95;

        // Wrap
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Age + draw with fade-in-out alpha
        p.age++;
        if (p.age > p.life) resetParticle(p);
        const a = 1 - Math.abs((p.age / p.life) - 0.5) * 2;
        ctx.fillStyle = 'rgba(' + PARTICLE_COLOR.r + ',' + PARTICLE_COLOR.g + ',' + PARTICLE_COLOR.b + ',' + a.toFixed(3) + ')';
        ctx.fillRect(p.x, p.y, 1.6, 1.6);
      }

      raf = requestAnimationFrame(step);
    }

    function onMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onLeave() { mouse.x = -1000; mouse.y = -1000; }
    function onResize() { init(); }

    // Re-read theme when it changes (theme.js toggles data-theme on <html>)
    const themeObserver = new MutationObserver(() => { theme = themeAttr(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    init();
    step();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
  }
})();
