import type { RoomMaterial } from "../roomExperience";
import { ROOM_MATERIALS } from "../roomExperience";

export interface RoomFrame {
  material: RoomMaterial;
  previousMaterial: RoomMaterial;
  mix: number;
  time: number;
  breath: number;
  progress: number;
  pointer: { x: number; y: number; strength: number };
  still: boolean;
  weights?: ArrayLike<number>;
}

export interface RoomRenderer {
  resize(width: number, height: number, dpr: number): void;
  draw(frame: RoomFrame): void;
  destroy(): void;
}

export const ROOM_PALETTES: Record<
  RoomMaterial,
  readonly [paper: string, mid: string, deep: string]
> = {
  mist: ["#f6f1e6", "#cfd8ee", "#9fadd6"],
  waves: ["#f2eee2", "#7fb4b4", "#3f6d78"],
  sand: ["#f3ead6", "#dcbf8a", "#a9824e"],
  cells: ["#f4efe6", "#b9a7c4", "#7fa08e"],
  snow: ["#f4f4f7", "#ccd4ec", "#8d9cc8"],
  ink: ["#f5efe2", "#8a93c9", "#4b5390"],
};

const hex = (s: string) => {
  const n = parseInt(s.slice(1), 16);
  return `vec3(${(n >> 16) / 255}, ${((n >> 8) & 255) / 255}, ${(n & 255) / 255})`;
};

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform float uBreath;
uniform float uProgress;
uniform vec3 uPointer;
uniform float uW[6];

const vec3 P_MIST_A = ${hex(ROOM_PALETTES.mist[0])};
const vec3 P_MIST_B = ${hex(ROOM_PALETTES.mist[1])};
const vec3 P_MIST_C = ${hex(ROOM_PALETTES.mist[2])};
const vec3 P_WAVES_A = ${hex(ROOM_PALETTES.waves[0])};
const vec3 P_WAVES_B = ${hex(ROOM_PALETTES.waves[1])};
const vec3 P_WAVES_C = ${hex(ROOM_PALETTES.waves[2])};
const vec3 P_SAND_A = ${hex(ROOM_PALETTES.sand[0])};
const vec3 P_SAND_B = ${hex(ROOM_PALETTES.sand[1])};
const vec3 P_SAND_C = ${hex(ROOM_PALETTES.sand[2])};
const vec3 P_CELLS_A = ${hex(ROOM_PALETTES.cells[0])};
const vec3 P_CELLS_B = ${hex(ROOM_PALETTES.cells[1])};
const vec3 P_CELLS_C = ${hex(ROOM_PALETTES.cells[2])};
const vec3 P_SNOW_A = ${hex(ROOM_PALETTES.snow[0])};
const vec3 P_SNOW_B = ${hex(ROOM_PALETTES.snow[1])};
const vec3 P_SNOW_C = ${hex(ROOM_PALETTES.snow[2])};
const vec3 P_INK_A = ${hex(ROOM_PALETTES.ink[0])};
const vec3 P_INK_B = ${hex(ROOM_PALETTES.ink[1])};
const vec3 P_INK_C = ${hex(ROOM_PALETTES.ink[2])};

