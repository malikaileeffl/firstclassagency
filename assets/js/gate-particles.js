/* Gate page particle network — adapted from AetherFlow.
   Brand colors: #0078ab (accent) and #1aa3df (accent-bright).
   Honors prefers-reduced-motion. */

(() => {
  const canvas = document.getElementById('gate-canvas');
  if (!canvas) return;

  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d');
  let animationFrameId;
  let particles = [];
  const mouse = { x: null, y: null, radius: 200 };

  // Brand colors
  const PARTICLE_FILL = 'rgba(26, 163, 223, 0.85)';     // accent-bright
  const LINE_COLOR_DEFAULT = 'rgba(0, 120, 171, '; // accent — opacity appended
  const LINE_COLOR_NEAR_MOUSE = 'rgba(255, 255, 255, ';

  class Particle {
    constructor(x, y, dx, dy, size) {
      this.x = x; this.y = y;
      this.dx = dx; this.dy = dy;
      this.size = size;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = PARTICLE_FILL;
      ctx.fill();
    }
    update() {
      if (this.x > canvas.width || this.x < 0) this.dx = -this.dx;
      if (this.y > canvas.height || this.y < 0) this.dy = -this.dy;

      // Repel from cursor
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < mouse.radius + this.size) {
          const fx = dx / distance;
          const fy = dy / distance;
          const force = (mouse.radius - distance) / mouse.radius;
          this.x -= fx * force * 5;
          this.y -= fy * force * 5;
        }
      }

      this.x += this.dx;
      this.y += this.dy;
      this.draw();
    }
  }

  function init() {
    particles = [];
    const count = (canvas.height * canvas.width) / 9000;
    for (let i = 0; i < count; i++) {
      const size = Math.random() * 2 + 1;
      const x = Math.random() * (innerWidth - size * 4) + size * 2;
      const y = Math.random() * (innerHeight - size * 4) + size * 2;
      const dx = Math.random() * 0.4 - 0.2;
      const dy = Math.random() * 0.4 - 0.2;
      particles.push(new Particle(x, y, dx, dy, size));
    }
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init();
  }

  function connect() {
    for (let a = 0; a < particles.length; a++) {
      for (let b = a; b < particles.length; b++) {
        const ddx = particles[a].x - particles[b].x;
        const ddy = particles[a].y - particles[b].y;
        const distSq = ddx * ddx + ddy * ddy;
        if (distSq < (canvas.width / 7) * (canvas.height / 7)) {
          const opacity = 1 - distSq / 20000;

          // Brighter (white) when the segment is near the cursor
          let prefix = LINE_COLOR_DEFAULT;
          if (mouse.x !== null) {
            const dxA = particles[a].x - mouse.x;
            const dyA = particles[a].y - mouse.y;
            const distA = Math.sqrt(dxA * dxA + dyA * dyA);
            if (distA < mouse.radius) prefix = LINE_COLOR_NEAR_MOUSE;
          }

          ctx.strokeStyle = `${prefix}${opacity})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    // Transparent clear lets the page background gradient show through
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) particles[i].update();
    connect();
  }

  const onMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
  const onMouseOut = () => { mouse.x = null; mouse.y = null; };

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseout', onMouseOut);

  resize();
  animate();

  // Pause animation when tab is hidden to save cycles
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else {
      animate();
    }
  });
})();
