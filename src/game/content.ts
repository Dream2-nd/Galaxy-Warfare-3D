// GALAXY WARFARE 3D — static content: 10 ship classes, 6 combat drones, weapons, cosmetics, 14 arenas (including 2 planetary maps), and modes.

export type ShipClassId =
  // 10 flagship playable spacecraft
  | "titan"
  | "phantom"
  | "nova"
  | "apocalypse"
  | "specter"
  | "seraphim"
  | "viper"
  | "colossus"
  | "eclipse"
  | "saucer"
  // legacy compatibility aliases
  | "scout"
  | "fighter"
  | "heavy"
  | "interceptor"
  | "advanced"
  | "interceptor2"
  | "heavyfighter"
  | "stealth"
  | "cruiser"
  | "gunship"
  // capital bosses
  | "battleship"
  | "carrier"
  | "frigate"
  | "dreadnaught"
  | "orbital"
  // autonomous wingman
  | "drone";

export type DroneTypeId =
  | "hunter"
  | "assault"
  | "interceptor"
  | "guardian"
  | "scout"
  | "stealth";

export type ShipSize = "small" | "medium" | "large" | "capital";

export interface ShipClass {
  id: ShipClassId;
  name: string;
  role: string;
  hull: number;
  shield: number;
  speed: number;
  agility: number;
  accelBonus?: number;
  scale: number;
  radius: number;
  boostCap: number;
  price: number;
  defaultPrimary?: WeaponId;
  defaultSecondary?: WeaponId;
  desc: string;
  bars: { top: number; agi: number; arm: number; shd: number };
  category: "fighter" | "capital" | "drone";
  size: ShipSize;
  hasHeavyWeapons?: boolean;
  wingHull?: number;
  missileMag?: number;
}

export const DEFAULT_FIGHTER_HULL = 50;
export const DEFAULT_FIGHTER_SHIELD = 10;

/** All 10 unique playable spacecraft in the Hangar */
export const FIGHTER_ROSTER: ShipClassId[] = [
  "nova",
  "phantom",
  "viper",
  "seraphim",
  "specter",
  "eclipse",
  "apocalypse",
  "saucer",
  "colossus",
  "titan",
];

export const FIGHTER_ORDER: ShipClassId[] = [...FIGHTER_ROSTER];
export const CAPITAL_ROSTER: ShipClassId[] = ["orbital", "dreadnaught", "carrier", "frigate", "battleship"];

