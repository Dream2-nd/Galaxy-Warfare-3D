import { useEffect, useRef, useState } from "react";
import {
  ARENAS, DIFFICULTIES, DRONE_ORDER, DRONE_TYPES, ENGINE_COLORS, FIGHTER_ORDER,
  LASER_COLORS, MAX_ITEM_PRICE, MODES, PAINTS, PAINT_PRICES, ENGINE_COLOR_PRICES,
  LASER_COLOR_PRICES, TRAIL_COLOR_PRICES, PRIMARY_WEAPONS, SECONDARY_WEAPONS, SHIP_CLASSES,
  SPECIAL_WEAPONS, TRAIL_COLORS, WEAPON_PRICES, WEAPON_SHOP, WEAPONS,
  type Difficulty, type DroneTypeId, type GameSettings, type ModeId,
  type PlayerProfile, type ShipClassId, type ShipConfig, type WeaponId,
} from "@/game/content";
import { Hangar } from "@/game/hangar";
import { audio } from "@/game/audio";
import { LINK_SUPPORTED, makeRoomCode } from "@/game/net";
import { Lobby, type LobbyPlayer } from "@/game/lobby";
import { purchase } from "@/game/economy";

export function Btn({
  children, onClick, variant = "", className = "", disabled, title,
}: { children: React.ReactNode; onClick?: () => void; variant?: string; className?: string; disabled?: boolean; title?: string }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onMouseEnter={() => { if (!disabled) audio.play("ui"); }}
      onClick={() => { if (!disabled) audio.play("uiclick"); onClick?.(); }}
      className={`btn ${variant} px-4 py-2.5 text-[12px] font-bold ${disabled ? "cursor-not-allowed opacity-40" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Tag({ children, color = "#4fe3ff" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="notch-sm inline-block px-2 py-[2px] text-[9.5px] font-bold tracking-[0.18em]" style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}>
      {children}
    </span>
  );
}

function StatBars({ bars }: { bars: { top: number; agi: number; arm: number; shd: number } }) {
  const rows: [string, number, string][] = [
    ["TOP SPEED", bars.top, "#ffc24a"], ["AGILITY", bars.agi, "#4fe3ff"],
    ["ARMOR", bars.arm, "#a8ff4d"], ["SHIELD", bars.shd, "#ff4fb0"],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(([k, v, c]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="label w-[74px]">{k}</span>
          <div className="flex gap-[3px]">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="block h-[9px] w-[13px] skew-x-[-22deg]" style={{ background: i < v ? c : "rgba(120,160,210,.14)", boxShadow: i < v ? `0 0 9px ${c}88` : "none" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export type HangarTab = "ships" | "drones" | "armory" | "cosmetics";

const MODE_ROWS: { id: ModeId | "online1v1" | "online2v2" | "online5v5"; name: string; desc: string; icon: string; net?: boolean; color: string }[] = [
  { id: "practice",  name: "SOLO PRACTICE",   desc: "Endless waves of AI hunters · chase a high score", icon: "◎", color: "#a8ff4d" },
  { id: "duel",      name: "1v1 DUEL",        desc: "You versus one AI ace · first kill wins", icon: "⚔", color: "#4fe3ff" },
  { id: "wing",      name: "2v2 WING BATTLE", desc: "You and 1 AI wingman vs 2 AI aces · coordinated wing duel", icon: "❖", color: "#35f0e0" },
  { id: "team",      name: "5v5 TEAM BATTLE", desc: "Blue squadron with 4 AI wingmen vs 5 AI hostiles", icon: "⬢", color: "#ff4fb0" },
  { id: "free",      name: "FREE ROAM GALAXY", desc: "No timer, no rules · fly planetary canyons & space", icon: "✧", color: "#ffc24a" },
  { id: "online1v1", name: "ONLINE 1v1",      desc: "Local-link duel against a real pilot in another tab", icon: "⌁", net: true, color: "#7fe9ff" },
  { id: "online2v2", name: "ONLINE 2v2",      desc: "Local-link 2v2 wing battle · real pilots or labelled AI fill", icon: "⟁", net: true, color: "#68ff9a" },
  { id: "online5v5", name: "ONLINE 5v5",      desc: "Local-link 5v5 squadron war · empty slots filled by labelled AI", icon: "⌬", net: true, color: "#ff8a3d" },
];

export interface MenuProps {
  settings: GameSettings;
  ship: ShipConfig;
  profile: PlayerProfile;
  mode: ModeId;
  arena: string;
  difficulty: Difficulty;
  scores: { name: string; score: number; kills: number; acc: number; mode: string; wave: number; won: boolean; date: number }[];
  setMode: (m: ModeId) => void;
  setArena: (a: string) => void;
  setDifficulty: (d: Difficulty) => void;
  setShip: (s: ShipConfig) => void;
  setProfile: (p: PlayerProfile) => void;
  setSettings: (s: GameSettings) => void;
  launch: () => void;
  openHangar: (initialTab?: HangarTab) => void;
  openOnline: (m: "online1v1" | "online2v2" | "online5v5") => void;
  saveScores: (s: { name: string; score: number; kills: number; acc: number; mode: string; wave: number; won: boolean; date: number }[]) => void;
}

export function MainMenu(p: MenuProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hangarRef = useRef<Hangar | null>(null);
  const [tab, setTab] = useState<"arena" | "ship">("arena");
  const [modal, setModal] = useState<"none" | "settings" | "controls" | "scores">("none");
  const arena = ARENAS.find((a) => a.id === p.arena) ?? ARENAS[0];
  const cls = SHIP_CLASSES[p.ship.classId] ?? SHIP_CLASSES.nova;

  useEffect(() => {
    if (!canvasRef.current) return;
    const h = new Hangar(canvasRef.current, p.settings.quality);
    h.setConfig(p.ship);
    hangarRef.current = h;
    return () => { h.dispose(); hangarRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.settings.quality]);

  useEffect(() => { hangarRef.current?.setConfig(p.ship); }, [p.ship]);

  const selected = MODE_ROWS.find((m) => m.id === p.mode) ?? MODE_ROWS[0];
  const equippedDroneSpec = p.ship.equippedDrone ? DRONE_TYPES[p.ship.equippedDrone] : null;

  return (
    <div className="starfield-bg vignette scanlines relative h-full w-full overflow-y-auto hide-scroll">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1500px] flex-col px-4 py-4 lg:px-8">
        {/* ---- top bar ---- */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(120,180,240,.16)] pb-3">
          <div className="flex items-center gap-3">
            <svg width="38" height="38" viewBox="0 0 40 40" className="shrink-0">
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4fe3ff" /><stop offset="100%" stopColor="#ff4fb0" />
                </linearGradient>
              </defs>
              <path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" fill="none" stroke="url(#lg)" strokeWidth="1.6" />
              <ellipse cx="20" cy="21" rx="11" ry="4.2" fill="none" stroke="#4fe3ff" strokeWidth="1.4" opacity=".9" />
              <circle cx="20" cy="17" r="4" fill="#ff4fb0" opacity=".85" />
              <circle cx="20" cy="21" r="1.6" fill="#eaf9ff" />
            </svg>
            <div>
              <div className="font-display text-[19px] font-black leading-none tracking-[0.14em] text-white title-glow">GALAXY WARFARE</div>
              <div className="label mt-1 text-[#ff9ad8]">3D · SPACE & PLANETARY COMBAT SIMULATOR</div>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <div className="notch-sm border border-[rgba(255,194,74,.45)] bg-[rgba(255,194,74,.12)] px-3 py-2 font-display text-[12px] font-black tracking-[0.12em] text-[#ffc24a]" title="Your persistent coin balance">
              ◈ {p.profile.coins.toLocaleString()} COINS
            </div>
            <Btn onClick={() => p.openHangar("ships")} variant="btn-ghost">⬡ HANGAR ({p.profile.ownedShips.length}/10)</Btn>
            <Btn onClick={() => p.openHangar("drones")} variant="btn-ghost">◈ DRONE BAY ({p.profile.ownedDrones.length}/6)</Btn>
            <Btn onClick={() => setModal("scores")} variant="btn-ghost">★ SCORES</Btn>
            <Btn onClick={() => setModal("controls")} variant="btn-ghost">⌨ CONTROLS</Btn>
            <Btn onClick={() => setModal("settings")} variant="btn-ghost">⚙ SETTINGS</Btn>
          </nav>
        </header>

        {/* ---- main grid ---- */}
        <div className="grid flex-1 grid-cols-1 gap-5 py-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* left: mode rail */}
          <section className="rise flex flex-col gap-2.5">
            <div>
              <h1 className="font-display text-[clamp(30px,4.8vw,54px)] font-black leading-[0.88] tracking-[-0.01em] text-white">
                COMMAND THE<br />
                <span className="text-[#4fe3ff]" style={{ textShadow: "0 0 34px rgba(79,227,255,.5)" }}>FLEET.</span>{" "}
                <span className="text-[#ff4fb0]" style={{ textShadow: "0 0 34px rgba(255,79,176,.5)" }}>RULE THE SKIES.</span>
              </h1>
              <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-[#a9c4e4]">
                10 custom-built 3D spacecraft, 6 autonomous combat drones, planetary canyon & stormworld battlefields,
                and 1v1, 2v2, and 5v5 dogfights.
              </p>
            </div>

            <div className="label mt-0.5 flex items-center gap-2">
              <span className="h-px w-6 bg-[#4fe3ff]" /> SELECT COMBAT MODE
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {MODE_ROWS.map((m, i) => {
                const on = m.id === p.mode;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (m.net) p.openOnline(m.id as "online1v1" | "online2v2" | "online5v5");
                      else p.setMode(m.id as ModeId);
                    }}
                    className={`group notch relative flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150 ${on ? "btn-sel" : ""}`}
                    style={{
                      background: on ? undefined : "linear-gradient(100deg, rgba(12,22,44,.78), rgba(6,11,24,.6))",
                      border: `1px solid ${on ? m.color : "rgba(120,170,220,.16)"}`,
                      boxShadow: on ? `0 0 22px ${m.color}33` : "none",
                    }}
                  >
                    <span className="num w-4 text-[10px] font-bold text-white/25">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[17px]" style={{ color: m.color, textShadow: `0 0 14px ${m.color}88` }}>{m.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[12px] font-bold tracking-[0.1em] text-white">{m.name}</span>
                      <span className="block truncate text-[10.5px] text-[#93add0]">{m.desc}</span>
                    </span>
                    {m.net ? <Tag color="#7fe9ff">LINK</Tag> : <Tag color="#a8ff4d">OFFLINE</Tag>}
                  </button>
                );
              })}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="label mr-1">AI DIFFICULTY</span>
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <button key={d} onClick={() => p.setDifficulty(d)} className={`btn notch-sm px-3 py-1.5 text-[10.5px] ${p.difficulty === d ? "btn-sel" : "btn-ghost"}`}>
                  {DIFFICULTIES[d].name}
                </button>
              ))}
              <span className="ml-1 text-[11px] text-[#93add0]">{DIFFICULTIES[p.difficulty].desc}</span>
            </div>

            {/* Equipped Drone Status & Quick Equip */}
            <div className="panel-flat notch-sm flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="label text-[#7dffe0]">EQUIPPED DRONE:</span>
                {equippedDroneSpec ? (
                  <span className="font-display text-[12px] font-bold text-[#7dffe0]">
                    {equippedDroneSpec.name} <span className="text-[10px] text-white/50">({equippedDroneSpec.role})</span>
                  </span>
                ) : (
                  <span className="font-display text-[11.5px] font-bold text-white/45">NONE (FLYING SOLO)</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {p.ship.equippedDrone && (
                  <button
                    onClick={() => p.setShip({ ...p.ship, equippedDrone: null })}
                    className="btn btn-ghost notch-sm px-2.5 py-1 text-[10px]"
                  >
                    UNEQUIP
                  </button>
                )}
                <button
                  onClick={() => p.openHangar("drones")}
                  className="btn notch-sm px-2.5 py-1 text-[10px]"
                >
                  ◈ OPEN DRONE BAY ▸
                </button>
              </div>
            </div>
          </section>

          {/* right: 3D hangar + arena + launch */}
          <section className="rise flex flex-col gap-3" style={{ animationDelay: ".08s" }}>
            <div className="panel notch relative overflow-hidden" style={{ height: 290 }}>
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
              <div className="pointer-events-none absolute left-3 top-3">
                <div className="label text-[#7fe9ff]">HANGAR BAY 07 · LIVE 3D PREVIEW</div>
                <div className="font-display text-[16px] font-black tracking-[0.1em] text-white">{cls.name}</div>
                <div className="text-[11px] text-[#93add0]">{cls.role}</div>
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                <StatBars bars={cls.bars} />
                <div className="text-right">
                  <div className="label">DRAG TO ORBIT · WHEEL TO ZOOM</div>
                  <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                    <Tag color="#4fe3ff">{WEAPONS[p.ship.loadout.primary]?.short ?? "LASER"}</Tag>
                    <Tag color="#ff8a3d">{WEAPONS[p.ship.loadout.secondary]?.short ?? "HOMING"}</Tag>
                    {equippedDroneSpec && <Tag color="#7dffe0">{equippedDroneSpec.id.toUpperCase()} DRONE</Tag>}
                  </div>
                </div>
              </div>
            </div>

            <div className="panel notch flex-1 p-3">
              <div className="mb-2 flex gap-2">
                <button onClick={() => setTab("arena")} className={`btn notch-sm px-3 py-1.5 text-[10.5px] ${tab === "arena" ? "btn-sel" : "btn-ghost"}`}>BATTLE ARENA ({ARENAS.length})</button>
                <button onClick={() => setTab("ship")} className={`btn notch-sm px-3 py-1.5 text-[10.5px] ${tab === "ship" ? "btn-sel" : "btn-ghost"}`}>QUICK SHIP & PAINT</button>
              </div>

              {tab === "arena" ? (
                <div className="fade">
                  <div className="flex max-h-[115px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                    {ARENAS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => p.setArena(a.id)}
                        className={`btn notch-sm px-2.5 py-1.5 text-[10px] ${p.arena === a.id ? "btn-sel" : "btn-ghost"}`}
                      >
                        {a.planetary ? `🌍 ${a.name}` : a.name}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5 border-l-2 border-[#4fe3ff] pl-3">
                    <div className="font-display text-[14px] font-bold tracking-[0.1em] text-white">
                      {arena.name} <span className="ml-2 text-[10px] text-[#ff9ad8]">// {arena.tag}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#a9c4e4]">{arena.desc}</p>
                    <p className="mt-1 text-[11px] text-[#ffc24a]">◈ TACTICAL: {arena.tactical}</p>
                  </div>
                </div>
              ) : (
                <div className="fade flex flex-col gap-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {FIGHTER_ORDER.map((id) => {
                      const owned = p.profile.ownedShips.includes(id);
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            if (owned) p.setShip({ ...p.ship, classId: id });
                            else p.openHangar("ships");
                          }}
                          className={`btn notch-sm px-2.5 py-1.5 text-[10px] ${p.ship.classId === id ? "btn-sel" : "btn-ghost"}`}
                        >
                          {SHIP_CLASSES[id].name} {!owned && `(${SHIP_CLASSES[id].price} COINS)`}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PAINTS.map((pt, i) => (
                      <button
                        key={pt.name}
                        title={`${pt.name}${p.profile.ownedPaints.includes(i) ? "" : ` — ${PAINT_PRICES[i]} coins (buy in hangar)`}`}
                        onClick={() => {
                          if (p.profile.ownedPaints.includes(i)) p.setShip({ ...p.ship, paintIndex: i });
                          else p.openHangar("cosmetics");
                        }}
                        className="h-7 w-7 notch-sm transition-transform hover:scale-110"
                        style={{
                          background: `linear-gradient(135deg, #${pt.hull.toString(16).padStart(6, "0")}, #${pt.trim.toString(16).padStart(6, "0")})`,
                          border: p.ship.paintIndex === i ? "2px solid #4fe3ff" : "1px solid rgba(255,255,255,.18)",
                          boxShadow: p.ship.paintIndex === i ? `0 0 16px #${pt.engine.toString(16).padStart(6, "0")}` : "none",
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Btn onClick={() => p.openHangar("ships")} variant="btn-ghost">⬡ FULL HANGAR & WEAPONS ▸</Btn>
                    <Btn onClick={() => p.openHangar("drones")} variant="btn-ghost">◈ DRONE BAY ▸</Btn>
                  </div>
                </div>
              )}
            </div>

            <div className="panel notch flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="label">READY TO LAUNCH</div>
                <div className="truncate font-display text-[15px] font-black tracking-[0.08em] text-white">
                  {MODES[p.mode].name} <span className="text-[#4fe3ff]">/</span> {arena.name}
                </div>
                <div className="truncate text-[11px] text-[#93add0]">{selected?.desc ?? MODES[p.mode].desc}</div>
              </div>
              <button onClick={p.launch} className="btn btn-primary notch relative overflow-hidden px-7 py-4 text-[15px] font-black sweep">
                LAUNCH ▸
              </button>
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(120,180,240,.16)] pt-3 text-[11px] text-[#7e97b8]">
          <span>PILOT <b className="text-[#7fe9ff]">{p.settings.playerName || "UNNAMED"}</b> · ◈ <b className="text-[#ffc24a]">{p.profile.coins.toLocaleString()} COINS</b> · {p.profile.ownedShips.length}/10 SHIPS · {p.profile.ownedDrones.length}/6 DRONES · NEW PILOTS GET 10,000 ONCE</span>
          <span>PROFILE & LOADOUT SYNCED ACROSS CONNECTED ARENA APPS/TABS</span>
        </footer>
      </div>

      {modal === "settings" && <SettingsModal settings={p.settings} setSettings={p.setSettings} onClose={() => setModal("none")} />}
      {modal === "controls" && <ControlsModal onClose={() => setModal("none")} />}
      {modal === "scores" && <ScoresModal scores={p.scores} clear={() => { p.saveScores([]); }} onClose={() => setModal("none")} />}
    </div>
  );
}