float hash(vec2 p) {
  p = fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

float duneH(vec2 p, float t, float prog) {
  float warp = fbm(p * 1.9) * (6.0 - 1.4 * prog);
  return sin(p.y * (16.0 - 4.0 * prog) + warp + p.x * 2.0 - t * 0.06);
}

vec3 matSand(vec2 p, float t, float prog, vec2 pd, float pinf) {
  vec2 q = p + pd * pinf * 0.55 + vec2(uBreath * 0.012, uBreath * 0.006);
  float ridgeAmp = 1.0 - 0.55 * prog;
  float h = duneH(q, t, prog);
  float h2 = duneH(q + vec2(0.012, 0.02), t, prog);
  float ridges = sin(q.y * 65.0 + fbm(q * 2.1) * 9.0) * 0.5 * ridgeAmp;
  float height = h * 0.5 + 0.5 + ridges * 0.18;
  float slope = h2 - h;
  vec3 lit = P_SAND_A;
  vec3 mid = P_SAND_B;
  vec3 shade = P_SAND_C;
  vec3 col = mix(mid, lit, clamp(height * 0.85 + 0.1, 0.0, 1.0));
  col = mix(col, shade, clamp(-slope * 9.0 + ridges * 0.35, 0.0, 0.55));
  col += (vnoise(q * 90.0) - 0.5) * 0.05;
  return col;
}

vec3 matSnow(vec2 p, float t, float prog, vec2 pd, float pinf) {
  vec2 q = p - pd * pinf * 0.3 + vec2(0.0, uBreath * 0.008);
  float drift = fbm(q * 2.0) + 0.2 * sin(q.y * 7.0 + q.x * 2.0 + fbm(q) * 3.0);
  float drift2 = fbm((q + vec2(0.03, 0.025)) * 2.0)
    + 0.2 * sin((q.y + 0.025) * 7.0 + (q.x + 0.03) * 2.0 + fbm(q + vec2(0.03)) * 3.0);
  float detail = fbm(q * 9.0) * (0.10 * (1.0 - 0.6 * prog));
  float h = drift + detail + uBreath * 0.05;
  float lit = clamp(h * 1.1, 0.0, 1.0);
  vec3 col = mix(P_SNOW_C, mix(P_SNOW_B, P_SNOW_A, lit), clamp(lit * 0.9 + 0.18, 0.0, 1.0));
  float lee = clamp((drift2 - drift) * 6.0, 0.0, 0.4);
  col = mix(col, P_SNOW_C, lee * 0.5);
  float speck = step(0.995, hash(gl_FragCoord.xy));
  col = mix(col, P_SNOW_A, speck * 0.14);
  return col;
}

vec3 matWaves(vec2 p, float t, float prog, vec2 pd, float pinf) {
  vec2 q = p + pd * pinf * 0.4;
  float spacing = 1.0 + uBreath * 0.05 + prog * 0.15;
  vec2 q1 = q * spacing;
  vec2 q2 = vec2(q.x * 0.94 - q.y * 0.34, q.x * 0.34 + q.y * 0.94) * (spacing * 0.92);
  float warp = fbm(q * 2.0 + t * 0.04);
  float w1 = sin(q1.y * 10.0 + warp * 4.0 + t * 0.30);
  float w2 = sin(q2.y * 13.0 + fbm(q2 * 2.4 - t * 0.03) * 5.0 - t * 0.22);
  float band = smoothstep(-0.4, 0.9, w1) * 0.5 + smoothstep(-0.6, 0.8, w2) * 0.35;
  vec3 col = mix(P_WAVES_A, P_WAVES_B, clamp(band, 0.0, 1.0) * 0.75);
  float ridge = smoothstep(0.985, 1.0, abs(w1 * w2));
  float caustic = smoothstep(0.96, 1.0, w1) * smoothstep(0.92, 1.0, w2);
  col = mix(col, P_WAVES_A, ridge * 0.35 + caustic * 0.5);
  col = mix(col, P_WAVES_C, smoothstep(0.75, 1.0, band) * 0.35);
  return col;
}

vec3 matCells(vec2 p, float t, float prog, vec2 pd, float pinf) {
  vec2 q = p + vec2(uBreath * 0.010, -uBreath * 0.006);
  vec2 g = q * vec2(5.0, 4.0);
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float density = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 seed = cell + o;
      vec2 c = o + vec2(hash(seed), hash(seed + 19.19)) - f;
      c += vec2(
        sin(t * 0.10 + hash(seed + 3.7) * 6.28),
        cos(t * 0.09 + hash(seed + 7.1) * 6.28)
      ) * (0.14 * (1.0 - 0.5 * prog));
      c += pd * pinf * 1.4;
      float d = dot(c, c);
      density += exp(-d * 5.5 * (1.0 + prog * 0.25));
    }
  }
  float body = smoothstep(0.20, 0.68, density);
  float rim = smoothstep(0.16, 0.26, density) * (1.0 - smoothstep(0.26, 0.44, density));
  vec3 tint = mix(P_CELLS_B, P_CELLS_C, fbm(q * 1.7));
  vec3 col = mix(P_CELLS_A, tint, body * 0.58);
  col = mix(col, mix(tint, P_CELLS_A, 0.75), rim * 0.55);
  col = mix(col, P_CELLS_A, smoothstep(0.8, 1.2, density) * 0.25);
  return col;
}