export const SHIP_CLASSES: Record<ShipClassId, ShipClass> = {
  // ==================== 10 UNIQUE PLAYABLE SPACESHIPS ====================
  titan: {
    id: "titan",
    name: "TITAN DREADNOUGHT",
    role: "Heavy Dreadnought Fighter",
    hull: 50,
    shield: 10,
    speed: 0.76,
    agility: 0.65,
    accelBonus: 0.82,
    scale: 1.38,
    radius: 7.6,
    boostCap: 95,
    price: 168,
    defaultPrimary: "heavy_beam",
    defaultSecondary: "charged",
    desc: "Massive armored battleship hull with layered plating, dorsal cannon batteries, twin missile pods, and triple blue-white fusion nozzles.",
    bars: { top: 2, agi: 2, arm: 5, shd: 4 },
    category: "fighter",
    size: "large",
    missileMag: 10,
  },
  phantom: {
    id: "phantom",
    name: "PHANTOM STEALTH FIGHTER",
    role: "Stealth Interceptor",
    hull: 50,
    shield: 10,
    speed: 1.58,
    agility: 1.52,
    accelBonus: 1.45,
    scale: 1.0,
    radius: 5.2,
    boostCap: 145,
    price: 0,
    defaultPrimary: "twin_laser",
    defaultSecondary: "fast_interceptor",
    desc: "Sharp obsidian stealth fighter with forward-swept angular wings, dark metallic chine plating, crimson power conduits, and twin glowing engines.",
    bars: { top: 5, agi: 5, arm: 2, shd: 3 },
    category: "fighter",
    size: "small",
    missileMag: 10,
  },
  nova: {
    id: "nova",
    name: "NOVA INTERCEPTOR",
    role: "High-Speed Air-Superiority",
    hull: 50,
    shield: 10,
    speed: 1.52,
    agility: 1.36,
    accelBonus: 1.38,
    scale: 1.02,
    radius: 5.2,
    boostCap: 140,
    price: 0,
    defaultPrimary: "laser",
    defaultSecondary: "homing",
    desc: "Sleek silver-white interceptor with needle nose, swept delta wings, triple afterburners, and balanced precision hardpoints.",
    bars: { top: 5, agi: 4, arm: 3, shd: 3 },
    category: "fighter",
    size: "small",
    missileMag: 10,
  },
  apocalypse: {
    id: "apocalypse",
    name: "APOCALYPSE ASSAULT SHIP",
    role: "Heavy Strike Gunship",
    hull: 50,
    shield: 10,
    speed: 0.84,
    agility: 0.74,
    accelBonus: 0.9,
    scale: 1.28,
    radius: 7.1,
    boostCap: 95,
    price: 150,
    defaultPrimary: "red_plasma",
    defaultSecondary: "swarm",
    desc: "Aggressive heavy assault craft with reinforced cheek armor, quad rotary cannon barrels, visible wing missile pods, and red-orange warning beacons.",
    bars: { top: 3, agi: 2, arm: 5, shd: 4 },
    category: "fighter",
    size: "medium",
    missileMag: 10,
  },
  specter: {
    id: "specter",
    name: "SPECTER ALIEN WARSHIP",
    role: "Exotic Phase Fighter",
    hull: 50,
    shield: 10,
    speed: 1.22,
    agility: 1.28,
    accelBonus: 1.2,
    scale: 1.12,
    radius: 5.8,
    boostCap: 125,
    price: 130,
    defaultPrimary: "blue_repeater",
    defaultSecondary: "homing",
    desc: "Biomechanical alien crescent warship with curvedscythe wings, suspended central energy core, and blue-violet plasma emitters.",
    bars: { top: 4, agi: 4, arm: 3, shd: 5 },
    category: "fighter",
    size: "medium",
    missileMag: 10,
  },
  seraphim: {
    id: "seraphim",
    name: "SERAPHIM ADVANCED FIGHTER",
    role: "Precision Lance Fighter",
    hull: 50,
    shield: 10,
    speed: 1.42,
    agility: 1.44,
    accelBonus: 1.32,
    scale: 1.06,
    radius: 5.4,
    boostCap: 135,
    price: 120,
    defaultPrimary: "precision_beam",
    defaultSecondary: "fast_interceptor",
    desc: "Elegant silver-and-cyan interceptor with gull-curved four-wing array, elongated crystal canopy, and long-barrel precision energy lances.",
    bars: { top: 4, agi: 5, arm: 3, shd: 4 },
    category: "fighter",
    size: "small",
    missileMag: 10,
  },
  viper: {
    id: "viper",
    name: "VIPER STRIKE CRAFT",
    role: "Close-In Dogfighter",
    hull: 50,
    shield: 10,
    speed: 1.64,
    agility: 1.62,
    accelBonus: 1.55,
    scale: 0.94,
    radius: 4.8,
    boostCap: 150,
    price: 0,
    defaultPrimary: "rapid",
    defaultSecondary: "missile",
    desc: "Compact dark-metalfang fighter with twin forward canards, crimson intake trim, rapid-fire chin guns, and razor-sharp roll authority.",
    bars: { top: 5, agi: 5, arm: 2, shd: 2 },
    category: "fighter",
    size: "small",
    missileMag: 10,
  },
  colossus: {
    id: "colossus",
    name: "COLOSSUS HEAVY CRUISER",
    role: "Armored Line Cruiser",
    hull: 50,
    shield: 10,
    speed: 0.78,
    agility: 0.68,
    accelBonus: 0.85,
    scale: 1.34,
    radius: 7.4,
    boostCap: 90,
    price: 160,
    defaultPrimary: "heavy_plasma_launcher",
    defaultSecondary: "charged",
    desc: "Broad-shouldered warship with twin catamaran prows, side-mounted sponson batteries, four high-thrust nozzles, and terraced bridge armor.",
    bars: { top: 2, agi: 2, arm: 5, shd: 5 },
    category: "fighter",
    size: "large",
    missileMag: 10,
  },
  eclipse: {
    id: "eclipse",
    name: "ECLIPSE ENERGY SHIP",
    role: "Reactor Plasma Striker",
    hull: 50,
    shield: 10,
    speed: 1.26,
    agility: 1.22,
    accelBonus: 1.25,
    scale: 1.1,
    radius: 5.8,
    boostCap: 130,
    price: 140,
    defaultPrimary: "heavy_beam",
    defaultSecondary: "revenge",
    desc: "Black-and-silver split-fuselage striker built around an exposed purple-cyan dorsal reactor core that feeds heavy plasma cannons.",
    bars: { top: 4, agi: 4, arm: 3, shd: 5 },
    category: "fighter",
    size: "medium",
    missileMag: 10,
  },
  saucer: {
    id: "saucer",
    name: "ORBITAL UFO DESTROYER",
    role: "Omnidirectional Saucer",
    hull: 50,
    shield: 10,
    speed: 1.18,
    agility: 1.35,
    accelBonus: 1.3,
    scale: 1.18,
    radius: 6.2,
    boostCap: 125,
    price: 155,
    defaultPrimary: "blue_repeater",
    defaultSecondary: "homing",
    desc: "Advanced metallic flying saucer with terraced saucer plates, central command dome, radial energy vents, rotating rim cannons, and rear reaction thrusters.",
    bars: { top: 4, agi: 4, arm: 4, shd: 4 },
    category: "fighter",
    size: "medium",
    missileMag: 10,
  },

  // ==================== LEGACY COMPATIBILITY ALIASES ====================
  scout: {
    id: "scout", name: "VX-9 SCOUT", role: "Recon / Skirmisher",
    hull: 50, shield: 10, speed: 1.34, agility: 1.55, scale: 0.9, radius: 4.6, boostCap: 130, price: 0,
    desc: "Light recon craft.", bars: { top: 5, agi: 5, arm: 2, shd: 2 }, category: "fighter", size: "small",
  },
  fighter: {
    id: "fighter", name: "AX-4 FIGHTER", role: "Line Combatant",
    hull: 50, shield: 10, speed: 1.1, agility: 1.1, scale: 1.0, radius: 5.2, boostCap: 100, price: 0,
    desc: "Balanced frontier fighter.", bars: { top: 3, agi: 3, arm: 3, shd: 3 }, category: "fighter", size: "small",
  },
  interceptor: {
    id: "interceptor", name: "SR-2 INTERCEPTOR", role: "Pursuit / Hit & Run",
    hull: 50, shield: 10, speed: 1.52, agility: 1.26, scale: 0.96, radius: 5.0, boostCap: 150, price: 0,
    desc: "Fast pursuit craft.", bars: { top: 5, agi: 4, arm: 2, shd: 3 }, category: "fighter", size: "small",
  },
  heavy: {
    id: "heavy", name: "GRV-7 HEAVY", role: "Assault / Gunship",
    hull: 50, shield: 10, speed: 0.78, agility: 0.68, scale: 1.28, radius: 7.0, boostCap: 85, price: 0,
    desc: "Armored assault craft.", bars: { top: 2, agi: 2, arm: 5, shd: 5 }, category: "fighter", size: "medium",
  },
  advanced: {
    id: "advanced", name: "ΩN-1 ADVANCED", role: "Prototype / Specialist",
    hull: 50, shield: 10, speed: 1.2, agility: 1.16, scale: 1.1, radius: 5.8, boostCap: 120, price: 0,
    desc: "Prototype phase fighter.", bars: { top: 4, agi: 4, arm: 4, shd: 5 }, category: "fighter", size: "small",
  },
  interceptor2: {
    id: "interceptor2", name: "VR-9 SHRIKE", role: "Advanced Interceptor",
    hull: 50, shield: 10, speed: 1.6, agility: 1.45, scale: 0.98, radius: 5.0, boostCap: 155, price: 0,
    desc: "Fast interceptor.", bars: { top: 5, agi: 5, arm: 2, shd: 2 }, category: "fighter", size: "small",
  },
  heavyfighter: {
    id: "heavyfighter", name: "AX-9 HAMMERHEAD", role: "Heavy Assault Fighter",
    hull: 50, shield: 10, speed: 0.85, agility: 0.72, scale: 1.3, radius: 7.2, boostCap: 90, price: 0,
    desc: "Heavy assault fighter.", bars: { top: 3, agi: 2, arm: 5, shd: 4 }, category: "fighter", size: "medium",
  },
  stealth: {
    id: "stealth", name: "SH-13 WRAITH", role: "Stealth Fighter",
    hull: 50, shield: 10, speed: 1.4, agility: 1.32, scale: 1.0, radius: 5.4, boostCap: 140, price: 0,
    desc: "Obsidian ambush craft.", bars: { top: 4, agi: 4, arm: 2, shd: 3 }, category: "fighter", size: "small",
  },
  cruiser: {
    id: "cruiser", name: "EC-22 AURORA", role: "Exploration Cruiser",
    hull: 50, shield: 10, speed: 0.95, agility: 0.95, scale: 1.18, radius: 6.6, boostCap: 110, price: 0,
    desc: "Exploration cruiser.", bars: { top: 3, agi: 3, arm: 3, shd: 4 }, category: "fighter", size: "medium",
  },
  gunship: {
    id: "gunship", name: "GS-31 BASTION", role: "Heavy Gunship",
    hull: 50, shield: 10, speed: 0.76, agility: 0.62, scale: 1.36, radius: 7.6, boostCap: 85, price: 0,
    desc: "Heavy gunship.", bars: { top: 2, agi: 1, arm: 5, shd: 5 }, category: "fighter", size: "medium",
  },

  // ==================== CAPITAL BOSSES ====================
  frigate: {
    id: "frigate", name: "EFF-04 ESCORT FRIGATE", role: "Capital — Escort",
    hull: 260, shield: 120, speed: 0.55, agility: 0.35, scale: 2.4, radius: 26, boostCap: 0, price: 0,
    desc: "Fast escort vessel with twin turret banks and rapid missile volleys.",
    bars: { top: 4, agi: 3, arm: 4, shd: 4 }, category: "capital", size: "capital", hasHeavyWeapons: true, wingHull: 260,
  },
  battleship: {
    id: "battleship", name: "DN-21 HYPERION", role: "Capital — Battleship",
    hull: 520, shield: 220, speed: 0.32, agility: 0.22, scale: 3.6, radius: 44, boostCap: 0, price: 0,
    desc: "Long-hulled capital ship with numerous weapon batteries and reinforced decks.",
    bars: { top: 2, agi: 1, arm: 5, shd: 5 }, category: "capital", size: "capital", hasHeavyWeapons: true, wingHull: 520,
  },
  carrier: {
    id: "carrier", name: "SC-88 APOLLO", role: "Capital — Supercarrier",
    hull: 700, shield: 300, speed: 0.24, agility: 0.18, scale: 4.4, radius: 56, boostCap: 0, price: 0,
    desc: "The flagship. Slow, vast, fields flight wings and heavy batteries.",
    bars: { top: 1, agi: 1, arm: 5, shd: 5 }, category: "capital", size: "capital", hasHeavyWeapons: true, wingHull: 700,
  },
  dreadnaught: {
    id: "dreadnaught", name: "DN-X1 DREADNAUGHT", role: "Capital — Dreadnaught",
    hull: 900, shield: 380, speed: 0.18, agility: 0.13, scale: 5.6, radius: 70, boostCap: 0, price: 0,
    desc: "A city-sized black wedge of war with crimson weapons.",
    bars: { top: 1, agi: 1, arm: 5, shd: 5 }, category: "capital", size: "capital", hasHeavyWeapons: true, wingHull: 900,
  },
  orbital: {
    id: "orbital", name: "ORBITAL CARRIER", role: "Capital — Carrier",
    hull: 600, shield: 260, speed: 0.27, agility: 0.2, scale: 4.0, radius: 52, boostCap: 0, price: 0,
    desc: "Mobile fleet base with docking bays and illuminated decks.",
    bars: { top: 1, agi: 1, arm: 5, shd: 5 }, category: "capital", size: "capital", hasHeavyWeapons: true, wingHull: 600,
  },
  drone: {
    id: "drone", name: "AEGIS COMBAT DRONE", role: "Autonomous Wingman",
    hull: 24, shield: 8, speed: 1.55, agility: 1.9, scale: 0.64, radius: 2.8, boostCap: 120, price: 0,
    desc: "Autonomous escort that guards its pilot and engages hostiles.",
    bars: { top: 5, agi: 5, arm: 1, shd: 1 }, category: "drone", size: "small",
  },
};

export const SHIP_ORDER: ShipClassId[] = [...FIGHTER_ORDER, "orbital", "frigate", "battleship", "carrier", "dreadnaught"];
export const CAPITAL_ORDER: ShipClassId[] = ["orbital", "frigate", "battleship", "carrier", "dreadnaught"];