/* ---------------- modals ---------------- */

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(2,5,14,.82)] p-4 backdrop-blur-sm fade" onClick={onClose}>
      <div className={`panel notch pop relative max-h-[88vh] w-full ${wide ? "max-w-[860px]" : "max-w-[560px]"} overflow-y-auto p-5`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-[rgba(120,180,240,.18)] pb-2">
          <h2 className="font-display text-[17px] font-black tracking-[0.16em] text-white">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost notch-sm px-2.5 py-1 text-[11px]">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="label">{label}</span>
        <span className="num text-[12px] font-bold text-[#7fe9ff]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

export function SettingsModal({ settings, setSettings, onClose }: { settings: GameSettings; setSettings: (s: GameSettings) => void; onClose: () => void }) {
  const s = settings;
  const set = (o: Partial<GameSettings>) => setSettings({ ...s, ...o });
  return (
    <Modal title="SETTINGS" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="label mb-1">CALLSIGN</div>
          <input
            type="text" maxLength={14} value={s.playerName}
            onChange={(e) => set({ playerName: e.target.value.toUpperCase() })}
            className="notch-sm w-full border border-[rgba(120,180,240,.3)] bg-[rgba(6,12,26,.9)] px-3 py-2 font-display text-[14px] tracking-[0.14em] text-white outline-none focus:border-[#4fe3ff]"
          />
        </div>
        <Slider label="MOUSE / STICK SENSITIVITY" value={s.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => set({ sensitivity: v })} fmt={(v) => `${v.toFixed(2)}×`} />
        <Slider label="SFX VOLUME" value={s.volume} min={0} max={1} step={0.05} onChange={(v) => set({ volume: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="MUSIC VOLUME" value={s.music} min={0} max={1} step={0.05} onChange={(v) => set({ music: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="CAMERA SHAKE" value={s.shake} min={0} max={1.5} step={0.1} onChange={(v) => set({ shake: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <div>
          <div className="label mb-1.5">GRAPHICS QUALITY <span className="text-[#ffc24a]">(applied on next launch)</span></div>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as const).map((q) => (
              <button key={q} onClick={() => set({ quality: q })} className={`btn notch-sm flex-1 px-3 py-2 text-[11px] ${s.quality === q ? "btn-sel" : "btn-ghost"}`}>
                {q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Toggle label="INVERT VERTICAL AXIS" on={s.invertY} onClick={() => set({ invertY: !s.invertY })} />
          <Toggle label="AUTO-LOCK NEAREST TARGET" on={s.autoLock} onClick={() => set({ autoLock: !s.autoLock })} />
          <Toggle label="SHOW FPS COUNTER" on={s.showFps} onClick={() => set({ showFps: !s.showFps })} />
        </div>
      </div>
    </Modal>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="notch-sm flex items-center justify-between border border-[rgba(120,170,220,.18)] bg-[rgba(8,14,30,.7)] px-3 py-2 transition-colors hover:border-[#4fe3ff66]">
      <span className="label">{label}</span>
      <span className="relative h-[18px] w-[38px] rounded-full" style={{ background: on ? "rgba(79,227,255,.35)" : "rgba(120,160,210,.16)", border: `1px solid ${on ? "#4fe3ff" : "rgba(120,160,210,.3)"}` }}>
        <span className="absolute top-[2px] h-[12px] w-[12px] rounded-full transition-all" style={{ left: on ? 22 : 3, background: on ? "#4fe3ff" : "#7e97b8", boxShadow: on ? "0 0 10px #4fe3ff" : "none" }} />
      </span>
    </button>
  );
}

const CONTROLS: [string, string][] = [
  ["W / S", "Thrust forward / reverse & brake"], ["A / D", "Strafe left / right"], ["SPACE", "Rise"],
  ["CTRL / Z", "Descend (Z avoids the browser's Ctrl+W tab close)"], ["MOUSE", "Yaw, pitch & aim"], ["Q / E", "Roll"],
  ["SHIFT", "Turbo boost (drains cell)"], ["LMB", "Fire primary weapon"], ["RMB", "Fire secondary / lock target"],
  ["MMB / TAB", "Cycle target"], ["1 / 2 / WHEEL", "Select weapon slot"], ["F", "Shield surge + flares (breaks missile locks)"],
  ["X", "Fire selected X-slot special"], ["G", "Drones: escort & defend ↔ attack my target"], ["V", "Cycle X-slot: laser, plasma, missile, special"],
  ["C", "Chase / cockpit camera"], ["ESC or P", "Pause"],
];

export function ControlsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="FLIGHT CONTROLS" onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {CONTROLS.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 border-b border-[rgba(120,180,240,.1)] py-1.5">
            <span className="notch-sm min-w-[92px] border border-[rgba(79,227,255,.35)] bg-[rgba(79,227,255,.08)] px-2 py-1 text-center font-display text-[10.5px] font-bold tracking-[0.1em] text-[#7fe9ff]">{k}</span>
            <span className="text-[12.5px] text-[#a9c4e4]">{v}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-[#93add0]">
        <b className="text-[#7fe9ff]">TOUCH:</b> left stick = thrust & strafe, right stick = aim, on-screen pads fire,
        boost, surge shields, toggle drone stance, and trigger the X-slot special.
      </p>
    </Modal>
  );
}

export type ScoreRow = { name: string; score: number; kills: number; acc: number; mode: string; wave: number; won: boolean; date: number };

export function ScoresModal({ scores, clear, onClose }: { scores: ScoreRow[]; clear: () => void; onClose: () => void }) {
  return (
    <Modal title="LOCAL HIGH SCORES" onClose={onClose} wide>
      {scores.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[#93add0]">No combat records yet. Fly a battle to log a score.</p>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="label border-b border-[rgba(120,180,240,.2)]">
              <th className="py-1.5 text-left">#</th><th className="text-left">PILOT</th><th className="text-left">MODE</th>
              <th className="text-right">KILLS</th><th className="text-right">ACC</th><th className="text-right">WAVE</th>
              <th className="text-right">RESULT</th><th className="text-right">SCORE</th>
            </tr>
          </thead>
          <tbody>
            {scores.slice(0, 10).map((s, i) => (
              <tr key={i} className="border-b border-[rgba(120,180,240,.08)]">
                <td className="py-1.5 font-display font-bold" style={{ color: i === 0 ? "#ffc24a" : i === 1 ? "#cfe4ff" : i === 2 ? "#e0975a" : "#5f7590" }}>{i + 1}</td>
                <td className="font-semibold text-white">{s.name}</td>
                <td className="text-[#93add0]">{s.mode}</td>
                <td className="num text-right text-[#a8ff4d]">{s.kills}</td>
                <td className="num text-right text-[#7fe9ff]">{Math.round(s.acc * 100)}%</td>
                <td className="num text-right text-[#93add0]">{s.wave || "—"}</td>
                <td className="text-right font-bold" style={{ color: s.won ? "#a8ff4d" : "#ff8a94" }}>{s.won ? "VICTORY" : "LOSS"}</td>
                <td className="num text-right font-display text-[14px] font-black text-white">{s.score.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="btn-ghost" onClick={clear}>CLEAR LOG</Btn>
        <Btn onClick={onClose}>CLOSE</Btn>
      </div>
      <p className="label mt-3">Stored in this browser's local storage — no account, no network.</p>
    </Modal>
  );
}

/* ---------------- COMPLETE 3D HANGAR & DRONE BAY ---------------- */

export function HangarScreen({
  ship, setShip, profile, setProfile, settings, initialTab = "ships", onBack, onTestFlight,
}: {
  ship: ShipConfig;
  setShip: (s: ShipConfig) => void;
  profile: PlayerProfile;
  setProfile: (p: PlayerProfile) => void;
  settings: GameSettings;
  initialTab?: HangarTab;
  onBack: () => void;
  onTestFlight?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hangarRef = useRef<Hangar | null>(null);
  const [bayTab, setBayTab] = useState<HangarTab>(initialTab);
  const [camView, setCamView] = useState<"third" | "first">("third");
  const [inspectShip, setInspectShip] = useState<ShipClassId>(ship.classId);
  const [inspectDrone, setInspectDrone] = useState<DroneTypeId>(ship.equippedDrone ?? "hunter");
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const busyRef = useRef(false);

  /** Blocks re-entrant clicks so a double-click can never charge twice. */
  const lock = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    window.setTimeout(() => { busyRef.current = false; }, 260);
    return true;
  };

  const notify = (text: string, bad = false) => {
    setMsg({ text, bad });
    if (bad) audio.play("warn");
  };

  const cls = SHIP_CLASSES[inspectShip] ?? SHIP_CLASSES.nova;
  const shipOwned = profile.ownedShips.includes(inspectShip);
  const shipEquipped = ship.classId === inspectShip;
  const droneSpec = DRONE_TYPES[inspectDrone] ?? DRONE_TYPES.hunter;
  const droneOwned = profile.ownedDrones.includes(inspectDrone);
  const droneEquipped = ship.equippedDrone === inspectDrone;

  const previewCfg: ShipConfig = { ...ship, classId: inspectShip };
  const info = Hangar.describe(previewCfg);
  const paint = PAINTS[ship.paintIndex % PAINTS.length];

  useEffect(() => {
    if (!canvasRef.current) return;
    const h = new Hangar(canvasRef.current, settings.quality);
    h.setFocusMode(bayTab === "drones" ? "drone" : "ship");
    h.setCameraMode(camView);
    h.setConfig(previewCfg, bayTab === "drones" ? inspectDrone : ship.equippedDrone);
    hangarRef.current = h;
    return () => { h.dispose(); hangarRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);

  useEffect(() => {
    const h = hangarRef.current;
    if (!h) return;
    h.setFocusMode(bayTab === "drones" ? "drone" : "ship");
    h.setCameraMode(camView);
    h.setConfig({ ...ship, classId: inspectShip }, bayTab === "drones" ? inspectDrone : ship.equippedDrone);
  }, [ship, inspectShip, inspectDrone, bayTab, camView]);

  /* ---------- real transactions (deduct only on success) ---------- */
  const buyShip = () => {
    if (!lock()) return;
    if (shipOwned) { setShip({ ...ship, classId: inspectShip }); notify(`${cls.name} equipped.`); return; }
    const res = purchase(profile, cls.price, false, (prof) => ({ ...prof, ownedShips: [...prof.ownedShips, inspectShip] }));
    if (!res.ok) { notify(`Not enough coins — ${cls.name} costs ${cls.price}, you have ${profile.coins}.`, true); return; }
    setProfile(res.profile);
    setShip({ ...ship, classId: inspectShip });
    notify(`Unlocked ${cls.name} for ${cls.price} coins · ${res.profile.coins} remaining.`);
  };

  const buyOrEquipDrone = () => {
    if (!lock()) return;
    if (droneOwned) {
      setShip({ ...ship, equippedDrone: droneEquipped ? null : inspectDrone });
      notify(droneEquipped ? `${droneSpec.name} unequipped — no drone will spawn.` : `${droneSpec.name} equipped.`);
      return;
    }
    const res = purchase(profile, droneSpec.price, false, (prof) => ({ ...prof, ownedDrones: [...prof.ownedDrones, inspectDrone] }));
    if (!res.ok) { notify(`Not enough coins — ${droneSpec.name} costs ${droneSpec.price}, you have ${profile.coins}.`, true); return; }
    setProfile(res.profile);
    setShip({ ...ship, equippedDrone: inspectDrone });
    notify(`Unlocked & equipped ${droneSpec.name} for ${droneSpec.price} coins · ${res.profile.coins} remaining.`);
  };

  const slotFor = (id: WeaponId): "primary" | "secondary" | "special" =>
    PRIMARY_WEAPONS.includes(id) ? "primary" : SECONDARY_WEAPONS.includes(id) ? "secondary" : "special";

  const acquireWeapon = (id: WeaponId) => {
    if (!lock()) return;
    const owned = profile.ownedWeapons.includes(id);
    const price = WEAPON_PRICES[id] ?? 0;
    let nextProfile = profile;
    if (!owned) {
      const res = purchase(profile, price, false, (prof) => ({ ...prof, ownedWeapons: [...prof.ownedWeapons, id] }));
      if (!res.ok) { notify(`Not enough coins — ${WEAPONS[id].name} costs ${price}, you have ${profile.coins}.`, true); return; }
      nextProfile = res.profile;
      setProfile(nextProfile);
      notify(`Purchased ${WEAPONS[id].name} for ${price} coins · ${nextProfile.coins} remaining.`);
    }
    setShip({ ...ship, loadout: { ...ship.loadout, [slotFor(id)]: id } });
  };

  const acquirePaint = (i: number) => {
    if (!lock()) return;
    const owned = profile.ownedPaints.includes(i);
    if (!owned) {
      const res = purchase(profile, PAINT_PRICES[i] ?? 0, false, (prof) => ({ ...prof, ownedPaints: [...prof.ownedPaints, i] }));
      if (!res.ok) { notify(`Not enough coins — ${PAINTS[i].name} paint costs ${PAINT_PRICES[i]} coins.`, true); return; }
      setProfile(res.profile);
      notify(`Purchased ${PAINTS[i].name} hull paint for ${PAINT_PRICES[i]} coins.`);
    }
    setShip({ ...ship, paintIndex: i });
  };

  const acquireEngine = (i: number) => {
    if (!lock()) return;
    if (!profile.ownedEngineColors.includes(i)) {
      const res = purchase(profile, ENGINE_COLOR_PRICES[i] ?? 0, false, (prof) => ({ ...prof, ownedEngineColors: [...prof.ownedEngineColors, i] }));
      if (!res.ok) { notify(`Not enough coins — ${ENGINE_COLORS[i].name} engine glow costs ${ENGINE_COLOR_PRICES[i]} coins.`, true); return; }
      setProfile(res.profile);
      notify(`Purchased ${ENGINE_COLORS[i].name} engine glow for ${ENGINE_COLOR_PRICES[i]} coins.`);
    }
    setShip({ ...ship, engineColorIndex: i });
  };

  const acquireLaser = (i: number) => {
    if (!lock()) return;
    if (!profile.ownedLaserColors.includes(i)) {
      const res = purchase(profile, LASER_COLOR_PRICES[i] ?? 0, false, (prof) => ({ ...prof, ownedLaserColors: [...prof.ownedLaserColors, i] }));
      if (!res.ok) { notify(`Not enough coins — ${LASER_COLORS[i].name} laser tint costs ${LASER_COLOR_PRICES[i]} coins.`, true); return; }
      setProfile(res.profile);
      notify(`Purchased ${LASER_COLORS[i].name} laser tint for ${LASER_COLOR_PRICES[i]} coins.`);
    }
    setShip({ ...ship, laserColorIndex: i });
  };

  const acquireTrail = (i: number) => {
    if (!lock()) return;
    if (!profile.ownedTrailColors.includes(i)) {
      const res = purchase(profile, TRAIL_COLOR_PRICES[i] ?? 0, false, (prof) => ({ ...prof, ownedTrailColors: [...prof.ownedTrailColors, i] }));
      if (!res.ok) { notify(`Not enough coins — ${TRAIL_COLORS[i].name} trail costs ${TRAIL_COLOR_PRICES[i]} coins.`, true); return; }
      setProfile(res.profile);
      notify(`Purchased ${TRAIL_COLORS[i].name} missile trail for ${TRAIL_COLOR_PRICES[i]} coins.`);
    }
    setShip({ ...ship, trailColorIndex: i });
  };

  const tabs: { id: HangarTab; label: string }[] = [
    { id: "ships", label: "⬡ SPACECRAFT" },
    { id: "drones", label: "◈ DRONE BAY" },
    { id: "armory", label: "⌖ ARMORY" },
    { id: "cosmetics", label: "🎨 COSMETICS" },
  ];

  return (
    <div className="starfield-bg vignette relative h-full w-full overflow-y-auto hide-scroll">
      <div className="aurora pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-4 px-4 py-4 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(120,180,240,.16)] pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="label text-[#ff9ad8]">HANGAR BAY 07 · FLEET, ARMORY & SHOP</div>
              <h1 className="font-display text-[22px] font-black leading-none tracking-[0.1em] text-white">
                {bayTab === "ships" ? "SPACECRAFT HANGAR" : bayTab === "drones" ? "COMBAT DRONE BAY" : bayTab === "armory" ? "WEAPONS ARMORY" : "COSMETICS LAB"}
              </h1>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => { setBayTab(t.id); setMsg(null); }} className={`btn notch-sm px-3 py-2 text-[10.5px] ${bayTab === t.id ? "btn-sel" : "btn-ghost"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="notch-sm border border-[rgba(255,194,74,.5)] bg-[rgba(255,194,74,.14)] px-3.5 py-2 font-display text-[14px] font-black tracking-[0.1em] text-[#ffc24a]">
              ◈ {profile.coins.toLocaleString()} <span className="text-[10px] opacity-70">COINS</span>
            </div>
            {onTestFlight && <Btn onClick={onTestFlight} variant="btn-primary">▸ TEST IN ARENA</Btn>}
            <Btn onClick={onBack}>◂ BACK TO COMMAND</Btn>
          </div>
        </header>

        {/* transaction feedback */}
        {msg && (
          <div className={`notch-sm fade border px-3 py-2 text-[12px] ${msg.bad ? "border-[#ff5f6f66] bg-[rgba(255,95,111,.12)] text-[#ffb0b8]" : "border-[#a8ff4d66] bg-[rgba(168,255,77,.1)] text-[#d6ffb8]"}`}>
            {msg.bad ? "⚠ " : "✓ "}{msg.text}
          </div>
        )}

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* 3D preview */}
          <div className="panel notch relative min-h-[400px] overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2">
              {bayTab === "ships" || bayTab === "armory" || bayTab === "cosmetics" ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag color={shipEquipped ? "#a8ff4d" : shipOwned ? "#4fe3ff" : "#ffc24a"}>
                    {shipEquipped ? "EQUIPPED" : shipOwned ? "OWNED" : `LOCKED · ${cls.price} COINS`}
                  </Tag>
                  <Tag color="#ff9ad8">{cls.role.toUpperCase()}</Tag>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag color={droneEquipped ? "#a8ff4d" : droneOwned ? "#4fe3ff" : "#ffc24a"}>
                    {droneEquipped ? "EQUIPPED" : droneOwned ? "OWNED" : `LOCKED · ${droneSpec.price} COINS`}
                  </Tag>
                  <Tag color="#7dffe0">{droneSpec.role.toUpperCase()}</Tag>
                </div>
              )}
              {bayTab !== "drones" && (
                <div className="flex gap-1.5">
                  <button onClick={() => setCamView("third")} className={`btn notch-sm px-2.5 py-1 text-[10px] ${camView === "third" ? "btn-sel" : "btn-ghost"}`}>3RD PERSON</button>
                  <button onClick={() => setCamView("first")} className={`btn notch-sm px-2.5 py-1 text-[10px] ${camView === "first" ? "btn-sel" : "btn-ghost"}`}>1ST PERSON</button>
                </div>
              )}
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-[520px]">
                <div className="font-display text-[22px] font-black tracking-[0.08em] text-white" style={{ textShadow: `0 0 26px #${paint.engine.toString(16).padStart(6, "0")}` }}>
                  {bayTab === "drones" ? droneSpec.name : cls.name}
                </div>
                <div className="text-[12px] text-[#a9c4e4]">{bayTab === "drones" ? droneSpec.desc : cls.desc}</div>
                {bayTab === "drones" && <div className="mt-1 text-[11.5px] font-semibold text-[#7dffe0]">◈ {droneSpec.perk}</div>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Tag color="#4fe3ff">{WEAPONS[ship.loadout.primary]?.short}</Tag>
                  <Tag color="#ff8a3d">{WEAPONS[ship.loadout.secondary]?.short}</Tag>
                  <Tag color="#ffb0de">X: {WEAPONS[ship.loadout.special]?.short}</Tag>
                  {ship.equippedDrone && <Tag color="#7dffe0">{DRONE_TYPES[ship.equippedDrone].id.toUpperCase()} DRONE</Tag>}
                </div>
              </div>
              <div className="label text-right">DRAG · ORBIT<br />WHEEL · ZOOM</div>
            </div>
          </div>

          {/* shop / fitting column */}
          <div className="flex flex-col gap-3 overflow-y-auto hide-scroll pr-1">
            {bayTab === "ships" && (
              <>
                <Group title={`SPACECRAFT · OWNED ${profile.ownedShips.length}/${FIGHTER_ORDER.length}`}>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {FIGHTER_ORDER.map((id) => {
                      const sc = SHIP_CLASSES[id];
                      const owned = profile.ownedShips.includes(id);
                      const eq = ship.classId === id;
                      return (
                        <button key={id} onClick={() => setInspectShip(id)}
                          className={`notch-sm flex items-center justify-between gap-1 border px-2.5 py-2 text-left text-[10.5px] ${inspectShip === id ? "btn-sel" : "bg-[rgba(8,14,30,.7)]"}`}
                          style={{ borderColor: inspectShip === id ? "#4fe3ff" : "rgba(120,170,220,.18)" }}>
                          <span className="min-w-0">
                            <span className="block truncate font-display font-bold text-white">{sc.name}</span>
                            <span className="block truncate text-[9.5px] text-[#93add0]">{sc.role}</span>
                          </span>
                          <span className="shrink-0 font-display text-[9.5px] font-bold" style={{ color: eq ? "#a8ff4d" : owned ? "#7fe9ff" : "#ffc24a" }}>
                            {eq ? "EQUIPPED" : owned ? "OWNED" : `${sc.price}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2"><StatBars bars={cls.bars} /></div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {shipOwned ? (
                      <Btn variant={shipEquipped ? "btn-ghost" : "btn-primary"} disabled={shipEquipped} onClick={buyShip}>
                        {shipEquipped ? "✓ ACTIVE SPACECRAFT" : `EQUIP ${cls.name}`}
                      </Btn>
                    ) : (
                      <Btn variant="btn-primary" disabled={profile.coins < cls.price} onClick={buyShip}>
                        BUY & EQUIP · {cls.price} COINS
                      </Btn>
                    )}
                    <span className="text-[10.5px] text-[#93add0]">Hull stats are identical for every pilot — purchases unlock, never buff.</span>
                  </div>
                </Group>
                <Group title="FLIGHT & WEAPON STATISTICS">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Readout k="HULL" v={info.hull} c="#a8ff4d" />
                    <Readout k="SHIELD" v={info.shield} c="#4fe3ff" />
                    <Readout k="MAX VEL" v={info.speed} c="#ffc24a" />
                    <Readout k="ACCEL" v={info.accel} c="#35f0e0" />
                    <Readout k="BURST DPS" v={info.dps} c="#ff4fb0" />
                    <Readout k="ARMOR MOD" v={`×${(1 + (ship.loadout.armorMod - 1) * 0.16).toFixed(2)}`} c="#a8ff4d" small />
                    <Readout k="SHIELD MOD" v={`×${(1 + (ship.loadout.shieldMod - 1) * 0.2).toFixed(2)}`} c="#4fe3ff" small />
                    <Readout k="ENGINE MOD" v={`×${(1 + (ship.loadout.engineMod - 1) * 0.14).toFixed(2)}`} c="#ffc24a" small />
                  </div>
                </Group>
              </>
            )}

            {bayTab === "drones" && (
              <>
                <Group title="MANDATORY DRONE EQUIP RULE">
                  <div className="notch-sm border border-[rgba(255,194,74,.35)] bg-[rgba(255,194,74,.08)] px-3 py-2 text-[11.5px] leading-relaxed text-[#ffe0a8]">
                    Only an <b>owned</b> and <b>explicitly equipped</b> drone spawns with your ship. If you unequip, <b>no drone</b> follows you — including after respawn and in rematches.
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-[#a9c4e4]">Equipped: <b className="text-[#7dffe0]">{ship.equippedDrone ? DRONE_TYPES[ship.equippedDrone].name : "NONE — FLYING SOLO"}</b></span>
                    <button onClick={() => { setShip({ ...ship, equippedDrone: null }); notify("Drone unequipped — no drone will spawn."); }}
                      className={`btn notch-sm px-3 py-1 text-[10px] ${!ship.equippedDrone ? "btn-sel" : "btn-ghost"}`}>UNEQUIP</button>
                  </div>
                </Group>
                <Group title={`SIX COMBAT DRONES · OWNED ${profile.ownedDrones.length}/${DRONE_ORDER.length}`}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {DRONE_ORDER.map((id) => {
                      const d = DRONE_TYPES[id];
                      const owned = profile.ownedDrones.includes(id);
                      const eq = ship.equippedDrone === id;
                      return (
                        <button key={id} onClick={() => setInspectDrone(id)}
                          className={`notch-sm flex flex-col gap-1 border p-2.5 text-left ${inspectDrone === id ? "btn-sel" : "bg-[rgba(8,14,30,.72)]"}`}
                          style={{ borderColor: inspectDrone === id ? "#7dffe0" : "rgba(120,170,220,.18)" }}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-display text-[11.5px] font-bold text-white">{d.name}</span>
                            <Tag color={eq ? "#a8ff4d" : owned ? "#4fe3ff" : "#ffc24a"}>{eq ? "EQUIPPED" : owned ? "OWNED" : `${d.price}`}</Tag>
                          </div>
                          <span className="text-[10px] text-[#7fe9ff]">{d.role}</span>
                          <span className="text-[10.5px] leading-snug text-[#93add0]">{d.perk}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {droneOwned ? (
                      <Btn variant={droneEquipped ? "btn-ghost" : "btn-primary"} onClick={buyOrEquipDrone}>
                        {droneEquipped ? "UNEQUIP DRONE" : `EQUIP ${droneSpec.name}`}
                      </Btn>
                    ) : (
                      <Btn variant="btn-primary" disabled={profile.coins < droneSpec.price} onClick={buyOrEquipDrone}>
                        BUY & EQUIP · {droneSpec.price} COINS
                      </Btn>
                    )}
                    <span className="text-[10.5px] text-[#93add0]">Optional support — no combat advantage is sold beyond the listed drone stats.</span>
                  </div>
                  <div className="mt-3"><StatBars bars={droneSpec.bars} /></div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                    <Readout k="HULL" v={droneSpec.hull} c="#a8ff4d" />
                    <Readout k="SHIELD" v={droneSpec.shield} c="#4fe3ff" />
                    <Readout k="RANGE" v={`${droneSpec.range}m`} c="#ffc24a" small />
                    <Readout k="WEAPON" v={WEAPONS[droneSpec.weapon].short} c="#7dffe0" small />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#93add0]">
                    AI states: Follow · Search · Target · Lock On · Attack · Defend · Return · Recover · Destroyed.
                  </p>
                </Group>
              </>
            )}

            {bayTab === "armory" && (
              <>
                <Group title={`WEAPONS ARMORY · OWNED ${profile.ownedWeapons.length}/${WEAPON_SHOP.length}`}>
                  {([["PRIMARY LASERS & PLASMA", PRIMARY_WEAPONS], ["MISSILES, ROCKETS & DEFENSES", SECONDARY_WEAPONS], ["SPECIAL X-SLOT", SPECIAL_WEAPONS]] as const).map(([label, list]) => (
                    <div key={label} className="mb-2.5">
                      <div className="label mb-1">{label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((w) => {
                          const owned = profile.ownedWeapons.includes(w);
                          const price = WEAPON_PRICES[w] ?? 0;
                          const active = ship.loadout.primary === w || ship.loadout.secondary === w || ship.loadout.special === w;
                          return (
                            <button key={w} onClick={() => acquireWeapon(w)}
                              className={`btn notch-sm px-2.5 py-1.5 text-[10px] ${active ? "btn-sel" : owned ? "btn-ghost" : "btn-ghost"}`}
                              style={{ borderColor: active ? "#4fe3ff" : owned ? "rgba(120,190,240,.3)" : "rgba(255,194,74,.45)" }}>
                              {WEAPONS[w].short}
                              <span className="ml-1.5 font-normal opacity-80">
                                {owned ? (active ? "✓" : "") : `◈${price}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11.5px] leading-relaxed text-[#93add0]">
                    Click a locked weapon to buy it (if you can afford it) — it is then equipped into its matching slot. Every price is capped at {MAX_ITEM_PRICE} coins.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
                    {(["primary", "secondary", "special"] as const).map((slot) => {
                      const id = ship.loadout[slot];
                      return (
                        <div key={slot} className="flex items-center justify-between gap-2 border-b border-[rgba(120,180,240,.1)] pb-1">
                          <span className="label text-[#7fe9ff]">{slot.toUpperCase()} · {WEAPONS[id].name}</span>
                          <span className="text-[10px] text-[#ffc24a]">{WEAPON_PRICES[id] ? (profile.ownedWeapons.includes(id) ? "OWNED" : `LOCKED ◈${WEAPON_PRICES[id]}`) : "STARTER"}</span>
                        </div>
                      );
                    })}
                  </div>
                </Group>
                <Group title="BALANCED UPGRADES · NO PAY-TO-WIN">
                  {([["armorMod", "ARMOR PLATING"], ["shieldMod", "SHIELD MATRIX"], ["engineMod", "ENGINE CORE"]] as const).map(([key, label]) => (
                    <div key={key} className="mb-1.5 flex items-center gap-2">
                      <span className="label w-[110px]">{label}</span>
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((v) => (
                          <button key={v} onClick={() => setShip({ ...ship, loadout: { ...ship.loadout, [key]: v } })}
                            className={`btn notch-sm h-7 w-9 px-0 text-[10px] ${ship.loadout[key] === v ? "btn-sel" : "btn-ghost"}`}>
                            {["I", "II", "III"][v]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] leading-snug text-[#93add0]">Free, symmetrical tuning applied to every loadout — no stat is sold for coins.</p>
                </Group>
              </>
            )}

            {bayTab === "cosmetics" && (
              <>
                <Group title="COSMETICS NEVER CHANGE COMBAT STATS">
                  <p className="text-[11.5px] leading-relaxed text-[#a9c4e4]">
                    Paint, engine glow, laser tint and missile trails are purely visual. Locked options show their price —
                    click to buy, then it is applied instantly.
                  </p>
                </Group>
                <Group title={`HULL PAINT · OWNED ${profile.ownedPaints.length}/${PAINTS.length}`}>
                  <div className="flex flex-wrap gap-2">
                    {PAINTS.map((pt, i) => {
                      const owned = profile.ownedPaints.includes(i);
                      const active = ship.paintIndex === i;
                      return (
                        <button key={pt.name} onClick={() => acquirePaint(i)} className="group flex flex-col items-center gap-0.5">
                          <span className="relative h-9 w-9 notch-sm transition-transform group-hover:scale-110" style={{
                            background: `linear-gradient(135deg, #${pt.hull.toString(16).padStart(6, "0")}, #${pt.trim.toString(16).padStart(6, "0")})`,
                            border: active ? "2px solid #4fe3ff" : owned ? "1px solid rgba(255,255,255,.2)" : "1px solid rgba(255,194,74,.6)",
                            boxShadow: active ? `0 0 16px #${pt.engine.toString(16).padStart(6, "0")}` : "none",
                          }}>
                            {!owned && <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-display text-[9px] font-black text-[#ffc24a]">◈{PAINT_PRICES[i]}</span>}
                          </span>
                          <span className="label text-[8px]">{pt.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </Group>
                <Group title={`ENGINE GLOW · OWNED ${profile.ownedEngineColors.length}/${ENGINE_COLORS.length}`}>
                  <div className="flex flex-wrap gap-1.5">
                    {ENGINE_COLORS.map((ec, i) => {
                      const owned = profile.ownedEngineColors.includes(i);
                      return (
                        <button key={ec.name} onClick={() => acquireEngine(i)}
                          className={`btn notch-sm px-2 py-1 text-[9.5px] ${(ship.engineColorIndex ?? 0) === i ? "btn-sel" : "btn-ghost"}`}>
                          {ec.name}{!owned && ` ◈${ENGINE_COLOR_PRICES[i]}`}
                        </button>
                      );
                    })}
                  </div>
                </Group>
                <Group title={`LASER TINT · OWNED ${profile.ownedLaserColors.length}/${LASER_COLORS.length}`}>
                  <div className="flex flex-wrap gap-1.5">
                    {LASER_COLORS.map((lc, i) => {
                      const owned = profile.ownedLaserColors.includes(i);
                      return (
                        <button key={lc.name} onClick={() => acquireLaser(i)}
                          className={`btn notch-sm px-2 py-1 text-[9.5px] ${(ship.laserColorIndex ?? 0) === i ? "btn-sel" : "btn-ghost"}`}>
                          {lc.name}{!owned && ` ◈${LASER_COLOR_PRICES[i]}`}
                        </button>
                      );
                    })}
                  </div>
                </Group>
                <Group title={`MISSILE TRAIL · OWNED ${profile.ownedTrailColors.length}/${TRAIL_COLORS.length}`}>
                  <div className="flex flex-wrap gap-1.5">
                    {TRAIL_COLORS.map((tc, i) => {
                      const owned = profile.ownedTrailColors.includes(i);
                      return (
                        <button key={tc.name} onClick={() => acquireTrail(i)}
                          className={`btn notch-sm px-2 py-1 text-[9.5px] ${(ship.trailColorIndex ?? 0) === i ? "btn-sel" : "btn-ghost"}`}>
                          {tc.name}{!owned && ` ◈${TRAIL_COLOR_PRICES[i]}`}
                        </button>
                      );
                    })}
                  </div>
                </Group>
              </>
            )}

            <div className="panel notch flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <div className="label">SAVED PROFILE · NEW PILOTS RECEIVE 10,000 COINS ONCE</div>
                <div className="font-display text-[13px] font-black text-[#ffc24a]">◈ {profile.coins.toLocaleString()} COINS</div>
                <div className="text-[10.5px] text-[#93add0]">
                  {profile.stats.matches} matches · {profile.stats.wins} wins · {profile.stats.coinsEarned} coins earned
                </div>
                <div className="mt-1 max-w-[360px] text-[10px] leading-snug text-[#6f89a8]">
                  Prices are capped at {MAX_ITEM_PRICE} coins. Cosmetics are visual only. This standalone build has no
                  server: purchases and rewards are validated and persisted locally, then broadcast to connected Arena tabs.
                </div>
              </div>
              <Btn onClick={onBack} variant="btn-primary">SAVE & RETURN ▸</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel notch p-3">
      <div className="label mb-2 flex items-center gap-2 text-[#7fe9ff]"><span className="h-px w-4 bg-[#4fe3ff]" />{title}</div>
      {children}
    </div>
  );
}
function Readout({ k, v, c, small }: { k: string; v: string | number; c: string; small?: boolean }) {
  return (
    <div>
      <div className="label text-[9px]">{k}</div>
      <div className={`font-display font-black ${small ? "text-[11px]" : "text-[19px]"}`} style={{ color: c, textShadow: `0 0 16px ${c}55` }}>{v}</div>
    </div>
  );
}

/* ---------------- ONLINE LINK LOBBY (1v1, 2v2, 5v5) ---------------- */

export function LobbyScreen({
  settings, arena, setArena, ship, initialMode = "duel", onBack, onLaunch,
}: {
  settings: GameSettings;
  arena: string;
  setArena: (a: string) => void;
  ship: ShipConfig;
  initialMode?: "duel" | "wing" | "team";
  onBack: () => void;
  onLaunch: (mode: "duel" | "wing" | "team", room: string, role: "host" | "client", aiFill: boolean) => void;
}) {
  const [mode, setMode] = useState<"duel" | "wing" | "team">(initialMode);
  const [room, setRoom] = useState(makeRoomCode());
  const [role, setRole] = useState<"host" | "client" | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [status, setStatus] = useState("Create a room or join with a code.");
  const [aiFill, setAiFill] = useState(true);
  const lobbyRef = useRef<Lobby | null>(null);

  useEffect(() => () => { lobbyRef.current?.close(); }, []);

  const parseMode = (m: string): "duel" | "wing" | "team" => (m === "team" ? "team" : m === "wing" ? "wing" : "duel");

  const startHost = () => {
    const l = new Lobby();
    lobbyRef.current = l;
    l.onStatus = setStatus;
    l.onRoster = setPlayers;
    l.onStart = (a, m) => {
      setArena(a);
      l.close();
      onLaunch(parseMode(m), room, "host", aiFill);
    };
    if (l.host(room, settings.playerName)) setRole("host");
  };
  const startJoin = () => {
    const l = new Lobby();
    lobbyRef.current = l;
    l.onStatus = setStatus;
    l.onRoster = setPlayers;
    l.onStart = (a, m) => {
      setArena(a);
      l.close();
      onLaunch(parseMode(m), room, "client", false);
    };
    if (l.join(room.trim().toUpperCase(), settings.playerName)) setRole("client");
  };
  const leave = () => { lobbyRef.current?.close(); lobbyRef.current = null; setRole(null); setPlayers([]); setStatus("Left the room."); };

  const slots = mode === "team" ? 10 : mode === "wing" ? 4 : 2;
  const humans = players.length;

  return (
    <div className="starfield-bg vignette relative h-full w-full overflow-y-auto hide-scroll">
      <div className="aurora pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1100px] flex-col gap-4 px-4 py-5">
        <header className="flex items-center justify-between border-b border-[rgba(120,180,240,.16)] pb-3">
          <div>
            <div className="label text-[#7fe9ff]">MULTIPLAYER</div>
            <h1 className="font-display text-[26px] font-black leading-none tracking-[0.1em] text-white">LINK LOBBY · 1v1 / 2v2 / 5v5</h1>
          </div>
          <Btn onClick={() => { leave(); onBack(); }}>◂ BACK</Btn>
        </header>

        <div className="panel notch p-4 text-[12.5px] leading-relaxed text-[#a9c4e4]">
          <b className="font-display tracking-[0.12em] text-[#ffc24a]">HOW ONLINE WORKS IN THIS BUILD —</b>{" "}
          real player-to-player networking is implemented over a <b className="text-[#7fe9ff]">host-authoritative link channel
          (BroadcastChannel)</b>: the host simulates the battle and validates every hit, clients send only inputs and render
          interpolated state. This connects real human pilots across <b>tabs/windows of the same browser profile on the same device</b>.
          {LINK_SUPPORTED ? "" : " Your browser does not expose BroadcastChannel, so linking is unavailable — offline modes still work fully."}
          No AI opponent is ever disguised as a human — AI fillers are always labelled <b className="text-[#a8ff4d]">AI·</b>.
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="panel notch flex flex-col gap-3 p-4">
            <div className="label text-[#7fe9ff]">MATCH TYPE</div>
            <div className="flex gap-2">
              <button onClick={() => setMode("duel")} className={`btn notch-sm flex-1 px-3 py-2.5 text-[11px] ${mode === "duel" ? "btn-sel" : "btn-ghost"}`}>ONLINE 1v1</button>
              <button onClick={() => setMode("wing")} className={`btn notch-sm flex-1 px-3 py-2.5 text-[11px] ${mode === "wing" ? "btn-sel" : "btn-ghost"}`}>ONLINE 2v2</button>
              <button onClick={() => setMode("team")} className={`btn notch-sm flex-1 px-3 py-2.5 text-[11px] ${mode === "team" ? "btn-sel" : "btn-ghost"}`}>ONLINE 5v5</button>
            </div>
            <div className="label mt-1 text-[#7fe9ff]">ROOM CODE</div>
            <div className="flex gap-2">
              <input
                value={room} onChange={(e) => setRoom(e.target.value.toUpperCase().slice(0, 8))}
                className="notch-sm flex-1 border border-[rgba(120,180,240,.3)] bg-[rgba(6,12,26,.9)] px-3 py-2 text-center font-display text-[20px] font-black tracking-[0.32em] text-white outline-none focus:border-[#4fe3ff]"
              />
              <Btn variant="btn-ghost" onClick={() => setRoom(makeRoomCode())}>⟳</Btn>
            </div>
            <div className="flex gap-2">
              <Btn variant="btn-primary" className="flex-1 py-3" onClick={startHost} disabled={!LINK_SUPPORTED || role !== null}>CREATE ROOM</Btn>
              <Btn className="flex-1 py-3" onClick={startJoin} disabled={!LINK_SUPPORTED || role !== null}>JOIN ROOM</Btn>
            </div>
            <button onClick={() => setAiFill(!aiFill)} className="notch-sm flex items-center justify-between border border-[rgba(120,170,220,.18)] bg-[rgba(8,14,30,.7)] px-3 py-2">
              <span className="label">FILL EMPTY SLOTS WITH LABELLED AI</span>
              <span className="font-display text-[12px] font-bold" style={{ color: aiFill ? "#a8ff4d" : "#7e97b8" }}>{aiFill ? "ON" : "OFF"}</span>
            </button>
            <div className="label mt-1 text-[#7fe9ff]">ARENA</div>
            <div className="flex flex-wrap gap-1.5">
              {ARENAS.map((a) => (
                <button key={a.id} onClick={() => setArena(a.id)} className={`btn notch-sm px-2 py-1 text-[9.5px] ${arena === a.id ? "btn-sel" : "btn-ghost"}`}>{a.tag}</button>
              ))}
            </div>
            <p className="text-[11.5px] text-[#93add0]">
              Host: <b className="text-[#7fe9ff]">{ARENAS.find((a) => a.id === arena)?.name}</b> · Ship: <b className="text-[#7fe9ff]">{SHIP_CLASSES[ship.classId].name}</b>
              {ship.equippedDrone ? <> · Drone: <b className="text-[#7dffe0]">{DRONE_TYPES[ship.equippedDrone].name}</b></> : " · Solo (No Drone)"}
            </p>
          </div>

          <div className="panel notch flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="label text-[#ff9ad8]">ROSTER · {humans}/{slots} PILOTS</span>
              {role && <Btn variant="btn-ghost" onClick={leave}>DISCONNECT</Btn>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([0, 1] as const).map((team) => (
                <div key={team}>
                  <div className="label mb-1.5" style={{ color: team === 0 ? "#5fb4ff" : "#ff5f6f" }}>{team === 0 ? "BLUE SQUAD" : "RED SQUAD"}</div>
                  <div className="flex flex-col gap-1">
                    {Array.from({ length: slots / 2 }).map((_, i) => {
                      const pl = players.filter((x) => x.team === team)[i];
                      return (
                        <div key={i} className="notch-sm flex items-center gap-2 border px-2 py-1.5" style={{ borderColor: pl ? (team === 0 ? "rgba(95,180,255,.4)" : "rgba(255,95,111,.4)") : "rgba(120,170,220,.14)", background: pl ? "rgba(10,20,42,.7)" : "rgba(6,10,22,.4)" }}>
                          <span className="h-2 w-2 rotate-45" style={{ background: pl ? (team === 0 ? "#5fb4ff" : "#ff5f6f") : "rgba(120,160,210,.2)" }} />
                          <span className="truncate text-[12px] font-semibold" style={{ color: pl ? "#dce8ff" : "#4d6280" }}>
                            {pl ? pl.name : "OPEN SLOT"}
                          </span>
                          {pl?.host && <Tag color="#ffc24a">HOST</Tag>}
                          {pl?.you && <Tag color="#a8ff4d">YOU</Tag>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="notch-sm border border-[rgba(120,180,240,.18)] bg-[rgba(6,12,26,.7)] px-3 py-2 text-[12px] text-[#a9c4e4]">{status}</div>
            {role === "host" && (
              <Btn variant="btn-primary" className="py-3.5 text-[14px]" onClick={() => lobbyRef.current?.launch(arena, mode, settings.playerName)}>
                ▸ LAUNCH MATCH {aiFill && humans < slots ? "(AI FILLS EMPTY SLOTS)" : ""}
              </Btn>
            )}
            {role === "client" && (
              <div className="notch-sm border border-[rgba(168,255,77,.35)] bg-[rgba(168,255,77,.08)] px-3 py-3 text-center font-display text-[12px] tracking-[0.16em] text-[#a8ff4d] pulse">
                STANDING BY FOR HOST LAUNCH…
              </div>
            )}
            {!role && <div className="label text-center">CREATE OR JOIN A ROOM TO BEGIN</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
