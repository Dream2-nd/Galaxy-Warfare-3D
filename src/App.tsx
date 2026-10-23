import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type EndResult, type HUDState, type MatchConfig } from "@/game/engine";
import { audio } from "@/game/audio";
import {
  DEFAULT_SETTINGS, DEFAULT_SHIP, MODES, ARENAS, FIGHTER_ORDER, DRONE_ORDER,
  type Difficulty, type GameSettings, type ModeId, type PlayerProfile, type ShipConfig, type WeaponId,
} from "@/game/content";
import { normalizeProfile, settleReward } from "@/game/economy";
import { ProfileSyncBus, type NetRole } from "@/game/net";
import { HangarScreen, LobbyScreen, MainMenu, type ScoreRow } from "@/ui/Screens";
import { PauseOverlay, ResultsScreen } from "@/ui/Overlays";
import { HUD } from "@/ui/HUD";
import { TouchControls } from "@/ui/Touch";

type Screen = "boot" | "menu" | "hangar" | "lobby" | "game";

const LS = {
  settings: "gw3d.settings.v1",
  ship: "gw3d.ship.v1",
  profile: "gw3d.profile.v1",
  settled: "gw3d.settledMatches.v1",
  scores: "gw3d.scores.v1",
  prefs: "gw3d.prefs.v1",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...(fallback as object), ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}
