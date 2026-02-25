/**
 * gestures.js — High-performance touch gesture engine for InkFlow
 *
 * Handles:
 *  - Pan (single finger drag with momentum)
 *  - Pinch-to-zoom (two finger)
 *  - Double-tap to zoom
 *  - Long-press detection
 *
 * Uses Pointer Events API for unified touch/mouse handling.
 * Avoids any DOM layout reads inside animation loop.
 */

class GestureEngine {
  constructor(element, callbacks = {}) {
    this.el = element;
    this.cb = callbacks;

    /* Active pointers: Map<pointerId, {x, y, startX, startY}> */
    this._pointers = new Map();

    /* Pan state */
    this._lastPanX = 0;
    this._lastPanY = 0;
    this._panVelX  = 0;
    this._panVelY  = 0;
    this._panTimestamp = 0;

    /* Momentum */
    this._momentumRafId = null;

    /* Pinch state */
    this._initPinchDist   = 0;
    this._initPinchMidX   = 0;
    this._initPinchMidY   = 0;
    this._initPinchScale  = 1;

    /* Double-tap */
    this._lastTapTime = 0;
    this._lastTapX    = 0;
    this._lastTapY    = 0;
    const TAP_GAP_MS  = 300;
    const TAP_DIST_PX = 40;

    this._TAP_GAP  = TAP_GAP_MS;
    this._TAP_DIST = TAP_DIST_PX;

    /* Long-press */
    this._longPressTimer   = null;
    this._longPressFired   = false;
    this._LONG_PRESS_MS    = 500;

    this._bind();
  }

  _bind() {
    const el = this.el;
    const opts = { passive: false };

    el.addEventListener('pointerdown',   this._onDown.bind(this),   opts);
    el.addEventListener('pointermove',   this._onMove.bind(this),   opts);
    el.addEventListener('pointerup',     this._onUp.bind(this),     opts);
    el.addEventListener('pointercancel', this._onCancel.bind(this), opts);
  }

  _dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  _cancelMomentum() {
    if (this._momentumRafId) {
      cancelAnimationFrame(this._momentumRafId);
      this._momentumRafId = null;
    }
  }

  _startMomentum() {
    // Apply friction-based momentum scrolling
    const FRICTION = 0.90;
    const MIN_VEL  = 0.3;

    let vx = this._panVelX;
    let vy = this._panVelY;

    const step = () => {
      vx *= FRICTION;
      vy *= FRICTION;

      if (Math.abs(vx) < MIN_VEL && Math.abs(vy) < MIN_VEL) return;

      this.cb.onPan && this.cb.onPan(vx, vy, false);
      this._momentumRafId = requestAnimationFrame(step);
    };

    this._momentumRafId = requestAnimationFrame(step);
  }