export function fighterHpBase(_id: ShipClassId) { return DEFAULT_FIGHTER_HULL; }
export function fighterShieldBase(_id: ShipClassId) { return DEFAULT_FIGHTER_SHIELD; }
export function isCapital(id: ShipClassId) { return SHIP_CLASSES[id].category === "capital"; }

// ==================== 6 COMBAT DRONE TYPES ====================

export interface DroneSpec {
  id: DroneTypeId;
  name: string;
  role: string;
  hull: number;
  shield: number;
  speed: number;
  agility: number;
  scale: number;
  radius: number;
  weapon: WeaponId;
  fireInterval: number;
  range: number;
  price: number;
  color: number;
  accent: number;
  desc: string;
  perk: string;
  bars: { top: number; agi: number; arm: number; shd: number };
}

export const DRONE_ORDER: DroneTypeId[] = [
  "hunter",
  "assault",
  "interceptor",
  "guardian",
  "scout",
  "stealth",
];

export const DRONE_TYPES: Record<DroneTypeId, DroneSpec> = {
  hunter: {
    id: "hunter",
    name: "VX-1 HUNTER DRONE",
    role: "Pursuit & Auto-Fire",
    hull: 24,
    shield: 8,
    speed: 1.55,
    agility: 1.9,
    scale: 0.65,
    radius: 2.8,
    weapon: "droneLaser",
    fireInterval: 0.26,
    range: 820,
    price: 0,
    color: 0x3fd4ff,
    accent: 0x7dffe0,
    desc: "Agile arrowhead wingman that follows your ship and automatically engages enemies in range with pulse lasers.",
    perk: "Fast target acquisition & balanced pursuit",
    bars: { top: 4, agi: 5, arm: 2, shd: 2 },
  },
  assault: {
    id: "assault",
    name: "AX-7 ASSAULT DRONE",
    role: "Heavy Gun Drone",
    hull: 34,
    shield: 12,
    speed: 1.32,
    agility: 1.55,
    scale: 0.74,
    radius: 3.2,
    weapon: "dronePlasma",
    fireInterval: 0.38,
    range: 780,
    price: 90,
    color: 0xff6a3d,
    accent: 0xffb04a,
    desc: "Armored twin-boom combat drone carrying dual heavy plasma blasters that deal high hull and shield damage.",
    perk: "+60% weapon damage per salvo",
    bars: { top: 3, agi: 3, arm: 4, shd: 3 },
  },
  interceptor: {
    id: "interceptor",
    name: "IX-4 INTERCEPTOR DRONE",
    role: "Point-Defense & Anti-Drone",
    hull: 22,
    shield: 10,
    speed: 1.75,
    agility: 2.2,
    scale: 0.62,
    radius: 2.6,
    weapon: "droneIntercept",
    fireInterval: 0.18,
    range: 920,
    price: 80,
    color: 0xffeb8a,
    accent: 0x54e8ff,
    desc: "Tri-wing high-velocity defense drone that prioritizes shooting down incoming enemy missiles and hostile drones.",
    perk: "Shoots down incoming missiles & enemy drones",
    bars: { top: 5, agi: 5, arm: 2, shd: 3 },
  },
  guardian: {
    id: "guardian",
    name: "GX-9 GUARDIAN DRONE",
    role: "Close Defense & Shield Aegis",
    hull: 38,
    shield: 18,
    speed: 1.4,
    agility: 1.7,
    scale: 0.72,
    radius: 3.2,
    weapon: "droneLaser",
    fireInterval: 0.28,
    range: 640,
    price: 100,
    color: 0x7dffb0,
    accent: 0x3fd4ff,
    desc: "Hexagonal shield-matrix drone that stays in tight escort around your hull, zapping nearby threats and trickling energy to your shield.",
    perk: "Restores owner shield (+1.2/s) while alive",
    bars: { top: 3, agi: 4, arm: 5, shd: 5 },
  },
  scout: {
    id: "scout",
    name: "SX-2 SCOUT DRONE",
    role: "Recon & Target Designation",
    hull: 20,
    shield: 8,
    speed: 1.82,
    agility: 2.1,
    scale: 0.6,
    radius: 2.5,
    weapon: "dronePrecision",
    fireInterval: 0.34,
    range: 1150,
    price: 70,
    color: 0x8ff6ff,
    accent: 0xffc24a,
    desc: "Sensor-dish recon drone that sweeps ahead, marks distant enemies on your HUD/radar (+45% sensor range), and snipes with precision beams.",
    perk: "Extends radar & target-lock speed by 40%",
    bars: { top: 5, agi: 5, arm: 1, shd: 2 },
  },
  stealth: {
    id: "stealth",
    name: "WX-0 STEALTH DRONE",
    role: "Cloaked Precision Striker",
    hull: 24,
    shield: 10,
    speed: 1.68,
    agility: 2.0,
    scale: 0.66,
    radius: 2.7,
    weapon: "droneStealth",
    fireInterval: 0.42,
    range: 1000,
    price: 120,
    color: 0x9d7bff,
    accent: 0xff3a4a,
    desc: "Swept-blade obsidian stealth drone that敵 enemies struggle to lock onto, delivering high-velocity crimson-violet sniper bursts.",
    perk: "Low enemy aggro signature & high crit damage",
    bars: { top: 5, agi: 5, arm: 2, shd: 3 },
  },
};

// ==================== WEAPONS & MISSILES ====================

export type WeaponId =
  // 8 Primary Energy Weapons
  | "laser"
  | "rapid"
  | "heavy_beam"
  | "twin_laser"
  | "red_plasma"
  | "blue_repeater"
  | "precision_beam"
  | "heavy_plasma_launcher"
  // Legacy / Additional Energy
  | "bolt"
  | "plasma"
  | "heavy"
  | "charged"
  | "darkmatter"
  | "curse"
  // Missiles & Defenses
  | "homing"
  | "fast_interceptor"
  | "missile"
  | "swarm"
  | "twin"
  | "energyMissile"
  | "torpedo"
  | "intercept"
  | "revenge"
  // Drone weapons & Ult
  | "droneLaser"
  | "dronePlasma"
  | "droneIntercept"
  | "dronePrecision"
  | "droneStealth"
  | "nova";

export type WeaponFx = "blue" | "red" | "dark" | "ghost" | "charged" | "missile" | "torpedo";

export interface Weapon {
  id: WeaponId;
  name: string;
  short: string;
  kind: "energy" | "missile" | "ultimate";
  dmg: number;
  interval: number;
  speed: number;
  life: number;
  color: number;
  size: number;
  spread: number;
  homing?: number;
  splash?: number;
  shieldDmgMul?: number;
  desc: string;
  sound: "laser" | "plasma" | "rapid" | "missile" | "heavy";
  fx?: WeaponFx;
  burst?: number;
  revenge?: boolean;
  slow?: number;
  isHeavy?: boolean;
  ammo?: number;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  // ---------------- 8 PRIMARY WEAPONS ----------------
  laser: {
    id: "laser", name: "BLUE-WHITE LASER CANNON", short: "LASER", kind: "energy",
    dmg: 4, interval: 0.16, speed: 1320, life: 1.25, color: 0x3fd4ff, size: 1.5,
    spread: 0.003, shieldDmgMul: 0.95, sound: "laser", fx: "blue",
    desc: "Brilliant white-hot core in a cyan halo. Accurate, high-visibility main laser cannon.",
  },
  rapid: {
    id: "rapid", name: "RAPID-FIRE PULSE GUN", short: "RAPID", kind: "energy",
    dmg: 2.2, interval: 0.07, speed: 1550, life: 0.9, color: 0xffd34d, size: 1.0,
    spread: 0.024, shieldDmgMul: 0.8, sound: "rapid", fx: "blue",
    desc: "High-cadence energy pulse gatling that shreds hulls in close dogfights.",
  },
  heavy_beam: {
    id: "heavy_beam", name: "HEAVY LASER BEAM", short: "H-BEAM", kind: "energy",
    dmg: 9, interval: 0.36, speed: 2150, life: 1.15, color: 0x66e8ff, size: 1.9,
    spread: 0.0015, shieldDmgMul: 1.1, sound: "heavy", fx: "blue",
    desc: "Long, searing blue-white energy lance with high velocity and armor penetration.",
  },
  twin_laser: {
    id: "twin_laser", name: "TWIN LASER CANNONS", short: "TWIN-L", kind: "energy",
    dmg: 3.1, interval: 0.21, speed: 1450, life: 1.15, color: 0x54f0ff, size: 1.25,
    spread: 0.012, shieldDmgMul: 0.95, sound: "laser", fx: "blue", burst: 2,
    desc: "Synchronized dual laser cannons firing paired blue-white bolts from wing hardpoints.",
  },
  red_plasma: {
    id: "red_plasma", name: "RED PLASMA CANNON", short: "R-PLASMA", kind: "energy",
    dmg: 7.5, interval: 0.34, speed: 940, life: 1.5, color: 0xff3a4a, size: 2.1,
    spread: 0.006, shieldDmgMul: 1.35, sound: "plasma", fx: "red",
    desc: "Superheated crimson plasma bolts that strip shields and scorch hull plating.",
  },
  blue_repeater: {
    id: "blue_repeater", name: "BLUE PLASMA REPEATER", short: "REPEATER", kind: "energy",
    dmg: 2.9, interval: 0.28, speed: 1220, life: 1.2, color: 0x4fa8ff, size: 1.35,
    spread: 0.018, shieldDmgMul: 1.15, sound: "plasma", fx: "blue", burst: 3,
    desc: "Three-round burst plasma repeater with sustained mid-range suppression.",
  },
  precision_beam: {
    id: "precision_beam", name: "PRECISION ENERGY BEAM", short: "SNIPER", kind: "energy",
    dmg: 7.2, interval: 0.27, speed: 2450, life: 1.1, color: 0xa8f8ff, size: 1.2,
    spread: 0.0005, shieldDmgMul: 1.0, sound: "laser", fx: "blue",
    desc: "Near-instantaneous needle energy beam with zero dispersion for long-range marksmen.",
  },
  heavy_plasma_launcher: {
    id: "heavy_plasma_launcher", name: "HEAVY PLASMA LAUNCHER", short: "PL-MORTAR", kind: "energy",
    dmg: 13, interval: 0.62, speed: 720, life: 1.9, color: 0x72c8ff, size: 3.1,
    spread: 0.005, splash: 18, shieldDmgMul: 1.4, sound: "heavy", fx: "charged",
    desc: "Launches volatile plasma globes that detonate with area-of-effect shockwaves.",
  },

