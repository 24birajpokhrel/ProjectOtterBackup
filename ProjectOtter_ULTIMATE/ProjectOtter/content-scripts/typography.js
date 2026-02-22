/**
 * Project Otter — content-scripts/typography.js
 * Implementation of Font Overrides and Text Scaling.
 */

;(() => {
  'use strict';

  // Guard to prevent multiple injections
  if (window.__otterTypographyLoaded) return;
  window.__otterTypographyLoaded = true;

  /**
   * Applies or removes global CSS overrides for fonts and text scaling
   */
  function applyTypography(dyslexiaState, textScale) {
    // 1. Handle Font Injection
    const existingFontStyle = document.getElementById('otter-font-override');
    if (existingFontStyle) existingFontStyle.remove();

    if (dyslexiaState && dyslexiaState.enabled && dyslexiaState.font !== 'default') {
      const style = document.createElement('style');
      style.id = 'otter-font-override';
      
      let fontFaceCSS = '';
      if (dyslexiaState.font === 'OpenDyslexic') {
        const fontUrl = chrome.runtime.getURL('assets/icons/fonts/OpenDyslexic3-Regular.ttf');
        fontFaceCSS = `
          @font-face {
            font-family: 'OpenDyslexic';
            src: url('${fontUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `;
      }

      style.textContent = `
        ${fontFaceCSS}
        * {
          font-family: '${dyslexiaState.font}', sans-serif !important;
          line-height: 1.6 !important;
          letter-spacing: 0.03em !important;
          line-heigh: 1.6 !important;
        }
      `;

      if (document.head || document.documentElement) {
        (document.head || document.documentElement).appendChild(style);
      }
    }

    // 2. Handle Text Scaling
    const existingScaleStyle = document.getElementById('otter-scale-override');
    if (existingScaleStyle) existingScaleStyle.remove();

    if (textScale && textScale !== 100) {
      const scaleStyle = document.createElement('style');
      scaleStyle.id = 'otter-scale-override';
      // We apply scaling to the HTML element to preserve layout ratios
      scaleStyle.textContent = `
        html {
          font-size: ${textScale}% !important;
        }
      `;
      if (document.head || document.documentElement) {
        (document.head || document.documentElement).appendChild(style)
      }
    }
  }

  /**
   * Initialize on page load: Fetch current settings from storage
   */
  function init() {
    chrome.storage.local.get([
      'dyslexiaFontEnabled', 
      'dyslexiaFontFamily', 
      'textScale'
    ], (data) => {
      applyTypography(
        { 
          enabled: data.dyslexiaFontEnabled || false, 
          font: data.dyslexiaFontFamily || 'default' 
        },
        data.textScale || 100
      );
    });
  }

  /**
   * Listen for live updates from popup.js
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handling the "Megaphone" broadcast from your popup.js
    if (message.type === 'SET_STATE' && message.state && message.state.dyslexia) {
      // Re-fetch scale to ensure we don't overwrite scale with 100% when changing font
      chrome.storage.local.get(['textScale'], (data) => {
        applyTypography(message.state.dyslexia, data.textScale || 100);
      });
    }

    if (message.type === 'TEXT_SCALE_UPDATE' && message.settings) {
      // Re-fetch font state to ensure we don't remove fonts when scaling
      chrome.storage.local.get(['dyslexiaFontEnabled', 'dyslexiaFontFamily'], (data) => {
        applyTypography(
          { enabled: data.dyslexiaFontEnabled, font: data.dyslexiaFontFamily },
          message.settings.scale
        );
      });
    }
    
    // Always return true for async response if needed
    return true;
  });

  // Run on load
  init();
  console.debug('[Project Otter] Typography engine initialized.');
})();