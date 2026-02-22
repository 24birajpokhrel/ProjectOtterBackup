/**
 * AccessiLens — content-scripts/visual-filters.js
 *
 * Visual filter engine. Injected into every webpage via manifest.json.
 * Handles three features:
 *   1. Color Overlay  — fixed semi-transparent tint div (reduces visual stress)
 *   2. Dark Mode      — CSS class + style injection on <html>
 *   3. CVD Filter     — SVG feColorMatrix filter for colorblindness simulation
 *
 * Architecture mirrors focus-ruler.js exactly:
 *   - IIFE with guard flag (prevents double-injection)
 *   - Reads window.STORAGE_KEYS set by storage-helper.js (loaded first)
 *   - init() reads storage on page load, enables active features
 *   - registerMessageListener() always runs regardless of enabled state
 *   - Each feature is fully independent: enable/disable/update functions
 *
 * Depends on: utils/storage-helper.js (loaded before this in manifest.json)
 *
 * Message types handled:
 *   COLOR_OVERLAY_TOGGLE   { enabled, settings?: { color, opacity } }
 *   COLOR_OVERLAY_UPDATE   { settings: { color?, opacity? } }
 *   DARK_MODE_TOGGLE       { enabled }
 *   CVD_FILTER_TOGGLE      { enabled, settings?: { mode } }
 *   CVD_FILTER_UPDATE      { settings: { mode } }
 *   REAPPLY_STATE          { state: <full storage object> }  — sent by service worker on navigation
 *
 * Engine code adapted from CB folder content.js. Key changes:
 *   - Flat key storage (not nested blob)
 *   - chrome.storage.local (not sync)
 *   - AccessiLens-namespaced element IDs
 *   - Split into discrete enable/disable/update functions per feature
 *   - REAPPLY_STATE handler added for post-navigation re-application
 */

