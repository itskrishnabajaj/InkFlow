/**
 * app.js — InkFlow Core Application
 *
 * Architecture:
 *   App          — bootstrap, routing, navigation
 *   Library      — comic grid, file import, continue reading
 *   Reader       — PDF rendering, virtual scroll, zoom/pan
 *   VirtualScroll — manages page slot visibility & render queue
 *   PdfRenderer  — wraps PDF.js, manages canvas pool & memory
 *   Toast        — notification system
 */

'use strict';

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* ═══════════════════════════════════════════════
   TOAST SYSTEM
═══════════════════════════════════════════════ */
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toastContainer');
  },

  show(msg, duration = 2400) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    this.container.appendChild(el);

    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  }
};

/* ═══════════════════════════════════════════════
   PDF RENDERER
   Wraps PDF.js with canvas pool & memory guard
═══════════════════════════════════════════════ */
class PdfRenderer {
  constructor() {
    this.pdfDoc     = null;
    this.totalPages = 0;
    // Map<pageNum, {canvas, renderTask}>
    this._rendered  = new Map();
    // Queue of pending render jobs
    this._queue     = [];
    this._busy      = false;
    // Max simultaneous renders
    this._maxConcurrent = 2;
    this._activeTasks   = 0;
  }

  async load(blob) {
    const url = URL.createObjectURL(blob);
    const loadingTask = pdfjsLib.getDocument({
      url,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
      disableRange: false,
      disableStream: false,
    });

    this.pdfDoc     = await loadingTask.promise;
    this.totalPages = this.pdfDoc.numPages;
    URL.revokeObjectURL(url);
    return this.totalPages;
  }

  /* Returns intrinsic size of a page at scale=1 */
  async getPageSize(pageNum) {
    const page    = await this.pdfDoc.getPage(pageNum);
    const vp      = page.getViewport({ scale: 1 });
    page.cleanup();
    return { width: vp.width, height: vp.height };
  }

  /**
   * Render page to a canvas element.
   * Returns the canvas. Uses devicePixelRatio for sharpness.
   * Priority renders happen immediately; others queue.
   */
  async renderPage(pageNum, targetWidth, canvas, onDone) {
    // Cancel any existing render for this page
    this.cancelPage(pageNum);

    const page   = await this.pdfDoc.getPage(pageNum);
    const vp0    = page.getViewport({ scale: 1 });
    const scale  = (targetWidth / vp0.width) * Math.min(window.devicePixelRatio, 2);
    const vp     = page.getViewport({ scale });

    canvas.width  = vp.width;
    canvas.height = vp.height;

    const ctx = canvas.getContext('2d', { alpha: false });

    const renderTask = page.render({
      canvasContext: ctx,
      viewport:      vp,
      intent:        'display',
    });

    this._rendered.set(pageNum, { canvas, renderTask });

    try {
      await renderTask.promise;
      page.cleanup();
      onDone && onDone(canvas);
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return;
      console.warn(`Page ${pageNum} render error:`, err);
    }
  }

  cancelPage(pageNum) {
    const rec = this._rendered.get(pageNum);
    if (rec?.renderTask) {
      try { rec.renderTask.cancel(); } catch (_) {}
    }
    this._rendered.delete(pageNum);
  }

  cancelAll() {
    for (const [num] of this._rendered) {
      this.cancelPage(num);
    }
    this._rendered.clear();
  }

  destroy() {
    this.cancelAll();
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
  }

  /* Render a thumbnail for library cover (page 1, small) */
  async renderThumbnail(pageNum = 1, thumbWidth = 240) {
    if (!this.pdfDoc) return null;
    const page  = await this.pdfDoc.getPage(pageNum);
    const vp0   = page.getViewport({ scale: 1 });
    const scale = thumbWidth / vp0.width;
    const vp    = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();
    return canvas;
  }
}

/* ═══════════════════════════════════════════════
   VIRTUAL SCROLL MANAGER
   Renders only visible + adjacent pages
   Uses IntersectionObserver for visibility detection
═══════════════════════════════════════════════ */
class VirtualScroll {
  constructor(renderer, container, viewport, totalPages, mode, onPageChange) {
    this.renderer    = renderer;
    this.container   = container;
    this.viewport    = viewport;
    this.totalPages  = totalPages;
    this.mode        = mode; // 'vertical' | 'horizontal'
    this.onPageChange = onPageChange;

    this._slots     = []; // Array of DOM slot elements
    this._observer  = null;
    this._rendered  = new Set();   // page numbers currently rendered
    this._pending   = new Set();   // page numbers queued
    this._maxBuffered = 5;         // max pages to keep in memory

    this._currentPage = 1;
    this._viewW = viewport.clientWidth;
    this._viewH = viewport.clientHeight;

    this._init();
  }

