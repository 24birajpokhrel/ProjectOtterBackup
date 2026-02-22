/**
 * AccessiLens — content-scripts/focus-ruler.js
 *
 * The Focus Ruler engine. Injected into every webpage via manifest.json.
 * Creates a Shadow DOM reading mask that dims the page except for a
 * horizontal strip following the user's cursor.
 *
 * Architecture:
 *   - Shadow DOM (mode: 'closed') for full CSS isolation from host page
 *   - Single-element CSS gradient masking (avoids 1px gap at non-integer DPR)
 *   - requestAnimationFrame loop decoupled from mousemove events
 *   - CSS custom properties as the sole JS→CSS interface (GPU compositing)
 *   - chrome.storage.local for persistent state
 *   - chrome.runtime.onMessage for live popup → content script control
 *
 * Change log vs original:
 *   - Renamed guard flag: __projectOtterRulerLoaded → __alRulerLoaded
 *   - Renamed shadow host ID: __otter-ruler-host__ → __al-ruler-host__
 *   - Renamed console prefix: [ProjectOtter] → [AccessiLens]
 *   - Added REAPPLY_STATE handler (service worker sends this on navigation)
 *
 * Depends on: utils/storage-helper.js (loaded before this in manifest.json)
 * Globals available: window.STORAGE_KEYS, window.StorageHelper
 */