function loadRaw<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [hangarTab, setHangarTab] = useState<"ships" | "drones" | "armory" | "cosmetics">("ships");
  const [lobbyMode, setLobbyMode] = useState<"duel" | "wing" | "team">("duel");
  const [settings, setSettings] = useState<GameSettings>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(LS.settings) : null;
    const s = { ...load(LS.settings, DEFAULT_SETTINGS) };
    if (!stored) {
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const small = Math.min(window.innerWidth, window.innerHeight) < 700;
      if (coarse || small) s.quality = "medium";
    }
    return s;
  });
  const [isCoarse, setIsCoarse] = useState(false);
  const [, forceRender] = useState(0);

  /** New pilots receive exactly 10,000 coins once; existing balances are preserved. */
  const [profile, setProfileState] = useState<PlayerProfile>(() =>
    normalizeProfile(loadRaw<unknown>(LS.profile, null))
  );
  const [coinsAfter, setCoinsAfter] = useState<number | null>(null);
  const settledRef = useRef<string[]>(loadRaw<string[]>(LS.settled, []));

  const [ship, setShipState] = useState<ShipConfig>(() => {
    const stored = load(LS.ship, DEFAULT_SHIP);
    const classId = FIGHTER_ORDER.includes(stored.classId) ? stored.classId : DEFAULT_SHIP.classId;
    const eqDrone = stored.equippedDrone && DRONE_ORDER.includes(stored.equippedDrone) ? stored.equippedDrone : null;
    return {
      ...DEFAULT_SHIP,
      ...stored,
      classId,
      equippedDrone: eqDrone,
      loadout: { ...DEFAULT_SHIP.loadout, ...(stored.loadout ?? {}) },
    };
  });

  const [scores, setScores] = useState<ScoreRow[]>(() => loadRaw<ScoreRow[]>(LS.scores, []));
  const [mode, setMode] = useState<ModeId>(() => {
    const m = loadRaw<ModeId>(LS.prefs + ".mode", "practice");
    return m in MODES ? m : "practice";
  });
  const [arena, setArena] = useState<string>(() => loadRaw<string>(LS.prefs + ".arena", "nebula_frontier"));
  const [difficulty, setDifficulty] = useState<Difficulty>(() => loadRaw<Difficulty>(LS.prefs + ".diff", "normal"));

  const [hud, setHud] = useState<HUDState | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<EndResult | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [netInfo, setNetInfo] = useState<{ role: NetRole; room: string; aiFill: boolean }>({ role: "off", room: "", aiFill: true });
  const [toast, setToast] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const syncBusRef = useRef<ProfileSyncBus | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const setProfile = useCallback((next: PlayerProfile) => {
    // keep the ref in sync synchronously so a purchase followed by an equip in the
    // same click cannot be reverted by the ship sanitiser
    profileRef.current = next;
    setProfileState(next);
    save(LS.profile, next);
    syncBusRef.current?.broadcastProfile(next);
  }, []);

  const setShip = useCallback((next: ShipConfig) => {
    const prof = profileRef.current;
    // Enforce mandatory rule: cannot equip a drone that isn't owned
    const validDrone = next.equippedDrone && prof.ownedDrones.includes(next.equippedDrone)
      ? next.equippedDrone
      : null;
    // Never allow an unowned weapon or cosmetic to reach combat
    const ownedWeapon = (id: WeaponId, alt: WeaponId): WeaponId => (prof.ownedWeapons.includes(id) ? id : alt);
    const sanitized: ShipConfig = {
      ...next,
      equippedDrone: validDrone,
      paintIndex: prof.ownedPaints.includes(next.paintIndex) ? next.paintIndex : 0,
      engineColorIndex: prof.ownedEngineColors.includes(next.engineColorIndex ?? 0) ? (next.engineColorIndex ?? 0) : 0,
      laserColorIndex: prof.ownedLaserColors.includes(next.laserColorIndex ?? 0) ? (next.laserColorIndex ?? 0) : 0,
      trailColorIndex: prof.ownedTrailColors.includes(next.trailColorIndex ?? 0) ? (next.trailColorIndex ?? 0) : 0,
      loadout: {
        ...next.loadout,
        primary: ownedWeapon(next.loadout.primary, "laser"),
        secondary: ownedWeapon(next.loadout.secondary, "homing"),
        special: ownedWeapon(next.loadout.special, "charged"),
      },
    };
    setShipState(sanitized);
    save(LS.ship, sanitized);
    syncBusRef.current?.broadcastShip(sanitized);
  }, []);

  // ---------- boot & cross-app sync ----------
  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse)");
    setIsCoarse(!!mq?.matches);
    const onMq = () => setIsCoarse(!!mq?.matches);
    mq?.addEventListener?.("change", onMq);

    const bus = new ProfileSyncBus();
    bus.onSync = (ev) => {
      if (ev.type === "profile") setProfileState(ev.profile);
      else if (ev.type === "ship") setShipState(ev.ship);
    };
    syncBusRef.current = bus;

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS.profile && e.newValue) {
        try { setProfileState(JSON.parse(e.newValue)); } catch { /* ignore */ }
      } else if (e.key === LS.ship && e.newValue) {
        try { setShipState(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);

    let raf = 0;
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(() => setScreen("menu"));
    }, 900);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      mq?.removeEventListener?.("change", onMq);
      window.removeEventListener("storage", onStorage);
      bus.close();
      syncBusRef.current = null;
    };
  }, []);

  // ---------- persistence ----------
  useEffect(() => { save(LS.settings, settings); audio.setVolume(settings.volume); audio.setMusic(settings.music); }, [settings]);
  useEffect(() => { save(LS.ship, ship); }, [ship]);
  useEffect(() => { save(LS.profile, profile); }, [profile]);
  useEffect(() => { save(LS.prefs + ".mode", mode); save(LS.prefs + ".arena", arena); save(LS.prefs + ".diff", difficulty); }, [mode, arena, difficulty]);

  const saveScore = useCallback((r: EndResult) => {
    // Credit coins exactly once per finished match (guards refresh / rejoin / repeat callbacks)
    const settled = settleReward(profileRef.current, r.matchId, r.reward, settledRef.current);
    if (settled.credited) {
      settledRef.current = settled.settled;
      save(LS.settled, settled.settled);
      const withRecord: PlayerProfile = {
        ...settled.profile,
        stats: {
          ...settled.profile.stats,
          wins: settled.profile.stats.wins + (r.won ? 1 : 0),
          kills: settled.profile.stats.kills + r.kills,
        },
      };
      setProfile(withRecord);
      setCoinsAfter(withRecord.coins);
    } else {
      setCoinsAfter(profileRef.current.coins);
    }
    if (r.mode === "free") return false;
    const row: ScoreRow = {
      name: settingsRef.current.playerName || "PILOT-01",
      score: r.score, kills: r.kills, acc: r.shots ? r.hits / r.shots : 0,
      mode: MODES[r.mode].name, wave: r.wave, won: r.won, date: Date.now(),
    };
    const next = [...scores, row].sort((a, b) => b.score - a.score).slice(0, 12);
    const record = next[0] === row && r.score > 0;
    setScores(next);
    save(LS.scores, next);
    return record;
  }, [scores, setProfile]);

  // ---------- game lifecycle ----------
  const startMatch = useCallback((cfgOverride?: Partial<MatchConfig>) => {
    setResult(null);
    setCoinsAfter(null);
    setIsRecord(false);
    setPaused(false);
    setHud(null);
    setScreen("game");
    audio.resume();
    // Enforce mandatory rule before launch: only owned & equipped drone may be passed
    const verifiedShip: ShipConfig = {
      ...ship,
      classId: profile.ownedShips.includes(ship.classId) ? ship.classId : "nova",
      equippedDrone: ship.equippedDrone && profile.ownedDrones.includes(ship.equippedDrone) ? ship.equippedDrone : null,
    };
    const cfg: MatchConfig = {
      mode, arena, difficulty, ship: verifiedShip,
      net: netInfo.role, room: netInfo.room,
      playerName: settings.playerName || "PILOT-01",
      aiFill: netInfo.aiFill, humanSlots: 1,
      ownedDrones: profile.ownedDrones,
      ownedWeapons: profile.ownedWeapons,
      ...cfgOverride,
    };
    const boot = (attempts: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        if (attempts > 0) requestAnimationFrame(() => boot(attempts - 1));
        else setToast("Could not attach the 3D viewport.");
        return;
      }
      if (gameRef.current) { gameRef.current.dispose(); gameRef.current = null; }
      let g: Game;
      try {
        g = new Game(canvas, cfg, settingsRef.current);
        g.onHUD = (h) => setHud(h);
        g.onEnd = (r) => {
          const rec = saveScore(r);
          setIsRecord(rec);
          setResult(r);
          g.setPaused(true);
        };
        g.onNetStatus = (s) => setToast(s);
        g.init();
        gameRef.current = g;
        forceRender((x) => x + 1);
      } catch (err) {
        console.error(err);
        setToast("Graphics initialisation failed — your browser may not support WebGL.");
        setScreen("menu");
      }
    };
    requestAnimationFrame(() => boot(8));
  }, [mode, arena, difficulty, ship, profile, netInfo, settings.playerName, saveScore]);

  useEffect(() => () => { gameRef.current?.dispose(); gameRef.current = null; }, []);

  const doPause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.setPaused(true);
    setPaused(true);
  }, []);

  const doResume = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setPaused(false);
    g.setPaused(false);
    audio.resume();
    g.requestLock();
  }, []);

  const doRestart = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.restart();
    setResult(null);
    setPaused(false);
    audio.resume();
    g.requestLock();
  }, []);

  const doExit = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
    setPaused(false);
    setResult(null);
    setHud(null);
    setNetInfo({ role: "off", room: "", aiFill: true });
    setScreen("menu");
    audio.resume();
  }, []);

  useEffect(() => { gameRef.current?.applySettings(settings); }, [settings]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const g = gameRef.current;
      if (!g || screen !== "game") return;
      if (g.isPaused() !== paused && !result) setPaused(g.isPaused());
    }, 220);
    return () => window.clearInterval(id);
  }, [paused, screen, result]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ---------- render ----------
  if (screen === "boot") return <BootScreen />;

  if (screen === "game") {
    return (
      <div className="relative h-full w-full overflow-hidden bg-[#04060e]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {!hud && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#04060e]">
            <div className="h-[3px] w-[240px] overflow-hidden bg-[rgba(120,180,240,.15)]">
              <div className="sweep relative h-full w-1/3 bg-[#4fe3ff]" />
            </div>
            <div className="label pulse">GENERATING STAR SYSTEM · SPOOLING REACTOR</div>
          </div>
        )}
        {hud && <HUD h={hud} settings={settings} onPause={doPause} />}
        {hud && isCoarse && <TouchControls game={gameRef.current} />}
        {hud?.countdown !== undefined && hud.countdown > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
            <div className="label">CLICK THE VIEW TO CAPTURE MOUSE AIMING</div>
          </div>
        )}
        {paused && !result && hud && (
          <PauseOverlay
            hud={hud} settings={settings} setSettings={setSettings}
            onResume={doResume} onRestart={doRestart} onExit={doExit}
          />
        )}
        {result && (
          <ResultsScreen
            result={result} isRecord={isRecord} coinsAfter={coinsAfter ?? profile.coins}
            onRematch={doRestart} onMenu={doExit}
            onHangar={() => { doExit(); setHangarTab("ships"); setScreen("hangar"); }}
          />
        )}
        {toast && <div className="panel-flat notch-sm absolute left-1/2 top-16 -translate-x-1/2 px-4 py-2 text-[12px] text-[#7fe9ff] fade">{toast}</div>}
      </div>
    );
  }

  if (screen === "hangar") {
    return (
      <HangarScreen
        ship={ship}
        setShip={setShip}
        profile={profile}
        setProfile={setProfile}
        settings={settings}
        initialTab={hangarTab}
        onBack={() => setScreen("menu")}
        onTestFlight={() => startMatch({ mode: "practice", net: "off", room: "" })}
      />
    );
  }

  if (screen === "lobby") {
    return (
      <LobbyScreen
        settings={settings}
        arena={arena}
        setArena={setArena}
        ship={ship}
        initialMode={lobbyMode}
        onBack={() => setScreen("menu")}
        onLaunch={(m, room, role, aiFill) => {
          setNetInfo({ role, room, aiFill });
          setMode(m);
          startMatch({ mode: m, net: role, room, aiFill });
        }}
      />
    );
  }

  return (
    <MainMenu
      settings={settings}
      ship={ship}
      profile={profile}
      mode={mode}
      arena={arena}
      difficulty={difficulty}
      scores={scores}
      setMode={setMode}
      setArena={setArena}
      setDifficulty={setDifficulty}
      setShip={setShip}
      setProfile={setProfile}
      setSettings={setSettings}
      saveScores={(s) => { setScores(s); save(LS.scores, s); }}
      launch={() => startMatch({ net: "off", room: "" })}
      openHangar={(tab = "ships") => {
        audio.resume();
        audio.play("uiclick");
        setHangarTab(tab);
        setScreen("hangar");
      }}
      openOnline={(m) => {
        audio.resume();
        const targetMode: "duel" | "wing" | "team" = m === "online5v5" ? "team" : m === "online2v2" ? "wing" : "duel";
        setLobbyMode(targetMode);
        setMode(targetMode);
        setNetInfo({ role: "off", room: "", aiFill: true });
        setScreen("lobby");
      }}
    />
  );
}