  _init() {
    // Create all page slot placeholders
    for (let i = 1; i <= this.totalPages; i++) {
      const slot = document.createElement('div');
      slot.className = 'page-slot';
      slot.dataset.page = i;
      slot.setAttribute('aria-label', `Page ${i}`);

      // Placeholder spinner
      const ph = document.createElement('div');
      ph.className = 'page-placeholder';
      const spinner = document.createElement('div');
      spinner.className = 'page-spinner';
      ph.appendChild(spinner);
      slot.appendChild(ph);

      if (this.mode === 'vertical') {
        // Set an estimated height to prevent layout collapse
        slot.style.minHeight = Math.round(this._viewH * 1.3) + 'px';
        slot.style.width = '100%';
      } else {
        slot.style.width  = this._viewW + 'px';
        slot.style.height = this._viewH + 'px';
        slot.style.minWidth = this._viewW + 'px';
      }

      this.container.appendChild(slot);
      this._slots.push(slot);
    }

    this._setupObserver();
  }

  _setupObserver() {
    const margin = this.mode === 'vertical'
      ? `${this._viewH}px 0px`   // top/bottom buffer = 1 viewport
      : `0px ${this._viewW}px`;  // left/right buffer = 1 viewport

    this._observer = new IntersectionObserver(
      (entries) => this._onIntersect(entries),
      {
        root:       this.viewport,
        rootMargin: margin,
        threshold:  0,
      }
    );

    this._slots.forEach(slot => this._observer.observe(slot));
  }

  _onIntersect(entries) {
    for (const entry of entries) {
      const pageNum = parseInt(entry.target.dataset.page);
      if (entry.isIntersecting) {
        this._scheduleRender(pageNum, entry.target);
        // Update current page
        const mid = this.mode === 'vertical'
          ? entry.boundingClientRect.top + entry.boundingClientRect.height / 2
          : entry.boundingClientRect.left + entry.boundingClientRect.width / 2;

        const viewMid = this.mode === 'vertical'
          ? this._viewH / 2
          : this._viewW / 2;

        if (Math.abs(mid - viewMid) < (this.mode === 'vertical' ? this._viewH * 0.6 : this._viewW * 0.6)) {
          if (this._currentPage !== pageNum) {
            this._currentPage = pageNum;
            this.onPageChange && this.onPageChange(pageNum);
          }
        }
      } else {
        this._evictPage(pageNum, entry.target);
      }
    }
  }

  _scheduleRender(pageNum, slot) {
    if (this._rendered.has(pageNum) || this._pending.has(pageNum)) return;

    this._pending.add(pageNum);
    this._renderSlot(pageNum, slot);
  }

  async _renderSlot(pageNum, slot) {
    // Memory guard — evict far pages if over limit
    this._evictFarPages(pageNum);

    let canvas = slot.querySelector('canvas.page-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'page-canvas';
      canvas.style.opacity = '0';
    }

    const targetWidth = this.mode === 'vertical'
      ? Math.round(this._viewW)
      : Math.round(this._viewW);

    try {
      await this.renderer.renderPage(pageNum, targetWidth, canvas, (c) => {
        // Adjust slot size to match rendered content
        if (this.mode === 'vertical') {
          const aspect = c.height / c.width;
          slot.style.minHeight = Math.round(this._viewW * aspect) + 'px';
        }

        const ph = slot.querySelector('.page-placeholder');
        if (ph) ph.remove();

        if (!slot.contains(c)) {
          slot.appendChild(c);
        }

        // Smooth appear
        requestAnimationFrame(() => {
          c.style.transition = 'opacity 0.2s ease';
          c.style.opacity    = '1';
        });

        this._rendered.add(pageNum);
        this._pending.delete(pageNum);
      });
    } catch (err) {
      this._pending.delete(pageNum);
      console.warn('Render failed for page', pageNum, err);
    }
  }

