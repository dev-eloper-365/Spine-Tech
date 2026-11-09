import './styles/main.css';
import Lenis from 'lenis';
import { projects } from './data';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];

/* ---------- Smooth scroll ---------- */
const lenis = new Lenis({ lerp: 0.1, smoothWheel: !reduced });
let velocity = 0;
lenis.on('scroll', (l: Lenis) => { velocity = l.velocity; });
$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!;
    const el = id === '#top' ? 0 : $(id);
    if (el !== null) { e.preventDefault(); lenis.scrollTo(el as HTMLElement | number, { duration: 1.4 }); }
  }),
);

/* ---------- Header theme: strictly black or white ----------
   For each header item, look at what sits behind it. Images, background
   images and dark backgrounds count as dark -> item turns white; else black. */
const header = $('.header');
const headerItems = $$('.logo, .navlink, .pill-cta', header);
function isDark(el: Element | null): boolean {
  for (; el && el !== document.documentElement; el = el.parentElement) {
    if (el instanceof HTMLImageElement || el instanceof SVGImageElement || el instanceof HTMLVideoElement) return true;
    if (el.matches('.svc, .thumb, [data-theme="dark"]')) return true;
    const cs = getComputedStyle(el);
    if (cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('linear-gradient(transparent')) return true;
    const m = cs.backgroundColor.match(/[\d.]+/g);
    if (m && (m.length < 4 || +m[3] > 0.5)) return 0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2] < 128;
  }
  return false;
}
function updateHeaderTheme() {
  for (const item of headerItems) {
    const r = item.getBoundingClientRect();
    if (!r.width) continue;
    const under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((e) => !header.contains(e) && !e.closest('.loader, .cursor'));
    item.classList.toggle('on-dark', isDark(under ?? null));
  }
}
let themeQueued = false;
const queueHeaderTheme = () => {
  if (themeQueued) return;
  themeQueued = true;
  requestAnimationFrame(() => { themeQueued = false; updateHeaderTheme(); });
};
lenis.on('scroll', queueHeaderTheme);
addEventListener('scroll', queueHeaderTheme, { passive: true });
addEventListener('resize', queueHeaderTheme);
addEventListener('load', updateHeaderTheme);
// the preloader covers the page at first: re-check once it has gone
new MutationObserver(queueHeaderTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* ---------- Projects ---------- */
const list = $('#projects');
list.innerHTML = projects
  .map(
    (p) => `<a class="card" href="#contact" data-img="${p.img}">
  <div class="thumb"><img src="${p.img}" alt="${p.name} project" loading="lazy"></div>
  <span class="row-name">${p.name}</span>
  <div class="meta"><ul class="pills">${p.tags.map((t) => `<li>${t}</li>`).join('')}</ul><span class="date">${p.date === 'Ongoing' ? 'Ongoing' : `Completed: ${p.date}`}</span></div>
  <span class="name">${p.name} <i>→</i></span>
</a>`,
  )
  .join('');

const hoverImg = $('.hover-img');
const hoverImgEl = $<HTMLImageElement>('img', hoverImg);
$$<HTMLButtonElement>('.view-toggle button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.view-toggle button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    list.dataset.view = b.dataset.view!;
    hoverImg.classList.remove('on');
    lenis.resize();
  }),
);
$$('.card', list).forEach((c) => {
  c.addEventListener('mouseenter', () => {
    if (list.dataset.view !== 'list') return;
    hoverImgEl.src = c.dataset.img!;
    hoverImg.classList.add('on');
  });
  c.addEventListener('mouseleave', () => hoverImg.classList.remove('on'));
});

/* ---------- Spinner badges (rotating circular text) ---------- */
const spinners = $$('.spinner').map((el, i) => {
  const text = el.dataset.text!.replace(/ /g, '\u00A0');
  const id = `ring-${i}`;
  el.innerHTML = `<svg class="ring" viewBox="0 0 200 200"><defs><path id="${id}" d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0"/></defs>
<text>${el.dataset.fill === 'no' ? `<textPath href="#${id}">${text}</textPath>` : `<textPath href="#${id}" textLength="512" lengthAdjust="spacing">${text.repeat(Math.max(1, Math.round(26 / text.length)))}</textPath>`}</text></svg>
<svg class="core"><use href="#mark"/></svg>`;
  return { ring: $<SVGElement>('svg.ring', el), angle: 0 };
});

/* ---------- Marquee ---------- */
const track = $('.marquee-track');
const row = $('.marquee-row', track);
track.append(row.cloneNode(true), row.cloneNode(true));
let marqueeX = 0;

/* ---------- Fit hero title to width ---------- */
function fit() {
  $$('.fit').forEach((h) => {
    h.style.fontSize = '100px';
    const w = Math.max(...$$('.line', h).map((l) => l.scrollWidth));
    const avail = h.parentElement!.clientWidth - parseFloat(getComputedStyle(h.parentElement!).paddingLeft) * 2;
    h.style.fontSize = `${(100 * avail) / w}px`;
  });

}
document.fonts.ready.then(() => { fit(); lenis.resize(); });
addEventListener('resize', fit);

/* ---------- Reveal on view ---------- */
$$('.reveal').forEach((h) => { if (!h.querySelector('span')) h.innerHTML = `<span>${h.innerHTML}</span>`; });
const io = new IntersectionObserver(
  (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
  { threshold: 0.2 },
);
$$('.reveal, .reveal-img').forEach((el) => io.observe(el));

/* ---------- Cursor ---------- */
const cursor = $('.cursor');
let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my, hx = mx, hy = my;
addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; });
document.addEventListener('pointerover', (e) => {
  cursor.classList.toggle('big', !!(e.target as Element).closest('a, button'));
});