  // ---------------- LEGACY / SPECIAL ENERGY ----------------
  bolt: {
    id: "bolt", name: "FAST BLUE LASER", short: "BOLT", kind: "energy",
    dmg: 5, interval: 0.14, speed: 1900, life: 0.95, color: 0x8fe8ff, size: 1.15,
    spread: 0.003, shieldDmgMul: 0.95, sound: "laser", fx: "blue",
    desc: "Needle-thin blue-white lance with high velocity.",
  },
  plasma: {
    id: "plasma", name: "PLASMA BLASTER", short: "PLASMA", kind: "energy",
    dmg: 8, interval: 0.42, speed: 760, life: 1.6, color: 0xff57d2, size: 2.3,
    spread: 0.01, shieldDmgMul: 1.5, sound: "plasma", fx: "blue",
    desc: "Slow magenta plasma globes that melt shields.",
  },
  heavy: {
    id: "heavy", name: "HEAVY PLASMA CANNON", short: "HEAVY", kind: "energy",
    dmg: 12, interval: 1.5, speed: 560, life: 2.4, color: 0xa8ff4d, size: 3.4,
    spread: 0.004, shieldDmgMul: 1.2, splash: 18, sound: "heavy", fx: "charged",
    desc: "Capital-grade siege bolt.",
  },
  darkmatter: {
    id: "darkmatter", name: "DARK SINGULARITY", short: "DARK", kind: "energy",
    dmg: 8, interval: 11, speed: 300, life: 4.5, color: 0x6a3aff, size: 4.0,
    spread: 0, splash: 22, shieldDmgMul: 0.6, sound: "heavy", fx: "dark", slow: 0.35,
    desc: "Black core in a violet ring. Disrupts the target's engines on impact.",
  },
  curse: {
    id: "curse", name: "SPECTRAL PLASMA", short: "SPECTRE", kind: "energy",
    dmg: 7, interval: 8, speed: 420, life: 4, color: 0xa8e0ff, size: 2.4,
    spread: 0, slow: 0.6, sound: "plasma", fx: "ghost",
    desc: "Ghostly plasma that weakens shields and slows the target.",
  },

  // ---------------- MISSILES & ROCKETS ----------------
  homing: {
    id: "homing", name: "GUIDED HOMING MISSILES", short: "HOMING", kind: "missile",
    dmg: 11, interval: 0.8, speed: 430, life: 5.5, color: 0x4fc8ff, size: 1.7,
    spread: 0, homing: 3.0, splash: 18, sound: "missile", fx: "blue",
    desc: "Locks the target in your sights and visibly arcs through space to chase it.",
  },
  fast_interceptor: {
    id: "fast_interceptor", name: "FAST INTERCEPTOR MISSILES", short: "F-SEEK", kind: "missile",
    dmg: 9, interval: 0.65, speed: 610, life: 4.2, color: 0x8ff6ff, size: 1.45,
    spread: 0, homing: 4.3, splash: 14, sound: "missile", fx: "blue",
    desc: "High-velocity agile interceptor missile designed to run down evasive fighters.",
  },
  charged: {
    id: "charged", name: "HEAVY PLASMA MISSILES", short: "H-PLASMA", kind: "missile",
    dmg: 16, interval: 1.55, speed: 360, life: 5.0, color: 0x66c8ff, size: 3.4,
    spread: 0, homing: 1.8, shieldDmgMul: 1.4, splash: 32, sound: "heavy", fx: "charged",
    desc: "Heavy guided plasma warhead with a massive blast radius and shield-shattering punch.",
  },
  revenge: {
    id: "revenge", name: "RED REVENGE MISSILES", short: "REVENGE", kind: "missile",
    dmg: 13, interval: 4.5, speed: 410, life: 7, color: 0xff3a4a, size: 1.7,
    spread: 0.14, homing: 2.9, splash: 26, sound: "missile", fx: "red", revenge: true, burst: 2,
    desc: "Twin crimson seekers that automatically lock onto whoever last damaged your ship.",
  },
  swarm: {
    id: "swarm", name: "MISSILE SWARM LAUNCHER", short: "SWARM", kind: "missile",
    dmg: 6.5, interval: 2.2, speed: 390, life: 5.5, color: 0xffc24a, size: 1.3,
    spread: 0.3, homing: 2.6, splash: 14, sound: "missile", fx: "missile", burst: 5,
    desc: "Five guided micro-missiles fan out from your pods and converge on the locked enemy.",
  },
  missile: {
    id: "missile", name: "UNGUIDED ROCKETS", short: "ROCKET", kind: "missile",
    dmg: 11, interval: 0.52, speed: 590, life: 3.2, color: 0xffa04a, size: 1.65,
    spread: 0.004, splash: 30, sound: "missile", fx: "missile",
    desc: "High-velocity unguided rocket with a bright exhaust plume and heavy splash damage.",
  },
  intercept: {
    id: "intercept", name: "ANTI-MISSILE DEFENSES", short: "A-DEF", kind: "missile",
    dmg: 4, interval: 0.55, speed: 660, life: 2.0, color: 0xffeb8a, size: 1.0,
    spread: 0.18, homing: 7.5, sound: "missile", fx: "blue", burst: 3,
    desc: "Counter-missile salvo that automatically intercepts incoming enemy warheads and fighters.",
  },
  twin: {
    id: "twin", name: "TWIN ROCKET RACK", short: "TWIN", kind: "missile",
    dmg: 8, interval: 1.0, speed: 520, life: 3.2, color: 0xffb45a, size: 1.45,
    spread: 0.02, splash: 22, sound: "missile", fx: "missile", burst: 2,
    desc: "Two unguided rockets per salvo from separate hardpoints.",
  },
  energyMissile: {
    id: "energyMissile", name: "ION SEEKER", short: "ION", kind: "missile",
    dmg: 12, interval: 1.4, speed: 500, life: 5, color: 0x8ff6ff, size: 1.8,
    spread: 0, homing: 3.8, splash: 22, sound: "missile", fx: "blue",
    desc: "Fast seeker with a hard turn rate and a brilliant cyan trail.",
  },
  torpedo: {
    id: "torpedo", name: "HEAVY TORPEDO", short: "TORPEDO", kind: "missile",
    dmg: 55, interval: 4.5, speed: 240, life: 8, color: 0xff5a1a, size: 4.0,
    spread: 0, splash: 80, sound: "heavy", fx: "torpedo",
    desc: "Unguided capital-ship buster. Slow and devastating.",
  },