  _evictPage(pageNum, slot) {
    // Only evict pages that are far outside viewport (already handled by observer leaving)
    // Keep a buffer of _maxBuffered pages
    if (!this._rendered.has(pageNum)) return;

    // Check if within safety buffer of current page
    const dist = Math.abs(pageNum - this._currentPage);
    if (dist <= 2) return; // Keep ±2 pages always

    this.renderer.cancelPage(pageNum);
    const canvas = slot.querySelector('canvas.page-canvas');
    if (canvas) {
      canvas.style.opacity = '0';
      // Re-add placeholder
      if (!slot.querySelector('.page-placeholder')) {
        const ph = document.createElement('div');
        ph.className = 'page-placeholder';
        const sp = document.createElement('div');
        sp.className = 'page-spinner';
        ph.appendChild(sp);
        slot.insertBefore(ph, canvas);
      }
      setTimeout(() => canvas.remove(), 200);
    }
    this._rendered.delete(pageNum);
  }

  _evictFarPages(nearPage) {
    if (this._rendered.size < this._maxBuffered) return;

    // Find the farthest rendered page
    let farthest = -1;
    let maxDist  = 0;
    for (const p of this._rendered) {
      const d = Math.abs(p - nearPage);
      if (d > maxDist) { maxDist = d; farthest = p; }
    }
    if (farthest > 0 && maxDist > 3) {
      const farSlot = this._slots[farthest - 1];
      if (farSlot) this._evictPage(farthest, farSlot);
    }
  }

  scrollToPage(pageNum, smooth = false) {
    const slot = this._slots[pageNum - 1];
    if (!slot) return;
    slot.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start', inline: 'start' });
  }

  getCurrentPage() { return this._currentPage; }

  destroy() {
    if (this._observer) this._observer.disconnect();
    this._slots = [];
    this._rendered.clear();
    this._pending.clear();
  }
}

/* ═══════════════════════════════════════════════
   READER
   Manages the fullscreen reading experience
═══════════════════════════════════════════════ */
class Reader {
  constructor() {
    this.el            = document.getElementById('reader');
    this.viewport      = document.getElementById('readerViewport');
    this.container     = document.getElementById('pagesContainer');
    this.topBar        = document.getElementById('readerTopBar');
    this.bottomBar     = document.getElementById('readerBottomBar');
    this.loader        = document.getElementById('readerLoader');
    this.loaderText    = document.getElementById('readerLoaderText');
    this.titleEl       = document.getElementById('readerTitle');
    this.pageLabel     = document.getElementById('readerPageLabel');
    this.pageFill      = document.getElementById('progressFill');
    this.pageThumb     = document.getElementById('progressThumb');
    this.totalLabel    = document.getElementById('totalPagesLabel');
    this.currentNum    = document.getElementById('currentPageNum');
    this.zoomHint      = document.getElementById('zoomHint');
    this.zoomLevel     = document.getElementById('zoomLevel');
    this.tapZoneL      = document.getElementById('tapZoneLeft');
    this.tapZoneR      = document.getElementById('tapZoneRight');

    this.renderer      = null;
    this.virtualScroll = null;
    this.gestures      = null;

    this.comic         = null;  // current comic meta
    this.totalPages    = 0;
    this.currentPage   = 1;
    this.mode          = 'vertical'; // 'vertical' | 'horizontal'

    /* Zoom/Pan state (for zoom mode on vertical; paging on horizontal) */
    this._scale         = 1;
    this._minScale      = 1;
    this._maxScale      = 5;
    this._translateX    = 0;
    this._translateY    = 0;
    this._uiVisible     = true;
    this._uiTimer       = null;

    /* Horizontal paging state */
    this._hPageOffset   = 0;
    this._hMomentum     = false;

    /* Progress scrubber state */
    this._scrubbing     = false;

    this._zoomHintTimer = null;

    this._bindUI();
  }

