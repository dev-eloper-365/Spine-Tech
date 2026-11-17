// Hero title drawn as dots.
// The <h1> keeps the real text (for layout, search and screen readers) and turns transparent.
// A canvas over the hero samples the title's glyphs on a grid and draws one dot per filled cell.
// Each dot is held to its home by a spring; the pointer pushes dots away inside a soft radius,
// so the letters scatter where the mouse moves and close again behind it.

export type Dots = {
  frame(): void;
  /** the canvas the dots are drawn on (the liquid effect reads it as its image) */
  canvas: HTMLCanvasElement;
  /** goes up by one on every redraw */
  readonly version: number;
};

const OPT = {
  gapEm: 0.016, // grid step, as a fraction of the title font size
  minGap: 4, // px
  density: 1.25, // dots per area, against the base grid (1.25 = a quarter more dots)
  dotScale: 0.46, // dot radius / grid step (0.5 = neighbours touch)
  boldEm: 0.022, // extra stroke around each glyph, as a fraction of the font size
  radius: 70, // px: size of the bubble around the pointer
  push: 3.4, // pointer strength
  spring: 0.07, // pull back to home
  damping: 0.86, // velocity kept each frame (higher = dots overshoot and bounce a little on return)
  bubble: {
    follow: 0.16, // how hard the bubble centre is pulled to the pointer
    loose: 0.74, // velocity the centre keeps: below 1 it settles, near 1 it overshoots more
    stretchPerPx: 0.035, // stretch per px of bubble speed per frame
    maxStretch: 0.7,
    bounce: 0.22, // spring back to round
    bounceKeep: 0.8, // under 1: the shape wobbles a few times, then rests
    wobble: 0.14, // edge waves, as a fraction of the radius
  },
};

