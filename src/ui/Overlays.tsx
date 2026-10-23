import { useState } from "react";
import type { EndResult, HUDState } from "@/game/engine";
import type { GameSettings } from "@/game/content";
import { Btn, Modal, Tag } from "./Screens";

export function PauseOverlay({
  hud, settings, setSettings, onResume, onRestart, onExit,
}: {
  hud: HUDState; settings: GameSettings; setSettings: (s: GameSettings) => void;
  onResume: () => void; onRestart: () => void; onExit: () => void;
}) {
  const [tab, setTab] = useState<"menu" | "settings" | "controls">("menu");
  const set = (o: Partial<GameSettings>) => setSettings({ ...settings, ...o });
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(2,5,14,.72)] p-4 backdrop-blur-[3px] fade">
      <div className="panel notch pop w-full max-w-[520px] p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-display text-[26px] font-black tracking-[0.14em] text-white">PAUSED</h2>
          <span className="label">{hud.arena} · SIMULATION HALTED</span>
        </div>
        <div className="mb-4 flex gap-2 border-b border-[rgba(120,180,240,.18)] pb-3">
          {(["menu", "settings", "controls"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`btn notch-sm px-3 py-1.5 text-[10.5px] ${tab === t ? "btn-sel" : "btn-ghost"}`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "menu" && (
          <div className="flex flex-col gap-2">
            <div className="mb-2 grid grid-cols-4 gap-2">
              <MiniStat k="KILLS" v={hud.kills} c="#a8ff4d" />
              <MiniStat k="ASSISTS" v={hud.assists} c="#7fe9ff" />
              <MiniStat k="ACC" v={`${Math.round(hud.accuracy * 100)}%`} c="#ffc24a" />
              <MiniStat k="DMG" v={hud.dmg} c="#ff9ad8" />
            </div>
            <Btn variant="btn-primary" className="py-3.5 text-[14px]" onClick={onResume}>▸ RESUME COMBAT</Btn>
            <Btn onClick={onRestart}>⟳ RESTART MATCH</Btn>
            <Btn variant="btn-ghost" onClick={onExit}>◂ EXIT TO COMMAND MENU</Btn>
          </div>
        )}

        {tab === "settings" && (
          <div className="flex flex-col gap-3">
            <Row label={`SENSITIVITY · ${settings.sensitivity.toFixed(2)}×`}>
              <input type="range" min={0.2} max={3} step={0.05} value={settings.sensitivity} onChange={(e) => set({ sensitivity: parseFloat(e.target.value) })} className="w-full" />
            </Row>
            <Row label={`SFX VOLUME · ${Math.round(settings.volume * 100)}%`}>
              <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => set({ volume: parseFloat(e.target.value) })} className="w-full" />
            </Row>
            <Row label={`MUSIC VOLUME · ${Math.round(settings.music * 100)}%`}>
              <input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={(e) => set({ music: parseFloat(e.target.value) })} className="w-full" />
            </Row>
            <Row label={`CAMERA SHAKE · ${Math.round(settings.shake * 100)}%`}>
              <input type="range" min={0} max={1.5} step={0.1} value={settings.shake} onChange={(e) => set({ shake: parseFloat(e.target.value) })} className="w-full" />
            </Row>
            <div className="flex gap-2">
              <button onClick={() => set({ invertY: !settings.invertY })} className={`btn notch-sm flex-1 px-2 py-2 text-[10px] ${settings.invertY ? "btn-sel" : "btn-ghost"}`}>INVERT Y</button>
              <button onClick={() => set({ autoLock: !settings.autoLock })} className={`btn notch-sm flex-1 px-2 py-2 text-[10px] ${settings.autoLock ? "btn-sel" : "btn-ghost"}`}>AUTO-LOCK</button>
              <button onClick={() => set({ showFps: !settings.showFps })} className={`btn notch-sm flex-1 px-2 py-2 text-[10px] ${settings.showFps ? "btn-sel" : "btn-ghost"}`}>FPS</button>
            </div>
            <p className="label">GRAPHICS QUALITY: {settings.quality.toUpperCase()} — CHANGE FROM THE MAIN MENU (APPLIED ON RELAUNCH)</p>
          </div>
        )}

        {tab === "controls" && (
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
            {[
              ["W/S", "thrust / brake"], ["A/D", "strafe"], ["SPACE", "rise"], ["CTRL/Z", "descend"],
              ["MOUSE", "aim"], ["Q/E", "roll"], ["SHIFT", "turbo"], ["LMB", "fire"],
              ["RMB", "lock target"], ["TAB", "cycle target"], ["1/2", "weapon slot"], ["F", "shield + flares"],
              ["X", "selected special"], ["V", "cycle X-slot"], ["G", "drone stance"], ["C", "camera"], ["ESC", "pause"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 border-b border-[rgba(120,180,240,.08)] py-1">
                <span className="notch-sm min-w-[54px] border border-[rgba(79,227,255,.3)] bg-[rgba(79,227,255,.07)] px-1.5 py-[2px] text-center font-display text-[10px] font-bold text-[#7fe9ff]">{k}</span>
                <span className="text-[#a9c4e4]">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
    </div>
  );
}
function MiniStat({ k, v, c }: { k: string; v: number | string; c: string }) {
  return (
    <div className="notch-sm border border-[rgba(120,170,220,.18)] bg-[rgba(8,14,30,.7)] px-2 py-1.5 text-center">
      <div className="hud-text text-[18px] font-black leading-none" style={{ color: c }}>{v}</div>
      <div className="label text-[8.5px]">{k}</div>
    </div>
  );
}

export function ResultsScreen({
  result, isRecord, coinsAfter, onRematch, onMenu, onHangar,
}: {
  result: EndResult; isRecord: boolean; coinsAfter: number;
  onRematch: () => void; onMenu: () => void; onHangar: () => void;
}) {
  const [scores, setScores] = useState(false);
  const won = result.won;
  const acc = result.shots ? Math.round((result.hits / result.shots) * 100) : 0;
  const mins = Math.floor(result.time / 60);
  const secs = result.time % 60;
  return (
    <div className="starfield-bg vignette scanlines absolute inset-0 z-50 flex items-center justify-center overflow-y-auto hide-scroll bg-[rgba(2,5,14,.9)] p-4 fade">
      <div className="panel notch pop relative w-full max-w-[820px] p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: won ? "linear-gradient(90deg,#a8ff4d,#4fe3ff)" : "linear-gradient(90deg,#ff5a5a,#ff4fb0)" }} />
        <div className="text-center">
          <div className="label" style={{ color: won ? "#a8ff4d" : "#ff8a94" }}>
            {result.mode === "practice" ? "PRACTICE RUN COMPLETE" : result.mode === "duel" ? "1v1 DUEL RESULT" : result.mode === "wing" ? "2v2 WING BATTLE RESULT" : result.mode === "team" ? "5v5 SQUADRON BATTLE RESULT" : "FLIGHT LOG"}
          </div>
          <h1
            className="font-display text-[clamp(40px,9vw,86px)] font-black leading-[0.9] tracking-[0.04em]"
            style={{ color: won ? "#c9ffb0" : "#ffb0b8", textShadow: won ? "0 0 60px rgba(168,255,77,.55)" : "0 0 60px rgba(255,90,110,.5)" }}
          >
            {won ? "VICTORY" : "DEFEAT"}
          </h1>
          <p className="mt-1 text-[13px] tracking-[0.1em] text-[#a9c4e4]">{result.reason.toUpperCase()}</p>

          {result.isMvp && result.won ? (
            <div className="pop mx-auto mt-3 inline-flex flex-col items-center gap-1 rounded-sm border border-[#ffd34d] bg-[rgba(255,194,74,.14)] px-5 py-2">
              <span className="font-display text-[15px] font-black tracking-[0.22em] text-[#ffd34d]" style={{ textShadow: "0 0 22px rgba(255,211,77,.65)" }}>
                ★ MATCH MVP ★
              </span>
              <span className="text-[10.5px] tracking-[0.14em] text-[#ffe9b0]">WINNING TEAM MVP · FULL 100 COIN BONUS</span>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {result.mvpName && result.mvpName !== "—" && <Tag color="#ffd34d">MVP: {result.mvpName}</Tag>}
              {isRecord && <Tag color="#ffc24a">★ NEW LOCAL HIGH SCORE</Tag>}
            </div>
          )}
          {result.isMvp && result.won && isRecord && (
            <div className="mt-2"><Tag color="#ffc24a">★ NEW LOCAL HIGH SCORE</Tag></div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="notch-sm border border-[rgba(168,255,77,.45)] bg-[rgba(168,255,77,.1)] px-4 py-3 text-center">
            <div className="label text-[#a8ff4d]">COINS EARNED</div>
            <div className="hud-text text-[30px] font-black leading-none text-[#d6ffb8]" style={{ textShadow: "0 0 26px rgba(168,255,77,.55)" }}>
              +{result.reward.toLocaleString()}
            </div>
            <div className="mt-1 text-[10.5px] tracking-[0.1em] text-[#a9c4e4]">
              {result.won ? (result.isMvp ? "WINNING MVP · 100 COINS" : "VICTORY BONUS · 50–70") : "DEFEAT BONUS · 30–50"}
            </div>
          </div>
          <div className="notch-sm border border-[rgba(255,194,74,.45)] bg-[rgba(255,194,74,.1)] px-4 py-3 text-center">
            <div className="label text-[#ffc24a]">NEW COIN BALANCE</div>
            <div className="hud-text text-[30px] font-black leading-none text-[#ffe7a8]" style={{ textShadow: "0 0 26px rgba(255,194,74,.5)" }}>
              ◈ {coinsAfter.toLocaleString()}
            </div>
            <div className="mt-1 text-[10.5px] tracking-[0.1em] text-[#a9c4e4]">CREDITED TO YOUR SAVED PROFILE</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <BigStat k="SCORE" v={result.score.toLocaleString()} c="#ffc24a" />
          <BigStat k="KILLS" v={result.kills} c="#a8ff4d" />
          <BigStat k="ASSISTS" v={result.assists} c="#7fe9ff" />
          <BigStat k="ACCURACY" v={`${acc}%`} c="#ff9ad8" />
          <BigStat k="TIME" v={`${mins}:${secs.toString().padStart(2, "0")}`} c="#dce8ff" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <BigStat k="DAMAGE DEALT" v={result.damage} c="#ff8a3d" small />
          <BigStat k="SHOTS FIRED" v={result.shots} c="#8ea3c0" small />
          <BigStat k={result.mode === "practice" ? "WAVE REACHED" : "DEATHS"} v={result.mode === "practice" ? result.wave : result.deaths} c="#8ea3c0" small />
        </div>

        <div className="mt-5">
          <div className="label mb-2 flex items-center gap-2 text-[#7fe9ff]"><span className="h-px w-4 bg-[#4fe3ff]" />MATCH SCOREBOARD</div>
          <div className="max-h-[210px] overflow-y-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="label border-b border-[rgba(120,180,240,.2)]">
                  <th className="py-1 text-left">PILOT</th><th className="text-left">SIDE</th>
                  <th className="text-right">KILLS</th><th className="text-right">DEATHS</th><th className="text-right">SCORE</th>
                </tr>
              </thead>
              <tbody>
                {result.players.map((pl, i) => (
                  <tr key={i} className="border-b border-[rgba(120,180,240,.08)]" style={{ background: pl.me ? "rgba(79,227,255,.09)" : "transparent" }}>
                    <td className="py-1 font-semibold text-white">
                      {pl.name} {pl.me && <Tag color="#a8ff4d">YOU</Tag>} {pl.bot && <Tag color="#ffc24a">AI</Tag>}
                      {result.mvpName === pl.name && <Tag color="#ffd34d">MVP</Tag>}
                    </td>
                    <td style={{ color: pl.team === 0 ? "#5fb4ff" : "#ff5f6f" }}>{pl.team === 0 ? "BLUE" : "RED"}</td>
                    <td className="num text-right text-[#a8ff4d]">{pl.kills}</td>
                    <td className="num text-right text-[#ff8a94]">{pl.deaths}</td>
                    <td className="num text-right font-display font-bold text-white">{pl.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Btn variant="btn-primary" className="flex-1 py-3.5 text-[13px]" onClick={onRematch}>⟳ REMATCH</Btn>
          <Btn className="py-3.5" onClick={onHangar}>⬡ HANGAR</Btn>
          <Btn variant="btn-ghost" className="py-3.5" onClick={() => setScores(true)}>◈ SCORES</Btn>
          <Btn variant="btn-ghost" className="py-3.5" onClick={onMenu}>◂ MAIN MENU</Btn>
        </div>
      </div>
      {scores && <ScoresOverlay onClose={() => setScores(false)} />}
    </div>
  );
}

function BigStat({ k, v, c, small }: { k: string; v: string | number; c: string; small?: boolean }) {
  return (
    <div className="notch-sm border border-[rgba(120,170,220,.18)] bg-[rgba(8,14,30,.72)] px-3 py-2 text-center">
      <div className={`hud-text font-black leading-none ${small ? "text-[16px]" : "text-[26px]"}`} style={{ color: c, textShadow: `0 0 22px ${c}44` }}>{v}</div>
      <div className="label mt-1 text-[8.5px]">{k}</div>
    </div>
  );
}

function ScoresOverlay({ onClose }: { onClose: () => void }) {
  const raw = localStorage.getItem("gw3d.scores.v1");
  const list = raw ? (JSON.parse(raw) as { name: string; score: number; kills: number; acc: number; mode: string; wave: number; won: boolean }[]) : [];
  return (
    <Modal title="LOCAL HIGH SCORES" onClose={onClose} wide>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="label border-b border-[rgba(120,180,240,.2)]">
            <th className="py-1 text-left">#</th><th className="text-left">PILOT</th><th className="text-left">MODE</th>
            <th className="text-right">KILLS</th><th className="text-right">ACC</th><th className="text-right">SCORE</th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 10).map((s, i) => (
            <tr key={i} className="border-b border-[rgba(120,180,240,.08)]">
              <td className="py-1 font-display font-bold text-[#ffc24a]">{i + 1}</td>
              <td className="font-semibold text-white">{s.name}</td>
              <td className="text-[#93add0]">{s.mode}</td>
              <td className="num text-right text-[#a8ff4d]">{s.kills}</td>
              <td className="num text-right text-[#7fe9ff]">{Math.round(s.acc * 100)}%</td>
              <td className="num text-right font-display font-black text-white">{s.score.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end"><Btn onClick={onClose}>CLOSE</Btn></div>
    </Modal>
  );
}
