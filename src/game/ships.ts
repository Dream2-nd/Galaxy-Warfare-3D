import * as THREE from "three";
import {
  DRONE_TYPES, ENGINE_COLORS, PAINTS, SHIP_CLASSES,
  type DroneTypeId, type ShipClassId,
} from "./content";

/* Clean procedural spacecraft & combat drone collection.
 * Every silhouette is built from bevelled plan hulls, tapered fuselages, real
 * engine nozzles, panel strips, and weapon hardpoints. No loose glow spheres,
 * cyan rings, decorative circles, or floating shapes are attached to ships. */

const shieldVert = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vLocal;
void main(){
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vP = mv.xyz; vLocal = position;
  gl_Position = projectionMatrix * mv;
}`;
const shieldFrag = /* glsl */ `
uniform vec3 uColor; uniform float uTime;
uniform vec3 uHitDir; uniform float uHit; uniform float uFull;
varying vec3 vN; varying vec3 vP; varying vec3 vLocal;
void main(){
  float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(-vP))), 0.0, 1.0), 2.0);
  vec3 ld = normalize(vLocal);
  float d = dot(ld, normalize(uHitDir));
  float ang = acos(clamp(d, -1.0, 1.0));
  float front = (1.0 - uHit) * 1.7;
  float ring = exp(-pow((ang - front) * 6.5, 2.0)) * uHit;
  float spot = pow(max(d, 0.0), 12.0) * uHit * 1.7;
  float hex = smoothstep(0.55, 1.0, abs(sin(vLocal.x * 4.0 + uTime * 2.0) * sin(vLocal.y * 4.0) * sin(vLocal.z * 4.0)));
  float a = spot + ring * (0.8 + hex * 0.6) + fres * uFull * (0.65 + hex * 0.4);
  gl_FragColor = vec4(uColor * (1.2 + hex), clamp(a, 0.0, 1.0));
}`;

const plumeVert = /* glsl */ `
uniform float uLen; varying float vT;
void main(){ vT = clamp(-position.z / uLen, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const plumeFrag = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uIntensity; varying float vT;
void main(){
  float h = 1.0 - vT;
  float f = 0.84 + 0.16 * sin(uTime * 42.0 + vT * 31.0);
  vec3 c = mix(uColor, vec3(0.92, 0.98, 1.0), pow(h, 2.0));
  c += vec3(1.0) * pow(h, 7.0) * 1.35;
  float a = pow(h, 1.65) * (0.2 + uIntensity * 0.9) * f;
  gl_FragColor = vec4(c * (0.55 + uIntensity * 0.8), clamp(a, 0.0, 1.0));
}`;

export interface ShipVisual {
  group: THREE.Group;
  engines: THREE.Mesh[];
  engineMats: THREE.MeshBasicMaterial[];
  hullMats: THREE.MeshStandardMaterial[];
  trimMats: THREE.MeshStandardMaterial[];
  shield: THREE.Mesh;
  shieldMat: THREE.ShaderMaterial;
  engineLight: THREE.PointLight;
  muzzlePoints: THREE.Object3D[];
  exhaustPoints: THREE.Object3D[];
  cockpit?: THREE.Mesh;
  cockpitMat?: THREE.ShaderMaterial;
  classId: ShipClassId;
  dispose: () => void;
}

interface Ctx {
  group: THREE.Group;
  track<T extends THREE.BufferGeometry | THREE.Material>(x: T): T;
  disposables: (THREE.BufferGeometry | THREE.Material)[];
  hull: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  engine: THREE.MeshBasicMaterial;
  indicator: THREE.MeshBasicMaterial;
  glass: THREE.MeshPhysicalMaterial;
  seg: number;
  customPaint: boolean;
}

type BuildResult = { muzzles: THREE.Object3D[]; exhausts: THREE.Object3D[]; engines: THREE.Mesh[]; cockpit?: THREE.Mesh };

function makeCtx(paintIndex: number, quality: "low" | "medium" | "high", engineColorIndex = 0): Ctx {
  const p = PAINTS[paintIndex % PAINTS.length];
  const engSwatch = ENGINE_COLORS[engineColorIndex % ENGINE_COLORS.length];
  const engCol = engSwatch && engSwatch.color ? engSwatch.color : p.engine;
  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => { disposables.push(x); return x; };
  return {
    group: new THREE.Group(), track, disposables,
    hull: track(new THREE.MeshStandardMaterial({ color: p.hull, metalness: 0.92, roughness: 0.24, envMapIntensity: 1.45 })),
    trim: track(new THREE.MeshStandardMaterial({ color: p.trim, metalness: 0.86, roughness: 0.36 })),
    panel: track(new THREE.MeshStandardMaterial({ color: p.accent, metalness: 0.7, roughness: 0.42, emissive: new THREE.Color(p.accent).multiplyScalar(0.25) })),
    engine: track(new THREE.MeshBasicMaterial({ color: engCol })),
    indicator: track(new THREE.MeshBasicMaterial({ color: p.accent })),
    glass: track(new THREE.MeshPhysicalMaterial({ color: 0x07101d, metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.03, emissive: new THREE.Color(engCol).multiplyScalar(0.12) })),
    seg: quality === "low" ? 14 : quality === "medium" ? 22 : 34,
    customPaint: paintIndex !== 0,
  };
}

/** Bevelled hull made from a top-down plan. points are [lateral x, longitudinal z]. */
function planHull(ctx: Ctx, points: [number, number][], height: number, material = ctx.hull, y = 0, bevel = 0.1) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = ctx.track(new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 3,
  }));
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y + height * 0.5, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  ctx.group.add(mesh);
  return mesh;
}

function taperedFuselage(ctx: Ctx, radiusA: number, radiusB: number, len: number, z: number, material = ctx.hull) {
  const geo = ctx.track(new THREE.CylinderGeometry(radiusA, radiusB, len, ctx.seg, 2, false));
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.z = z;
  mesh.castShadow = true;
  ctx.group.add(mesh);
  return mesh;
}

function panelStrip(ctx: Ctx, x: number, y: number, z: number, len: number, material: THREE.Material = ctx.panel, width = 0.045) {
  const geo = ctx.track(new THREE.CylinderGeometry(width, width, len, 6));
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  ctx.group.add(mesh);
  return mesh;
}

function panelRibs(ctx: Ctx, z0: number, z1: number, halfWidth: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const z = THREE.MathUtils.lerp(z0, z1, count === 1 ? 0.5 : i / (count - 1));
    const geo = ctx.track(new THREE.CylinderGeometry(0.028, 0.028, halfWidth * 2, 6));
    geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, ctx.trim);
    mesh.position.set(0, y, z);
    ctx.group.add(mesh);
  }
}

function sidePanels(ctx: Ctx, z0: number, z1: number, y: number, halfWidth: number, count: number) {
  for (let i = 0; i < count; i++) {
    const z = THREE.MathUtils.lerp(z0, z1, (i + 0.5) / count);
    for (const side of [-1, 1]) panelStrip(ctx, side * halfWidth, y, z, 0.42, ctx.panel, 0.04);
  }
}

function tailFin(ctx: Ctx, x: number, y: number, z: number, height: number, length: number, cantAngle: number, material = ctx.trim) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -length * 0.5);
  shape.lineTo(0, length * 0.5);
  shape.lineTo(height, -length * 0.15);
  shape.lineTo(height, -length * 0.55);
  shape.closePath();
  const geo = ctx.track(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }));
  geo.rotateY(Math.PI / 2);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.z = cantAngle;
  ctx.group.add(m);
  return m;
}

function cockpit(ctx: Ctx, y: number, z: number, sx: number, sy: number, sz: number) {
  const geo = ctx.track(new THREE.SphereGeometry(1, ctx.seg, Math.max(10, Math.floor(ctx.seg * 0.55)), 0, Math.PI * 2, 0, Math.PI * 0.55));
  const mesh = new THREE.Mesh(geo, ctx.glass);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(0, y, z);
  ctx.group.add(mesh);
  return mesh;
}

function nozzle(ctx: Ctx, x: number, y: number, z: number, r: number, engines: THREE.Mesh[], exhausts: THREE.Object3D[]) {
  const bellGeo = ctx.track(new THREE.CylinderGeometry(r * 1.05, r * 0.76, r * 1.05, 14, 2, true));
  bellGeo.rotateX(Math.PI / 2);
  const bell = new THREE.Mesh(bellGeo, ctx.trim);
  bell.position.set(x, y, z);
  ctx.group.add(bell);
  const innerGeo = ctx.track(new THREE.CircleGeometry(r * 0.64, 14));
  innerGeo.rotateY(Math.PI);
  const inner = new THREE.Mesh(innerGeo, ctx.engine);
  inner.position.set(x, y, z - r * 0.55);
  ctx.group.add(inner);
  engines.push(inner);
  const ep = new THREE.Object3D();
  ep.position.set(x, y, z - r * 0.78);
  ep.userData.r = r;
  ctx.group.add(ep);
  exhausts.push(ep);
}

function hardpoint(ctx: Ctx, x: number, y: number, z: number, length: number, r: number, muzzles: THREE.Object3D[]) {
  const geo = ctx.track(new THREE.CylinderGeometry(r, r * 1.15, length, 10));
  geo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(geo, ctx.trim);
  barrel.position.set(x, y, z - length * 0.5);
  ctx.group.add(barrel);
  const tipGeo = ctx.track(new THREE.CylinderGeometry(r * 0.58, r * 0.68, 0.22, 8));
  tipGeo.rotateX(Math.PI / 2);
  const tip = new THREE.Mesh(tipGeo, ctx.engine);
  tip.position.set(x, y, z + 0.02);
  ctx.group.add(tip);
  const mp = new THREE.Object3D();
  mp.position.set(x, y, z + 0.18);
  ctx.group.add(mp);
  muzzles.push(mp);
}

function missilePod(ctx: Ctx, x: number, y: number, z: number, side: number) {
  const housing = planHull(ctx, [[-0.45, -0.75], [0.55, -0.6], [0.7, 0.65], [-0.5, 0.78]], 0.42, ctx.trim, y - 0.2, 0.05);
  housing.position.x += x;
  housing.position.z += z;
  housing.rotation.y = side * 0.12;
  for (let i = 0; i < 3; i++) {
    const tubeGeo = ctx.track(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8));
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, ctx.panel);
    tube.position.set(x + side * (i - 1) * 0.18, y, z + 0.54);
    ctx.group.add(tube);
  }
}

/* ============================================================ */
/*  10 UNIQUE PLAYABLE SPACESHIPS                                */
/* ============================================================ */

/** 1. TITAN DREADNOUGHT — Massive layered battleship with heavy batteries & 4 nozzles */
function buildTitan(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  planHull(ctx, [[-2.6, -5.4], [-3.6, -2.6], [-3.3, 2.7], [-1.6, 6.3], [0, 7.5], [1.6, 6.3], [3.3, 2.7], [3.6, -2.6], [2.6, -5.4]], 1.52, ctx.hull, -0.62, 0.16);
  planHull(ctx, [[-1.65, -3.2], [-2.05, 2.5], [0, 5.6], [2.05, 2.5], [1.65, -3.2]], 0.82, ctx.trim, 0.18, 0.1);
  // Elevated armored citadel
  planHull(ctx, [[-0.95, -2.2], [-1.1, 1.1], [0, 2.4], [1.1, 1.1], [0.95, -2.2]], 0.55, ctx.hull, 0.88, 0.08);
  for (const side of [-1, 1]) {
    planHull(ctx, [[side * 2.4, -3.9], [side * 6.1, -2.0], [side * 6.6, 1.5], [side * 3.1, 2.2]], 0.54, ctx.hull, -0.38, 0.11);
    tailFin(ctx, side * 5.2, 0.25, -2.4, 1.35, 2.6, -side * 0.22, ctx.trim);
    missilePod(ctx, side * 5.15, -0.55, -0.4, side);
    hardpoint(ctx, side * 4.2, -0.22, 3.1, 2.5, 0.22, muzzles);
  }
  panelRibs(ctx, -3.8, 3.6, 3.0, 0.94, 7);
  sidePanels(ctx, -3.6, 3.6, -0.8, 3.15, 8);
  const c = cockpit(ctx, 0.72, 3.05, 1.12, 0.55, 1.55);
  hardpoint(ctx, 0, 0.38, 6.85, 2.3, 0.28, muzzles);
  for (const x of [-2.1, -0.7, 0.7, 2.1]) nozzle(ctx, x, -0.42, -5.15, 0.58, engines, exhausts);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 2. PHANTOM STEALTH FIGHTER — Sharp black forward-swept stealth fighter with crimson accents */
function buildPhantom(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0x10151d); ctx.trim.color.set(0x1e2730); ctx.panel.color.set(0xd92638); }
  planHull(ctx, [[-1.1, -4.7], [-3.5, -2.0], [-5.2, 0.1], [-1.8, 2.0], [-0.8, 5.2], [0, 6.4], [0.8, 5.2], [1.8, 2.0], [5.2, 0.1], [3.5, -2.0], [1.1, -4.7]], 0.72, ctx.hull, -0.32, 0.1);
  planHull(ctx, [[-0.85, -3.6], [-1.25, 1.6], [0, 4.5], [1.25, 1.6], [0.85, -3.6]], 0.42, ctx.trim, 0.12, 0.06);
  panelStrip(ctx, 0, 0.5, 0.7, 7.2, ctx.panel, 0.04);
  for (const side of [-1, 1]) {
    planHull(ctx, [[side * 1.6, -1.8], [side * 4.9, -0.6], [side * 5.4, 0.85], [side * 1.6, 1.45]], 0.26, ctx.trim, -0.15, 0.06);
    tailFin(ctx, side * 1.55, 0.22, -3.1, 1.05, 2.1, -side * 0.38, ctx.hull);
    hardpoint(ctx, side * 1.45, -0.2, 3.75, 1.7, 0.13, muzzles);
    nozzle(ctx, side * 1.35, -0.28, -4.25, 0.44, engines, exhausts);
  }
  sidePanels(ctx, -2.0, 2.6, 0.28, 1.2, 6);
  const c = cockpit(ctx, 0.42, 2.05, 0.72, 0.36, 1.1);
  hardpoint(ctx, 0, -0.05, 6.3, 1.35, 0.16, muzzles);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 3. NOVA INTERCEPTOR — Sleek silver-white swept-wing interceptor with triple afterburners */
function buildNova(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0xd8e5ec); ctx.trim.color.set(0x2e4556); }
  planHull(ctx, [[-1.0, -5.1], [-2.5, -2.5], [-4.7, 0.2], [-1.85, 1.7], [-0.65, 5.8], [0, 7.3], [0.65, 5.8], [1.85, 1.7], [4.7, 0.2], [2.5, -2.5], [1.0, -5.1]], 0.76, ctx.hull, -0.35, 0.12);
  planHull(ctx, [[-0.78, -3.4], [-1.15, 1.3], [0, 5.1], [1.15, 1.3], [0.78, -3.4]], 0.44, ctx.trim, 0.1, 0.06);
  for (const side of [-1, 1]) {
    planHull(ctx, [[side * 1.8, -2.6], [side * 5.1, -1.1], [side * 5.7, 0.1], [side * 2.0, 1.5]], 0.2, ctx.hull, -0.1, 0.05);
    tailFin(ctx, side * 2.1, 0.2, -3.3, 1.15, 2.0, -side * 0.2, ctx.trim);
    missilePod(ctx, side * 3.75, -0.4, 0.25, side);
    hardpoint(ctx, side * 1.85, -0.16, 3.85, 1.75, 0.14, muzzles);
  }
  const c = cockpit(ctx, 0.5, 2.25, 0.75, 0.38, 1.3);
  hardpoint(ctx, 0, -0.02, 7.15, 1.45, 0.15, muzzles);
  for (const x of [-1.25, 0, 1.25]) nozzle(ctx, x, -0.2, -5.0, 0.42, engines, exhausts);
  sidePanels(ctx, -2.9, 2.4, 0.3, 1.15, 6);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 4. APOCALYPSE ASSAULT SHIP — Heavy armored assault gunship with quad cannons & missile pods */
function buildApocalypse(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0x18202a); ctx.trim.color.set(0x343b43); ctx.panel.color.set(0xff5a2a); }
  planHull(ctx, [[-2.15, -4.8], [-3.2, -1.5], [-3.6, 2.4], [-1.3, 5.8], [0, 6.7], [1.3, 5.8], [3.6, 2.4], [3.2, -1.5], [2.15, -4.8]], 1.32, ctx.hull, -0.55, 0.16);
  planHull(ctx, [[-1.5, -3.4], [-2.0, 1.8], [0, 4.8], [2.0, 1.8], [1.5, -3.4]], 0.65, ctx.trim, 0.15, 0.09);
  for (const side of [-1, 1]) {
    planHull(ctx, [[side * 2.2, -3.6], [side * 5.4, -2.0], [side * 5.0, 1.9], [side * 2.7, 2.9]], 0.55, ctx.hull, -0.43, 0.1);
    missilePod(ctx, side * 4.0, -0.7, -0.2, side);
    hardpoint(ctx, side * 2.1, 0.05, 4.25, 2.8, 0.23, muzzles);
    hardpoint(ctx, side * 2.1, -0.35, 4.1, 2.65, 0.18, muzzles);
  }
  for (const z of [-2.8, -1.6, -0.4, 0.8, 2.0]) panelStrip(ctx, 0, 0.92, z, 2.5, ctx.panel, 0.05);
  sidePanels(ctx, -3.0, 2.8, -0.78, 2.85, 8);
  const c = cockpit(ctx, 0.78, 2.7, 1.05, 0.45, 1.25);
  for (const x of [-1.6, 0, 1.6]) nozzle(ctx, x, -0.48, -5.1, 0.54, engines, exhausts);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 5. SPECTER ALIEN WARSHIP — Curved scythe-wing alien craft with central violet energy core */
function buildSpecter(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0x182133); ctx.trim.color.set(0x2f3e58); ctx.panel.color.set(0x6e58ff); }
  planHull(ctx, [[-1.1, -4.1], [-3.6, -2.0], [-4.5, 0.6], [-2.3, 3.2], [-0.8, 5.1], [0, 5.8], [0.8, 5.1], [2.3, 3.2], [4.5, 0.6], [3.6, -2.0], [1.1, -4.1]], 0.86, ctx.hull, -0.4, 0.15);
  planHull(ctx, [[-0.9, -2.8], [-1.45, 1.5], [0, 4.4], [1.45, 1.5], [0.9, -2.8]], 0.46, ctx.trim, 0.14, 0.08);
  // recessed alien energy core crystal in dorsal cavity
  const coreGeo = ctx.track(new THREE.OctahedronGeometry(0.58, 1));
  coreGeo.scale(0.85, 0.55, 1.6);
  const coreMesh = new THREE.Mesh(coreGeo, ctx.panel);
  coreMesh.position.set(0, 0.48, -0.6);
  ctx.group.add(coreMesh);
  for (const side of [-1, 1]) {
    planHull(ctx, [[side * 1.65, -1.8], [side * 4.85, -0.35], [side * 4.3, 1.8], [side * 1.45, 1.95]], 0.22, ctx.panel, -0.08, 0.07);
    hardpoint(ctx, side * 2.6, -0.05, 2.35, 1.55, 0.16, muzzles);
    nozzle(ctx, side * 0.95, -0.25, -4.2, 0.42, engines, exhausts);
  }
  const c = cockpit(ctx, 0.55, 1.85, 0.82, 0.38, 1.15);
  hardpoint(ctx, 0, 0.0, 5.9, 1.6, 0.17, muzzles);
  panelRibs(ctx, -2.0, 2.3, 1.45, 0.44, 5);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 6. SERAPHIM ADVANCED FIGHTER — Elegant silver X-foil gull-wing craft with precision lances */
function buildSeraphim(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0xe2edf5); ctx.trim.color.set(0x284358); ctx.panel.color.set(0x3fd4ff); }
  // Slender needle spine
  planHull(ctx, [[-0.85, -5.2], [-1.35, -1.4], [-1.1, 3.6], [-0.45, 6.8], [0, 7.9], [0.45, 6.8], [1.1, 3.6], [1.35, -1.4], [0.85, -5.2]], 0.68, ctx.hull, -0.3, 0.11);
  planHull(ctx, [[-0.58, -3.8], [-0.82, 2.4], [0, 5.6], [0.82, 2.4], [0.58, -3.8]], 0.38, ctx.trim, 0.12, 0.06);
  // Four-wing gull/X-foil array (upper swept-back + lower forward-swept)
  for (const side of [-1, 1]) {
    const upperW = planHull(ctx, [[side * 1.1, -2.4], [side * 5.6, -1.6], [side * 6.0, -0.4], [side * 1.3, 1.4]], 0.18, ctx.hull, 0.12, 0.05);
    upperW.rotation.z = side * 0.16;
    const lowerW = planHull(ctx, [[side * 1.1, -1.8], [side * 4.6, 0.2], [side * 4.9, 1.1], [side * 1.2, 1.8]], 0.16, ctx.trim, -0.25, 0.04);
    lowerW.rotation.z = -side * 0.14;
    panelStrip(ctx, side * 3.2, 0.25, -0.6, 3.2, ctx.panel, 0.038);
    // Long precision lance barrels
    hardpoint(ctx, side * 2.6, -0.05, 4.85, 2.9, 0.13, muzzles);
  }
  const c = cockpit(ctx, 0.48, 2.4, 0.68, 0.36, 1.55);
  hardpoint(ctx, 0, -0.06, 7.8, 1.8, 0.14, muzzles);
  for (const x of [-1.05, 0, 1.05]) nozzle(ctx, x, -0.15, -5.25, 0.38, engines, exhausts);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 7. VIPER STRIKE CRAFT — Compact twin-fang dogfighter with canards & crimson trim */
function buildViper(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0x232933); ctx.trim.color.set(0x12161c); ctx.panel.color.set(0xff3448); }
  // Twin-fang split nose + compact muscular rear body
  planHull(ctx, [[-1.3, -4.2], [-2.4, -1.6], [-1.9, 1.8], [-0.95, 5.3], [-0.35, 4.2], [0, 3.2], [0.35, 4.2], [0.95, 5.3], [1.9, 1.8], [2.4, -1.6], [1.3, -4.2]], 0.78, ctx.hull, -0.35, 0.1);
  // Dorsal air-intake scoop
  planHull(ctx, [[-0.7, -3.4], [-0.95, 0.8], [0, 2.8], [0.95, 0.8], [0.7, -3.4]], 0.48, ctx.trim, 0.14, 0.06);
  for (const side of [-1, 1]) {
    // Forward canards
    planHull(ctx, [[side * 1.1, 1.6], [side * 2.8, 2.5], [side * 2.9, 3.2], [side * 1.0, 2.9]], 0.15, ctx.panel, 0.0, 0.03);
    // Stubby high-roll strike wings
    planHull(ctx, [[side * 1.8, -2.8], [side * 4.3, -1.8], [side * 4.5, -0.3], [side * 1.9, 0.9]], 0.24, ctx.hull, -0.12, 0.05);
    tailFin(ctx, side * 1.85, 0.25, -2.8, 1.1, 1.9, -side * 0.28, ctx.panel);
    hardpoint(ctx, side * 0.95, -0.18, 5.45, 1.6, 0.14, muzzles);
    hardpoint(ctx, side * 2.9, -0.22, 1.2, 1.4, 0.12, muzzles);
    nozzle(ctx, side * 0.85, -0.2, -4.3, 0.48, engines, exhausts);
  }
  const c = cockpit(ctx, 0.52, 1.4, 0.7, 0.38, 1.05);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 8. COLOSSUS HEAVY CRUISER — Broad catamaran-prow warship with side battery sponsons */
function buildColossus(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0x384654); ctx.trim.color.set(0x1d2630); ctx.panel.color.set(0xffb03d); }
  // Broad hull with twin armored catamaran prows
  planHull(ctx, [[-2.9, -5.2], [-3.8, -2.0], [-3.7, 2.8], [-2.2, 6.4], [-0.9, 6.2], [-0.7, 4.2], [0.7, 4.2], [0.9, 6.2], [2.2, 6.4], [3.7, 2.8], [3.8, -2.0], [2.9, -5.2]], 1.45, ctx.hull, -0.6, 0.16);
  // Central terraced bridge deck
  planHull(ctx, [[-1.8, -3.8], [-2.1, 2.0], [0, 4.2], [2.1, 2.0], [1.8, -3.8]], 0.8, ctx.trim, 0.2, 0.1);
  for (const side of [-1, 1]) {
    // Heavy side sponson weapon pods
    planHull(ctx, [[side * 3.4, -3.0], [side * 5.8, -1.6], [side * 5.8, 1.8], [side * 3.5, 2.4]], 0.72, ctx.trim, -0.35, 0.1);
    missilePod(ctx, side * 4.8, 0.15, 0.2, side);
    hardpoint(ctx, side * 4.7, -0.15, 3.1, 2.4, 0.22, muzzles);
    hardpoint(ctx, side * 1.55, 0.0, 6.5, 2.1, 0.2, muzzles);
  }
  panelRibs(ctx, -3.6, 3.2, 3.2, 0.98, 8);
  sidePanels(ctx, -3.5, 3.2, -0.75, 3.5, 9);
  const c = cockpit(ctx, 0.86, 1.9, 1.18, 0.5, 1.35);
  for (const x of [-2.2, -0.75, 0.75, 2.2]) nozzle(ctx, x, -0.38, -5.25, 0.54, engines, exhausts);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 9. ECLIPSE ENERGY SHIP — Black-and-silver split-prong striker with central plasma reactor */
function buildEclipse(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  if (!ctx.customPaint) { ctx.hull.color.set(0x161922); ctx.trim.color.set(0xb8c6d4); ctx.panel.color.set(0xb65cff); }
  // Rear engine block + twin forward prongs framing the reactor cavity
  planHull(ctx, [[-1.8, -4.8], [-3.2, -1.8], [-2.8, 1.2], [-1.8, 6.2], [-0.85, 6.6], [-0.75, 1.0], [0.75, 1.0], [0.85, 6.6], [1.8, 6.2], [2.8, 1.2], [3.2, -1.8], [1.8, -4.8]], 0.9, ctx.hull, -0.42, 0.12);
  planHull(ctx, [[-1.3, -3.8], [-1.6, 0.8], [1.6, 0.8], [1.3, -3.8]], 0.5, ctx.trim, 0.12, 0.07);
  // Central exposed octahedral reactor core between the prongs
  const reactorGeo = ctx.track(new THREE.OctahedronGeometry(0.78, 1));
  const reactor = new THREE.Mesh(reactorGeo, ctx.panel);
  reactor.position.set(0, 0.1, 2.5);
  ctx.group.add(reactor);
  for (const side of [-1, 1]) {
    planHull(ctx, [[side * 2.4, -2.4], [side * 5.2, -0.8], [side * 4.8, 1.4], [side * 2.2, 2.2]], 0.28, ctx.trim, -0.12, 0.06);
    panelStrip(ctx, side * 1.3, 0.22, 3.6, 4.4, ctx.panel, 0.055);
    hardpoint(ctx, side * 1.32, -0.05, 6.7, 2.0, 0.18, muzzles);
    nozzle(ctx, side * 1.15, -0.22, -4.85, 0.5, engines, exhausts);
  }
  const c = cockpit(ctx, 0.56, -0.4, 0.86, 0.42, 1.25);
  hardpoint(ctx, 0, 0.1, 3.6, 1.4, 0.22, muzzles);
  return { muzzles, engines, exhausts, cockpit: c };
}

/** 10. ORBITAL UFO DESTROYER — Multi-tiered metallic flying saucer with rim cannons & dome */
function buildUfo(ctx: Ctx): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  const lower = taperedFuselage(ctx, 3.75, 2.65, 0.58, 0, ctx.trim);
  lower.scale.y = 0.58;
  const mid = taperedFuselage(ctx, 4.15, 3.85, 0.28, 0, ctx.panel);
  mid.scale.y = 0.35;
  const upper = taperedFuselage(ctx, 2.75, 3.55, 0.65, 0, ctx.hull);
  upper.scale.y = 0.48;
  const c = cockpit(ctx, 0.55, 0.15, 1.3, 0.78, 1.3);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    hardpoint(ctx, Math.cos(a) * 3.35, -0.14, Math.sin(a) * 3.35 + 0.25, 0.65, 0.17, muzzles);
  }
  for (const side of [-1, 1]) missilePod(ctx, side * 2.1, -0.52, 0.6, side);
  for (const x of [-1.4, 0, 1.4]) nozzle(ctx, x, -0.62, -3.05, 0.38, engines, exhausts);
  panelRibs(ctx, -2.8, 2.8, 3.2, 0.18, 10);
  return { muzzles, engines, exhausts, cockpit: c };
}

/* ============================================================ */
/*  6 DISTINCT COMBAT DRONE MODELS                               */
/* ============================================================ */

export function buildDroneByType(ctx: Ctx, droneType: DroneTypeId = "hunter"): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  const spec = DRONE_TYPES[droneType] ?? DRONE_TYPES.hunter;
  ctx.engine.color.set(spec.color);
  ctx.indicator.color.set(spec.accent);
  ctx.panel.color.set(spec.accent);
  ctx.panel.emissive.set(spec.accent).multiplyScalar(0.35);

  if (droneType === "assault") {
    // Twin-boom heavy gun drone
    ctx.hull.color.set(0x3a2e2b);
    planHull(ctx, [[-1.2, -2.3], [-1.9, -0.8], [-1.8, 1.8], [-0.9, 2.7], [0.9, 2.7], [1.8, 1.8], [1.9, -0.8], [1.2, -2.3]], 0.68, ctx.hull, -0.32, 0.09);
    for (const side of [-1, 1]) {
      hardpoint(ctx, side * 1.25, -0.05, 2.9, 1.45, 0.14, muzzles);
      nozzle(ctx, side * 0.75, -0.1, -2.35, 0.3, engines, exhausts);
    }
    panelStrip(ctx, 0, 0.42, 0.8, 1.6, ctx.indicator, 0.08);
    return { muzzles, engines, exhausts };
  }

  if (droneType === "interceptor") {
    // High-speed tri-wing dart drone
    ctx.hull.color.set(0xdce6f2);
    taperedFuselage(ctx, 0.12, 0.55, 4.4, 0.3, ctx.hull);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      tailFin(ctx, Math.cos(a) * 0.45, Math.sin(a) * 0.45, -0.8, 1.35, 2.0, a - Math.PI / 2, ctx.panel);
    }
    hardpoint(ctx, 0, 0, 2.65, 1.2, 0.11, muzzles);
    nozzle(ctx, 0, 0, -2.0, 0.38, engines, exhausts);
    return { muzzles, engines, exhausts };
  }

  if (droneType === "guardian") {
    // Hexagonal shield-matrix aegis drone
    ctx.hull.color.set(0x243b35);
    const hex: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      hex.push([Math.cos(a) * 2.1, Math.sin(a) * 2.1]);
    }
    planHull(ctx, hex, 0.52, ctx.hull, -0.26, 0.1);
    cockpit(ctx, 0.28, 0, 0.85, 0.45, 0.85);
    for (const side of [-1, 1]) hardpoint(ctx, side * 1.35, -0.08, 1.75, 0.95, 0.11, muzzles);
    nozzle(ctx, 0, -0.12, -2.15, 0.36, engines, exhausts);
    return { muzzles, engines, exhausts };
  }

  if (droneType === "scout") {
    // Long-wingspan sensor glider with dorsal radar dish
    ctx.hull.color.set(0xc8e4f0);
    planHull(ctx, [[-0.55, -2.1], [-3.2, -0.3], [-3.4, 0.35], [-0.6, 1.2], [0, 2.8], [0.6, 1.2], [3.4, 0.35], [3.2, -0.3], [0.55, -2.1]], 0.34, ctx.hull, -0.16, 0.06);
    const dish = taperedFuselage(ctx, 0.85, 0.25, 0.22, -0.2, ctx.panel);
    dish.rotation.x = 0;
    dish.position.set(0, 0.42, -0.2);
    hardpoint(ctx, 0, -0.08, 2.95, 1.2, 0.09, muzzles);
    nozzle(ctx, 0, -0.05, -2.15, 0.3, engines, exhausts);
    return { muzzles, engines, exhausts };
  }

  if (droneType === "stealth") {
    // Obsidian diamond-blade stealth drone
    ctx.hull.color.set(0x0d1017);
    ctx.trim.color.set(0x1a1f2c);
    planHull(ctx, [[0, -2.6], [-2.5, -0.4], [-1.1, 1.6], [0, 3.1], [1.1, 1.6], [2.5, -0.4]], 0.42, ctx.hull, -0.2, 0.07);
    for (const side of [-1, 1]) {
      tailFin(ctx, side * 0.9, 0.15, -1.5, 0.75, 1.4, -side * 0.45, ctx.panel);
      hardpoint(ctx, side * 0.7, -0.08, 2.35, 1.15, 0.09, muzzles);
    }
    nozzle(ctx, 0, -0.05, -2.55, 0.32, engines, exhausts);
    return { muzzles, engines, exhausts };
  }

  // Default: Hunter arrowhead drone
  ctx.trim.color.set(0x1b2633);
  planHull(ctx, [[-0.7, -2.2], [-1.6, -1.2], [-2.6, -0.2], [-0.9, 0.6], [-0.45, 2.4], [0, 3.0], [0.45, 2.4], [0.9, 0.6], [2.6, -0.2], [1.6, -1.2], [0.7, -2.2]], 0.5, ctx.hull, -0.25, 0.08);
  planHull(ctx, [[-0.45, -1.6], [-0.7, 0.8], [0, 2.1], [0.7, 0.8], [0.45, -1.6]], 0.32, ctx.trim, 0.12, 0.05);
  panelStrip(ctx, 0, 0.36, 1.25, 1.1, ctx.indicator, 0.07);
  for (const side of [-1, 1]) {
    planHull(ctx, [[side * 0.9, 0.4], [side * 1.9, 1.0], [side * 1.8, 1.5], [side * 0.8, 1.2]], 0.1, ctx.panel, 0.0, 0.03);
    hardpoint(ctx, side * 0.85, -0.12, 2.05, 1.0, 0.09, muzzles);
  }
  nozzle(ctx, 0, -0.05, -2.3, 0.34, engines, exhausts);
  return { muzzles, engines, exhausts };
}

/* ===== Capital models ===== */
function buildCapital(ctx: Ctx, kind: "frigate" | "battleship" | "carrier" | "dreadnaught" | "orbital"): BuildResult {
  const muzzles: THREE.Object3D[] = [], engines: THREE.Mesh[] = [], exhausts: THREE.Object3D[] = [];
  const scale = kind === "dreadnaught" ? 1.55 : kind === "carrier" || kind === "orbital" ? 1.32 : 1;
  const l = 9.0 * scale, w = 3.2 * scale;
  planHull(ctx, [[-w * 0.65, -l * 0.55], [-w, -l * 0.22], [-w * 0.86, l * 0.33], [-w * 0.35, l * 0.62], [0, l * 0.78], [w * 0.35, l * 0.62], [w * 0.86, l * 0.33], [w, -l * 0.22], [w * 0.65, -l * 0.55]], 1.8 * scale, ctx.hull, -0.8 * scale, 0.18 * scale);
  planHull(ctx, [[-w * 0.45, -l * 0.36], [-w * 0.56, l * 0.2], [0, l * 0.55], [w * 0.56, l * 0.2], [w * 0.45, -l * 0.36]], 0.75 * scale, ctx.trim, 0.25 * scale, 0.12 * scale);
  panelRibs(ctx, -l * 0.42, l * 0.4, w * 0.65, 1.02 * scale, 10);
  sidePanels(ctx, -l * 0.42, l * 0.38, -0.9 * scale, w * 0.86, 12);
  if (kind === "carrier" || kind === "orbital") {
    for (const x of [-w * 0.42, w * 0.42]) panelStrip(ctx, x, 0.66 * scale, -l * 0.05, l * 0.78, ctx.panel, 0.055 * scale);
    planHull(ctx, [[-w * 0.62, -l * 0.08], [-w * 0.76, l * 0.1], [-w * 0.55, l * 0.3], [w * 0.55, l * 0.3], [w * 0.76, l * 0.1], [w * 0.62, -l * 0.08]], 0.16 * scale, ctx.trim, 0.72 * scale, 0.03 * scale);
  }
  for (const side of [-1, 1]) {
    for (const z of [-l * 0.18, l * 0.16]) hardpoint(ctx, side * w * 0.88, 0.25 * scale, z + 0.8 * scale, 2.0 * scale, 0.2 * scale, muzzles);
  }
  hardpoint(ctx, 0, 0.15 * scale, l * 0.88, 2.8 * scale, 0.3 * scale, muzzles);
  const engineCols = kind === "dreadnaught" ? 5 : kind === "carrier" || kind === "orbital" ? 4 : 3;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < engineCols; col++) {
      nozzle(ctx, (col - (engineCols - 1) / 2) * (0.95 * scale), (row === 0 ? 0.18 : -0.65) * scale, -l * 0.66, 0.38 * scale, engines, exhausts);
    }
  }
  return { muzzles, engines, exhausts };
}

function buildFallback(ctx: Ctx, id: ShipClassId): BuildResult {
  if (id === "stealth") return buildPhantom(ctx);
  if (id === "interceptor" || id === "interceptor2") return buildSeraphim(ctx);
  if (id === "cruiser") return buildColossus(ctx);
  if (id === "heavy" || id === "heavyfighter" || id === "gunship") return buildApocalypse(ctx);
  if (id === "advanced") return buildEclipse(ctx);
  if (id === "scout" || id === "fighter") return buildViper(ctx);
  return buildNova(ctx);
}

function finalize(ctx: Ctx, id: ShipClassId, result: BuildResult, customScale?: number): ShipVisual {
  const cls = SHIP_CLASSES[id] ?? SHIP_CLASSES.nova;
  const shieldMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(ctx.engine.color.getHex()) }, uIntensity: { value: 0 }, uTime: { value: 0 },
      uHitDir: { value: new THREE.Vector3(0, 0, 1) }, uHit: { value: 0 }, uFull: { value: 0 },
    },
    vertexShader: shieldVert, fragmentShader: shieldFrag,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const shield = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(cls.radius * 1.5, 22, 14)), shieldMat);
  shield.visible = false;
  ctx.group.add(shield);
  const engineLight = new THREE.PointLight(ctx.engine.color.getHex(), 0.45, 22, 2);
  engineLight.position.set(0, -0.2, -3.5);
  ctx.group.add(engineLight);
  ctx.group.scale.setScalar(customScale ?? cls.scale);
  return {
    group: ctx.group, engines: result.engines,
    engineMats: [ctx.engine, ctx.indicator], hullMats: [ctx.hull, ctx.panel], trimMats: [ctx.trim],
    shield, shieldMat, engineLight, muzzlePoints: result.muzzles, exhaustPoints: result.exhausts,
    cockpit: result.cockpit, classId: id,
    dispose() { ctx.disposables.forEach((d) => d.dispose()); },
  };
}

export function buildShip(
  id: ShipClassId,
  paintIndex: number,
  _team: 0 | 1,
  quality: "low" | "medium" | "high",
  engineColorIndex = 0,
  droneType: DroneTypeId = "hunter",
): ShipVisual {
  const ctx = makeCtx(paintIndex, quality, engineColorIndex);
  let result: BuildResult;
  switch (id) {
    case "titan":      result = buildTitan(ctx); break;
    case "phantom":    result = buildPhantom(ctx); break;
    case "nova":       result = buildNova(ctx); break;
    case "apocalypse": result = buildApocalypse(ctx); break;
    case "specter":    result = buildSpecter(ctx); break;
    case "seraphim":   result = buildSeraphim(ctx); break;
    case "viper":      result = buildViper(ctx); break;
    case "colossus":   result = buildColossus(ctx); break;
    case "eclipse":    result = buildEclipse(ctx); break;
    case "saucer":     result = buildUfo(ctx); break;
    case "drone":      result = buildDroneByType(ctx, droneType); break;
    case "frigate":    result = buildCapital(ctx, "frigate"); break;
    case "battleship": result = buildCapital(ctx, "battleship"); break;
    case "carrier":    result = buildCapital(ctx, "carrier"); break;
    case "orbital":    result = buildCapital(ctx, "orbital"); break;
    case "dreadnaught":result = buildCapital(ctx, "dreadnaught"); break;
    default:           result = buildFallback(ctx, id);
  }
  const scaleOverride = id === "drone" ? (DRONE_TYPES[droneType]?.scale ?? 0.65) : undefined;
  return finalize(ctx, id, result, scaleOverride);
}

export function setShipPaint(v: ShipVisual, paintIndex: number, engineColor?: number) {
  const p = PAINTS[paintIndex % PAINTS.length];
  v.hullMats.forEach((m) => m.color.set(p.hull));
  v.trimMats.forEach((m) => m.color.set(p.trim));
  const ec = engineColor && engineColor !== 0 ? engineColor : p.engine;
  v.engineMats.forEach((m) => m.color.set(ec));
  v.shieldMat.uniforms.uColor.value.set(ec);
  v.engineLight.color.set(ec);
}

function plumeGeometry() {
  const g = new THREE.ConeGeometry(0.55, 1, 10, 4, true);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -0.5);
  return g;
}
const PLUME_GEOMETRY = plumeGeometry();

export function makePlume(color: number): THREE.Group {
  const group = new THREE.Group();
  const shared = { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uIntensity: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uLen: { value: 1 } },
    vertexShader: plumeVert, fragmentShader: plumeFrag,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(PLUME_GEOMETRY, material);
  mesh.frustumCulled = false;
  group.add(mesh);
  group.userData.shared = shared;
  group.userData.disposables = [material];
  return group;
}

export function setCriticalFlicker(v: ShipVisual, intensity: number, accent: number) {
  const c = new THREE.Color(accent).multiplyScalar(0.75 + Math.sin(intensity * 14 + performance.now() * 0.02) * 0.25);
  v.engineMats.forEach((m) => m.color.copy(c));
}
