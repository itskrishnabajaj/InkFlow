// Day/night cycle: drives the scene background, fog, a directional "sun" light
// and a hemisphere fill light from a normalized time-of-day in [0,1).
// 0.25 = noon, 0.75 = midnight. Lighting never drops to fully black.

import * as THREE from 'three';

const DAY_COLOR = new THREE.Color(0x87c5ff);
const NIGHT_COLOR = new THREE.Color(0x0a1030);
const SUNSET_COLOR = new THREE.Color(0xff8a47);

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export class Sky {
  constructor(scene, cycleSeconds = 240) {
    this.scene = scene;
    this.cycleSeconds = cycleSeconds;
    this.time = 0.27; // start a little after sunrise
    this.paused = false;

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.set(50, 100, 30);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4a3a, 0.5);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(DAY_COLOR.getHex(), 40, 150);
    scene.background = new THREE.Color(DAY_COLOR.getHex());
    this._tmp = new THREE.Color();
    this.apply();
  }

  setFogFar(far) {
    if (this.scene.fog) this.scene.fog.far = far;
  }

  togglePause() { this.paused = !this.paused; return this.paused; }

  update(dt) {
    if (!this.paused) {
      this.time = (this.time + dt / this.cycleSeconds) % 1;
    }
    this.apply();
  }

  apply() {
    // Sun elevation: peaks at time 0.25, lowest at 0.75.
    const angle = (this.time - 0.25) * Math.PI * 2;
    const sunHeight = Math.cos(angle); // 1 at noon, -1 at midnight
    const sunX = Math.sin(angle);

    const daylight = smoothstep(-0.15, 0.25, sunHeight); // 0 night .. 1 day
    const horizon = Math.max(0, 1 - Math.abs(sunHeight) * 3); // sunrise/sunset glow

    // Sky/fog color: night<->day, tinted orange near the horizon.
    this._tmp.copy(NIGHT_COLOR).lerp(DAY_COLOR, daylight);
    this._tmp.lerp(SUNSET_COLOR, horizon * 0.55 * (daylight * 0.6 + 0.2));
    this.scene.background.copy(this._tmp);
    if (this.scene.fog) this.scene.fog.color.copy(this._tmp);

    // Sun light.
    this.sun.position.set(sunX * 100, Math.max(0.05, sunHeight) * 120, 40);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = 0.15 + daylight * 0.95;
    this.sun.color.setRGB(1, 0.95 - horizon * 0.25, 0.85 - horizon * 0.35);

    // Hemisphere fill keeps shadows readable at night.
    this.hemi.intensity = 0.25 + daylight * 0.45;
  }
}
