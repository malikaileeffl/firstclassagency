/* Money explosion — brand-blue on dialer page load, green when a lead is sold.
   Exposes window.fcaMoneyExplosion(opts?) so other scripts (the disposition
   handler) can fire it on demand. */
(() => {
  // Respect reduced-motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.fcaMoneyExplosion = function () { /* noop in reduced-motion */ };
    return;
  }

  // Color palettes per variant
  const VARIANTS = {
    brand: {
      grad1: '#1aa3df',
      grad2: '#0078ab',
      glow:  'rgba(0, 120, 171, 0.55)',
      label: 'FC',
    },
    sold: {
      grad1: '#4ade80',
      grad2: '#16a34a',
      glow:  'rgba(74, 222, 128, 0.6)',
      label: '$',
    },
  };

  function buildBillSvg(c, gradId) {
    return `<svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c.grad1}"/>
          <stop offset="100%" stop-color="${c.grad2}"/>
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="58" height="28" rx="3" fill="url(#${gradId})" stroke="rgba(255,255,255,0.18)" stroke-width="0.6"/>
      <circle cx="30" cy="15" r="9" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.6"/>
      <text x="30" y="20.5" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">$</text>
      <text x="6" y="9" font-family="Inter, sans-serif" font-size="4" font-weight="700" fill="rgba(255,255,255,0.7)">${c.label}</text>
      <text x="48" y="26" font-family="Inter, sans-serif" font-size="4" font-weight="700" fill="rgba(255,255,255,0.7)">${c.label}</text>
    </svg>`;
  }

  // Run a single explosion. Multiple can be in flight at once — each appends
  // its own overlay and removes it when done.
  function explode(opts) {
    opts = opts || {};
    const variant = VARIANTS[opts.variant] ? opts.variant : 'brand';
    const colors = VARIANTS[variant];
    // Unique gradient ID per run so concurrent overlays don't conflict
    const gradId = 'mbGrad-' + Math.random().toString(36).slice(2, 9);
    const billSvg = buildBillSvg(colors, gradId);

    const overlay = document.createElement('div');
    overlay.className = 'money-explosion';
    document.body.appendChild(overlay);

    const COUNT = opts.count || 150;
    const DURATION_MS = opts.duration || 3200;
    const particles = [];

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'money-bill';
      el.innerHTML = billSvg;
      el.style.left = '50%';
      el.style.top  = '50%';
      el.style.width = (54 + Math.random() * 70) + 'px';
      el.style.filter = `drop-shadow(0 6px 14px ${colors.glow})`;
      overlay.appendChild(el);

      const startOffsetX = (Math.random() - 0.5) * 80;
      const startOffsetY = (Math.random() - 0.5) * 80;

      const angle = Math.random() * Math.PI * 2;
      const speed = 380 + Math.random() * 520;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 220;

      const fluttFreq  = 1.5 + Math.random() * 2.5;
      const fluttAmp   = 18 + Math.random() * 36;
      const fluttPhase = Math.random() * Math.PI * 2;

      const rotStart = (Math.random() - 0.5) * 180;
      const rotSpeed = (Math.random() - 0.5) * 540;
      const flipSpeed = (Math.random() - 0.5) * 540;

      particles.push({
        el, startOffsetX, startOffsetY, vx, vy,
        fluttFreq, fluttAmp, fluttPhase,
        rotStart, rotSpeed, flipSpeed,
      });
    }

    const start = performance.now();
    const gravity = 520;
    const durSec = DURATION_MS / 1000;
    const fadeStart = durSec * 0.7;

    function frame(now) {
      const elapsed = now - start;
      if (elapsed >= DURATION_MS) {
        overlay.remove();
        return;
      }
      const t = elapsed / 1000;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const x = p.startOffsetX + p.vx * t + p.fluttAmp * Math.sin(t * p.fluttFreq + p.fluttPhase);
        const y = p.startOffsetY + p.vy * t + 0.5 * gravity * t * t;
        const rotZ = p.rotStart + p.rotSpeed * t;
        const rotY = p.flipSpeed * t;
        p.el.style.transform =
          `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg)`;
        if (t > fadeStart) {
          p.el.style.opacity = String(Math.max(0, 1 - (t - fadeStart) / (durSec * 0.3)));
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Public — let other scripts trigger explosions on demand
  window.fcaMoneyExplosion = explode;

  // Auto-fire the brand-blue burst when the dialer page mounts
  function autoFire() { explode({ variant: 'brand' }); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoFire);
  } else {
    autoFire();
  }
})();
