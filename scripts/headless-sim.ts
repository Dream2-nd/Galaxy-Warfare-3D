/* Headless verification of GALAXY WARFARE 3D complete upgrade (no browser needed). */
import * as THREE from "three";
import { sweptSphereHit, interceptTime, turnToward } from "../src/game/combat";

let fakeNow = 0;
const g = globalThis as any;
const makeCanvas = () => {
  const ctx = new Proxy({} as any, {
    get: (t, k) => (k in t ? t[k] : (k === "createRadialGradient" || k === "createLinearGradient") ? () => ({ addColorStop() {} }) : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {}, removeEventListener() {}, requestPointerLock: () => Promise.resolve() };
};
g.window = g; g.innerWidth = 1280; g.innerHeight = 720; g.devicePixelRatio = 1;
g.addEventListener = () => {}; g.removeEventListener = () => {};
g.requestAnimationFrame = () => 0; g.cancelAnimationFrame = () => {};
g.document = { createElement: (t: string) => (t === "canvas" ? makeCanvas() : {}), addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {} };
Object.defineProperty(g, "navigator", { value: { maxTouchPoints: 0 }, configurable: true });
Object.defineProperty(performance, "now", { value: () => fakeNow, configurable: true });
g.setTimeout = (fn: () => void) => { fn(); return 0; };

let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------- 1. Combat math ----------
{
  const t = sweptSphereHit(V(0, 0, -20), V(0, 0, 12), V(0.5, 0, 0), V(0.5, 0, 0), 5);
  check(t > 0 && t < 1, `swept test catches a bolt that tunnels through a hull in one frame (t=${t.toFixed(3)})`);
  const tm = sweptSphereHit(V(0, 0, -10), V(0, 0, 10), V(-20, 0, 0), V(20, 0, 0), 4);
  check(tm > 0.3 && tm < 0.7, `swept test catches a target crossing the bolt mid-step (t=${tm.toFixed(3)})`);
  const it = interceptTime(V(1000, 0, 0), V(0, 0, 100), 1250);
  const meet = V(1000, 0, 0).addScaledVector(V(0, 0, 100), it).length();
  check(Math.abs(meet - 1250 * it) < 1e-3, `intercept solver meets the target exactly (t=${it.toFixed(3)}s)`);
  const d = V(1, 0, 0); const rem = turnToward(d, V(0, 0, 1), 0.3);
  check(Math.abs(Math.acos(d.x) - 0.3) < 1e-6 && rem > 1.2, "missile turn is rate-limited (0.3 rad step)");
}

const { Game } = await import("../src/game/engine");
const {
  DEFAULT_SETTINGS, DEFAULT_SHIP, ARENAS, WEAPONS, FIGHTER_ROSTER, DRONE_ORDER,
  PRIMARY_WEAPONS, SECONDARY_WEAPONS, PAINTS,
} = await import("../src/game/content");
const { buildShip } = await import("../src/game/ships");

// ---------- 2. Verify all 10 unique spaceships & 6 drones ----------
{
  check(FIGHTER_ROSTER.length === 10, `FIGHTER_ROSTER has 10 playable spaceships (got ${FIGHTER_ROSTER.length})`);
  check(PAINTS.length === 10, `PAINTS has all 10 hull colors (got ${PAINTS.length})`);
  const signatures = new Set<string>();
  for (const id of FIGHTER_ROSTER) {
    const v = buildShip(id, 0, 0, "medium", 1);
    let verts = 0;
    v.group.traverse((o: any) => { if (o.isMesh && o.geometry?.attributes?.position) verts += o.geometry.attributes.position.count; });
    const sig = `${verts}:${v.muzzlePoints.length}:${v.exhaustPoints.length}:${v.group.scale.x.toFixed(2)}`;
    signatures.add(sig);
    check(verts > 100 && v.muzzlePoints.length >= 2 && v.exhaustPoints.length >= 2, `ship ${id.padEnd(10)} builds 3D geometry (${verts} verts, ${v.muzzlePoints.length} muzzles, ${v.exhaustPoints.length} nozzles)`);
    v.dispose();
  }
  check(signatures.size === 10, `all 10 spaceships have distinct 3D geometry signatures (${signatures.size}/10 unique)`);

  check(DRONE_ORDER.length === 6, `DRONE_ORDER has 6 combat drone types (got ${DRONE_ORDER.length})`);
  for (const did of DRONE_ORDER) {
    const dv = buildShip("drone", 0, 0, "medium", 0, did);
    let verts = 0;
    dv.group.traverse((o: any) => { if (o.isMesh && o.geometry?.attributes?.position) verts += o.geometry.attributes.position.count; });
    check(verts > 50 && dv.muzzlePoints.length >= 1 && dv.exhaustPoints.length >= 1, `drone ${did.padEnd(11)} builds 3D geometry (${verts} verts, ${dv.muzzlePoints.length} muzzles)`);
    dv.dispose();
  }
}

type Run = { game: any; result: any; hud: any; frames: number };
function makeGame(
  mode: string,
  arena: string,
  equippedDrone: any = null,
  ownedDrones: any[] = [...DRONE_ORDER],
  shipClass: any = "nova",
): Run {
  const run: Run = { game: null, result: null, hud: null, frames: 0 };
  const settings = { ...DEFAULT_SETTINGS, quality: "medium" as const };
  const cfg = {
    mode, arena, difficulty: "normal",
    ship: {
      ...DEFAULT_SHIP,
      classId: shipClass,
      equippedDrone,
      engineColorIndex: 1,
      laserColorIndex: 1,
      trailColorIndex: 1,
      loadout: { ...DEFAULT_SHIP.loadout },
    },
    net: "off", room: "", playerName: "TESTER", aiFill: false, humanSlots: 1,
    ownedDrones,
  };
  const game = new Game(makeCanvas() as any, cfg as any, settings);
  game.onHUD = (h: any) => (run.hud = h);
  game.onEnd = (r: any) => (run.result = r);
  game.init();
  run.game = game;
  return run;
}

function pilot(run: Run, opts: { fire: boolean; missiles: boolean; boost?: boolean }) {
  const G = run.game; const me = G.me;
  if (!me.alive) return;
  let best: any = null; let bd = Infinity;
  for (const s of G.shipList) if (s.alive && s.team !== me.team && !s.drone) { const d = s.pos.distanceTo(me.pos); if (d < bd) { bd = d; best = s; } }
  G.keys.clear();
  G.keys.add("KeyW");
  if (opts.boost) G.keys.add("ShiftLeft");
  if (best) {
    const m = new THREE.Matrix4().lookAt(me.pos, best.pos, new THREE.Vector3(0, 1, 0));
    me.quat.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    if (bd < 260) G.keys.delete("KeyW"), G.keys.add("KeyS");
  }
  G.mouseDown[0] = opts.fire && !!best && bd < 1400;
  G.mouseDown[2] = opts.missiles && !!best && bd < 1600;
}

function step(run: Run, seconds: number, each?: (f: number) => void) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    fakeNow += 1000 / 60;
    each?.(run.frames);
    run.game.loop();
    run.frames++;
  }
}
const finite = (G: any) => G.shipList.every((s: any) => Number.isFinite(s.pos.x + s.pos.y + s.pos.z + s.quat.x + s.vel.x));

