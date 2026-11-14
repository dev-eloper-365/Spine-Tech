import { Renderer, Camera, Transform, Plane, Program, Mesh } from 'ogl';

// A surface in the shape of the Spine Technologies logo (11 rounded bars) with a moving data texture,
// a tile-glitch that reacts to scroll speed, and an iridescent rim.

const vertex = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uVel;
varying vec2 vUv;
varying float vBend;
void main() {
  vUv = uv;
  vec3 p = position;
  float b = sin(p.x * 4.4 + uTime * .8) * .05 + sin(p.y * 4. + uTime * .6) * .04;
  b += clamp(uVel, -40., 40.) * .004 * (p.x * p.x + p.y * p.y) * 4.;
  p.z += b;
  vBend = b;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;

const fragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uScroll;
uniform float uVel;
varying vec2 vUv;
varying float vBend;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), u.x), u.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= .5; } return v; }
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float shape(vec2 p) {
  // the Spine Technologies logo: 11 rounded bars on a curved axis
  float d = 1e3;
  d = min(d, sdBox(p - vec2(0.1190, 0.9291), vec2(0.0781, 0.0409), 0.0409));
  d = min(d, sdBox(p - vec2(-0.0026, 0.7819), vec2(0.1177, 0.0550), 0.0550));
  d = min(d, sdBox(p - vec2(-0.0857, 0.6104), vec2(0.1548, 0.0704), 0.0704));
  d = min(d, sdBox(p - vec2(-0.1292, 0.4069), vec2(0.2086, 0.0819), 0.0819));
  d = min(d, sdBox(p - vec2(-0.1024, 0.1920), vec2(0.2124, 0.0819), 0.0819));
  d = min(d, sdBox(p - vec2(0.0051, -0.0205), vec2(0.2150, 0.0819), 0.0819));
  d = min(d, sdBox(p - vec2(0.0883, -0.2316), vec2(0.2188, 0.0806), 0.0806));
  d = min(d, sdBox(p - vec2(0.1280, -0.4402), vec2(0.2099, 0.0793), 0.0793));
  d = min(d, sdBox(p - vec2(0.0998, -0.6296), vec2(0.1561, 0.0614), 0.0614));
  d = min(d, sdBox(p - vec2(0.0307, -0.7896), vec2(0.1203, 0.0499), 0.0499));
  d = min(d, sdBox(p - vec2(-0.0896, -0.9291), vec2(0.0793, 0.0409), 0.0409));
  return d;
}

void main() {
  vec2 p = (vUv - .5) * 2.;
  float d = shape(p);
  if (d > .01) discard;

  // tile glitch: more tiles move when the page scrolls fast
  vec2 cell = floor(vUv * 16.);
  float h = hash(cell + floor(uTime * 3.));
  float g = step(.86 - min(abs(uVel) * .015, .35), h);
  vec2 uv = vUv + g * (vec2(hash(cell + 1.), hash(cell + 2.)) - .5) * .09;

  float n = fbm(uv * 3. + vec2(uTime * .04, -uScroll * .8));
  float m = fbm(uv * 6. - n * 2. + uTime * .05);
  vec3 col = mix(vec3(.02, .025, .05), vec3(.18, .92, .78), smoothstep(.45, .78, m));
  col = mix(col, vec3(1., .36, .24), smoothstep(.55, .85, n * m * 1.7));
  col *= .82 + .36 * hash(cell);
  col += (hash(vUv * 900. + uTime) - .5) * .12;

  float rim = smoothstep(-.026, -.008, d);
  vec3 irid = .55 + .45 * cos(6.2831 * (vUv.x * .8 + vUv.y * .6 + vBend * 3. + uTime * .08 + vec3(0., .33, .67)));
  col = mix(col, irid, rim);
  col = mix(col, vec3(.1, .1, .25), smoothstep(-.006, -.001, d));

  gl_FragColor = vec4(col, 1. - smoothstep(-.004, .006, d));
}`;

export function createHero(canvas: HTMLCanvasElement, anchor: HTMLElement) {
  const renderer = new Renderer({ canvas, dpr: Math.min(devicePixelRatio, 1.5), alpha: true, antialias: true });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const camera = new Camera(gl, { fov: 45 });
  camera.position.z = 5;
  const scene = new Transform();
  const program = new Program(gl, {
    vertex, fragment, transparent: true, cullFace: false,
    uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uVel: { value: 0 } },
  });
  const mesh = new Mesh(gl, { geometry: new Plane(gl, { widthSegments: 48, heightSegments: 48 }), program });
  mesh.setParent(scene);

  const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.perspective({ aspect: innerWidth / innerHeight }); };
  addEventListener('resize', resize);
  resize();

  let vel = 0, hidden = false;
  return {
    frame(t: number, v: number) {
      const r = anchor.getBoundingClientRect();
      const vh = innerHeight;
      if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) {
        if (!hidden) { gl.clear(gl.COLOR_BUFFER_BIT); hidden = true; }
        return;
      }
      hidden = false;
      const wpp = (2 * Math.tan((45 * Math.PI) / 360) * camera.position.z) / vh;
      const progress = 1 - (r.top + r.height / 2) / vh; // 0 at bottom of screen, 1 at top
      vel += (v - vel) * 0.1;
      mesh.scale.set(r.width * wpp, r.height * wpp, 1);
      mesh.position.set((r.left + r.width / 2 - innerWidth / 2) * wpp, -(r.top + r.height / 2 - vh / 2) * wpp, 0);
      mesh.rotation.z = (progress - 0.5) * 0.9 + Math.sin(t * 0.3) * 0.05;
      mesh.rotation.y = Math.sin(t * 0.4) * 0.25 + vel * 0.004;
      mesh.rotation.x = Math.cos(t * 0.35) * 0.15 + (progress - 0.5) * 0.5;
      program.uniforms.uTime.value = t;
      program.uniforms.uScroll.value = progress;
      program.uniforms.uVel.value = vel;
      renderer.render({ scene, camera });
    },
  };
}
