/* Money explosion — fires on dialer page load.
   Spawns ~70 brand-blue dollar bills from screen center with outward
   velocity, gravity pull, random rotation, and fade-out at the edges. */
(() => {
  // Respect reduced-motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Inline SVG — stylized dollar bill in brand colors. One copy per particle
  // is plenty (modern browsers chew through 70 inline SVGs without breaking
  // a sweat).
  const BILL_SVG = `<svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="mbGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1aa3df"/>
        <stop offset="100%" stop-color="#0078ab"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="58" height="28" rx="3" fill="url(#mbGrad)" stroke="rgba(255,255,255,0.18)" stroke-width="0.6"/>
    <circle cx="30" cy="15" r="9" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.6"/>
    <text x="30" y="20.5" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">$</text>
    <text x="6" y="9" font-family="Inter, sans-serif" font-size="4" font-weight="700" fill="rgba(255,255,255,0.7)">FC</text>
    <text x="48" y="26" font-family="Inter, sans-serif" font-size="4" font-weight="700" fill="rgba(255,255,255,0.7)">FC</text>
  </svg>`;

  function explode() {
    const overlay = document.createElement('div');
    overlay.className = 'money-explosion';
    document.body.appendChild(overlay);

    const COUNT = 70;
    const DURATION_MS = 1400;
    const particles = [];

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'money-bill';
      el.innerHTML = BILL_SVG;
      el.style.left = '50%';
      el.style.top  = '50%';
      el.style.width = (54 + Math.random() * 70) + 'px';     // 54-124px wide
      overlay.appendChild(el);

      // Full 360 spread, slight upward bias so they fountain up before falling
      const angle = Math.random() * Math.PI * 2;
      const speed = 750 + Math.random() * 850;                // px/sec
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 350;               // upward boost
      const rotStart = (Math.random() - 0.5) * 120;
      const rotSpeed = (Math.random() - 0.5) * 1440;          // deg/sec

      particles.push({ el, vx, vy, rotStart, rotSpeed });
    }

    const start = performance.now();
    const gravity = 2200;                                     // px/sec^2
    const durSec = DURATION_MS / 1000;

    function frame(now) {
      const elapsed = (now - start);
      if (elapsed >= DURATION_MS) {
        overlay.remove();
        return;
      }
      const t = elapsed / 1000;
      const fadeStart = durSec * 0.6;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const x = p.vx * t;
        const y = p.vy * t + 0.5 * gravity * t * t;
        const r = p.rotStart + p.rotSpeed * t;
        p.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`;
        if (t > fadeStart) {
          p.el.style.opacity = String(Math.max(0, 1 - (t - fadeStart) / (durSec * 0.4)));
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', explode);
  } else {
    explode();
  }
})();
