import { Link, LINK_SUPPORTED, type NetMsg } from "./net";

export interface LobbyPlayer { id: string; name: string; team: 0 | 1; host: boolean; you?: boolean }

/** Pre-match room management for local-link multiplayer. */
export class Lobby {
  link = new Link();
  role: "host" | "client" = "host";
  room = "";
  myId = "";
  players: LobbyPlayer[] = [];
  status = "";
  ready = false;
  onRoster: (p: LobbyPlayer[]) => void = () => {};
  onStatus: (s: string) => void = () => {};
  onStart: (arena: string, mode: string) => void = () => {};

  host(room: string, name: string) {
    if (!LINK_SUPPORTED) { this.onStatus("BroadcastChannel unsupported in this browser."); return false; }
    this.close();
    this.role = "host";
    this.room = room;
    this.myId = "H_" + Math.random().toString(36).slice(2, 8);
    this.players = [{ id: this.myId, name, team: 0, host: true, you: true }];
    if (!this.link.open(room, "host")) { this.onStatus("Could not open the link channel."); return false; }
    this.link.onMessage = (m) => this.onMsg(m);
    this.ready = true;
    this.onStatus(`Hosting room ${room} — share the code with a pilot on this device/browser profile.`);
    this.emit();
    return true;
  }

  join(room: string, name: string) {
    if (!LINK_SUPPORTED) { this.onStatus("BroadcastChannel unsupported in this browser."); return false; }
    this.close();
    this.role = "client";
    this.room = room;
    this.myId = "C_" + Math.random().toString(36).slice(2, 8);
    if (!this.link.open(room, "client")) { this.onStatus("Could not open the link channel."); return false; }
    this.link.onMessage = (m) => this.onMsg(m);
    this.link.send({ t: "hello", id: this.myId, name });
    this.onStatus("Hailing host…");
    return true;
  }

  private onMsg(m: NetMsg) {
    if (this.role === "host") {
      if (m.t === "hello") {
        if (!this.players.some((p) => p.id === m.id)) {
          const t0 = this.players.filter((p) => p.team === 0).length;
          const t1 = this.players.filter((p) => p.team === 1).length;
          const team: 0 | 1 = this.players.length === 1 ? 1 : t0 <= t1 ? 0 : 1;
          this.players.push({ id: m.id, name: m.name, team, host: false });
          this.onStatus(`${m.name} joined the room.`);
          this.emit();
        }
        const p = this.players.find((x) => x.id === m.id);
        this.link.send({ t: "welcome", id: m.id, slot: 0, team: p ? p.team : 0 });
        this.broadcastRoster();
      } else if (m.t === "leave") {
        this.players = this.players.filter((p) => p.id !== m.id);
        this.emit();
        this.broadcastRoster();
      } else if (m.t === "ping") {
        this.link.send({ t: "pong", id: this.myId, to: m.id });
      }
    } else {
      if (m.t === "welcome" && m.id === this.myId) {
        this.ready = true;
        this.onStatus("Linked to host. Standing by for launch…");
      } else if (m.t === "roster") {
        this.players = m.players.map((p) => ({ ...p, you: p.id === this.myId }));
        this.emit();
      } else if (m.t === "start") {
        this.onStart(m.arena, m.mode);
      }
    }
  }

  private broadcastRoster() {
    this.link.send({
      t: "roster",
      players: this.players.map((p) => ({ id: p.id, name: p.name, team: p.team, host: p.host })),
    });
  }
  private emit() { this.onRoster([...this.players]); }

  launch(arena: string, mode: string, name: string) {
    this.link.send({ t: "start", arena, mode, hostName: name, seed: (Math.random() * 1e6) | 0 });
    this.onStart(arena, mode);
  }

  close() {
    if (this.link.connected) this.link.send({ t: "leave", id: this.myId });
    this.link.close();
    this.players = [];
    this.ready = false;
  }
}
