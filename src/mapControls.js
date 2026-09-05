/**
 * MerkadoGo Web — Ultra-Smooth Fluid Map Controller (Google Maps Grade)
 * Features:
 * 1. Kinetic momentum & inertia gliding (flick/swipe fling)
 * 2. Smooth 2-finger twist rotation with angular momentum & North snap
 * 3. Double-tap to zoom in with fluid ease-out animation
 * 4. 1:1 Direct touch tracking with zero lag and boundary clamping
 * 5. Animated zoom & reset transitions
 */

export class MapControls {
  /**
   * @param {SVGSVGElement} svgElement 
   * @param {SVGGElement} transformLayer 
   * @param {HTMLElement} container 
   */
  constructor(svgElement, transformLayer, container) {
    this.svg = svgElement;
    this.layer = transformLayer;
    this.container = container;

    // SVG Map Master Canvas Limits (8004 x 8000)
    this.mapBounds = {
      minX: 0,
      minY: 0,
      maxX: 8004,
      maxY: 8000
    };

    // Market Core Center
    this.marketCenterX = 3450;
    this.marketCenterY = 3450;

    // Zoom limits (viewBox width)
    this.minVbWidth = 500; // Max zoom-in (high stall detail)

    // ViewBox State: { x, y, width, height }
    this.vb = {
      x: 0,
      y: 0,
      width: 3000,
      height: 3000
    };

    // Rotation State (in degrees)
    this.rotation = 0;
    this.rotationListeners = new Set();

    // Active Pointer Tracking
    this.activePointers = new Map(); // pointerId -> { x, y }
    this.lastPinchDist = null;
    this.lastPinchAngle = null;
    this.isPanning = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.lastPointerTime = 0;

    // Kinetic Momentum & Inertia Physics
    this.vx = 0; // SVG units per ms
    this.vy = 0;
    this.vRot = 0; // degrees per ms
    this.momentumRaf = null;
    this.animatingRaf = null;

    // Double Tap Tracking
    this.lastTapTime = 0;
    this.lastTapPos = { x: 0, y: 0 };
    this.dragDistance = 0;

    this.init();
  }

  init() {
    this.bindEvents();
    this.bindButtons();
    this.resetToInitialView(false);

    // Handle container resize
    window.addEventListener('resize', () => {
      this.maintainAspectRatio();
      this.clampViewBox();
      this.renderViewBox();
    });
  }

  /**
   * Dynamically calculates max zoom-out width so that neither width (>8004)
   * nor height (>8000) will ever exceed the SVG artwork boundaries.
   */
  getMaxVbWidth() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    const aspect = height / width;

    const rad = this.rotation * (Math.PI / 180);
    const cosT = Math.abs(Math.cos(rad));
    const sinT = Math.abs(Math.sin(rad));

    const maxWByWidth = this.mapBounds.maxX / (cosT + aspect * sinT);
    const maxWByHeight = this.mapBounds.maxY / (sinT + aspect * cosT);