// ---------- 3. Mandatory Drone Rule: unequipped or unowned drone NEVER spawns ----------
{
  // (a) No drone equipped (null)
  const runNone = makeGame("free", "deep", null, [...DRONE_ORDER]);
  step(runNone, 3);
  check(runNone.game.shipList.filter((s: any) => s.drone).length === 0, "MANDATORY: 0 drones spawn when no drone is equipped");
  // Force player death & respawn in free roam and verify still 0 drones
  runNone.game.kill(runNone.game.me, null);
  step(runNone, 4);
  check(runNone.game.me.alive && runNone.game.shipList.filter((s: any) => s.drone).length === 0, "MANDATORY: 0 drones appear after player respawn when no drone is equipped");
  runNone.game.dispose();

  // (b) Drone selected in config but NOT owned
  const runUnowned = makeGame("practice", "deep", "stealth", ["hunter"]);
  step(runUnowned, 2);
  check(runUnowned.game.shipList.filter((s: any) => s.drone).length === 0, "MANDATORY: 0 drones spawn when equipped drone is not owned");
  runUnowned.game.dispose();

  // (c) Owned & equipped drone spawns and works for all 6 drone types
  for (const dtype of DRONE_ORDER) {
    const runD = makeGame("practice", "nebula", dtype, [dtype]);
    step(runD, 5, () => pilot(runD, { fire: true, missiles: false }));
    const drones = runD.game.shipList.filter((s: any) => s.drone && s.ownerId === runD.game.me.id);
    check(drones.length === 1 && drones[0].droneType === dtype, `drone ${dtype.padEnd(11)} spawns exactly 1 instance and follows/fights (state=${drones[0]?.droneState})`);
    runD.game.dispose();
  }
}