  _clearLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }

  _onDown(e) {
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);

    this._cancelMomentum();
    this._clearLongPress();

    const pt = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    this._pointers.set(e.pointerId, pt);

    const count = this._pointers.size;

    if (count === 1) {
      this._lastPanX    = e.clientX;
      this._lastPanY    = e.clientY;
      this._panVelX     = 0;
      this._panVelY     = 0;
      this._panTimestamp = e.timeStamp;
      this._longPressFired = false;

      // Long-press detection
      this._longPressTimer = setTimeout(() => {
        this._longPressFired = true;
        this.cb.onLongPress && this.cb.onLongPress(e.clientX, e.clientY);
      }, this._LONG_PRESS_MS);

    } else if (count === 2) {
      // Entering pinch — cancel long press
      this._clearLongPress();
      const pts = [...this._pointers.values()];
      this._initPinchDist   = this._dist(pts[0], pts[1]);
      const mid             = this._mid(pts[0], pts[1]);
      this._initPinchMidX   = mid.x;
      this._initPinchMidY   = mid.y;
      this._initPinchScale  = this.cb.getCurrentScale ? this.cb.getCurrentScale() : 1;
    }
  }

  _onMove(e) {
    if (!this._pointers.has(e.pointerId)) return;
    e.preventDefault();

    const pt = this._pointers.get(e.pointerId);
    pt.x = e.clientX;
    pt.y = e.clientY;

    const count = this._pointers.size;

    if (count === 1) {
      const dx = e.clientX - this._lastPanX;
      const dy = e.clientY - this._lastPanY;
      const dt = e.timeStamp - this._panTimestamp || 16;

      // Cancel long press if moved significantly
      if (this._longPressTimer &&
          (Math.abs(e.clientX - pt.startX) > 8 || Math.abs(e.clientY - pt.startY) > 8)) {
        this._clearLongPress();
      }

      // Velocity tracking (exponential moving average)
      const alpha = 0.6;
      this._panVelX = alpha * (dx / dt * 16) + (1 - alpha) * this._panVelX;
      this._panVelY = alpha * (dy / dt * 16) + (1 - alpha) * this._panVelY;

      this._lastPanX    = e.clientX;
      this._lastPanY    = e.clientY;
      this._panTimestamp = e.timeStamp;

      this.cb.onPan && this.cb.onPan(dx, dy, true);

    } else if (count === 2) {
      const pts = [...this._pointers.values()];
      const newDist = this._dist(pts[0], pts[1]);
      const newMid  = this._mid(pts[0], pts[1]);

      const scaleRatio = newDist / (this._initPinchDist || 1);
      const newScale   = this._initPinchScale * scaleRatio;

      const panDx = newMid.x - this._initPinchMidX;
      const panDy = newMid.y - this._initPinchMidY;

      this.cb.onPinch && this.cb.onPinch(
        newScale,
        this._initPinchMidX,
        this._initPinchMidY,
        panDx,
        panDy
      );
    }
  }

  _onUp(e) {
    if (!this._pointers.has(e.pointerId)) return;
    e.preventDefault();

    this._clearLongPress();

    const pt = this._pointers.get(e.pointerId);
    this._pointers.delete(e.pointerId);

    const count = this._pointers.size;

    if (count === 0) {
      // Was single finger — check tap
      if (!this._longPressFired) {
        const dx = Math.abs(e.clientX - pt.startX);
        const dy = Math.abs(e.clientY - pt.startY);
        const moved = dx > 10 || dy > 10;

        if (!moved) {
          const now = e.timeStamp;
          const ddx = Math.abs(e.clientX - this._lastTapX);
          const ddy = Math.abs(e.clientY - this._lastTapY);

          if ((now - this._lastTapTime) < this._TAP_GAP &&
              ddx < this._TAP_DIST && ddy < this._TAP_DIST) {
            // Double-tap
            this._lastTapTime = 0;
            this.cb.onDoubleTap && this.cb.onDoubleTap(e.clientX, e.clientY);
          } else {
            this._lastTapTime = now;
            this._lastTapX    = e.clientX;
            this._lastTapY    = e.clientY;
            this.cb.onTap && this.cb.onTap(e.clientX, e.clientY);
          }
        } else {
          // Panning ended — apply momentum
          const speed = Math.sqrt(this._panVelX**2 + this._panVelY**2);
          if (speed > 1.5) {
            this._startMomentum();
          }
        }
      }

      this.cb.onPanEnd && this.cb.onPanEnd();

    } else if (count === 1) {
      // Went from 2 fingers to 1 — reset pan reference
      const remainingPt = [...this._pointers.values()][0];
      this._lastPanX = remainingPt.x;
      this._lastPanY = remainingPt.y;
      this._panVelX  = 0;
      this._panVelY  = 0;
      this.cb.onPinchEnd && this.cb.onPinchEnd();
    }
  }

  _onCancel(e) {
    this._pointers.delete(e.pointerId);
    this._clearLongPress();
    this._cancelMomentum();
    this.cb.onPanEnd && this.cb.onPanEnd();
  }

  destroy() {
    this._cancelMomentum();
    this._clearLongPress();
  }
}
