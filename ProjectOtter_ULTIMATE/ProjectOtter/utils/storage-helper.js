/**
 * Project Otter — utils/storage-helper.js
 *
 * SINGLE SOURCE OF TRUTH for all chrome.storage.local keys.
 * Loaded FIRST in manifest.json content_scripts so every subsequent
 * content script can access window.STORAGE_KEYS and window.StorageHelper.
 *
 * KEY NAMING — two rules:
 *   1. Keys that teammates have already started coding against (dyslexia,
 *      typography) use the MAIN branch names to avoid breaking their work.
 *   2. All other keys use the AccessiLens naming convention.
 *
 * Storage type: chrome.storage.LOCAL (not sync).
 * Schema style: FLAT keys (not a nested blob).
 */

const STORAGE_KEYS = {

    // ── Focus Ruler ────────────────────────────────────────────────────────
    RULER_ENABLED : 'focusRulerEnabled',    // boolean — default: false
    RULER_HEIGHT  : 'rulerHeight',          // number  — default: 40 (px)
    DIM_OPACITY   : 'dimOpacity',           // number  — default: 0.75 (float 0–1)
  
    // ── Color Overlay ──────────────────────────────────────────────────────
    OVERLAY_ENABLED : 'overlayEnabled',     // boolean — default: false
    OVERLAY_COLOR   : 'overlayColor',       // string  — default: '#ffff99' (hex)
    OVERLAY_OPACITY : 'overlayOpacity',     // number  — default: 0.15 (float 0–1)
  
    // ── Dark Mode ──────────────────────────────────────────────────────────
    DARK_MODE_ENABLED : 'darkModeEnabled',  // boolean — default: false
  
    // ── Colorblindness / CVD Filter ────────────────────────────────────────
    CVD_ENABLED : 'cvdEnabled',             // boolean — default: false
    CVD_MODE    : 'cvdMode',               // string  — default: 'none'
                                            //   'none'|'protanopia'|'deuteranopia'|'tritanopia'
  
    // ── Dyslexia (teammate zone — key name from main branch) ───────────────
    DYSLEXIA_FONT   : 'dyslexiaFontEnabled', // boolean — default: false
    TEXT_SCALE      : 'textScale',           // number  — default: 100 (percent, 50–200)
  
    // ── Bionic Reading (teammate zone — key name from main branch) ──────────
    BIONIC_ENABLED  : 'bionicReadingEnabled', // boolean — default: false
                                              // NOTE: main used 'bionicReadingEnabled'
                                              // so we match it here for teammate compatibility
  
    // ── Typography Engine master toggle ────────────────────────────────────
    TYPO_ENABLED    : 'typographyEngineEnabled', // boolean — default: false
  
  };
  
  // ─── StorageHelper ────────────────────────────────────────────────────────────
  // All reads/writes go through these methods.
  // set() does NOT auto-broadcast via runtime.sendMessage (unlike main branch).
  // Popup sends messages directly to the active tab — no background relay needed.
  
  const StorageHelper = {
  
    get(keys) {
      return chrome.storage.local.get(keys);
    },
  
    set(items) {
      return chrome.storage.local.set(items);
    },
  
    getAll() {
      return chrome.storage.local.get(Object.values(STORAGE_KEYS));
    },
  
    getRulerSettings() {
      return chrome.storage.local.get([
        STORAGE_KEYS.RULER_ENABLED,
        STORAGE_KEYS.RULER_HEIGHT,
        STORAGE_KEYS.DIM_OPACITY,
      ]);
    },
  
    getOverlaySettings() {
      return chrome.storage.local.get([
        STORAGE_KEYS.OVERLAY_ENABLED,
        STORAGE_KEYS.OVERLAY_COLOR,
        STORAGE_KEYS.OVERLAY_OPACITY,
      ]);
    },
  
    getFilterSettings() {
      return chrome.storage.local.get([
        STORAGE_KEYS.DARK_MODE_ENABLED,
        STORAGE_KEYS.CVD_ENABLED,
        STORAGE_KEYS.CVD_MODE,
      ]);
    },
  
    getDyslexiaSettings() {
      return chrome.storage.local.get([
        STORAGE_KEYS.DYSLEXIA_FONT,
        STORAGE_KEYS.TEXT_SCALE,
        STORAGE_KEYS.BIONIC_ENABLED,
        STORAGE_KEYS.TYPO_ENABLED,
      ]);
    },
  };
  
  // ── Expose globally for content scripts (pre-bundler) ─────────────────────────
  if (typeof window !== 'undefined') {
    window.STORAGE_KEYS  = STORAGE_KEYS;
    window.StorageHelper = StorageHelper;
  }
  
  // ── Support module imports for post-bundler usage ─────────────────────────────
  if (typeof module !== 'undefined') {
    module.exports = { STORAGE_KEYS, StorageHelper };
  }