// Local-Link multiplayer transport & Cross-App Profile Sync.
// Uses BroadcastChannel: authoritative host + input-sending clients.
// Also synchronizes player profile, owned ships/drones, and loadouts across connected tabs/apps.

import type { DroneTypeId, PlayerProfile, ShipConfig } from "./content";

export type NetRole = "off" | "host" | "client";

export interface NetShipState {
  id: string;
  p: [number, number, number];
  q: [number, number, number, number];
  hp: number;
  sh: number;
  bs: number;
  al: number; // 1 alive, 0 dead
  th: number; // throttle -1..1
  kl: number;
  tm: 0 | 1;
  nm: string;
  cls: string;
  pt: number;
  ec?: number; // engineColorIndex
  smk?: number;
  bo?: number; // boosting (drives exhaust on clients)
  dr?: DroneTypeId; // if set, this entity is a combat drone of this type
  ow?: string; // owner ship id for drones
  dst?: string; // drone AI state
}

export interface NetProjState {
  p: [number, number, number];
  d: [number, number, number];
  l: number;
  r: number;
  c: number;
}

export interface NetMatchState {
  phase: string;
  time: number;
  score: [number, number];
  alive: [number, number];
  mode: string;
  wave?: number;
}

export type NetMsg =
  | { t: "hello"; id: string; name: string; ship?: ShipConfig }
  | { t: "welcome"; id: string; slot: number; team: 0 | 1 }
  | { t: "roster"; players: { id: string; name: string; team: 0 | 1; host: boolean; ship?: string; drone?: string | null }[] }
  | { t: "start"; arena: string; mode: string; hostName: string; seed: number }
  | { t: "input"; id: string; seq: number; i: Record<string, number> }
  | { t: "state"; tick: number; ships: NetShipState[]; projs: NetProjState[]; m: NetMatchState }
  | { t: "fx"; k: string; p: [number, number, number]; c?: number; s?: number; d?: number }
  | { t: "end"; winner: 0 | 1 | -1; reason: string; stats: Record<string, unknown>; reward?: number; isMvp?: boolean; mvpName?: string; mvpTeam?: 0 | 1; matchId?: string }
  | { t: "leave"; id: string }
  | { t: "ping"; id: string }
  | { t: "pong"; id: string; to: string }
  | { t: "chat"; id: string; name: string; text: string };

export const LINK_SUPPORTED = typeof BroadcastChannel !== "undefined";

export class Link {
  ch: BroadcastChannel | null = null;
  room = "";
  role: NetRole = "off";
  onMessage: (m: NetMsg) => void = () => {};
  onStatus: (s: string) => void = () => {};
  connected = false;
  latency = 0;
  private pingTimers: number[] = [];

  open(room: string, role: Exclude<NetRole, "off">) {
    this.close();
    if (!LINK_SUPPORTED) {
      this.onStatus("This browser has no BroadcastChannel support — local-link play unavailable.");
      return false;
    }
    this.room = room;
    this.role = role;
    try {
      this.ch = new BroadcastChannel(`gw3d:${room}`);
    } catch {
      this.onStatus("Could not open the local link channel.");
      return false;
    }
    this.ch.onmessage = (e: MessageEvent) => {
      const data = e.data as NetMsg & { _rt?: number };
      if (!data || typeof data !== "object") return;
      this.onMessage(data);
    };
    this.connected = true;
    return true;
  }

  send(m: NetMsg) {
    if (!this.ch) return;
    try {
      this.ch.postMessage(m);
    } catch {
      /* structured clone failure — ignore */
    }
  }

  measurePing(id: string) {
    const t0 = performance.now();
    this.send({ t: "ping", id });
    const h = window.setTimeout(() => { void t0; }, 2000);
    this.pingTimers.push(h);
  }
  gotPong() {
    this.latency = Math.round(Math.min(200, this.latency * 0.7 + 8 * 0.3));
  }

  close() {
    this.pingTimers.forEach((t) => window.clearTimeout(t));
    this.pingTimers = [];
    if (this.ch) {
      try { this.ch.close(); } catch { /* noop */ }
      this.ch = null;
    }
    this.connected = false;
    this.role = "off";
    this.room = "";
  }
}

export function makeRoomCode() {
  const chars = "ACDEFGHJKLMNPQRTUVWXY3479";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

/** Cross-App / Cross-Tab Synchronization bus for PlayerProfile & ShipConfig */
export type SyncEvent =
  | { type: "profile"; profile: PlayerProfile }
  | { type: "ship"; ship: ShipConfig };

export class ProfileSyncBus {
  private ch: BroadcastChannel | null = null;
  onSync: (ev: SyncEvent) => void = () => {};

  constructor() {
    if (!LINK_SUPPORTED) return;
    try {
      this.ch = new BroadcastChannel("gw3d:profile-sync");
      this.ch.onmessage = (e: MessageEvent<SyncEvent>) => {
        if (e.data && typeof e.data === "object") this.onSync(e.data);
      };
    } catch {
      /* ignore */
    }
  }

  broadcastProfile(profile: PlayerProfile) {
    try { this.ch?.postMessage({ type: "profile", profile }); } catch { /* ignore */ }
  }

  broadcastShip(ship: ShipConfig) {
    try { this.ch?.postMessage({ type: "ship", ship }); } catch { /* ignore */ }
  }

  close() {
    try { this.ch?.close(); } catch { /* ignore */ }
    this.ch = null;
  }
}
