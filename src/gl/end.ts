import { Renderer, Triangle, Program, Mesh } from 'ogl';

// End scene: a starfield with a glowing core.

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`;

const fragment = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), u.x), u.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }

vec3 stars(vec2 uv, float s, float k) {
  vec2 g = uv * s, id = floor(g), f = fract(g) - .5;
  float h = hash(id + k);
  if (h < .9) return vec3(0.);
  vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - .5;
  float d = length(f - o * .7);
  float tw = .55 + .45 * sin(uTime * 2. + h * 60.);
  return vec3(1.) * smoothstep(.07, 0., d) * tw * (h - .9) * 10.;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 col = stars(uv, 60., 0.) * .5 + stars(uv, 30., 3.) * .8 + stars(uv + uTime * .002, 14., 5.);

  float R = .245;
  float r = length(uv);

  if (r < R) {
    vec2 sp = uv / R;
    float z = sqrt(1. - dot(sp, sp));
    vec2 suv = vec2(atan(sp.x, z) + uTime * .08, sp.y * 1.4);
    float f = fbm(suv * 3. + fbm(suv * 4. + uTime * .12) * 1.6);
    vec3 core = mix(vec3(.62, .1, .02), vec3(1., .72, .3), smoothstep(.35, .85, f));
    col = core * (.55 + .7 * z) + vec3(1., .5, .1) * pow(1. - z, 3.) * .8;
  } else {
    float flick = fbm(vec2(atan(uv.y, uv.x) * 3., r * 5. - uTime * .35));
    float glow = exp(-(r - R) * 17.);
    col += vec3(1., .42, .08) * glow * (.45 + flick * .9);
  }

  gl_FragColor = vec4(col, 1.);
}`;

export function createEnd(canvas: HTMLCanvasElement) {
  const renderer = new Renderer({ canvas, dpr: Math.min(devicePixelRatio, 1.25) });
  const gl = renderer.gl;
  const program = new Program(gl, { vertex, fragment, uniforms: { uTime: { value: 0 }, uRes: { value: [1, 1] } } });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  const resize = () => {
    const { width, height } = canvas.parentElement!.getBoundingClientRect();
    renderer.setSize(width, height);
    program.uniforms.uRes.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
  };
  addEventListener('resize', resize);
  resize();

  return {
    visible: true,
    frame(t: number) {
      program.uniforms.uTime.value = t;
      renderer.render({ scene: mesh });
    },
  };
}