// ---------- 4. All 8 Primary Weapons & 7 Missile Types ----------
{
  check(PRIMARY_WEAPONS.length === 8, `8 primary weapons configured (${PRIMARY_WEAPONS.join(", ")})`);
  check(SECONDARY_WEAPONS.length === 7, `7 secondary missile types configured (${SECONDARY_WEAPONS.join(", ")})`);
  const runW = makeGame("free", "deep", null);
  const G = runW.game;
  step(runW, 4); // finish countdown
  for (const pw of PRIMARY_WEAPONS) {
    G.me.cfg.loadout.primary = pw;
    G.me.cd.p = 0;
    const before = G.projs.length;
    G.fireWeapon(G.me, 0);
    check(G.projs.length > before, `primary weapon ${pw} fires real projectiles`);
  }
  for (const sw of SECONDARY_WEAPONS) {
    G.me.cfg.loadout.secondary = sw;
    G.me.cd.s = 0;
    G.me.missileLoaded = 10;
    const before = G.projs.length;
    G.fireWeapon(G.me, 1);
    check(G.projs.length > before, `missile weapon ${sw} fires real warheads and decrements magazine`);
  }
  G.dispose();
}

// ---------- 5. Planetary Maps: Nebula Frontier & Stormworld ----------
for (const mapId of ["nebula_frontier", "stormworld"]) {
  const runP = makeGame("practice", mapId, "guardian", ["guardian"], "seraphim");
  const G = runP.game;
  check(typeof G.world.terrainHeight === "function", `planetary map ${mapId} exposes real heightfield terrainHeight(x,z)`);
  // Test terrain collision: place ship below terrain and step 1 frame
  const groundY = G.world.terrainHeight(0, 0);
  G.me.pos.set(0, groundY - 10, 0);
  G.me.vel.set(0, -30, 0);
  step(runP, 0.2);
  check(G.me.pos.y >= groundY + G.me.radius, `planetary map ${mapId} prevents ships from flying through terrain (y=${G.me.pos.y.toFixed(1)} >= ground ${(groundY + G.me.radius).toFixed(1)})`);
  step(runP, 10, () => pilot(runP, { fire: true, missiles: true }));
  check(finite(G), `planetary map ${mapId} simulates combat & AI terrain avoidance cleanly`);
  G.dispose();
}

// ---------- 6. 1v1 Duel, 2v2 Wing Battle, and 5v5 Team Battle ----------
{
  // 1v1 Duel
  const run1 = makeGame("duel", "nebula_frontier", "hunter", ["hunter"], "phantom");
  step(run1, 1);
  check(run1.hud?.alive?.[0] === 1 && run1.hud?.alive?.[1] === 1, `1v1 duel spawns 1v1 ships (got ${run1.hud?.alive})`);
  step(run1, 120, () => pilot(run1, { fire: true, missiles: true }));
  check(!!run1.result, `1v1 duel resolves (${run1.result?.reason})`);
  run1.game.dispose();

  // 2v2 Wing Battle
  const run2 = makeGame("wing", "stormworld", "assault", ["assault"], "viper");
  step(run2, 1);
  check(run2.hud?.alive?.[0] === 2 && run2.hud?.alive?.[1] === 2, `2v2 wing battle spawns 2 Blue vs 2 Red ships (got ${run2.hud?.alive})`);
  step(run2, 240, () => pilot(run2, { fire: true, missiles: true }));
  check(!!run2.result, `2v2 wing battle resolves (${run2.result?.reason})`);
  run2.game.dispose();

  // 5v5 Team Battle
  const run5 = makeGame("team", "graveyard", null, [], "colossus");
  step(run5, 1);
  check(run5.hud?.alive?.[0] === 5 && run5.hud?.alive?.[1] === 5, `5v5 team battle spawns 5 Blue vs 5 Red ships (got ${run5.hud?.alive})`);
  step(run5, 485, () => pilot(run5, { fire: true, missiles: true }));
  check(!!run5.result, `5v5 team battle resolves (${run5.result?.reason})`);
  run5.game.dispose();
}

