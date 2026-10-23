import { memo } from "react";
import type { HUDState } from "@/game/engine";
import { WEAPONS, type GameSettings } from "@/game/content";

const fmtTime = (t: number) => {
  const m = Math.floor(Math.max(0, t) / 60);
  const s = Math.floor(Math.max(0, t) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

function Bar({ v, max, color, glow, h = 10 }: { v: number; max: number; color: string; glow: string; h?: number }) {
  const pct = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
  return (
    <div className="bar-track notch-sm relative w-full" style={{ height: h }}>
      <div className="bar-fill h-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${glow}` }} />
      <div className="absolute inset-0 opacity-30" style={{ background: "repeating-linear-gradient(90deg, transparent 0 9px, rgba(0,0,0,.6) 9px 11px)" }} />
    </div>
  );
}

export const HUD = memo(function HUD({ h, onPause, settings }: { h: HUDState; onPause: () => void; settings: GameSettings }) {
  const low = h.hp / Math.max(1, h.maxHp);
  const radarR = 54;
  return (
    <div className="pointer-events-none absolute inset-0 select-none font-body text-[13px]">
      {/* damage vignette */}
      {low < 0.34 && (
        <div className="absolute inset-0 alert" style={{ background: "radial-gradient(110% 80% at 50% 50%, transparent 45%, rgba(255,40,60,.42) 100%)" }} />
      )}
      {h.missileAlert && (
        <div className="absolute inset-0 alert" style={{ boxShadow: "inset 0 0 120px rgba(255,90,60,.6)" }} />
      )}

      {/* ---------- top center: scores + timer ---------- */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 max-sm:origin-top max-sm:scale-[0.78]">
        <div className="panel notch flex items-stretch gap-0 px-0 py-0">
          <div className="flex items-center gap-2 px-4 py-1.5" style={{ background: "linear-gradient(120deg, rgba(50,130,255,.28), transparent)" }}>
            <span className="font-display text-[22px] font-black leading-none text-[#7fc4ff]" style={{ textShadow: "0 0 18px rgba(80,170,255,.7)" }}>{h.score[0]}</span>
            <div className="flex flex-col">
              <span className="label text-[#9ec9ff]">BLUE</span>
              <div className="mt-0.5 flex gap-[3px]">
                {Array.from({ length: Math.max(1, h.alive[0]) }).slice(0, 5).map((_, i) => (
                  <span key={i} className="block h-[5px] w-[7px] skew-x-[-20deg] bg-[#5fb4ff]" style={{ boxShadow: "0 0 8px #5fb4ff" }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center border-x border-[rgba(120,180,240,.18)] px-4">
            <span className="hud-text text-[19px] font-bold leading-none text-white">{fmtTime(h.time)}</span>
            <span className="label mt-0.5">{h.mode === "practice" ? `WAVE ${h.wave}` : h.mode === "free" ? "FREE ROAM" : h.mode === "duel" ? "1v1 DUEL" : h.mode === "wing" ? "2v2 WING" : "5v5"}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5" style={{ background: "linear-gradient(240deg, rgba(255,70,90,.28), transparent)" }}>
            <div className="flex flex-col items-end">
              <span className="label text-[#ffb0b8]">RED</span>
              <div className="mt-0.5 flex gap-[3px]">
                {Array.from({ length: Math.max(1, h.alive[1]) }).slice(0, 5).map((_, i) => (
                  <span key={i} className="block h-[5px] w-[7px] skew-x-[-20deg] bg-[#ff6070]" style={{ boxShadow: "0 0 8px #ff6070" }} />
                ))}
              </div>
            </div>
            <span className="font-display text-[22px] font-black leading-none text-[#ff9aa4]" style={{ textShadow: "0 0 18px rgba(255,90,110,.7)" }}>{h.score[1]}</span>
          </div>
        </div>
      </div>

      {/* ---------- top left: arena ---------- */}
      <div className="absolute left-4 top-3">
        <div className="label text-[#7fe9ff]">{h.arena}</div>
        <div className="font-display text-[13px] font-bold tracking-[0.18em] text-white/80">
          {h.netRole === "off" ? "OFFLINE COMBAT" : h.netRole === "host" ? "LINK · HOST" : "LINK · CLIENT"}
          {h.netRole !== "off" && <span className="ml-2 text-[#a8ff4d]">{h.netPing}ms</span>}
        </div>
        {h.drones && (
          <div className="panel-flat notch-sm mt-1.5 inline-flex flex-wrap items-center gap-2 px-2.5 py-1">
            <span className="label text-[#7dffe0]">{h.drones.name ?? "DRONE"}</span>
            <span className="notch-sm border border-[rgba(125,255,224,.35)] bg-[rgba(125,255,224,.1)] px-1.5 py-[1px] font-display text-[9.5px] font-bold tracking-[0.14em]"
              style={{ color: h.drones.alive > 0 ? "#7dffe0" : "#ff6a7a" }}>
              {h.drones.state ?? (h.drones.alive > 0 ? h.drones.stance : "DESTROYED")}
            </span>
            {h.drones.maxHp && h.drones.alive > 0 && (
              <div className="h-[5px] w-[48px] bg-black/60">
                <div className="h-full bg-[#7dffe0]" style={{ width: `${Math.max(0, Math.min(100, ((h.drones.hp ?? 0) / h.drones.maxHp) * 100))}%`, boxShadow: "0 0 6px #7dffe0" }} />
              </div>
            )}
            <span className="font-display text-[9.5px] font-bold tracking-[0.14em]" style={{ color: h.drones.stance === "ATTACK" ? "#ff9a6a" : "#8fc9ff" }}>{h.drones.stance}</span>
            {h.drones.next > 0 && <span className="num text-[10px] text-white/50">+{Math.ceil(h.drones.next)}s</span>}
            <span className="label text-[9px] text-white/35">[G]</span>
          </div>
        )}
      </div>

      {/* ---------- top right: pilot stats + pause ---------- */}
      <div className="absolute right-4 top-3 flex items-start gap-3">
        <div className="panel-flat notch-sm px-3 py-1.5 text-right">
          <div className="flex gap-4">
            <Stat k="KILLS" v={h.kills} c="#a8ff4d" />
            <Stat k="ASSISTS" v={h.assists} c="#7fe9ff" />
            <Stat k="DEATHS" v={h.deaths} c="#ff9aa4" />
            <Stat k="ACC" v={`${Math.round(h.accuracy * 100)}%`} c="#ffc24a" />
          </div>
        </div>
        <button
          onClick={onPause}
          className="btn btn-ghost pointer-events-auto px-3 py-2 text-[11px]"
          aria-label="Pause"
        >
          ❚❚
        </button>
      </div>
      {settings.showFps && (
        <div className="absolute right-4 top-[62px] label num text-right">
          {Math.round(h.fps)} FPS · {h.camera === "chase" ? "CHASE CAM" : "COCKPIT"}
        </div>
      )}

      {/* ---------- kill feed ---------- */}
      <div className="absolute right-4 top-[92px] flex w-[290px] flex-col items-end gap-1 max-sm:top-[70px] max-sm:w-[170px]">
        {h.feed.map((f) => (
          <div
            key={f.id}
            className="panel-flat notch-sm fade px-2.5 py-1 text-right text-[11.5px] font-semibold tracking-wide"
            style={{
              color: f.kind === "kill" ? "#c9ffb0" : f.kind === "warn" ? "#ffb0b8" : "#a9d8ff",
              borderColor: f.kind === "warn" ? "rgba(255,90,110,.35)" : "rgba(120,200,255,.2)",
            }}
          >
            {f.text}
          </div>
        ))}
      </div>

      {/* ---------- 3D markers ---------- */}
      {h.markers.map((m, i) => {
        if (!m.onScreen) return null;
        const col = m.team === 0 ? "#5fb4ff" : "#ff5f6f";
        if (m.drone) {
          return (
            <div key={i} className="absolute" style={{ left: m.x, top: m.y, transform: "translate(-50%,-50%)" }}>
              <svg width="18" height="18" viewBox="-9 -9 18 18" className="overflow-visible">
                <path d="M-6,-3 L0,4 L6,-3" stroke={m.team === 0 ? "#7dffe0" : col} strokeWidth="1.6" fill="none" opacity="0.85" />
                {m.tracked > 0 && <circle r="8" stroke="#ff4a5a" strokeWidth="1.5" fill="none" className="alert" />}
              </svg>
            </div>
          );
        }
        return (
          <div key={i} className="absolute" style={{ left: m.x, top: m.y, transform: "translate(-50%,-50%)" }}>
            <div className="relative">
              <svg width="56" height="56" viewBox="-28 -28 56 56" className="overflow-visible">
                <g stroke={col} fill="none" strokeWidth="1.6" opacity={m.locked ? 1 : 0.8}>
                  <path d="M-14,-14 L-14,-6 M-14,-14 L-6,-14 M14,-14 L14,-6 M14,-14 L6,-14 M-14,14 L-14,6 M-14,14 L-6,14 M14,14 L14,6 M14,14 L6,14" />
                  {m.locked && <rect x="-17" y="-17" width="34" height="34" strokeDasharray="5 4" opacity="0.85" />}
                </g>
                {m.tracked > 0 && (
                  <g className="spin-slow">
                    <path d="M0,-25 L25,0 L0,25 L-25,0 Z" stroke="#ff4a5a" strokeWidth="2" fill="none" style={{ filter: "drop-shadow(0 0 6px #ff4a5a)" }} />
                    <path d="M0,-31 L0,-25 M31,0 L25,0 M0,31 L0,25 M-31,0 L-25,0" stroke="#ff4a5a" strokeWidth="2" />
                  </g>
                )}
              </svg>
              <div className="absolute left-1/2 top-[20px] w-[120px] -translate-x-1/2 text-center">
                <div className="truncate text-[10px] font-bold tracking-[0.14em]" style={{ color: m.team === 0 ? "#8fc9ff" : "#ff9aa4" }}>{m.name}</div>
                <div className="mx-auto mt-[2px] h-[3px] w-[70px] bg-black/60">
                  <div className="h-full" style={{ width: `${Math.max(0, m.hp) * 100}%`, background: col }} />
                </div>
                {m.tracked > 0
                  ? <div className="alert mt-[1px] font-display text-[9px] font-black tracking-[0.18em] text-[#ff6a7a]">◆ MISSILE LOCK ×{m.tracked}</div>
                  : <div className="label mt-[1px] text-[9px]">{Math.round(m.dist)}m</div>}
              </div>
            </div>
          </div>
        );
      })}

      {/* ---------- lead pip: aim here and primary fire connects ---------- */}
      {h.lead && h.target && (
        <div className="absolute" style={{ left: h.lead.x, top: h.lead.y, transform: "translate(-50%,-50%)" }}>
          <svg width="26" height="26" viewBox="-13 -13 26 26" className="overflow-visible">
            <circle r="7" stroke="#ffe08a" strokeWidth="1.6" fill="none" opacity="0.9" />
            <circle r="1.8" fill="#ffe08a" />
            <path d="M-11,0 L-8,0 M11,0 L8,0 M0,-11 L0,-8 M0,11 L0,8" stroke="#ffe08a" strokeWidth="1.4" />
          </svg>
        </div>
      )}

      {/* ---------- floating damage numbers ---------- */}
      {h.dmgNums.map((d) => (
        <div key={d.id} className="absolute transition-[left,top] duration-75 ease-linear" style={{ left: d.x, top: d.y }}>
          <div className={`dmg-num font-display font-black ${d.kind === "kill" ? "dmg-kill" : ""}`}
            style={{
              color: d.kind === "kill" ? "#ffe08a" : d.kind === "shield" ? "#7fe9ff" : "#ffffff",
              fontSize: d.kind === "kill" ? 18 : Math.min(26, 13 + d.amount * 0.45),
              textShadow: d.kind === "shield" ? "0 0 10px rgba(79,227,255,.9)" : d.kind === "kill" ? "0 0 14px rgba(255,200,80,.9)" : "0 0 10px rgba(255,120,80,.95), 0 2px 0 rgba(0,0,0,.6)",
            }}>
            {d.kind === "kill" ? `DESTROYED +${d.amount}` : d.amount}
          </div>
        </div>
      ))}

      {/* ---------- first-person cockpit frame ---------- */}
      {h.camera === "cockpit" && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
          <defs>
            <linearGradient id="cpStrut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16,28,52,0.88)" />
              <stop offset="50%" stopColor="rgba(8,14,28,0.65)" />
              <stop offset="100%" stopColor="rgba(14,26,48,0.9)" />
            </linearGradient>
          </defs>
          <path d="M0,0 L1600,0 L1600,66 L1340,22 L260,22 L0,66 Z" fill="url(#cpStrut)" stroke="rgba(79,227,255,0.28)" strokeWidth="1.5" />
          <path d="M260,22 L88,900 L64,900 L236,22 Z" fill="url(#cpStrut)" stroke="rgba(79,227,255,0.22)" strokeWidth="1.2" />
          <path d="M1340,22 L1512,900 L1536,900 L1364,22 Z" fill="url(#cpStrut)" stroke="rgba(79,227,255,0.22)" strokeWidth="1.2" />
          <path d="M0,900 L0,842 L420,796 L640,836 L960,836 L1180,796 L1600,842 L1600,900 Z" fill="url(#cpStrut)" stroke="rgba(79,227,255,0.34)" strokeWidth="1.5" />
          <path d="M510,220 L485,220 L485,680 L510,680 M1090,220 L1115,220 L1115,680 L1090,680" fill="none" stroke="rgba(79,227,255,0.22)" strokeWidth="1.5" />
        </svg>
      )}

      {/* ---------- crosshair ---------- */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="150" height="150" viewBox="-75 -75 150 150">
          <circle r="2.2" fill="#eaf9ff" />
          <circle r="26" fill="none" stroke="rgba(160,230,255,.28)" strokeWidth="1" />
          <g stroke="rgba(160,230,255,.6)" strokeWidth="1.4">
            <path d="M-38,0 L-16,0 M38,0 L16,0 M0,-38 L0,-16 M0,38 L0,16" />
          </g>
          <g stroke="rgba(120,220,255,.35)" strokeWidth="1" fill="none">
            <path d="M-9,-9 L-16,-16 M9,-9 L16,-16 M-9,9 L-16,16 M9,9 L16,16" />
          </g>
          {h.lock > 0 && (
            <circle
              r="33" fill="none" stroke={h.lock >= 1 ? "#ff5f6f" : "#ffc24a"} strokeWidth="2.5"
              strokeDasharray={`${h.lock * 207} 207`} transform="rotate(-90)"
              style={{ filter: h.lock >= 1 ? "drop-shadow(0 0 8px #ff5f6f)" : "none" }}
            />
          )}
          {h.lock >= 1 && (
            <g stroke="#ff5f6f" strokeWidth="1.6" fill="none">
              <path d="M-44,-30 L-44,-44 L-30,-44 M44,-30 L44,-44 L30,-44 M-44,30 L-44,44 L-30,44 M44,30 L44,44 L30,44" />
            </g>
          )}
          {h.hitMarker && (
            <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.95" style={{ filter: "drop-shadow(0 0 6px #ff5f6f)" }}>
              <path d="M-11,-11 L-5,-5 M11,-11 L5,-5 M-11,11 L-5,5 M11,11 L5,5" />
            </g>
          )}
        </svg>
      </div>

      {/* ---------- damage direction arcs ---------- */}
      {h.damageDirs.map((a, i) => (
        <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) rotate(${a}rad)` }}>
          <svg width="320" height="320" viewBox="-160 -160 320 320">
            <path d="M-42,-118 A125,125 0 0 1 42,-118" stroke="#ff5f6f" strokeWidth="7" fill="none" opacity="0.85" strokeLinecap="round" />
          </svg>
        </div>
      ))}

      {/* ---------- incoming seekers: direction chevrons ---------- */}
      {h.incoming.map((a, i) => (
        <div key={i} className="alert absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) rotate(${a}rad)` }}>
          <svg width="340" height="340" viewBox="-170 -170 340 340">
            <path d="M-16,-140 L0,-158 L16,-140 M-11,-128 L0,-141 L11,-128" stroke="#ff3a4a" strokeWidth="3.5" fill="none" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px #ff3a4a)" }} />
          </svg>
        </div>
      ))}

      {/* ---------- kill confirmation ---------- */}
      {h.killMarker > 0 && (
        <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) scale(${1 + (1 - h.killMarker) * 0.35})`, opacity: Math.min(1, h.killMarker * 1.6) }}>
          <svg width="96" height="96" viewBox="-48 -48 96 96">
            <g stroke="#ff4a5a" strokeWidth="4" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 8px #ff4a5a)" }}>
              <path d="M-26,-26 L-12,-12 M26,-26 L12,-12 M-26,26 L-12,12 M26,26 L12,12" />
            </g>
          </svg>
        </div>
      )}

      {/* ---------- target readout ---------- */}
      {h.target && (
        <div className="absolute left-1/2 top-[92px] w-[260px] -translate-x-1/2">
          <div className="panel notch-sm px-3 py-2" style={{ borderColor: h.target.team === 0 ? "rgba(95,180,255,.4)" : "rgba(255,95,111,.45)" }}>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[13px] font-bold tracking-[0.1em]" style={{ color: h.target.team === 0 ? "#8fc9ff" : "#ff9aa4" }}>
                {h.target.name}
              </span>
              <span className="label">{Math.round(h.target.dist)}m</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="label w-8">SHD</span>
              <Bar v={h.target.shield} max={100} color="#4fe3ff" glow="rgba(79,227,255,.6)" h={6} />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="label w-8">HUL</span>
              <Bar v={h.target.hp} max={100} color="#ff5f6f" glow="rgba(255,95,111,.6)" h={6} />
            </div>
          </div>
        </div>
      )}

      {/* ---------- bottom left: hull / shield / boost ---------- */}
      <div className="absolute bottom-4 left-4 w-[300px] max-sm:bottom-[196px] max-sm:left-2 max-sm:w-[210px]">
        <div className="panel notch px-3.5 py-3">
          <div className="flex items-end justify-between">
            <span className="label">HULL INTEGRITY</span>
            <span className="hud-text text-[24px] font-black leading-none" style={{ color: low < 0.3 ? "#ff6a7a" : low < 0.6 ? "#ffc24a" : "#a8ff4d", textShadow: low < 0.3 ? "0 0 16px rgba(255,90,110,.8)" : "none" }}>
              {Math.ceil(h.hp)}
              <span className="ml-1 text-[11px] text-white/40">/{Math.round(h.maxHp)}</span>
            </span>
          </div>
          <div className="mt-1.5">
            <Bar v={h.hp} max={h.maxHp} color={low < 0.3 ? "#ff5f6f" : low < 0.6 ? "#ffc24a" : "#7dff8a"} glow={low < 0.3 ? "rgba(255,90,110,.7)" : "rgba(120,255,150,.5)"} h={12} />
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="label">ENERGY SHIELD</span>
            <span className="hud-text text-[13px] font-bold text-[#7fe9ff]">{Math.ceil(h.shield)}</span>
          </div>
          <div className="mt-1">
            <Bar v={h.shield} max={h.maxShield} color="#4fe3ff" glow="rgba(79,227,255,.65)" h={8} />
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="label">BOOST CELL</span>
            <span className="hud-text text-[13px] font-bold text-[#ffc24a]">{Math.round((h.boost / Math.max(1, h.boostMax)) * 100)}%</span>
          </div>
          <div className="mt-1">
            <Bar v={h.boost} max={h.boostMax} color="#ffc24a" glow="rgba(255,194,74,.6)" h={6} />
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-[rgba(120,180,240,.16)] pt-2">
            <span className="label">VELOCITY</span>
            <span className="hud-text text-[15px] font-bold text-white/90">{Math.round(h.speed)} <span className="text-[10px] text-white/40">m/s</span></span>
            <span className="label">THROTTLE</span>
            <div className="relative h-[8px] w-[70px] bar-track notch-sm">
              <div className="absolute top-0 h-full bg-[#4fe3ff]" style={{ left: h.throttle >= 0 ? "50%" : `${50 + h.throttle * 50}%`, width: `${Math.abs(h.throttle) * 50}%` }} />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/40" />
            </div>
          </div>
        </div>
      </div>

      {h.tracking > 0 && (
        <div className="absolute bottom-[86px] left-1/2 -translate-x-1/2 font-display text-[11px] font-black tracking-[0.2em] text-[#ff8a94] max-sm:bottom-[214px]"
          style={{ textShadow: "0 0 12px rgba(255,74,90,.7)" }}>
          ◆ {h.tracking} SEEKER{h.tracking > 1 ? "S" : ""} TRACKING
        </div>
      )}

      {/* ---------- bottom center: weapons ---------- */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-2 max-sm:bottom-[150px] max-sm:gap-1">
        <WeaponSlot idx="1" name={WEAPONS[h.weapon].short} cd={h.weaponCd} color="#54e8ff" active />
        <WeaponSlot idx="2" name={WEAPONS[h.altWeapon].short} cd={h.altCd} color="#ff8a3d"
          ammo={h.missileMag > 0 ? h.missileLoaded : undefined} ammoMax={h.missileMag} />
        <WeaponSlot idx="F" name="FLARES" cd={h.shieldCd / 11} color="#a8ff4d" active={h.shieldActive} />
        <WeaponSlot idx="X" name={WEAPONS[h.specialWeapon].short} cd={h.specialCd} color="#ff4fb0" active={h.specialReady} ult />
      </div>

      {/* ---------- bottom right: radar ---------- */}
      <div className="absolute bottom-4 right-4 max-sm:bottom-[210px] max-sm:right-1 max-sm:origin-bottom-right max-sm:scale-[0.68]">
        <div className="relative">
          <svg width={radarR * 2 + 22} height={radarR * 2 + 22} viewBox={`${-radarR - 11} ${-radarR - 11} ${(radarR + 11) * 2} ${(radarR + 11) * 2}`}>
            <circle r={radarR} fill="rgba(4,10,22,.72)" stroke="rgba(79,227,255,.35)" strokeWidth="1" />
            <circle r={radarR * 0.66} fill="none" stroke="rgba(79,227,255,.16)" strokeWidth="1" />
            <circle r={radarR * 0.33} fill="none" stroke="rgba(79,227,255,.16)" strokeWidth="1" />
            <path d={`M${-radarR},0 L${radarR},0 M0,${-radarR} L0,${radarR}`} stroke="rgba(79,227,255,.14)" strokeWidth="1" />
            <g className="radar-sweep">
              <path d={`M0,0 L0,${-radarR} A${radarR},${radarR} 0 0 1 ${radarR * 0.5},${-radarR * 0.86} Z`} fill="rgba(79,227,255,.16)" />
            </g>
            {h.radar.map((b, i) => (
              <g key={i}>
                <circle
                  cx={b.x * radarR} cy={b.y * radarR} r={b.me ? 3 : 2.6}
                  fill={b.me ? "#eaf9ff" : b.team === 0 ? "#5fb4ff" : "#ff5f6f"}
                  opacity={b.alive ? 1 : 0.25}
                  style={{ filter: b.me ? "none" : `drop-shadow(0 0 5px ${b.team === 0 ? "#5fb4ff" : "#ff5f6f"})` }}
                />
              </g>
            ))}
            <path d={`M0,${-radarR - 6} l-4,6 l8,0 Z`} fill="#4fe3ff" />
          </svg>
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 label whitespace-nowrap">PROXIMITY 1.6km</div>
        </div>
      </div>

      {/* ---------- warnings ---------- */}
      {h.warnings.length > 0 && (
        <div className="absolute bottom-[128px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 max-sm:bottom-[248px]">
          {h.warnings.map((w, i) => (
            <div key={i} className="alert font-display text-[15px] font-black tracking-[0.22em] text-[#ff6a7a]" style={{ textShadow: "0 0 22px rgba(255,60,90,.8)" }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* ---------- countdown ---------- */}
      {h.countdown > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="label mb-2">LAUNCH SEQUENCE</div>
          <div className="font-display text-[120px] font-black leading-none text-white pop" style={{ textShadow: "0 0 60px rgba(79,227,255,.8)" }}>
            {Math.ceil(h.countdown)}
          </div>
          <div className="mt-2 font-display text-[13px] tracking-[0.3em] text-[#7fe9ff]">CLICK TO CAPTURE MOUSE · W/S THRUST · LMB FIRE</div>
        </div>
      )}
    </div>
  );
});

function Stat({ k, v, c }: { k: string; v: number | string; c: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="hud-text text-[17px] font-black leading-none" style={{ color: c }}>{v}</span>
      <span className="label text-[9px]">{k}</span>
    </div>
  );
}

function WeaponSlot({ idx, name, cd, color, active, ult, ammo, ammoMax }: { idx: string; name: string; cd: number; color: string; active?: boolean; ult?: boolean; ammo?: number; ammoMax?: number }) {
  const ready = cd <= 0;
  return (
    <div
      className={`notch-sm relative w-[104px] px-2 py-1.5 text-center max-sm:w-[72px] max-sm:px-1 ${ult ? "w-[118px] max-sm:w-[86px]" : ""}`}
      style={{
        background: ready ? "linear-gradient(160deg, rgba(20,40,74,.9), rgba(6,12,26,.92))" : "rgba(6,10,20,.85)",
        border: `1px solid ${active && ready ? color : "rgba(120,170,220,.2)"}`,
        boxShadow: active && ready ? `0 0 20px ${color}55, inset 0 0 16px ${color}22` : "none",
        opacity: ready ? 1 : 0.72,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="label text-[9px]">{idx}</span>
        <span className="flex items-center gap-1.5">
          {ammo !== undefined && ammoMax !== undefined && (
            <span className="num text-[10px] font-bold" style={{ color: ammo > 0 ? color : "#ff5f6f" }}>
              {String(ammo).padStart(2, "0")}<span className="opacity-50">/{String(ammoMax).padStart(2, "0")}</span>
            </span>
          )}
          {!ready && <span className="num text-[10px] font-bold" style={{ color }}>{cd.toFixed(1)}</span>}
        </span>
      </div>
      <div className="font-display text-[11px] font-bold tracking-[0.1em]" style={{ color: ready ? color : "rgba(200,220,240,.5)" }}>
        {name}
      </div>
      <div className="mt-1 h-[3px] w-full bg-black/60">
        <div className="h-full transition-[width] duration-100" style={{ width: `${(1 - Math.min(1, cd)) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}
