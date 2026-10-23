import * as THREE from "three";

/* Pure combat math — no DOM, no renderer — so it can be unit-tested headlessly. */

const _r0 = new THREE.Vector3();
const _r1 = new THREE.Vector3();
const _d = new THREE.Vector3();
const _axis = new THREE.Vector3();

/**
 * Continuous (swept) projectile-vs-sphere test, solved in the target's frame of
 * reference so fast lasers can never tunnel through fast ships between frames.
 *   p0 → p1 : projectile position at the start / end of the step
 *   s0 → s1 : target centre at the start / end of the step
 * Returns the entry parameter t ∈ [0, 1], or -1 for a miss. `outLocal` receives
 * the entry point relative to the target centre (on the hit sphere).
 */
export function sweptSphereHit(
  p0: THREE.Vector3, p1: THREE.Vector3, s0: THREE.Vector3, s1: THREE.Vector3,
  radius: number, outLocal?: THREE.Vector3,
): number {
  const rel0 = _r0.copy(p0).sub(s0);
  const rel1 = _r1.copy(p1).sub(s1);
  const d = _d.copy(rel1).sub(rel0);
  const c = rel0.lengthSq() - radius * radius;
  if (c <= 0) { outLocal?.copy(rel0); return 0; } // started inside the sphere
  const a = d.lengthSq();
  if (a < 1e-10) return -1;
  const b = 2 * rel0.dot(d);
  if (b >= 0) return -1; // outside and moving away
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0 || t > 1) return -1;
  outLocal?.copy(rel0).addScaledVector(d, t);
  return t;
}

/**
 * Earliest positive time at which a projectile of `speed`, fired from the
 * origin, meets a target at `relPos` moving with `relVel`. Returns -1 if the
 * target cannot be caught.
 */
export function interceptTime(relPos: THREE.Vector3, relVel: THREE.Vector3, speed: number): number {
  const a = relVel.lengthSq() - speed * speed;
  const b = 2 * relPos.dot(relVel);
  const c = relPos.lengthSq();
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-9) return -1;
    const t = -c / b;
    return t > 0 ? t : -1;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  let t = Infinity;
  if (t1 > 0) t = t1;
  if (t2 > 0 && t2 < t) t = t2;
  return Number.isFinite(t) ? t : -1;
}

/**
 * Rotate unit vector `dir` toward unit vector `want` by at most `maxAngle`
 * radians (in place). This is what makes missiles visibly arc instead of
 * snapping onto their target. Returns the angle still remaining.
 */
export function turnToward(dir: THREE.Vector3, want: THREE.Vector3, maxAngle: number): number {
  const angle = Math.acos(THREE.MathUtils.clamp(dir.dot(want), -1, 1));
  if (angle < 1e-6) return 0;
  if (angle <= maxAngle) { dir.copy(want); return 0; }
  _axis.crossVectors(dir, want);
  if (_axis.lengthSq() < 1e-12) {
    _axis.set(0, 1, 0).cross(dir);
    if (_axis.lengthSq() < 1e-12) _axis.set(1, 0, 0).cross(dir);
  }
  _axis.normalize();
  dir.applyAxisAngle(_axis, maxAngle).normalize();
  return angle - maxAngle;
}
