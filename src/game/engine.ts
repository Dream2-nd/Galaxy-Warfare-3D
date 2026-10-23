import * as THREE from "three";
import {
  SHIP_CLASSES, WEAPONS, ARENA_BY_ID, DIFFICULTIES, AI_NAMES, DEFAULT_FIGHTER_HULL, DEFAULT_FIGHTER_SHIELD, SPECIAL_WEAPONS,
  DRONE_TYPES, LASER_COLORS, TRAIL_COLORS, FIGHTER_ROSTER, PRIMARY_WEAPONS, SECONDARY_WEAPONS,
  type ArenaConfig, type Difficulty, type DroneTypeId, type GameSettings, type ModeId, type ShipClassId, type ShipConfig, type WeaponId,
} from "./content";
import { buildWorld, type World } from "./world";
import { buildShip, type ShipVisual } from "./ships";
import { FXSystem } from "./fx";
import { ExhaustSystem } from "./exhaust";
import { WreckSystem } from "./wreck";
import { sweptSphereHit, interceptTime, turnToward } from "./combat";
import { audio } from "./audio";
import { Link, type NetMsg, type NetRole, type NetShipState } from "./net";
import { computeReward, type PerfRow } from "./economy";

// ---------- tuning ----------
const BASE_ACCEL = 118;
const BASE_SPEED = 158;
const BOOST_MUL = 2.15;
const DRAG = 0.62;
const TURN_RATE = 1.95;
const SHIELD_REGEN_DELAY = 5.5;
const SHIELD_REGEN = 11;

export interface RadarBlip { x: number; y: number; d: number; team: 0 | 1; me: boolean; alive: boolean }
export interface Marker { x: number; y: number; dist: number; team: 0 | 1; hp: number; name: string; onScreen: boolean; locked: boolean; tracked: number; drone: boolean }
export interface DamageNumber { id: number; x: number; y: number; amount: number; kind: "hull" | "shield" | "kill"; age: number }
export interface FeedItem { id: number; text: string; kind: "kill" | "info" | "warn"; t: number }

export interface HUDState {
  hp: number; maxHp: number; shield: number; maxShield: number; boost: number; boostMax: number;
  speed: number; throttle: number;
  weapon: WeaponId; weaponName: string; weaponCd: number; altWeapon: WeaponId; altCd: number;
  ultCd: number; ultReady: boolean; shieldCd: number; shieldActive: boolean;
  specialWeapon: WeaponId; specialCd: number; specialReady: boolean;
  target: { name: string; hp: number; shield: number; dist: number; team: 0 | 1 } | null;
  lock: number; locking: boolean;
  markers: Marker[];
  radar: RadarBlip[];
  score: [number, number];
  alive: [number, number];
  kills: number; deaths: number; assists: number; dmg: number;
  accuracy: number;
  time: number;
  mode: ModeId;
  wave: number;
  feed: FeedItem[];
  warnings: string[];
  damageDirs: number[];
  camera: "chase" | "cockpit";
  hitMarker: boolean;
  boosting: boolean;
  fps: number;
  arena: string;
  countdown: number;
  lowHp: boolean;
  missileAlert: boolean;
  netPing: number;
  netRole: NetRole;
  players: { name: string; team: 0 | 1; kills: number; alive: boolean; me: boolean; bot: boolean }[];
  missileMag: number;
  missileLoaded: number;
  dmgNums: DamageNumber[];
  killMarker: number;
  lead: { x: number; y: number } | null;
  incoming: number[];
  drones: { alive: number; total: number; stance: "ESCORT" | "ATTACK"; next: number; name?: string; state?: string; hp?: number; maxHp?: number } | null;
  tracking: number;
}

export interface EndResult {
  won: boolean;
  reason: string;
  kills: number; deaths: number; assists: number; damage: number;
  shots: number; hits: number; score: number; time: number; wave: number; mode: ModeId;
  players: { name: string; team: 0 | 1; kills: number; deaths: number; score: number; me: boolean; bot: boolean }[];
  /** Unique id for this finished match — used to prevent duplicate coin rewards. */
  matchId: string;
  /** Coins awarded for this match (0 for free roam, which never finishes). */
  reward: number;
  isMvp: boolean;
  mvpName: string;
  mvpTeam: 0 | 1;
}

export interface MatchConfig {
  mode: ModeId;
  arena: string;
  difficulty: Difficulty;
  ship: ShipConfig;
  net: NetRole;
  room: string;
  playerName: string;
  /** online only: fill empty slots with clearly-labelled combat AI */
  aiFill: boolean;
  humanSlots: number;
  ownedDrones?: DroneTypeId[];
  /** Weapon unlocks validated before launch / shots. */
  ownedWeapons?: WeaponId[];
}

interface AI {
  target: Ship | null;
  think: number;
  aimErr: number;
  strafeDir: number;
  strafeT: number;
  dodgeT: number;
  state: "hunt" | "evade" | "retreat" | "roam";
  dodgeCd: number;
  retreatCd: number;
  wander: THREE.Vector3;
  wanderT: number;
  fireT: number;
  skill: number;
  boostT: number;
  shieldT: number;
  react: number;
}

interface Ship {
  id: string; name: string; team: 0 | 1; local: boolean; remote: boolean;
  cfg: ShipConfig; clsId: string;
  obj: THREE.Group; vis: ShipVisual;
  pos: THREE.Vector3; vel: THREE.Vector3; quat: THREE.Quaternion;
  hp: number; maxHp: number; shield: number; maxShield: number;
  boost: number; boostMax: number; radius: number;
  alive: boolean; respawn: number;
  kills: number; deaths: number; assists: number; dmg: number; shots: number; hits: number; score: number;
  cd: { p: number; s: number; x: number; ult: number; sh: number };
  shieldActive: number; shieldBoost: boolean;
  lastDamage: number; hitFlash: number;
  targetId: string | null; lock: number;
  throttle: number; strafe: number; lift: number; rollIn: number; boosting: boolean;
  yawRate: number; pitchRate: number; rollRate: number;
  ai: AI | null;
  exhaustT: number; smokeT: number;
  recentHits: { id: string; t: number; dmg: number }[];
  netInput: Record<string, number>;
  yawDelta: number; pitchDelta: number;
  lockPrev: number; shieldPrev: number;
  slowedUntil: number;
  netQuat: THREE.Quaternion; netThrottle: number; sh: number;
  missileMag: number;
  missileLoaded: number;
  missileReserve: number;
  missileRecharge: number;
  drone: boolean; droneType: DroneTypeId | null; droneState: string; ownerId: string | null; droneSlot: number;
  recoil: number; dying: number; dyingT: number;
  trails: number[];
  shieldHit: number; shieldHitDir: THREE.Vector3; hullFlash: number;
  powerVis: number; boostVis: number;
  prevPos: THREE.Vector3;
}

interface Proj {
  pos: THREE.Vector3; vel: THREE.Vector3; dir: THREE.Vector3;
  life: number; dmg: number; owner: string; team: 0 | 1;
  color: number; size: number; radius: number; len: number;
  homing: number; targetId: string | null; splash: number; shieldMul: number;
  trailT: number; kind: WeaponId; accel: number; idx: number; alive: boolean;
  fx?: string;
  originVel?: THREE.Vector3;
  prevPos?: THREE.Vector3;
  spawnT?: number;
  slow?: number;
  trailId: number;   // glowing ribbon (missiles)
  armT: number;      // straight boost phase before guidance engages
  maxSpeed: number;
  seekT: number;     // re-acquisition timer for fire-and-forget seekers
  motor: number;     // rocket motor speed (unguided rockets accelerate off the rail)
  base: THREE.Vector3; // momentum inherited from the launching ship
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** AI missile fairness: hostile pilots reload slower and their seekers turn wider, by difficulty. */
const AI_MISSILE_CD: Record<Difficulty, number> = { easy: 4.5, normal: 3.4, hard: 2.4, expert: 1.7 };
const AI_SEEKER_TURN: Record<Difficulty, number> = { easy: 0.55, normal: 0.7, hard: 0.85, expert: 1.0 };
const AI_MISSILE_DMG: Record<Difficulty, number> = { easy: 0.6, normal: 0.75, hard: 0.9, expert: 1.0 };
/** cos(max angle between nose and lead point) before an AI pilot pulls the trigger: 12° / 8° / 6° / 4° */
const AI_FIRE_CONE: Record<Difficulty, number> = { easy: 0.978, normal: 0.99, hard: 0.9945, expert: 0.9976 };
const INTERCEPTOR_KINDS = new Set<WeaponId>(["intercept"]);
function wid_isInterceptor(w: WeaponId) { return INTERCEPTOR_KINDS.has(w); }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** ship models face +Z while lookAt orients -Z, so a half-turn is needed */
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private world!: World;
  private fx!: FXSystem;
  private arena: ArenaConfig;
  private cfg: MatchConfig;
  private settings: GameSettings;

  private ships = new Map<string, Ship>();
  private shipList: Ship[] = [];
  private projs: Proj[] = [];
  private me!: Ship;
  private link: Link;

  private raf = 0;
  private last = 0;
  private time = 0;
  private running = false;
  private paused = false;
  private disposed = false;

  // match
  private phase: "countdown" | "live" | "over" = "countdown";
  private countdown = 3.2;
  private matchTime = 0;
  private timeLeft = 0;
  private score: [number, number] = [0, 0];
  private wave = 0;
  private waveTimer = 0;
  private feed: FeedItem[] = [];
  private feedId = 1;
  private damageDirs: { a: number; t: number }[] = [];
  private warnings: string[] = [];
  private trauma = 0;                         // camera shake (trauma model)
  private exhaust!: ExhaustSystem;
  private wrecks!: WreckSystem;
  private dmgNums: { id: number; targetId: string; pos: THREE.Vector3; amount: number; kind: "hull" | "shield" | "kill"; age: number }[] = [];
  private dmgNumId = 1;
  private killMarker = 0;
  private lastEmptyWarn = -9;
  private droneStance: "escort" | "attack" = "escort";
  private droneRespawn: number[] = [];
  private droneTotal = 0
  private camMode: "chase" | "cockpit" = "chase";
  private camPos = new THREE.Vector3();
  private camQuat = new THREE.Quaternion();
  private camInit = false;

