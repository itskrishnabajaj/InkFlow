// Unified input: touch (virtual joystick + look-drag + action buttons) and a
// keyboard/mouse fallback (WASD + drag-look + click) for desktop testing.
//
// Raw input sources are tracked separately, then merged into `this.state` once
// per frame by update(). main.js calls update(), reads state, and consumeLook().

export class Controls {
  constructor(els) {
    // els: { lookLayer, joystick, knob, btnUp, btnDown, btnBreak, btnPlace }
    this.els = els;

    // Final, merged per-frame state (read by main.js after update()).
    this.state = { moveX: 0, moveZ: 0, up: false, down: false, boost: false };

    // Raw sources.
    this.joy = { x: 0, z: 0, boost: false, active: false };
    this.touchBtn = { up: false, down: false };
    this.keys = new Set();

    this._lookDX = 0;
    this._lookDY = 0;

    this.callbacks = { break: null, place: null, pick: null };

    this._initJoystick();
    this._initLook();
    this._initButtons();
    this._initKeyboard();
  }

  on(name, fn) { this.callbacks[name] = fn; }

  // Returns accumulated look delta since last call and resets it.
  consumeLook() {
    const d = { dx: this._lookDX, dy: this._lookDY };
    this._lookDX = 0;
    this._lookDY = 0;
    return d;
  }

  // Merge all raw sources into the final movement state. Call once per frame.
  update() {
    const k = this.keys;
    if (this.joy.active) {
      this.state.moveX = this.joy.x;
      this.state.moveZ = this.joy.z;
      this.state.boost = this.joy.boost;
    } else {
      let mx = 0, mz = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) mz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
      const len = Math.hypot(mx, mz) || 1;
      this.state.moveX = mx / len;
      this.state.moveZ = mz / len;
      this.state.boost = k.has('ControlLeft') || k.has('ControlRight');
    }
    this.state.up = this.touchBtn.up || k.has('Space');
    this.state.down = this.touchBtn.down || k.has('ShiftLeft') || k.has('ShiftRight');
  }

  // ---- Virtual joystick ----------------------------------------------------
  _initJoystick() {
    const { joystick, knob } = this.els;
    let active = null;
    let cx = 0, cy = 0;
    const radius = 55;

    const reset = () => {
      this.joy.active = false;
      this.joy.x = 0;
      this.joy.z = 0;
      this.joy.boost = false;
      knob.style.transform = 'translate(-50%, -50%)';
    };

    joystick.addEventListener('pointerdown', (e) => {
      active = e.pointerId;
      const r = joystick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      joystick.setPointerCapture(e.pointerId);
      this.joy.active = true;
      e.preventDefault();
    });
    joystick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, radius);
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      knob.style.transform =
        `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
      const mag = clamped / radius;
      this.joy.x = nx * mag;
      this.joy.z = -ny * mag; // up on screen = forward
      this.joy.boost = mag > 0.92;
      e.preventDefault();
    });
    const end = (e) => { if (e.pointerId === active) { active = null; reset(); } };
    joystick.addEventListener('pointerup', end);
    joystick.addEventListener('pointercancel', end);
  }

  // ---- Look (drag anywhere on the look layer) ------------------------------
  _initLook() {
    const layer = this.els.lookLayer;
    let active = null;
    let lastX = 0, lastY = 0;
    let downX = 0, downY = 0, moved = false;

    layer.addEventListener('pointerdown', (e) => {
      active = e.pointerId;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
      moved = false;
      layer.setPointerCapture(e.pointerId);
    });
    layer.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      this._lookDX += e.clientX - lastX;
      this._lookDY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
    });
    layer.addEventListener('pointerup', (e) => {
      if (e.pointerId === active) active = null;
      // A tap (no drag) with the mouse breaks a block — desktop convenience.
      if (e.button === 0 && !moved && e.pointerType === 'mouse' && this.callbacks.break) {
        this.callbacks.break();
      }
    });
    layer.addEventListener('pointercancel', (e) => { if (e.pointerId === active) active = null; });
    layer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.callbacks.place) this.callbacks.place();
    });
  }

  // ---- Action buttons (with hold-to-repeat for break/place) ----------------
  _initButtons() {
    const press = (el, onDown, onUp) => {
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        el.classList.add('pressed');
        onDown();
        e.preventDefault();
      });
      const up = () => { el.classList.remove('pressed'); if (onUp) onUp(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };

    press(this.els.btnUp, () => { this.touchBtn.up = true; }, () => { this.touchBtn.up = false; });
    press(this.els.btnDown, () => { this.touchBtn.down = true; }, () => { this.touchBtn.down = false; });

    const repeater = (el, cbName) => {
      let timer = null;
      const fire = () => { if (this.callbacks[cbName]) this.callbacks[cbName](); };
      press(el,
        () => { fire(); timer = setInterval(fire, 220); },
        () => { if (timer) { clearInterval(timer); timer = null; } });
    };
    repeater(this.els.btnBreak, 'break');
    repeater(this.els.btnPlace, 'place');
  }

  // ---- Keyboard ------------------------------------------------------------
  _initKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9 && this.callbacks.pick) this.callbacks.pick(n - 1);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }
}
