import { Renderer, Plane, Program, Mesh, Texture, RenderTarget, Transform } from 'ogl';

// Liquid hover effect for the hero title.
// A stable-fluids simulation runs over the full viewport at 1/4 resolution:
// advection -> cursor force (soft disc) -> viscous diffusion -> divergence ->
// Poisson pressure solve -> pressure subtraction.
// The title is an opaque image (black text on white). The display pass moves it
// along the velocity field and splits R / G / B, so the letter edges show color.

const OPT = {
  resolution: 0.25, // sim cells per CSS pixel
  cursorSize: 40, // force disc radius, in cells
  mouseForce: 120,
  forceDiv: 7,
  viscous: 4,
  viscousIterations: 8,
  poissonIterations: 16,
  dt: 0.016,
  fluidStrength: 0.5,
};

// Full-screen quad, shrunk by one cell so the border cells stay at zero (fixed walls).
const faceVert = /* glsl */ `
attribute vec3 position;
uniform vec2 uBoundary;
varying vec2 vUv;
void main() {
  vec2 p = position.xy * (1. - uBoundary * 2.);
  vUv = .5 + p * .5;
  gl_Position = vec4(p, 0., 1.);
}`;

const advectFrag = /* glsl */ `
precision highp float;
uniform sampler2D uVelocity;
uniform float uDt;
uniform vec2 uFbo;
varying vec2 vUv;
void main() {
  vec2 ratio = max(uFbo.x, uFbo.y) / uFbo;
  vec2 vel = texture2D(uVelocity, vUv).xy * 2.55;
  vec2 back = vUv - vel * uDt * ratio;
  gl_FragColor = vec4(texture2D(uVelocity, back).xy * .98, 0., 0.);
}`;