export function createTitleDots(title: HTMLElement, host: HTMLElement, opts: { interactive: boolean; intro: boolean }): Dots {
  const canvas = document.createElement('canvas');
  canvas.className = 'title-dots';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let hx: Float32Array, hy: Float32Array, px: Float32Array, py: Float32Array, vx: Float32Array, vy: Float32Array;
  let n = 0, r = 2, color = '#000', dpr = 1, w = 0, h = 0;
  let mx = -1e5, my = -1e5, awake = true;

  function build() {
    const hb = host.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio, 2);
    // the canvas is larger than the hero on every side, so that tall glyphs and
    // pushed dots are never cut at the hero's edge
    const M = OPT.radius + 80;
    w = hb.width + M * 2; h = hb.height + M * 2;
    canvas.style.left = `${-M}px`; canvas.style.top = `${-M}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;

    const cs = getComputedStyle(title);
    color = cs.color === 'rgba(0, 0, 0, 0)' ? getComputedStyle(host).color : cs.color;
    const size = parseFloat(cs.fontSize);
    // density scales the dot count, so the grid step shrinks by its square root
    const gap = Math.max(OPT.minGap, size * OPT.gapEm) / Math.sqrt(OPT.density);
    r = gap * OPT.dotScale;

    // draw the title into an offscreen canvas at exactly the place the DOM lays it out
    const off = document.createElement('canvas');
    off.width = Math.ceil(w); off.height = Math.ceil(h);
    const o = off.getContext('2d', { willReadFrequently: true })!;
    o.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('letterSpacing' in o) (o as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    o.fillStyle = '#000';
    // a stroke around each glyph makes the thin blackletter strokes bolder, so they hold more dots
    o.strokeStyle = '#000';
    o.lineWidth = size * OPT.boldEm;
    o.lineJoin = 'round';
    o.textBaseline = 'alphabetic';
    for (const line of title.querySelectorAll<HTMLElement>('.line')) {
      const lb = line.getBoundingClientRect();
      const text = cs.textTransform === 'uppercase' ? line.textContent!.trim().toUpperCase() : line.textContent!.trim();
      const m = o.measureText(text);
      // CSS centres the font's content area in the line box (half-leading on each side)
      const content = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
      const top = lb.top - hb.top + M + (lb.height - content) / 2;
      // the line rises in with a transform: measure where it lands, not where it is now
      const ty = new DOMMatrixReadOnly(getComputedStyle(line).transform).m42;
      const x = lb.left - hb.left + M, y = top - ty + m.fontBoundingBoxAscent;
      o.fillText(text, x, y);
      o.strokeText(text, x, y);
    }

    const data = o.getImageData(0, 0, off.width, off.height).data;
    const xs: number[] = [], ys: number[] = [];
    for (let y = gap / 2; y < off.height; y += gap) {
      for (let x = gap / 2; x < off.width; x += gap) {
        if (data[(Math.floor(y) * off.width + Math.floor(x)) * 4 + 3] > 128) { xs.push(x); ys.push(y); }
      }
    }
    const first = !hx;
    n = xs.length;
    hx = Float32Array.from(xs); hy = Float32Array.from(ys);
    px = Float32Array.from(xs); py = Float32Array.from(ys);
    vx = new Float32Array(n); vy = new Float32Array(n);
    // first build: the dots arrive from a loose scatter below their letters
    if (first && opts.intro) {
      for (let i = 0; i < n; i++) {
        px[i] = hx[i] + (Math.random() - 0.5) * 160;
        py[i] = hy[i] + 60 + Math.random() * 140;
      }
    }
    title.classList.add('dots-on');
    awake = true;
  }

  let version = 0;
  function draw() {
    version++;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(px[i] + r, py[i]);
      ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // The push area is a bubble, not a circle:
  // - its centre follows the pointer on a loose spring, so it lags, overshoots and settles
  // - it stretches along its own motion and squashes across it, then bounces back to round
  // - its edge wobbles with two slow waves, so the outline is never a perfect circle
  let bx = -1e5, by = -1e5, bvx = 0, bvy = 0; // bubble centre and velocity
  let stretch = 1, stretchV = 0; // 1 = round
  let t = 0;
  function moveBubble() {
    t += 1 / 60;
    if (Math.abs(mx - bx) > 400 || Math.abs(my - by) > 400) { bx = mx; by = my; bvx = bvy = 0; } // pointer came in from far: no flight
    bvx = (bvx + (mx - bx) * OPT.bubble.follow) * OPT.bubble.loose;
    bvy = (bvy + (my - by) * OPT.bubble.follow) * OPT.bubble.loose;
    bx += bvx; by += bvy;
    const speed = Math.hypot(bvx, bvy);
    const target = 1 + Math.min(speed * OPT.bubble.stretchPerPx, OPT.bubble.maxStretch);
    stretchV = (stretchV + (target - stretch) * OPT.bubble.bounce) * OPT.bubble.bounceKeep;
    stretch += stretchV;
    return speed;
  }

  function step() {
    const speed = moveBubble();
    const R = OPT.radius;
    const s = Math.max(0.6, stretch);
    const ux = speed > 0.01 ? bvx / speed : 1, uy = speed > 0.01 ? bvy / speed : 0; // motion direction
    const along = R * s, across = R / Math.sqrt(s); // keeps the area close to constant
    const reach = along * (1 + OPT.bubble.wobble), reach2 = reach * reach;
    let moving = speed > 0.05 || Math.abs(stretchV) > 0.001;
    for (let i = 0; i < n; i++) {
      let ax = (hx[i] - px[i]) * OPT.spring, ay = (hy[i] - py[i]) * OPT.spring;
      const dx = px[i] - bx, dy = py[i] - by, d2 = dx * dx + dy * dy;
      if (d2 < reach2) {
        const a = dx * ux + dy * uy, b = dy * ux - dx * uy; // along and across the motion
        const theta = Math.atan2(dy, dx);
        const edge = 1 + OPT.bubble.wobble * (0.6 * Math.sin(3 * theta + t * 2.6) + 0.4 * Math.sin(5 * theta - t * 1.9));
        const q = Math.sqrt((a / along) ** 2 + (b / across) ** 2) / edge; // 0 at centre, 1 on the bubble's edge
        if (q < 1) {
          const d = Math.sqrt(d2) || 1, f = (1 - q) ** 2 * OPT.push * R * 0.1;
          ax += (dx / d) * f; ay += (dy / d) * f;
        }
      }
      vx[i] = (vx[i] + ax) * OPT.damping; vy[i] = (vy[i] + ay) * OPT.damping;
      px[i] += vx[i]; py[i] += vy[i];
      if (!moving && (Math.abs(vx[i]) > 0.01 || Math.abs(vy[i]) > 0.01 || Math.abs(hx[i] - px[i]) > 0.1 || Math.abs(hy[i] - py[i]) > 0.1)) moving = true;
    }
    return moving;
  }

  if (opts.interactive) {
    addEventListener('pointermove', (e) => {
      const b = canvas.getBoundingClientRect();
      mx = e.clientX - b.left; my = e.clientY - b.top;
      awake = true;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mx = my = -1e5; awake = true; });
  }

  let queued = false;
  const rebuild = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; build(); if (!opts.interactive) draw(); });
  };
  addEventListener('resize', rebuild);
  addEventListener('themechange', () => requestAnimationFrame(() => {
    color = getComputedStyle(title).color === 'rgba(0, 0, 0, 0)' ? getComputedStyle(host).color : getComputedStyle(title).color;
    awake = true;
    if (!opts.interactive) draw();
  }));

  build();
  draw();

  return {
    canvas,
    get version() { return version; },
    frame() {
      if (!opts.interactive && !opts.intro) return;
      // sleep while every dot is home and the pointer is far: no redraw cost on an idle hero
      if (!awake) return;
      const b = canvas.getBoundingClientRect();
      if (b.bottom < 0 || b.top > innerHeight) return;
      awake = step();
      draw();
    },
  };
}
