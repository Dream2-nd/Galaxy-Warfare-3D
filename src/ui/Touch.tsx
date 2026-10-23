import { useCallback, useRef, useState } from "react";
import type { Game } from "@/game/engine";

function Stick({
  onVec, label, color = "#4fe3ff", size = 132,
}: { onVec: (x: number, y: number) => void; label: string; color?: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const idRef = useRef<number | null>(null);

  const handle = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    setKnob({ x: dx, y: dy, active: true });
    onVec(dx, dy);
  }, [onVec]);

  return (
    <div
      ref={ref}
      className="pointer-events-auto relative rounded-full touch-none"
      style={{
        width: size, height: size,
        background: "radial-gradient(circle at 50% 50%, rgba(10,20,40,.62), rgba(4,8,18,.42))",
        border: `1px solid ${color}44`,
        boxShadow: `inset 0 0 26px ${color}22`,
      }}
      onPointerDown={(e) => {
        idRef.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        handle(e);
      }}
      onPointerMove={(e) => { if (idRef.current === e.pointerId) handle(e); }}
      onPointerUp={(e) => {
        if (idRef.current !== e.pointerId) return;
        idRef.current = null;
        setKnob({ x: 0, y: 0, active: false });
        onVec(0, 0);
      }}
      onPointerCancel={() => { idRef.current = null; setKnob({ x: 0, y: 0, active: false }); onVec(0, 0); }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-[70%] w-px" style={{ background: `${color}22` }} />
        <div className="absolute h-px w-[70%]" style={{ background: `${color}22` }} />
      </div>
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: size * 0.36, height: size * 0.36,
          transform: `translate(-50%,-50%) translate(${knob.x * size * 0.3}px, ${knob.y * size * 0.3}px)`,
          background: knob.active ? `radial-gradient(circle at 40% 35%, ${color}, ${color}55)` : `radial-gradient(circle at 40% 35%, ${color}bb, ${color}33)`,
          boxShadow: `0 0 18px ${color}88`,
          border: "1px solid rgba(255,255,255,.35)",
          transition: knob.active ? "none" : "transform .16s ease",
        }}
      />
      <div className="label absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ color }}>{label}</div>
    </div>
  );
}

function Pad({
  onDown, onUp, label, sub, color = "#4fe3ff", size = 74, big,
}: { onDown: () => void; onUp?: () => void; label: string; sub?: string; color?: string; size?: number; big?: boolean }) {
  const [on, setOn] = useState(false);
  return (
    <button
      className="pointer-events-auto relative flex touch-none select-none flex-col items-center justify-center rounded-full font-display"
      style={{
        width: size, height: size,
        background: on ? `radial-gradient(circle at 40% 35%, ${color}, ${color}66)` : "radial-gradient(circle at 40% 35%, rgba(18,32,58,.85), rgba(6,12,26,.7))",
        border: `1.5px solid ${color}${on ? "" : "66"}`,
        boxShadow: on ? `0 0 26px ${color}aa` : `0 0 12px ${color}33, inset 0 0 14px ${color}18`,
        color: on ? "#04121c" : color,
        transform: on ? "scale(.94)" : "scale(1)",
        transition: "transform .08s, background .1s",
      }}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setOn(true); onDown(); }}
      onPointerUp={() => { setOn(false); onUp?.(); }}
      onPointerCancel={() => { setOn(false); onUp?.(); }}
      onPointerLeave={() => { if (on) { setOn(false); onUp?.(); } }}
    >
      <span style={{ fontSize: big ? 15 : 12, fontWeight: 800, letterSpacing: "0.08em" }}>{label}</span>
      {sub && <span className="text-[8.5px] tracking-[0.16em] opacity-70">{sub}</span>}
    </button>
  );
}

export function TouchControls({ game }: { game: Game | null }) {
  if (!game) return null;
  const set = (o: Parameters<Game["setTouch"]>[0]) => game.setTouch(o);
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute bottom-6 left-5">
        <Stick
          label="THRUST / STRAFE"
          onVec={(x, y) => set({ moveX: x, moveY: y })}
          size={138}
        />
      </div>
      <div className="absolute bottom-6 right-5 flex items-end gap-3">
        <div className="mb-16">
          <Stick
            label="AIM"
            color="#ff4fb0"
            size={126}
            onVec={(x, y) => set({ aimX: x, aimY: y })}
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <Pad label="▲" sub="RISE" color="#a8ff4d" size={58} onDown={() => set({ lift: 1 })} onUp={() => set({ lift: 0 })} />
            <Pad label="▼" sub="DROP" color="#a8ff4d" size={58} onDown={() => set({ lift: -1 })} onUp={() => set({ lift: 0 })} />
          </div>
          <Pad label="FIRE" sub="PRIMARY" color="#ff5f6f" size={92} big onDown={() => set({ fire: true })} onUp={() => set({ fire: false })} />
          <div className="flex gap-3">
            <Pad label="ALT" sub="MISSILE" color="#ff8a3d" size={62} onDown={() => set({ alt: true })} onUp={() => set({ alt: false })} />
            <Pad label="BST" sub="TURBO" color="#ffc24a" size={62} onDown={() => set({ boost: true })} onUp={() => set({ boost: false })} />
          </div>
          <div className="flex gap-3">
            <Pad label="SHD" color="#4fe3ff" size={54} onDown={() => set({ shield: true })} onUp={() => set({ shield: false })} />
            <Pad label="X-SP" sub="SPECIAL" color="#ff4fb0" size={54} onDown={() => set({ nova: true })} onUp={() => set({ nova: false })} />
          </div>
          <div className="flex gap-3">
            <Pad label="LOCK" sub="TARGET" color="#ffc24a" size={48} onDown={() => { game.acquireLock(); game.cycleTarget(); }} />
            <Pad label="X-SEL" sub="CYCLE" color="#ff9ad8" size={48} onDown={() => game.cycleSpecial()} />
            <Pad label="DRN" sub="STANCE" color="#7dffe0" size={48} onDown={() => game.toggleDroneStance()} />
            <Pad label="CAM" sub="VIEW" color="#8ea3c0" size={48} onDown={() => game.toggleCamera()} />
          </div>
        </div>
      </div>
    </div>
  );
}