  _bindUI() {
    document.getElementById('btnClose').addEventListener('click', () => App.closeReader());
    document.getElementById('btnModeToggle').addEventListener('click', () => this._toggleMode());
    document.getElementById('btnNextPage').addEventListener('click', () => this._jumpPage(1));
    document.getElementById('btnPrevPage').addEventListener('click', () => this._jumpPage(-1));

    // Tap zone navigation (horizontal mode)
    this.tapZoneL.addEventListener('click', () => { if (this.mode === 'horizontal') this._jumpPage(-1); });
    this.tapZoneR.addEventListener('click', () => { if (this.mode === 'horizontal') this._jumpPage(1); });

    // Progress scrubber
    const track = document.getElementById('progressTrack');
    track.addEventListener('pointerdown', (e) => this._startScrub(e));
    track.addEventListener('pointermove', (e) => this._moveScrub(e));
    track.addEventListener('pointerup',   (e) => this._endScrub(e));
  }

  async open(comic) {
    this.comic = comic;

    // Show reader
    this.el.classList.remove('hidden');
    this.el.classList.add('entering');
    setTimeout(() => this.el.classList.remove('entering'), 500);

    this.loader.classList.remove('hidden');
    this.loaderText.textContent = 'Loading PDF…';

    this._showUI();

    try {
      // Get blob from IndexedDB
      const blob = await DB.getFile(comic.id);
      if (!blob) throw new Error('File not found');

      // Load saved mode preference
      const prog = await DB.getProgress(comic.id);
      if (prog?.mode) this.mode = prog.mode;

      // Init renderer
      if (this.renderer) this.renderer.destroy();
      this.renderer = new PdfRenderer();
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      this.loaderText.textContent = 'Parsing pages…';
      this.totalPages = await this.renderer.load(blob);

      this.loaderText.textContent = 'Rendering…';
      this._initLayout();

      this.titleEl.textContent = comic.title;
      this.totalLabel.textContent = this.totalPages;
      this.currentNum.textContent = '1';
      this.pageLabel.textContent  = `${this.totalPages} pages`;

      // Restore position
      const startPage = (prog?.currentPage && prog.currentPage > 1)
        ? Math.min(prog.currentPage, this.totalPages)
        : 1;

      // Hide loader
      this.loader.classList.add('hidden');

      // Scroll to saved page after brief delay
      if (startPage > 1) {
        setTimeout(() => {
          this.virtualScroll?.scrollToPage(startPage);
        }, 300);
      }

      this._initGestures();
      this._scheduleUIHide();

    } catch (err) {
      console.error('Reader open error:', err);
      this.loader.classList.add('hidden');
      Toast.show('Failed to open comic');
      App.closeReader();
    }
  }

  _initLayout() {
    // Clear container
    this.container.innerHTML = '';
    if (this.virtualScroll) this.virtualScroll.destroy();

    // Set container class
    this.container.className = `pages-container mode-${this.mode}`;

    // Reset transform
    this._scale      = 1;
    this._translateX = 0;
    this._translateY = 0;
    this._applyTransform(false);

    // Create virtual scroll
    this.virtualScroll = new VirtualScroll(
      this.renderer,
      this.container,
      this.viewport,
      this.totalPages,
      this.mode,
      (page) => this._onPageChanged(page)
    );

    // Tap zones: only show in horizontal mode
    if (this.mode === 'horizontal') {
      this.tapZoneL.style.display = '';
      this.tapZoneR.style.display = '';
    } else {
      this.tapZoneL.style.display = 'none';
      this.tapZoneR.style.display = 'none';
    }

    // Mode toggle icons
    document.getElementById('iconVertical').classList.toggle('hidden',  this.mode === 'vertical');
    document.getElementById('iconHorizontal').classList.toggle('hidden', this.mode === 'horizontal');
  }

  _initGestures() {
    if (this.gestures) this.gestures.destroy();

    this.gestures = new GestureEngine(this.viewport, {
      getCurrentScale: () => this._scale,

      onTap: (x, y) => {
        // Toggle UI
        this._toggleUI();
        this._scheduleUIHide();
      },

      onDoubleTap: (x, y) => {
        if (this._scale > 1.05) {
          this._zoomTo(1, x, y, true);
        } else {
          this._zoomTo(2.5, x, y, true);
        }
      },

      onPan: (dx, dy, isDragging) => {
        if (this.mode === 'vertical') {
          if (this._scale > 1.05) {
            // Zoom pan
            this._translateX += dx;
            this._translateY += dy;
            this._clampPan();
            this._applyTransform(false);
          } else {
            // Natural scroll — let the container scroll
            this.viewport.scrollTop -= dy;
          }
        } else {
          // Horizontal paging — rubber-band drag
          this._translateX += dx;
          this._applyTransform(false);
        }
      },

      onPanEnd: () => {
        if (this.mode === 'horizontal' && this._scale <= 1.05) {
          this._snapHorizontalPage();
        }
      },

      onPinch: (newScale, midX, midY, panDx, panDy) => {
        const clamped = clamp(newScale, this._minScale, this._maxScale);
        this._scale      = clamped;
        this._translateX = panDx;
        this._translateY = panDy;
        this._clampPan();
        this._applyTransform(false);
        this._showZoomHint();
      },

      onPinchEnd: () => {
        if (this._scale < 1.05) {
          this._zoomTo(1, 0, 0, true);
        }
        this._showZoomHint();
      },

      onLongPress: () => {},
    });
  }

