/**
 * Render layer (Stage 1 minimal). Owns the THREE.WebGLRenderer, scene, camera and
 * lighting. It only ever *visualizes* state passed to it — it never mutates the
 * simulation (principle #1). Real chunk/entity rendering arrives in later stages; for
 * now it shows a lit placeholder so we can confirm the device, context, loop, and
 * resize handling all work.
 */

import * as THREE from 'three';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private placeholder: THREE.Group;
  private orbit = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87c5ff);
    this.scene.fog = new THREE.Fog(0x87c5ff, 30, 120);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(8, 6, 12);

    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4a3a, 0.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(20, 40, 15);
    this.sun.castShadow = true;
    this.scene.add(this.sun);

    this.placeholder = this.buildPlaceholder();
    this.scene.add(this.placeholder);

    window.addEventListener('resize', () => this.resize());
  }

  /** A small lit voxel monument + ground, purely to confirm rendering works. */
  private buildPlaceholder(): THREE.Group {
    const g = new THREE.Group();

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(40, 1, 40),
      new THREE.MeshLambertMaterial({ color: 0x5fae3b }),
    );
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    g.add(ground);

    const palette = [0x9a7b4f, 0x888888, 0xb08a4f, 0xa8442f];
    for (let i = 0; i < 24; i++) {
      const c = palette[i % palette.length]!;
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({ color: c }),
      );
      cube.castShadow = true;
      cube.position.set(
        Math.round(Math.cos(i) * 3),
        Math.floor(i / 6),
        Math.round(Math.sin(i) * 3),
      );
      g.add(cube);
    }
    return g;
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  /**
   * Draw a frame. `dt` is the real frame delta (placeholder camera animation only).
   * Later stages will instead receive interpolated player/camera state.
   */
  render(dt: number): void {
    this.orbit += dt * 0.2;
    const r = 14;
    this.camera.position.set(Math.cos(this.orbit) * r, 7, Math.sin(this.orbit) * r);
    this.camera.lookAt(0, 2, 0);
    this.renderer.render(this.scene, this.camera);
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }
}