  // ---------------- DRONE WEAPONS & ULTIMATE ----------------
  droneLaser: {
    id: "droneLaser", name: "DRONE PULSE LASER", short: "D-LASER", kind: "energy",
    dmg: 2.5, interval: 0.28, speed: 1380, life: 1.0, color: 0x7dffe0, size: 1.0,
    spread: 0.007, shieldDmgMul: 1, sound: "rapid", fx: "blue",
    desc: "Light pulse laser fitted to Hunter & Guardian drones.",
  },
  dronePlasma: {
    id: "dronePlasma", name: "DRONE ASSAULT PLASMA", short: "D-PLASMA", kind: "energy",
    dmg: 4.2, interval: 0.38, speed: 1120, life: 1.2, color: 0xff7a3d, size: 1.4,
    spread: 0.008, shieldDmgMul: 1.25, sound: "plasma", fx: "red",
    desc: "Heavy plasma bolt fitted to Assault drones.",
  },
  droneIntercept: {
    id: "droneIntercept", name: "DRONE INTERCEPTOR DART", short: "D-INT", kind: "missile",
    dmg: 2.2, interval: 0.2, speed: 1650, life: 0.9, color: 0xffeb8a, size: 0.95,
    spread: 0.01, homing: 6.5, sound: "rapid", fx: "blue",
    desc: "Counter-munition dart fired by Interceptor drones.",
  },
  dronePrecision: {
    id: "dronePrecision", name: "DRONE RECON BEAM", short: "D-BEAM", kind: "energy",
    dmg: 3.0, interval: 0.34, speed: 1950, life: 1.1, color: 0x8ff6ff, size: 1.05,
    spread: 0.002, shieldDmgMul: 1.1, sound: "laser", fx: "blue",
    desc: "High-velocity recon beam fired by Scout drones.",
  },
  droneStealth: {
    id: "droneStealth", name: "DRONE PHASE LANCE", short: "D-LANCE", kind: "energy",
    dmg: 4.8, interval: 0.42, speed: 1800, life: 1.1, color: 0xc266ff, size: 1.25,
    spread: 0.003, shieldDmgMul: 1.2, sound: "laser", fx: "red",
    desc: "High-crit phase lance fired by Stealth drones.",
  },
  nova: {
    id: "nova", name: "SINGULARITY NOVA", short: "NOVA", kind: "ultimate",
    dmg: 16, interval: 22, speed: 0, life: 0, color: 0xffffff, size: 0,
    spread: 0, splash: 280, sound: "heavy", fx: "dark",
    desc: "ULTIMATE flux collapse.",
  },
};

export const PRIMARY_WEAPONS: WeaponId[] = [
  "laser",
  "rapid",
  "heavy_beam",
  "twin_laser",
  "red_plasma",
  "blue_repeater",
  "precision_beam",
  "heavy_plasma_launcher",
];

export const SECONDARY_WEAPONS: WeaponId[] = [
  "homing",
  "fast_interceptor",
  "charged",
  "revenge",
  "swarm",
  "missile",
  "intercept",
];

export const isGuided = (id: WeaponId) => (WEAPONS[id].homing ?? 0) > 0;
export const SPECIAL_WEAPONS: WeaponId[] = ["charged", "heavy_beam", "revenge", "swarm", "darkmatter", "curse", "intercept"];
export const ALL_WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export interface Loadout {
  primary: WeaponId;
  secondary: WeaponId;
  special: WeaponId;
  shieldMod: number;
  engineMod: number;
  armorMod: number;
}

export const DEFAULT_LOADOUT: Loadout = {
  primary: "laser", secondary: "homing", special: "charged", shieldMod: 1, engineMod: 1, armorMod: 1,
};

// ==================== COSMETIC PALETTES ====================

export interface Paint {
  hull: number;
  trim: number;
  engine: number;
  name: string;
  accent: number;
}

/** Includes all 10 requested hull colors: Black, Gunmetal, Silver, White, Red, Blue, Violet, Green, Gold, Cyan */
export const PAINTS: Paint[] = [
  { name: "SILVER",    hull: 0xc8d2dc, trim: 0x39424e, engine: 0x53e6ff, accent: 0x53e6ff },
  { name: "BLACK",     hull: 0x12151c, trim: 0x07090d, engine: 0x3fd4ff, accent: 0xff3a4a },
  { name: "GUNMETAL",  hull: 0x3a434e, trim: 0x1a2028, engine: 0x61d8ff, accent: 0x8fe8ff },
  { name: "WHITE",     hull: 0xebf3fa, trim: 0x4d6278, engine: 0x4fe3ff, accent: 0x38b6ff },
  { name: "RED",       hull: 0xc22f2f, trim: 0x2a0c0c, engine: 0xff7a3d, accent: 0xff3a4a },
  { name: "BLUE",      hull: 0x2664d4, trim: 0x0d1b33, engine: 0x61d8ff, accent: 0x61d8ff },
  { name: "VIOLET",    hull: 0x7236d4, trim: 0x1d0b36, engine: 0xc47bff, accent: 0xff57d2 },
  { name: "GREEN",     hull: 0x3eb854, trim: 0x102814, engine: 0xa8ff4d, accent: 0x7dffe0 },
  { name: "GOLD",      hull: 0xe0a526, trim: 0x2b1d05, engine: 0xffd34d, accent: 0xffb03d },
  { name: "CYAN",      hull: 0x2ac8d8, trim: 0x0c343d, engine: 0x8ff6ff, accent: 0x4fe3ff },
];

export interface ColorSwatch {
  name: string;
  color: number; // 0 = use weapon/paint default
}

export const ENGINE_COLORS: ColorSwatch[] = [
  { name: "DEFAULT", color: 0 },
  { name: "CYAN",    color: 0x4fe3ff },
  { name: "BLUE",    color: 0x3a88ff },
  { name: "VIOLET",  color: 0xb66bff },
  { name: "RED",     color: 0xff4a5a },
  { name: "GOLD",    color: 0xffc84a },
  { name: "GREEN",   color: 0x7dff6a },
  { name: "WHITE",   color: 0xeef8ff },
];

export const LASER_COLORS: ColorSwatch[] = [
  { name: "DEFAULT", color: 0 },
  { name: "CYAN",    color: 0x3fd4ff },
  { name: "BLUE",    color: 0x4f8fff },
  { name: "RED",     color: 0xff3a4a },
  { name: "VIOLET",  color: 0xc266ff },
  { name: "GREEN",   color: 0x7dff6a },
  { name: "GOLD",    color: 0xffd34d },
  { name: "WHITE",   color: 0xeef8ff },
];

export const TRAIL_COLORS: ColorSwatch[] = [
  { name: "DEFAULT", color: 0 },
  { name: "ION CYAN", color: 0x54e8ff },
  { name: "AMBER",   color: 0xffb04a },
  { name: "CRIMSON", color: 0xff3a4a },
  { name: "VIOLET",  color: 0xb66bff },
  { name: "EMERALD", color: 0x68ff9a },
  { name: "WHITE",   color: 0xf0f8ff },
];

// ==================== ARENAS & PLANETARY MAPS ====================

export interface PlanetaryConfig {
  kind: "nebula_frontier" | "stormworld";
  groundColor: number;
  rockColor: number;
  peakColor: number;
  waterLevel?: number;
  waterColor?: number;
  floatingIslands?: number;
  structures?: number;
  cloudColor: number;
  cloudAltitude: number;
  lightning?: boolean;
}

export interface ArenaConfig {
  id: string; name: string; tag: string; desc: string;
  bounds: number;
  starColor: number; starIntensity: number; starPos: [number, number, number];
  ambient: number; ambientColor: number;
  fogColor: number; fogDensity: number;
  nebulae: { color: number; count: number; size: number; opacity: number }[];
  galaxySprites: number; starCount: number; starHue: [number, number];
  belt?: { count: number; inner: number; outer: number; plane: boolean };
  blackhole?: { radius: number; disk: number; pos: [number, number, number] };
  sun?: { radius: number; color: number; pos: [number, number, number]; glow: number };
  planets?: {
    radius: number; color: number; band: number; pos: [number, number, number];
    ring?: { inner: number; outer: number; color: number };
    moons?: { radius: number; dist: number; color: number; speed: number }[];
    atmosphere?: number;
    storm?: boolean;
  }[];
  station?: boolean;
  dust?: number;
  sun2?: { radius: number; color: number; pos: [number, number, number]; glow: number };
  light2?: { color: number; intensity: number; pos: [number, number, number] };
  crystals?: { count: number; inner: number; outer: number; colors: number[] };
  pulsar?: { pos: [number, number, number]; radius: number; beamLength: number; color: number; spin: number };
  derelicts?: { count: number; spread: number };
  planetary?: PlanetaryConfig;
  tactical: string;
  capitalSlots?: number;
}

