import * as THREE from "three";
import type { FXSystem } from "./fx";
import type { ShipVisual } from "./ships";
import type { Quality } from "./world";

/*
 * WreckSystem — breaks a destroyed ship into its real hull pieces.
 * The largest meshes of the ship model are cloned, flung outward with spin,
 * glow red-hot and cool down, trail fire + smoke, then shrink away.
 */

interface Frag {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  baseScale: THREE.Vector3;
  life: number;
  max: number;
  heat: number;
  emitT: number;
  burns: boolean;
}

const ZERO = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Vector3();

export class WreckSystem {
  private frags: Frag[] = [];
  private maxFrags: number;

  constructor(private scene: THREE.Scene, private fx: FXSystem, quality: Quality) {
    this.maxFrags = quality === "low" ? 40 : quality === "medium" ? 70 : 100;
  }

  get count() { return this.frags.length; }

  /**
   * @param power 1 = fighter … 3 = capital (fling speed, burn time)
   * @param maxPieces how many of the largest hull pieces to break off
   */
  shatter(vis: ShipVisual, center: THREE.Vector3, shipVel: THREE.Vector3, power: number, maxPieces: number) {
    vis.group.updateMatrixWorld(true);
    const candidates: { m: THREE.Mesh; size: number }[] = [];
    vis.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m === vis.shield || Array.isArray(m.material)) return;
      if ((m.material as THREE.ShaderMaterial).isShaderMaterial) return;
      const geo = m.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      m.getWorldScale(tmpS);
      const size = (geo.boundingSphere?.radius ?? 0) * Math.max(tmpS.x, tmpS.y, tmpS.z);
      if (size > 0.3) candidates.push({ m, size });
    });
    candidates.sort((a, b) => b.size - a.size);
    const take = candidates.slice(0, maxPieces);
    for (const c of take) this.spawn(c.m, center, shipVel, power);
  }

  private spawn(src: THREE.Mesh, center: THREE.Vector3, shipVel: THREE.Vector3, power: number) {
    if (this.frags.length >= this.maxFrags) this.remove(0);
    const geo = src.geometry.clone();
    const mat = (src.material as THREE.Material).clone();
    const mesh = new THREE.Mesh(geo, mat);
    src.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    this.scene.add(mesh);

    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const c = tmpC.copy(geo.boundingSphere!.center).applyMatrix4(src.matrixWorld);
    const out = c.sub(center);
    if (out.lengthSq() < 1e-4) out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    out.normalize();

    const speed = (16 + Math.random() * 42) * (0.7 + power * 0.45);
    const vel = shipVel.clone().multiplyScalar(0.55).addScaledVector(out, speed)
      .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14 * power));
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .multiplyScalar(2 * (1.2 + Math.random() * 3.2) / Math.sqrt(power));
    const max = 2.3 + Math.random() * 1.6 + power * 0.6;

    // red-hot metal that visibly cools down
    const std = mat as THREE.MeshStandardMaterial;
    if (std.emissive) {
      std.emissive.setRGB(1, 0.42, 0.12);
      std.emissiveIntensity = 2.2;
    }
    this.frags.push({
      mesh, vel, spin, baseScale: mesh.scale.clone(), life: max, max, heat: 1,
      emitT: Math.random() * 0.05, burns: Math.random() < 0.7,
    });
  }

  update(dt: number) {
    for (let i = this.frags.length - 1; i >= 0; i--) {
      const f = this.frags[i];
      f.life -= dt;
      if (f.life <= 0) { this.remove(i); continue; }
      f.vel.multiplyScalar(Math.exp(-0.18 * dt));
      f.mesh.position.addScaledVector(f.vel, dt);
      tmpQ.setFromEuler(tmpE.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt));
      f.mesh.quaternion.multiply(tmpQ);

      f.heat = Math.max(0, f.heat - dt * 0.55);
      const std = f.mesh.material as THREE.MeshStandardMaterial;
      if (std.emissive) {
        const h = f.heat;
        std.emissive.setRGB(h, 0.42 * h * h, 0.12 * h * h * h);
        std.emissiveIntensity = 0.3 + 2.0 * h;
      }
      const k = f.life < 0.6 ? f.life / 0.6 : 1;
      f.mesh.scale.copy(f.baseScale).multiplyScalar(k);

      // burning debris leaves fire + smoke behind it
      if (f.burns && f.heat > 0.22 && this.fx.hasBudget) {
        f.emitT -= dt;
        if (f.emitT <= 0) {
          f.emitT = 0.045 + Math.random() * 0.04;
          this.fx.smoke(f.mesh.position, ZERO, 2.2 + 2 * f.heat, 0x4a4a52, 1.3);
          this.fx.burst(f.mesh.position, { count: 1, color: [0xffb04a, 0xff6a1a, 0xfff0c0], speed: 6, size: 1.6 + f.heat * 1.8, life: 0.35, drag: 2 });
        }
      }
    }
  }

  private remove(i: number) {
    const f = this.frags[i];
    this.scene.remove(f.mesh);
    f.mesh.geometry.dispose();
    (f.mesh.material as THREE.Material).dispose();
    this.frags.splice(i, 1);
  }

  clear() {
    for (let i = this.frags.length - 1; i >= 0; i--) this.remove(i);
  }

  dispose() { this.clear(); }
}
