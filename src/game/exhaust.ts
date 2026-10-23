import * as THREE from "three";
import type { Quality } from "./world";

/*
 * ExhaustSystem — blue-white plasma engine flames + glowing ribbon trails.
 *
 * Everything is rebuilt each frame AFTER ships and the camera have been placed,
 * so flames never lag behind a fast-moving hull. Three batched draw calls total:
 *   1. flame chain  (Points)   — overlapping soft sprites along the jet axis;
 *      reads as a tapered flame from the side and a hot core from behind.
 *   2. core jets    (Instanced quads) — crisp white-hot streak through the flame.
 *   3. ribbons      (one indexed mesh) — short fading trails for engines and
 *      missiles; missiles' ribbons reveal their curved homing paths.
 */

const FLAME_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(0.6, -mv.z);
  gl_PointSize = min(aSize * uScale / depth, 260.0);
  vAlpha = aAlpha * smoothstep(1.5, 7.0, depth);   // never wash out the camera
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0) discard;
  float soft = pow(1.0 - d, 1.7);
  float core = pow(1.0 - d, 5.0);
  vec3 col = vColor * soft + vec3(1.0) * core * 0.85;
  gl_FragColor = vec4(col, soft * vAlpha);
}`;

const JET_VERT = /* glsl */ `
attribute vec3 iColor;
attribute float iAlpha;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vUv = uv; vColor = iColor;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vAlpha = iAlpha * smoothstep(1.5, 7.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const JET_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float across = abs(vUv.y - 0.5) * 2.0;
  float along = clamp(vUv.x, 0.0, 1.0);        // 0 = flame tip, 1 = nozzle
  float core = pow(clamp(1.0 - across / 0.34, 0.0, 1.0), 2.0);
  float glow = pow(clamp(1.0 - across, 0.0, 1.0), 2.2);
  float body = pow(along, 1.5);
  vec3 col = vec3(1.0) * core * (0.55 + along) + vColor * glow;
  float a = clamp(core * 0.9 + glow * 0.5, 0.0, 1.0) * body * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;

const TRAIL_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
attribute float aEdge;
varying vec3 vColor;
varying float vAlpha;
varying float vEdge;
void main(){
  vColor = aColor; vEdge = aEdge;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vAlpha = aAlpha * smoothstep(3.0, 14.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const TRAIL_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vEdge;
void main(){
  float e = abs(vEdge);
  float soft = 1.0 - smoothstep(0.0, 1.0, e);
  float core = pow(1.0 - e, 4.0);
  gl_FragColor = vec4(vColor * soft + vec3(1.0) * core * 0.5, soft * vAlpha);
}`;

const MAX_ENGINES = 180;
const SPRITES_PER_ENGINE = 12;          // flame chain + nozzle flare + shock diamonds
const SPRITE_CAP = MAX_ENGINES * SPRITES_PER_ENGINE;
const MAX_TRAILS = 200;
const MAXP = 40;                        // points per ribbon
const COMMIT_DT = 1 / 60;               // ribbon sampling interval (frame-rate independent)
const MAX_VERTS = MAX_TRAILS * MAXP * 2;
const MAX_IDX = MAX_TRAILS * (MAXP - 1) * 6;

interface EngineRec {
  p: THREE.Vector3; b: THREE.Vector3; r: number; c: THREE.Color;
  power: number; boost: number; seed: number; flicker: number;
}

interface Trail {
  active: boolean; dying: boolean;
  pos: Float32Array; birth: Float32Array; width: Float32Array; inten: Float32Array;
  head: number; count: number; life: number; color: THREE.Color; lastCommit: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class ExhaustSystem {
  private flameGeo: THREE.BufferGeometry;
  private flameMat: THREE.ShaderMaterial;
  private flames: THREE.Points;
  private fPos: Float32Array; private fCol: Float32Array; private fSize: Float32Array; private fAlpha: Float32Array;

  private jetMesh: THREE.InstancedMesh;
  private jetMat: THREE.ShaderMaterial;
  private jColor: THREE.InstancedBufferAttribute;
  private jAlpha: THREE.InstancedBufferAttribute;

  private trailGeo: THREE.BufferGeometry;
  private trailMat: THREE.ShaderMaterial;
  private trailMesh: THREE.Mesh;
  private tPos: Float32Array; private tCol: Float32Array; private tAlpha: Float32Array; private tEdge: Float32Array;
  private tIdx: Uint16Array;

  private engines: EngineRec[] = [];
  private engineCount = 0;
  private trails: Trail[] = [];
  private freeTrails: number[] = [];
  private now = 0;
  private flameSteps: number;
  private diamonds: boolean;

  private camPos = new THREE.Vector3();
  private m = new THREE.Matrix4();
  private vA = new THREE.Vector3(); private vB = new THREE.Vector3(); private vC = new THREE.Vector3();
  private side = new THREE.Vector3(); private prevSide = new THREE.Vector3();
  private col = new THREE.Color(); private white = new THREE.Color(1, 1, 1);

  constructor(private scene: THREE.Scene, quality: Quality) {
    this.flameSteps = quality === "low" ? 5 : 8;
    this.diamonds = quality !== "low";

    // ---- flame chain ----
    this.fPos = new Float32Array(SPRITE_CAP * 3);
    this.fCol = new Float32Array(SPRITE_CAP * 3);
    this.fSize = new Float32Array(SPRITE_CAP);
    this.fAlpha = new Float32Array(SPRITE_CAP);
    this.flameGeo = new THREE.BufferGeometry();
    this.flameGeo.setAttribute("position", new THREE.BufferAttribute(this.fPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.flameGeo.setAttribute("aColor", new THREE.BufferAttribute(this.fCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.flameGeo.setAttribute("aSize", new THREE.BufferAttribute(this.fSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.flameGeo.setAttribute("aAlpha", new THREE.BufferAttribute(this.fAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.flameGeo.setDrawRange(0, 0);
    this.flameMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.flames = new THREE.Points(this.flameGeo, this.flameMat);
    this.flames.frustumCulled = false;
    this.flames.renderOrder = 4;
    scene.add(this.flames);

    // ---- core jets ----
    const jetGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    jetGeo.translate(0.5, 0, 0); // x: 0 = flame tip, 1 = nozzle
    this.jColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENGINES * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.jAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENGINES), 1).setUsage(THREE.DynamicDrawUsage);
    jetGeo.setAttribute("iColor", this.jColor);
    jetGeo.setAttribute("iAlpha", this.jAlpha);
    this.jetMat = new THREE.ShaderMaterial({
      vertexShader: JET_VERT, fragmentShader: JET_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    this.jetMesh = new THREE.InstancedMesh(jetGeo, this.jetMat, MAX_ENGINES);
    this.jetMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.jetMesh.count = 0;
    this.jetMesh.frustumCulled = false;
    this.jetMesh.renderOrder = 4;
    scene.add(this.jetMesh);

    // ---- ribbons ----
    this.tPos = new Float32Array(MAX_VERTS * 3);
    this.tCol = new Float32Array(MAX_VERTS * 3);
    this.tAlpha = new Float32Array(MAX_VERTS);
    this.tEdge = new Float32Array(MAX_VERTS);
    this.tIdx = new Uint16Array(MAX_IDX);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setAttribute("aColor", new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setAttribute("aAlpha", new THREE.BufferAttribute(this.tAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setAttribute("aEdge", new THREE.BufferAttribute(this.tEdge, 1).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setIndex(new THREE.BufferAttribute(this.tIdx, 1).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setDrawRange(0, 0);
    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    this.trailMesh = new THREE.Mesh(this.trailGeo, this.trailMat);
    this.trailMesh.frustumCulled = false;
    this.trailMesh.renderOrder = 3;
    scene.add(this.trailMesh);

    for (let i = 0; i < MAX_TRAILS; i++) {
      this.trails.push({
        active: false, dying: false,
        pos: new Float32Array(MAXP * 3), birth: new Float32Array(MAXP),
        width: new Float32Array(MAXP), inten: new Float32Array(MAXP),
        head: -1, count: 0, life: 0.3, color: new THREE.Color(), lastCommit: -1e9,
      });
      this.freeTrails.push(MAX_TRAILS - 1 - i);
    }
    for (let i = 0; i < MAX_ENGINES; i++) {
      this.engines.push({ p: new THREE.Vector3(), b: new THREE.Vector3(), r: 1, c: new THREE.Color(), power: 0, boost: 0, seed: 0, flicker: 1 });
    }
  }

  /** Call once per frame before adding engines. */
  beginFrame() { this.engineCount = 0; }

  /**
   * Register one engine nozzle for this frame.
   * @param back   unit vector pointing out of the nozzle (ship backward)
   * @param radius nozzle radius in world units
   * @param power  0 = idle … 1 = full throttle
   * @param boost  0 … 1 turbo amount (longer, brighter flame)
   * @param flicker 1 = healthy; <1 sputters (damaged engine)
   */
  addEngine(pos: THREE.Vector3, back: THREE.Vector3, radius: number, color: THREE.Color, power: number, boost: number, seed: number, flicker = 1) {
    if (this.engineCount >= MAX_ENGINES) return;
    const e = this.engines[this.engineCount++];
    e.p.copy(pos); e.b.copy(back); e.r = radius; e.c.copy(color);
    e.power = power; e.boost = boost; e.seed = seed; e.flicker = flicker;
  }

  // ------------------------------------------------------------ ribbons
  createTrail(life: number, color: THREE.ColorRepresentation): number {
    const id = this.freeTrails.pop();
    if (id === undefined) return -1;
    const tr = this.trails[id];
    tr.active = true; tr.dying = false; tr.count = 0; tr.head = -1;
    tr.life = life; tr.color.set(color); tr.lastCommit = -1e9;
    return id;
  }
  pushTrail(id: number, pos: THREE.Vector3, halfWidth: number, intensity: number) {
    if (id < 0) return;
    const tr = this.trails[id];
    if (!tr || !tr.active || tr.dying) return;
    if (tr.count === 0 || this.now - tr.lastCommit >= COMMIT_DT) {
      tr.head = (tr.head + 1) % MAXP;
      if (tr.count < MAXP) tr.count++;
      tr.lastCommit = this.now;
    }
    const h = tr.head;
    tr.pos[h * 3] = pos.x; tr.pos[h * 3 + 1] = pos.y; tr.pos[h * 3 + 2] = pos.z;
    tr.birth[h] = this.now; tr.width[h] = halfWidth; tr.inten[h] = intensity;
  }
  setTrailLife(id: number, life: number) {
    if (id >= 0 && this.trails[id]?.active) this.trails[id].life = life;
  }
  /** Stop feeding a trail; it fades out naturally and returns to the pool. */
  releaseTrail(id: number) {
    if (id < 0) return;
    const tr = this.trails[id];
    if (tr && tr.active) tr.dying = true;
  }
  clear() {
    this.freeTrails.length = 0;
    for (let i = MAX_TRAILS - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.active = false; tr.dying = false; tr.count = 0; tr.head = -1;
      this.freeTrails.push(i);
    }
    this.engineCount = 0;
  }

  /** Build all GPU buffers. Call after ships AND camera are final for the frame. */
  endFrame(camera: THREE.PerspectiveCamera, dt: number, bufferHeight: number) {
    this.now += dt;
    camera.getWorldPosition(this.camPos);
    this.flameMat.uniforms.uScale.value = bufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5));
    this.writeFlames();
    this.writeTrails();
  }

  private writeFlames() {
    const S = this.flameSteps;
    let si = 0;
    let ji = 0;
    const fp = this.fPos, fc = this.fCol, fs = this.fSize, fa = this.fAlpha;
    const jc = this.jColor.array as Float32Array, ja = this.jAlpha.array as Float32Array;
    const el = this.m.elements;
    const put = (x: number, y: number, z: number, size: number, r: number, g: number, b: number, a: number) => {
      if (si >= SPRITE_CAP) return;
      fp[si * 3] = x; fp[si * 3 + 1] = y; fp[si * 3 + 2] = z;
      fc[si * 3] = r; fc[si * 3 + 1] = g; fc[si * 3 + 2] = b;
      fs[si] = size; fa[si] = a;
      si++;
    };

    for (let e = 0; e < this.engineCount; e++) {
      const E = this.engines[e];
      const pw = clamp01(E.power);
      const bo = clamp01(E.boost);
      const flick = (0.86 + 0.1 * Math.sin(this.now * 47 + E.seed * 13.7) + 0.06 * Math.sin(this.now * 93 + E.seed * 5.3)) * E.flicker;
      const inten = (0.42 + 0.7 * pw) * (1 + 0.6 * bo) * flick;
      const len = E.r * (3.0 + 8.0 * pw) * (1 + 1.3 * bo);
      const px = E.p.x, py = E.p.y, pz = E.p.z, bx = E.b.x, by = E.b.y, bz = E.b.z;

      // flame chain: white-hot at the nozzle → engine colour → deep blue tail
      for (let i = 0; i < S; i++) {
        const t = i / (S - 1);
        const d = len * (0.04 + 0.96 * Math.pow(t, 1.25));
        const mixT = THREE.MathUtils.smoothstep(t, 0.08, 0.65);
        this.col.copy(this.white).lerp(E.c, mixT);
        if (t > 0.7) this.col.multiplyScalar(1 - 0.35 * ((t - 0.7) / 0.3));
        put(px + bx * d, py + by * d, pz + bz * d,
          E.r * 2 * (1.7 - 1.15 * t) * (1 + 0.25 * bo),
          this.col.r, this.col.g, this.col.b,
          inten * Math.pow(1 - t, 1.3) * 0.8);
      }
      // nozzle flare — the hot spot you see looking into the engine
      this.col.copy(this.white).lerp(E.c, 0.25);
      put(px + bx * E.r * 0.2, py + by * E.r * 0.2, pz + bz * E.r * 0.2,
        E.r * 2.9 * (1 + 0.35 * bo), this.col.r, this.col.g, this.col.b, 0.7 * inten);
      // shock diamonds while boosting
      if (this.diamonds && bo > 0.25) {
        for (const k of [0.22, 0.4, 0.58]) {
          const d = len * k;
          put(px + bx * d, py + by * d, pz + bz * d, E.r * 1.15, 0.85, 0.95, 1.0, 0.55 * bo * inten * (1 - k));
        }
      }

      // core jet — camera-facing streak from flame tip (x=0) to nozzle (x=1)
      if (ji < MAX_ENGINES) {
        const jl = len * 1.1;
        const tail = this.vA.set(px + bx * jl, py + by * jl, pz + bz * jl);
        const ax = this.vB.set(-bx, -by, -bz);                               // tip → nozzle
        const toCam = this.vC.set(this.camPos.x - px, this.camPos.y - py, this.camPos.z - pz);
        const across = this.side.crossVectors(toCam, ax);
        if (across.lengthSq() < 1e-8) across.set(0, 1, 0).cross(ax);
        across.normalize();
        const face = this.prevSide.crossVectors(ax, across).normalize();
        const w = E.r * 1.15 * (1 + 0.25 * bo);
        el[0] = ax.x * jl; el[1] = ax.y * jl; el[2] = ax.z * jl; el[3] = 0;
        el[4] = across.x * w; el[5] = across.y * w; el[6] = across.z * w; el[7] = 0;
        el[8] = face.x; el[9] = face.y; el[10] = face.z; el[11] = 0;
        el[12] = tail.x; el[13] = tail.y; el[14] = tail.z; el[15] = 1;
        this.jetMesh.setMatrixAt(ji, this.m);
        this.col.copy(E.c).lerp(this.white, 0.3);
        jc[ji * 3] = this.col.r; jc[ji * 3 + 1] = this.col.g; jc[ji * 3 + 2] = this.col.b;
        ja[ji] = 0.85 * inten;
        ji++;
      }
    }

    this.flameGeo.setDrawRange(0, si);
    this.markRange(this.flameGeo.getAttribute("position") as THREE.BufferAttribute, si * 3);
    this.markRange(this.flameGeo.getAttribute("aColor") as THREE.BufferAttribute, si * 3);
    this.markRange(this.flameGeo.getAttribute("aSize") as THREE.BufferAttribute, si);
    this.markRange(this.flameGeo.getAttribute("aAlpha") as THREE.BufferAttribute, si);
    this.jetMesh.count = ji;
    if (ji > 0) {
      this.jetMesh.instanceMatrix.needsUpdate = true;
      this.jColor.needsUpdate = true;
      this.jAlpha.needsUpdate = true;
    }
  }

  private writeTrails() {
    let v = 0;      // vertex cursor
    let ii = 0;     // index cursor
    const P = this.tPos, C = this.tCol, A = this.tAlpha, E = this.tEdge, I = this.tIdx;
    for (let id = 0; id < MAX_TRAILS; id++) {
      const tr = this.trails[id];
      if (!tr.active) continue;
      // age out the oldest points
      while (tr.count > 0) {
        const oldest = (tr.head - tr.count + 1 + MAXP) % MAXP;
        if (this.now - tr.birth[oldest] > tr.life) tr.count--; else break;
      }
      if (tr.count === 0) {
        if (tr.dying) { tr.active = false; tr.dying = false; this.freeTrails.push(id); }
        continue;
      }
      if (tr.count < 2 || v + tr.count * 2 > MAX_VERTS) continue;

      const base = v;
      this.prevSide.set(0, 1, 0);
      for (let i = 0; i < tr.count; i++) {
        const idx = (tr.head - i + MAXP) % MAXP;
        const newer = (tr.head - Math.max(0, i - 1) + MAXP) % MAXP;
        const older = (tr.head - Math.min(tr.count - 1, i + 1) + MAXP) % MAXP;
        const px = tr.pos[idx * 3], py = tr.pos[idx * 3 + 1], pz = tr.pos[idx * 3 + 2];
        const tan = this.vA.set(
          tr.pos[newer * 3] - tr.pos[older * 3],
          tr.pos[newer * 3 + 1] - tr.pos[older * 3 + 1],
          tr.pos[newer * 3 + 2] - tr.pos[older * 3 + 2],
        );
        const view = this.vB.set(this.camPos.x - px, this.camPos.y - py, this.camPos.z - pz);
        this.side.crossVectors(tan, view);
        if (this.side.lengthSq() < 1e-10) this.side.copy(this.prevSide);
        else this.side.normalize();
        this.prevSide.copy(this.side);

        const u = clamp01((this.now - tr.birth[idx]) / tr.life);   // 0 head → 1 tail
        const hw = tr.width[idx] * (0.3 + 0.7 * (1 - u));
        const alpha = tr.inten[idx] * Math.pow(1 - u, 1.4);
        this.col.copy(this.white).lerp(tr.color, Math.min(1, u * 3)).multiplyScalar(1 + 0.4 * (1 - u));

        for (let s = -1; s <= 1; s += 2) {
          P[v * 3] = px + this.side.x * hw * s;
          P[v * 3 + 1] = py + this.side.y * hw * s;
          P[v * 3 + 2] = pz + this.side.z * hw * s;
          C[v * 3] = this.col.r; C[v * 3 + 1] = this.col.g; C[v * 3 + 2] = this.col.b;
          A[v] = alpha; E[v] = s;
          v++;
        }
        if (i > 0) {
          const a0 = base + (i - 1) * 2, a1 = a0 + 1, b0 = base + i * 2, b1 = b0 + 1;
          I[ii++] = a0; I[ii++] = b0; I[ii++] = a1;
          I[ii++] = a1; I[ii++] = b0; I[ii++] = b1;
        }
      }
    }
    this.trailGeo.setDrawRange(0, ii);
    this.markRange(this.trailGeo.getAttribute("position") as THREE.BufferAttribute, v * 3);
    this.markRange(this.trailGeo.getAttribute("aColor") as THREE.BufferAttribute, v * 3);
    this.markRange(this.trailGeo.getAttribute("aAlpha") as THREE.BufferAttribute, v);
    this.markRange(this.trailGeo.getAttribute("aEdge") as THREE.BufferAttribute, v);
    this.markRange(this.trailGeo.getIndex()!, ii);
  }

  /** Upload only the populated prefix of a dynamic buffer. */
  private markRange(attr: THREE.BufferAttribute, count: number) {
    if (count <= 0) return;
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, count);
    attr.needsUpdate = true;
  }

  get activeTrails() { return MAX_TRAILS - this.freeTrails.length; }
  get engineTotal() { return this.engineCount; }

  dispose() {
    this.scene.remove(this.flames, this.jetMesh, this.trailMesh);
    this.flameGeo.dispose(); this.flameMat.dispose();
    this.jetMesh.geometry.dispose(); this.jetMat.dispose();
    this.trailGeo.dispose(); this.trailMat.dispose();
  }
}