export const ARENAS: ArenaConfig[] = [
  // ---- NEW PLANETARY MAP A: NEBULA FRONTIER ----
  {
    id: "nebula_frontier",
    name: "NEBULA FRONTIER",
    tag: "PLANET",
    desc: "Fly over an alien world of towering mountains, deep canyon valleys, floating sky-islands, atmospheric cloud decks, and a glowing nebula sky.",
    bounds: 1750,
    starColor: 0xbfe8ff,
    starIntensity: 2.3,
    starPos: [1100, 950, -800],
    ambient: 0.62,
    ambientColor: 0x3b4d88,
    fogColor: 0x101832,
    fogDensity: 0.00018,
    nebulae: [
      { color: 0x8a3fd6, count: 22, size: 1550, opacity: 0.36 },
      { color: 0x2fd6e8, count: 18, size: 1400, opacity: 0.32 },
      { color: 0xff4fb0, count: 10, size: 1100, opacity: 0.24 },
    ],
    galaxySprites: 4,
    starCount: 8500,
    starHue: [0.5, 0.88],
    planets: [
      { radius: 220, color: 0x6a50d6, band: 0xa68cff, pos: [-1550, 920, -1650], atmosphere: 0x9f7bff, moons: [{ radius: 38, dist: 420, color: 0xd0c4f0, speed: 0.14 }] },
      { radius: 130, color: 0x3a9fb8, band: 0x7fe9ff, pos: [1650, 780, -1400], atmosphere: 0x7fe9ff },
    ],
    planetary: {
      kind: "nebula_frontier",
      groundColor: 0x24304c,
      rockColor: 0x4b3f72,
      peakColor: 0x7ae8ff,
      floatingIslands: 14,
      cloudColor: 0x7ec8ff,
      cloudAltitude: 230,
    },
    dust: 650,
    tactical: "Weave through canyon valleys and floating islands to break missile locks.",
    capitalSlots: 1,
  },
  // ---- NEW PLANETARY MAP B: STORMWORLD ----
  {
    id: "stormworld",
    name: "STORMWORLD",
    tag: "SURFACE",
    desc: "Planetary battlefield of wide plains, steep plateaus, rivers and ocean bays, storm clouds, and futuristic defense towers.",
    bounds: 1750,
    starColor: 0xffdfb8,
    starIntensity: 2.1,
    starPos: [-1200, 1050, 700],
    ambient: 0.56,
    ambientColor: 0x385062,
    fogColor: 0x0c1824,
    fogDensity: 0.00019,
    nebulae: [
      { color: 0x2f7ca8, count: 16, size: 1500, opacity: 0.26 },
      { color: 0xff9a4a, count: 10, size: 1200, opacity: 0.18 },
    ],
    galaxySprites: 2,
    starCount: 6500,
    starHue: [0.08, 0.6],
    planets: [
      { radius: 280, color: 0xc88a4b, band: 0xf0be86, pos: [1700, 980, 1450], ring: { inner: 360, outer: 560, color: 0xe6c89a }, atmosphere: 0xffc88a },
    ],
    planetary: {
      kind: "stormworld",
      groundColor: 0x2a3b36,
      rockColor: 0x4c5864,
      peakColor: 0x9cb0c2,
      waterLevel: -315,
      waterColor: 0x12486b,
      structures: 14,
      cloudColor: 0x8eaec4,
      cloudAltitude: 250,
      lightning: true,
    },
    dust: 600,
    tactical: "Skim the ocean rivers and use futuristic towers & plateaus as hard cover.",
    capitalSlots: 2,
  },
  {
    id: "nebula", name: "NEBULA ARENA", tag: "CLOUDS",
    desc: "Ionised violet storm clouds. Radar scrambles, ambushes thrive.",
    bounds: 1500, starColor: 0x8fa8ff, starIntensity: 1.5, starPos: [900, 500, 700],
    ambient: 0.55, ambientColor: 0x5a4a9c, fogColor: 0x160a33, fogDensity: 0.00022,
    nebulae: [
      { color: 0x7a2fd6, count: 26, size: 1500, opacity: 0.4 },
      { color: 0x2f7ad6, count: 20, size: 1300, opacity: 0.36 },
      { color: 0xff4fb0, count: 12, size: 1000, opacity: 0.26 },
      { color: 0x35f0e0, count: 8,  size: 800, opacity: 0.2 },
    ],
    galaxySprites: 5, starCount: 11000, starHue: [0.55, 0.85],
    planets: [{ radius: 150, color: 0x6a4bd6, band: 0x9d7bff, pos: [-1500, -260, -1700], atmosphere: 0x8f6bff, moons: [{ radius: 26, dist: 300, color: 0xbfaee0, speed: 0.16 }] }],
    dust: 900, tactical: "Low visibility — close-range brawls.", capitalSlots: 0,
  },
  {
    id: "belt", name: "ASTEROID BELT", tag: "ROCKS",
    desc: "A grinding river of rock. Fly tight, bait your enemies into the stone.",
    bounds: 1500, starColor: 0xfff0d0, starIntensity: 2.1, starPos: [-1200, 400, 900],
    ambient: 0.34, ambientColor: 0x4a4038, fogColor: 0x0a0906, fogDensity: 0.00012,
    nebulae: [{ color: 0x6b4a2a, count: 8, size: 1400, opacity: 0.2 }, { color: 0x2a4a6b, count: 10, size: 1600, opacity: 0.18 }],
    galaxySprites: 3, starCount: 9000, starHue: [0.06, 0.16],
    belt: { count: 620, inner: 260, outer: 1250, plane: true },
    planets: [{ radius: 260, color: 0xb07a3f, band: 0xd8a55f, pos: [1800, 400, -1400], atmosphere: 0xffc47a }],
    station: true, dust: 500, tactical: "Heavy cover — collision risk is lethal.", capitalSlots: 1,
  },
  {
    id: "blackhole", name: "BLACK HOLE ZONE", tag: "SINGULARITY",
    desc: "Gravity shears around an accretion disk. Drift too close and nothing escapes.",
    bounds: 1600, starColor: 0xffc07a, starIntensity: 2.6, starPos: [0, 120, 0],
    ambient: 0.28, ambientColor: 0x3a2a55, fogColor: 0x07040f, fogDensity: 0.00016,
    nebulae: [{ color: 0xff8a3d, count: 12, size: 1200, opacity: 0.3 }, { color: 0x6a2fd6, count: 14, size: 1500, opacity: 0.3 }],
    galaxySprites: 4, starCount: 10000, starHue: [0.02, 0.75],
    blackhole: { radius: 90, disk: 620, pos: [-1250, -140, -1150] },
    planets: [{ radius: 120, color: 0x4a4550, band: 0x6b6478, pos: [1500, -500, 900] }],
    dust: 700, tactical: "Gravity well pulls fighters inward.", capitalSlots: 1,
  },
  {
    id: "frozen", name: "FROZEN PLANET ORBIT", tag: "ICE",
    desc: "Glacial world under ring-shadow, patrolled by three frozen moons.",
    bounds: 1500, starColor: 0xd8f0ff, starIntensity: 2.4, starPos: [1100, 700, -600],
    ambient: 0.5, ambientColor: 0x6f8fb5, fogColor: 0x060c16, fogDensity: 0.0001,
    nebulae: [{ color: 0x3fa8ff, count: 12, size: 1400, opacity: 0.22 }, { color: 0xd6f0ff, count: 8, size: 1100, opacity: 0.16 }],
    galaxySprites: 4, starCount: 12000, starHue: [0.5, 0.62],
    planets: [
      { radius: 420, color: 0x9fc8e8, band: 0xe8f6ff, pos: [0, -520, -1300], ring: { inner: 560, outer: 900, color: 0xcfe8ff }, atmosphere: 0x9fe4ff, moons: [{ radius: 40, dist: 1150, color: 0xdfe9f2, speed: 0.1 }, { radius: 26, dist: 1450, color: 0xa8bccf, speed: -0.07 }] },
    ],
    dust: 400, tactical: "Ring debris gives long sightlines.", capitalSlots: 2,
  },
  {
    id: "redgiant", name: "RED GIANT SYSTEM", tag: "INFERNO",
    desc: "A dying star bleeds crimson across the battlefield. Silhouettes are everything.",
    bounds: 1500, starColor: 0xff6a3d, starIntensity: 3.2, starPos: [-1600, -300, 600],
    ambient: 0.32, ambientColor: 0x6b2a1a, fogColor: 0x1a0705, fogDensity: 0.00014,
    nebulae: [{ color: 0xff4a1a, count: 16, size: 1500, opacity: 0.3 }, { color: 0xffb03d, count: 8, size: 1000, opacity: 0.2 }],
    galaxySprites: 2, starCount: 8000, starHue: [0.0, 0.1],
    sun: { radius: 900, color: 0xff5a2a, pos: [-3200, -400, 1200], glow: 5200 },
    planets: [{ radius: 200, color: 0x8c3a22, band: 0xc05a30, pos: [1200, 300, -1500], atmosphere: 0xff7a4a }],
    belt: { count: 260, inner: 700, outer: 1300, plane: false },
    dust: 600, tactical: "Blinding star glare from the port side.", capitalSlots: 2,
  },
  {
    id: "deep", name: "DEEP SPACE ARENA", tag: "VOID",
    desc: "Pure void. Billions of stars, distant galaxies, and nowhere to hide.",
    bounds: 1700, starColor: 0xaac4ff, starIntensity: 1.7, starPos: [600, 900, 900],
    ambient: 0.24, ambientColor: 0x2a3355, fogColor: 0x02030a, fogDensity: 0.00006,
    nebulae: [{ color: 0x1a3a8c, count: 10, size: 1800, opacity: 0.2 }],
    galaxySprites: 9, starCount: 16000, starHue: [0.0, 1.0],
    planets: [{ radius: 90, color: 0x33406b, band: 0x4f6096, pos: [1900, 600, 1500] }],
    dust: 300, tactical: "Maximum visibility — snipers and cap-ships rule.", capitalSlots: 4,
  },
  {
    id: "frontier", name: "GALACTIC FRONTIER", tag: "EXPLORE",
    desc: "A contested system: wrecked station, twin worlds and a drifting belt.",
    bounds: 2200, starColor: 0xffe6c0, starIntensity: 2.2, starPos: [800, 1000, -1200],
    ambient: 0.42, ambientColor: 0x4a5578, fogColor: 0x05070f, fogDensity: 0.00008,
    nebulae: [{ color: 0x2fd6c8, count: 12, size: 1600, opacity: 0.22 }, { color: 0x7a4fd6, count: 14, size: 1700, opacity: 0.24 }],
    galaxySprites: 6, starCount: 13000, starHue: [0.4, 0.9],
    belt: { count: 380, inner: 500, outer: 1500, plane: true },
    station: true,
    planets: [
      { radius: 300, color: 0x3f8c6a, band: 0x6fd6a8, pos: [-1700, -300, -1500], atmosphere: 0x6fffc8, moons: [{ radius: 34, dist: 620, color: 0xc8d8d0, speed: 0.13 }] },
      { radius: 180, color: 0xb0763f, band: 0xd89f5f, pos: [1900, 500, 1400] },
    ],
    dust: 700, tactical: "Huge map — roam, resupply, hunt. Carriers spawn here.", capitalSlots: 3,
  },
  {
    id: "crystal", name: "CRYSTAL NEBULA", tag: "CRYSTAL",
    desc: "Luminous crystal spires grow through a teal nebula. Break line of sight, then strike.",
    bounds: 1500, starColor: 0x9ff6ff, starIntensity: 1.6, starPos: [700, 800, 500],
    ambient: 0.5, ambientColor: 0x2f6b78, fogColor: 0x041418, fogDensity: 0.00018,
    nebulae: [{ color: 0x1fd6c8, count: 22, size: 1500, opacity: 0.32 }, { color: 0xd63bd0, count: 12, size: 1100, opacity: 0.22 }],
    galaxySprites: 3, starCount: 10000, starHue: [0.45, 0.85],
    crystals: { count: 240, inner: 180, outer: 1300, colors: [0x4ff6ff, 0xd65bff, 0x7dffb0] },
    dust: 900, tactical: "Crystal spires break line of sight — perfect for ambushes.", capitalSlots: 1,
  },
  {
    id: "binary", name: "BINARY STAR CORONA", tag: "BINARY",
    desc: "Two suns — one blue-white, one amber — bathe the fight in crossing light.",
    bounds: 1600, starColor: 0xcfe6ff, starIntensity: 2.4, starPos: [1400, 300, -900],
    ambient: 0.3, ambientColor: 0x3a3048, fogColor: 0x0a0610, fogDensity: 0.00009,
    nebulae: [{ color: 0xff8a3d, count: 10, size: 1500, opacity: 0.22 }, { color: 0x4f8fff, count: 10, size: 1500, opacity: 0.22 }],
    galaxySprites: 3, starCount: 9000, starHue: [0.05, 0.62],
    sun: { radius: 520, color: 0xbfe0ff, pos: [3200, 600, -2000], glow: 3600 },
    sun2: { radius: 700, color: 0xffa04a, pos: [-3300, -500, 1900], glow: 4400 },
    light2: { color: 0xffa04a, intensity: 1.6, pos: [-1400, -300, 900] },
    belt: { count: 200, inner: 600, outer: 1400, plane: false },
    planets: [{ radius: 160, color: 0x5a4a6b, band: 0x8a6fa0, pos: [1500, -600, 1500], atmosphere: 0xb49fff }],
    dust: 500, tactical: "Twin light sources — no dark side to hide in.", capitalSlots: 2,
  },
  {
    id: "graveyard", name: "SHIPWRECK GRAVEYARD", tag: "WRECKS",
    desc: "The silent hulls of a lost armada drift in the dark. Tight corridors, perfect ambushes.",
    bounds: 1600, starColor: 0xd8e2ff, starIntensity: 1.5, starPos: [-600, 900, 700],
    ambient: 0.32, ambientColor: 0x34404f, fogColor: 0x05070c, fogDensity: 0.00014,
    nebulae: [{ color: 0x2a3f6b, count: 12, size: 1600, opacity: 0.22 }, { color: 0x6b2a2a, count: 6, size: 1200, opacity: 0.16 }],
    galaxySprites: 4, starCount: 11000, starHue: [0.55, 0.7],
    derelicts: { count: 9, spread: 1150 },
    belt: { count: 260, inner: 300, outer: 1350, plane: false },
    dust: 700, tactical: "Derelict hulls create corridors — use them as cover.", capitalSlots: 1,
  },
  {
    id: "gasgiant", name: "GAS GIANT STORM", tag: "STORM",
    desc: "A world-sized amber storm churns beneath you while the battle rages in its shadow.",
    bounds: 1500, starColor: 0xffe2b0, starIntensity: 2.2, starPos: [900, 1200, 400],
    ambient: 0.42, ambientColor: 0x5a4430, fogColor: 0x0d0805, fogDensity: 0.0001,
    nebulae: [{ color: 0xffb03d, count: 8, size: 1400, opacity: 0.16 }],
    galaxySprites: 3, starCount: 9000, starHue: [0.06, 0.14],
    planets: [
      { radius: 1650, color: 0xb0743f, band: 0xf0c48a, pos: [0, -3500, -900], storm: true,
        ring: { inner: 2050, outer: 2900, color: 0xe8c89a }, atmosphere: 0xffc47a,
        moons: [{ radius: 60, dist: 2600, color: 0xcfc0a8, speed: 0.06 }] },
    ],
    belt: { count: 240, inner: 500, outer: 1350, plane: true },
    dust: 500, tactical: "Ring debris gives cover low in the arena.", capitalSlots: 2,
  },
  {
    id: "pulsar", name: "PULSAR RIFT", tag: "PULSAR",
    desc: "A spinning neutron star sweeps searing beams across a shattered system.",
    bounds: 1600, starColor: 0xb8d8ff, starIntensity: 1.4, starPos: [0, 600, -1400],
    ambient: 0.26, ambientColor: 0x24304f, fogColor: 0x03040b, fogDensity: 0.00008,
    nebulae: [{ color: 0x3f5fff, count: 14, size: 1700, opacity: 0.26 }, { color: 0x9d4fff, count: 8, size: 1200, opacity: 0.2 }],
    galaxySprites: 6, starCount: 14000, starHue: [0.55, 0.75],
    pulsar: { pos: [0, 220, -1900], radius: 38, beamLength: 5200, color: 0x9fd8ff, spin: 0.55 },
    belt: { count: 220, inner: 400, outer: 1400, plane: false },
    dust: 450, tactical: "Rhythmic beam sweeps light up every silhouette.", capitalSlots: 2,
  },
];

