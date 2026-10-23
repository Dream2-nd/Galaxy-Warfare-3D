import * as THREE from "three";
import type { ArenaConfig, ShipClassId } from "./content";
import { buildShip, type ShipVisual } from "./ships";

export type Quality = "low" | "medium" | "high";

const Q = { low: 0.45, medium: 0.75, high: 1 };

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}
function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
function rnd(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** soft radial glow sprite */
export function glowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const c = canvas(256);
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, inner.replace(/[\d.]+\)$/, "0.55)"));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return tex(c);
}

function nebulaTexture(color: THREE.Color, seed: number) {
  const c = canvas(256);
  const g = c.getContext("2d")!;
  const r = rnd(seed);
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    const x = 128 + (r() - 0.5) * 120;
    const y = 128 + (r() - 0.5) * 120;
    const rad = 18 + r() * 66;
    const a = 0.05 + r() * 0.14;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    const col = new THREE.Color().setHSL(hsl.h + (r() - 0.5) * 0.09, hsl.s, hsl.l * (0.7 + r() * 0.8));
    grad.addColorStop(0, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  const grad2 = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grad2.addColorStop(0, "rgba(255,255,255,0.16)");
  grad2.addColorStop(1, "rgba(255,255,255,0)");
  g.globalCompositeOperation = "lighter";
  g.fillStyle = grad2;
  g.fillRect(0, 0, 256, 256);
  return tex(c);
}

function galaxyTexture(seed: number) {
  const c = canvas(256);
  const g = c.getContext("2d")!;
  const r = rnd(seed);
  g.clearRect(0, 0, 256, 256);
  g.globalCompositeOperation = "lighter";
  const arms = 2 + Math.floor(r() * 3);
  const hue = r();
  for (let i = 0; i < 2600; i++) {
    const arm = i % arms;
    const t = Math.pow(r(), 0.6);
    const rad = t * 118;
    const angle = arm * ((Math.PI * 2) / arms) + t * 4.2 + (r() - 0.5) * (0.55 - t * 0.35);
    const x = 128 + Math.cos(angle) * rad + (r() - 0.5) * 10 * (1 - t);
    const y = 128 + Math.sin(angle) * rad * 0.96 + (r() - 0.5) * 10 * (1 - t);
    const sz = 0.5 + r() * 1.7;
    const a = (1 - t * 0.75) * (0.14 + r() * 0.5);
    const col = new THREE.Color().setHSL((hue + t * 0.12) % 1, 0.65, 0.55 + r() * 0.35);
    g.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
    g.beginPath();
    g.arc(x, y, sz, 0, Math.PI * 2);
    g.fill();
  }
  const core = g.createRadialGradient(128, 128, 0, 128, 128, 44);
  core.addColorStop(0, "rgba(255,250,235,0.95)");
  core.addColorStop(0.4, "rgba(255,220,180,0.35)");
  core.addColorStop(1, "rgba(255,200,160,0)");
  g.fillStyle = core;
  g.fillRect(0, 0, 256, 256);
  return tex(c);
}

function planetTexture(base: number, band: number, seed: number, storm = false) {
  const c = canvas(512);
  const g = c.getContext("2d")!;
  const r = rnd(seed);
  const b = new THREE.Color(base);
  const s = new THREE.Color(band);
  g.fillStyle = `rgb(${(b.r * 255) | 0},${(b.g * 255) | 0},${(b.b * 255) | 0})`;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const y = r() * 512;
    const h = 2 + r() * 26;
    const mix = r();
    const col = b.clone().lerp(s, mix);
    g.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${0.12 + r() * 0.35})`;
    g.beginPath();
    g.ellipse(r() * 512, y, 120 + r() * 260, h, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 260; i++) {
    const x = r() * 512, y = r() * 512, rad = 1 + r() * 9;
    g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.14})`;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  if (storm) {
    // great swirling storm: stacked offset ellipses read as a turbulent vortex
    for (let k = 0; k < 9; k++) {
      const col = s.clone().lerp(new THREE.Color(0xfff1d6), k / 12);
      g.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${0.16 + k * 0.03})`;
      g.beginPath();
      g.ellipse(310 + Math.sin(k) * 6, 300 + Math.cos(k * 1.3) * 4, 96 - k * 9, 44 - k * 4.2, 0.08 * k, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function ringTexture(color: number) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 8;
  const g = c.getContext("2d")!;
  const col = new THREE.Color(color);
  const r = rnd(9);
  for (let x = 0; x < 512; x++) {
    const t = x / 512;
    let a = 0.5 + Math.sin(t * 60) * 0.18 + Math.sin(t * 17) * 0.2;
    if (r() > 0.93) a *= 0.25;
    a *= Math.min(1, t * 7) * Math.min(1, (1 - t) * 5);
    g.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${Math.max(0, Math.min(1, a))})`;
    g.fillRect(x, 0, 1, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function asteroidGeometry(seed: number, detail: number) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const r = rnd(seed);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 0.68 + r() * 0.62;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function rockTexture() {
  const c = canvas(128);
  const g = c.getContext("2d")!;
  const r = rnd(4);
  g.fillStyle = "#6b6156";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    const shade = 40 + r() * 90;
    g.fillStyle = `rgba(${shade},${shade * 0.92},${shade * 0.82},${0.15 + r() * 0.4})`;
    g.beginPath();
    g.arc(r() * 128, r() * 128, 1 + r() * 7, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

const atmoVert = /* glsl */ `varying vec3 vN; varying vec3 vP;
void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`;
const atmoFrag = /* glsl */ `uniform vec3 uColor; uniform float uPower; varying vec3 vN; varying vec3 vP;
void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(-vP))),0.0,1.0), uPower); gl_FragColor = vec4(uColor, f); }`;

const diskVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const diskFrag = /* glsl */ `uniform float uTime; uniform vec3 uHot; uniform vec3 uCool; varying vec2 vUv;
float h(float n){ return fract(sin(n)*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=h(i.x+i.y*57.0), b=h(i.x+1.0+i.y*57.0), c=h(i.x+(i.y+1.0)*57.0), d=h(i.x+1.0+(i.y+1.0)*57.0); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float ang = atan(p.y, p.x);
  float spin = uTime * (1.6 / (0.35 + r));
  float n = noise(vec2(ang * 3.0 + spin, r * 9.0 - uTime * 0.6)) * 0.6
          + noise(vec2(ang * 8.0 - spin * 1.7, r * 22.0)) * 0.4;
  float band = smoothstep(0.06, 0.34, r) * (1.0 - smoothstep(0.62, 1.0, r));
  float streak = pow(n, 2.2) * 1.6 + 0.25;
  float inner = pow(clamp(1.0 - r * 1.35, 0.0, 1.0), 2.0);
  vec3 col = mix(uCool, uHot, clamp(inner + n * 0.5, 0.0, 1.0));
  float a = band * streak * (0.55 + inner * 0.9);
  gl_FragColor = vec4(col * (1.0 + inner * 2.4), clamp(a, 0.0, 1.0));
}`;

export interface Collider {
  pos: THREE.Vector3;
  radius: number;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
}

export interface World {
  group: THREE.Group;
  colliders: Collider[];
  gravity: { pos: THREE.Vector3; strength: number; radius: number } | null;
  keyLight: THREE.DirectionalLight;
  terrainHeight: ((x: number, z: number) => number) | null;
  update: (t: number, dt: number, camPos: THREE.Vector3) => void;
  dispose: () => void;
}

/** Deterministic planetary heightfield shared by the 3D mesh generator, ship/projectile collision, and AI terrain avoidance. */
export function planetaryTerrainHeight(kind: "nebula_frontier" | "stormworld", x: number, z: number): number {
  const r = Math.hypot(x, z);
  // Keep central spawn basin navigable while still sculpted with valleys; mountains rise higher outside r > 260
  const rim = THREE.MathUtils.smoothstep(r, 180, 720);
  if (kind === "nebula_frontier") {
    const warpX = x * 0.0022 + Math.sin(z * 0.0017) * 0.85;
    const warpZ = z * 0.0022 + Math.cos(x * 0.0016) * 0.85;
    const ridge1 = Math.pow(1 - Math.abs(Math.sin(warpX * 1.35 + warpZ * 0.9)), 2.1);
    const ridge2 = Math.pow(1 - Math.abs(Math.cos(warpX * 0.85 - warpZ * 1.45)), 2.2);
    const detail = Math.sin(x * 0.0075) * Math.cos(z * 0.0075) * 28 + Math.sin((x + z) * 0.014) * 12;
    const canyon = Math.exp(-Math.pow(Math.sin(x * 0.0015 - z * 0.0013) * 3.1, 2)) * 135;
    const mountains = (ridge1 * 255 + ridge2 * 175) * (0.32 + 0.68 * rim);
    return -310 + mountains - canyon + detail;
  }
  // Stormworld: wide plains, stepped plateaus/mesas, deep river/ocean channels, and outer mountain peaks
  const plateauWave = Math.sin(x * 0.0019 + Math.cos(z * 0.0015) * 0.7) * Math.cos(z * 0.0018 - Math.sin(x * 0.0014) * 0.6);
  const mesa = Math.tanh(plateauWave * 4.2) * 115 * (0.4 + 0.6 * rim);
  const river = Math.exp(-Math.pow(Math.sin(x * 0.0013 + z * 0.0016) * 3.6, 2)) * 125;
  const outerPeaks = Math.pow(Math.max(0, Math.sin(x * 0.0031) * Math.cos(z * 0.0029)), 2.0) * 210 * rim;
  const crags = Math.sin(x * 0.009) * Math.cos(z * 0.009) * 14;
  const raw = -255 + mesa + outerPeaks - river + crags;
  return Math.max(-315, raw);
}

export function buildWorld(arena: ArenaConfig, quality: Quality): World {
  const q = Q[quality];
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const colliders: Collider[] = [];
  let gravity: World["gravity"] = null;
  const updaters: ((t: number, dt: number, cam: THREE.Vector3) => void)[] = [];
  const derelicts: ShipVisual[] = [];

  // ---------- STARFIELD ----------
  const starCount = Math.floor(arena.starCount * q);
  {
    const g = track(new THREE.BufferGeometry());
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const r = rnd(1234);
    const [h0, h1] = arena.starHue;
    for (let i = 0; i < starCount; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rad = arena.bounds * (4.2 + r() * 3.5);
      pos[i * 3] = Math.cos(th) * s * rad;
      pos[i * 3 + 1] = u * rad;
      pos[i * 3 + 2] = Math.sin(th) * s * rad;
      const hue = h0 + r() * (h1 - h0);
      const c = new THREE.Color().setHSL(((hue % 1) + 1) % 1, r() > 0.75 ? 0.55 : 0.12, 0.62 + r() * 0.38);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      const bright = r();
      sizes[i] = bright > 0.985 ? 5.5 : bright > 0.9 ? 3.2 : 1.6;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const m = track(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTex: { value: track(glowTexture()) } },
      vertexShader: `attribute float size; varying vec3 vC; varying float vTw; uniform float uTime;
        void main(){ vC = color; vTw = 0.72 + 0.28 * sin(uTime * 2.1 + position.x * 0.013 + position.y * 0.007);
        vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (1.0 + vTw * 0.25); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vTw;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * vTw, 1.0) * t; }`,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const stars = new THREE.Points(g, m);
    stars.frustumCulled = false;
    group.add(stars);
    updaters.push((t) => {
      (m.uniforms.uTime as { value: number }).value = t;
      stars.position.copy(camHolder.v);
    });
  }
  const camHolder = { v: new THREE.Vector3() };

  // ---------- NEBULAE ----------
  arena.nebulae.forEach((n, ni) => {
    const count = Math.max(3, Math.floor(n.count * q));
    const texture = track(nebulaTexture(new THREE.Color(n.color), ni * 77 + 5));
    const r = rnd(ni * 91 + 7);
    for (let i = 0; i < count; i++) {
      const mat = track(new THREE.SpriteMaterial({
        map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        opacity: n.opacity * (0.55 + r() * 0.8), rotation: r() * Math.PI * 2, color: 0xffffff,
      }));
      const sp = new THREE.Sprite(mat);
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const rad = arena.bounds * (1.7 + r() * 2.4);
      sp.position.set(Math.cos(th) * s * rad, u * rad * 0.7, Math.sin(th) * s * rad);
      const sc = n.size * (0.5 + r() * 1.3);
      sp.scale.set(sc, sc, 1);
      sp.userData.spin = (r() - 0.5) * 0.02;
      group.add(sp);
      updaters.push((_t, dt) => { mat.rotation += sp.userData.spin * dt; });
    }
  });

  // ---------- DISTANT GALAXIES ----------
  {
    const r = rnd(99);
    const count = Math.max(2, Math.floor(arena.galaxySprites * q));
    for (let i = 0; i < count; i++) {
      const texture = track(galaxyTexture(i * 31 + 3));
      const mat = track(new THREE.SpriteMaterial({
        map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        opacity: 0.32 + r() * 0.4, rotation: r() * Math.PI,
      }));
      const sp = new THREE.Sprite(mat);
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const rad = arena.bounds * (5.5 + r() * 3);
      sp.position.set(Math.cos(th) * s * rad, u * rad, Math.sin(th) * s * rad);
      const sc = 700 + r() * 2600;
      sp.scale.set(sc, sc, 1);
      group.add(sp);
    }
  }

  // ---------- KEY LIGHT (star) ----------
  const dir = new THREE.DirectionalLight(arena.starColor, arena.starIntensity);
  const sunDir = new THREE.Vector3(...arena.starPos).normalize().multiplyScalar(700);
  dir.position.copy(sunDir);
  if (quality === "high") {
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 10;
    dir.shadow.camera.far = 1500;
    const s = 320;
    dir.shadow.camera.left = -s; dir.shadow.camera.right = s;
    dir.shadow.camera.top = s; dir.shadow.camera.bottom = -s;
    dir.shadow.bias = -0.0012;
    dir.shadow.normalBias = 0.6;
  }
  dir.userData.sunDir = sunDir;
  group.add(dir);
  group.add(dir.target);
  group.add(new THREE.AmbientLight(arena.ambientColor, arena.ambient));
  const hemi = new THREE.HemisphereLight(arena.starColor, arena.fogColor, 0.25);
  group.add(hemi);

  // ---------- SUN ----------
  if (arena.sun) {
    const s = arena.sun;
    const geo = track(new THREE.SphereGeometry(s.radius, 32, 24));
    const mat = track(new THREE.MeshBasicMaterial({ color: s.color, fog: false }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...s.pos);
    group.add(mesh);
    const glowMat = track(new THREE.SpriteMaterial({
      map: track(glowTexture("rgba(255,240,220,1)", "rgba(255,120,40,0)")),
      color: s.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, fog: false,
    }));
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(s.glow, s.glow, 1);
    glow.position.copy(mesh.position);
    group.add(glow);
    const pl = new THREE.PointLight(s.color, 3.2, s.glow * 2.2, 1.4);
    pl.position.copy(mesh.position);
    group.add(pl);
    updaters.push((t) => {
      const k = 1 + Math.sin(t * 0.7) * 0.03;
      glow.scale.set(s.glow * k, s.glow * k, 1);
    });
  }

  // ---------- BLACK HOLE ----------
  if (arena.blackhole) {
    const bh = arena.blackhole;
    const coreGeo = track(new THREE.SphereGeometry(bh.radius, 40, 28));
    const coreMat = track(new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(...bh.pos);
    group.add(core);

    const diskGeo = track(new THREE.RingGeometry(bh.radius * 1.25, bh.disk, 160, 8));
    // remap uv so shader gets polar-ish coords
    const diskMat = track(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHot: { value: new THREE.Color(0xfff2d0) }, uCool: { value: new THREE.Color(0xff5a1a) } },
      vertexShader: diskVert, fragmentShader: diskFrag,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.position.copy(core.position);
    disk.rotation.x = -Math.PI / 2 + 0.34;
    disk.rotation.z = 0.2;
    group.add(disk);
    const disk2 = disk.clone();
    disk2.rotation.x = -Math.PI / 2 - 0.28;
    disk2.scale.setScalar(0.82);
    group.add(disk2);

    const haloMat = track(new THREE.SpriteMaterial({
      map: track(glowTexture("rgba(255,220,180,1)", "rgba(255,90,20,0)")),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, fog: false,
    }));
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(bh.disk * 1.5, bh.disk * 1.5, 1);
    halo.position.copy(core.position);
    group.add(halo);
    const pl = new THREE.PointLight(0xff9a4a, 4.5, bh.disk * 8, 1.5);
    pl.position.copy(core.position);
    group.add(pl);
    gravity = { pos: core.position.clone(), strength: 420000, radius: bh.disk * 5.5 };
    updaters.push((t) => {
      (diskMat.uniforms.uTime as { value: number }).value = t;
      disk.rotation.z = t * 0.05;
      disk2.rotation.z = -t * 0.04;
      const k = 1 + Math.sin(t * 1.7) * 0.02;
      halo.scale.set(bh.disk * 1.5 * k, bh.disk * 1.5 * k, 1);
    });
  }

  // ---------- PLANETS ----------
  (arena.planets ?? []).forEach((p, i) => {
    const geo = track(new THREE.SphereGeometry(p.radius, quality === "low" ? 24 : 48, quality === "low" ? 18 : 32));
    const mat = track(new THREE.MeshStandardMaterial({
      map: track(planetTexture(p.color, p.band, i * 17 + 3, !!p.storm)),
      roughness: 0.92, metalness: 0.02, fog: false,
    }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...p.pos);
    mesh.receiveShadow = true;
    group.add(mesh);
    if (p.atmosphere) {
      const aGeo = track(new THREE.SphereGeometry(p.radius * 1.055, 40, 28));
      const aMat = track(new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(p.atmosphere) }, uPower: { value: 2.6 } },
        vertexShader: atmoVert, fragmentShader: atmoFrag,
        transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      }));
      const atmo = new THREE.Mesh(aGeo, aMat);
      atmo.position.copy(mesh.position);
      group.add(atmo);
    }
    if (p.ring) {
      const rGeo = track(new THREE.RingGeometry(p.ring.inner, p.ring.outer, 128, 3));
      const uv = rGeo.attributes.uv as THREE.BufferAttribute;
      const pos = rGeo.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let k = 0; k < uv.count; k++) {
        v.fromBufferAttribute(pos, k);
        const t = (v.length() - p.ring.inner) / (p.ring.outer - p.ring.inner);
        uv.setXY(k, t, 0.5);
      }
      const rMat = track(new THREE.MeshBasicMaterial({
        map: track(ringTexture(p.ring.color)), transparent: true, side: THREE.DoubleSide,
        depthWrite: false, opacity: 0.95, fog: false,
      }));
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.position.copy(mesh.position);
      ring.rotation.x = -Math.PI / 2 + 0.42;
      ring.rotation.y = 0.3;
      group.add(ring);
    }
    (p.moons ?? []).forEach((m, mi) => {
      const mGeo = track(new THREE.SphereGeometry(m.radius, 20, 14));
      const mMat = track(new THREE.MeshStandardMaterial({ color: m.color, roughness: 1, metalness: 0, fog: false }));
      const moon = new THREE.Mesh(mGeo, mMat);
      group.add(moon);
      updaters.push((t) => {
        const a = t * m.speed + mi * 2.1;
        moon.position.set(
          mesh.position.x + Math.cos(a) * m.dist,
          mesh.position.y + Math.sin(a * 0.6) * m.dist * 0.18,
          mesh.position.z + Math.sin(a) * m.dist
        );
        moon.rotation.y = a;
      });
    });
    updaters.push((t) => { mesh.rotation.y = t * 0.012; });
    colliders.push({ pos: mesh.position.clone(), radius: p.radius, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
  });

  // ---------- ASTEROID BELT ----------
  if (arena.belt) {
    const belt = arena.belt;
    const count = Math.floor(belt.count * (quality === "low" ? 0.5 : quality === "medium" ? 0.75 : 1));
    const variants = quality === "low" ? 1 : 3;
    const r = rnd(4242);
    for (let vi = 0; vi < variants; vi++) {
      const geo = track(asteroidGeometry(vi * 13 + 1, quality === "low" ? 0 : 1));
      const mat = track(new THREE.MeshStandardMaterial({
        map: track(rockTexture()), color: 0x9a9086, roughness: 0.98, metalness: 0.08, flatShading: true,
      }));
      const per = Math.floor(count / variants);
      const inst = new THREE.InstancedMesh(geo, mat, per);
      inst.castShadow = quality === "high";
      inst.receiveShadow = quality === "high";
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const data: { pos: THREE.Vector3; scl: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3 }[] = [];
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < per; i++) {
        const a = r() * Math.PI * 2;
        const rad = belt.inner + Math.pow(r(), 0.7) * (belt.outer - belt.inner);
        const y = belt.plane ? (r() - 0.5) * rad * 0.16 : (r() - 0.5) * rad * 1.1;
        const pos = new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
        const scale = 3 + Math.pow(r(), 2.6) * 46;
        const rot = new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28);
        const spin = new THREE.Vector3((r() - 0.5) * 0.3, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3);
        const scl = new THREE.Vector3(scale, scale * (0.7 + r() * 0.5), scale);
        data.push({ pos, scl, rot, spin });
        m4.compose(pos, new THREE.Quaternion().setFromEuler(rot), scl);
        inst.setMatrixAt(i, m4);
        if (scale > 9) colliders.push({ pos, radius: scale * 0.92, vel: new THREE.Vector3(), spin });
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      const quat = new THREE.Quaternion();
      let touched = 0;
      updaters.push((_t, dt, cam) => {
        touched = 0;
        for (let i = 0; i < per; i++) {
          const d = data[i];
          if (d.pos.distanceToSquared(cam) > 1200 * 1200) continue;
          d.rot.x += d.spin.x * dt; d.rot.y += d.spin.y * dt; d.rot.z += d.spin.z * dt;
          quat.setFromEuler(d.rot);
          m4.compose(d.pos, quat, d.scl);
          inst.setMatrixAt(i, m4);
          touched++;
        }
        if (touched) inst.instanceMatrix.needsUpdate = true;
      });
    }
  }

  // ---------- SPACE STATION / WRECK ----------
  if (arena.station) {
    const st = new THREE.Group();
    const hullMat = track(new THREE.MeshStandardMaterial({ color: 0x8b95a5, roughness: 0.45, metalness: 0.92 }));
    const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x2b3240, roughness: 0.6, metalness: 0.8 }));
    const lightMat = track(new THREE.MeshBasicMaterial({ color: 0x66e6ff }));
    const ringGeo = track(new THREE.TorusGeometry(70, 7, quality === "low" ? 6 : 12, quality === "low" ? 24 : 56));
    const ring1 = new THREE.Mesh(ringGeo, hullMat);
    const ring2 = new THREE.Mesh(ringGeo, hullMat);
    ring2.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(track(new THREE.CylinderGeometry(11, 11, 150, 16)), darkMat);
    core.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(track(new THREE.SphereGeometry(20, 20, 14)), hullMat);
    st.add(ring1, ring2, core, hub);
    for (let i = 0; i < 8; i++) {
      const arm = new THREE.Mesh(track(new THREE.BoxGeometry(6, 6, 78)), darkMat);
      arm.rotation.y = (i / 8) * Math.PI * 2;
      arm.position.set(Math.cos((i / 8) * Math.PI * 2) * 36, 0, Math.sin((i / 8) * Math.PI * 2) * 36);
      st.add(arm);
    }
    for (let i = 0; i < 26; i++) {
      const w = new THREE.Mesh(track(new THREE.BoxGeometry(3, 3, 3)), lightMat);
      const a = (i / 26) * Math.PI * 2;
      w.position.set(Math.cos(a) * 70, (i % 3 - 1) * 6, Math.sin(a) * 70);
      st.add(w);
    }
    st.position.set(arena.bounds * 0.42, -80, -arena.bounds * 0.35);
    st.rotation.set(0.4, 0.7, 0.2);
    group.add(st);
    colliders.push({ pos: st.position.clone(), radius: 92, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
    updaters.push((_t, dt) => {
      ring1.rotation.z += dt * 0.25;
      ring2.rotation.y += dt * 0.2;
      st.rotation.y += dt * 0.01;
    });
  }

  // ---------- SECOND SUN + CROSS LIGHT (binary systems) ----------
  if (arena.sun2) {
    const s2 = arena.sun2;
    const mesh = new THREE.Mesh(track(new THREE.SphereGeometry(s2.radius, 32, 24)), track(new THREE.MeshBasicMaterial({ color: s2.color, fog: false })));
    mesh.position.set(...s2.pos);
    group.add(mesh);
    const glowMat = track(new THREE.SpriteMaterial({
      map: track(glowTexture("rgba(255,240,220,1)", "rgba(255,140,60,0)")),
      color: s2.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, fog: false,
    }));
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(s2.glow, s2.glow, 1);
    glow.position.copy(mesh.position);
    group.add(glow);
    updaters.push((t) => { const k = 1 + Math.sin(t * 0.9 + 1.7) * 0.035; glow.scale.set(s2.glow * k, s2.glow * k, 1); });
  }
  if (arena.light2) {
    const l2 = new THREE.DirectionalLight(arena.light2.color, arena.light2.intensity);
    l2.position.set(...arena.light2.pos);
    group.add(l2);
  }

  // ---------- CRYSTAL FIELD ----------
  if (arena.crystals) {
    const cr = arena.crystals;
    const total = Math.floor(cr.count * (quality === "low" ? 0.5 : quality === "medium" ? 0.75 : 1));
    const r = rnd(9191);
    const m4 = new THREE.Matrix4();
    const q4 = new THREE.Quaternion();
    const crystalGeo = track(new THREE.OctahedronGeometry(1, 0));
    crystalGeo.scale(0.5, 1.7, 0.5);
    const meshes: THREE.InstancedMesh[] = [];
    cr.colors.forEach((c, ci) => {
      const mat = track(new THREE.MeshStandardMaterial({
        color: c, metalness: 0.15, roughness: 0.12, emissive: c, emissiveIntensity: 0.55,
        flatShading: true, transparent: true, opacity: 0.92,
      }));
      const per = Math.ceil(total / cr.colors.length);
      const inst = new THREE.InstancedMesh(crystalGeo, mat, per);
      for (let i = 0; i < per; i++) {
        const a = r() * Math.PI * 2;
        const rad = cr.inner + Math.pow(r(), 0.75) * (cr.outer - cr.inner);
        const pos = new THREE.Vector3(Math.cos(a) * rad, (r() - 0.5) * rad * 0.7, Math.sin(a) * rad);
        const sc = 6 + Math.pow(r(), 2.2) * 52;
        q4.setFromEuler(new THREE.Euler((r() - 0.5) * 1.2, r() * 6.28, (r() - 0.5) * 1.2));
        m4.compose(pos, q4, new THREE.Vector3(sc, sc, sc));
        inst.setMatrixAt(i, m4);
        if (sc > 14) colliders.push({ pos, radius: sc * 0.95, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      meshes.push(inst);
      updaters.push((t) => { mat.emissiveIntensity = 0.45 + Math.sin(t * 1.3 + ci * 2.1) * 0.15; });
    });
  }

  // ---------- PULSAR ----------
  if (arena.pulsar) {
    const ps = arena.pulsar;
    const center = new THREE.Vector3(...ps.pos);
    const core = new THREE.Mesh(track(new THREE.SphereGeometry(ps.radius, 24, 16)), track(new THREE.MeshBasicMaterial({ color: 0xeaf6ff, fog: false })));
    core.position.copy(center);
    group.add(core);
    const haloMat = track(new THREE.SpriteMaterial({
      map: track(glowTexture("rgba(230,245,255,1)", "rgba(120,170,255,0)")),
      color: ps.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95, fog: false,
    }));
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(ps.radius * 18, ps.radius * 18, 1);
    halo.position.copy(center);
    group.add(halo);
    // twin radiation beams: cone apex at the star, fading toward the far end
    const beamGeo = track(new THREE.ConeGeometry(ps.radius * 3.2, ps.beamLength, 28, 1, true));
    beamGeo.translate(0, -ps.beamLength / 2, 0);
    const beamMat = track(new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(ps.color) }, uPulse: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 uColor; uniform float uPulse; varying vec2 vUv; void main(){ float a = pow(vUv.y, 2.2) * 0.42 * uPulse; gl_FragColor = vec4(uColor * 1.4, a); }",
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    }));
    const pivot = new THREE.Group();
    pivot.position.copy(center);
    pivot.rotation.set(0.5, 0, 0.35);
    const spinner = new THREE.Group();
    const beamA = new THREE.Mesh(beamGeo, beamMat);
    beamA.rotation.z = Math.PI / 2 - 0.55;
    const beamB = new THREE.Mesh(beamGeo, beamMat);
    beamB.rotation.z = -Math.PI / 2 - 0.55;
    spinner.add(beamA, beamB);
    pivot.add(spinner);
    group.add(pivot);
    const pl = new THREE.PointLight(ps.color, 2.2, ps.beamLength * 0.9, 1.3);
    pl.position.copy(center);
    group.add(pl);
    colliders.push({ pos: center.clone(), radius: ps.radius * 1.6, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
    updaters.push((t) => {
      spinner.rotation.y = t * ps.spin * Math.PI * 2;
      const pulse = 0.65 + 0.35 * Math.pow(Math.max(0, Math.sin(t * ps.spin * Math.PI * 4)), 6);
      (beamMat.uniforms.uPulse as { value: number }).value = pulse;
      pl.intensity = 1.4 + pulse * 2.2;
      const k = 1 + pulse * 0.25;
      halo.scale.set(ps.radius * 18 * k, ps.radius * 18 * k, 1);
    });
  }

  // ---------- DERELICT ARMADA ----------
  if (arena.derelicts) {
    const dr = arena.derelicts;
    const r = rnd(5151);
    const kinds: ShipClassId[] = ["battleship", "carrier", "dreadnaught", "frigate"];
    const count = quality === "low" ? Math.ceil(dr.count * 0.6) : dr.count;
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      const vis = buildShip(kind, 6, 1, quality === "high" ? "medium" : "low");
      derelicts.push(vis);
      // cold, dead hulls: darkened metal, engines and weapon tips off
      vis.hullMats.forEach((m) => { m.color.multiplyScalar(0.42); m.emissive.setRGB(0, 0, 0); });
      vis.trimMats.forEach((m) => m.color.multiplyScalar(0.55));
      vis.engineMats.forEach((m) => m.color.setRGB(0.04, 0.05, 0.07));
      vis.engineLight.intensity = 0;
      vis.shield.visible = false;
      const extra = 1.6 + r() * 1.2;
      vis.group.scale.multiplyScalar(extra);
      vis.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(vis.group);
      const size = box.getSize(new THREE.Vector3());
      const a = (i / count) * Math.PI * 2 + r() * 0.5;
      const rad = dr.spread * (0.35 + r() * 0.65);
      vis.group.position.set(Math.cos(a) * rad, (r() - 0.5) * 520, Math.sin(a) * rad);
      vis.group.rotation.set((r() - 0.5) * 0.9, r() * 6.28, (r() - 0.5) * 1.4);
      group.add(vis.group);
      // approximate the long hull with three spheres along its keel
      const keel = new THREE.Vector3(0, 0, 1).applyEuler(vis.group.rotation);
      const radius = Math.max(size.x, size.y) * 0.55;
      for (const f of [-0.33, 0, 0.33]) {
        colliders.push({
          pos: vis.group.position.clone().addScaledVector(keel, size.z * f),
          radius, vel: new THREE.Vector3(), spin: new THREE.Vector3(),
        });
      }
      const drift = (r() - 0.5) * 0.02;
      updaters.push((_t, dt) => { vis.group.rotateZ(drift * dt); });
    }
  }

  // ---------- PLANETARY SURFACE (Nebula Frontier & Stormworld) ----------
  let terrainHeight: World["terrainHeight"] = null;
  if (arena.planetary) {
    const pl = arena.planetary;
    const rawH = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      const rim = THREE.MathUtils.smoothstep(r, 180, 720);
      if (pl.kind === "nebula_frontier") {
        return planetaryTerrainHeight("nebula_frontier", x, z);
      }
      const plateauWave = Math.sin(x * 0.0019 + Math.cos(z * 0.0015) * 0.7) * Math.cos(z * 0.0018 - Math.sin(x * 0.0014) * 0.6);
      const mesa = Math.tanh(plateauWave * 4.2) * 115 * (0.4 + 0.6 * rim);
      const river = Math.exp(-Math.pow(Math.sin(x * 0.0013 + z * 0.0016) * 3.6, 2)) * 125;
      const outerPeaks = Math.pow(Math.max(0, Math.sin(x * 0.0031) * Math.cos(z * 0.0029)), 2.0) * 210 * rim;
      const crags = Math.sin(x * 0.009) * Math.cos(z * 0.009) * 14;
      return -255 + mesa + outerPeaks - river + crags;
    };
    terrainHeight = (x: number, z: number) => planetaryTerrainHeight(pl.kind, x, z);

    const seg = quality === "low" ? 72 : quality === "medium" ? 110 : 148;
    const span = arena.bounds * 2.15;
    const tGeo = track(new THREE.PlaneGeometry(span, span, seg, seg));
    tGeo.rotateX(-Math.PI / 2);
    const posAttr = tGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);
    const cLow = new THREE.Color(pl.groundColor);
    const cMid = new THREE.Color(pl.rockColor);
    const cHigh = new THREE.Color(pl.peakColor);
    const tmpC = new THREE.Color();
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = rawH(vx, vz);
      posAttr.setY(i, vy);
      const hNorm = THREE.MathUtils.clamp((vy + 340) / 410, 0, 1);
      if (hNorm < 0.55) tmpC.copy(cLow).lerp(cMid, hNorm / 0.55);
      else tmpC.copy(cMid).lerp(cHigh, (hNorm - 0.55) / 0.45);
      colors[i * 3] = tmpC.r;
      colors[i * 3 + 1] = tmpC.g;
      colors[i * 3 + 2] = tmpC.b;
    }
    tGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    tGeo.computeVertexNormals();
    const tMat = track(new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.14,
      flatShading: true,
    }));
    const terrainMesh = new THREE.Mesh(tGeo, tMat);
    terrainMesh.receiveShadow = quality === "high";
    group.add(terrainMesh);

    // Water / ocean / river surface on Stormworld
    if (pl.waterLevel !== undefined) {
      const wGeo = track(new THREE.PlaneGeometry(span, span, 24, 24));
      wGeo.rotateX(-Math.PI / 2);
      const wMat = track(new THREE.MeshStandardMaterial({
        color: pl.waterColor ?? 0x12486b,
        roughness: 0.16,
        metalness: 0.78,
        transparent: true,
        opacity: 0.86,
        emissive: new THREE.Color(pl.waterColor ?? 0x12486b).multiplyScalar(0.22),
      }));
      const water = new THREE.Mesh(wGeo, wMat);
      water.position.y = pl.waterLevel;
      group.add(water);
      updaters.push((t) => {
        water.position.y = pl.waterLevel! + Math.sin(t * 1.4) * 1.2;
      });
    }

    // Floating sky-islands & rock arches on Nebula Frontier
    if (pl.floatingIslands) {
      const r = rnd(31415);
      const islandMat = track(new THREE.MeshStandardMaterial({ color: pl.rockColor, roughness: 0.78, metalness: 0.2, flatShading: true }));
      const topMat = track(new THREE.MeshStandardMaterial({ color: pl.peakColor, roughness: 0.5, metalness: 0.3, emissive: new THREE.Color(pl.peakColor).multiplyScalar(0.18), flatShading: true }));
      const rootMat = track(new THREE.MeshBasicMaterial({ color: 0x54f0ff, transparent: true, opacity: 0.75 }));
      for (let i = 0; i < pl.floatingIslands; i++) {
        const a = (i / pl.floatingIslands) * Math.PI * 2 + (r() - 0.5) * 0.35;
        const dist = 240 + r() * (arena.bounds * 0.66);
        const ix = Math.cos(a) * dist;
        const iz = Math.sin(a) * dist;
        const iy = 45 + r() * 210;
        const rad = 32 + r() * 44;

        const isl = new THREE.Group();
        isl.position.set(ix, iy, iz);
        // inverted craggy cone underside
        const underGeo = track(asteroidGeometry(900 + i, 1));
        underGeo.scale(rad, rad * 1.15, rad);
        const under = new THREE.Mesh(underGeo, islandMat);
        under.position.y = -rad * 0.25;
        isl.add(under);
        // flat mesa cap
        const capGeo = track(new THREE.CylinderGeometry(rad * 0.92, rad * 1.04, rad * 0.36, 9));
        const cap = new THREE.Mesh(capGeo, topMat);
        cap.position.y = rad * 0.22;
        isl.add(cap);
        // glowing energy root / waterfall spire beneath
        const spireGeo = track(new THREE.ConeGeometry(rad * 0.18, rad * 1.35, 6));
        spireGeo.rotateX(Math.PI);
        const spire = new THREE.Mesh(spireGeo, rootMat);
        spire.position.y = -rad * 1.1;
        isl.add(spire);

        group.add(isl);
        colliders.push({ pos: isl.position.clone(), radius: rad * 0.95, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
      }
      // Natural canyon monolith arches
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const d = 320 + r() * 780;
        const ax = Math.cos(a) * d, az = Math.sin(a) * d;
        const ay = rawH(ax, az);
        const archR = 48 + r() * 32;
        const archGeo = track(new THREE.TorusGeometry(archR, archR * 0.22, 7, 14, Math.PI));
        const arch = new THREE.Mesh(archGeo, islandMat);
        arch.position.set(ax, ay + 10, az);
        arch.rotation.y = r() * Math.PI;
        group.add(arch);
        // Colliders on the two pillars so players can fly under the arch!
        const cos = Math.cos(arch.rotation.y), sin = Math.sin(arch.rotation.y);
        for (const s of [-1, 1]) {
          colliders.push({
            pos: new THREE.Vector3(ax + cos * archR * s, ay + archR * 0.35, az - sin * archR * s),
            radius: archR * 0.28, vel: new THREE.Vector3(), spin: new THREE.Vector3(),
          });
        }
      }
    }

    // Futuristic structures & defense towers on Stormworld
    if (pl.structures) {
      const r = rnd(27182);
      const structMat = track(new THREE.MeshStandardMaterial({ color: 0x32404e, metalness: 0.88, roughness: 0.32 }));
      const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x18222c, metalness: 0.82, roughness: 0.42 }));
      const beaconMat = track(new THREE.MeshBasicMaterial({ color: 0x4fe3ff }));
      const warnMat = track(new THREE.MeshBasicMaterial({ color: 0xff8a3d }));
      for (let i = 0; i < pl.structures; i++) {
        const a = (i / pl.structures) * Math.PI * 2 + (r() - 0.5) * 0.3;
        const dist = 220 + r() * (arena.bounds * 0.68);
        const sx = Math.cos(a) * dist;
        const sz = Math.sin(a) * dist;
        const sy = Math.max(pl.waterLevel ?? -315, rawH(sx, sz));
        const h = 85 + r() * 115;
        const w = 18 + r() * 14;

        const base = new THREE.Group();
        base.position.set(sx, sy, sz);
        // main armored tower shaft
        const towerGeo = track(new THREE.CylinderGeometry(w * 0.68, w, h, 8));
        const tower = new THREE.Mesh(towerGeo, structMat);
        tower.position.y = h * 0.5;
        base.add(tower);
        // upper command ring / landing deck
        const deckGeo = track(new THREE.CylinderGeometry(w * 1.25, w * 0.9, 10, 8));
        const deck = new THREE.Mesh(deckGeo, darkMat);
        deck.position.y = h * 0.82;
        base.add(deck);
        // glowing energy core strip & top beacon
        const stripGeo = track(new THREE.CylinderGeometry(w * 0.72, w * 0.72, 6, 8));
        const strip = new THREE.Mesh(stripGeo, i % 2 === 0 ? beaconMat : warnMat);
        strip.position.y = h * 0.92;
        base.add(strip);
        const spireGeo = track(new THREE.CylinderGeometry(1.2, 2.2, 34, 6));
        const spire = new THREE.Mesh(spireGeo, darkMat);
        spire.position.y = h + 17;
        base.add(spire);

        group.add(base);
        // two stacked collider spheres along the tower height
        colliders.push({ pos: new THREE.Vector3(sx, sy + h * 0.35, sz), radius: w * 1.05, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
        colliders.push({ pos: new THREE.Vector3(sx, sy + h * 0.8, sz), radius: w * 1.2, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
      }
    }

    // Atmospheric cloud deck
    const cloudTex = track(nebulaTexture(new THREE.Color(pl.cloudColor), 707));
    const rc = rnd(808);
    const cloudCount = quality === "low" ? 14 : 24;
    for (let i = 0; i < cloudCount; i++) {
      const cMat = track(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        opacity: 0.22 + rc() * 0.16, color: pl.cloudColor,
      }));
      const sp = new THREE.Sprite(cMat);
      sp.position.set((rc() - 0.5) * span * 0.85, pl.cloudAltitude + (rc() - 0.5) * 90, (rc() - 0.5) * span * 0.85);
      const sc = 420 + rc() * 520;
      sp.scale.set(sc, sc * 0.42, 1);
      group.add(sp);
    }

    // Stormworld periodic lightning flash
    if (pl.lightning) {
      const boltLight = new THREE.PointLight(0xbfe8ff, 0, 2600, 1.2);
      boltLight.position.set(0, pl.cloudAltitude + 80, 0);
      group.add(boltLight);
      updaters.push((t) => {
        const wave = Math.sin(t * 2.3) * Math.sin(t * 5.7) * Math.sin(t * 13.1);
        boltLight.intensity = wave > 0.86 ? (wave - 0.86) * 28 : 0;
      });
    }
  }

  // ---------- COSMIC DUST (parallax near camera) ----------
  const dustCount = Math.floor((arena.dust ?? 400) * q);
  {
    const g = track(new THREE.BufferGeometry());
    const pos = new Float32Array(dustCount * 3);
    const r = rnd(77);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] = (r() - 0.5) * 900;
      pos[i * 3 + 1] = (r() - 0.5) * 900;
      pos[i * 3 + 2] = (r() - 0.5) * 900;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = track(new THREE.PointsMaterial({
      size: 1.7, color: new THREE.Color(arena.starColor).lerp(new THREE.Color(0xffffff), 0.5),
      transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
      map: track(glowTexture()), sizeAttenuation: true,
    }));
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    group.add(pts);
    updaters.push((_t, _dt, cam) => {
      pts.position.copy(cam);
      pts.rotation.y += _dt * 0.004;
    });
  }

  return {
    group,
    colliders,
    gravity,
    keyLight: dir,
    terrainHeight,
    update(t, dt, camPos) {
      camHolder.v.copy(camPos);
      for (const u of updaters) u(t, dt, camPos);
    },
    dispose() {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose?.();
      });
      disposables.forEach((d) => d.dispose());
      derelicts.forEach((v) => v.dispose());
      disposables.length = 0;
    },
  };
}