  _onPageChanged(page) {
    this.currentPage = page;
    this.currentNum.textContent = page;
    this.pageLabel.textContent  = `${page} / ${this.totalPages}`;

    const pct = (page - 1) / Math.max(this.totalPages - 1, 1);
    this.pageFill.style.width  = (pct * 100) + '%';
    this.pageThumb.style.left  = (pct * 100) + '%';

    // Save progress (throttle)
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      DB.saveProgress(this.comic.id, {
        currentPage: page,
        totalPages:  this.totalPages,
        mode:        this.mode,
      });
    }, 1500);
  }

  _applyTransform(animate = false) {
    this.container.style.transition = animate
      ? 'transform 0.32s cubic-bezier(0.16,1,0.3,1)'
      : 'none';

    if (this.mode === 'vertical') {
      this.container.style.transform =
        `translate(${this._translateX}px, ${this._translateY}px) scale(${this._scale})`;
    } else {
      // Horizontal: translateX drives page position
      this.container.style.transform =
        `translateX(${this._translateX}px) scale(${this._scale})`;
    }
  }

  _clampPan() {
    if (this._scale <= 1) {
      this._translateX = 0;
      this._translateY = 0;
      return;
    }
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const maxX = ((this._scale - 1) * vw) / 2;
    const maxY = ((this._scale - 1) * vh) / 2;
    this._translateX = clamp(this._translateX, -maxX, maxX);
    this._translateY = clamp(this._translateY, -maxY, maxY);
  }

  _zoomTo(targetScale, cx, cy, animate) {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;

    if (targetScale <= 1) {
      this._scale      = 1;
      this._translateX = 0;
      this._translateY = 0;
    } else {
      // Zoom into the tap point
      const dx = (cx - vw / 2);
      const dy = (cy - vh / 2);
      this._scale      = targetScale;
      this._translateX = -dx * (targetScale - 1) / targetScale;
      this._translateY = (this.mode === 'vertical') ? -dy * (targetScale - 1) / targetScale : 0;
      this._clampPan();
    }

    this._applyTransform(animate);
    this._showZoomHint();
  }

  _snapHorizontalPage() {
    // Snap to nearest page based on current translateX
    const vw    = this.viewport.clientWidth;
    const page  = this.currentPage;
    const target = -(page - 1) * vw;

    // Detect swipe direction
    const diff = this._translateX - target;
    let dest   = page;

    if (diff < -vw * 0.2 && page < this.totalPages) dest = page + 1;
    else if (diff > vw * 0.2 && page > 1)           dest = page - 1;

    this._jumpToHPage(dest, true);
  }

  _jumpToHPage(page, animate = true) {
    page = clamp(page, 1, this.totalPages);
    const vw    = this.viewport.clientWidth;
    this._translateX = -(page - 1) * vw;
    this._applyTransform(animate);
    // Page change will fire from IntersectionObserver
  }

  _jumpPage(dir) {
    if (this.mode === 'vertical') {
      const target = clamp(this.currentPage + dir, 1, this.totalPages);
      this.virtualScroll.scrollToPage(target, true);
    } else {
      const target = clamp(this.currentPage + dir, 1, this.totalPages);
      this._jumpToHPage(target, true);
    }
  }

  _toggleMode() {
    this.mode = this.mode === 'vertical' ? 'horizontal' : 'vertical';
    const savedPage = this.currentPage;

    this._initLayout();
    this._initGestures();

    // Restore to current page
    setTimeout(() => {
      if (this.mode === 'vertical') {
        this.virtualScroll.scrollToPage(savedPage);
      } else {
        this._jumpToHPage(savedPage, false);
      }
    }, 100);

    Toast.show(this.mode === 'vertical' ? 'Vertical scroll mode' : 'Horizontal page mode');
  }

  /* ── UI visibility ── */
  _showUI() {
    this._uiVisible = true;
    this.topBar.classList.remove('ui-hidden');
    this.bottomBar.classList.remove('ui-hidden');
  }

  _hideUI() {
    this._uiVisible = false;
    this.topBar.classList.add('ui-hidden');
    this.bottomBar.classList.add('ui-hidden');
    this.zoomHint.classList.remove('visible');
  }

  _toggleUI() {
    if (this._uiVisible) this._hideUI();
    else this._showUI();
  }

  _scheduleUIHide(delay = 3500) {
    clearTimeout(this._uiTimer);
    this._uiTimer = setTimeout(() => this._hideUI(), delay);
  }

  /* ── Zoom hint ── */
  _showZoomHint() {
    const pct = Math.round(this._scale * 100);
    this.zoomLevel.textContent = pct + '%';
    this.zoomHint.classList.add('visible');
    clearTimeout(this._zoomHintTimer);
    this._zoomHintTimer = setTimeout(() => {
      this.zoomHint.classList.remove('visible');
    }, 1500);
  }

  /* ── Progress scrubber ── */
  _startScrub(e) {
    this._scrubbing = true;
    document.getElementById('progressTrack').setPointerCapture(e.pointerId);
    this._doScrub(e);
  }

  _moveScrub(e) {
    if (!this._scrubbing) return;
    this._doScrub(e);
  }

  _endScrub(e) {
    if (!this._scrubbing) return;
    this._scrubbing = false;
    this._doScrub(e);
  }

  _doScrub(e) {
    const track  = document.getElementById('progressTrack');
    const rect   = track.getBoundingClientRect();
    const pct    = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const page   = Math.round(pct * (this.totalPages - 1)) + 1;

    if (page !== this.currentPage) {
      if (this.mode === 'vertical') {
        this.virtualScroll.scrollToPage(page);
      } else {
        this._jumpToHPage(page, false);
      }
    }
  }

  close() {
    if (this.virtualScroll) this.virtualScroll.destroy();
    if (this.renderer)      this.renderer.destroy();
    if (this.gestures)      this.gestures.destroy();

    this.container.innerHTML = '';
    this.el.classList.add('exiting');
    setTimeout(() => {
      this.el.classList.remove('exiting');
      this.el.classList.add('hidden');
    }, 400);

    clearTimeout(this._uiTimer);
    clearTimeout(this._saveTimer);

    // Save final progress
    if (this.comic) {
      DB.saveProgress(this.comic.id, {
        currentPage: this.currentPage,
        totalPages:  this.totalPages,
        mode:        this.mode,
      });
    }
  }
}