export const ARENA_BY_ID = Object.fromEntries(ARENAS.map((a) => [a.id, a])) as Record<string, ArenaConfig>;

export type Difficulty = "easy" | "normal" | "hard" | "expert";

export const DIFFICULTIES: Record<Difficulty, { name: string; aim: number; react: number; aggro: number; dodge: number; desc: string }> = {
  easy:   { name: "EASY",   aim: 0.085, react: 0.9,  aggro: 0.55, dodge: 0.15, desc: "Sloppy aim, slow reactions." },
  normal: { name: "NORMAL", aim: 0.045, react: 0.55, aggro: 0.75, dodge: 0.4,  desc: "A fair frontier fight." },
  hard:   { name: "HARD",   aim: 0.022, react: 0.32, aggro: 0.95, dodge: 0.7,  desc: "They lead their shots and dodge." },
  expert: { name: "EXPERT", aim: 0.009, react: 0.16, aggro: 1.15, dodge: 0.95, desc: "Ace pilots. Coordinated and ruthless." },
};

export type MissionModeId = "defend" | "escort" | "capkill" | "intercept" | "survive" | "assault" | "duel" | "war" | "free";

export const MODES = {
  practice: { id: "practice", name: "SOLO PRACTICE",   desc: "Endless waves of AI hunters. Chase a high score.", size: 1, team: false, time: 0 },
  duel:     { id: "duel",     name: "1v1 DUEL",        desc: "You versus one ace. First kill wins the match.", size: 1, team: false, time: 420 },
  wing:     { id: "wing",     name: "2v2 WING BATTLE", desc: "Two-ship wing combat: you and a wingman versus two enemy aces.", size: 2, team: true, time: 450 },
  team:     { id: "team",     name: "5v5 TEAM BATTLE", desc: "Blue versus Red. Wipe the five-ship enemy squadron to win.", size: 5, team: true, time: 480 },
  free:     { id: "free",     name: "FREE ROAM GALAXY", desc: "No rules, no timer. Explore planetary terrain & space.", size: 0, team: false, time: 0 },
} as const;