    return Math.min(maxWByWidth, maxWByHeight);
  }

  /**
   * Calculates the initial optimal viewport centered directly on the market stalls
   */
  getInitialViewBox() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    const aspect = height / width;

    let targetW = width <= 600 ? 2600 : 3200;
    targetW = Math.min(targetW, this.getMaxVbWidth());
    let targetH = targetW * aspect;

    return {
      x: this.marketCenterX - (targetW / 2),
      y: this.marketCenterY - (targetH / 2) + 60,
      width: targetW,
      height: targetH
    };
  }

  resetToInitialView(animate = true) {
    this.cancelPhysics();
    const initial = this.getInitialViewBox();
    if (animate) {
      this.animateToViewBox(initial.x, initial.y, initial.width, initial.height, 0, 320);
    } else {
      this.vb = initial;
      this.rotation = 0;
      this.clampViewBox();
      this.renderViewBox();
      this.renderRotation();
    }
  }

  maintainAspectRatio() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    const aspect = height / width;
    this.vb.height = this.vb.width * aspect;
  }

  /**
   * Clamps the viewBox so the user can explore everything while NEVER
   * exposing empty white space beyond the [0, 0, 8004, 8000] canvas edges.
   */
  clampViewBox() {
    let maxW = this.getMaxVbWidth();
    maxW = Math.max(this.minVbWidth, maxW);
    
    if (this.vb.width > maxW) {
      this.vb.width = maxW;
      this.maintainAspectRatio();
    } else if (this.vb.width < this.minVbWidth) {
      this.vb.width = this.minVbWidth;
      this.maintainAspectRatio();
    }

    const W = this.vb.width;
    const H = this.vb.height;

    const cx = this.vb.x + W / 2;
    const cy = this.vb.y + H / 2;

    const rad = -this.rotation * (Math.PI / 180);
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    const dx = cx - this.marketCenterX;
    const dy = cy - this.marketCenterY;

    const cx_local = this.marketCenterX + dx * cosR - dy * sinR;
    const cy_local = this.marketCenterY + dx * sinR + dy * cosR;

    const absCos = Math.abs(cosR);
    const absSin = Math.abs(sinR);

    const half_W_local = (W / 2) * absCos + (H / 2) * absSin;
    const half_H_local = (W / 2) * absSin + (H / 2) * absCos;

    const min_cx = this.mapBounds.minX + half_W_local;
    const max_cx = this.mapBounds.maxX - half_W_local;
    const min_cy = this.mapBounds.minY + half_H_local;
    const max_cy = this.mapBounds.maxY - half_H_local;

    let cx_local_clamped = cx_local;
    if (min_cx > max_cx) {
      cx_local_clamped = (this.mapBounds.minX + this.mapBounds.maxX) / 2;
    } else {
      cx_local_clamped = Math.max(min_cx, Math.min(max_cx, cx_local));
    }

    let cy_local_clamped = cy_local;
    if (min_cy > max_cy) {
      cy_local_clamped = (this.mapBounds.minY + this.mapBounds.maxY) / 2;
    } else {
      cy_local_clamped = Math.max(min_cy, Math.min(max_cy, cy_local));
    }

    const rad_back = this.rotation * (Math.PI / 180);
    const cosB = Math.cos(rad_back);
    const sinB = Math.sin(rad_back);

    const dx_clamped = cx_local_clamped - this.marketCenterX;
    const dy_clamped = cy_local_clamped - this.marketCenterY;

    const cx_clamped = this.marketCenterX + dx_clamped * cosB - dy_clamped * sinB;
    const cy_clamped = this.marketCenterY + dx_clamped * sinB + dy_clamped * cosB;

    this.vb.x = cx_clamped - W / 2;
    this.vb.y = cy_clamped - H / 2;
  }

  renderViewBox() {
    this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.width} ${this.vb.height}`);
  }

  renderRotation() {
    if (this.layer) {
      this.layer.setAttribute('transform', `rotate(${this.rotation} ${this.marketCenterX} ${this.marketCenterY})`);
    }

    // Rotate compass icon on reset button to indicate current North
    const resetIcon = document.querySelector('#btn-reset-view svg');
    if (resetIcon) {
      resetIcon.style.transform = `rotate(${-this.rotation}deg)`;
    }

    this.notifyRotation();
  }

  /**
   * Subscribes a callback to real-time rotation changes.
   * @param {function(number): void} callback - Called with current rotation in degrees
   * @returns {function(): void} Unsubscribe function
   */
  addRotationListener(callback) {
    if (typeof callback === 'function') {
      this.rotationListeners.add(callback);
      // Immediately notify with current rotation
      callback(this.rotation);
    }
    return () => this.removeRotationListener(callback);
  }

  removeRotationListener(callback) {
    this.rotationListeners.delete(callback);
  }

  notifyRotation() {
    for (const listener of this.rotationListeners) {
      try {
        listener(this.rotation);
      } catch (err) {
        console.warn('[MapControls] Error in rotation listener:', err);
      }
    }
  }

  cancelPhysics() {
    if (this.momentumRaf) {
      cancelAnimationFrame(this.momentumRaf);
      this.momentumRaf = null;
    }
    if (this.animatingRaf) {
      cancelAnimationFrame(this.animatingRaf);
      this.animatingRaf = null;
    }
    this.vx = 0;
    this.vy = 0;
    this.vRot = 0;
  }

  bindEvents() {
    this.svg.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }

  bindButtons() {
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnReset = document.getElementById('btn-reset-view');

    // Add immediate tactile pressed feedback to all pill buttons
    document.querySelectorAll('.pill-btn').forEach((btn) => {
      const startPress = () => btn.classList.add('pill-btn--pressed');
      const endPress = () => {
        setTimeout(() => btn.classList.remove('pill-btn--pressed'), 120);
      };

      btn.addEventListener('pointerdown', startPress);
      btn.addEventListener('pointerup', endPress);
      btn.addEventListener('pointerleave', endPress);
      btn.addEventListener('pointercancel', endPress);
    });

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', (e) => {
        this.zoomStep(0.72);
        e.currentTarget.blur();
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', (e) => {
        this.zoomStep(1.35);
        e.currentTarget.blur();
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        this.resetToInitialView(true);
        e.currentTarget.blur();
      });
    }
  }

  onPointerDown(e) {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.card-floating')) return;

    this.cancelPhysics();
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const now = performance.now();
    this.lastPointerTime = now;

    if (this.activePointers.size === 1) {
      this.isPanning = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.dragDistance = 0;
    } else if (this.activePointers.size === 2) {
      this.isPanning = false;
      this.lastPinchDist = this.getPinchDistance();
      this.lastPinchAngle = this.getPinchAngle();
    }
  }

  onPointerMove(e) {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const rect = this.container.getBoundingClientRect();
    const scaleFactorX = this.vb.width / rect.width;
    const scaleFactorY = this.vb.height / rect.height;
    const now = performance.now();
    const dt = Math.max(1, now - this.lastPointerTime);

    if (this.activePointers.size === 1 && this.isPanning) {
      e.preventDefault();
      const rawDx = e.clientX - this.lastPointerX;
      const rawDy = e.clientY - this.lastPointerY;

      this.dragDistance += Math.hypot(rawDx, rawDy);

      // ViewBox panning: screen deltas map directly to SVG viewBox space.
      // No rotation correction needed — the viewBox operates in the SVG root
      // coordinate space, while rotation is applied independently inside the
      // <g> transform layer.
      const svgDx = rawDx * scaleFactorX;
      const svgDy = rawDy * scaleFactorY;

      this.vb.x -= svgDx;
      this.vb.y -= svgDy;

      // Track instant velocity for kinetic inertia throw
      const instantVx = -svgDx / dt;
      const instantVy = -svgDy / dt;
      this.vx = this.vx * 0.4 + instantVx * 0.6;
      this.vy = this.vy * 0.4 + instantVy * 0.6;

      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.lastPointerTime = now;

      this.clampViewBox();
      this.renderViewBox();
    } else if (this.activePointers.size === 2) {
      e.preventDefault();
      
      // 1. Pinch-to-zoom
      const currentDist = this.getPinchDistance();
      if (this.lastPinchDist && currentDist > 0) {
        const factor = this.lastPinchDist / currentDist;
        const center = this.getPinchCenter();
        this.zoomAtClientPoint(factor, center.x, center.y, false);
      }
      this.lastPinchDist = currentDist;

      // 2. Two-Finger Twist Rotation
      const currentAngle = this.getPinchAngle();
      if (this.lastPinchAngle !== null) {
        let deltaAngle = currentAngle - this.lastPinchAngle;
        while (deltaAngle < -180) deltaAngle += 360;
        while (deltaAngle > 180) deltaAngle -= 360;

        this.rotation = (this.rotation + deltaAngle) % 360;

        const instantVRot = deltaAngle / dt;
        this.vRot = this.vRot * 0.4 + instantVRot * 0.6;

        this.renderRotation();
      }
      this.lastPinchAngle = currentAngle;
      this.lastPointerTime = now;
    }
  }

  onPointerUp(e) {
    this.activePointers.delete(e.pointerId);

    if (this.activePointers.size === 0) {
      this.isPanning = false;
      this.lastPinchDist = null;
      this.lastPinchAngle = null;

      // Check double-tap gesture (if pointer moved less than 12px)
      if (this.dragDistance < 12) {
        const now = performance.now();
        const timeDiff = now - this.lastTapTime;
        const dist = Math.hypot(e.clientX - this.lastTapPos.x, e.clientY - this.lastTapPos.y);

        if (timeDiff < 280 && dist < 30) {
          // Double-Tap to Zoom In smoothly (Google Maps standard)
          this.zoomAtClientPoint(0.58, e.clientX, e.clientY, true);
          this.lastTapTime = 0;
          return;
        } else {
          this.lastTapTime = now;
          this.lastTapPos = { x: e.clientX, y: e.clientY };
        }
      }

      // Start kinetic inertia momentum if user flicked/swiped
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 0.08 || Math.abs(this.vRot) > 0.03) {
        this.startKineticMomentum();
      } else {
        this.checkNorthSnap();
      }
    } else if (this.activePointers.size === 1) {
      const remaining = [...this.activePointers.values()][0];
      this.isPanning = true;
      this.lastPointerX = remaining.x;
      this.lastPointerY = remaining.y;
      this.lastPointerTime = performance.now();
      this.lastPinchDist = null;
      this.lastPinchAngle = null;
      this.vx = 0;
      this.vy = 0;
    }
  }

  startKineticMomentum() {
    let lastTime = performance.now();

    const momentumStep = (now) => {
      if (this.activePointers.size > 0) return; // Cancel if user touches screen

      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      // Friction decay (smooth buttery deceleration)
      const decay = Math.pow(0.92, dt / 16);
      const rotDecay = Math.pow(0.88, dt / 16);

      this.vx *= decay;
      this.vy *= decay;
      this.vRot *= rotDecay;

      this.vb.x += this.vx * dt;
      this.vb.y += this.vy * dt;
      this.rotation = (this.rotation + this.vRot * dt) % 360;

      this.clampViewBox();
      this.renderViewBox();
      this.renderRotation();

      if (Math.hypot(this.vx, this.vy) > 0.015 || Math.abs(this.vRot) > 0.01) {
        this.momentumRaf = requestAnimationFrame(momentumStep);
      } else {
        this.checkNorthSnap();
      }
    };

    cancelAnimationFrame(this.momentumRaf);
    this.momentumRaf = requestAnimationFrame(momentumStep);
  }

  checkNorthSnap() {
    const normalizedRot = ((this.rotation % 360) + 360) % 360;
    if (normalizedRot < 7 || normalizedRot > 353) {
      // Smooth snap back to exact 0deg
      if (this.rotation !== 0) {
        this.animateRotationTo(0, 180);
      }
    }
  }

  animateRotationTo(targetRot, duration = 200) {
    const startRot = this.rotation;
    let rotDiff = (targetRot - startRot) % 360;
    if (rotDiff > 180) rotDiff -= 360;
    if (rotDiff < -180) rotDiff += 360;

    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.rotation = startRot + rotDiff * ease;
      this.renderRotation();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.82 : 1.22;
    this.zoomAtClientPoint(factor, e.clientX, e.clientY, false);
  }

  getPinchDistance() {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  getPinchAngle() {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return 0;
    return Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);
  }

  getPinchCenter() {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return { x: 0, y: 0 };
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2
    };
  }

  zoomAtClientPoint(factor, clientX, clientY, animate = false) {
    const rect = this.container.getBoundingClientRect();
    const normalizedX = (clientX - rect.left) / rect.width;
    const normalizedY = (clientY - rect.top) / rect.height;

    const targetSvgX = this.vb.x + (normalizedX * this.vb.width);
    const targetSvgY = this.vb.y + (normalizedY * this.vb.height);

    let newWidth = this.vb.width * factor;
    const maxW = this.getMaxVbWidth();
    newWidth = Math.max(this.minVbWidth, Math.min(maxW, newWidth));

    const aspect = rect.height / rect.width;
    const newHeight = newWidth * aspect;

    const newX = targetSvgX - (normalizedX * newWidth);
    const newY = targetSvgY - (normalizedY * newHeight);

    if (animate) {
      this.animateToViewBox(newX, newY, newWidth, newHeight, this.rotation, 240);
    } else {
      this.vb.x = newX;
      this.vb.y = newY;
      this.vb.width = newWidth;
      this.vb.height = newHeight;

      this.clampViewBox();
      this.renderViewBox();
    }
  }

  zoomStep(factor) {
    const rect = this.container.getBoundingClientRect();
    let targetW = this.vb.width * factor;
    const maxW = this.getMaxVbWidth();
    targetW = Math.max(this.minVbWidth, Math.min(maxW, targetW));
    
    const aspect = rect.height / rect.width;
    const targetH = targetW * aspect;

    const targetX = this.vb.x + (this.vb.width - targetW) / 2;
    const targetY = this.vb.y + (this.vb.height - targetH) / 2;

    this.animateToViewBox(targetX, targetY, targetW, targetH, this.rotation, 220);
  }

  /**
   * Smoothly frames the camera on the target coordinates while preserving current rotation.
   * @param {number} x - SVG target X in layer coordinates
   * @param {number} y - SVG target Y in layer coordinates
   * @param {number} [targetWidth=1200] - Viewport width
   * @param {boolean|number} [preserveRotation=true] - If true, preserves current rotation; if number, animates to that degree
   */
  focusOnCoordinates(x, y, targetWidth = 1200, preserveRotation = true) {
    const rect = this.container.getBoundingClientRect();
    const aspect = rect.height / rect.width;
    const targetHeight = targetWidth * aspect;

    const toRot = typeof preserveRotation === 'number'
      ? preserveRotation
      : (preserveRotation ? this.rotation : 0);

    // Transform layer coordinate (x, y) into root viewBox space by applying rotation around marketCenter
    const rad = toRot * (Math.PI / 180);
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const dx = x - this.marketCenterX;
    const dy = y - this.marketCenterY;

    const cx_vb = this.marketCenterX + dx * cosR - dy * sinR;
    const cy_vb = this.marketCenterY + dx * sinR + dy * cosR;

    const targetX = cx_vb - (targetWidth / 2);
    const targetY = cy_vb - (targetHeight / 2);

    this.animateToViewBox(targetX, targetY, targetWidth, targetHeight, toRot, 280);
  }

  /**
   * Smoothly centers the camera on dynamic coordinates in real time.
   * Used for real-time avatar tracking during walking navigation animation.
   * Accurately projects layer (x, y) into root viewBox space at any map rotation angle.
   * @param {number} x - SVG target X in layer coordinates
   * @param {number} y - SVG target Y in layer coordinates
   * @param {number|null} [targetWidth] - Viewport width; defaults to current or max 1400
   */
  centerOnCoordinates(x, y, targetWidth = null) {
    this.cancelPhysics();
    const rect = this.container.getBoundingClientRect();
    const aspect = (rect.height || 1) / (rect.width || 1);
    const w = targetWidth || Math.min(this.vb.width, 1400);
    const h = w * aspect;

    // Transform layer coordinate (x, y) into root viewBox space at current map rotation
    const rad = this.rotation * (Math.PI / 180);
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const dx = x - this.marketCenterX;
    const dy = y - this.marketCenterY;

    const cx_vb = this.marketCenterX + dx * cosR - dy * sinR;
    const cy_vb = this.marketCenterY + dx * sinR + dy * cosR;

    this.vb.width = w;
    this.vb.height = h;
    this.vb.x = cx_vb - (w / 2);
    this.vb.y = cy_vb - (h / 2);

    this.clampViewBox();
    this.renderViewBox();
  }

  focusElement(element, targetWidth = 1000, preserveRotation = true) {
    if (!element || typeof element.getBBox !== 'function') return;
    try {
      const bbox = element.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;
      this.focusOnCoordinates(cx, cy, targetWidth, preserveRotation);
    } catch (err) {
      console.warn('[MapControls] Could not get element bbox:', err);
    }
  }

  animateToViewBox(toX, toY, toW, toH, toRot = 0, duration = 260) {
    this.cancelPhysics();

    const startX = this.vb.x;
    const startY = this.vb.y;
    const startW = this.vb.width;
    const startH = this.vb.height;
    const startRot = this.rotation;
    const startTime = performance.now();

    // Shortest angular distance to toRot
    let rotDiff = (toRot - startRot) % 360;
    if (rotDiff > 180) rotDiff -= 360;
    if (rotDiff < -180) rotDiff += 360;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic for organic deceleration
      const ease = 1 - Math.pow(1 - progress, 3);

      this.vb.x = startX + (toX - startX) * ease;
      this.vb.y = startY + (toY - startY) * ease;
      this.vb.width = startW + (toW - startW) * ease;
      this.vb.height = startH + (toH - startH) * ease;
      this.rotation = startRot + rotDiff * ease;

      this.clampViewBox();
      this.renderViewBox();
      this.renderRotation();

      if (progress < 1) {
        this.animatingRaf = requestAnimationFrame(step);
      } else {
        this.animatingRaf = null;
      }
    };

    this.animatingRaf = requestAnimationFrame(step);
  }
}