;(() => {
    'use strict';
  
    // ── Guard: prevent double-injection ────────────────────────────────────────
    if (window.__alFiltersLoaded) return;
    window.__alFiltersLoaded = true;
  
    // ── Local reference to globals from storage-helper.js ──────────────────────
    const KEYS = window.STORAGE_KEYS || {
      OVERLAY_ENABLED   : 'overlayEnabled',
      OVERLAY_COLOR     : 'overlayColor',
      OVERLAY_OPACITY   : 'overlayOpacity',
      DARK_MODE_ENABLED : 'darkModeEnabled',
      CVD_ENABLED       : 'cvdEnabled',
      CVD_MODE          : 'cvdMode',
    };
  
    // ── Element IDs (namespaced to avoid colliding with host page) ─────────────
    const IDS = {
      OVERLAY     : 'accessilens-overlay',
      SVG_FILTER  : 'accessilens-svg-filters',
      DARK_STYLE  : 'accessilens-dark-mode-style',
      HTML_DARK   : 'accessilens-dark',   // Class added to <html>
    };
  
    // ── Defaults ────────────────────────────────────────────────────────────────
    const DEFAULT_COLOR   = '#ffff99';
    const DEFAULT_OPACITY = 0.15;
    const DEFAULT_MODE    = 'none';
  
    // ── SVG Color Matrix Filters ────────────────────────────────────────────────
    // Clinically-derived feColorMatrix values for CVD simulation.
    // Applied to document.documentElement so images AND text are filtered —
    // unlike CSS-only solutions that only affect background/text colors.
    const CVD_MATRICES = {
      protanopia: `
        <filter id="al-protanopia">
          <feColorMatrix type="matrix" values="
            0.567, 0.433, 0,     0, 0
            0.558, 0.442, 0,     0, 0
            0,     0.242, 0.758, 0, 0
            0,     0,     0,     1, 0"/>
        </filter>`,
      deuteranopia: `
        <filter id="al-deuteranopia">
          <feColorMatrix type="matrix" values="
            0.625, 0.375, 0,   0, 0
            0.7,   0.3,   0,   0, 0
            0,     0.3,   0.7, 0, 0
            0,     0,     0,   1, 0"/>
        </filter>`,
      tritanopia: `
        <filter id="al-tritanopia">
          <feColorMatrix type="matrix" values="
            0.95, 0.05,  0,     0, 0
            0,    0.433, 0.567, 0, 0
            0,    0.475, 0.525, 0, 0
            0,    0,     0,     1, 0"/>
        </filter>`,
    };
  
    // ── Dark Mode CSS ────────────────────────────────────────────────────────────
    // Injected as a <style> tag when dark mode is enabled.
    // Targets the most common element types so host page styles are overridden.
    // Uses the .accessilens-dark class on <html> as a scope — doesn't affect
    // any page that hasn't opted in.
    const DARK_MODE_CSS = `
      html.accessilens-dark,
      html.accessilens-dark body {
        background-color : #121212 !important;
        color            : #e8e8e8 !important;
      }
      html.accessilens-dark * {
        background-color : inherit;
        border-color     : #333 !important;
      }
      html.accessilens-dark a {
        color : #7ab8f5 !important;
      }
      html.accessilens-dark img,
      html.accessilens-dark video {
        filter : brightness(0.85) !important;
      }
      html.accessilens-dark input,
      html.accessilens-dark textarea,
      html.accessilens-dark select {
        background-color : #1e1e1e !important;
        color            : #e8e8e8 !important;
        border           : 1px solid #444 !important;
      }
      html.accessilens-dark button {
        background-color : #2a2a2a !important;
        color            : #e8e8e8 !important;
        border           : 1px solid #555 !important;
      }
      html.accessilens-dark h1, html.accessilens-dark h2,
      html.accessilens-dark h3, html.accessilens-dark h4,
      html.accessilens-dark h5, html.accessilens-dark h6 {
        color : #f0f0f0 !important;
      }
      html.accessilens-dark p,  html.accessilens-dark span,
      html.accessilens-dark li, html.accessilens-dark td,
      html.accessilens-dark th, html.accessilens-dark label {
        color : #d8d8d8 !important;
      }
    `;
  
    // ── Utility ──────────────────────────────────────────────────────────────────
    function hexToRgba(hex, opacity) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  
    // ────────────────────────────────────────────────────────────────────────────
    // FEATURE 1: COLOR OVERLAY
    // ────────────────────────────────────────────────────────────────────────────
  
    function overlayEnable({ color = DEFAULT_COLOR, opacity = DEFAULT_OPACITY } = {}) {
      let el = document.getElementById(IDS.OVERLAY);
  
      if (!el) {
        el = document.createElement('div');
        el.id = IDS.OVERLAY;
        // z-index 2147483645: below Focus Ruler (2147483647) and its shadow host
        Object.assign(el.style, {
          position       : 'fixed',
          top            : '0',
          left           : '0',
          width          : '100vw',
          height         : '100vh',
          pointerEvents  : 'none',
          zIndex         : '2147483645',
          mixBlendMode   : 'multiply',
          transition     : 'background-color 0.3s ease',
        });
        document.body.appendChild(el);
      }
  
      el.style.backgroundColor = hexToRgba(color, opacity);
      console.debug('[AccessiLens] Color Overlay enabled.');
    }
  
    function overlayDisable() {
      document.getElementById(IDS.OVERLAY)?.remove();
      console.debug('[AccessiLens] Color Overlay disabled.');
    }
  
    function overlayUpdate({ color, opacity } = {}) {
      const el = document.getElementById(IDS.OVERLAY);
      if (!el) return; // Not enabled — ignore update
  
      // Re-read current values from element if only one param is provided
      if (color !== undefined && opacity !== undefined) {
        el.style.backgroundColor = hexToRgba(color, opacity);
      } else if (color !== undefined) {
        // Extract current opacity from existing rgba string
        const currentRgba = el.style.backgroundColor;
        const opacityMatch = currentRgba.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
        const currentOpacity = opacityMatch ? parseFloat(opacityMatch[1]) : DEFAULT_OPACITY;
        el.style.backgroundColor = hexToRgba(color, currentOpacity);
      } else if (opacity !== undefined) {
        // Extract current color components from existing rgba string
        const currentRgba = el.style.backgroundColor;
        const match = currentRgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          el.style.backgroundColor = `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
        }
      }
    }
  
    // ────────────────────────────────────────────────────────────────────────────
    // FEATURE 2: DARK MODE
    // ────────────────────────────────────────────────────────────────────────────
  
    function darkModeEnable() {
      // Inject <style> if not already present
      if (!document.getElementById(IDS.DARK_STYLE)) {
        const styleEl = document.createElement('style');
        styleEl.id          = IDS.DARK_STYLE;
        styleEl.textContent = DARK_MODE_CSS;
        document.head.appendChild(styleEl);
      }
      document.documentElement.classList.add(IDS.HTML_DARK);
      console.debug('[AccessiLens] Dark Mode enabled.');
    }
  
    function darkModeDisable() {
      document.getElementById(IDS.DARK_STYLE)?.remove();
      document.documentElement.classList.remove(IDS.HTML_DARK);
      console.debug('[AccessiLens] Dark Mode disabled.');
    }
  
    // ────────────────────────────────────────────────────────────────────────────
    // FEATURE 3: CVD FILTER (Colorblindness)
    // ────────────────────────────────────────────────────────────────────────────
  
    function cvdEnable({ mode = DEFAULT_MODE } = {}) {
      if (mode === 'none') {
        cvdDisable();
        return;
      }
  
      ensureSvgFilters();
  
      // Apply CSS filter to root element — affects ENTIRE page including images
      document.documentElement.style.setProperty(
        'filter',
        `url(#al-${mode})`,
        'important'
      );
      console.debug(`[AccessiLens] CVD Filter enabled: ${mode}`);
    }
  
    function cvdDisable() {
      document.documentElement.style.removeProperty('filter');
      document.getElementById(IDS.SVG_FILTER)?.remove();
      console.debug('[AccessiLens] CVD Filter disabled.');
    }
  
    function cvdUpdate({ mode } = {}) {
      if (!mode || mode === 'none') {
        cvdDisable();
        return;
      }
      // SVG already has all three filters defined — just swap the CSS reference
      ensureSvgFilters();
      document.documentElement.style.setProperty(
        'filter',
        `url(#al-${mode})`,
        'important'
      );
    }
  
    // Injects the SVG element containing ALL filter definitions into the page.
    // All three matrices are included in one SVG so switching modes only requires
    // changing the CSS filter value — no DOM re-injection needed.
    function ensureSvgFilters() {
      if (document.getElementById(IDS.SVG_FILTER)) return; // Already present
  
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg   = document.createElementNS(svgNS, 'svg');
      svg.id = IDS.SVG_FILTER;
      svg.setAttribute('xmlns', svgNS);
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
      svg.innerHTML = `<defs>
        ${CVD_MATRICES.protanopia}
        ${CVD_MATRICES.deuteranopia}
        ${CVD_MATRICES.tritanopia}
      </defs>`;
  
      document.body.insertBefore(svg, document.body.firstChild);
    }
  
    // ────────────────────────────────────────────────────────────────────────────
    // INIT + MESSAGE LISTENER
    // ────────────────────────────────────────────────────────────────────────────
  
    async function init() {
      try {
        const stored = await chrome.storage.local.get([
          KEYS.OVERLAY_ENABLED,
          KEYS.OVERLAY_COLOR,
          KEYS.OVERLAY_OPACITY,
          KEYS.DARK_MODE_ENABLED,
          KEYS.CVD_ENABLED,
          KEYS.CVD_MODE,
        ]);
  
        if (stored[KEYS.OVERLAY_ENABLED]) {
          overlayEnable({
            color   : stored[KEYS.OVERLAY_COLOR]   ?? DEFAULT_COLOR,
            opacity : stored[KEYS.OVERLAY_OPACITY]  ?? DEFAULT_OPACITY,
          });
        }
  
        if (stored[KEYS.DARK_MODE_ENABLED]) {
          darkModeEnable();
        }
  
        if (stored[KEYS.CVD_ENABLED]) {
          cvdEnable({
            mode : stored[KEYS.CVD_MODE] ?? DEFAULT_MODE,
          });
        }
  
      } catch (err) {
        // Fails silently on restricted pages — expected behavior
        console.debug('[AccessiLens] visual-filters init storage read failed:', err.message);
      }
  
      // Message listener ALWAYS registers, even if all features start disabled.
      // This is required so popup can turn features ON from a disabled state.
      registerMessageListener();
    }
  
    function registerMessageListener() {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  
        switch (message.type) {
  
          // ── Color Overlay ──────────────────────────────────────────────────
          case 'COLOR_OVERLAY_TOGGLE':
            if (message.enabled) {
              overlayEnable(message.settings || {});
            } else {
              overlayDisable();
            }
            sendResponse({ ok: true });
            break;
  
          case 'COLOR_OVERLAY_UPDATE':
            overlayUpdate(message.settings || {});
            sendResponse({ ok: true });
            break;
  
          // ── Dark Mode ──────────────────────────────────────────────────────
          case 'DARK_MODE_TOGGLE':
            if (message.enabled) {
              darkModeEnable();
            } else {
              darkModeDisable();
            }
            sendResponse({ ok: true });
            break;
  
          // ── CVD Filter ─────────────────────────────────────────────────────
          case 'CVD_FILTER_TOGGLE':
            if (message.enabled) {
              cvdEnable(message.settings || {});
            } else {
              cvdDisable();
            }
            sendResponse({ ok: true });
            break;
  
          case 'CVD_FILTER_UPDATE':
            cvdUpdate(message.settings || {});
            sendResponse({ ok: true });
            break;
  
          // ── Navigation re-apply (sent by service worker on tabs.onUpdated) ─
          case 'REAPPLY_STATE': {
            const s = message.state || {};
            if (s.overlayEnabled)   overlayEnable({ color: s.overlayColor, opacity: s.overlayOpacity });
            else                    overlayDisable();
            if (s.darkModeEnabled)  darkModeEnable();
            else                    darkModeDisable();
            if (s.cvdEnabled)       cvdEnable({ mode: s.cvdMode });
            else                    cvdDisable();
            sendResponse({ ok: true });
            break;
          }
  
          default:
            // Ignore messages for other features (focus-ruler, typography, etc.)
            break;
        }
  
        return true; // Keep channel open for async sendResponse
      });
    }
  
    init();
  
  })();