import './styles/main.css';
import Lenis from 'lenis';
import { groups, projects } from './data';

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

/* ---------- Projects ---------- */
const list = $('#projects');
list.innerHTML = projects
  .map(
    (p) => `<a class="card" href="${p.video}" data-img="${p.img}" data-video="${p.video}" data-name="${p.name}">
  <div class="thumb"><img src="${p.img}" alt="${p.name} case study" loading="lazy"><video muted playsinline loop preload="none" poster="${p.img}"></video><span class="play" aria-hidden="true">▶</span></div>
  <span class="row-name">${p.name}</span>
  <div class="meta"><ul class="pills">${p.tags.map((t) => `<li>${t}</li>`).join('')}</ul><span class="date">${groups[p.group]}</span></div>
  <span class="name">${p.name} <i>→</i></span>
</a>`,
  )
  .join('');

/* Card view: a muted preview plays on hover. Any view: a click opens the film with sound in a dialog. */
const player = $<HTMLDialogElement>('.player');
const playerVideo = $<HTMLVideoElement>('video', player);
const closePlayer = () => player.close();
player.addEventListener('close', () => { playerVideo.pause(); playerVideo.removeAttribute('src'); playerVideo.load(); lenis.start(); });
player.addEventListener('click', (e) => { if (e.target === player) closePlayer(); });
$('.player-close', player).addEventListener('click', closePlayer);
$$<HTMLAnchorElement>('.card', list).forEach((c) => {
  const v = $<HTMLVideoElement>('video', c);
  c.addEventListener('mouseenter', () => {
    if (list.dataset.view !== 'card' || !matchMedia('(hover: hover)').matches) return;
    if (!v.src) v.src = c.dataset.video!;
    v.play().catch(() => {});
  });
  c.addEventListener('mouseleave', () => { v.pause(); });
  c.addEventListener('click', (e) => {
    e.preventDefault();
    v.pause();
    $('.player-title', player).textContent = c.dataset.name!;
    playerVideo.src = c.dataset.video!;
    lenis.stop();
    player.showModal();
    playerVideo.play().catch(() => {});
  });
});

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
let endGL: { frame: (t: number) => void; visible: boolean } | null = null;
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
  const endEl = $('.end');
  const endIO = new IntersectionObserver(async ([e]) => {
    if (e.isIntersecting && !endGL) endGL = (await import('./gl/end')).createEnd($('#gl-end'));
    if (endGL) endGL.visible = e.isIntersecting;
  }, { rootMargin: '400px' });
  endIO.observe(endEl);
}
{
  // header shows only the CTA while the end scene fills most of the screen
  const endEl = $('.end');
  new IntersectionObserver(([e]) => document.body.classList.toggle('at-end', e.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] })
    .observe(endEl);
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
  if (endGL?.visible) endGL.frame(now / 1000);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