export type ModeId = keyof typeof MODES;

export const AI_NAMES = [
  "VIPER","ORION","KESSLER","NYX","HALCYON","DRACO","ECHO","RAVEN","SOLARIS","TITAN",
  "WRAITH","ATLAS","LYRA","OBELISK","QUASAR","TALON","VEGA","CINDER","NOMAD","ZENITH",
];

export interface GameSettings {
  sensitivity: number;
  invertY: boolean;
  volume: number;
  music: number;
  quality: "low" | "medium" | "high";
  shake: number;
  showFps: boolean;
  autoLock: boolean;
  playerName: string;
  difficulty: Difficulty;
  arenaId: string;
  capital: boolean;
  /** Deprecated numeric drone count; actual drone spawning is strictly governed by ShipConfig.equippedDrone */
  drones: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1, invertY: false, volume: 0.7, music: 0.45,
  quality: "high", shake: 1, showFps: true, autoLock: true,
  playerName: "PILOT-01", difficulty: "normal", arenaId: "nebula_frontier", capital: true, drones: 0,
};

export interface ShipConfig {
  classId: ShipClassId;
  paintIndex: number;
  engineColorIndex?: number;
  laserColorIndex?: number;
  trailColorIndex?: number;
  /** Strictly controls whether a drone spawns: null/undefined = NO drone may spawn */
  equippedDrone?: DroneTypeId | null;
  loadout: Loadout;
}

export const DEFAULT_SHIP: ShipConfig = {
  classId: "nova",
  paintIndex: 0,
  engineColorIndex: 0,
  laserColorIndex: 0,
  trailColorIndex: 0,
  equippedDrone: null,
  loadout: { ...DEFAULT_LOADOUT },
};


// ==================== COIN ECONOMY & SHOP CATALOG ====================
/* Persistent player profile. Coins are the single currency; there is no
 * premium currency and every purchasable item is capped at 168 coins. */

export interface PlayerProfile {
  /** Current spendable balance. New profiles start with exactly 10,000. */
  coins: number;
  ownedShips: ShipClassId[];
  ownedDrones: DroneTypeId[];
  /** Weapon unlocks (usable in any of the three loadout slots). */
  ownedWeapons: WeaponId[];
  /** Cosmetic unlocks are stored as their catalogue index. */
  ownedPaints: number[];
  ownedEngineColors: number[];
  ownedLaserColors: number[];
  ownedTrailColors: number[];
  /** One-time starting-grant marker: 1 means the 10,000 has already been issued. */
  grantSeed: number;
  stats: { matches: number; wins: number; kills: number; coinsEarned: number };
}

export const STARTING_COINS = 10_000;
export const MAX_ITEM_PRICE = 168;
export const STARTER_WEAPONS: WeaponId[] = ["laser", "homing", "charged", "missile"];

export const DEFAULT_PROFILE: PlayerProfile = {
  coins: STARTING_COINS,
  ownedShips: ["nova", "phantom", "viper"],
  ownedDrones: ["hunter"],
  ownedWeapons: [...STARTER_WEAPONS],
  ownedPaints: [0],
  ownedEngineColors: [0],
  ownedLaserColors: [0],
  ownedTrailColors: [0],
  grantSeed: 1,
  stats: { matches: 0, wins: 0, kills: 0, coinsEarned: 0 },
};

export interface ShopEntry { id: string; name: string; price: number; category: "weapon" | "paint" | "engine" | "laser" | "trail"; ref: string | number; desc: string }

export const WEAPON_PRICES: Record<string, number> = {
  laser: 0, homing: 0, charged: 0, missile: 0,
  rapid: 25, twin_laser: 35, red_plasma: 45, blue_repeater: 50,
  heavy_beam: 60, precision_beam: 65, heavy_plasma_launcher: 80,
  fast_interceptor: 40, swarm: 55, revenge: 65, intercept: 45,
  darkmatter: 75, curse: 60, bolt: 30, plasma: 40, heavy: 55, twin: 40, torpedo: 80, energyMissile: 70,
};

export const WEAPON_SHOP: WeaponId[] = [
  "laser", "rapid", "heavy_beam", "twin_laser", "red_plasma", "blue_repeater", "precision_beam", "heavy_plasma_launcher",
  "homing", "fast_interceptor", "missile", "swarm", "charged", "revenge", "intercept", "darkmatter", "curse",
];

export const PAINT_PRICES: number[] = [0, 10, 8, 12, 15, 15, 25, 25, 35, 35];
export const ENGINE_COLOR_PRICES: number[] = [0, 15, 18, 25, 30, 30, 25, 35];
export const LASER_COLOR_PRICES: number[] = [0, 15, 20, 25, 35, 30, 30, 40];
export const TRAIL_COLOR_PRICES: number[] = [0, 15, 20, 25, 30, 25, 35];

/** Reward bounds for a genuinely completed match. */
export const REWARD_WIN_MIN = 50;
export const REWARD_WIN_MAX = 70;
export const REWARD_LOSS_MIN = 30;
export const REWARD_LOSS_MAX = 50;
export const REWARD_WIN_MVP = 100;

/** Guarantees no catalogue price can exceed the 168-coin cap. */
export const SHOP_AUDIT: ShopEntry[] = [
  ...FIGHTER_ROSTER.map((id) => ({ id: `ship:${id}`, name: SHIP_CLASSES[id].name, price: SHIP_CLASSES[id].price, category: "weapon" as const, ref: id, desc: "Hull unlock" })),
  ...DRONE_ORDER.map((id) => ({ id: `drone:${id}`, name: DRONE_TYPES[id].name, price: DRONE_TYPES[id].price, category: "weapon" as const, ref: id, desc: "Drone unlock" })),
  ...WEAPON_SHOP.map((id) => ({ id: `weapon:${id}`, name: WEAPONS[id].name, price: WEAPON_PRICES[id] ?? 0, category: "weapon" as const, ref: id, desc: WEAPONS[id].short })),
  ...PAINTS.map((pt, i) => ({ id: `paint:${i}`, name: `${pt.name} HULL`, price: PAINT_PRICES[i] ?? 0, category: "paint" as const, ref: i, desc: "Hull paint" })),
  ...ENGINE_COLORS.map((c, i) => ({ id: `engine:${i}`, name: `${c.name} ENGINE`, price: ENGINE_COLOR_PRICES[i] ?? 0, category: "engine" as const, ref: i, desc: "Engine glow" })),
  ...LASER_COLORS.map((c, i) => ({ id: `laser:${i}`, name: `${c.name} LASER`, price: LASER_COLOR_PRICES[i] ?? 0, category: "laser" as const, ref: i, desc: "Laser color" })),
  ...TRAIL_COLORS.map((c, i) => ({ id: `trail:${i}`, name: `${c.name} TRAIL`, price: TRAIL_COLOR_PRICES[i] ?? 0, category: "trail" as const, ref: i, desc: "Missile trail" })),
];