/* ---------- Services: horizontal slides inside a sticky track ---------- */
const svcTrack = $('.svc-track');
const slides = $$('.svc', svcTrack);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------- Intro: strip parallax + progress line ---------- */
const intro = $('.intro');
const strips = $$('.strip', intro).map((el) => ({ img: $<HTMLImageElement>('img', el), speed: parseFloat(el.dataset.speed!) }));
const progressBar = $('.progress i', intro);

/* ---------- Nav magnet ---------- */
$$('.mag').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const b = el.getBoundingClientRect();
    const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    el.style.transform = `translate(${dx * 0.3}px, ${dy * 0.3}px)`;
  });
  el.addEventListener('pointerleave', () => { el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; });
  el.addEventListener('pointerenter', () => { el.style.transition = 'none'; });
});

/* ---------- Preloader ---------- */
{
  const loader = $('.loader');
  const num = $('.loader-num', loader);
  const root = document.documentElement;
  root.classList.add('loading');
  lenis.stop();
  let shown = 0, done = false, loaded = 0;
  const assets: Promise<unknown>[] = [
    document.fonts.ready,
    new Promise((r) => (document.readyState === 'complete' ? r(0) : addEventListener('load', r, { once: true }))),
  ];
  assets.forEach((a) => a.then(() => { loaded++; }));
  const start = performance.now();
  const tick = (now: number) => {
    // at least 1.2 s; real asset progress caps the counter until everything is in
    const timeP = clamp((now - start) / 1200);
    const assetP = loaded === assets.length ? 1 : (loaded + 1) / (assets.length + 1);
    const target = Math.min(timeP, assetP);
    shown += (target - shown) * 0.12;
    if (target >= 1 && shown > 0.995) shown = 1;
    num.textContent = `${Math.round(shown * 100)}%`;
    loader.style.setProperty('--p', String(shown));
    if (shown < 1) { requestAnimationFrame(tick); return; }
    if (done) return;
    done = true;
    setTimeout(() => loader.classList.add('dot'), 150);
    setTimeout(() => {
      loader.classList.add('done');
      root.classList.toggle('loading', false);
      document.body.classList.add('ready');
      lenis.start();
    }, 800);
  };
  requestAnimationFrame(tick);
}

/* ---------- WebGL (lazy) ---------- */
let heroGL: { frame: (t: number, v: number) => void } | null = null;
let titleGL: { frame: (t: number) => void } | null = null;
// liquid title: start after the preloader and the title rise-in, only for mouse users
if (!reduced && matchMedia('(hover: hover)').matches) {
  const startTitle = () => setTimeout(async () => {
    titleGL = (await import('./gl/title')).createTitle($('.hero-title'), $('.hero'));
  }, 1400);
  if (document.body.classList.contains('ready')) startTitle();
  else new MutationObserver((_, o) => { if (document.body.classList.contains('ready')) { o.disconnect(); startTitle(); } })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
if (!reduced) {
  import('./gl/hero').then((m) => { heroGL = m.createHero($('#gl-hero'), $('#gl-anchor')); });
}

/* ---------- Main loop ---------- */
let last = performance.now();
function raf(now: number) {
  const dt = Math.min(64, now - last) / 1000;
  last = now;
  lenis.raf(now);

  // cursor
  cx += (mx - cx) * 0.25; cy += (my - cy) * 0.25;
  cursor.style.transform = `translate3d(${cx}px,${cy}px,0)`;
  hx += (mx - hx) * 0.12; hy += (my - hy) * 0.12;
  hoverImg.style.transform = `translate3d(${hx - 180}px,${hy - 112}px,0) ${hoverImg.classList.contains('on') ? 'scale(1)' : 'scale(.8)'}`;

  const v = velocity;
  // spinners: base spin + scroll boost
  for (const s of spinners) {
    s.angle += dt * (18 + Math.abs(v) * 6);
    s.ring.style.transform = `rotate(${s.angle}deg)`;
  }

  // marquee: direction follows scroll
  const rw = row.offsetWidth;
  marqueeX -= dt * (90 + Math.abs(v) * 40) * (v < 0 ? -1 : 1);
  if (marqueeX <= -rw) marqueeX += rw;
  if (marqueeX > 0) marqueeX -= rw;
  track.style.transform = `translate3d(${marqueeX}px,0,0)`;

  const vh = innerHeight;

  // services: slide i enters from the right; the slide it covers moves 25% left
  const tb = svcTrack.getBoundingClientRect();
  if (tb.top < vh && tb.bottom > 0) {
    const p = clamp(-tb.top / (tb.height - vh)) * (slides.length - 1);
    slides.forEach((el, i) => {
      const d = i - p;
      const x = d > 0 ? Math.min(d, 1) * 100 : -25 * Math.min(-d, 1);
      el.style.transform = `translate3d(${x}%,0,0)`;
    });
  }

  // intro: strips move at different speeds; progress line follows the section
  const ib = intro.getBoundingClientRect();
  if (ib.top < vh && ib.bottom > 0) {
    const ip = clamp((vh - ib.top) / (vh + ib.height));
    for (const st of strips) st.img.style.transform = `translate3d(0,${(ip - 0.5) * st.speed * 100}%,0)`;
    progressBar.style.transform = `scaleX(${clamp((vh * 0.6 - ib.top) / ib.height)})`;
  }

  heroGL?.frame(now / 1000, v);
  titleGL?.frame(now / 1000);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