  // input
  private keys = new Set<string>();
  private mouseDX = 0; private mouseDY = 0;
  private mouseDown = [false, false, false];
  private pointerLocked = false;
  private mousePos = { x: 0, y: 0, active: false };
  private touch = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false, alt: false, boost: false, lift: 0, roll: 0, shield: false, nova: false };
  touchEnabled = false;

  // hud
  private hudT = 0;
  private fps = 60; private fpsAcc = 0; private fpsN = 0;
  private endSent = false;
  private grid = new Map<number, number[]>();
  private gridSize = 190;

  onHUD: (h: HUDState) => void = () => {};
  onEnd: (r: EndResult) => void = () => {};
  onNetStatus: (s: string) => void = () => {};
  onRoster: (p: { id: string; name: string; team: 0 | 1; host: boolean }[]) => void = () => {};

  constructor(canvas: HTMLCanvasElement, cfg: MatchConfig, settings: GameSettings) {
    this.canvas = canvas;
    this.cfg = cfg;
    this.settings = settings;
    this.arena = ARENA_BY_ID[cfg.arena] ?? ARENA_BY_ID.nebula;
    // guard against corrupted saved loadouts
    if (!SHIP_CLASSES[cfg.ship?.classId] || !WEAPONS[cfg.ship?.loadout?.primary] || !WEAPONS[cfg.ship?.loadout?.secondary]) {
      cfg.ship = { classId: "nova", paintIndex: 0, loadout: { primary: "laser", secondary: "missile", special: "charged", shieldMod: 1, engineMod: 1, armorMod: 1 } };
    }
    const owned = cfg.ownedWeapons;
    const canUse = (id: WeaponId) => !!WEAPONS[id] && (!owned || owned.includes(id));
    const fallback = (id: WeaponId, alt: WeaponId): WeaponId => (canUse(id) ? id : canUse(alt) ? alt : "laser");
    this.cfg.ship = {
      ...cfg.ship,
      loadout: {
        ...cfg.ship.loadout,
        primary: fallback(cfg.ship.loadout.primary, "laser"),
        secondary: fallback(cfg.ship.loadout.secondary, "homing"),
        special: fallback(cfg.ship.loadout.special, "charged"),
      },
    };
    this.link = new Link();
    this.link.onStatus = (s) => this.onNetStatus(s);
  }

  // ================= setup =================
  init() {
    const q = this.settings.quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: q !== "low", powerPreference: "high-performance", stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "high" ? 2 : q === "medium" ? 1.5 : 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = q === "high";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(new THREE.Color(this.arena.fogColor), 1);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.6, 60000);
    this.scene.fog = new THREE.FogExp2(this.arena.fogColor, this.arena.fogDensity);

    this.world = buildWorld(this.arena, q);
    this.scene.add(this.world.group);
    this.fx = new FXSystem(this.scene, q);
    this.exhaust = new ExhaustSystem(this.scene, q);
    this.wrecks = new WreckSystem(this.scene, this.fx, q);
    this.buildGrid();

    const mode = this.cfg.mode;
    const teamSize = mode === "team" ? 5 : mode === "wing" ? 2 : mode === "duel" ? 1 : mode === "practice" ? 3 : 0;

    const offline = this.cfg.net === "off";
    this.spawnPlayer();
    if (mode !== "free" && offline) {
      if (mode === "practice") this.spawnWave(true);
      else {
        for (let i = 0; i < teamSize; i++) this.spawnAI(1, i);
        if (mode === "team" || mode === "wing") for (let i = 0; i < teamSize - 1; i++) this.spawnAI(0, i);
      }
    }
    if (offline || this.cfg.net === "host") this.deployDrones();
    this.countdown = offline ? 3.2 : 6.5;
    this.timeLeft = mode === "duel" ? 420 : mode === "wing" ? 450 : mode === "team" ? 480 : 0;

    if (this.cfg.net !== "off" && this.cfg.room) {
      this.link.open(this.cfg.room, this.cfg.net);
      this.link.onMessage = (m) => this.onNetMessage(m);
      if (this.cfg.net === "client") {
        const hello = () => this.link.send({ t: "hello", id: this.me.id, name: this.cfg.playerName, ship: this.cfg.ship });
        hello();
        // the host may still be opening its channel — handshakes are idempotent
        this.helloTimers = [400, 1200, 2600, 5000].map((ms) => window.setTimeout(hello, ms));
        this.onNetStatus("Connecting to host…");
      } else {
        this.onNetStatus("Hosting room " + this.cfg.room);
      }
    }

    this.bindInput();
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    audio.startMusic(mode === "free" ? "menu" : "battle");
    this.pushFeed(mode === "free" ? "FREE ROAM — explore the system" : "MATCH START", "info");
  }

  private buildGrid() {
    this.grid.clear();
    const g = this.gridSize;
    this.world.colliders.forEach((c, i) => {
      if (c.radius < 6) return;
      const kx = Math.floor(c.pos.x / g), ky = Math.floor(c.pos.y / g), kz = Math.floor(c.pos.z / g);
      const key = (kx * 73856093) ^ (ky * 19349663) ^ (kz * 83492791);
      const arr = this.grid.get(key);
      if (arr) arr.push(i); else this.grid.set(key, [i]);
    });
  }

  private nearBuf: number[] = [];
  /** fills and returns a shared buffer — callers must use it immediately */
  private nearColliders(p: THREE.Vector3): number[] {
    const g = this.gridSize;
    const out = this.nearBuf;
    out.length = 0;
    const kx = Math.floor(p.x / g), ky = Math.floor(p.y / g), kz = Math.floor(p.z / g);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      const key = ((kx + x) * 73856093) ^ ((ky + y) * 19349663) ^ ((kz + z) * 83492791);
      const arr = this.grid.get(key);
      if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
    }
    return out;
  }

  private makeShip(id: string, name: string, team: 0 | 1, cfg: ShipConfig, local: boolean, pos: THREE.Vector3, droneType?: DroneTypeId): Ship {
    const cls = SHIP_CLASSES[cfg.classId] ?? SHIP_CLASSES.nova;
    const vis = buildShip(cfg.classId, cfg.paintIndex, team, this.settings.quality, cfg.engineColorIndex ?? 0, droneType ?? "hunter");
    this.scene.add(vis.group);
    vis.group.position.copy(pos);
    const armorMul = 1 + (cfg.loadout.armorMod - 1) * 0.16;
    const shieldMul = 1 + (cfg.loadout.shieldMod - 1) * 0.2;
    const engineMul = 1 + (cfg.loadout.engineMod - 1) * 0.14;
    // Standard profile for player-controlled fighters (50 HP / 10 shield).
    // Capitals stay at their wingHull/shield values.
    const isFighter = cls.category === "fighter";
    const baseHull = isFighter ? DEFAULT_FIGHTER_HULL : cls.hull;
    const baseShield = isFighter ? DEFAULT_FIGHTER_SHIELD : cls.shield;
    const maxHp0 = (isFighter ? baseHull : (cls.wingHull ?? baseHull)) * (isFighter ? 1 + (cfg.loadout.armorMod - 1) * 0.16 : 1);
    const maxShield0 = baseShield * shieldMul;
    // players get exactly 10 missiles in their magazine at start
const isPlayerFighter = isFighter && local;
const missileMag = isPlayerFighter ? 10 : 0;
    return {
      id, name, team, local, remote: false, cfg, clsId: cfg.classId,
      obj: vis.group, vis,
      pos: pos.clone(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(),
      hp: maxHp0, maxHp: maxHp0,
      shield: maxShield0, maxShield: maxShield0,
      boost: cls.boostCap * engineMul, boostMax: cls.boostCap * engineMul, radius: cls.radius,
      alive: true, respawn: 0, kills: 0, deaths: 0, assists: 0, dmg: 0, shots: 0, hits: 0, score: 0,
      cd: { p: 0, s: 0, x: 0, ult: 0, sh: 0 }, shieldActive: 0, shieldBoost: false,
      lastDamage: -99, hitFlash: 0, targetId: null, lock: 0,
      throttle: 0, strafe: 0, lift: 0, rollIn: 0, boosting: false,
      yawRate: 0, pitchRate: 0, rollRate: 0, ai: null, exhaustT: 0, smokeT: 0,
      recentHits: [], netInput: {},
      yawDelta: 0, pitchDelta: 0, lockPrev: 0, shieldPrev: 1, slowedUntil: -99,
      netQuat: new THREE.Quaternion(), netThrottle: 0, sh: maxShield0,
      missileMag, missileLoaded: missileMag, missileReserve: missileMag, missileRecharge: 0,
      drone: false, droneType: droneType ?? null, droneState: "FOLLOW", ownerId: null, droneSlot: -1,
      recoil: 0, dying: 0, dyingT: 0, trails: [],
      shieldHit: 0, shieldHitDir: new THREE.Vector3(0, 0, 1), hullFlash: 0,
      powerVis: 0, boostVis: 0, prevPos: pos.clone(),
    };
  }

  private spawnPos(team: 0 | 1, i = 0) {
    const r = this.arena.bounds * 0.23;
    const a = (team === 0 ? 0 : Math.PI) + (i - 2) * 0.3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    let y = (i % 3 - 1) * 40;
    if (this.world?.terrainHeight) {
      y = Math.max(y, this.world.terrainHeight(x, z) + 115 + (i % 3) * 24);
    }
    return new THREE.Vector3(x, y, z);
  }

  private faceCenter(s: Ship) {
    const m = new THREE.Matrix4().lookAt(s.pos, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    s.quat.setFromRotationMatrix(m).multiply(FLIP);
    s.obj.quaternion.copy(s.quat);
  }

  private spawnPlayer() {
    const id = "P_" + Math.random().toString(36).slice(2, 8);
    const s = this.makeShip(id, this.cfg.playerName || "PILOT-01", 0, this.cfg.ship, true, this.spawnPos(0, 2));
    this.faceCenter(s);
    this.me = s;
    this.addShip(s);
  }

  private addShip(s: Ship) {
    this.ships.set(s.id, s);
    this.shipList.push(s);
  }

  private removeShip(s: Ship) {
    this.scene.remove(s.obj);
    this.releaseShipTrails(s);
    s.vis.dispose();
    this.ships.delete(s.id);
    const i = this.shipList.indexOf(s);
    if (i >= 0) this.shipList.splice(i, 1);
  }

  private spawnAI(team: 0 | 1, i: number, waveScale = 1, overrideClass?: ShipClassId): Ship {
    const names = AI_NAMES;
    const name = names[(Math.random() * names.length) | 0] + "-" + (10 + ((Math.random() * 89) | 0));
    let classId: ShipClassId;
    if (overrideClass) classId = overrideClass;
    else {
      // 80% fighters, 20% capital spawns gated by arena.capitalSlots.
      const capital = false; // capital ships now arrive only as scheduled practice bosses
      if (capital) {
        const capList = ["frigate", "battleship", "carrier", "dreadnaught"].filter((id) => this.arena.capitalSlots! >= ["frigate", "battleship", "carrier", "dreadnaught"].indexOf(id) + 1);
        classId = capList[(Math.random() * capList.length) | 0] as ShipClassId;
      } else {
        classId = FIGHTER_ROSTER[(Math.random() * FIGHTER_ROSTER.length) | 0];
      }
    }
    const shipSpec = SHIP_CLASSES[classId] ?? SHIP_CLASSES.nova;
    const cfg: ShipConfig = {
      classId,
      paintIndex: team === 0 ? 5 : 4,
      equippedDrone: null,
      loadout: {
        primary: shipSpec.category === "capital" ? "heavy" : (shipSpec.defaultPrimary ?? PRIMARY_WEAPONS[(Math.random() * PRIMARY_WEAPONS.length) | 0]),
        secondary: shipSpec.category === "capital" ? "torpedo" : (shipSpec.defaultSecondary ?? (Math.random() > 0.45 ? "homing" : "missile")),
        special: shipSpec.category === "capital" ? "heavy" : "charged",
        shieldMod: 1, engineMod: 1, armorMod: 1,
      },
    };
    const s = this.makeShip("A_" + Math.random().toString(36).slice(2, 8), name, team, cfg, false, this.spawnPos(team, i));
    this.faceCenter(s);
    if (waveScale !== 1) { s.hp = s.maxHp = s.maxHp * waveScale; s.shield = s.maxShield = s.maxShield * waveScale; }
    const d = DIFFICULTIES[this.cfg.difficulty];
    s.ai = {
      target: null, think: Math.random() * 0.4, aimErr: d.aim, strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeT: 1 + Math.random() * 2, dodgeT: 0, state: SHIP_CLASSES[classId].category === "capital" ? "hunt" : "hunt",
      wander: new THREE.Vector3(),
      wanderT: 0, fireT: Math.random() * 0.6, skill: d.aggro, boostT: 0, shieldT: 0, react: d.react, dodgeCd: Math.random(), retreatCd: 0,
    };
    this.addShip(s);
    return s;
  }

  private spawnWave(first = false) {
    this.wave++;
    const n = clamp(2 + Math.floor(this.wave * 0.9), 2, 9);
    const scale = 1 + (this.wave - 1) * 0.07;
    const r = this.arena.bounds * 0.19;
    for (let i = 0; i < n; i++) {
      const s = this.spawnAI(1, i, scale);
      const a = (i / n) * Math.PI * 2 + this.wave * 0.7;
      const wx = Math.cos(a) * r, wz = Math.sin(a) * r;
      const wy = this.world?.terrainHeight ? Math.max(((i % 3) - 1) * 35, this.world.terrainHeight(wx, wz) + 110) : ((i % 3) - 1) * 35;
      s.pos.set(wx, wy, wz);
      s.obj.position.copy(s.pos);
      this.faceCenter(s);
    }
    if (this.wave % 4 === 0) {
      // every fourth wave a capital ship joins the attack as a boss
      const bosses: ShipClassId[] = ["frigate", "battleship", "carrier", "dreadnaught"];
      const id = bosses[Math.min(bosses.length - 1, this.wave / 4 - 1)];
      const b = this.spawnAI(1, 0, 1, id);
      const a = Math.random() * Math.PI * 2;
      b.pos.set(Math.cos(a) * r * 1.7, 60, Math.sin(a) * r * 1.7);
      b.obj.position.copy(b.pos);
      this.faceCenter(b);
      this.pushFeed(`CAPITAL SHIP INBOUND: ${SHIP_CLASSES[id].name}`, "warn");
    }
    this.pushFeed(first ? `WAVE ${this.wave} — ${n} hostiles inbound` : `WAVE ${this.wave} CLEARED → ${n} MORE INBOUND`, "warn");
    audio.play("warn");
  }

  // ================= input =================
  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (["Space", "ControlLeft", "ControlRight", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(c)) e.preventDefault();
    if (this.keys.has(c)) return;
    this.keys.add(c);
    if (c === "KeyC") this.camMode = this.camMode === "chase" ? "cockpit" : "chase";
    if (c === "Digit1") this.switchWeapon(0);
    if (c === "Digit2") this.switchWeapon(1);
    if (c === "KeyV") this.cycleSpecial();
    if (c === "KeyG") this.toggleDroneStance();
    if (c === "Tab") this.cycleTarget();
    if (c === "Escape") this.togglePause();
    if (c === "KeyP") this.togglePause();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onMouseMove = (e: MouseEvent) => {
    if (this.pointerLocked) {
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    } else {
      this.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mousePos.y = (e.clientY / window.innerHeight) * 2 - 1;
      this.mousePos.active = true;
    }
  };
  private onMouseDown = (e: MouseEvent) => {
    audio.resume();
    // never fire through the HUD chrome
    if (!this.pointerLocked && e.target !== this.canvas) return;
    if (!this.pointerLocked) this.requestLock();
    this.mouseDown[e.button] = true;
    if (e.button === 2) this.acquireLock();
  };
  private onMouseUp = (e: MouseEvent) => { this.mouseDown[e.button] = false; };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.switchWeapon(e.deltaY > 0 ? 1 : 0);
  };
  private onContext = (e: Event) => e.preventDefault();
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.setPaused(true);
    this.onNetStatus("Graphics context lost — resume or reload to re-initialise the renderer.");
  };
  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked && this.running && !this.paused) {
      // pointer lock lost (e.g. Esc) → pause
      this.setPaused(true);
    }
  };
  private onResize = () => {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  private onBlur = () => { if (this.running && !this.paused) this.setPaused(true); };

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("contextmenu", this.onContext);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("pointerlockchange", this.onLockChange);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    this.touchEnabled = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  setTouch(t: Partial<typeof this.touch>) { Object.assign(this.touch, t); }
  toggleCamera() { this.camMode = this.camMode === "chase" ? "cockpit" : "chase"; }
  boostPress(v: boolean) { this.touch.boost = v; this.me && (this.me.boosting = v); }
  requestLock() {
    try {
      const r = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === "function") r.catch(() => { /* lock unavailable — mouse-position aiming still works */ });
    } catch { /* older browsers return void */ }
  }
  releaseLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* noop */ } }

  switchWeapon(slot: number) {
    if (!this.me) return;
    const cur = this.meActiveSlot;
    if (cur === slot) return;
    this.meActiveSlot = slot;
    audio.play("ui");
  }
  /** Cycle the X-slot special weapon without touching primary/secondary loadouts. */
  cycleSpecial() {
    if (!this.me) return;
    const current = this.me.cfg.loadout.special;
    const index = Math.max(0, SPECIAL_WEAPONS.indexOf(current));
    const next = SPECIAL_WEAPONS[(index + 1) % SPECIAL_WEAPONS.length];
    this.me.cfg.loadout.special = next;
    this.me.cd.x = 0;
    this.pushFeed(`X-SLOT: ${WEAPONS[next].name}`, "info");
    audio.play("ui");
  }
  private meActiveSlot = 0;
  cycleTarget() {
    const enemies = this.shipList.filter((s) => s.alive && s.team !== this.me.team && s !== this.me);
    if (!enemies.length) { this.me.targetId = null; this.me.lock = 0; return; }
    enemies.sort((a, b) => a.pos.distanceToSquared(this.me.pos) - b.pos.distanceToSquared(this.me.pos));
    const idx = enemies.findIndex((e) => e.id === this.me.targetId);
    const next = enemies[(idx + 1) % enemies.length];
    this.me.targetId = next.id;
    this.me.lock = 0;
    audio.play("ui");
  }
  /** best enemy inside the firing cone of a ship */
  private bestTarget(s: Ship): Ship | null {
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
    let best: Ship | null = null; let bestScore = -Infinity;
    for (const e of this.shipList) {
      if (!e.alive || e.team === s.team || e === s) continue;
      const to = e.pos.clone().sub(s.pos);
      const d = to.length();
      if (d > 2800) continue;
      const dot = to.normalize().dot(fwd);
      const sc = dot * 2 - d / 3200;
      if (dot > 0.85 && sc > bestScore) { bestScore = sc; best = e; }
    }
    return best;
  }

  acquireLock() {
    if (!this.me) return;
    const best = this.bestTarget(this.me);
    if (best && best.id !== this.me.targetId) { this.me.lock = 0; audio.play("lock"); }
    if (best) this.me.targetId = best.id;
  }

  togglePause() { this.setPaused(!this.paused); }
  setPaused(p: boolean) {
    if (this.disposed) return;
    this.paused = p;
    if (p) { this.releaseLock(); audio.engineOff(); }
    else { audio.resume(); this.last = performance.now(); }
  }
  isPaused() { return this.paused; }

  applySettings(s: GameSettings) {
    this.settings = s;
    audio.setVolume(s.volume);
    audio.setMusic(s.music);
  }

  // ================= main loop =================
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.4) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }

    if (!this.paused) {
      this.time += dt;
      this.simulate(dt);
      this.fx.update(dt, this.camera);
      this.wrecks.update(dt);
    }
    this.updateVisuals(dt);
    this.world.update(this.time, this.paused ? 0 : dt, this.camera.position);
    const gl = this.renderer.getContext();
    if (!gl.isContextLost()) this.renderer.render(this.scene, this.camera);

    this.hudT += dt;
    if (this.hudT > 0.05) { this.hudT = 0; this.emitHUD(); }
  };

  private simulate(dt: number) {
    const isClient = this.cfg.net === "client";
    if (isClient) {
      this.sendInput();
      this.matchTime += dt;
      if (this.phase === "countdown") this.countdown = Math.max(0, this.countdown - dt);
      else this.countdown = 0;
      for (const s of this.shipList) {
        s.cd.p = Math.max(0, s.cd.p - dt);
        s.cd.s = Math.max(0, s.cd.s - dt);
        s.cd.x = Math.max(0, s.cd.x - dt);
        s.cd.ult = Math.max(0, s.cd.ult - dt);
        s.cd.sh = Math.max(0, s.cd.sh - dt);
        s.hitFlash = Math.max(0, s.hitFlash - dt * 3.4);
      }
      return;
    }

    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = "live";
        this.pushFeed("ENGAGE!", "info");
        if (this.cfg.net === "host" && this.cfg.aiFill) this.fillWithAI();
      }
    } else if (this.phase === "live") {
      this.matchTime += dt;
      if (this.timeLeft > 0) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) this.timeUp();
      }
    }

    this.readPlayerInput(dt);
    for (const s of this.shipList) {
      s.prevPos.copy(s.pos); // start-of-step position for swept hit tests
      if (s.ai) this.updateAI(s, dt);
      if (s.remote) this.applyNetInput(s);
      this.updateShip(s, dt);
    }
    this.updateProjectiles(dt);
    this.updateDying(dt);
    this.updateMatch(dt);
    if (this.cfg.net === "host") this.broadcastState(dt);
  }

  // ---------- player input ----------
  private readPlayerInput(dt: number) {
    const s = this.me;
    if (!s) return;
    const k = this.keys;
    const t = this.touch;
    let throttle = 0, strafe = 0, lift = 0, roll = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) throttle += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) throttle -= 1;
    if (k.has("KeyA")) strafe -= 1;
    if (k.has("KeyD")) strafe += 1;
    if (k.has("Space")) lift += 1;
    if (k.has("ControlLeft") || k.has("ControlRight") || k.has("KeyZ")) lift -= 1;
    if (k.has("KeyQ")) roll -= 1;
    if (k.has("KeyE")) roll += 1;
    if (k.has("ShiftLeft") || k.has("ShiftRight")) s.boosting = true; else s.boosting = false;

    // touch
    if (this.touchEnabled) {
      throttle += -t.moveY;
      strafe += t.moveX;
      lift += t.lift;
      roll += t.roll;
      if (t.boost) s.boosting = true;
    }

    s.throttle = clamp(throttle, -1, 1);
    s.strafe = clamp(strafe, -1, 1);
    s.lift = clamp(lift, -1, 1);
    s.rollIn = clamp(roll, -1, 1);

    // aim: mouse deltas (pointer lock) or off-center mouse position or right stick
    const sens = this.settings.sensitivity;
    let ax = 0, ay = 0;
    if (this.pointerLocked) {
      ax = -this.mouseDX * 0.0022 * sens;
      ay = this.mouseDY * 0.0022 * sens * (this.settings.invertY ? -1 : 1);
      this.mouseDX = 0; this.mouseDY = 0;
    } else if (this.mousePos.active) {
      const dead = 0.06;
      const mx = Math.abs(this.mousePos.x) > dead ? this.mousePos.x : 0;
      const my = Math.abs(this.mousePos.y) > dead ? this.mousePos.y : 0;
      ax = -mx * TURN_RATE * dt * sens;
      ay = my * TURN_RATE * dt * sens * (this.settings.invertY ? -1 : 1);
    }
    if (this.touchEnabled && (t.aimX !== 0 || t.aimY !== 0)) {
      ax += -t.aimX * TURN_RATE * dt * sens * 1.25;
      ay += t.aimY * TURN_RATE * dt * sens * (this.settings.invertY ? -1 : 1) * 1.25;
    }
    if (k.has("ArrowLeft")) ax += TURN_RATE * dt * 0.7;
    if (k.has("ArrowRight")) ax -= TURN_RATE * dt * 0.7;
    s.yawDelta = ax; s.pitchDelta = ay;

    // weapons
    const fire = this.mouseDown[0] || t.fire || k.has("KeyJ");
    const alt = this.mouseDown[2] || t.alt || k.has("KeyK");
    if (this.cfg.net === "client") {
      if (fire) this.predictFire(s, this.meActiveSlot);
      if (alt) this.predictFire(s, this.meActiveSlot === 0 ? 1 : 0);
    } else {
      if (fire) this.fireWeapon(s, this.meActiveSlot);
      if (alt) this.fireWeapon(s, this.meActiveSlot === 0 ? 1 : 0);
      if (k.has("KeyF") || t.shield) this.activateShield(s);
      if (k.has("KeyX") || t.nova) this.fireSpecial(s);
    }
    if (this.mouseDown[1]) this.acquireLock();
    if (this.settings.autoLock && !s.targetId) this.acquireLock();
    void dt;
  }

  // ---------- ship physics ----------
  private updateShip(s: Ship, dt: number) {
    if (!s.alive) {
      s.respawn -= dt;
      return;
    }
    const cls = SHIP_CLASSES[s.clsId as keyof typeof SHIP_CLASSES];
    // rotation
    const yawD = (s.yawDelta ?? 0) + s.yawRate * dt;
    const pitchD = (s.pitchDelta ?? 0) + s.pitchRate * dt;
    const rollD = s.rollIn * TURN_RATE * 1.5 * cls.agility * dt + s.rollRate * dt;
    if (yawD || pitchD || rollD) {
      const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchD, yawD, rollD, "XYZ"));
      s.quat.multiply(dq).normalize();
    }
    s.yawDelta = 0; s.pitchDelta = 0;

    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
    // model forward is +Z and the camera looks along it, so screen-right is local -X
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(s.quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);

    const engineMul = 1 + (s.cfg.loadout.engineMod - 1) * 0.14;
    const boosting = s.boosting && s.boost > 1 && Math.abs(s.throttle) > 0.05;
    const slowFactor = this.time < s.slowedUntil ? 0.55 : 1; // curse debuff halves acceleration
    const accel = BASE_ACCEL * (cls.accelBonus ?? cls.speed) * engineMul * slowFactor * (boosting ? BOOST_MUL : 1);
    if (boosting) {
      s.boost = Math.max(0, s.boost - 26 * dt);
      s.exhaustT += dt;
    } else {
      s.boost = Math.min(s.boostMax, s.boost + 13 * dt);
    }

    s.vel.addScaledVector(fwd, s.throttle * accel * dt);
    s.vel.addScaledVector(right, s.strafe * accel * 0.55 * dt);
    s.vel.addScaledVector(up, s.lift * accel * 0.5 * dt);

    // gravity well
    if (this.world.gravity) {
      const g = this.world.gravity;
      const to = g.pos.clone().sub(s.pos);
      const d = to.length();
      if (d < g.radius && d > 1) {
        const f = (g.strength / Math.max(140 * 140, d * d)) * dt;
        s.vel.addScaledVector(to.normalize(), f);
        if (d < 110) this.damage(s, 42 * dt, null, "gravity");
      }
    }

    // drag + clamp
    s.vel.multiplyScalar(Math.exp(-DRAG * dt * (boosting ? 0.5 : 1)));
    const maxSpeed = BASE_SPEED * cls.speed * engineMul * (boosting ? BOOST_MUL : 1);
    const sp = s.vel.length();
    if (sp > maxSpeed) s.vel.multiplyScalar(maxSpeed / sp);

    s.pos.addScaledVector(s.vel, dt);

    // arena bounds — soft containment
    const b = this.arena.bounds;
    const db = s.pos.length();
    if (db > b) {
      const n = s.pos.clone().normalize();
      s.pos.copy(n.multiplyScalar(b));
      const into = s.vel.dot(n);
      if (into > 0) s.vel.addScaledVector(n, -into * 1.5);
      if (s.local) this.pushWarning("ARENA BOUNDARY");
    }

    this.collideWorld(s, dt);

    // shield regen (cap cannot exceed 10 for fighters)
    if (this.time - s.lastDamage > SHIELD_REGEN_DELAY && s.shield < s.maxShield) {
      s.shield = Math.min(s.maxShield, s.shield + SHIELD_REGEN * dt * (s.shieldBoost ? 2.5 : 1));
    }
    // missile reload — refill one round every 4.5s when below max
    if (s.missileMag > 0 && s.missileLoaded < s.missileMag) {
      s.missileRecharge += dt;
      if (s.missileRecharge >= 4.5) {
        s.missileRecharge = 0;
        s.missileLoaded = Math.min(s.missileMag, s.missileLoaded + 1);
      }
    }
    if (s.shieldBoost) {
      s.shieldActive -= dt;
      if (s.shieldActive <= 0) s.shieldBoost = false;
    }
    s.cd.p = Math.max(0, s.cd.p - dt);
    s.cd.s = Math.max(0, s.cd.s - dt);
    s.cd.x = Math.max(0, s.cd.x - dt);
    s.cd.ult = Math.max(0, s.cd.ult - dt);
    s.cd.sh = Math.max(0, s.cd.sh - dt);
    s.hitFlash = Math.max(0, s.hitFlash - dt * 3.4);

    // target lock progress
    if (s.targetId) {
      const tgt = this.ships.get(s.targetId);
      if (!tgt || !tgt.alive) { s.targetId = null; s.lock = 0; }
      else {
        const to = tgt.pos.clone().sub(s.pos);
        const d = to.length();
        const fwdNow = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
        const ang = to.normalize().dot(fwdNow);
        const hasScout = s.local && this.shipList.some((dr) => dr.drone && dr.ownerId === s.id && dr.alive && dr.droneType === "scout");
        const lockRange = hasScout ? 3200 : 2400;
        const lockRate = hasScout ? 2.25 : 1.6;
        if (d < lockRange && ang > 0.88) s.lock = Math.min(1, s.lock + dt * lockRate);
        else s.lock = Math.max(0, s.lock - dt * 1.1);
        if (s.lock >= 1 && s.lockPrev !== 1 && s.local) audio.play("locked");
        s.lockPrev = s.lock;
      }
    }

    // engine damage smoke
    if (s.hp / s.maxHp < 0.4 && this.fx.hasBudget) {
      s.smokeT += dt;
      const rate = s.hp / s.maxHp < 0.18 ? 0.035 : 0.09;
      if (s.smokeT > rate) {
        s.smokeT = 0;
        const p = s.pos.clone().addScaledVector(fwd, -3).add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4));
        this.fx.smoke(p, s.vel.clone().multiplyScalar(-0.05), 3.4, 0x4a4a52, 2.1);
        if (Math.random() < 0.4) this.fx.burst(p, { count: 2, color: [0xff8a3d, 0xffd08a], speed: 14, size: 2.2, life: 0.5 });
      }
    }
    s.recentHits = s.recentHits.filter((h) => this.time - h.t < 8);
  }

  private collideWorld(s: Ship, dt: number) {
    // Planetary terrain heightfield collision
    if (this.world.terrainHeight) {
      const gy = this.world.terrainHeight(s.pos.x, s.pos.z);
      const minH = gy + s.radius + 1.5;
      if (s.pos.y < minH) {
        const hx = this.world.terrainHeight(s.pos.x + 5, s.pos.z) - this.world.terrainHeight(s.pos.x - 5, s.pos.z);
        const hz = this.world.terrainHeight(s.pos.x, s.pos.z + 5) - this.world.terrainHeight(s.pos.x, s.pos.z - 5);
        const n = this.tmpN.set(-hx, 10, -hz).normalize();
        s.pos.y = minH;
        const into = s.vel.dot(n);
        if (into < 0) {
          s.vel.addScaledVector(n, -into * 1.55);
          const impact = Math.abs(into);
          if (impact > 42 && !s.drone) {
            this.damage(s, Math.min(16, impact * 0.09), null, "terrain");
            this.fx.burst(s.pos.clone().addScaledVector(n, -s.radius), { count: 14, color: [0xffd08a, 0x7fe9ff, 0xffffff], speed: 46, size: 2.3, life: 0.45 });
            if (s.local) { this.addShake(clamp(impact / 170, 0.05, 0.42)); audio.play("impact"); }
          }
        }
      } else if (s.local && s.pos.y < gy + 42) {
        this.pushWarning("TERRAIN PULL UP");
      }
    }
    const near = this.nearColliders(s.pos).slice();
    for (let ni = 0; ni < near.length; ni++) {
      const c = this.world.colliders[near[ni]];
      const dx = s.pos.x - c.pos.x, dy = s.pos.y - c.pos.y, dz = s.pos.z - c.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const min = c.radius + s.radius;
      if (d < min && d > 0.001) {
        const n = new THREE.Vector3(dx / d, dy / d, dz / d);
        s.pos.copy(c.pos).addScaledVector(n, min);
        const into = s.vel.dot(n);
        if (into < 0) {
          s.vel.addScaledVector(n, -into * 1.6);
          const impact = Math.abs(into);
          if (impact > 40) {
            // scraping a rock hurts; it should not erase a 60-point fighter in one bump
            this.damage(s, Math.min(18, impact * 0.1), null, "collision");
            this.fx.burst(s.pos.clone().addScaledVector(n, -s.radius), { count: 14, color: [0xffd08a, 0xff8a3d, 0xffffff], speed: 46, size: 2.4, life: 0.5 });
            if (s.local) { this.addShake(clamp(impact / 160, 0.05, 0.5)); audio.play("impact"); }
          }
        }
      }
    }
    // ship-ship
    for (const o of this.shipList) {
      if (o === s || !o.alive) continue;
      if ((s.drone || o.drone) && s.team === o.team) continue;
      const to = s.pos.clone().sub(o.pos);
      const d = to.length();
      const min = s.radius + o.radius;
      if (d < min && d > 0.001) {
        const n = to.normalize();
        const push = (min - d) * 0.5;
        s.pos.addScaledVector(n, push);
        o.pos.addScaledVector(n, -push);
        const rel = s.vel.clone().sub(o.vel).dot(n);
        if (rel < 0) {
          s.vel.addScaledVector(n, -rel * 0.7);
          o.vel.addScaledVector(n, rel * 0.7);
          if (Math.abs(rel) > 30) {
            this.damage(s, Math.min(15, Math.abs(rel) * 0.06), null, "ram");
            this.damage(o, Math.min(15, Math.abs(rel) * 0.06), null, "ram");
            this.fx.burst(s.pos.clone().lerp(o.pos, 0.5), { count: 10, color: [0xffd08a, 0xffffff], speed: 40, size: 2, life: 0.4 });
          }
        }
      }
    }
    void dt;
  }

  // ---------- weapons ----------
  fireWeapon(s: Ship, slot: number, forcedWeapon?: WeaponId, forcedCooldown?: keyof Ship["cd"]) {
    if (!s.alive || this.phase === "countdown") return;
    const wid: WeaponId = forcedWeapon ?? (slot === 0 ? s.cfg.loadout.primary : s.cfg.loadout.secondary);
    const w = WEAPONS[wid];
    const cdKey: keyof Ship["cd"] = forcedCooldown ?? (slot === 0 ? "p" : "s");
    if (s.cd[cdKey] > 0) return;

    // 10-round missile magazine (shared by rockets and seekers)
    const isMissile = w.kind === "missile";
    if (isMissile && s.local && s.missileMag > 0 && s.missileLoaded <= 0) {
      if (this.time - this.lastEmptyWarn > 1.2) {
        this.lastEmptyWarn = this.time;
        this.pushFeed("MISSILE MAGAZINE EMPTY — RELOADING", "warn");
        audio.play("warn");
      }
      return;
    }
    s.cd[cdKey] = w.interval;
    if (s.ai && !s.drone && isMissile) s.cd[cdKey] *= AI_MISSILE_CD[this.cfg.difficulty];

    const guided = (w.homing ?? 0) > 0;
    const seekerTurn = (w.homing ?? 0) * (s.ai && !s.drone ? AI_SEEKER_TURN[this.cfg.difficulty] : 1);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);

    // ---- seekers lock whatever is in the seeker cone (locked target first) ----
    let seek: Ship | null = null;
    if (guided && wid !== "intercept") {
      if (wid === "revenge") {
        for (let k = s.recentHits.length - 1; k >= 0 && !seek; k--) {
          const t = this.ships.get(s.recentHits[k].id);
          if (t && t.alive && t.team !== s.team) seek = t;
        }
      }
      if (!seek && s.targetId) {
        const t = this.ships.get(s.targetId);
        if (t && t.alive && t.team !== s.team) {
          const to = t.pos.clone().sub(s.pos);
          if (to.length() < 2600 && to.normalize().dot(fwd) > 0.64) seek = t;  // ~50° seeker cone
        }
      }
      if (!seek) seek = this.bestTarget(s);
      if (seek && s.local) s.targetId = seek.id;
    }
    // ---- light aim assist for the pilot's unguided shots ----
    const assist = s.local && !guided ? this.aimAssistTarget(s, fwd) : null;

    const muzzles = s.vis.muzzlePoints;
    const burst = w.burst ?? 1;
    const inheritVel = s.vel.clone().multiplyScalar(guided ? 0.45 : 0.75);
    for (let b = 0; b < burst; b++) {
      s.shots++;
      const mp = muzzles.length ? muzzles[(s.shots + b) % muzzles.length] : null;
      const origin = mp ? mp.getWorldPosition(new THREE.Vector3()) : s.pos.clone().addScaledVector(fwd, s.radius);
      const dir = fwd.clone();
      let assisted = false;
      if (assist) {
        const relPos = assist.pos.clone().sub(origin);
        const relVel = assist.vel.clone().sub(inheritVel);
        const t = interceptTime(relPos, relVel, w.speed);
        if (t > 0 && t < w.life) {
          const aim = relPos.addScaledVector(relVel, t).normalize();
          const cone = assist.id === s.targetId ? 0.16 : 0.1;   // radians
          if (aim.dot(fwd) > Math.cos(cone)) { dir.copy(aim); assisted = true; }
        }
      }
      if (burst > 1) {
        const a = (b / Math.max(1, burst - 1) - 0.5) * (w.spread + 0.4);
        dir.applyAxisAngle(up, a * 1.1);
        if (guided) dir.addScaledVector(up, (Math.random() - 0.5) * 0.25);
      } else if (w.spread > 0) {
        const sp = assisted ? w.spread * 0.35 : w.spread;
        dir.x += (Math.random() - 0.5) * sp * 2;
        dir.y += (Math.random() - 0.5) * sp * 2;
        dir.z += (Math.random() - 0.5) * sp * 2;
      }
      dir.normalize();

      const customLaserCol = !isMissile && s.cfg.laserColorIndex ? (LASER_COLORS[s.cfg.laserColorIndex % LASER_COLORS.length]?.color || 0) : 0;
      const customTrailCol = isMissile && s.cfg.trailColorIndex ? (TRAIL_COLORS[s.cfg.trailColorIndex % TRAIL_COLORS.length]?.color || 0) : 0;
      const shotColor = customLaserCol || w.color;
      const launch = guided ? w.speed * 0.55 : isMissile ? w.speed * 0.6 : w.speed;
      const p: Proj = {
        pos: origin.clone(), vel: dir.clone().multiplyScalar(launch).add(inheritVel), dir,
        life: w.life, dmg: w.dmg * (s.ai && !s.drone && isMissile ? AI_MISSILE_DMG[this.cfg.difficulty] : 1),
        owner: s.id, team: s.team, color: shotColor,
        size: w.size, radius: w.size * 1.7, len: clamp(w.speed * 0.022, 4, 26),
        homing: guided ? seekerTurn : 0, targetId: seek ? seek.id : null,
        splash: w.splash ?? 0, shieldMul: w.shieldDmgMul ?? 1,
        trailT: 0, kind: wid, accel: isMissile ? w.speed * 1.6 : 0, idx: -1, alive: true,
        fx: w.fx ?? "blue", prevPos: origin.clone(), slow: w.slow ?? 0,
        trailId: -1, armT: guided ? 0.14 : 0, maxSpeed: guided ? w.speed * 1.3 : w.speed, seekT: 0,
        motor: launch, base: inheritVel.clone(),
      };
      if (isMissile) {
        const trailCol = customTrailCol || (wid === "revenge" ? 0xff4a5a : w.fx === "missile" || wid === "torpedo" ? 0xffb46a : shotColor);
        p.trailId = this.exhaust.createTrail(guided ? 0.95 : 0.55, trailCol);
      }
      this.projs.push(p);

      if (b === 0) {
        // ---- MUZZLE FLASH: white-hot pop + coloured halo + forward sparks ----
        this.fx.burst(origin, {
          count: w.id === "rapid" ? 4 : 12, color: [0xffffff, w.color, w.color],
          speed: 80, size: w.size * 1.7, life: 0.18, lifeVar: 0.5, drag: 5.5, dir, cone: 0.45,
        });
        this.fx.flash(origin, w.size * 1.2, w.size * 7, 0.075, 0xffffff);
        this.fx.flash(origin, w.size * 2.4, w.size * 15, 0.15, w.color);
        if (this.settings.quality !== "low" && (s.local || isMissile)) this.fx.lightFlash(origin, w.color, 320, 170, 0.08);
        if (s.local || s.pos.distanceTo(this.camera.position) < 300) {
          audio.play(w.sound, clamp(s.pos.distanceTo(this.camera.position) / 900, 0, 1));
        }
        if (this.cfg.net === "host") {
          this.link.send({ t: "fx", k: "shot", p: [origin.x, origin.y, origin.z], c: w.color, s: w.size, d: s.local ? 1 : 0 });
        }
      }
    }
    // A multi-rocket rack consumes a single magazine round per trigger press.
    if (isMissile && s.local) s.missileLoaded = Math.max(0, s.missileLoaded - 1);

    // recoil kick on the model + a little camera shake for heavy hardware
    const heavy = wid === "heavy" || wid === "charged" || wid === "darkmatter" || wid === "torpedo";
    s.recoil = Math.min(1.4, s.recoil + (heavy ? 1.0 : isMissile ? 0.45 : 0.12));
    if (s.local) this.addShake(heavy ? 0.26 : isMissile ? 0.12 : 0.02);
  }

  /** Enemy near the crosshair that unguided shots may converge on. */
  private aimAssistTarget(s: Ship, fwd: THREE.Vector3): Ship | null {
    let best: Ship | null = null; let bestDot = -1;
    for (const e of this.shipList) {
      if (!e.alive || e.team === s.team) continue;
      const to = this.tmpA.copy(e.pos).sub(s.pos);
      const d = to.length();
      if (d > 2100 || d < 1) continue;
      const dot = to.divideScalar(d).dot(fwd);
      const cone = e.id === s.targetId ? 0.97 : 0.988;   // ~14° on the locked target, ~9° otherwise
      if (dot > cone && dot > bestDot) { bestDot = dot; best = e; }
    }
    return best;
  }

  /** Fires the loadout-selected X-slot special: laser, plasma, missile, or rare ability. */
  private fireSpecial(s: Ship) {
    this.fireWeapon(s, 2, s.cfg.loadout.special, "x");
  }

  private activateShield(s: Ship) {
    if (s.cd.sh > 0 || s.shieldBoost || !s.alive) return;
    s.shieldBoost = true;
    s.shieldActive = 2.8;
    s.cd.sh = 11;
    s.shield = Math.min(s.maxShield, s.shield + s.maxShield * 0.22);
    if (s.local) audio.play("shieldup");
    // countermeasure flares: every seeker locked on this ship loses track and is blinded briefly
    let spoofed = 0;
    for (const p of this.projs) {
      if (p.alive && p.homing > 0 && p.targetId === s.id) { p.targetId = null; p.seekT = 1.4; spoofed++; }
    }
    this.fx.burst(s.pos, { count: 22, color: [0xffffff, 0xffd08a, 0xff9a3d], speed: 95, size: 2.4, life: 0.9, drag: 1.2 });
    if (s.local && spoofed) this.pushFeed(`FLARES — ${spoofed} SEEKER${spoofed > 1 ? "S" : ""} SPOOFED`, "info");
    this.fx.shockwave(s.pos.clone(), s.radius, s.radius * 5, 0.5, s.vis.engineMats[0].color.getHex());
  }

  private fireNova(s: Ship) {
    if (s.cd.ult > 0 || !s.alive) return;
    s.cd.ult = WEAPONS.nova.interval;
    const R = WEAPONS.nova.splash ?? 260;
    this.fx.shockwave(s.pos.clone(), 4, R * 1.25, 1.1, 0xbfe9ff);
    this.fx.shockwave(s.pos.clone(), 2, R * 0.8, 0.8, 0xff8ae0);
    this.fx.flash(s.pos.clone(), 10, R * 1.6, 0.7, 0xffffff);
    this.fx.lightFlash(s.pos.clone(), 0x9fe8ff, 2200, R * 4, 1.1);
    this.fx.burst(s.pos.clone(), { count: 160, color: [0xffffff, 0x9fe8ff, 0xff8ae0], speed: 300, size: 4, life: 1.2, drag: 1.4 });
    if (s.local) { audio.play("nova"); this.addShake(0.85); }
    for (const o of this.shipList) {
      if (!o.alive || o === s || o.team === s.team) continue;
      const d = o.pos.distanceTo(s.pos);
      if (d < R) {
        const f = 1 - d / R;
        this.damage(o, (WEAPONS.nova.dmg * f + 12) * (s.ai ? 0.6 : 1), s, "nova");
        o.vel.addScaledVector(o.pos.clone().sub(s.pos).normalize(), 130 * f);
      }
    }
    if (this.cfg.net === "host") this.link.send({ t: "fx", k: "nova", p: [s.pos.x, s.pos.y, s.pos.z], s: R });
  }

  private updateProjectiles(dt: number) {
    const camP = this.camera.position;
    // Rendering is rebuilt each frame from the authoritative projectile list.
    this.fx.clearBullets();
    for (let i = 0; i < this.projs.length; i++) {
      const p = this.projs[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        if (WEAPONS[p.kind].kind === "missile") this.fx.burst(p.pos, { count: 10, color: [0xffffff, p.color], speed: 40, size: 2, life: 0.3 });
        continue;
      }
      if (!p.prevPos) p.prevPos = p.pos.clone();
      p.prevPos.copy(p.pos);

      // ---- propulsion & guidance ----
      if (p.homing > 0) this.guide(p, dt);
      else if (p.accel > 0) {
        // unguided rocket motor: accelerates off the rail along its launch line
        p.motor = Math.min(p.maxSpeed, p.motor + p.accel * dt);
        p.vel.copy(p.dir).multiplyScalar(p.motor).add(p.base);
      }
      p.pos.addScaledVector(p.vel, dt);

      // ---- trail particles ----
      p.trailT += dt;
      const isMissile = WEAPONS[p.kind].kind === "missile";
      const sparkle = isMissile || p.kind === "charged" || p.kind === "plasma" || p.kind === "darkmatter" || p.kind === "curse" || p.kind === "heavy";
      if (sparkle && p.trailT > (isMissile ? 0.04 : 0.05) && this.fx.hasBudget && p.pos.distanceToSquared(camP) < 1600 * 1600) {
        p.trailT = 0;
        if (isMissile) this.fx.smoke(p.pos, this.tmpZero, 2.2, 0x8a8f9a, 1.1);
        const trailCol = p.kind === "revenge" ? 0xff3a4a : p.kind === "darkmatter" ? 0x6a3aff : p.kind === "curse" ? 0xa8e0ff : p.color;
        this.fx.burst(p.pos, { count: 1, color: [trailCol, 0xffffff], speed: 4, size: p.size * 1.5, life: 0.28, drag: 2.6 });
      }

      // ---- arena bounds ----
      if (p.pos.lengthSq() > (this.arena.bounds * 1.25) ** 2) { p.alive = false; continue; }

      // ---- planetary surface collision ----
      if (this.world.terrainHeight) {
        const gy = this.world.terrainHeight(p.pos.x, p.pos.z);
        if (p.pos.y <= gy + p.size) {
          p.pos.y = gy + p.size;
          this.impact(p, p.pos, this.tmpUp.set(0, 1, 0));
          p.alive = false;
          continue;
        }
      }
      // ---- world collision ----
      let hitWorld = false;
      const near = this.nearColliders(p.pos);
      for (let ni = 0; ni < near.length; ni++) {
        const c = this.world.colliders[near[ni]];
        const rr = c.radius + p.size;
        const dx = p.pos.x - c.pos.x, dy = p.pos.y - c.pos.y, dz = p.pos.z - c.pos.z;
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          this.impact(p, p.pos, new THREE.Vector3(dx / d, dy / d, dz / d));
          hitWorld = true;
          break;
        }
      }
      if (hitWorld) { p.alive = false; continue; }

      // ---- swept ship collision: fast bolts can never tunnel through a hull ----
      let hit: Ship | null = null;
      let hitT = 2;
      const stepLen = p.vel.length() * dt;
      for (const s of this.shipList) {
        if (!s.alive || s.team === p.team || s.id === p.owner) continue;
        const R = s.radius * (p.homing > 0 || p.splash ? 1.25 : 1.12) + p.size;
        const reach = R + stepLen + s.vel.length() * dt + 4;
        if (this.tmpA.copy(p.pos).sub(s.pos).lengthSq() > reach * reach * 4) continue;
        const t = sweptSphereHit(p.prevPos, p.pos, s.prevPos, s.pos, R, this.tmpLocal);
        if (t >= 0 && t < hitT) { hitT = t; hit = s; this.hitLocal.copy(this.tmpLocal); }
      }
      if (hit) {
        const nrm = this.tmpN.copy(this.hitLocal);
        if (nrm.lengthSq() < 1e-6) nrm.copy(p.dir).negate();
        nrm.normalize();
        // strike point on the actual armour (the hit sphere is deliberately generous)
        const at = new THREE.Vector3().copy(hit.pos).addScaledVector(nrm, hit.radius * 0.55);
        p.pos.copy(at);
        const shooter = this.ships.get(p.owner) ?? null;
        if (p.slow) hit.slowedUntil = this.time + (p.kind === "darkmatter" ? 2.5 : 4);
        this.damage(hit, p.dmg, shooter, p.kind, p, at, nrm);
        this.impact(p, at, nrm, hit.id);
        p.alive = false;
        continue;
      }

      // ---- interceptor darts swat incoming warheads ----
      if (p.kind === "intercept" || p.kind === "droneIntercept") {
        for (const o of this.projs) {
          if (!o.alive || o.team === p.team || WEAPONS[o.kind].kind !== "missile") continue;
          if (o.pos.distanceToSquared(p.pos) < (p.size * 3 + o.size + 3) ** 2) {
            this.fx.burst(o.pos, { count: 14, color: [0xffffff, o.color], speed: 45, size: o.size * 1.4, life: 0.32 });
            this.fx.flash(o.pos, 1.5, 12, 0.15, 0xffffff);
            o.alive = false; p.alive = false;
            break;
          }
        }
        if (!p.alive) continue;
      }

      // ---- draw ----
      if (p.pos.distanceToSquared(camP) < 4200 * 4200) {
        const vs = p.kind === "darkmatter" ? 1.55 : p.kind === "charged" ? 1.4 : p.kind === "torpedo" ? 1.7 : 1.0;
        this.fx.pushBullet(p, vs);
      }
    }
    // compact the list and let finished missile ribbons fade out
    let w = 0;
    for (let i = 0; i < this.projs.length; i++) {
      const p = this.projs[i];
      if (p.alive) this.projs[w++] = p;
      else if (p.trailId >= 0) { this.exhaust.releaseTrail(p.trailId); p.trailId = -1; }
    }
    this.projs.length = w;
  }

  /** Seeker guidance: turn-rate limited lead pursuit — missiles visibly arc and can be out-turned. */
  private guide(p: Proj, dt: number) {
    if (p.kind === "intercept" || p.kind === "droneIntercept") {
      let best: Proj | null = null; let bd = 900 * 900;
      for (const o of this.projs) {
        if (!o.alive || o.team === p.team || WEAPONS[o.kind].kind !== "missile") continue;
        const d2 = o.pos.distanceToSquared(p.pos);
        if (d2 < bd) { bd = d2; best = o; }
      }
      if (best) turnToward(p.dir, this.tmpW.copy(best.pos).sub(p.pos).normalize(), p.homing * dt);
      p.vel.copy(p.dir).multiplyScalar(Math.max(p.vel.length(), WEAPONS[p.kind].speed));
      return;
    }
    if (p.armT > 0) {
      p.armT -= dt;                                     // boost phase: fly straight off the rail
      if (p.armT <= 0) p.dir.copy(p.vel).normalize();
      return;
    }
    let target = p.targetId ? this.ships.get(p.targetId) ?? null : null;
    if (target && !target.alive) { target = null; p.targetId = null; }   // never chase the dead
    if (!target) {
      // fire-and-forget: re-acquire anything inside the seeker cone a few times a second
      p.seekT -= dt;
      if (p.seekT <= 0) {
        p.seekT = 0.2;
        let best: Ship | null = null; let bestDot = 0.82;
        for (const e of this.shipList) {
          if (!e.alive || e.team === p.team) continue;
          const to = this.tmpW.copy(e.pos).sub(p.pos);
          const d = to.length();
          if (d > 1300 || d < 1) continue;
          const dot = to.divideScalar(d).dot(p.dir);
          if (dot > bestDot) { bestDot = dot; best = e; }
        }
        if (best) { p.targetId = best.id; target = best; }
      }
    }
    let speed = p.vel.length();
    if (target) {
      const to = this.tmpW.copy(target.pos).sub(p.pos);
      const dist = to.length();
      const tgo = Math.min(1.6, dist / Math.max(220, speed));
      const aim = to.addScaledVector(target.vel, tgo * 0.85).normalize();   // lead pursuit
      if (p.dir.dot(aim) < -0.17) p.targetId = null;                        // slipped behind the seeker
      else turnToward(p.dir, aim, p.homing * dt);
    }
    speed = Math.min(p.maxSpeed, speed + p.accel * dt);
    p.vel.copy(p.dir).multiplyScalar(speed);
  }

  private impact(p: Proj, at: THREE.Vector3, normal: THREE.Vector3, directId?: string) {
    const w = WEAPONS[p.kind];
    const isMissile = w.kind === "missile";
    const heavy = !!p.splash || p.kind === "charged" || p.kind === "heavy";
    // layered strike flash: tight white core over a coloured bloom
    this.fx.flash(at, p.size * 0.9, p.size * (heavy ? 14 : 8), heavy ? 0.14 : 0.09, 0xffffff);
    this.fx.flash(at, p.size * 1.6, p.size * (heavy ? 26 : 15), heavy ? 0.3 : 0.18, p.color);
    this.fx.burst(at, {
      count: heavy ? 24 : 10, color: [0xffffff, p.color, 0xbfe9ff],
      speed: heavy ? 110 : 75, size: p.size * 1.3, life: 0.3, lifeVar: 0.7, dir: normal, cone: 1.25, drag: 3.2,
    });
    if (heavy) {
      if (isMissile) {
        // warhead detonation: fireball, debris chips and smoke
        this.fx.burst(at, { count: 34, color: [0xffffff, 0xfff0b0, 0xffb04a, p.color], speed: 70, size: 4.2, life: 0.55, drag: 2.6, grow: 1.8 });
        this.fx.burst(at, { count: 10, color: [0x55504a, 0x3a3a40], speed: 22, size: 6, life: 1.4, drag: 1.2, grow: 2.4, alpha: 0.4 });
        this.fx.spawnDebris(at, 5, 45, 0.45, 0);
      }
      const radius = p.splash || 12;
      this.fx.shockwave(at.clone(), 2, radius * 1.7, 0.45, p.color);
      this.fx.lightFlash(at, p.color, 380, radius * 7, 0.3);
      if (p.splash) {
        // splash damage — never double-dips the target that took the direct hit
        const shooter = this.ships.get(p.owner) ?? null;
        for (const s of this.shipList) {
          if (!s.alive || s.team === p.team || s.id === p.owner || s.id === directId) continue;
          const d = s.pos.distanceTo(at) - s.radius;
          if (d < p.splash) this.damage(s, p.dmg * 0.6 * (1 - clamp(d, 0, p.splash) / p.splash), shooter, p.kind);
        }
      }
      if (p.kind === "darkmatter") {
        // implosion: drag nearby enemies toward the singularity and scramble their engines
        for (const s of this.shipList) {
          if (!s.alive || s.team === p.team) continue;
          const to = this.tmpW.copy(at).sub(s.pos);
          const d = to.length();
          if (d < 150 && d > 1) {
            s.vel.addScaledVector(to.divideScalar(d), 95 * (1 - d / 150));
            s.slowedUntil = Math.max(s.slowedUntil, this.time + 1.5);
          }
        }
        this.fx.shockwave(at.clone(), 70, 2, 0.5, 0x6a3aff);
      }
    }
    const dist = this.camera.position.distanceTo(at);
    if (dist < 1600) audio.play(heavy ? "blast" : "impact", clamp(dist / 1600, 0, 1));
    if (heavy && dist < 280) this.addShake(0.3 * (1 - dist / 280));
  }

  /** Drones fight for their owner: kills and damage are credited to the pilot. */
  private creditFor(from: Ship): Ship {
    if (from.drone && from.ownerId) {
      const o = this.ships.get(from.ownerId);
      if (o) return o;
    }
    return from;
  }

  // ---------- damage ----------
  private damage(s: Ship, amount: number, from: Ship | null, kind: string, p?: Proj, at?: THREE.Vector3, normal?: THREE.Vector3) {
    if (!s.alive || amount <= 0) return;
    let dmg = amount;
    if (s.shieldBoost) dmg *= 0.45;
    let shieldTaken = 0;
    if (s.shield > 0) {
      const mul = p ? p.shieldMul : 1;
      const absorbed = Math.min(s.shield, dmg * mul);
      s.shield -= absorbed;
      shieldTaken = absorbed;
      dmg -= absorbed / Math.max(0.4, mul);
      if (kind === "curse") s.shield = Math.max(0, s.shield - 3);   // spectral plasma weakens shields
      if (s.shield <= 0.01 && s.shieldPrev !== 0) {
        s.shieldPrev = 0;
        this.fx.shockwave(s.pos.clone(), s.radius, s.radius * 4.5, 0.5, 0x9fe8ff);
        if (s.local || s.pos.distanceTo(this.camera.position) < 400) audio.play("shieldbreak", clamp(s.pos.distanceTo(this.camera.position) / 900, 0, 1));
      }
    } else s.shieldPrev = 1;
    const hullTaken = Math.max(0, dmg);
    if (hullTaken > 0) s.hp -= hullTaken;
    s.lastDamage = this.time;
    s.hitFlash = 1;

    // ---- visible feedback on the struck ship ----
    if (shieldTaken > 0.01) {
      s.shieldHit = 1;
      const dirW = at ? this.tmpW.copy(at).sub(s.pos) : from ? this.tmpW.copy(from.pos).sub(s.pos) : this.tmpW.set(0, 0, 1);
      s.shieldHitDir.copy(dirW).applyQuaternion(this.tmpQ.copy(s.quat).invert());
      if (s.shieldHitDir.lengthSq() < 1e-6) s.shieldHitDir.set(0, 0, 1);
      s.shieldHitDir.normalize();
    }
    if (hullTaken > 0) s.hullFlash = Math.min(1, s.hullFlash + 0.55 + hullTaken * 0.05);
    if (at) {
      const nrm = normal ?? this.tmpN2.copy(at).sub(s.pos).normalize();
      const onShield = shieldTaken > 0.01 && hullTaken <= 0;
      this.fx.hitSpark(at, nrm, onShield ? 0x7fe9ff : 0xffd08a, clamp(0.7 + amount / 8, 0.7, 2.2), onShield);
    }

    // ---- credit ----
    if (from) {
      const credit = this.creditFor(from);
      credit.dmg += amount;
      if (credit === from && at) from.hits++;
      s.recentHits.push({ id: credit.id, t: this.time, dmg: amount });
      if (credit.local) {
        this.hitMarker = 0.3;
        this.addDamageNumber(s, at ?? s.pos, amount, shieldTaken > hullTaken ? "shield" : "hull");
        audio.play(shieldTaken > hullTaken ? "hitShield" : "hit", 0);
      }
    }
    if (s.local) {
      this.addShake(clamp(0.14 + amount * 0.02, 0.14, 0.5) * (hullTaken > 0 ? 1 : 0.6));
      if (from) {
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.me.quat);
        const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.me.quat);
        const to = from.pos.clone().sub(s.pos).normalize();
        this.damageDirs.push({ a: Math.atan2(to.dot(right), to.dot(fwd)), t: 1.2 });
      }
      audio.play("impact", 0);
      if (s.hp / s.maxHp < 0.28) this.pushWarning("HULL CRITICAL");
    }
    if (s.hp <= 0) this.kill(s, from);
  }
  private hitMarker = 0;

  private addDamageNumber(target: Ship, at: THREE.Vector3, amount: number, kind: "hull" | "shield") {
    // rapid hits on the same target accumulate into one rising number
    const last = this.dmgNums.find((d) => d.targetId === target.id && d.age < 0.35 && d.kind !== "kill");
    if (last) {
      last.amount += amount;
      if (kind === "hull") last.kind = "hull";
      last.pos.copy(at);
      return;
    }
    this.dmgNums.push({ id: this.dmgNumId++, targetId: target.id, pos: at.clone(), amount, kind, age: 0 });
    if (this.dmgNums.length > 24) this.dmgNums.shift();
  }

  private kill(s: Ship, from: Ship | null) {
    if (!s.alive) return;
    s.alive = false;
    s.hp = 0;
    if (s.drone) s.droneState = "DESTROYED";
    s.deaths++;
    this.releaseShipTrails(s);
    const cls = SHIP_CLASSES[s.clsId as ShipClassId];
    const isCap = cls.category === "capital";
    const dist = this.camera.position.distanceTo(s.pos);
    if (isCap) {
      // capital death throes: the hull keeps drifting while secondary blasts rip through it
      s.dying = 2.4;
      s.dyingT = 0;
      this.fx.explode(s.pos.clone(), cls.scale * 0.9, 0xffb04a);
      audio.play("explosion", clamp(dist / 2200, 0, 1));
      if (dist < 900) this.addShake(0.5 * (1 - dist / 900));
    } else {
      this.destroyVisual(s, s.drone ? 0.8 : 1);
      if (dist < 650) this.addShake((s.drone ? 0.35 : 0.65) * (1 - dist / 650));
    }

    // ---- scoring ----
    const killer = from ? this.creditFor(from) : null;
    if (s.drone) {
      if (killer && killer !== s) { killer.score += 25; this.pushFeed(`${killer.name} shot down ${s.name}`, "info"); }
      else this.pushFeed(`${s.name} destroyed`, "info");
    } else if (killer && killer !== s) {
      killer.kills++;
      const gained = 100 + this.wave * 12 + (this.cfg.difficulty === "expert" ? 60 : this.cfg.difficulty === "hard" ? 35 : 0) + (isCap ? 400 : 0);
      killer.score += gained;
      this.score[killer.team] += 1;
      const via = from && from.drone ? `${killer.name}'s ${from.name}` : killer.name;
      this.pushFeed(`${via} ⟶ destroyed ${s.name}`, killer.local || killer.team === 0 ? "kill" : "warn");
      if (killer.local) {
        this.killMarker = 1;
        audio.play("kill", 0);
        this.dmgNums.push({ id: this.dmgNumId++, targetId: s.id + "_kill", pos: s.pos.clone(), amount: gained, kind: "kill", age: 0 });
      }
      const seen = new Set<string>();
      for (const h of s.recentHits) {
        if (h.id === killer.id || seen.has(h.id)) continue;
        seen.add(h.id);
        const a = this.ships.get(h.id);
        if (a && a.alive) { a.assists++; a.score += 35; }
      }
    } else {
      this.pushFeed(`${s.name} was destroyed`, "warn");
    }

    if (s === this.me) {
      this.pushFeed("YOUR SHIP WAS DESTROYED", "warn");
      if (this.cfg.mode === "practice" || this.cfg.mode === "free") {
        s.respawn = this.cfg.mode === "free" ? 2.6 : 3;
      }
    }
    if (this.cfg.net === "host") {
      this.link.send({ t: "fx", k: "boom", p: [s.pos.x, s.pos.y, s.pos.z], s: cls.scale * 1.5, c: s.vis.engineMats[0].color.getHex() });
    }
  }

  /** Final destruction: break the hull into its real pieces + a size-scaled blast. */
  private destroyVisual(s: Ship, power: number) {
    const cls = SHIP_CLASSES[s.clsId as ShipClassId];
    const isCap = cls.category === "capital";
    const color = s.vis.engineMats[0].color.getHex();
    s.obj.position.copy(s.pos);
    s.obj.quaternion.copy(s.quat);
    s.obj.visible = true;
    this.wrecks.shatter(s.vis, s.pos, s.vel, power, isCap ? 14 : s.drone ? 4 : 9);
    s.obj.visible = false;
    if (isCap) this.fx.explodeCapital(s.pos.clone(), cls.scale * 1.4, color);
    else this.fx.explode(s.pos.clone(), cls.scale * (s.drone ? 0.9 : 1.5), color);
    audio.play(isCap ? "explosionBig" : "explosion", clamp(this.camera.position.distanceTo(s.pos) / 2200, 0, 1));
  }

  /** Capital ships die in stages: secondary explosions, then the hull tears apart. */
  private updateDying(dt: number) {
    for (const s of this.shipList) {
      if (s.alive || s.dying <= 0) continue;
      s.dying -= dt;
      s.dyingT -= dt;
      s.pos.addScaledVector(s.vel, dt);
      s.vel.multiplyScalar(Math.exp(-0.4 * dt));
      s.quat.multiply(this.tmpQ.setFromAxisAngle(this.tmpAxis.set(0.3, 0.1, 1).normalize(), dt * 0.22));
      if (s.dyingT <= 0) {
        s.dyingT = 0.15 + Math.random() * 0.2;
        const cls = SHIP_CLASSES[s.clsId as ShipClassId];
        const off = this.tmpW.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).multiplyScalar(s.radius * 1.1);
        this.fx.explode(s.pos.clone().add(off), cls.scale * (0.45 + Math.random() * 0.35), 0xffb04a);
        const dist = this.camera.position.distanceTo(s.pos);
        audio.play("blast", clamp(dist / 2000, 0, 1));
        if (dist < 800) this.addShake(0.22 * (1 - dist / 800));
      }
      if (s.dying <= 0) {
        s.dying = 0;
        this.destroyVisual(s, 2.6);
        const dist = this.camera.position.distanceTo(s.pos);
        if (dist < 1100) this.addShake(0.9 * (1 - dist / 1100));
      }
    }
  }

  private releaseShipTrails(s: Ship) {
    if (!this.exhaust) return;
    for (const id of s.trails) this.exhaust.releaseTrail(id);
    s.trails.length = 0;
  }

  private respawnPlayer() {
    const s = this.me;
    s.alive = true;
    s.hp = s.maxHp;
    s.shield = s.maxShield;
    s.boost = s.boostMax;
    s.vel.set(0, 0, 0);
    s.pos.copy(this.spawnPos(0, 2));
    s.prevPos.copy(s.pos);
    s.hullFlash = 0; s.shieldHit = 0; s.recoil = 0; s.dying = 0;
    s.obj.visible = true;
    s.obj.position.copy(s.pos);
    this.faceCenter(s);
    this.fx.shockwave(s.pos.clone(), 2, 40, 0.5, 0x9fe8ff);
  }

  // ---------- AI ----------
  private updateAI(s: Ship, dt: number) {
    const ai = s.ai!;
    if (s.drone) { this.updateDroneAI(s, dt); return; }
    const cls = SHIP_CLASSES[s.clsId as keyof typeof SHIP_CLASSES];
    ai.think -= dt;
    ai.strafeT -= dt;
    ai.dodgeT -= dt;
    ai.dodgeCd -= dt;
    ai.boostT -= dt;
    ai.shieldT -= dt;

    if (ai.strafeT <= 0) { ai.strafeDir = Math.random() > 0.5 ? 1 : -1; ai.strafeT = 1.2 + Math.random() * 2.4; }

    // choose target
    if (!ai.target || !ai.target.alive || ai.think <= 0) {
      const enemies = this.shipList.filter((o) => o.alive && o.team !== s.team);
      if (enemies.length) {
        // pilots prefer real ships; drones only draw fire when they are much closer
        enemies.sort((a, b) => a.pos.distanceToSquared(s.pos) * (a.drone ? (a.droneType === "stealth" ? 7 : 3) : 1) - b.pos.distanceToSquared(s.pos) * (b.drone ? (b.droneType === "stealth" ? 7 : 3) : 1));
        const focus = this.cfg.difficulty === "expert" ? 0 : Math.random() < 0.6 ? 0 : (Math.random() * Math.min(3, enemies.length)) | 0;
        ai.target = enemies[clamp(focus, 0, enemies.length - 1)];
      } else ai.target = null;
    }

    const d = DIFFICULTIES[this.cfg.difficulty];
    let desired = new THREE.Vector3();
    let wantThrottle = 0.6;
    let wantBoost = false;
    let aiLead: THREE.Vector3 | null = null;

    // dodge incoming projectiles
    let threat: Proj | null = null;
    let threatDot = 0;
    for (const p of this.projs) {
      if (p.team === s.team) continue;
      const to = s.pos.clone().sub(p.pos);
      const dist = to.length();
      if (dist > 620) continue;
      to.normalize();
      const dot = to.dot(p.vel.clone().normalize());
      if (dot > 0.86 && (threat === null || dot > threatDot)) { threat = p; threatDot = dot; }
    }
    if (threat && ai.dodgeCd <= 0 && Math.random() < d.dodge * dt * 9) {
      ai.dodgeT = 0.45;
      ai.dodgeCd = 1.4 + (1 - d.dodge) * 2.6;   // can't jink away from every single bolt
      const side = new THREE.Vector3().crossVectors(threat.vel, new THREE.Vector3(0, 1, 0)).normalize();
      if (Math.random() > 0.5) side.negate();
      ai.wander.copy(s.pos).addScaledVector(side, 220);
      wantBoost = true;
      if (s.shield > 0 && ai.shieldT <= 0 && Math.random() < d.dodge * 0.5) { this.activateShield(s); ai.shieldT = 6; }
    }

    const hpFrac = s.hp / s.maxHp;
    // break off briefly to let shields recharge, then re-engage (hull never regenerates,
    // so an open-ended retreat would turn every damaged pilot into a permanent runner)
    ai.retreatCd -= dt;
    if (hpFrac < 0.3 && ai.state !== "retreat" && ai.retreatCd <= 0 && Math.random() < d.aggro * dt * 1.2) {
      ai.state = "retreat";
      ai.wanderT = 3 + Math.random() * 3;
    }
    if (ai.state === "retreat") {
      ai.wanderT -= dt;
      if (ai.wanderT <= 0 || hpFrac > 0.55) { ai.state = "hunt"; ai.retreatCd = 14; }
    }

    if (this.cfg.mode === "free") {
      ai.state = "roam";
    }

    if (ai.state === "roam") {
      ai.wanderT -= dt;
      if (ai.wanderT <= 0) {
        ai.wanderT = 5 + Math.random() * 6;
        const r = this.arena.bounds * 0.6;
        ai.wander.set((Math.random() - 0.5) * r, (Math.random() - 0.5) * r * 0.5, (Math.random() - 0.5) * r);
      }
      desired.copy(ai.wander).sub(s.pos);
      wantThrottle = 0.7;
    } else if (ai.state === "retreat") {
      const away = ai.target ? s.pos.clone().sub(ai.target.pos).normalize() : s.pos.clone().normalize();
      desired.copy(s.pos).addScaledVector(away, 500).add(new THREE.Vector3(ai.strafeDir * 160, 60, 0));
      wantThrottle = 1;
      wantBoost = s.boost > 30;
    } else if (ai.target) {
      const t = ai.target;
      const toT = t.pos.clone().sub(s.pos);
      const dist = toT.length();
      const w = WEAPONS[s.cfg.loadout.primary];
      // lead the target
      const relVel = t.vel.clone().addScaledVector(s.vel, -0.75);
      const ti = interceptTime(toT, relVel, w.speed);
      const tt = ti > 0 ? Math.min(ti, 2.5) : clamp(dist / w.speed, 0, 2.5);
      const aim = t.pos.clone().addScaledVector(relVel, tt * (0.7 + d.aggro * 0.3));
      aiLead = aim.clone().sub(s.pos).normalize();
      desired.copy(aim).sub(s.pos);
      // orbit / range keeping
      const idealMin = s.cfg.loadout.secondary === "missile" ? 260 : 150;
      const idealMax = 520;
      if (dist < idealMin) { wantThrottle = -0.5; }
      else if (dist > idealMax) { wantThrottle = 1; wantBoost = dist > idealMax * 2 && s.boost > 40; }
      else {
        wantThrottle = 0.55;
        const side = new THREE.Vector3().crossVectors(toT.clone().normalize(), new THREE.Vector3(0, 1, 0)).normalize();
        desired.addScaledVector(side, ai.strafeDir * dist * 0.22);
        desired.y += ai.strafeDir * 40;
      }
      if (ai.dodgeT > 0) { wantThrottle = 1; desired.copy(ai.wander).sub(s.pos); }
    } else {
      ai.state = "roam";
      desired.set(0, 0, 0).sub(s.pos);
      wantThrottle = 0.5;
    }

    // obstacle avoidance
    this.avoidObstacles(s, desired);

    // rotate toward desired
    if (desired.lengthSq() > 0.01) {
      const m = new THREE.Matrix4().lookAt(s.pos, s.pos.clone().add(desired), new THREE.Vector3(0, 1, 0));
      const target = new THREE.Quaternion().setFromRotationMatrix(m);
      // model forward is +Z, lookAt gives -Z forward → flip
      target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      const rate = clamp(TURN_RATE * cls.agility * (0.6 + d.aggro * 0.5) * dt, 0, 1);
      s.quat.slerp(target, rate);
    }

    s.throttle = lerp(s.throttle, wantThrottle, clamp(dt * 3.2, 0, 1));
    s.boosting = wantBoost && ai.boostT <= 0;
    if (s.boosting) ai.boostT = 0.6;
    s.strafe = ai.dodgeT > 0 ? ai.strafeDir * 0.8 : lerp(s.strafe, ai.strafeDir * 0.25, dt);
    s.lift = ai.dodgeT > 0 ? (Math.random() - 0.5) * 0.6 : 0;
    s.rollIn = 0;

    // firing
    if (ai.target && ai.state !== "retreat" && this.phase === "live") {
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
      const to = ai.target.pos.clone().sub(s.pos);
      const dist = to.length();
      const ang = to.normalize().dot(fwd);
      const w = WEAPONS[s.cfg.loadout.primary];
      const range = w.speed * w.life * 0.7;
      ai.fireT -= dt;
      const scId = s.clsId as ShipClassId;
      const isCap = SHIP_CLASSES[scId].category === "capital";
      const tolerance = isCap ? 0.93 - d.aim * 0.4 : AI_FIRE_CONE[this.cfg.difficulty];
      const aimDot = !isCap && aiLead ? aiLead.dot(fwd) : ang;
      const fireRange = isCap ? range * 2.4 : range;
      if (aimDot > tolerance && dist < fireRange && ai.fireT <= 0) {
        ai.fireT = isCap ? 0.6 : 0.12 / d.aggro;
        const saved = s.quat.clone();
        if (!isCap) {
          const jitter = d.aim * (0.5 + Math.random());
          const errQ = new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, 0));
          s.quat.multiply(errQ);
        }
        this.fireWeapon(s, 0);
        s.quat.copy(saved);
        if (!isCap && dist < 900 && ang > 0.9 && s.cd.s <= 0 && Math.random() < 0.5 * d.aggro) {
          s.targetId = ai.target.id;
          s.lock = 1;
          this.fireWeapon(s, 1);
        }
      }
      if (this.cfg.difficulty === "expert" && dist < 300 && s.cd.ult <= 0 && Math.random() < d.aggro * dt * 1.5) this.fireNova(s);
    }
    s.cd.ult = Math.max(0, s.cd.ult - dt);
    if (ai.think <= 0) ai.think = d.react * (0.6 + Math.random() * 0.8);
  }

  private applyNetInput(s: Ship) {
    const i = s.netInput;
    s.throttle = i.th ?? 0;
    s.strafe = i.st ?? 0;
    s.lift = i.li ?? 0;
    s.rollIn = i.ro ?? 0;
    s.boosting = (i.bo ?? 0) > 0.5;
    s.yawDelta = i.ax ?? 0;
    s.pitchDelta = i.ay ?? 0;
    // Client transmits its X-slot selection; host remains authoritative for the fire event.
    if (i.sp !== undefined) {
      const selected = SPECIAL_WEAPONS[clamp(Math.round(i.sp), 0, SPECIAL_WEAPONS.length - 1)];
      s.cfg.loadout.special = selected;
    }
    if ((i.f1 ?? 0) > 0.5) this.fireWeapon(s, 0);
    if ((i.f2 ?? 0) > 0.5) this.fireWeapon(s, 1);
    if ((i.sh ?? 0) > 0.5) this.activateShield(s);
    if ((i.ul ?? 0) > 0.5) this.fireSpecial(s);
  }

  private sendInput() {
    const s = this.me;
    this.readPlayerInput(1 / 60);
    this.link.send({
      t: "input", id: s.id, seq: (this.netSeq = (this.netSeq + 1) % 100000),
      i: {
        th: s.throttle, st: s.strafe, li: s.lift, ro: s.rollIn, bo: s.boosting ? 1 : 0,
        ax: s.yawDelta ?? 0, ay: s.pitchDelta ?? 0,
        f1: this.mouseDown[0] || this.touch.fire ? 1 : 0,
        f2: this.mouseDown[2] || this.touch.alt ? 1 : 0,
        sh: this.keys.has("KeyF") || this.touch.shield ? 1 : 0,
        ul: this.keys.has("KeyX") || this.touch.nova ? 1 : 0,
        sp: Math.max(0, SPECIAL_WEAPONS.indexOf(s.cfg.loadout.special)),
      },
    });
    s.yawDelta = 0; s.pitchDelta = 0;
  }
  private netSeq = 0;
  private helloTimers: number[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpExhaust = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpW = new THREE.Vector3();
  private tmpN = new THREE.Vector3();
  private tmpN2 = new THREE.Vector3();
  private tmpLocal = new THREE.Vector3();
  private hitLocal = new THREE.Vector3();
  private tmpZero = new THREE.Vector3();
  private tmpAxis = new THREE.Vector3();
  private tmpUp = new THREE.Vector3();
  private tmpD1 = new THREE.Vector3();
  private tmpD2 = new THREE.Vector3();
  private tmpD3 = new THREE.Vector3();
  private tmpD4 = new THREE.Vector3();
  private tmpVF = new THREE.Vector3();
  private tmpVB = new THREE.Vector3();
  private tmpVN = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpM4 = new THREE.Matrix4();
  private tmpV2 = new THREE.Vector2();
  private tmpCol = new THREE.Color();

  // ================= combat drones =================
  private droneRedeployTime() { return this.cfg.mode === "practice" || this.cfg.mode === "free" ? 20 : -1; }

  /**
   * Mandatory rule: A player must own/unlock and explicitly equip a drone before
   * it appears in combat. If no drone is equipped, returns null and NO drone may spawn.
   */
  private getValidEquippedDrone(ship: Ship | null | undefined): DroneTypeId | null {
    if (!ship) return null;
    const eq = ship.cfg?.equippedDrone ?? null;
    if (!eq || !DRONE_TYPES[eq]) return null;
    if (ship.local && this.cfg.ownedDrones && !this.cfg.ownedDrones.includes(eq)) {
      return null;
    }
    return eq;
  }

  /** Spawns a drone ONLY if the ship has an owned & explicitly equipped drone. */
  private deployDrones() {
    // Clean up any existing drones first to prevent duplicate spawns across restarts/transitions
    for (const old of [...this.shipList]) {
      if (old.drone) this.removeShip(old);
    }
    this.droneTotal = 0;
    this.droneRespawn = [];
    if (this.cfg.net === "client" || !this.me) return;

    const myDrone = this.getValidEquippedDrone(this.me);
    if (!myDrone) {
      // Mandatory rule: no drone equipped -> zero drones spawn
      return;
    }

    this.droneTotal = 1;
    this.droneRespawn = [0];
    this.spawnDrone(this.me, 0, myDrone);

    if (this.cfg.net === "off" && this.cfg.mode === "duel") {
      const ace = this.shipList.find((x) => x.team === 1 && !x.drone);
      if (ace) {
        ace.cfg.equippedDrone = myDrone;
        this.spawnDrone(ace, 0, myDrone);
      }
    }
    const spec = DRONE_TYPES[myDrone];
    this.pushFeed(`${spec.name} EQUIPPED & DEPLOYED · G = ESCORT / ATTACK`, "info");
  }

  private droneSlotOffset(slot: number, scale: number) {
    const slots: [number, number, number][] = [[20, 3.5, 5], [-20, 3.5, 5], [0, -10, 4]];
    const o = slots[slot % slots.length];
    return new THREE.Vector3(o[0] * scale, o[1] * scale, o[2] * scale);
  }

  private spawnDrone(owner: Ship, slot: number, droneType?: DroneTypeId): Ship | null {
    const dtId = droneType ?? this.getValidEquippedDrone(owner);
    if (!dtId || !DRONE_TYPES[dtId]) return null;

    // Prevent duplicate drone for the same owner & slot
    for (const existing of [...this.shipList]) {
      if (existing.drone && existing.ownerId === owner.id && existing.droneSlot === slot) {
        this.removeShip(existing);
      }
    }

    const spec = DRONE_TYPES[dtId];
    const cfg: ShipConfig = {
      classId: "drone",
      paintIndex: owner.cfg.paintIndex,
      engineColorIndex: owner.cfg.engineColorIndex ?? 0,
      equippedDrone: null,
      loadout: { primary: spec.weapon, secondary: spec.weapon, special: spec.weapon, shieldMod: 1, engineMod: 1, armorMod: 1 },
    };
    const oScale = SHIP_CLASSES[owner.clsId as ShipClassId]?.scale ?? 1;
    const pos = this.droneSlotOffset(slot, oScale).applyQuaternion(owner.quat).add(owner.pos);
    if (this.world?.terrainHeight) {
      pos.y = Math.max(pos.y, this.world.terrainHeight(pos.x, pos.z) + 18);
    }
    const name = owner.local ? spec.name : `${owner.name} · ${spec.name}`;
    const d = this.makeShip("D_" + Math.random().toString(36).slice(2, 8), name, owner.team, cfg, false, pos, dtId);
    d.hp = d.maxHp = spec.hull;
    d.shield = d.maxShield = spec.shield;
    d.radius = spec.radius;
    d.quat.copy(owner.quat);
    d.obj.quaternion.copy(d.quat);
    d.vel.copy(owner.vel);
    d.drone = true;
    d.droneType = dtId;
    d.droneState = "FOLLOW";
    d.ownerId = owner.id;
    d.droneSlot = slot;
    d.ai = {
      target: null, think: 0, aimErr: 0.015, strafeDir: slot % 2 ? 1 : -1, strafeT: 1, dodgeT: 0, dodgeCd: 0,
      state: "hunt", wander: new THREE.Vector3(), wanderT: 0, fireT: 0.25, skill: 1, boostT: 0, shieldT: 0, react: 0.25, retreatCd: 0,
    };
    this.addShip(d);
    this.fx.flash(pos.clone(), 1.5, 14, 0.3, spec.color);
    return d;
  }

  toggleDroneStance() {
    if (this.droneTotal <= 0 || !this.getValidEquippedDrone(this.me)) return;
    this.droneStance = this.droneStance === "escort" ? "attack" : "escort";
    this.pushFeed(this.droneStance === "attack" ? "DRONE: ATTACK MY TARGET" : "DRONE: ESCORT & DEFEND", "info");
    audio.play("ui");
  }

  private updateDroneAI(s: Ship, dt: number) {
    const ai = s.ai!;
    const dtId = s.droneType ?? "hunter";
    const spec = DRONE_TYPES[dtId] ?? DRONE_TYPES.hunter;
    const owner = s.ownerId ? this.ships.get(s.ownerId) ?? null : null;
    const anchor = owner && owner.alive ? owner : null;
    const attack = owner?.local ? this.droneStance === "attack" : true;
    ai.think -= dt; ai.fireT -= dt; ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafeDir = -ai.strafeDir; ai.strafeT = 1.2 + Math.random() * 1.6; }

    // Guardian Drone perk: trickles shield energy to its owner while close & alive
    if (dtId === "guardian" && anchor && anchor.shield < anchor.maxShield && s.pos.distanceTo(anchor.pos) < 240) {
      anchor.shield = Math.min(anchor.maxShield, anchor.shield + 1.2 * dt);
    }

    const fwd = this.tmpD2.set(0, 0, 1).applyQuaternion(s.quat);

    // Interceptor Drone specialty: shoot down incoming enemy missiles first!
    if (dtId === "interceptor" && this.phase === "live") {
      const refPos = anchor ? anchor.pos : s.pos;
      let incomingMissile: Proj | null = null;
      let bestMD = 780;
      for (const p of this.projs) {
        if (!p.alive || p.team === s.team || WEAPONS[p.kind].kind !== "missile") continue;
        const d = p.pos.distanceTo(refPos);
        if (d < bestMD) { bestMD = d; incomingMissile = p; }
      }
      if (incomingMissile) {
        s.droneState = "DEFEND";
        const toM = this.tmpD3.copy(incomingMissile.pos).sub(s.pos);
        const m = this.tmpM4.lookAt(s.pos, incomingMissile.pos, this.tmpUp.set(0, 1, 0));
        const targetQ = this.tmpQ2.setFromRotationMatrix(m).multiply(FLIP);
        s.quat.slerp(targetQ, clamp(TURN_RATE * spec.agility * 1.8 * dt, 0, 1));
        s.throttle = 0.85;
        if (toM.normalize().dot(fwd) > 0.88 && ai.fireT <= 0) {
          ai.fireT = spec.fireInterval;
          this.fireWeapon(s, 0);
        }
        return;
      }
    }

    const leash = dtId === "guardian" ? (attack ? 900 : 560) : dtId === "scout" ? 1850 : (attack ? 1600 : 1000);
    const distToOwner = anchor ? s.pos.distanceTo(anchor.pos) : 0;

    // Recover state when drone hull is low and shield is depleted
    const recovering = s.hp / s.maxHp < 0.28 && s.shield < s.maxShield * 0.45 && !!anchor;

    // Return state if beyond leash
    if (anchor && distToOwner > leash * 1.15) {
      ai.target = null;
      s.droneState = "RETURN";
    } else if (recovering) {
      ai.target = null;
      s.droneState = "RECOVER";
    } else if (ai.think <= 0 || (ai.target && !ai.target.alive)) {
      ai.think = 0.3;
      ai.target = null;
      const center = anchor ? anchor.pos : s.pos;
      const ownerTarget = owner ? (owner.ai ? owner.ai.target : owner.targetId ? this.ships.get(owner.targetId) ?? null : null) : null;
      if (ownerTarget && ownerTarget.alive && ownerTarget.team !== s.team && ownerTarget.pos.distanceTo(center) < leash) {
        ai.target = ownerTarget;
      }
      if (!ai.target) {
        let best: Ship | null = null;
        let bd = attack ? leash : Math.min(leash, 760);
        for (const o of this.shipList) {
          if (!o.alive || o.team === s.team) continue;
          let dd = o.pos.distanceTo(center);
          // Interceptor drones prioritize enemy drones
          if (dtId === "interceptor" && o.drone) dd *= 0.45;
          if (dd < bd) { bd = dd; best = o; }
        }
        ai.target = best;
      }
    }

    const desired = this.tmpD1.set(0, 0, 0);
    let wantThrottle = 0.8;
    let wantBoost = false;
    const t = ai.target;
    const wpn = WEAPONS[spec.weapon] ?? WEAPONS.droneLaser;

    if (t && t.alive && !recovering && this.phase !== "countdown") {
      const to = this.tmpD3.copy(t.pos).sub(s.pos);
      const dist = to.length();
      const tt = interceptTime(to, this.tmpD4.copy(t.vel).addScaledVector(s.vel, -0.75), wpn.speed);
      desired.copy(to).addScaledVector(t.vel, tt > 0 ? Math.min(tt, 1.5) : 0);
      const side = this.tmpD4.crossVectors(to, this.tmpUp.set(0, 1, 0)).normalize();
      if (dist < 85) { wantThrottle = 0.15; desired.addScaledVector(side, ai.strafeDir * 120); }
      else if (dist > 450) { wantThrottle = 1; wantBoost = dist > 850 && s.boost > 30; }
      else { wantThrottle = 0.68; desired.addScaledVector(side, ai.strafeDir * dist * 0.35); }
      const dirN = this.tmpD4.copy(desired).normalize();
      const aimDot = fwd.dot(dirN);
      if (dist < spec.range && aimDot > 0.965 && this.phase === "live") {
        s.droneState = dtId === "guardian" ? "DEFEND" : "ATTACK";
        if (ai.fireT <= 0) {
          ai.fireT = spec.fireInterval;
          this.fireWeapon(s, 0);
        }
      } else {
        s.droneState = dtId === "scout" ? "TARGET" : "LOCK";
      }
    } else if (anchor) {
      if (s.droneState !== "RETURN" && s.droneState !== "RECOVER") {
        s.droneState = dtId === "scout" ? "SEARCH" : dtId === "guardian" ? "DEFEND" : "FOLLOW";
      }
      const oScale = SHIP_CLASSES[anchor.clsId as ShipClassId]?.scale ?? 1;
      const slotOff = this.droneSlotOffset(s.droneSlot, oScale);
      if (dtId === "scout") {
        // Scout sweeps a wide figure-eight ahead of the owner
        slotOff.z += 28 + Math.sin(this.time * 1.4) * 14;
        slotOff.x += Math.cos(this.time * 1.4) * 18;
      } else if (dtId === "guardian") {
        // Guardian orbits the owner closely
        slotOff.set(Math.cos(this.time * 1.8) * 16 * oScale, 3.5 * oScale, Math.sin(this.time * 1.8) * 16 * oScale);
      }
      const to = slotOff.applyQuaternion(anchor.quat).add(anchor.pos).sub(s.pos);
      const wantVel = this.tmpD3.copy(anchor.vel).addScaledVector(to, 1.6);
      const want = wantVel.length();
      if (want > 6) desired.copy(wantVel);
      else desired.set(0, 0, 1).applyQuaternion(anchor.quat);
      const cruise = BASE_ACCEL * spec.speed / DRAG;
      const cur = s.vel.dot(fwd);
      wantThrottle = clamp(want / cruise + (want - cur) / 40, -0.6, 1);
      wantBoost = want > BASE_SPEED * spec.speed * 0.95 && s.boost > 20;
    } else {
      s.droneState = "SEARCH";
      desired.copy(s.pos).multiplyScalar(-1);
      wantThrottle = 0.4;
    }

    this.avoidObstacles(s, desired);
    if (desired.lengthSq() > 0.01) {
      const m = this.tmpM4.lookAt(s.pos, this.tmpD3.copy(s.pos).add(desired), this.tmpUp.set(0, 1, 0));
      const target = this.tmpQ2.setFromRotationMatrix(m).multiply(FLIP);
      s.quat.slerp(target, clamp(TURN_RATE * spec.agility * 1.25 * dt, 0, 1));
    }
    s.throttle = lerp(s.throttle, wantThrottle, clamp(dt * 4, 0, 1));
    s.boosting = wantBoost;
    s.strafe = 0; s.lift = 0; s.rollIn = 0;
  }

  /** Speed-aware obstacle & planetary terrain avoidance. */
  private avoidObstacles(s: Ship, desired: THREE.Vector3) {
    if (desired.lengthSq() < 1e-6) return;
    const speed = s.vel.length();
    const look = clamp(speed * 0.9, 130, 420);
    const mag = desired.length();
    const dirN = this.tmpB.copy(desired).divideScalar(mag);
    const gain = 2.4 * Math.max(1, mag / 300);
    for (const k of [0.45, 1]) {
      const probe = this.tmpA.copy(s.pos).addScaledVector(dirN, look * k);
      const near = this.nearColliders(probe).slice();
      for (const ci of near) {
        const c = this.world.colliders[ci];
        const margin = c.radius + 60 + speed * 0.25;
        const to = this.tmpC.copy(probe).sub(c.pos);
        const dist = to.length();
        if (dist < margin && dist > 0.001) desired.addScaledVector(to.divideScalar(dist), (margin - dist) * gain);
      }
      if (this.world.terrainHeight) {
        const gy = this.world.terrainHeight(probe.x, probe.z);
        const floor = gy + s.radius + 58;
        if (probe.y < floor) {
          desired.y += (floor - probe.y) * 2.8;
        }
      }
    }
    if (this.world.terrainHeight) {
      const gyNow = this.world.terrainHeight(s.pos.x, s.pos.z) + s.radius + 48;
      if (s.pos.y < gyNow) desired.y += (gyNow - s.pos.y) * 4.2;
    }
    if (s.pos.length() > this.arena.bounds * 0.9) desired.addScaledVector(this.tmpC.copy(s.pos).normalize(), -400);
  }

  /** Practice / free roam: destroyed drones are rebuilt ONLY if the player has an owned & equipped drone. */
  private updateDroneRespawn(dt: number) {
    const eq = this.getValidEquippedDrone(this.me);
    if (!eq) {
      this.droneTotal = 0;
      return;
    }
    const delay = this.droneRedeployTime();
    if (this.droneTotal <= 0 || delay < 0 || !this.me.alive) return;
    for (let slot = 0; slot < this.droneTotal; slot++) {
      const alive = this.shipList.some((x) => x.drone && x.ownerId === this.me.id && x.droneSlot === slot && x.alive);
      if (alive) { this.droneRespawn[slot] = 0; continue; }
      if (this.droneRespawn[slot] <= 0) this.droneRespawn[slot] = delay;
      this.droneRespawn[slot] -= dt;
      if (this.droneRespawn[slot] <= 0) {
        for (const old of this.shipList.filter((x) => x.drone && x.ownerId === this.me.id && x.droneSlot === slot && !x.alive)) this.removeShip(old);
        this.spawnDrone(this.me, slot, eq);
        this.droneRespawn[slot] = 0;
        this.pushFeed(`${DRONE_TYPES[eq].name} REDEPLOYED`, "info");
      }
    }
  }

  // ---------- match rules ----------
  private updateMatch(dt: number) {
    const aliveNow: [number, number] = [0, 0];
    for (const s of this.shipList) if (s.alive && !s.drone) aliveNow[s.team]++;
    this.aliveCount = aliveNow;
    if (this.phase !== "live") {
      if (this.me && !this.me.alive && this.me.respawn > 0 && this.cfg.mode === "free") {
        this.me.respawn -= dt;
        if (this.me.respawn <= 0) this.respawnPlayer();
      }
      return;
    }
    const mode = this.cfg.mode;

    if (mode === "practice") {
      if (!this.me.alive) {
        if (this.me.respawn <= 0) { this.finish(false, "Your fighter was destroyed"); return; }
      }
      const enemies = this.shipList.filter((s) => s.team === 1 && s.alive);
      if (enemies.length === 0) {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) { this.spawnWave(); this.waveTimer = 3.4; }
      } else this.waveTimer = 3.4;
      // clean up dead AI
      if (this.shipList.length > 34) this.shipList.filter((s) => !s.alive && s.dying <= 0 && s.ai && !s.drone).forEach((s) => this.removeShip(s));
      this.updateDroneRespawn(dt);
      return;
    }

    if (mode === "free") {
      if (!this.me.alive && this.me.respawn <= 0) this.respawnPlayer();
      this.updateDroneRespawn(dt);
      return;
    }

    if (mode === "duel") {
      if (!this.me.alive) { this.finish(false, "Your ship was destroyed"); return; }
      const enemy = this.shipList.find((s) => s.team === 1 && !s.drone);
      if (enemy && !enemy.alive) { this.finish(true, "Enemy ace destroyed"); return; }
      return;
    }

    if (mode === "team" || mode === "wing") {
      const aliveT = [0, 0] as [number, number];
      for (const s of this.shipList) if (s.alive && !s.drone) aliveT[s.team]++;
      this.aliveCount = aliveT;
      const label = mode === "wing" ? "wing" : "squadron";
      if (aliveT[1] === 0) { this.finish(true, `Red ${label} eliminated`); return; }
      if (aliveT[0] === 0) { this.finish(false, `Blue ${label} eliminated`); return; }
      if (!this.me.alive) this.spectate(dt);
      return;
    }
  }
  private aliveCount: [number, number] = [1, 1];
  private spectateTarget: Ship | null = null;
  private spectate(dt: number) {
    if (!this.spectateTarget || !this.spectateTarget.alive || this.spectateTarget.team !== 0) {
      this.spectateTarget = this.shipList.find((s) => s.team === 0 && s.alive && !s.drone) ?? null;
    }
    void dt;
  }

  private timeUp() {
    let aliveT: [number, number] = [0, 0];
    for (const s of this.shipList) if (s.alive && !s.drone) aliveT[s.team]++;
    if (aliveT[0] !== aliveT[1]) { this.finish(aliveT[0] > aliveT[1], "Time expired — survivors"); return; }
    const hpT: [number, number] = [0, 0];
    const scT: [number, number] = [0, 0];
    for (const s of this.shipList) { if (s.drone) continue; if (s.alive) hpT[s.team] += s.hp + s.shield; scT[s.team] += s.score; }
    if (hpT[0] !== hpT[1]) { this.finish(hpT[0] > hpT[1], "Time expired — remaining hull"); return; }
    this.finish(scT[0] >= scT[1], "Time expired — score");
  }

  private finish(won: boolean, reason: string) {
    if (this.phase === "over" || this.endSent) return;
    this.phase = "over";
    this.endSent = true;
    audio.play(won ? "victory" : "defeat");
    audio.startMusic("none");
    const acc = this.me.shots ? this.me.hits / this.me.shots : 0;
    const score = Math.round(this.me.score + this.me.kills * 100 + this.me.assists * 35 + (won ? 500 : 0) + acc * 400);
    const roster = this.shipList.filter((s) => !s.drone);
    const perfRows: PerfRow[] = roster.map((s) => ({
      name: s.name, team: s.team, me: s === this.me,
      kills: s.kills, assists: s.assists, damage: Math.max(0, Math.round(s.dmg)),
      deaths: s.deaths, score: Math.max(0, Math.round(s.score)),
      won: won,
    }));
    const outcome = computeReward(perfRows, won);
    const players = roster.map((s) => ({ name: s.name, team: s.team, kills: s.kills, deaths: s.deaths, score: Math.round(s.score), me: s === this.me, bot: !!s.ai }));
    players.sort((a, b) => b.kills - a.kills || b.score - a.score);
    const matchId = `M_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const res: EndResult = {
      won, reason, kills: this.me.kills, deaths: this.me.deaths, assists: this.me.assists,
      damage: Math.round(this.me.dmg), shots: this.me.shots, hits: this.me.hits, score,
      time: Math.round(this.matchTime), wave: this.wave, mode: this.cfg.mode, players,
      matchId, reward: outcome.reward, isMvp: outcome.isMvp, mvpName: outcome.mvpName, mvpTeam: outcome.mvpTeam,
    };
    if (this.cfg.net === "host") {
      this.link.send({
        t: "end", winner: won ? 0 : 1, reason,
        reward: outcome.reward, isMvp: outcome.isMvp, mvpName: outcome.mvpName, mvpTeam: outcome.mvpTeam, matchId,
        stats: { kills: res.kills, damage: res.damage },
      });
    }
    this.releaseLock();
    audio.engineOff();
    setTimeout(() => this.onEnd(res), 1500);
  }

  // ---------- networking ----------
  private onNetMessage(m: NetMsg) {
    if (this.cfg.net === "host") {
      if (m.t === "hello") {
        const existing = this.shipList.find((s) => s.id === m.id);
        const size = this.cfg.mode === "team" ? 5 : this.cfg.mode === "wing" ? 2 : 1;
        const humans = this.shipList.filter((s) => (s.local || s.remote) && !s.drone);
        let team: 0 | 1 = 0;
        if (this.cfg.mode === "duel") team = humans.length % 2 === 0 ? 0 : 1;
        else {
          const t0 = humans.filter((s) => s.team === 0).length;
          const t1 = humans.filter((s) => s.team === 1).length;
          team = t0 <= t1 ? 0 : 1;
        }
        if (!existing) {
          if (this.shipList.filter((s) => s.team === team && (s.local || s.remote) && !s.drone).length >= size) {
            this.link.send({ t: "welcome", id: m.id, slot: -1, team });
            this.onNetStatus(`${m.name} could not join — ${team === 0 ? "BLUE" : "RED"} squad is full.`);
            return;
          }
          const idx = this.shipList.filter((s) => s.team === team && !s.drone).length;
          const clientCfg = m.ship && SHIP_CLASSES[m.ship.classId] ? m.ship : this.cfg.ship;
          const s = this.makeShip(m.id, m.name, team, clientCfg, false, this.spawnPos(team, idx));
          s.remote = true;
          const bot = this.shipList.find((b) => b.team === team && b.ai && !b.drone && b !== s);
          if (bot) { this.pushFeed(`${bot.name} withdrawn — ${m.name} takes the slot`, "info"); this.removeShip(bot); }
          this.addShip(s);
          if (clientCfg.equippedDrone && DRONE_TYPES[clientCfg.equippedDrone]) {
            this.spawnDrone(s, 0, clientCfg.equippedDrone);
          }
          this.pushFeed(`${m.name} linked in (${team === 0 ? "BLUE" : "RED"})`, "info");
          this.link.send({ t: "welcome", id: m.id, slot: idx, team });
        }
        this.sendRoster();
      } else if (m.t === "input") {
        const s = this.ships.get(m.id);
        if (s) { s.netInput = m.i; s.remote = true; }
      } else if (m.t === "leave") {
        const s = this.ships.get(m.id);
        if (s) {
          for (const dr of this.shipList.filter((x) => x.drone && x.ownerId === s.id)) this.removeShip(dr);
          this.pushFeed(`${s.name} disconnected`, "warn");
          this.removeShip(s);
          this.sendRoster();
        }
      } else if (m.t === "ping") {
        this.link.send({ t: "pong", id: this.me.id, to: m.id });
      }
    } else if (this.cfg.net === "client") {
      if (m.t === "welcome" && m.id === this.me.id) {
        this.onNetStatus("Connected to host. Waiting for launch…");
        this.link.send({ t: "ping", id: this.me.id });
      } else if (m.t === "roster") {
        this.onRoster(m.players);
      } else if (m.t === "state") {
        this.applySnapshot(m.ships, m.m);
        this.pendingProjs = m.projs;
      } else if (m.t === "fx") {
        this.netFX(m);
      } else if (m.t === "end") {
        this.phase = "over";
        const won = m.winner === 0;
        if (!this.endSent) {
          this.endSent = true;
          audio.play(won ? "victory" : "defeat");
          const acc = this.me.shots ? this.me.hits / this.me.shots : 0;
          const fallbackRows: PerfRow[] = this.shipList.filter((s) => !s.drone).map((s) => ({
            name: s.name, team: s.team, me: s === this.me,
            kills: s.kills, assists: s.assists, damage: Math.max(0, Math.round(s.dmg)),
            deaths: s.deaths, score: Math.max(0, Math.round(s.score)), won,
          }));
          const outcome = m.reward !== undefined
            ? { reward: m.reward, isMvp: !!m.isMvp, mvpName: m.mvpName ?? "—", mvpTeam: (m.mvpTeam ?? (won ? 0 : 1)) as 0 | 1 }
            : computeReward(fallbackRows, won);
          setTimeout(() => this.onEnd({
            won, reason: m.reason, kills: this.me.kills, deaths: this.me.deaths, assists: this.me.assists,
            damage: Math.round(this.me.dmg), shots: this.me.shots, hits: this.me.hits,
            score: Math.round(this.me.score + this.me.kills * 100 + (won ? 500 : 0) + acc * 400),
            time: Math.round(this.matchTime), wave: 0, mode: this.cfg.mode,
            players: this.shipList.filter((s) => !s.drone).map((s) => ({ name: s.name, team: s.team, kills: s.kills, deaths: s.deaths, score: Math.round(s.score), me: s === this.me, bot: !!s.ai })),
            matchId: m.matchId ?? `C_${Date.now().toString(36)}`,
            reward: outcome.reward, isMvp: outcome.isMvp, mvpName: outcome.mvpName, mvpTeam: outcome.mvpTeam,
          }), 1200);
        }
      } else if (m.t === "pong" && m.to === this.me.id) {
        this.link.gotPong();
      }
    }
  }

  /** online: fill vacant slots with clearly-labelled combat AI (never disguised as humans) */
  private fillWithAI() {
    const mode = this.cfg.mode;
    if (mode !== "duel" && mode !== "wing" && mode !== "team") return;
    const size = mode === "team" ? 5 : mode === "wing" ? 2 : 1;
    ([0, 1] as const).forEach((team) => {
      const count = this.shipList.filter((s) => s.team === team && !s.drone).length;
      for (let i = count; i < size; i++) {
        const s = this.spawnAI(team, i);
        s.name = "AI·" + s.name;
        this.pushFeed(`${s.name} (combat AI) fills an empty slot`, "info");
      }
    });
  }

  private sendRoster() {
    const players = this.shipList.filter((s) => s.local || s.remote).map((s) => ({ id: s.id, name: s.name, team: s.team, host: s.local && this.cfg.net === "host" }));
    this.link.send({ t: "roster", players });
    this.onRoster(players);
  }

  private pendingProjs: { p: [number, number, number]; d: [number, number, number]; l: number; r: number; c: number }[] = [];

  private applySnapshot(list: NetShipState[], m: { phase: string; time: number; score: [number, number]; alive: [number, number]; mode: string }) {
    for (const ns of list) {
      let s = this.ships.get(ns.id);
      if (!s) {
        s = this.makeShip(ns.id, ns.nm, ns.tm,
          { ...this.cfg.ship, classId: (ns.cls as ShipConfig["classId"]) ?? "nova", paintIndex: ns.pt ?? 0, engineColorIndex: ns.ec ?? 0, equippedDrone: null },
          ns.id === this.me.id, new THREE.Vector3(ns.p[0], ns.p[1], ns.p[2]), ns.dr);
        s.remote = ns.id !== this.me.id;
        if (ns.dr) { s.drone = true; s.droneType = ns.dr; s.ownerId = ns.ow ?? null; s.droneState = ns.dst ?? "FOLLOW"; }
        this.addShip(s);
      }
      if (ns.dst) s.droneState = ns.dst;
      s.pos.set(ns.p[0], ns.p[1], ns.p[2]);
      s.netQuat.set(ns.q[0], ns.q[1], ns.q[2], ns.q[3]);
      s.hp = ns.hp; s.sh = ns.sh;
      s.shield = ns.sh; s.boost = ns.bs;
      s.kills = ns.kl;
      const wasAlive = s.alive;
      s.alive = ns.al === 1;
      if (wasAlive && !s.alive) this.destroyVisual(s, 1);
      s.netThrottle = ns.th;
      s.boosting = ns.bo === 1;
      if (ns.id === this.me.id) { s.maxHp = Math.max(s.maxHp, ns.hp); }
      s.obj.visible = s.alive;
    }
    // remove ships no longer present
    for (const s of [...this.shipList]) {
      if (!list.some((n) => n.id === s.id) && s !== this.me) this.removeShip(s);
    }
    this.phase = m.phase === "live" ? "live" : m.phase === "over" ? "over" : "countdown";
    this.matchTime = m.time;
    this.score = m.score;
    this.aliveCount = m.alive;
  }

  /** client-side rendering of host-authoritative projectiles */
  private renderNetProjectiles() {
    // clients rebuild the bullet draw list from the host snapshot each frame
    this.fx.clearBullets();
    const dir = new THREE.Vector3();
    const pos = new THREE.Vector3();
    for (const p of this.pendingProjs) {
      pos.set(p.p[0], p.p[1], p.p[2]);
      dir.set(p.d[0], p.d[1], p.d[2]).normalize();
      this.fx.addBullet(
        pos, dir, 900, p.c, 0,
        0, p.r, 0, 1, 0, 0, null, "_net", 0, p.r * 1.15, 1.2,
        clamp(p.l * 1.6, 8, 48),
      );
    }
  }

  private netFX(m: { k: string; p: [number, number, number]; c?: number; s?: number; d?: number }) {
    const p = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);
    const dist = clamp(p.distanceTo(this.camera.position) / 1400, 0, 1);
    if (m.k === "shot") {
      this.fx.burst(p, { count: 6, color: [m.c ?? 0x54e8ff, 0xffffff], speed: 40, size: (m.s ?? 1) * 1.4, life: 0.2, drag: 4 });
      audio.play(m.d ? "laser" : "laser", dist);
    } else if (m.k === "boom") {
      this.fx.explode(p, m.s ?? 1.5, m.c ?? 0x54e8ff);
      audio.play("explosion", dist);
      if (dist < 0.5) this.addShake((1 - dist) * 0.7);
    } else if (m.k === "nova") {
      this.fx.shockwave(p, 4, (m.s ?? 260) * 1.25, 1.1, 0xbfe9ff);
      this.fx.flash(p, 10, (m.s ?? 260) * 1.6, 0.7, 0xffffff);
      audio.play("nova", dist);
    } else if (m.k === "hit") {
      this.fx.burst(p, { count: 12, color: [0xffd08a, 0xffffff], speed: 60, size: 2, life: 0.4 });
      audio.play("impact", dist);
    }
  }

  private netAcc = 0;
  private broadcastState(dt: number) {
    this.netAcc += dt;
    if (this.netAcc < 0.05) return;
    this.netAcc = 0;
    const ships: NetShipState[] = this.shipList.map((s) => ({
      id: s.id, p: [s.pos.x, s.pos.y, s.pos.z], q: [s.quat.x, s.quat.y, s.quat.z, s.quat.w],
      hp: Math.round(s.hp), sh: Math.round(s.shield), bs: Math.round(s.boost),
      al: s.alive ? 1 : 0, th: s.throttle, bo: s.boosting ? 1 : 0, kl: s.kills, tm: s.team, nm: s.name, cls: s.clsId,
      pt: s.cfg.paintIndex, ec: s.cfg.engineColorIndex ?? 0,
      ...(s.drone && s.droneType ? { dr: s.droneType, ow: s.ownerId ?? undefined, dst: s.droneState } : {}),
    }));
    const projs = this.projs.slice(0, 90).map((p) => ({
      p: [p.pos.x, p.pos.y, p.pos.z] as [number, number, number],
      d: [p.dir.x, p.dir.y, p.dir.z] as [number, number, number],
      l: p.len, r: p.size, c: p.color,
    }));
    this.link.send({
      t: "state", tick: this.netSeq++, ships, projs,
      m: { phase: this.phase, time: this.matchTime, score: this.score, alive: this.aliveCount, mode: this.cfg.mode },
    });
  }

  // ---------- visuals ----------
  private addShake(v: number) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  private pushFeed(text: string, kind: FeedItem["kind"]) {
    this.feed.unshift({ id: this.feedId++, text, kind, t: 6 });
    if (this.feed.length > 5) this.feed.pop();
  }
  private pushWarning(w: string) {
    if (!this.warnings.includes(w)) this.warnings.push(w);
  }

  /** local muzzle feedback for networked clients (host resolves the actual shot) */
  private predictFire(s: Ship, slot: number) {
    const wid: WeaponId = slot === 0 ? s.cfg.loadout.primary : s.cfg.loadout.secondary;
    const w = WEAPONS[wid];
    const key = slot === 0 ? "p" : "s";
    if (s.cd[key] > 0) return;
    s.cd[key] = w.interval;
    s.shots++;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
    const mp = s.vis.muzzlePoints[s.shots % Math.max(1, s.vis.muzzlePoints.length)];
    const origin = mp ? mp.getWorldPosition(new THREE.Vector3()) : s.pos.clone().addScaledVector(fwd, s.radius);
    this.fx.burst(origin, { count: 5, color: [w.color, 0xffffff], speed: 40, size: w.size * 1.4, life: 0.2, drag: 4 });
    audio.play(w.sound, 0);
  }

  private updateVisuals(dt: number) {
    if (this.cfg.net === "client") this.renderNetProjectiles();

    // keep the shadow-casting key light anchored around the action
    const kl = this.world.keyLight;
    if (kl) {
      const sd = kl.userData.sunDir as THREE.Vector3;
      const anchor = this.me?.alive ? this.me.pos : this.spectateTarget?.pos ?? this.camPos;
      kl.position.copy(anchor).add(sd);
      kl.target.position.copy(anchor);
      kl.target.updateMatrixWorld();
    }

    // ship meshes + engines
    this.exhaust.beginFrame();
    const camP = this.camera.position;
    for (const s of this.shipList) {
      const dying = !s.alive && s.dying > 0;
      if (!s.alive && !dying) { s.obj.visible = false; continue; }
      s.obj.visible = true;
      if (this.cfg.net === "client") {
        if (s.netQuat) s.quat.slerp(s.netQuat, clamp(dt * 18, 0, 1));
        if (s.netThrottle !== undefined) s.throttle = s.netThrottle;
      }
      const cls = SHIP_CLASSES[s.clsId as ShipClassId];
      const fwd = this.tmpVF.set(0, 0, 1).applyQuaternion(s.quat);
      // recoil kick (springs back fast) and critical-damage shudder
      s.recoil = Math.max(0, s.recoil - dt * 7);
      s.obj.position.copy(s.pos).addScaledVector(fwd, -s.recoil * cls.scale);
      const hpFrac = s.hp / Math.max(1, s.maxHp);
      if (s.alive && hpFrac < 0.25) {
        const j = (0.25 - hpFrac) * 0.6 * cls.scale;
        s.obj.position.x += (Math.random() - 0.5) * j;
        s.obj.position.y += (Math.random() - 0.5) * j;
      }
      s.obj.quaternion.copy(s.quat);

      // ---- engines: blue-white plasma flames + glowing trails from the real nozzles ----
      const power = dying ? 0.15 : clamp(Math.max(0, s.throttle), 0, 1);
      const boosting = s.alive && s.boosting && s.boost > 1 && Math.abs(s.throttle) > 0.05;
      s.powerVis = lerp(s.powerVis, power, clamp(dt * 5, 0, 1));
      s.boostVis = lerp(s.boostVis, boosting ? 1 : 0, clamp(dt * (boosting ? 7 : 3.5), 0, 1));
      const flicker = dying ? 0.35 + Math.random() * 0.65 : s.alive && hpFrac < 0.25 ? 0.55 + Math.random() * 0.45 : 1;
      const back = this.tmpVB.set(0, 0, -1).applyQuaternion(s.quat);
      const engineCol = s.vis.engineMats[0].color;
      const near = s.pos.distanceToSquared(camP) < 2600 * 2600;
      for (let ei = 0; ei < s.vis.exhaustPoints.length; ei++) {
        const ep = s.vis.exhaustPoints[ei];
        const r = ((ep.userData.r as number | undefined) ?? 0.4) * cls.scale;
        const wp = this.tmpVN.copy(ep.position).multiplyScalar(cls.scale).applyQuaternion(s.quat).add(s.obj.position);
        if (near) this.exhaust.addEngine(wp, back, r, engineCol, s.powerVis, s.boostVis, ei * 7.3 + s.id.charCodeAt(2), flicker);
        if (s.alive && cls.category !== "capital") {
          if (s.trails[ei] === undefined || s.trails[ei] < 0) s.trails[ei] = this.exhaust.createTrail(0.22, engineCol);
          this.exhaust.setTrailLife(s.trails[ei], 0.18 + 0.3 * s.boostVis);
          this.exhaust.pushTrail(s.trails[ei], wp, r * (0.85 + 0.55 * s.boostVis), (0.3 + 0.45 * s.powerVis) * (1 + 0.7 * s.boostVis) * flicker);
        }
      }
      s.vis.engineLight.intensity = (0.4 + s.powerVis * 1.2 + s.boostVis * 1.3) * flicker;
      // boost: hot energy motes shed from the nozzles
      if (s.boostVis > 0.5 && near && this.fx.hasBudget && s.vis.exhaustPoints.length && Math.random() < dt * 24) {
        const ep = s.vis.exhaustPoints[(Math.random() * s.vis.exhaustPoints.length) | 0];
        const wp = this.tmpVN.copy(ep.position).multiplyScalar(cls.scale).applyQuaternion(s.quat).add(s.obj.position);
        this.fx.burst(wp, { count: 1, color: [engineCol.getHex(), 0xffffff], speed: 70, size: 1.4, life: 0.22, drag: 4, dir: back, cone: 0.12 });
      }

      // ---- shield: invisible until struck, then ripples out from the impact point ----
      s.shieldHit = Math.max(0, s.shieldHit - dt * 2.3);
      const full = s.alive && s.shieldBoost ? 0.5 + 0.12 * Math.sin(this.time * 9) : 0;
      const showShield = s.alive && (s.shieldHit > 0.01 || full > 0);
      s.vis.shield.visible = showShield;
      if (showShield) {
        const u = s.vis.shieldMat.uniforms;
        u.uTime.value = this.time;
        u.uHit.value = s.shieldHit;
        u.uFull.value = full;
        (u.uHitDir.value as THREE.Vector3).copy(s.shieldHitDir);
      }

      // ---- hull flash layered over each material's own glow ----
      s.hullFlash = Math.max(0, s.hullFlash - dt * 4.5);
      const hf = s.hullFlash;
      for (const m of s.vis.hullMats) {
        let base = m.userData.baseEmissive as THREE.Color | undefined;
        if (!base) { base = m.emissive.clone(); m.userData.baseEmissive = base; }
        m.emissive.setRGB(base.r + hf * 0.95, base.g + hf * 0.72, base.b + hf * 0.5);
      }

      // ---- damage state: sparks + smoke pouring off a crippled hull ----
      if (s.alive && hpFrac < 0.3 && this.fx.hasBudget && Math.random() < dt * 7) {
        const p = this.tmpW.set((Math.random() - 0.5), (Math.random() - 0.5) * 0.5, (Math.random() - 0.5)).multiplyScalar(s.radius * 1.2).add(s.pos);
        this.fx.burst(p, { count: 4, color: [0xffd08a, 0xff6a1a, 0xffffff], speed: 34, size: 1.8, life: 0.35 });
      }
    }

    // audio: engine sound for local player
    if (this.me) {
      const sp = this.me.vel.length();
      audio.engine(this.paused ? 0 : clamp(Math.abs(this.me.throttle), 0, 1), this.me.boosting ? 1 : 0, clamp(sp / (BASE_SPEED * 2), 0, 1));
    }

    // camera
    const focus = this.me.alive || this.cfg.mode === "team" || this.cfg.mode === "wing" ? (this.me.alive ? this.me : this.spectateTarget ?? this.me) : this.me;
    if (focus) {
      const cls = SHIP_CLASSES[focus.clsId as keyof typeof SHIP_CLASSES];
      const sp = focus.vel.length();
      if (this.camMode === "chase") {
        const back = 13.5 * cls.scale + sp * 0.012;
        const off = new THREE.Vector3(0, 3.4 * cls.scale, -back).applyQuaternion(focus.quat);
        const target = focus.pos.clone().add(off);
        if (this.world.terrainHeight) {
          const gy = this.world.terrainHeight(target.x, target.z) + 5;
          if (target.y < gy) target.y = gy;
        }
        const k = this.camInit ? clamp(dt * (7 + sp * 0.02), 0, 1) : 1;
        this.camPos.lerp(target, k);
        const look = focus.pos.clone().addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(focus.quat), 24);
        const m = new THREE.Matrix4().lookAt(this.camPos, look, new THREE.Vector3(0, 1, 0).applyQuaternion(focus.quat));
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        this.camQuat.slerp(q, this.camInit ? clamp(dt * 8, 0, 1) : 1);
        this.camInit = true;
      } else {
        // FIRST-PERSON COCKPIT VIEW
        // place camera inside the model so the cockpit glass + canopy are visible right at the rim.
        const off = new THREE.Vector3(0, cls.scale * 0.55, cls.scale * -2.6).applyQuaternion(focus.quat);
        this.camPos.copy(focus.pos).add(off);
        // ship faces +Z and Three.js cameras look down -Z, so flip.
        this.camQuat.copy(focus.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
        this.camInit = true;
      }
      const fovTarget = 72 + (focus.boosting ? 12 : 0) + clamp(sp / 60, 0, 8);
      this.camera.fov = lerp(this.camera.fov, fovTarget, clamp(dt * 3, 0, 1));
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(this.camPos);
      this.camera.quaternion.copy(this.camQuat);
    }

    // camera shake (trauma model: smooth noise, eased amplitude)
    if (this.trauma > 0.0005) {
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
      const a = Math.pow(this.trauma, 1.6) * this.settings.shake;
      const t = performance.now() * 0.001;
      const n1 = Math.sin(t * 23.1) * 0.6 + Math.sin(t * 41.7 + 1.3) * 0.4;
      const n2 = Math.sin(t * 19.3 + 2.1) * 0.6 + Math.sin(t * 37.9 + 0.7) * 0.4;
      const n3 = Math.sin(t * 29.7 + 4.2) * 0.6 + Math.sin(t * 53.3 + 2.9) * 0.4;
      this.camera.rotateX(n1 * a * 0.028);
      this.camera.rotateY(n2 * a * 0.028);
      this.camera.rotateZ(n3 * a * 0.05);
      this.camera.translateX(n2 * a * 0.35);
      this.camera.translateY(n1 * a * 0.35);
    }
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.damageDirs = this.damageDirs.filter((d) => (d.t -= dt) > 0);
    this.feed.forEach((f) => (f.t -= dt));
    this.feed = this.feed.filter((f) => f.t > 0);
    if (this.warnings.length) {
      for (const w of this.warnings) if (!this.warnBuffer.includes(w)) this.warnBuffer.push(w);
      this.warnings.length = 0;
    }
    this.warnTimer -= dt;
    if (this.warnTimer <= 0) { this.warnTimer = 1.5; this.warnBuffer.length = 0; }

    for (const d of this.dmgNums) d.age += dt;
    if (this.dmgNums.length) this.dmgNums = this.dmgNums.filter((d) => d.age < (d.kind === "kill" ? 1.4 : 0.9));
    this.killMarker = Math.max(0, this.killMarker - dt * 1.3);

    // missile ribbons trace their (curving) flight paths
    for (const p of this.projs) {
      if (p.trailId < 0 || !p.alive) continue;
      this.exhaust.pushTrail(p.trailId, p.pos, p.size * (p.homing > 0 ? 1.15 : 0.9), p.homing > 0 ? 0.95 : 0.8);
    }
    const bh = this.renderer.getDrawingBufferSize(this.tmpV2).y;
    this.exhaust.endFrame(this.camera, this.paused ? 0 : dt, bh);
    this.fx.setViewport(bh, this.camera.fov);
  }
  private warnTimer = 0;
  private warnBuffer: string[] = [];

  // ---------- HUD ----------
  private emitHUD() {
    const me = this.me;
    if (!me) return;
    const w = window.innerWidth, h = window.innerHeight;
    const markers: Marker[] = [];
    const radar: RadarBlip[] = [];
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(me.quat);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(me.quat);
    const v = new THREE.Vector3();
    const toScreen = (p: THREE.Vector3, pad = 1) => {
      v.copy(p).project(this.camera);
      if (v.z >= 1 || Math.abs(v.x) > pad || Math.abs(v.y) > pad) return null;
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
    };

    // which enemies my homing missiles are tracking right now
    const tracked = new Map<string, number>();
    let tracking = 0;
    for (const p of this.projs) {
      if (p.alive && p.homing > 0 && p.kind !== "intercept" && p.targetId && p.owner === me.id && p.armT <= 0) {
        tracked.set(p.targetId, (tracked.get(p.targetId) ?? 0) + 1);
        tracking++;
      }
    }

    const myDrone = this.shipList.find((s) => s.drone && s.ownerId === me.id);
    const scoutBonus = myDrone && myDrone.alive && myDrone.droneType === "scout" ? 1.45 : 1;
    const markerRange = 2200 * scoutBonus;
    const radarRange = 1600 * scoutBonus;
    for (const s of this.shipList) {
      if (s === me) continue;
      const to = s.pos.clone().sub(me.pos);
      const dist = to.length();
      if (dist < markerRange && s.alive) {
        v.copy(s.pos).project(this.camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.25 && Math.abs(v.y) < 1.25;
        markers.push({
          x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, dist, team: s.team,
          hp: s.hp / s.maxHp, name: s.name, onScreen, locked: s.id === me.targetId,
          tracked: tracked.get(s.id) ?? 0, drone: s.drone,
        });
      }
      if (dist < radarRange) {
        radar.push({ x: clamp(to.dot(right) / radarRange, -1, 1), y: clamp(-to.dot(fwd) / radarRange, -1, 1), d: dist, team: s.team, me: false, alive: s.alive });
      }
    }
    radar.push({ x: 0, y: 0, d: 0, team: 0, me: true, alive: me.alive });
    const target = me.targetId ? this.ships.get(me.targetId) : null;

    // lead pip: where to aim so primary fire meets the locked target
    let lead: HUDState["lead"] = null;
    if (target && target.alive && me.alive) {
      const wpn = WEAPONS[me.cfg.loadout.primary];
      const relPos = target.pos.clone().sub(me.pos);
      const relVel = target.vel.clone().addScaledVector(me.vel, -0.75);
      const t = interceptTime(relPos, relVel, wpn.speed);
      if (t > 0 && t < wpn.life * 1.3) lead = toScreen(me.pos.clone().add(relPos).addScaledVector(relVel, t));
    }

    // incoming seekers locked onto me (direction chevrons + warning)
    const incoming: number[] = [];
    for (const p of this.projs) {
      if (!p.alive || p.homing <= 0 || p.team === me.team || p.targetId !== me.id) continue;
      const to = p.pos.clone().sub(me.pos);
      const d = to.length();
      if (d > 1500 || d < 0.001) continue;
      to.divideScalar(d);
      incoming.push(Math.atan2(to.dot(right), to.dot(fwd)));
    }
    const missileAlert = incoming.length > 0;

    // floating damage numbers
    const dmgNums: HUDState["dmgNums"] = [];
    for (const d of this.dmgNums) {
      const sp = toScreen(d.pos, 1.1);
      if (sp) dmgNums.push({ id: d.id, x: sp.x, y: sp.y, amount: Math.round(d.amount), kind: d.kind, age: d.age });
    }

    let drones: HUDState["drones"] = null;
    const eqDrone = this.getValidEquippedDrone(me);
    if (eqDrone && this.droneTotal > 0) {
      const alive = this.shipList.filter((s) => s.drone && s.ownerId === me.id && s.alive).length;
      const pending = this.droneRespawn.filter((t) => t > 0);
      const spec = DRONE_TYPES[eqDrone];
      drones = {
        alive,
        total: this.droneTotal,
        stance: this.droneStance === "attack" ? "ATTACK" : "ESCORT",
        next: pending.length ? Math.min(...pending) : 0,
        name: spec.name,
        state: myDrone ? (myDrone.alive ? myDrone.droneState : "DESTROYED") : "DESTROYED",
        hp: myDrone && myDrone.alive ? Math.ceil(myDrone.hp) : 0,
        maxHp: spec.hull,
      };
    }

    this.onHUD({
      hp: Math.max(0, me.hp), maxHp: me.maxHp, shield: Math.max(0, me.shield), maxShield: me.maxShield,
      boost: me.boost, boostMax: me.boostMax, speed: me.vel.length(), throttle: me.throttle,
      weapon: me.cfg.loadout.primary, weaponName: WEAPONS[me.cfg.loadout.primary].name,
      weaponCd: me.cd.p / WEAPONS[me.cfg.loadout.primary].interval,
      altWeapon: me.cfg.loadout.secondary, altCd: me.cd.s / WEAPONS[me.cfg.loadout.secondary].interval,
      ultCd: me.cd.ult, ultReady: me.cd.ult <= 0,
      specialWeapon: me.cfg.loadout.special, specialCd: me.cd.x / WEAPONS[me.cfg.loadout.special].interval, specialReady: me.cd.x <= 0,
      shieldCd: me.cd.sh, shieldActive: me.shieldBoost,
      target: target && target.alive ? {
        name: target.name, hp: Math.max(0, target.hp), shield: Math.max(0, target.shield),
        dist: target.pos.distanceTo(me.pos), team: target.team,
      } : null,
      lock: me.lock, locking: !!target && me.lock < 1,
      markers, radar, score: this.score, alive: this.aliveCount,
      kills: me.kills, deaths: me.deaths, assists: me.assists, dmg: Math.round(me.dmg),
      accuracy: me.shots ? Math.min(1, me.hits / me.shots) : 0,
      time: this.timeLeft > 0 ? this.timeLeft : this.matchTime,
      mode: this.cfg.mode, wave: this.wave, feed: [...this.feed],
      warnings: missileAlert && !this.warnBuffer.includes("MISSILE INBOUND")
        ? [...this.warnBuffer, `MISSILE LOCK ×${incoming.length} — EVADE`] : [...this.warnBuffer],
      damageDirs: this.damageDirs.map((d) => d.a),
      camera: this.camMode, hitMarker: this.hitMarker > 0, boosting: me.boosting && me.boost > 1, fps: this.fps, arena: this.arena.name,
      countdown: this.phase === "countdown" ? this.countdown : 0,
      lowHp: me.hp / me.maxHp < 0.3, missileAlert,
      netPing: this.link.latency, netRole: this.cfg.net,
      players: this.shipList.filter((s) => !s.drone).map((s) => ({ name: s.name, team: s.team, kills: s.kills, alive: s.alive, me: s === this.me, bot: !!s.ai })),
      missileMag: me.missileMag, missileLoaded: me.missileLoaded,
      dmgNums, killMarker: this.killMarker, lead, incoming, drones, tracking,
    });
  }

  restart() {
    this.disposeEntities();
    this.endSent = false;
    this.phase = "countdown";
    this.countdown = 3.2;
    this.matchTime = 0;
    this.score = [0, 0];
    this.wave = 0;
    this.projs.length = 0;
    this.exhaust.clear();
    this.wrecks.clear();
    this.dmgNums.length = 0;
    this.killMarker = 0;
    this.trauma = 0;
    this.timeLeft = this.cfg.mode === "duel" ? 420 : this.cfg.mode === "wing" ? 450 : this.cfg.mode === "team" ? 480 : 0;
    this.spawnPlayer();
    if (this.cfg.mode === "practice") this.spawnWave(true);
    else if (this.cfg.mode === "duel") this.spawnAI(1, 0);
    else if (this.cfg.mode === "wing") {
      for (let i = 0; i < 2; i++) this.spawnAI(1, i);
      this.spawnAI(0, 0);
    } else if (this.cfg.mode === "team") {
      for (let i = 0; i < 5; i++) this.spawnAI(1, i);
      for (let i = 0; i < 4; i++) this.spawnAI(0, i);
    }
    if (this.cfg.net === "off") this.deployDrones();
    this.setPaused(false);
    audio.startMusic(this.cfg.mode === "free" ? "menu" : "battle");
  }

  private disposeEntities() {
    for (const s of [...this.shipList]) this.removeShip(s);
    this.shipList.length = 0;
    this.ships.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("contextmenu", this.onContext);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.releaseLock();
    audio.engineOff();
    audio.startMusic("none");
    this.helloTimers.forEach((t) => window.clearTimeout(t));
    this.helloTimers = [];
    if (this.cfg.net !== "off") { this.link.send({ t: "leave", id: this.me?.id ?? "" }); this.link.close(); }
    this.disposeEntities();
    this.wrecks?.dispose();
    this.exhaust?.dispose();
    this.fx?.dispose();
    this.world?.dispose();
    this.scene.clear();
    this.renderer?.dispose();
  }
}

// augment Ship with runtime-only fields used above
declare module "./engine" { }
export type { Ship };