/* ═══════════════════════════════════════════════
   LIBRARY
   Comic grid, file import, cover generation
═══════════════════════════════════════════════ */
class Library {
  constructor() {
    this.el           = document.getElementById('library');
    this.comicGrid    = document.getElementById('comicGrid');
    this.continueGrid = document.getElementById('continueGrid');
    this.continueSection = document.getElementById('continueSection');
    this.sortToggle   = document.getElementById('sortToggle');
    this.emptyState   = document.getElementById('emptyState');
    this.titleEl      = document.getElementById('allComicsTitle');

    this._comics      = [];   // All comic metas
    this._progress    = {};   // Map<id, progressData>
    this._sortBy      = 'title';

    this._contextComic = null;
    this._longPressTimer = null;

    this._bindUI();
  }

  _bindUI() {
    document.getElementById('btnAddComic').addEventListener('click', () => this._pickFiles());
    document.getElementById('btnEmptyAdd').addEventListener('click', () => this._pickFiles());
    document.getElementById('fileInput').addEventListener('change', (e) => this._onFilesChosen(e));

    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this._sortBy = e.target.dataset.sort;
        this._renderGrid();
      });
    });

    // Context menu
    document.getElementById('ctxRead').addEventListener('click',   () => this._ctxRead());
    document.getElementById('ctxReset').addEventListener('click',  () => this._ctxReset());
    document.getElementById('ctxDelete').addEventListener('click', () => this._ctxDelete());
    document.getElementById('contextOverlay').addEventListener('click', () => this._closeContext());
  }

  _pickFiles() {
    document.getElementById('fileInput').click();
  }

  async _onFilesChosen(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;

    Toast.show(`Importing ${files.length} file${files.length > 1 ? 's' : ''}…`);

    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        Toast.show(`Skipped: ${file.name} (not a PDF)`);
        continue;
      }
      await this._importFile(file);
    }

    await this.refresh();
  }

  async _importFile(file) {
    const id = uid();
    const title = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

    // Save blob
    await DB.saveFile(id, file);

    // Generate cover thumbnail
    let coverDataUrl = '';
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const tempRenderer = new PdfRenderer();
      const url = URL.createObjectURL(file);
      const loadingTask = pdfjsLib.getDocument({ url });
      tempRenderer.pdfDoc = await loadingTask.promise;
      URL.revokeObjectURL(url);

      const thumb = await tempRenderer.renderThumbnail(1, 260);
      if (thumb) coverDataUrl = thumb.toDataURL('image/jpeg', 0.7);
      tempRenderer.destroy();
    } catch (err) {
      console.warn('Cover generation failed', err);
    }

    await DB.saveComic({ id, title, size: file.size, addedAt: Date.now(), coverDataUrl });
  }

  async refresh() {
    this._comics = await DB.getAllComics();
    const allProgress = await DB.getAllProgress();
    this._progress = {};
    allProgress.forEach(p => this._progress[p.id] = p);

    this._renderGrid();
    this._renderContinue();
  }

  _sortedComics() {
    const c = [...this._comics];
    if (this._sortBy === 'title') {
      c.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      c.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
    return c;
  }

  _renderGrid() {
    this.comicGrid.innerHTML = '';
    const sorted = this._sortedComics();

    if (sorted.length === 0) {
      this.emptyState.classList.remove('hidden');
      this.sortToggle.classList.add('hidden');
      return;
    }

    this.emptyState.classList.add('hidden');
    this.sortToggle.classList.remove('hidden');

    sorted.forEach((comic, i) => {
      const card = this._buildCard(comic, i);
      this.comicGrid.appendChild(card);
    });
  }

  _renderContinue() {
    this.continueGrid.innerHTML = '';
    const inProgress = this._comics.filter(c => {
      const p = this._progress[c.id];
      return p && p.currentPage > 1 && p.currentPage < p.totalPages;
    });

    if (inProgress.length === 0) {
      this.continueSection.classList.add('hidden');
      return;
    }

    this.continueSection.classList.remove('hidden');
    inProgress
      .sort((a, b) => (this._progress[b.id]?.lastRead || 0) - (this._progress[a.id]?.lastRead || 0))
      .forEach((comic, i) => {
        const card = this._buildContinueCard(comic, i);
        this.continueGrid.appendChild(card);
      });
  }

  _buildCard(comic, index) {
    const card = document.createElement('div');
    card.className = 'comic-card';
    card.style.animationDelay = Math.min(index * 40, 400) + 'ms';

    const prog  = this._progress[comic.id];
    const pct   = prog ? (prog.currentPage - 1) / Math.max(prog.totalPages - 1, 1) : 0;

    card.innerHTML = `
      <div class="cover-wrap">
        ${comic.coverDataUrl
          ? `<canvas class="cover-canvas" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></canvas>`
          : '<div class="cover-shimmer"></div>'
        }
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width:${Math.round(pct * 100)}%"></div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${this._esc(comic.title)}</div>
        <div class="card-meta">${prog ? `Page ${prog.currentPage}` : 'Not started'}</div>
      </div>
    `;

    // Render cover image if available
    if (comic.coverDataUrl) {
      const img    = new Image();
      img.onload   = () => {
        const cvs = card.querySelector('canvas.cover-canvas');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        cvs.width  = img.naturalWidth;
        cvs.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      };
      img.src = comic.coverDataUrl;
    }

    // Open on tap
    card.addEventListener('click', () => App.openReader(comic));

    // Long-press context menu
    this._attachLongPress(card, comic);

    return card;
  }

  _buildContinueCard(comic, index) {
    const card = document.createElement('div');
    card.className = 'continue-card';
    card.style.animationDelay = Math.min(index * 60, 300) + 'ms';

    const prog = this._progress[comic.id] || {};
    const pct  = prog.currentPage
      ? Math.round((prog.currentPage - 1) / Math.max(prog.totalPages - 1, 1) * 100)
      : 0;

    card.innerHTML = `
      <div class="continue-cover-wrap">
        ${comic.coverDataUrl ? '<canvas></canvas>' : '<div class="cover-shimmer" style="position:absolute;inset:0"></div>'}
      </div>
      <div class="continue-info">
        <div class="continue-title">${this._esc(comic.title)}</div>
        <div class="continue-sub">Page ${prog.currentPage || 1} of ${prog.totalPages || '?'}</div>
        <div class="continue-progress-wrap">
          <div class="continue-bar-track">
            <div class="continue-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="continue-pct">${pct}%</span>
        </div>
      </div>
      <div class="continue-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    `;

    // Render cover
    if (comic.coverDataUrl) {
      const img = new Image();
      img.onload = () => {
        const cvs = card.querySelector('canvas');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        cvs.width  = img.naturalWidth;
        cvs.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      };
      img.src = comic.coverDataUrl;
    }

    card.addEventListener('click', () => App.openReader(comic));
    return card;
  }

  _attachLongPress(card, comic) {
    let timer = null;

    const start = (e) => {
      timer = setTimeout(() => {
        timer = null;
        this._openContext(comic, e.clientX, e.clientY);
      }, 500);
    };

    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

    card.addEventListener('pointerdown', start);
    card.addEventListener('pointerup',    cancel);
    card.addEventListener('pointercancel',cancel);
    card.addEventListener('pointermove',  cancel);
  }

  _openContext(comic, x, y) {
    this._contextComic = comic;
    document.getElementById('contextMenuTitle').textContent = comic.title;
    document.getElementById('contextMenu').classList.remove('hidden');
    document.getElementById('contextOverlay').classList.remove('hidden');
  }

  _closeContext() {
    const menu = document.getElementById('contextMenu');
    menu.classList.add('dismissing');
    setTimeout(() => {
      menu.classList.remove('hidden', 'dismissing');
      document.getElementById('contextOverlay').classList.add('hidden');
      this._contextComic = null;
    }, 300);
  }

  async _ctxRead() {
    const c = this._contextComic;
    this._closeContext();
    if (c) setTimeout(() => App.openReader(c), 350);
  }

  async _ctxReset() {
    const c = this._contextComic;
    this._closeContext();
    if (!c) return;
    await DB.resetProgress(c.id);
    await this.refresh();
    Toast.show('Progress reset');
  }

  async _ctxDelete() {
    const c = this._contextComic;
    this._closeContext();
    if (!c) return;
    await DB.deleteComic(c.id);
    await this.refresh();
    Toast.show(`Deleted "${c.title}"`);
  }

  show() {
    this.el.classList.remove('hidden');
    this.el.classList.add('entering');
    setTimeout(() => this.el.classList.remove('entering'), 500);
  }

  hide() {
    this.el.classList.add('hidden');
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

/* ═══════════════════════════════════════════════
   APP — Bootstrap & Navigation
═══════════════════════════════════════════════ */
const App = {
  library: null,
  reader:  null,

  async init() {
    // Set PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    Toast.init();

    // Init IndexedDB
    await DB.init();

    // Init components
    this.library = new Library();
    this.reader  = new Reader();

    // Register service worker
    this._registerSW();

    // Simulate brief load (splash), then enter library
    setTimeout(async () => {
      const splash = document.getElementById('splash');
      splash.classList.add('fade-out');

      await this.library.refresh();
      this.library.show();

      setTimeout(() => splash.remove(), 500);
    }, 1600);

    // Handle Android back button
    window.addEventListener('popstate', () => {
      if (!this.reader.el.classList.contains('hidden')) {
        this.closeReader();
      }
    });
  },

  async openReader(comic) {
    // Push state for back button handling
    history.pushState({ reading: true }, '');

    this.library.hide();
    await this.reader.open(comic);
  },

  closeReader() {
    this.reader.close();
    this.library.refresh().then(() => this.library.show());

    // Remove the pushed state if it's still there
    if (history.state?.reading) {
      history.back();
    }
  },

  _registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(() => console.log('[InkFlow] SW registered'))
        .catch(err => console.warn('[InkFlow] SW registration failed:', err));
    }
  }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
