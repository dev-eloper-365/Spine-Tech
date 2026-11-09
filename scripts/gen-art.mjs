// Generates original placeholder artwork (SVG) for Spine Tech.
// Style: dark "systems" scenes — node networks, dashboard panels, circuit traces.
// Run: node scripts/gen-art.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/art/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const palettes = [
  ['#05070d', '#0f2a3d', '#38e1c6', '#ff5a3c', '#f4f1ea'],
  ['#0a0a0a', '#1d1b3a', '#7b6cff', '#3cf0ff', '#ffffff'],
  ['#0b0f0c', '#14322a', '#5cff9d', '#ffd23c', '#eaf7ee'],
  ['#120806', '#3a140c', '#ff7a2f', '#ffcf5a', '#fff4e8'],
  ['#06080f', '#0d1f4a', '#3c8bff', '#ff3c8b', '#eef3ff'],
  ['#0c0c0c', '#2a2a2a', '#e6e6e6', '#ff4040', '#ffffff'],
  ['#070b10', '#123040', '#5ad1ff', '#b6ff3c', '#f0fbff'],
  ['#0d0710', '#2c1240', '#d36cff', '#3cffd9', '#fbf0ff'],
];

function art(seed, w, h, kind) {
  const r = rng(seed * 7919 + 17);
  const [bg, mid, a1, a2, fg] = palettes[seed % palettes.length];
  const parts = [];
  parts.push(`<defs>
  <radialGradient id="g" cx="${(30 + r() * 40).toFixed(0)}%" cy="${(30 + r() * 40).toFixed(0)}%" r="80%">
    <stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${bg}"/>
  </radialGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="${a1}" stop-opacity=".9"/><stop offset="1" stop-color="${a1}" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${fg}" stroke-opacity=".06"/></pattern>
</defs>`);
  parts.push(`<rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#grid)"/>`);

  // Node network
  const n = 14 + Math.floor(r() * 10);
  const nodes = Array.from({ length: n }, () => [r() * w, r() * h, 2 + r() * 6]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1];
      if (Math.hypot(dx, dy) < w * 0.28 && r() > 0.35) {
        const cx = (nodes[i][0] + nodes[j][0]) / 2 + (r() - 0.5) * 80;
        const cy = (nodes[i][1] + nodes[j][1]) / 2 + (r() - 0.5) * 80;
        parts.push(`<path d="M${nodes[i][0].toFixed(1)} ${nodes[i][1].toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${nodes[j][0].toFixed(1)} ${nodes[j][1].toFixed(1)}" fill="none" stroke="${r() > 0.7 ? a2 : a1}" stroke-opacity="${(0.25 + r() * 0.5).toFixed(2)}" stroke-width="${(0.6 + r() * 1.6).toFixed(1)}"/>`);
      }
    }
  }
  const hub = nodes[0];
  parts.push(`<circle cx="${hub[0].toFixed(1)}" cy="${hub[1].toFixed(1)}" r="${(w * 0.22).toFixed(0)}" fill="url(#glow)" opacity=".55"/>`);
  for (const [x, y, s] of nodes) {
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="${r() > 0.8 ? a2 : fg}"/>`);
  }

  // Dashboard panels (kind: "ui")
  if (kind === 'ui') {
    const px = w * (0.12 + r() * 0.2), py = h * (0.15 + r() * 0.15), pw = w * 0.5, ph = h * 0.55;
    parts.push(`<g opacity=".92"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="14" fill="${bg}" fill-opacity=".85" stroke="${fg}" stroke-opacity=".15"/>`);
    parts.push(`<rect x="${px + 24}" y="${py + 24}" width="${pw * 0.4}" height="12" rx="6" fill="${fg}" fill-opacity=".8"/>`);
    parts.push(`<rect x="${px + 24}" y="${py + 46}" width="${pw * 0.25}" height="8" rx="4" fill="${fg}" fill-opacity=".3"/>`);
    let path = `M${px + 24} ${py + ph - 40}`;
    for (let i = 1; i <= 12; i++) path += `L${(px + 24 + (pw - 48) * (i / 12)).toFixed(1)} ${(py + ph - 40 - r() * ph * 0.5).toFixed(1)}`;
    parts.push(`<path d="${path}" fill="none" stroke="${a1}" stroke-width="3" stroke-linejoin="round"/>`);
    for (let i = 0; i < 6; i++) {
      const bh = 20 + r() * 80;
      parts.push(`<rect x="${(px + pw + 30 + i * 26).toFixed(1)}" y="${(py + ph - bh).toFixed(1)}" width="16" height="${bh.toFixed(1)}" rx="3" fill="${i % 2 ? a2 : a1}" fill-opacity=".8"/>`);
    }
    parts.push(`</g>`);
  }

  // Circuit traces (kind: "hw")
  if (kind === 'hw') {
    for (let i = 0; i < 18; i++) {
      let x = r() * w, y = r() * h, d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
      for (let k = 0; k < 4; k++) {
        if (r() > 0.5) x += (r() - 0.5) * 300; else y += (r() - 0.5) * 300;
        d += `L${x.toFixed(0)} ${y.toFixed(0)}`;
      }
      parts.push(`<path d="${d}" fill="none" stroke="${a1}" stroke-opacity=".35" stroke-width="2"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="4" fill="none" stroke="${a1}" stroke-width="2"/>`);
    }
    const cx = w * 0.62, cy = h * 0.5, s = Math.min(w, h) * 0.28;
    parts.push(`<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="10" fill="${bg}" stroke="${a1}" stroke-width="3"/>`);
    parts.push(`<rect x="${cx - s / 4}" y="${cy - s / 4}" width="${s / 2}" height="${s / 2}" rx="6" fill="${a1}" fill-opacity=".25"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${parts.join('')}</svg>`;
}

const jobs = [
  // services (wide)
  ['svc-hardware', 1, 1600, 1000, 'hw'],
  ['svc-software', 2, 1600, 1000, 'ui'],
  ['svc-ai', 7, 1600, 1000, 'net'],
  ['svc-workflow', 4, 1600, 1000, 'ui'],
  // collage (tall)
  ['collage-1', 6, 600, 1000, 'hw'],
  ['collage-2', 1, 600, 1000, 'net'],
  ['collage-3', 3, 600, 1000, 'ui'],
];
for (let i = 0; i < 22; i++) jobs.push([`work-${i + 1}`, 10 + i, 1200, 750, ['ui', 'hw', 'net'][i % 3]]);

for (const [name, seed, w, h, kind] of jobs) {
  writeFileSync(new URL(`${name}.svg`, OUT), art(seed, w, h, kind));
}
console.log(`wrote ${jobs.length} files`);