function BootScreen() {
  return (
    <div className="starfield-bg vignette relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center gap-5">
        <svg width="92" height="92" viewBox="0 0 40 40" className="pop">
          <defs>
            <linearGradient id="blg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4fe3ff" /><stop offset="100%" stopColor="#ff4fb0" />
            </linearGradient>
          </defs>
          <path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" fill="none" stroke="url(#blg)" strokeWidth="1.2" />
          <ellipse cx="20" cy="21" rx="11" ry="4.2" fill="none" stroke="#4fe3ff" strokeWidth="1.2" opacity=".9" />
          <circle cx="20" cy="17" r="4" fill="#ff4fb0" opacity=".85" />
        </svg>
        <div className="text-center">
          <div className="font-display text-[clamp(28px,6vw,52px)] font-black leading-none tracking-[0.16em] text-white title-glow">GALAXY WARFARE</div>
          <div className="label mt-2 text-[#ff9ad8]">3D · SPACE & PLANETARY COMBAT SIMULATOR</div>
        </div>
        <div className="h-[3px] w-[260px] overflow-hidden bg-[rgba(120,180,240,.15)]">
          <div className="h-full w-1/3 bg-[#4fe3ff] sweep" style={{ position: "relative" }} />
        </div>
        <div className="label pulse">INITIALISING FLIGHT CORE · GENERATING PLANETARY & STAR SYSTEMS</div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {ARENAS.map((a) => (
            <span key={a.id} className="notch-sm border border-[rgba(120,180,240,.2)] px-2 py-[3px] text-[9px] tracking-[0.16em] text-[#7e97b8]">{a.tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
