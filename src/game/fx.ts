import * as THREE from "three";
import { glowTexture, type Quality } from "./world";

const pVert = /* glsl */ `uniform float uScale; attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
varying vec3 vC; varying float vA;
void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
gl_PointSize = min(aSize * (uScale / max(1.0, -mv.z)), 512.0); gl_Position = projectionMatrix * mv; }`;
const pFrag = /* glsl */ `uniform sampler2D uTex; varying vec3 vC; varying float vA;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC, 1.0) * t * vA; }`;

/**
 * Glowing bullet HEAD — a small sphere with a blazing white core and a coloured
 * halo. Colour and style come from PER-INSTANCE attributes so every weapon
 * renders its own colour in a single draw call.
 */
const bulletVert = /* glsl */ `
attribute vec3 iCol;
attribute float iKind;
varying vec3 vN; varying vec3 vP; varying vec3 vCol; varying float vKind;
void main(){
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vP = mv.xyz; vCol = iCol; vKind = iKind;
  gl_Position = projectionMatrix * mv;
}`;
const bulletFrag = /* glsl */ `
uniform float uTime;
varying vec3 vN; varying vec3 vP; varying vec3 vCol; varying float vKind;
void main(){
  vec3 nv = normalize(vN); vec3 ep = normalize(-vP);
  float f = clamp(dot(nv, ep), 0.0, 1.0);
  // blazing white core, saturated coloured shell, soft outer halo
  float core = pow(f, 26.0);
  float shell = pow(f, 3.0);
  float halo  = pow(f, 1.1);
  vec3 col = vec3(1.0) * core * 2.4          // white-hot centre
           + vCol * shell * 1.9              // coloured plasma shell
           + vCol * halo * 0.5;              // soft aura
  // DARK SINGULARITY: black centre inside a violet ring
  if (vKind > 0.5 && vKind < 1.5) {
    float ring = smoothstep(0.75, 0.35, f) * smoothstep(0.05, 0.3, f);
    col = vCol * ring * 3.0 + vec3(0.35, 0.1, 0.8) * pow(1.0 - f, 2.0);
    gl_FragColor = vec4(col, clamp(ring + pow(1.0 - f, 3.0) * 0.6, 0.0, 1.0));
    return;
  }
  // SPECTRAL: cooler, wispier
  if (vKind > 1.5 && vKind < 2.5) col = mix(col, col * vec3(0.8, 1.15, 1.3), 0.7);
  gl_FragColor = vec4(col, clamp(core * 1.5 + shell * 0.8 + halo * 0.35, 0.0, 1.0));
}`;

/**
 * Camera-facing BEAM streak. A quad stretched along the travel direction that
 * always turns its face toward the camera, so the shot reads as a bright
 * blue-white bolt no matter the viewing angle.
 *   uv.x : 0 = tail -> 1 = head
 *   uv.y : 0.5 = centre line
 */
const beamVert = /* glsl */ `
attribute vec3 iCol;
attribute float iKind;
varying vec2 vUv; varying vec3 vCol; varying float vKind;
void main(){
  vUv = uv; vCol = iCol; vKind = iKind;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const beamFrag = /* glsl */ `