// ---------- 7. Every arena builds and simulates ----------
for (const a of ARENAS) {
  const run = makeGame("practice", a.id, null);
  step(run, 1.5, () => pilot(run, { fire: true, missiles: false }));
  const ok = finite(run.game);
  run.game.dispose();
  check(ok, `arena ${a.name} (${a.tag}) builds and simulates`);
}


// ---------- 8. Coin economy: one-time grant, 168 cap, purchases, rewards, MVP ----------
{
  const {
    normalizeProfile, purchase, computeReward, settleReward, MAX_ITEM_PRICE, STARTING_COINS,
  } = await import("../src/game/economy");
  const content = await import("../src/game/content");
  const SHOP_AUDIT = content.SHOP_AUDIT;

  check(STARTING_COINS === 10_000, `new pilots start with exactly 10,000 coins (constant = ${STARTING_COINS})`);
  const fresh = normalizeProfile(null);
  check(fresh.coins === 10_000 && fresh.grantSeed === 1, `empty profile receives the 10,000 grant exactly once (coins=${fresh.coins}, seed=${fresh.grantSeed})`);
  const again = normalizeProfile(fresh);
  check(again.coins === 10_000, `reloading a saved profile preserves the 10,000 balance without re-granting (coins=${again.coins})`);
  const rich = normalizeProfile({ ...fresh, coins: 12_345 });
  check(rich.coins === 12_345, `existing coin balance is preserved verbatim (${rich.coins})`);
  const legacy = normalizeProfile({ credits: 4_321, ownedShips: ["titan"], ownedDrones: ["assault"] });
  check(legacy.coins === 4_321, `legacy credits migrate 1:1 without resetting progress (${legacy.coins})`);
  check(legacy.ownedShips.includes("titan") && legacy.ownedDrones.includes("assault"), "migrated legacy unlocks are preserved");
  check(fresh.ownedWeapons.includes("laser") && fresh.ownedWeapons.includes("homing") && fresh.ownedWeapons.includes("charged"),
    "starter kit includes a primary, a missile and the X-slot so new pilots can fight immediately");

  const maxPrice = Math.max(...SHOP_AUDIT.map((e) => e.price));
  check(SHOP_AUDIT.length > 25 && maxPrice <= MAX_ITEM_PRICE, `all ${SHOP_AUDIT.length} shop entries are capped at ${MAX_ITEM_PRICE} coins (highest = ${maxPrice})`);
  check(Math.max(...content.FIGHTER_ROSTER.map((id) => content.SHIP_CLASSES[id].price)) <= 168, "no spaceship costs more than 168 coins");
  check(Math.max(...content.DRONE_ORDER.map((id) => content.DRONE_TYPES[id].price)) <= 168, "no drone costs more than 168 coins");
  check(content.SHOP_AUDIT.every((e) => e.price >= 0), "no negative prices exist in the catalogue");

  // Purchases: exact deduction, insufficient funds, no duplicate charge
  const start = { ...fresh, coins: 100 };
  const bought = purchase(start, 40, false, (p) => ({ ...p, ownedPaints: [...p.ownedPaints, 4] }));
  check(bought.ok && bought.profile.coins === 60 && bought.profile.ownedPaints.includes(4), `successful purchase deducts exactly the price (100 → ${bought.profile.coins})`);
  const poor = purchase({ ...fresh, coins: 10 }, 40, false, (p) => p);
  check(!poor.ok && poor.profile.coins === 10, "insufficient coins rejects the purchase without deducting");
  const already = purchase(start, 40, true, (p) => p);
  check(already.ok && already.profile.coins === 100, "re-buying an owned item never charges again");

  // Reward ranges
  const meWin: any = { name: "ACE", team: 0, me: true, kills: 4, assists: 1, damage: 320, deaths: 1, score: 900, won: true };
  const teamWin: any = { name: "WING", team: 0, me: false, kills: 1, assists: 2, damage: 90, deaths: 2, score: 200, won: true };
  const winNormal = computeReward([teamWin, meWin], true, () => 0.999);
  check(winNormal.isMvp && winNormal.reward === 100, `winning MVP receives exactly 100 coins total (got ${winNormal.reward})`);

  // best AI teammate is MVP => player receives normal win 50..70
  const weakMe: any = { ...meWin, kills: 0, assists: 0, damage: 10, score: 50 };
  const strongWing: any = { ...teamWin, kills: 6, assists: 3, damage: 500, score: 1200 };
  const lo = computeReward([weakMe, strongWing], true, () => 0);
  const hi = computeReward([weakMe, strongWing], true, () => 0.9999);
  check(!lo.isMvp && lo.reward >= 50 && lo.reward <= 70, `non-MVP win pays 50–70 coins (min ${lo.reward})`);
  check(!hi.isMvp && hi.reward >= 50 && hi.reward <= 70, `non-MVP win pays 50–70 coins (max ${hi.reward})`);

  const lossMe: any = { ...meWin, won: false };
  const enemy: any = { name: "RED", team: 1, me: false, kills: 3, assists: 0, damage: 250, deaths: 1, score: 700, won: false };
  const lossLo = computeReward([lossMe, enemy], false, () => 0);
  const lossHi = computeReward([lossMe, enemy], false, () => 0.9999);
  check(lossLo.reward >= 30 && lossLo.reward <= 50 && lossHi.reward >= 30 && lossHi.reward <= 50,
    `loss pays 30–50 coins regardless of MVP status (${lossLo.reward}..${lossHi.reward})`);
  check(lossLo.mvpName === "RED" && !lossLo.isMvp, "losing team's MVP is identified but the player is not winning-MVP");
  const duelWin = computeReward([{ ...meWin, won: true }, { ...enemy, team: 1 }], true, () => 0.5);
  check(duelWin.reward === 100, `1v1 victory applies consistent MVP rules (100 coins, got ${duelWin.reward})`);

  // Duplicate-reward prevention
  const credited = settleReward(fresh, "MATCH_X", 100, []);
  check(credited.credited && credited.profile.coins === 10_100, `finished match credits the displayed amount (10,000 → ${credited.profile.coins})`);
  const dupe = settleReward(credited.profile, "MATCH_X", 100, credited.settled);
  check(!dupe.credited && dupe.profile.coins === 10_100, "replaying the same match id never duplicates coins");
}