;(() => {
    'use strict';
  
    // ── Guard: prevent double-injection ────────────────────────────────────────
    if (window.__alRulerLoaded) return;
    window.__alRulerLoaded = true;
  
    // ── Local references to globals from storage-helper.js ────────────────────
    const KEYS = window.STORAGE_KEYS || {
      RULER_ENABLED : 'focusRulerEnabled',
      RULER_HEIGHT  : 'rulerHeight',
      DIM_OPACITY   : 'dimOpacity',
    };
  
    // ── Constants ──────────────────────────────────────────────────────────────
    const SHADOW_HOST_ID  = '__al-ruler-host__';
    const OVERLAY_CLASS   = 'ruler-overlay';
    const DEFAULT_HEIGHT  = 40;
    const DEFAULT_OPACITY = 0.75;
    const DEFAULT_Y       = window.innerHeight / 2;
  
    // ── Module state ───────────────────────────────────────────────────────────
    let shadowHost = null;
    let shadowRoot = null;
    let overlay    = null;
    let isEnabled  = false;
    let rafId      = null;
    let pendingY   = null;
    let currentY   = DEFAULT_Y;
  
    // ── Bootstrap ──────────────────────────────────────────────────────────────
    init();
  
    async function init() {
      try {
        const result = await chrome.storage.local.get([
          KEYS.RULER_ENABLED,
          KEYS.RULER_HEIGHT,
          KEYS.DIM_OPACITY,
        ]);
  
        if (result[KEYS.RULER_ENABLED] === true) {
          enable({
            height  : result[KEYS.RULER_HEIGHT] ?? DEFAULT_HEIGHT,
            opacity : result[KEYS.DIM_OPACITY]  ?? DEFAULT_OPACITY,
          });
        }
      } catch (err) {
        console.debug('[AccessiLens] focus-ruler storage read failed:', err.message);
      }
  
      registerMessageListener();
    }
  
    // ── Enable / Disable ───────────────────────────────────────────────────────
    function enable(settings = {}) {
      if (isEnabled) { applySettings(settings); return; }
      isEnabled = true;
      createOverlay(settings);
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('resize',   onResize,    { passive: true });
      startRaf();
      console.debug('[AccessiLens] Focus Ruler enabled.');
    }
  
    function disable() {
      if (!isEnabled) return;
      isEnabled = false;
      stopRaf();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize',   onResize);
      destroyOverlay();
      console.debug('[AccessiLens] Focus Ruler disabled.');
    }
  
    // ── Shadow DOM + Overlay ───────────────────────────────────────────────────
    function createOverlay({ height = DEFAULT_HEIGHT, opacity = DEFAULT_OPACITY } = {}) {
      document.getElementById(SHADOW_HOST_ID)?.remove();
  
      shadowHost = document.createElement('div');
      shadowHost.id = SHADOW_HOST_ID;
      Object.assign(shadowHost.style, {
        all           : 'initial',
        position      : 'fixed',
        inset         : '0',
        width         : '0',
        height        : '0',
        overflow      : 'visible',
        zIndex        : '2147483647',
        pointerEvents : 'none',
        display       : 'block',
      });
  
      shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
  
      const styleEl = document.createElement('style');
      styleEl.textContent = getRulerCSS();
      shadowRoot.appendChild(styleEl);
  
      overlay = document.createElement('div');
      overlay.className = OVERLAY_CLASS;
      shadowRoot.appendChild(overlay);
  
      setVar('--ruler-y',      `${currentY}px`);
      setVar('--ruler-height', `${height}px`);
      setVar('--dim-opacity',  `${opacity}`);
      setVar('--vw',           `${window.innerWidth}px`);
      setVar('--vh',           `${window.innerHeight}px`);
  
      (document.body || document.documentElement).appendChild(shadowHost);
    }
  
    function destroyOverlay() {
      shadowHost?.remove();
      shadowHost = null;
      shadowRoot = null;
      overlay    = null;
    }
  
    // ── CSS Variables ──────────────────────────────────────────────────────────
    function setVar(name, value) {
      overlay?.style.setProperty(name, value);
    }
  
    function applySettings({ height, opacity } = {}) {
      if (height  !== undefined) setVar('--ruler-height', `${height}px`);
      if (opacity !== undefined) setVar('--dim-opacity',  `${opacity}`);
    }
  
    // ── rAF Loop ───────────────────────────────────────────────────────────────
    // mousemove fires at hardware polling rate (up to 1000hz).
    // rAF fires at display refresh rate (60–120hz).
    // Write to pendingY in mousemove; read once per frame in rAF.
    // This caps DOM writes at display refresh rate regardless of mouse speed.
    function startRaf() {
      function loop() {
        if (!isEnabled) return;
        if (pendingY !== null) {
          currentY = pendingY;
          pendingY = null;
          setVar('--ruler-y', `${currentY}px`);
        }
        rafId = requestAnimationFrame(loop);
      }
      rafId = requestAnimationFrame(loop);
    }
  
    function stopRaf() {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }
  
    // ── Event Handlers ─────────────────────────────────────────────────────────
    function onMouseMove(e) { pendingY = e.clientY; }
    function onResize() {
      setVar('--vw', `${window.innerWidth}px`);
      setVar('--vh', `${window.innerHeight}px`);
    }
  
    // ── Message Listener ───────────────────────────────────────────────────────
    function registerMessageListener() {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        switch (message.type) {
  
          case 'FOCUS_RULER_TOGGLE':
            if (message.enabled) {
              enable({ height: message.settings?.height, opacity: message.settings?.opacity });
            } else {
              disable();
            }
            sendResponse({ ok: true, enabled: message.enabled });
            break;
  
          case 'FOCUS_RULER_UPDATE_SETTINGS':
            applySettings(message.settings || {});
            sendResponse({ ok: true });
            break;
  
          case 'FOCUS_RULER_GET_STATE':
            sendResponse({ ok: true, enabled: isEnabled, y: currentY });
            break;
  
          // Service worker sends this after navigation to re-apply all features
          case 'REAPPLY_STATE': {
            const s = message.state || {};
            if (s.focusRulerEnabled) {
              enable({ height: s.rulerHeight, opacity: s.dimOpacity });
            } else {
              disable();
            }
            sendResponse({ ok: true });
            break;
          }
  
          default:
            break;
        }
        return true;
      });
    }
  
    // ── Inlined Shadow DOM CSS ────────────────────────────────────────────────
    // IMPORTANT: Keep this in sync with styles/ruler-shadow.css.
    // Post-bundler: replace this function with an esbuild text import.
    function getRulerCSS() {
      return /* css */ `
        :host {
          all            : initial;
          display        : block;
          position       : fixed;
          inset          : 0;
          width          : 0;
          height         : 0;
          pointer-events : none;
          z-index        : 2147483647;
        }
  
        .ruler-overlay {
          position       : fixed;
          inset          : 0;
          width          : var(--vw, 100vw);
          height         : var(--vh, 100vh);
          pointer-events : none;
          will-change    : background;
  
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, var(--dim-opacity, 0.75)) 0px,
            rgba(0, 0, 0, var(--dim-opacity, 0.75))
              calc(var(--ruler-y, 50vh) - var(--ruler-height, 40px) / 2),
  
            transparent
              calc(var(--ruler-y, 50vh) - var(--ruler-height, 40px) / 2),
            transparent
              calc(var(--ruler-y, 50vh) + var(--ruler-height, 40px) / 2),
  
            rgba(0, 0, 0, var(--dim-opacity, 0.75))
              calc(var(--ruler-y, 50vh) + var(--ruler-height, 40px) / 2),
            rgba(0, 0, 0, var(--dim-opacity, 0.75)) 100%
          );
        }
  
        .ruler-overlay::before,
        .ruler-overlay::after {
          content        : '';
          position       : absolute;
          left           : 0;
          width          : 100%;
          height         : 1px;
          pointer-events : none;
          background     : rgba(245, 200, 66, 0.5);
          box-shadow     : 0 0 6px 1px rgba(245, 200, 66, 0.2);
        }
  
        .ruler-overlay::before {
          top : calc(var(--ruler-y, 50vh) - var(--ruler-height, 40px) / 2);
        }
  
        .ruler-overlay::after {
          top : calc(var(--ruler-y, 50vh) + var(--ruler-height, 40px) / 2);
        }
  
        @media (prefers-reduced-motion: reduce) {
          .ruler-overlay::before,
          .ruler-overlay::after { box-shadow: none; }
        }
      `;
    }
  
  })();