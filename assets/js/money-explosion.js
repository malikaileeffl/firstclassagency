/* Money explosion — fires on dialer page load.
   Spawns ~150 brand-blue dollar bills from screen center. After the initial
   burst, gravity is weak and each bill flutters side-to-side and tumbles in 3D
   so they fall like real currency rather than dropping like rocks. */
(() => {
  // Respect reduced-motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Inline SVG — stylized dollar bill in brand colors. One copy per particle.
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

    const COUNT = 150;
    const DURATION_MS = 3200;
    const particles = [];

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'money-bill';
      el.innerHTML = BILL_SVG;
      el.style.left = '50%';
      el.style.top  = '50%';
      el.style.width = (54 + Math.random() * 70) + 'px';     // 54-124px wide
      overlay.appendChild(el);

      // Small initial scatter from center so they don't all overlap at t=0
      const startOffsetX = (Math.random() - 0.5) * 80;
      const startOffsetY = (Math.random() - 0.5) * 80;

      // Outward burst — slower than v1 so the falling phase feels longer
      const angle = Math.random() * Math.PI * 2;
      const speed = 380 + Math.random() * 520;               // 380-900 px/sec
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 220;              // slight upward boost (fountain feel)

      // Horizontal flutter — each bill sways side to side as it falls
      const fluttFreq  = 1.5 + Math.random() * 2.5;           // 1.5-4 Hz
      const fluttAmp   = 18 + Math.random() * 36;             // 18-54 px sway amplitude
      const fluttPhase = Math.random() * Math.PI * 2;

      // In-plane spin (z-axis rotation)
      const rotStart = (Math.random() - 0.5) * 180;
      const rotSpeed = (Math.random() - 0.5) * 540;          // slower than v1 — bills tumble, not blur

      // 3D face-flip (y-axis rotation) so some bills flip face-back-face as they fall
      const flipSpeed = (Math.random() - 0.5) * 540;          // deg/sec

      particles.push({
        el, startOffsetX, startOffsetY, vx, vy,
        fluttFreq, fluttAmp, fluttPhase,
        rotStart, rotSpeed, flipSpeed,
      });
    }

    const start = performance.now();
    const gravity = 520;                                      // much weaker than v1 — paper falls slowly
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', explode);
  } else {
    explode();
  }
})();