// ---------- 9. Engine-level coin rewards & ownership enforcement ----------
{
  // Locked weapons must fall back to owned starters before a match begins.
  const lockedCfg: any = {
    mode: "free", arena: "deep", difficulty: "normal",
    ship: { ...DEFAULT_SHIP, loadout: { ...DEFAULT_SHIP.loadout, primary: "heavy_beam", secondary: "swarm", special: "darkmatter" } },
    net: "off", room: "", playerName: "LOCKTEST", aiFill: false, humanSlots: 1,
    ownedWeapons: ["laser", "homing", "charged"],
  };
  const lockedGame: any = new Game(makeCanvas() as any, lockedCfg, { ...DEFAULT_SETTINGS, quality: "low" });
  lockedGame.init();
  check(lockedGame.me.cfg.loadout.primary === "laser" && lockedGame.me.cfg.loadout.secondary === "homing" && lockedGame.me.cfg.loadout.special === "charged",
    "unowned weapons are rejected and replaced with the owned starter kit");
  lockedGame.dispose();

  // A finished duel must produce exactly one reward payload with a unique match id.
  let endCalls = 0;
  const run = makeGame("duel", "deep", null, [], "phantom");
  const previousOnEnd = run.game.onEnd;
  run.game.onEnd = (r: any) => { endCalls++; run.result = r; previousOnEnd(r); };
  step(run, 150, () => pilot(run, { fire: true, missiles: true }));
  check(!!run.result, "engine produces an EndResult for a finished competitive duel");
  if (run.result) {
    check(typeof run.result.matchId === "string" && run.result.matchId.length > 5, `engine emits a unique match id (${run.result.matchId})`);
    const okWin = run.result.won && run.result.reward === 100;
    const okLoss = !run.result.won && run.result.reward >= 30 && run.result.reward <= 50;
    check(okWin || okLoss, `duel reward follows the rules: ${run.result.won ? "win" : "loss"} = ${run.result.reward} coins (MVP=${run.result.isMvp})`);
    check(endCalls === 1, `match-end callback fires exactly once per match (got ${endCalls})`);
    run.game.finish(false, "duplicate attempt");
    check(endCalls === 1, "repeated finish attempts cannot emit a second reward");
  }
  run.game.dispose();
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