varying vec2 vUv; varying vec3 vCol; varying float vKind;
void main(){
  float across = abs(vUv.y - 0.5) * 2.0;   // 0 at centre line, 1 at edge
  float along  = clamp(vUv.x, 0.0, 1.0);   // 0 tail, 1 head

  // razor-thin white core
  float core = pow(clamp(1.0 - across / 0.22, 0.0, 1.0), 2.0);
  // wide coloured glow
  float glow = pow(clamp(1.0 - across, 0.0, 1.0), 2.3);
  // bright rounded head, tapering tail
  float head  = smoothstep(0.55, 1.0, along);
  float taper = pow(along, 1.4);

  vec3 col = vec3(1.0) * core * (1.1 + head * 1.5)   // white centre
           + vCol * glow * (0.85 + head * 0.9);      // coloured aura
  float a = clamp(core * 0.95 + glow * 0.5, 0.0, 1.0) * taper;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;

export interface FXOptions {
  count?: number; speed?: number; size?: number; life?: number; drag?: number; dir?: THREE.Vector3; cone?: number;
  sizeVar?: number; lifeVar?: number; speedVar?: number; alpha?: number; gravity?: number; grow?: number;
  color?: number | number[];
}

export class FXSystem {
  private cap: number;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseSize: Float32Array;
  private grow: Float32Array;
  private drag: Float32Array;
  private baseAlpha: Float32Array;
  private n = 0;
  private geo: THREE.BufferGeometry;
  private points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  private glowTex: THREE.Texture;

  // ----- Energy bullets -----
  readonly projCap: number;
  private bulletMesh: THREE.InstancedMesh;
  private bulletMat: THREE.ShaderMaterial;
  private bulletColor: THREE.InstancedBufferAttribute;
  private bulletKind: THREE.InstancedBufferAttribute;
  private bulletData: { pos: THREE.Vector3; vel: THREE.Vector3; dir: THREE.Vector3; kind: number; color: THREE.Color; size: number; life: number; dmg: number; radius: number; splash: number; shieldMul: number; slow: number; homing: number; targetId: string | null; owner: string; team: 0 | 1; trailLen: number; prevPos: THREE.Vector3 }[] = [];
  private bulletIdx: number[] = [];
  projCount = 0;

  // ----- Bullet beams (camera-facing streaks) -----
  trailCap: number = 0;
  private beamMesh!: THREE.InstancedMesh;
  private beamMat!: THREE.ShaderMaterial;
  private beamColor!: THREE.InstancedBufferAttribute;
  private beamKind!: THREE.InstancedBufferAttribute;
  trailCount = 0;
  /** scratch basis vectors for beam billboarding */
  private bX = new THREE.Vector3();
  private bY = new THREE.Vector3();
  private bZ = new THREE.Vector3();
  private camPos = new THREE.Vector3();

  // ----- Debris -----
  private debrisCap: number;
  private debrisMesh: THREE.InstancedMesh;
  private debris: { pos: THREE.Vector3; vel: THREE.Vector3; quat: THREE.Quaternion; spin: THREE.Vector3; scale: number; life: number; max: number }[] = [];
  debrisCount = 0;

  // ----- Shockwaves + flashes -----
  private waves: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; max: number; from: number; to: number }[] = [];
  private wavePool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private flashes: { sp: THREE.Sprite; mat: THREE.SpriteMaterial; life: number; max: number; from: number; to: number }[] = [];
  private flashPool: { sp: THREE.Sprite; mat: THREE.SpriteMaterial }[] = [];
  private lightPool: THREE.PointLight[] = [];
  private lights: { l: THREE.PointLight; life: number; max: number; peak: number }[] = [];

  tmpM = new THREE.Matrix4();
  tmpQ = new THREE.Quaternion();
  tmpV = new THREE.Vector3();
  tmpS = new THREE.Vector3();
  up = new THREE.Vector3(0, 1, 0);
  private colorBuf!: Float32Array;

  constructor(private scene: THREE.Scene, private quality: Quality) {
    const qMul = quality === "low" ? 0.55 : quality === "medium" ? 0.8 : 1;
    this.cap = Math.floor(3400 * qMul);
    this.pos = new Float32Array(this.cap * 3);
    this.col = new Float32Array(this.cap * 3);
    this.size = new Float32Array(this.cap);
    this.alpha = new Float32Array(this.cap);
    this.vel = new Float32Array(this.cap * 3);
    this.life = new Float32Array(this.cap);
    this.maxLife = new Float32Array(this.cap);
    this.baseSize = new Float32Array(this.cap);
    this.grow = new Float32Array(this.cap);
    this.drag = new Float32Array(this.cap);
    this.baseAlpha = new Float32Array(this.cap);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.glowTex = glowTexture();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: this.glowTex }, uScale: { value: 320 } },
      vertexShader: pVert, fragmentShader: pFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // ---- Bullet head (glowing core sphere, per-instance colour) ----
    this.projCap = quality === "low" ? 260 : quality === "medium" ? 520 : 820;
    const bulletGeo = new THREE.SphereGeometry(1.0, 12, 8);
    this.bulletMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: bulletVert, fragmentShader: bulletFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.bulletMesh = new THREE.InstancedMesh(bulletGeo, this.bulletMat as unknown as THREE.Material, this.projCap);
    this.bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.colorBuf = new Float32Array(this.projCap * 3);
    this.bulletColor = new THREE.InstancedBufferAttribute(this.colorBuf, 3);
    this.bulletColor.setUsage(THREE.DynamicDrawUsage);
    this.bulletKind = new THREE.InstancedBufferAttribute(new Float32Array(this.projCap), 1);
    this.bulletKind.setUsage(THREE.DynamicDrawUsage);
    this.bulletMesh.geometry.setAttribute("iCol", this.bulletColor);
    this.bulletMesh.geometry.setAttribute("iKind", this.bulletKind);
    this.bulletMesh.frustumCulled = false;
    this.bulletMesh.renderOrder = 6;
    scene.add(this.bulletMesh);
    for (let i = 0; i < this.projCap; i++) this.bulletIdx.push(-1);

    // ---- Bullet beam (camera-facing streak quad) ----
    this.trailCap = this.projCap;
    // plane spans x:0..1 (tail->head), y:-0.5..0.5 (across)
    const beamGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    beamGeo.translate(0.5, 0, 0);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: beamVert, fragmentShader: beamFrag,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.beamMesh = new THREE.InstancedMesh(beamGeo, this.beamMat as unknown as THREE.Material, this.trailCap);
    this.beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beamColor = new THREE.InstancedBufferAttribute(new Float32Array(this.trailCap * 3), 3);
    this.beamColor.setUsage(THREE.DynamicDrawUsage);
    this.beamKind = new THREE.InstancedBufferAttribute(new Float32Array(this.trailCap), 1);
    this.beamKind.setUsage(THREE.DynamicDrawUsage);
    this.beamMesh.geometry.setAttribute("iCol", this.beamColor);
    this.beamMesh.geometry.setAttribute("iKind", this.beamKind);
    this.beamMesh.frustumCulled = false;
    this.beamMesh.renderOrder = 5;
    scene.add(this.beamMesh);

    // Debris
    this.debrisCap = quality === "low" ? 90 : 260;
    const dGeo = new THREE.TetrahedronGeometry(1, 0);
    const dMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cf, metalness: 0.9, roughness: 0.4, flatShading: true });
    this.debrisMesh = new THREE.InstancedMesh(dGeo, dMat, this.debrisCap);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.frustumCulled = false;
    scene.add(this.debrisMesh);
    for (let i = 0; i < this.debrisCap; i++) this.debris.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), spin: new THREE.Vector3(), scale: 1, life: 0, max: 1 });

    const waveGeo = new THREE.RingGeometry(0.86, 1, 48);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(waveGeo, m);
      mesh.visible = false;
      scene.add(mesh);
      this.wavePool.push({ mesh, mat: m });
    }
    for (let i = 0; i < 20; i++) {
      const m = new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      scene.add(sp);
      this.flashPool.push({ sp, mat: m });
    }
    const lc = quality === "low" ? 2 : 5;
    for (let i = 0; i < lc; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 500, 2);
      l.visible = false;
      scene.add(l);
      this.lightPool.push(l);
    }
  }

  /** register a bullet — stores data, renders the head & trail each frame */
  addBullet(p: THREE.Vector3, dir: THREE.Vector3, speed: number, color: number, kind: 0 | 1 | 2 | 3,
            dmg: number, radius: number, splash: number, shieldMul: number, slow: number,
            homing: number, targetId: string | null, owner: string, team: 0 | 1, size: number, life: number,
            trailLen: number) {
    this.bulletData.push({
      pos: p.clone(), vel: dir.clone().multiplyScalar(speed),
      dir: dir.clone(),
      kind, color: new THREE.Color(color), size, life,
      dmg, radius, splash, shieldMul, slow, homing, targetId, owner, team,
      trailLen,
      prevPos: p.clone(),
    });
  }

  /** expose underlying particle spawn */
  spawn(p: THREE.Vector3, v: THREE.Vector3, color: number, size: number, life: number, drag = 1.6, grow = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    const c = new THREE.Color(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.baseSize[i] = size; this.size[i] = size;
    this.alpha[i] = 1; this.baseAlpha[i] = 1; this.life[i] = life; this.maxLife[i] = life;
    this.drag[i] = drag; this.grow[i] = grow;
  }

  burst(p: THREE.Vector3, o: FXOptions = {}) {
    const count = Math.min(o.count ?? 20, this.cap - this.n);
    const colors = o.color === undefined ? [0xffffff] : Array.isArray(o.color) ? o.color : [o.color];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      if (this.n >= this.cap) return;
      const idx = this.n;
      let vx: number, vy: number, vz: number;
      const speed = (o.speed ?? 30) * (1 - (o.speedVar ?? 0.5) * Math.random());
      if (o.dir && o.cone !== undefined) {
        const spread = o.cone;
        this.tmpV2.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
        c.set(0, 0, 0);
        vx = o.dir.x + this.tmpV2.x; vy = o.dir.y + this.tmpV2.y; vz = o.dir.z + this.tmpV2.z;
        const l = Math.hypot(vx, vy, vz) || 1;
        vx = (vx / l) * speed; vy = (vy / l) * speed; vz = (vz / l) * speed;
      } else {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        vx = Math.cos(th) * s * speed; vy = u * speed; vz = Math.sin(th) * s * speed;
      }
      const px = p.x + vx * 0.01, py = p.y + vy * 0.01, pz = p.z + vz * 0.01;
      this.pos[idx * 3] = px; this.pos[idx * 3 + 1] = py; this.pos[idx * 3 + 2] = pz;
      this.vel[idx * 3] = vx; this.vel[idx * 3 + 1] = vy; this.vel[idx * 3 + 2] = vz;
      c.set(colors[(Math.random() * colors.length) | 0]);
      const bright = 0.75 + Math.random() * 0.6;
      this.col[idx * 3] = c.r * bright; this.col[idx * 3 + 1] = c.g * bright; this.col[idx * 3 + 2] = c.b * bright;
      const sz = (o.size ?? 2) * (1 + (Math.random() - 0.5) * (o.sizeVar ?? 0.8));
      this.baseSize[idx] = sz; this.size[idx] = sz;
      this.alpha[idx] = o.alpha ?? 1; this.baseAlpha[idx] = o.alpha ?? 1;
      const lf = (o.life ?? 0.8) * (1 + (Math.random() - 0.5) * (o.lifeVar ?? 0.6));
      this.life[idx] = lf; this.maxLife[idx] = lf;
      this.drag[idx] = o.drag ?? 1.6;
      this.grow[idx] = o.grow ?? 0;
      this.n++;
    }
  }
  private tmpV2 = new THREE.Vector3();

  smoke(p: THREE.Vector3, v: THREE.Vector3, size = 4, color = 0x555a66, life = 1.6) {
    if (this.n >= this.cap - 10) return;
    const idx = this.n++;
    this.pos[idx * 3] = p.x; this.pos[idx * 3 + 1] = p.y; this.pos[idx * 3 + 2] = p.z;
    this.vel[idx * 3] = v.x * 0.3; this.vel[idx * 3 + 1] = v.y * 0.3; this.vel[idx * 3 + 2] = v.z * 0.3;
    const c = new THREE.Color(color);
    this.col[idx * 3] = c.r; this.col[idx * 3 + 1] = c.g; this.col[idx * 3 + 2] = c.b;
    this.baseSize[idx] = size; this.size[idx] = size;
    this.alpha[idx] = 0.55; this.baseAlpha[idx] = 0.42; this.life[idx] = life; this.maxLife[idx] = life;
    this.drag[idx] = 1.1; this.grow[idx] = 2.4;
  }

  spawnDebris(p: THREE.Vector3, count: number, speed: number, scale: number, _color: number) {
    for (let i = 0; i < count; i++) {
      if (this.debrisCount >= this.debrisCap) return;
      const d = this.debris[this.debrisCount++];
      d.pos.copy(p);
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const sp = speed * (0.35 + Math.random());
      d.vel.set(Math.cos(th) * s * sp, u * sp, Math.sin(th) * s * sp);
      d.quat.setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
      d.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      d.scale = scale * (0.4 + Math.random() * 1.3);
      d.max = d.life = 2.2 + Math.random() * 2.4;
    }
  }

  shockwave(p: THREE.Vector3, from: number, to: number, dur: number, color: number) {
    const w = this.wavePool.find((x) => !x.mesh.visible) ?? this.wavePool[0];
    w.mesh.visible = true;
    w.mesh.position.copy(p);
    w.mat.color.set(color);
    w.mesh.scale.setScalar(from);
    w.mesh.lookAt(p.x + 1, p.y + 0.4, p.z + 0.7);
    this.waves.push({ mesh: w.mesh, mat: w.mat, life: dur, max: dur, from, to });
  }

  /** Keep particle sizing correct at any resolution / DPI. */
  setViewport(bufferHeight: number, fovDeg: number) {
    // 0.5 × projection scale reproduces the original tuning at ~900px tall
    this.mat.uniforms.uScale.value = 0.5 * bufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) * 0.5));
  }

  flash(p: THREE.Vector3, from: number, to: number, dur: number, color: number) {
    if (to <= 46 && this.n < this.cap) {
      // small pops (muzzle / impact) become one expanding particle — no sprite stealing
      const i = this.n++;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.vel[i * 3] = 0; this.vel[i * 3 + 1] = 0; this.vel[i * 3 + 2] = 0;
      const c = new THREE.Color(color);
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.baseSize[i] = from * 2; this.size[i] = from * 2;
      this.alpha[i] = 1; this.baseAlpha[i] = 1;
      this.life[i] = dur; this.maxLife[i] = dur;
      this.drag[i] = 0; this.grow[i] = Math.max(0, to / Math.max(0.01, from) - 1);
      return;
    }
    const f = this.flashPool.find((x) => !x.sp.visible) ?? this.flashPool[0];
    f.sp.visible = true;
    f.sp.position.copy(p);
    f.mat.color.set(color);
    f.sp.scale.setScalar(from);
    this.flashes.push({ sp: f.sp, mat: f.mat, life: dur, max: dur, from, to });
  }

  lightFlash(p: THREE.Vector3, color: number, intensity: number, dist: number, dur: number) {
    const l = this.lightPool.find((x) => !x.visible);
    if (!l) return;
    l.visible = true;
    l.position.copy(p);
    l.color.set(color);
    l.intensity = intensity;
    l.distance = dist;
    this.lights.push({ l, life: dur, max: dur, peak: intensity });
  }

  /** Spectacular destruction: rings, sparks, smoke, fragments */
  explode(p: THREE.Vector3, scale: number, hullColor: number) {
    const q = this.quality === "low" ? 0.5 : this.quality === "medium" ? 0.8 : 1;
    // blinding core flash + warm bloom
    this.flash(p.clone(), scale * 6, scale * 75, 0.2, 0xffffff);
    this.flash(p.clone(), scale * 12, scale * 125, 0.55, 0xffc27a);
    // fireball
    this.burst(p, { count: (78 * q) | 0, color: [0xffffff, 0xfff0b0, 0xffc24a, 0xff7a1a], speed: 72 * scale, speedVar: 0.8, size: 6 * scale, life: 0.8, lifeVar: 0.7, drag: 2.4, grow: 2.2 });
    // hull-tinted plasma burst
    this.burst(p, { count: (28 * q) | 0, color: [hullColor, 0x9fe8ff, 0xffffff], speed: 115 * scale, size: 3.2 * scale, life: 0.6, drag: 1.8 });
    // ember streaks
    this.burst(p, { count: (100 * q) | 0, color: [0xffffff, 0xffe0a0, 0xffa040], speed: 250 * scale, speedVar: 0.6, size: 1.3 * scale, life: 1.15, lifeVar: 0.8, drag: 0.9 });
    // lingering smoke
    this.burst(p, { count: (34 * q) | 0, color: [0x4a4a55, 0x5a544c, 0x33333a], speed: 26 * scale, size: 9 * scale, life: 2.8, lifeVar: 0.6, drag: 0.8, grow: 3.0, alpha: 0.45 });
    // glowing debris chunks
    this.spawnDebris(p, (28 * q) | 0, 72 * scale, 0.7 * scale, 0);
    // expanding energy rings
    this.shockwave(p.clone(), scale * 2, scale * 150, 0.95, 0xffd08a);
    this.shockwave(p.clone(), scale * 1, scale * 85, 0.6, hullColor);
    this.lightFlash(p, 0xffb04a, 1150 * scale, scale * 480, 0.7);
  }

  /** bigger multi-ring blast for capital ships (secondaries are scheduled by the engine) */
  explodeCapital(p: THREE.Vector3, scale: number, hullColor: number) {
    this.explode(p, scale * 1.6, hullColor);
    this.shockwave(p.clone(), scale * 1.6, scale * 240, 1.5, 0xff7a3a);
    this.shockwave(p.clone(), scale * 0.6, scale * 130, 0.95, 0xffd08a);
    this.burst(p, { count: 140, color: [0xfff0c0, 0xff8a3d, hullColor, 0xffffff], speed: 230 * scale, size: 12 * scale, life: 2.0, drag: 0.6, lifeVar: 0.7 });
    this.burst(p, { count: 44, color: [0x5a544c, 0x6b6f78], speed: 60 * scale, size: 18 * scale, life: 3.4, drag: 0.5, grow: 5.5, alpha: 0.45 });
    this.spawnDebris(p, 40, 95 * scale, 1.6 * scale, 0);
    this.flash(p.clone(), scale * 24, scale * 230, 0.75, 0xffffff);
    this.lightFlash(p, 0xff8a3d, 2300 * scale, 900 * scale, 1.0);
  }

  /** Armour / shield impact feedback at the exact strike point. */
  hitSpark(p: THREE.Vector3, normal: THREE.Vector3, color: number, strength = 1, shield = false) {
    if (shield) {
      this.burst(p, { count: Math.max(4, (10 * strength) | 0), color: [0xffffff, color, 0x9fe8ff], speed: 58, size: 1.5, life: 0.3, dir: normal, cone: 1.6, drag: 3 });
      this.flash(p, 1.6, 10 * strength, 0.14, color);
    } else {
      // hot metal sparks, a puff of smoke and a white strike flash on the armour
      this.burst(p, { count: Math.max(6, (15 * strength) | 0), color: [0xffffff, 0xffd08a, 0xff9a3d], speed: 98, speedVar: 0.7, size: 1.15, life: 0.42, lifeVar: 0.6, dir: normal, cone: 1.3, drag: 2.2 });
      this.burst(p, { count: Math.max(2, (4 * strength) | 0), color: [0x6a6f78, 0x3a3d44], speed: 16, size: 3.2, life: 0.8, drag: 1.4, grow: 1.6, alpha: 0.4 });
      this.flash(p, 1.3, 8 * strength, 0.11, 0xfff2d8);
    }
  }

  /** bullet accessors */
  forEachBullet(cb: (b: ReturnType<FXSystem["getBullet"]>) => void) {
    for (let i = 0; i < this.bulletData.length; i++) cb(this.getBullet(i));
  }
  bulletCount() { return this.bulletData.length; }
  getBullet(i: number) { return this.bulletData[i]; }
  removeBullet(i: number) { this.bulletData.splice(i, 1); }
  cullBullets(alive: (b: ReturnType<FXSystem["getBullet"]>) => boolean) {
    let w = 0;
    for (let r = 0; r < this.bulletData.length; r++) {
      if (alive(this.bulletData[r])) this.bulletData[w++] = this.bulletData[r];
    }
    this.bulletData.length = w;
  }

  update(dt: number, _cam?: THREE.Camera) {
    // particles
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.n;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            this.pos[i * 3 + k] = this.pos[last * 3 + k];
            this.vel[i * 3 + k] = this.vel[last * 3 + k];
            this.col[i * 3 + k] = this.col[last * 3 + k];
          }
          this.size[i] = this.size[last]; this.alpha[i] = this.alpha[last]; this.baseAlpha[i] = this.baseAlpha[last];
          this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
          this.baseSize[i] = this.baseSize[last]; this.grow[i] = this.grow[last]; this.drag[i] = this.drag[last];
        }
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] *= d; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.size[i] = this.baseSize[i] * (1 + (1 - t) * this.grow[i]);
      this.alpha[i] = this.baseAlpha[i] * Math.pow(t, 0.8) * Math.min(1, (1 - t) * 30 + 0.35);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;

    // ---- bullets: glowing head sphere + camera-facing beam streak ----
    if (_cam) _cam.getWorldPosition(this.camPos);
    let inst = 0;
    const colAttr = this.bulletColor;
    const kindAttr = this.bulletKind;
    const bColAttr = this.beamColor;
    const bKindAttr = this.beamKind;
    const el = this.tmpM.elements;
    for (let bi = 0; bi < this.bulletData.length; bi++) {
      if (inst >= this.projCap) break;
      const b = this.bulletData[bi];

      // --- head: small blazing orb, slightly oversized so it reads at range ---
      const headR = b.size * 1.15;
      this.tmpS.set(headR, headR, headR);
      this.tmpM.compose(b.pos, this.tmpQ.identity(), this.tmpS);
      this.bulletMesh.setMatrixAt(inst, this.tmpM);
      colAttr.setXYZ(inst, b.color.r, b.color.g, b.color.b);
      kindAttr.setX(inst, b.kind);

      // --- beam: quad stretched backward along travel, rolled to face camera ---
      // xAxis = travel direction, yAxis = screen-perpendicular, zAxis = facing
      this.bX.copy(b.dir);
      if (this.bX.lengthSq() < 1e-6) this.bX.set(0, 0, 1);
      this.bX.normalize();
      this.bZ.copy(this.camPos).sub(b.pos);
      if (this.bZ.lengthSq() < 1e-6) this.bZ.set(0, 0, 1);
      this.bZ.normalize();
      this.bY.crossVectors(this.bZ, this.bX);
      if (this.bY.lengthSq() < 1e-6) this.bY.set(0, 1, 0); else this.bY.normalize();
      this.bZ.crossVectors(this.bX, this.bY).normalize();

      const len = b.trailLen;
      const wid = b.size * 2.1;
      // tail sits behind the head so the bolt reads as travelling forward
      const tailX = b.pos.x - this.bX.x * len;
      const tailY = b.pos.y - this.bX.y * len;
      const tailZ = b.pos.z - this.bX.z * len;
      el[0] = this.bX.x * len; el[1] = this.bX.y * len; el[2] = this.bX.z * len; el[3] = 0;
      el[4] = this.bY.x * wid; el[5] = this.bY.y * wid; el[6] = this.bY.z * wid; el[7] = 0;
      el[8] = this.bZ.x;       el[9] = this.bZ.y;       el[10] = this.bZ.z;      el[11] = 0;
      el[12] = tailX;          el[13] = tailY;          el[14] = tailZ;          el[15] = 1;
      this.beamMesh.setMatrixAt(inst, this.tmpM);
      bColAttr.setXYZ(inst, b.color.r, b.color.g, b.color.b);
      bKindAttr.setX(inst, b.kind);

      inst++;
    }
    this.projCount = inst;
    for (let z = inst; z < this.projCap; z++) {
      this.tmpM.makeScale(0, 0, 0);
      this.bulletMesh.setMatrixAt(z, this.tmpM);
      this.beamMesh.setMatrixAt(z, this.tmpM);
    }
    this.bulletMesh.count = this.projCap;
    this.beamMesh.count = this.projCap;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.beamMesh.instanceMatrix.needsUpdate = true;
    colAttr.needsUpdate = true;
    kindAttr.needsUpdate = true;
    bColAttr.needsUpdate = true;
    bKindAttr.needsUpdate = true;

    // debris
    for (let k = 0; k < this.debrisCap; k++) {
      if (k >= this.debrisCount) {
        this.tmpM.makeScale(0, 0, 0);
        this.debrisMesh.setMatrixAt(k, this.tmpM);
        continue;
      }
      const d = this.debris[k];
      d.life -= dt;
      if (d.life <= 0) {
        const lastIdx = --this.debrisCount;
        this.debris[k] = this.debris[lastIdx];
        this.debris[lastIdx] = d;
        k--;
        continue;
      }
      d.vel.multiplyScalar(Math.exp(-0.25 * dt));
      d.pos.addScaledVector(d.vel, dt);
      this.tmpQ.setFromEuler(new THREE.Euler(d.spin.x * dt, d.spin.y * dt, d.spin.z * dt));
      d.quat.multiply(this.tmpQ);
      const fade = Math.min(1, d.life / 0.5);
      this.tmpS.setScalar(d.scale * fade);
      this.tmpM.compose(d.pos, d.quat, this.tmpS);
      this.debrisMesh.setMatrixAt(k, this.tmpM);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;

    for (let k = this.waves.length - 1; k >= 0; k--) {
      const w = this.waves[k];
      w.life -= dt;
      const t = 1 - w.life / w.max;
      if (w.life <= 0 || t >= 1) {
        w.mesh.visible = false; w.mat.opacity = 0;
        this.waves.splice(k, 1);
        continue;
      }
      w.mesh.scale.setScalar(w.from + (w.to - w.from) * (1 - Math.pow(1 - t, 2.4)));
      w.mat.opacity = Math.pow(1 - t, 1.8) * 0.85;
    }
    for (let k = this.flashes.length - 1; k >= 0; k--) {
      const f = this.flashes[k];
      f.life -= dt;
      const t = 1 - f.life / f.max;
      if (f.life <= 0 || t >= 1) {
        f.sp.visible = false; f.mat.opacity = 0;
        this.flashes.splice(k, 1);
        continue;
      }
      f.sp.scale.setScalar(f.from + (f.to - f.from) * t);
      f.mat.opacity = Math.pow(1 - t, 2.2);
    }
    for (let k = this.lights.length - 1; k >= 0; k--) {
      const l = this.lights[k];
      l.life -= dt;
      if (l.life <= 0) {
        l.l.visible = false; l.l.intensity = 0;
        this.lights.splice(k, 1);
        continue;
      }
      l.l.intensity = l.peak * (l.life / l.max);
    }

    this.mat.uniforms ? (this.bulletMat.uniforms.uTime.value += dt) : null;
  }

  get particleCount() { return this.n; }
  get hasBudget() { return this.n < this.cap - 40; }

  
  /** Drop last frame's bullet draw list (rendering is rebuilt each frame). */
  clearBullets() { this.bulletData.length = 0; }

  /** Forward-append a single bullet from the engine's Proj[] list */
  pushBullet(
    p: { pos: THREE.Vector3; vel: THREE.Vector3; dir: THREE.Vector3; color: number; size: number; life: number; dmg: number; radius: number; splash: number; shieldMul: number; slow?: number; homing: number; targetId: string | null; owner: string; team: 0 | 1; fx?: string; prevPos?: THREE.Vector3; trailLen?: number },
    visualScale = 1,
  ) {
    const fxKind: 0 | 1 | 2 | 3 =
      p.fx === "red" ? 3 :
      p.fx === "ghost" ? 2 :
      p.fx === "dark" ? 1 : 0;
    const size = p.size * visualScale;
    // Streak length scales with muzzle velocity so fast bolts read as long
    // bright lances while slow plasma orbs keep a short, fat tail.
    const speed = p.vel.length();
    const trailLen = p.trailLen ?? THREE.MathUtils.clamp(speed * 0.028 + size * 2.4, 7, 55);
    // Align the streak with TRUE travel (velocity includes the launching ship's
    // inherited momentum), otherwise fast strafing shots look visibly skewed.
    const travel = speed > 1e-4 ? this.tmpV.copy(p.vel).divideScalar(speed) : p.dir;
    this.addBullet(
      p.pos, travel, speed, p.color, fxKind,
      p.dmg, p.radius, p.splash, p.shieldMul, p.slow ?? 0, p.homing, p.targetId, p.owner, p.team,
      size, p.life, trailLen,
    );
  }
  /** Rendering is now centralized inside FX.update; nothing to flush from the engine anymore. */
  flush(_n?: number, _t?: number) {}
  writeProjectile(_i: number, _pos: THREE.Vector3, _dir: THREE.Vector3, _len: number, _r: number, _c: number) { return -1; }
  writeTrail(_i: number, _head: THREE.Vector3, _tail: THREE.Vector3, _color: number, _alpha: number) { return; }

  dispose() {
    this.scene.remove(this.points, this.bulletMesh, this.debrisMesh, this.beamMesh);
    this.geo.dispose(); this.mat.dispose();
    (this.bulletMesh.geometry as THREE.BufferGeometry).dispose();
    this.bulletMat.dispose();
    (this.beamMesh.geometry as THREE.BufferGeometry).dispose(); this.beamMat.dispose();
    this.glowTex.dispose();
    this.wavePool.forEach((w) => { this.scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mat.dispose(); });
    this.flashPool.forEach((f) => { this.scene.remove(f.sp); f.mat.dispose(); });
    this.lightPool.forEach((l) => this.scene.remove(l));
    this.debrisMesh.geometry.dispose();
    (this.debrisMesh.material as THREE.Material).dispose();
  }
}
