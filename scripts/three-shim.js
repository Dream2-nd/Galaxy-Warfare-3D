// Headless test shim: real three.js math/scene graph, stubbed WebGL renderer.
export * from "../node_modules/three/build/three.module.js";
export class WebGLRenderer {
  constructor() { this.shadowMap = { enabled: false, type: 0 }; this.calls = 0; }
  setPixelRatio() {} setSize() {} setClearColor() {}
  getContext() { return { isContextLost: () => false }; }
  getDrawingBufferSize(v) { return v.set(1280, 720); }
  render(scene, camera) { scene.updateMatrixWorld(); camera.updateMatrixWorld(); this.calls++; }
  dispose() {}
}