vec3 matInk(vec2 p, float t, float prog, vec2 pd, float pinf) {
  float aspect = uResolution.x / uResolution.y;
  vec2 q = p + pd * pinf * 0.8 + vec2(uBreath * 0.008, uBreath * 0.010);
  vec2 ce = (q - vec2(aspect * 0.5, 0.5)) * vec2(1.0, 0.85);
  float edgeDist = smoothstep(0.15, 0.95, length(ce));
  float warp = fbm(q * 1.7 + vec2(t * 0.015, -t * 0.011));
  float wash = fbm(q * 1.7 + warp * (1.5 + prog * 0.7));
  float bloom = smoothstep(0.42, 0.72, wash * (0.45 + edgeDist * 0.75));
  float feather = smoothstep(0.30, 0.62, wash * (0.35 + edgeDist * 0.8));
  vec3 col = P_INK_A;
  col = mix(col, P_INK_B, feather * (0.5 - prog * 0.15));
  col = mix(col, P_INK_C, bloom * (0.62 - prog * 0.25));
  float aperture = smoothstep(0.62, 0.85, fbm(q * 2.6 - warp));
  col = mix(col, P_INK_A, aperture * 0.35 * edgeDist);
  return col;
}

vec3 matMist(vec2 p, float t, float prog, vec2 pd, float pinf) {
  vec2 q = p + pd * pinf * 0.35;
  float n = fbm(q * 2.2 + vec2(t * 0.03, -t * 0.02));
  float folds = sin((q.y + n * 0.9) * 9.0 + t * 0.05);
  float folds2 = sin((q.y + fbm(q * 3.1 - t * 0.02) * 0.7) * 14.0 - t * 0.04);
  float shade = folds * 0.5 + 0.5;
  vec3 col = mix(P_MIST_A, P_MIST_B, shade * 0.5 + folds2 * 0.08);
  col = mix(col, P_MIST_C, smoothstep(0.75, 1.0, shade) * 0.30 + uBreath * 0.05);
  return col;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime;
  float prog = clamp(uProgress, 0.0, 1.0);
  vec2 pd = p - vec2(uPointer.x * aspect, uPointer.y);
  float pinf = uPointer.z * exp(-dot(pd, pd) * 18.0);

  vec3 col = vec3(0.0);
  float total = 0.0;
  float w;
  w = uW[0]; if (w > 0.001) { col += matMist(p, t, prog, pd, pinf) * w; total += w; }
  w = uW[1]; if (w > 0.001) { col += matWaves(p, t, prog, pd, pinf) * w; total += w; }
  w = uW[2]; if (w > 0.001) { col += matSand(p, t, prog, pd, pinf) * w; total += w; }
  w = uW[3]; if (w > 0.001) { col += matCells(p, t, prog, pd, pinf) * w; total += w; }
  w = uW[4]; if (w > 0.001) { col += matSnow(p, t, prog, pd, pinf) * w; total += w; }
  w = uW[5]; if (w > 0.001) { col += matInk(p, t, prog, pd, pinf) * w; total += w; }
  col = total > 0.001 ? col / total : matMist(p, t, prog, pd, pinf);

  float edge = smoothstep(0.12, 0.68, length((uv - 0.5) * vec2(aspect, 0.85)));
  vec3 paper = mix(P_MIST_A, col, 0.25);
  col = mix(col, paper, (1.0 - edge) * 0.55);
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.018 * (0.4 + 0.6 * edge);
  gl_FragColor = vec4(col, 1.0);
}
`;

const MAX_PIXELS = 900000;
const MAX_DPR = 1.5;
const UNIFORMS = [
  "uResolution",
  "uTime",
  "uBreath",
  "uProgress",
  "uPointer",
  "uW[0]",
] as const;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createRoomRenderer(
  canvas: HTMLCanvasElement,
  onStatus?: (status: "webgl" | "fallback") => void,
): RoomRenderer | null {
  if (typeof canvas.getContext !== "function") return null;
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    }) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;

  interface Pipeline {
    program: WebGLProgram;
    buffer: WebGLBuffer;
    uniforms: Map<string, WebGLUniformLocation | null>;
  }

  const build = (ctx: WebGLRenderingContext): Pipeline | null => {
    const vs = compile(ctx, ctx.VERTEX_SHADER, VERT);
    const fs = compile(ctx, ctx.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      if (vs) ctx.deleteShader(vs);
      if (fs) ctx.deleteShader(fs);
      return null;
    }
    const program = ctx.createProgram();
    if (!program) {
      ctx.deleteShader(vs);
      ctx.deleteShader(fs);
      return null;
    }
    ctx.attachShader(program, vs);
    ctx.attachShader(program, fs);
    ctx.linkProgram(program);
    ctx.deleteShader(vs);
    ctx.deleteShader(fs);
    if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
      ctx.deleteProgram(program);
      return null;
    }
    const buffer = ctx.createBuffer();
    if (!buffer) {
      ctx.deleteProgram(program);
      return null;
    }
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
    ctx.bufferData(
      ctx.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      ctx.STATIC_DRAW,
    );
    const loc = ctx.getAttribLocation(program, "aPos");
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    for (const name of UNIFORMS) uniforms.set(name, ctx.getUniformLocation(program, name));
    return { program, buffer, uniforms };
  };

  let pipe = build(gl);
  if (!pipe) return null;

  const weights = new Float32Array(ROOM_MATERIALS.length);

  const onLost = (e: Event) => {
    e.preventDefault();
    pipe = null;
    onStatus?.("fallback");
  };
  const onRestored = () => {
    const ctx = gl;
    if (!ctx) return;
    const rebuilt = build(ctx);
    pipe = rebuilt;
    if (rebuilt) {
      ctx.viewport(0, 0, canvas.width, canvas.height);
      onStatus?.("webgl");
    } else {
      onStatus?.("fallback");
    }
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  let destroyed = false;

  return {
    resize(width, height, dpr) {
      const capped = Math.min(dpr || 1, MAX_DPR);
      let w = Math.max(1, Math.round(width * capped));
      let h = Math.max(1, Math.round(height * capped));
      const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)));
      w = Math.max(1, Math.floor(w * scale));
      h = Math.max(1, Math.floor(h * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl?.viewport(0, 0, w, h);
    },
    draw(frame) {
      const ctx = gl;
      if (!ctx || destroyed || !pipe || ctx.isContextLost()) return;
      ctx.useProgram(pipe.program);
      const w = frame.weights;
      if (w && w.length === weights.length) {
        weights.set(w);
      } else {
        weights.fill(0);
        const from = ROOM_MATERIALS.indexOf(frame.previousMaterial);
        const to = ROOM_MATERIALS.indexOf(frame.material);
        if (from >= 0) weights[from] = 1 - frame.mix;
        if (to >= 0) weights[to] = frame.mix;
      }
      const u = pipe.uniforms;
      ctx.uniform2f(u.get("uResolution") ?? null, canvas.width, canvas.height);
      ctx.uniform1f(u.get("uTime") ?? null, frame.time);
      ctx.uniform1f(u.get("uBreath") ?? null, frame.breath);
      ctx.uniform1f(u.get("uProgress") ?? null, frame.progress);
      ctx.uniform3f(
        u.get("uPointer") ?? null,
        frame.pointer.x,
        frame.pointer.y,
        frame.still ? 0 : frame.pointer.strength,
      );
      ctx.uniform1fv(u.get("uW[0]") ?? null, weights);
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
    },
    destroy() {
      destroyed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      const ctx = gl;
      if (ctx && pipe) {
        ctx.deleteBuffer(pipe.buffer);
        ctx.deleteProgram(pipe.program);
      }
      pipe = null;
      gl = null;
    },
  };
}
