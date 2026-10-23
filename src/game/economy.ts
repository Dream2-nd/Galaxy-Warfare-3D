import {
  DEFAULT_PROFILE, DRONE_ORDER, FIGHTER_ORDER, MAX_ITEM_PRICE, SHOP_AUDIT, STARTING_COINS,
  STARTER_WEAPONS, WEAPON_PRICES, WEAPONS,
  type DroneTypeId, type PlayerProfile, type ShipClassId, type WeaponId,
} from "./content";

/* Single source of truth for the coin economy.
 * Persistence lives in App.tsx (localStorage + cross-app ProfileSyncBus); this module
 * holds the pure, testable rules: one-time grant, purchases, rewards and MVP. */

export { STARTING_COINS, MAX_ITEM_PRICE };

export interface PurchaseResult {
  ok: boolean;
  profile: PlayerProfile;
  reason?: "insufficient" | "owned" | "unknown" | "cap";
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null);

/**
 * Normalise any stored profile, including legacy saves that used `credits`.
 * The 10,000-coin grant is issued exactly once: it is applied only when no
 * balance has ever been persisted. Existing balances are preserved verbatim.
 */
export function normalizeProfile(raw: unknown): PlayerProfile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const coins = num(r.coins);
  const legacy = num(r.credits);
  const hasBalance = coins !== null || legacy !== null;
  const balance = coins ?? legacy ?? STARTING_COINS;
  const grantSeed = hasBalance || r.grantSeed === 1 ? 1 : 1; // granted exactly once either way

  const uniq = <T>(items: T[] | undefined, allowed: (v: T) => boolean): T[] =>
    Array.from(new Set((items ?? []).filter(allowed)));

  const starterWeapons = STARTER_WEAPONS;
  return {
    coins: balance,
    grantSeed,
    ownedShips: Array.from(new Set([...DEFAULT_PROFILE.ownedShips, ...uniq(r.ownedShips as ShipClassId[], (id) => FIGHTER_ORDER.includes(id))])),
    ownedDrones: Array.from(new Set([...DEFAULT_PROFILE.ownedDrones, ...uniq(r.ownedDrones as DroneTypeId[], (id) => DRONE_ORDER.includes(id))])),
    ownedWeapons: Array.from(new Set([...starterWeapons, ...uniq(r.ownedWeapons as WeaponId[], (id) => !!WEAPONS[id])])),
    ownedPaints: Array.from(new Set([0, ...(Array.isArray(r.ownedPaints) ? (r.ownedPaints as number[]).filter((i) => Number.isInteger(i) && i >= 0) : [])])),
    ownedEngineColors: Array.from(new Set([0, ...(Array.isArray(r.ownedEngineColors) ? (r.ownedEngineColors as number[]).filter((i) => Number.isInteger(i) && i >= 0) : [])])),
    ownedLaserColors: Array.from(new Set([0, ...(Array.isArray(r.ownedLaserColors) ? (r.ownedLaserColors as number[]).filter((i) => Number.isInteger(i) && i >= 0) : [])])),
    ownedTrailColors: Array.from(new Set([0, ...(Array.isArray(r.ownedTrailColors) ? (r.ownedTrailColors as number[]).filter((i) => Number.isInteger(i) && i >= 0) : [])])),
    stats: {
      matches: num(r.stats && (r.stats as Record<string, unknown>).matches) ?? 0,
      wins: num(r.stats && (r.stats as Record<string, unknown>).wins) ?? 0,
      kills: num(r.stats && (r.stats as Record<string, unknown>).kills) ?? 0,
      coinsEarned: num(r.stats && (r.stats as Record<string, unknown>).coinsEarned) ?? 0,
    },
  };
}

/** Deduct coins only when the item is not already owned and the balance covers it. */
export function purchase(profile: PlayerProfile, price: number, owned: boolean, apply: (p: PlayerProfile) => PlayerProfile): PurchaseResult {
  const cost = Math.max(0, Math.floor(price));
  if (owned || cost === 0) return { ok: true, profile: apply(profile), reason: "owned" };
  if (cost > MAX_ITEM_PRICE) return { ok: false, profile, reason: "cap" };
  if (profile.coins < cost) return { ok: false, profile, reason: "insufficient" };
  const charged: PlayerProfile = { ...profile, coins: profile.coins - cost };
  return { ok: true, profile: apply(charged) };
}

/** True when every catalogue entry respects the 168-coin ceiling. */
export const SHOP_CAP_OK = SHOP_AUDIT.every((e) => e.price <= MAX_ITEM_PRICE);

export function weaponOwned(profile: PlayerProfile, id: WeaponId) { return profile.ownedWeapons.includes(id); }
export function shipOwned(profile: PlayerProfile, id: ShipClassId) { return profile.ownedShips.includes(id); }
export function droneOwned(profile: PlayerProfile, id: DroneTypeId) { return profile.ownedDrones.includes(id); }
export function weaponPrice(id: WeaponId) { return WEAPON_PRICES[id] ?? 0; }

// ---------------- rewards & MVP ----------------

export interface PerfInput { kills: number; assists: number; damage: number; deaths: number; score: number; won: boolean; }
export interface PerfRow extends PerfInput { name: string; team: 0 | 1; me: boolean; }

/** Performance rating used for MVP. Mode-agnostic: objective contribution folds into score. */
export function performance(p: PerfInput) {
  return Math.round(p.kills * 100 + p.assists * 45 + p.damage * 0.6 + p.score * 0.12 - p.deaths * 15 + (p.won ? 25 : 0));
}

export interface RewardOutcome { reward: number; isMvp: boolean; mvpName: string; mvpTeam: 0 | 1; }

/**
 * Coin reward for a genuinely finished match.
 *  • win: random 50–70, but a winning-team MVP receives 100 total (not additive)
 *  • loss: random 30–50 for everyone, including a losing MVP
 */
export function computeReward(rows: PerfRow[], won: boolean, rng: () => number = Math.random): RewardOutcome {
  const rated = rows.map((r) => ({ ...r, perf: performance(r) }));
  const winningTeam: 0 | 1 = won ? 0 : 1;
  const winners = rated.filter((r) => r.team === winningTeam);
  // 1v1: the winner is the only pilot on their team, so they are the winning MVP.
  const mvp = winners.length ? winners.reduce((a, b) => (b.perf > a.perf ? b : a)) : null;
  const isMvp = !!mvp && mvp.me;
  const int = (min: number, max: number) => Math.floor(min + rng() * (max - min + 1));
  const reward = won ? (isMvp ? 100 : int(50, 70)) : int(30, 50);
  return { reward, isMvp, mvpName: mvp?.name ?? "—", mvpTeam: mvp ? mvp.team : winningTeam };
}

/** Credit a match reward exactly once per match id. */
export function settleReward(
  profile: PlayerProfile, matchId: string, reward: number, settled: string[],
): { profile: PlayerProfile; credited: boolean; settled: string[] } {
  if (!matchId || settled.includes(matchId) || reward <= 0) return { profile, credited: false, settled };
  const nextSettled = [...settled, matchId].slice(-80);
  return {
    profile: {
      ...profile,
      coins: profile.coins + reward,
      stats: {
        matches: profile.stats.matches + 1,
        wins: profile.stats.wins,
        kills: profile.stats.kills,
        coinsEarned: profile.stats.coinsEarned + reward,
      },
    },
    credited: true,
    settled: nextSettled,
  };
}

/** Convenience snapshot of a brand-new pilot profile (10,000 coins). */
export const STARTING_PROFILE = normalizeProfile(null);
