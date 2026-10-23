import * as THREE from "three";
import { buildShip, type ShipVisual } from "./ships";
import {
  DRONE_TYPES, ENGINE_COLORS, PAINTS, SHIP_CLASSES, WEAPONS,
  type DroneTypeId, type ShipConfig,
} from "./content";

/** Stand-alone 3D hangar viewer: orbit the ship & equipped/previewed drone, live-swap paint, class, engine glow, and loadout. */
export class Hangar {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raf = 0;
  private t = 0;
  private vis: ShipVisual | null = null;
  private droneVis: ShipVisual | null = null;
  private rig = new THREE.Group();
  private droneRig = new THREE.Group();
  private yaw = 0.6;
  private pitch = -0.18;
  private dist = 22;
  private camMode: "third" | "first" = "third";
  private focusMode: "ship" | "drone" = "ship";
  private dragging = false;
  private last = { x: 0, y: 0 };
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, private quality: "low" | "medium" | "high") {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : 1.4));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    this.scene.fog = new THREE.FogExp2(0x04070f, 0.012);
    this.build();
    this.resize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.raf = requestAnimationFrame(this.loop);
  }

  private build() {
    const s = this.scene;
    s.add(new THREE.AmbientLight(0x2a3a6a, 1.25));
    const key = new THREE.SpotLight(0xdff0ff, 280, 130, 0.75, 0.5, 1.4);
    key.position.set(9, 22, 12);
    s.add(key);
    const rimA = new THREE.PointLight(0x35e6ff, 95, 65, 2);
    rimA.position.set(-13, 4, -8);
    const rimB = new THREE.PointLight(0xff4fb0, 85, 65, 2);
    rimB.position.set(12, 3, -10);
    s.add(rimA, rimB);

    // floor
    const floorGeo = new THREE.CircleGeometry(26, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b1120, metalness: 0.85, roughness: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -6;
    s.add(floor);
    const grid = new THREE.GridHelper(52, 26, 0x1d4f6b, 0x14293d);
    grid.position.y = -5.98;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    s.add(grid);

    s.add(this.rig);
    s.add(this.droneRig);
  }

  setCameraMode(mode: "third" | "first") {
    this.camMode = mode;
  }

  setFocusMode(mode: "ship" | "drone") {
    this.focusMode = mode;
  }

  setConfig(cfg: ShipConfig, previewDrone?: DroneTypeId | null) {
    if (this.vis) {
      this.rig.remove(this.vis.group);
      this.vis.dispose();
      this.vis = null;
    }
    if (this.droneVis) {
      this.droneRig.remove(this.droneVis.group);
      this.droneVis.dispose();
      this.droneVis = null;
    }
    const engIdx = cfg.engineColorIndex ?? 0;
    const v = buildShip(cfg.classId, cfg.paintIndex, 0, this.quality, engIdx);
    const paint = PAINTS[cfg.paintIndex % PAINTS.length];
    const swatch = ENGINE_COLORS[engIdx % ENGINE_COLORS.length];
    const ec = swatch && swatch.color ? swatch.color : paint.engine;
    v.engineMats.forEach((m) => m.color.set(ec));
    v.shieldMat.uniforms.uColor.value.set(ec);
    v.engineLight.color.set(ec);
    v.shield.visible = false;
    this.vis = v;
    this.rig.add(v.group);
    this.rig.scale.setScalar(1.25);

    const activeDrone = previewDrone !== undefined ? previewDrone : (cfg.equippedDrone ?? null);
    if (activeDrone && DRONE_TYPES[activeDrone]) {
      const dv = buildShip("drone", cfg.paintIndex, 0, this.quality, engIdx, activeDrone);
      dv.shield.visible = false;
      this.droneVis = dv;
      this.droneRig.add(dv.group);
    }
  }

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private onDown = (e: PointerEvent) => { this.dragging = true; this.last = { x: e.clientX, y: e.clientY }; };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.yaw += (e.clientX - this.last.x) * 0.008;
    this.pitch = Math.max(-0.9, Math.min(0.7, this.pitch + (e.clientY - this.last.y) * 0.006));
    this.last = { x: e.clientX, y: e.clientY };
  };
  private onUp = () => { this.dragging = false; };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.dist = Math.max(9, Math.min(48, this.dist + e.deltaY * 0.02));
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = 1 / 60;
    this.t += dt;
    if (!this.dragging) this.yaw += dt * 0.22;

    if (this.focusMode === "drone" && this.droneVis) {
      this.rig.visible = false;
      this.droneRig.visible = true;
      this.droneRig.position.set(0, Math.sin(this.t * 1.3) * 0.3, 0);
      this.droneRig.rotation.y = Math.sin(this.t * 0.4) * 0.15;
      this.droneRig.scale.setScalar(2.6);
    } else {
      this.rig.visible = true;
      this.rig.rotation.y = Math.sin(this.t * 0.35) * 0.12;
      this.rig.position.y = Math.sin(this.t * 0.8) * 0.35;
      if (this.droneVis) {
        this.droneRig.visible = true;
        this.droneRig.scale.setScalar(1.3);
        const orbitA = this.t * 0.7;
        this.droneRig.position.set(
          Math.cos(orbitA) * 8.5,
          1.8 + Math.sin(this.t * 1.6) * 0.45,
          Math.sin(orbitA) * 8.5,
        );
        this.droneRig.rotation.y = -orbitA + Math.PI / 2;
      } else {
        this.droneRig.visible = false;
      }
    }

    if (this.vis) {
      this.vis.engineLight.intensity = 2.4 + Math.sin(this.t * 7) * 0.5;
    }

    if (this.camMode === "first" && this.vis && this.focusMode === "ship") {
      // First-person cockpit preview inside the Hangar
      this.camera.position.set(0, 1.35 + this.rig.position.y, 1.8);
      this.camera.lookAt(Math.sin(this.t * 0.3) * 2, 1.1, 25);
    } else {
      const d = this.focusMode === "drone" ? Math.min(this.dist, 15) : this.dist;
      const cx = Math.cos(this.yaw) * Math.cos(this.pitch) * d;
      const cz = Math.sin(this.yaw) * Math.cos(this.pitch) * d;
      const cy = Math.sin(this.pitch) * d + 2;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(0, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  };

  static describe(cfg: ShipConfig) {
    const c = SHIP_CLASSES[cfg.classId] ?? SHIP_CLASSES.nova;
    const p = WEAPONS[cfg.loadout.primary] ?? WEAPONS.laser;
    const s = WEAPONS[cfg.loadout.secondary] ?? WEAPONS.homing;
    const x = WEAPONS[cfg.loadout.special] ?? WEAPONS.charged;
    return {
      cls: c,
      hull: Math.round(c.hull * (1 + (cfg.loadout.armorMod - 1) * 0.16)),
      shield: Math.round(c.shield * (1 + (cfg.loadout.shieldMod - 1) * 0.2)),
      speed: Math.round(158 * c.speed * (1 + (cfg.loadout.engineMod - 1) * 0.14)),
      accel: Math.round(118 * (c.accelBonus ?? c.speed) * (1 + (cfg.loadout.engineMod - 1) * 0.14)),
      primary: p.name,
      secondary: s.name,
      special: x.name,
      dps: Math.round((p.dmg * (p.burst ?? 1)) / p.interval),
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("pointerup", this.onUp);
    if (this.vis) this.vis.dispose();
    if (this.droneVis) this.droneVis.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}