// Soft disc at the cursor: strength (1 - r)^2 * 1.5, added on top of the velocity.
const forceVert = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform vec2 uCenter;
uniform vec2 uScale;
uniform vec2 uPx;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy * uScale * 2. * uPx + uCenter, 0., 1.);
}`;

const forceFrag = /* glsl */ `
precision highp float;
uniform vec2 uForce;
varying vec2 vUv;
void main() {
  float d = 1. - min(length((vUv - .5) * 2.), 1.);
  d *= d * 1.5;
  gl_FragColor = vec4(uForce * d, 0., 0.);
}`;

// One Jacobi step of implicit viscosity.
const viscousFrag = /* glsl */ `
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uVelocityNew;
uniform float uV;
uniform float uDt;
uniform vec2 uPx;
varying vec2 vUv;
void main() {
  vec2 old = texture2D(uVelocity, vUv).xy;
  vec2 sum = texture2D(uVelocityNew, vUv + vec2(uPx.x * 2., 0.)).xy
           + texture2D(uVelocityNew, vUv - vec2(uPx.x * 2., 0.)).xy
           + texture2D(uVelocityNew, vUv + vec2(0., uPx.y * 2.)).xy
           + texture2D(uVelocityNew, vUv - vec2(0., uPx.y * 2.)).xy;
  gl_FragColor = vec4((4. * old + uV * uDt * sum) / (4. * (1. + uV * uDt)), 0., 0.);
}`;

const divergenceFrag = /* glsl */ `
precision highp float;
uniform sampler2D uVelocity;
uniform float uDt;
uniform vec2 uPx;
varying vec2 vUv;
void main() {
  float x0 = texture2D(uVelocity, vUv - vec2(uPx.x, 0.)).x;
  float x1 = texture2D(uVelocity, vUv + vec2(uPx.x, 0.)).x;
  float y0 = texture2D(uVelocity, vUv - vec2(0., uPx.y)).y;
  float y1 = texture2D(uVelocity, vUv + vec2(0., uPx.y)).y;
  gl_FragColor = vec4((x1 - x0 + y1 - y0) / 2. / uDt);
}`;

const poissonFrag = /* glsl */ `
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uPx;
varying vec2 vUv;
void main() {
  float p = texture2D(uPressure, vUv + vec2(uPx.x * 2., 0.)).r
          + texture2D(uPressure, vUv - vec2(uPx.x * 2., 0.)).r
          + texture2D(uPressure, vUv + vec2(0., uPx.y * 2.)).r
          + texture2D(uPressure, vUv - vec2(0., uPx.y * 2.)).r;
  gl_FragColor = vec4(p / 4. - texture2D(uDivergence, vUv).r);
}`;

const pressureFrag = /* glsl */ `
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform float uDt;
uniform vec2 uPx;
varying vec2 vUv;
void main() {
  float p0 = texture2D(uPressure, vUv + vec2(uPx.x, 0.)).r;
  float p1 = texture2D(uPressure, vUv - vec2(uPx.x, 0.)).r;
  float p2 = texture2D(uPressure, vUv + vec2(0., uPx.y)).r;
  float p3 = texture2D(uPressure, vUv - vec2(0., uPx.y)).r;
  vec2 v = texture2D(uVelocity, vUv).xy - vec2(p0 - p1, p2 - p3) * uDt * .25;
  gl_FragColor = vec4(v, 0., 1.);
}`;

// Title: read the velocity at this pixel's screen position, move the image along it,
// and sample R and B with an extra offset in opposite directions.
const displayVert = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const displayFrag = /* glsl */ `
precision highp float;
uniform sampler2D uText;
uniform sampler2D uVelocity;
uniform vec4 uRect;   // canvas left, top, width, height (CSS px, viewport)
uniform vec2 uView;   // viewport width, height
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec2 screenUV = vec2((uRect.x + vUv.x * uRect.z) / uView.x,
                       1. - (uRect.y + (1. - vUv.y) * uRect.w) / uView.y);
  vec2 vel = texture2D(uVelocity, screenUV).xy / max(uRect.z / uRect.w, 1.);
  vec2 uv = vUv - vel * uStrength;
  vec2 off = vel * uStrength * .2;
  gl_FragColor = vec4(texture2D(uText, uv - off).r, texture2D(uText, uv).g, texture2D(uText, uv + off).b, 1.);
}`;

export function createTitle(title: HTMLElement, host: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'title-gl';
  canvas.setAttribute('aria-hidden', 'true');

  const dpr = Math.min(devicePixelRatio, 2);
  const renderer = new Renderer({ canvas, dpr, alpha: true, webgl: 2, autoClear: false });
  const gl = renderer.gl;
  const gl2 = gl as unknown as WebGL2RenderingContext;
  // The fluid needs float render targets. Without them, keep the plain DOM title.
  if (!renderer.isWebgl2 || !gl2.getExtension('EXT_color_buffer_float')) return null;
  host.appendChild(canvas);

  const quad = new Plane(gl, { width: 2, height: 2 });
  const disc = new Plane(gl, { width: 1, height: 1 });
  const empty = new Transform();
  const textCanvas = document.createElement('canvas');
  const ctx = textCanvas.getContext('2d')!;
  const tText = new Texture(gl, { image: textCanvas, generateMipmaps: false, minFilter: gl.LINEAR });

  // ---- simulation targets ----
  const fbo = { value: [1, 1] };
  const px = { value: [1, 1] };
  const boundary = { value: [1, 1] };
  const makeRT = () => {
    const rt = new RenderTarget(gl, {
      width: fbo.value[0], height: fbo.value[1], depth: false,
      type: gl2.HALF_FLOAT, format: gl.RGBA, internalFormat: gl2.RGBA16F,
      minFilter: gl.LINEAR, magFilter: gl.LINEAR,
    });
    renderer.render({ scene: empty, target: rt, clear: true }); // start at zero
    return rt;
  };
  let vel0: RenderTarget, vel1: RenderTarget, visc0: RenderTarget, visc1: RenderTarget;
  let div: RenderTarget, press0: RenderTarget, press1: RenderTarget;
  function buildTargets() {
    const w = Math.round(OPT.resolution * innerWidth), h = Math.round(OPT.resolution * innerHeight);
    fbo.value = [w, h];
    px.value = [1 / w, 1 / h];
    boundary.value = [1 / w, 1 / h];
    [vel0, vel1, visc0, visc1, div, press0, press1] = Array.from({ length: 7 }, makeRT);
  }
  buildTargets();

  const pass = (fragment: string, uniforms: Record<string, { value: unknown }>) => {
    const program = new Program(gl, {
      vertex: faceVert, fragment, depthTest: false, depthWrite: false, cullFace: false,
      uniforms: { uBoundary: boundary, uPx: px, ...uniforms },
    });
    return { program, mesh: new Mesh(gl, { geometry: quad, program }) };
  };
  type Pass = ReturnType<typeof pass>;

  const advect = pass(advectFrag, { uVelocity: { value: null }, uDt: { value: OPT.dt }, uFbo: fbo });
  const viscous = pass(viscousFrag, { uVelocity: { value: null }, uVelocityNew: { value: null }, uV: { value: OPT.viscous }, uDt: { value: OPT.dt } });
  const divergence = pass(divergenceFrag, { uVelocity: { value: null }, uDt: { value: 8 * OPT.dt } });
  const poisson = pass(poissonFrag, { uPressure: { value: null }, uDivergence: { value: null } });
  const pressure = pass(pressureFrag, { uPressure: { value: null }, uVelocity: { value: null }, uDt: { value: OPT.dt } });

  const forceProgram = new Program(gl, {
    vertex: forceVert, fragment: forceFrag, transparent: true, depthTest: false, depthWrite: false, cullFace: false,
    uniforms: { uCenter: { value: [0, 0] }, uScale: { value: [OPT.cursorSize, OPT.cursorSize] }, uPx: px, uForce: { value: [0, 0] } },
  });
  forceProgram.setBlendFunc(gl.ONE, gl.ONE); // additive
  const force = new Mesh(gl, { geometry: disc, program: forceProgram });

  const displayProgram = new Program(gl, {
    vertex: displayVert, fragment: displayFrag, depthTest: false, depthWrite: false, cullFace: false,
    uniforms: { uText: { value: tText }, uVelocity: { value: null }, uRect: { value: [0, 0, 1, 1] }, uView: { value: [1, 1] }, uStrength: { value: OPT.fluidStrength } },
  });
  const display = new Mesh(gl, { geometry: quad, program: displayProgram });

  const run = (p: Pass | Mesh, target: RenderTarget) =>
    renderer.render({ scene: 'mesh' in p ? p.mesh : p, target, clear: false });

  // ---- layout + title image (black text on white, like the reference PNG) ----
  function layout() {
    const hb = host.getBoundingClientRect();
    const tb = title.getBoundingClientRect();
    const box = { x: tb.left - hb.left, y: tb.top - hb.top, w: tb.width, h: tb.height };
    Object.assign(canvas.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
    renderer.setSize(box.w, box.h);

    textCanvas.width = Math.round(box.w * dpr);
    textCanvas.height = Math.round(box.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const page = getComputedStyle(document.body);
    ctx.fillStyle = page.backgroundColor;
    ctx.fillRect(0, 0, box.w, box.h);
    const cs = getComputedStyle(title);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // match the DOM's tracking (Geist display uses negative letter-spacing)
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    ctx.fillStyle = page.color;
    ctx.textBaseline = 'alphabetic';
    title.querySelectorAll<HTMLElement>('.line').forEach((line) => {
      const lb = line.getBoundingClientRect();
      const text = line.textContent || '';
      const m = ctx.measureText(text);
      const baseline = lb.top - tb.top + (lb.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      ctx.fillText(text, lb.left - tb.left, baseline);
    });
    tText.image = textCanvas;
    tText.needsUpdate = true;
  }

  // ---- input: cursor anywhere in the window, in clip space ----
  const coords = [0, 0], old = [0, 0];
  let seen = false;
  addEventListener('pointermove', (e) => {
    coords[0] = (e.clientX / innerWidth) * 2 - 1;
    coords[1] = -((e.clientY / innerHeight) * 2 - 1);
    if (!seen) { old[0] = coords[0]; old[1] = coords[1]; seen = true; }
  });

  let resizeQueued = false;
  addEventListener('themechange', () => layout());
  addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; buildTargets(); layout(); });
  });
  layout();
  title.classList.add('gl-on');

  return {
    frame() {
      const dx = coords[0] - old[0], dy = coords[1] - old[1];
      old[0] = coords[0]; old[1] = coords[1];

      const r = canvas.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;

      // 1. carry the velocity along itself
      advect.program.uniforms.uVelocity.value = vel0.texture;
      run(advect, vel1);

      // 2. cursor force: a soft disc, kept fully inside the grid
      const [cx, cy] = px.value;
      const sx = OPT.cursorSize * cx, sy = OPT.cursorSize * cy;
      const u = forceProgram.uniforms;
      u.uForce.value = [(dx / OPT.forceDiv) * OPT.mouseForce, (dy / OPT.forceDiv) * OPT.mouseForce];
      u.uCenter.value = [
        Math.min(Math.max(coords[0], -1 + sx + cx * 2), 1 - sx - cx * 2),
        Math.min(Math.max(coords[1], -1 + sy + cy * 2), 1 - sy - cy * 2),
      ];
      run(force, vel1);

      // 3. viscosity (Jacobi, ping-pong; ends in visc0)
      viscous.program.uniforms.uVelocity.value = vel1.texture;
      for (let i = 0; i < OPT.viscousIterations; i++) {
        const [src, dst] = i % 2 === 0 ? [visc0, visc1] : [visc1, visc0];
        viscous.program.uniforms.uVelocityNew.value = src.texture;
        run(viscous, dst);
      }
      const v = OPT.viscousIterations % 2 === 0 ? visc0 : visc1;

      // 4. divergence, 5. pressure solve (ping-pong; ends in press0)
      divergence.program.uniforms.uVelocity.value = v.texture;
      run(divergence, div);
      poisson.program.uniforms.uDivergence.value = div.texture;
      for (let i = 0; i < OPT.poissonIterations; i++) {
        const [src, dst] = i % 2 === 0 ? [press0, press1] : [press1, press0];
        poisson.program.uniforms.uPressure.value = src.texture;
        run(poisson, dst);
      }
      const p = OPT.poissonIterations % 2 === 0 ? press0 : press1;

      // 6. subtract the pressure gradient -> divergence-free velocity in vel0
      pressure.program.uniforms.uPressure.value = p.texture;
      pressure.program.uniforms.uVelocity.value = v.texture;
      run(pressure, vel0);

      // draw the title
      displayProgram.uniforms.uVelocity.value = vel0.texture;
      displayProgram.uniforms.uRect.value = [r.left, r.top, r.width, r.height];
      displayProgram.uniforms.uView.value = [innerWidth, innerHeight];
      renderer.render({ scene: display, clear: false });
    },
  };
}
