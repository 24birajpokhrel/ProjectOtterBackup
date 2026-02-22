'use strict';

// ─── Storage key strings (MUST match utils/storage-helper.js) ─────────────────
const KEYS = {
  // Focus Ruler
  RULER_ENABLED   : 'focusRulerEnabled',
  RULER_HEIGHT    : 'rulerHeight',
  DIM_OPACITY     : 'dimOpacity',
  // Color Overlay
  OVERLAY_ENABLED : 'overlayEnabled',
  OVERLAY_COLOR   : 'overlayColor',
  OVERLAY_OPACITY : 'overlayOpacity',
  // Dark Mode
  DARK_MODE       : 'darkModeEnabled',
  // CVD Filter
  CVD_ENABLED     : 'cvdEnabled',
  CVD_MODE        : 'cvdMode',
  // Dyslexia (teammate zone)
  DYSLEXIA_FONT   : 'dyslexiaFontEnabled',
  TEXT_SCALE      : 'textScale',
  BIONIC          : 'bionicReadingEnabled',

  // --- ADDITION: TTS KEYS ---
  TTS_ENABLED     : 'ttsEnabled',
  TTS_SPEED       : 'ttsSpeed',
};

const DEFAULTS = {
  [KEYS.RULER_ENABLED]   : false,
  [KEYS.RULER_HEIGHT]    : 40,
  [KEYS.DIM_OPACITY]     : 0.75,
  [KEYS.OVERLAY_ENABLED] : false,
  [KEYS.OVERLAY_COLOR]   : '#ffff99',
  [KEYS.OVERLAY_OPACITY] : 0.15,
  [KEYS.DARK_MODE]       : false,
  [KEYS.CVD_ENABLED]     : false,
  [KEYS.CVD_MODE]        : 'none',
  [KEYS.DYSLEXIA_FONT]   : false,
  [KEYS.TEXT_SCALE]      : 100,
  [KEYS.BIONIC]          : false,
  // --- ADDITION: TTS DEFAULTS ---
  [KEYS.TTS_ENABLED]     : false,
  [KEYS.TTS_SPEED]       : 1.0,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

// Accordion sections
const accordionItems = document.querySelectorAll('.accordion-item');

// Focus Ruler
const rulerToggle   = document.getElementById('rulerToggle');
const heightRange   = document.getElementById('heightRange');
const heightOutput  = document.getElementById('heightOutput');
const opacityRange  = document.getElementById('opacityRange');
const opacityOutput = document.getElementById('opacityOutput');
const bodyRuler     = document.getElementById('body-ruler');
const cardRuler     = document.getElementById('card-ruler');

// Color Overlay
const overlayToggle      = document.getElementById('overlayToggle');
const swatches           = document.querySelectorAll('#swatchGrid .swatch:not(.swatch--custom)');
const customColor        = document.getElementById('customColor');
const overlayOpRange     = document.getElementById('overlayOpacityRange');
const overlayOpOutput    = document.getElementById('overlayOpacityOutput');
const bodyOverlay        = document.getElementById('body-overlay');
const cardOverlay        = document.getElementById('card-overlay');

// Dark Mode
const darkToggle  = document.getElementById('darkToggle');
const bodyDark    = document.getElementById('body-dark');
const cardDark    = document.getElementById('card-dark');

// CVD Filter
const cvdToggle   = document.getElementById('cvdToggle');
const chips       = document.querySelectorAll('.chip[data-mode]');
const bodyCvd     = document.getElementById('body-cvd');
const cardCvd     = document.getElementById('card-cvd');

// Dyslexia teammate zone
const dyslexiaFontToggle = document.getElementById('dyslexiaFontToggle');
const fontSelect = document.getElementById('fontSelect');
const textScaleRange     = document.getElementById('textScaleRange');
const textScaleOutput    = document.getElementById('textScaleOutput');
const bodyDyslexia       = document.getElementById('body-dyslexia');
const cardDyslexiaFont   = document.getElementById('card-dyslexia-font');

// --- ADDITION: TTS DOM REFS ---
const ttsToggle      = document.getElementById('ttsToggle');
const ttsSpeedRange  = document.getElementById('ttsSpeedRange');
const ttsSpeedOutput = document.getElementById('ttsSpeedOutput');
const bodyTts        = document.getElementById('body-tts');
const cardTts        = document.getElementById('card-tts');

// Footer
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const footerPage = document.getElementById('footerPage');
const previewBar = document.getElementById('previewBar');
const activeBadge= document.getElementById('activeBadge');
const resetBtn   = document.getElementById('resetBtn');

// ─── Accordion click handlers ─────────────────────────────────────────────────
accordionItems.forEach(item => {
  const header = item.querySelector('.accordion-header');
  const content = item.querySelector('.accordion-content');
  header.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    accordionItems.forEach(i => {
      i.classList.remove('open');
      i.querySelector('.accordion-content')?.classList.add('hidden');
    });
    if (!isOpen) {
      item.classList.add('open');
      content?.classList.remove('hidden');
    }
  });
});

// ─── Popup initialisation ─────────────────────────────────────────────────────
(async () => {

  try {
    const stored = await chrome.storage.local.get(Object.values(KEYS));
    const s = { ...DEFAULTS, ...stored };

    // Focus Ruler
    if(rulerToggle) rulerToggle.checked = s[KEYS.RULER_ENABLED];
    if(heightRange) heightRange.value = s[KEYS.RULER_HEIGHT];
    if(opacityRange) opacityRange.value = Math.round(s[KEYS.DIM_OPACITY] * 100);
    if(heightOutput) heightOutput.textContent = `${s[KEYS.RULER_HEIGHT]} px`;
    if(opacityOutput) opacityOutput.textContent = `${Math.round(s[KEYS.DIM_OPACITY] * 100)}%`;
    expandBody(bodyRuler, s[KEYS.RULER_ENABLED]);
    cardRuler?.classList.toggle('active', s[KEYS.RULER_ENABLED]);

    // Color Overlay
    if(overlayToggle) overlayToggle.checked = s[KEYS.OVERLAY_ENABLED];
    if(overlayOpRange) overlayOpRange.value = Math.round(s[KEYS.OVERLAY_OPACITY] * 100);
    if(overlayOpOutput) overlayOpOutput.textContent = `${Math.round(s[KEYS.OVERLAY_OPACITY] * 100)}%`;
    if(customColor) customColor.value = s[KEYS.OVERLAY_COLOR];
    setActiveSwatch(s[KEYS.OVERLAY_COLOR]);
    expandBody(bodyOverlay, s[KEYS.OVERLAY_ENABLED]);
    cardOverlay?.classList.toggle('active', s[KEYS.OVERLAY_ENABLED]);

    // Dark Mode
    if(darkToggle) darkToggle.checked = s[KEYS.DARK_MODE];
    expandBody(bodyDark, s[KEYS.DARK_MODE]);
    cardDark?.classList.toggle('active', s[KEYS.DARK_MODE]);

    // CVD Filter
    if(cvdToggle) cvdToggle.checked = s[KEYS.CVD_ENABLED];
    setActiveChip(s[KEYS.CVD_MODE]);
    expandBody(bodyCvd, s[KEYS.CVD_ENABLED]);
    cardCvd?.classList.toggle('active', s[KEYS.CVD_ENABLED]);

    // Dyslexia teammate zone
    if (dyslexiaFontToggle) dyslexiaFontToggle.checked = s[KEYS.DYSLEXIA_FONT];
    if (textScaleRange)     textScaleRange.value        = s[KEYS.TEXT_SCALE];
    if (textScaleOutput)    textScaleOutput.textContent  = `${s[KEYS.TEXT_SCALE]}%`;
    expandBody(bodyDyslexia, s[KEYS.DYSLEXIA_FONT]);
    cardDyslexiaFont?.classList.toggle('active', s[KEYS.DYSLEXIA_FONT]);

    // --- ADDITION: TTS Initialization ---
    if (ttsToggle) ttsToggle.checked = s[KEYS.TTS_ENABLED];
    if (ttsSpeedRange) ttsSpeedRange.value = s[KEYS.TTS_SPEED] || 1.0;
    if (ttsSpeedOutput) ttsSpeedOutput.textContent = `${ttsSpeedRange.value}x`;
    expandBody(bodyTts, s[KEYS.TTS_ENABLED]);
    cardTts?.classList.toggle('active', s[KEYS.TTS_ENABLED]);

    updateFooter(s);
    autoOpenActiveSection(s);

  } catch (err) {
    console.warn('[ProjectOtter Popup] Storage read failed:', err);
  }

  // Show hostname
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      footerPage.textContent = url.hostname;
    }
  } catch (_) {}

})();

// ─── Focus Ruler Listeners ────────────────────────────────────────────────────
rulerToggle?.addEventListener('change', async () => {
  const enabled = rulerToggle.checked;
  await chrome.storage.local.set({ [KEYS.RULER_ENABLED]: enabled });
  expandBody(bodyRuler, enabled);
  cardRuler?.classList.toggle('active', enabled);
  refreshFooter();
  sendToTab({ type: 'FOCUS_RULER_TOGGLE', enabled, settings: { height: getHeight(), opacity: getDimOpacity() } });
});

heightRange?.addEventListener('input', () => {
  const h = getHeight();
  heightOutput.textContent = `${h} px`;
  chrome.storage.local.set({ [KEYS.RULER_HEIGHT]: h });
  sendToTab({ type: 'FOCUS_RULER_UPDATE_SETTINGS', settings: { height: h } });
});

opacityRange?.addEventListener('input', () => {
  const pct = parseInt(opacityRange.value, 10);
  const op  = pct / 100;
  opacityOutput.textContent = `${pct}%`;
  chrome.storage.local.set({ [KEYS.DIM_OPACITY]: op });
  sendToTab({ type: 'FOCUS_RULER_UPDATE_SETTINGS', settings: { opacity: op } });
});

// ─── Color Overlay Listeners ──────────────────────────────────────────────────
overlayToggle?.addEventListener('change', async () => {
  const enabled = overlayToggle.checked;
  await chrome.storage.local.set({ [KEYS.OVERLAY_ENABLED]: enabled });
  expandBody(bodyOverlay, enabled);
  cardOverlay?.classList.toggle('active', enabled);
  refreshFooter();
  sendToTab({ type: 'COLOR_OVERLAY_TOGGLE', enabled, settings: { color: getColor(), opacity: getOverlayOpacity() } });
});

swatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    setActiveSwatch(color);
    customColor.value = color;
    chrome.storage.local.set({ [KEYS.OVERLAY_COLOR]: color });
    if (overlayToggle.checked) sendToTab({ type: 'COLOR_OVERLAY_UPDATE', settings: { color } });
  });
});

customColor?.addEventListener('input', () => {
  const color = customColor.value;
  setActiveSwatch(null);
  chrome.storage.local.set({ [KEYS.OVERLAY_COLOR]: color });
  if (overlayToggle.checked) sendToTab({ type: 'COLOR_OVERLAY_UPDATE', settings: { color } });
});

overlayOpRange?.addEventListener('input', () => {
  const pct = parseInt(overlayOpRange.value, 10);
  const op  = pct / 100;
  overlayOpOutput.textContent = `${pct}%`;
  chrome.storage.local.set({ [KEYS.OVERLAY_OPACITY]: op });
  if (overlayToggle.checked) sendToTab({ type: 'COLOR_OVERLAY_UPDATE', settings: { opacity: op } });
});

// ─── Dark Mode Listeners ──────────────────────────────────────────────────────
darkToggle?.addEventListener('change', async () => {
  const enabled = darkToggle.checked;
  await chrome.storage.local.set({ [KEYS.DARK_MODE]: enabled });
  expandBody(bodyDark, enabled);
  cardDark?.classList.toggle('active', enabled);
  refreshFooter();
  sendToTab({ type: 'DARK_MODE_TOGGLE', enabled });
});

// ─── CVD Filter Listeners ─────────────────────────────────────────────────────
cvdToggle?.addEventListener('change', async () => {
  const enabled = cvdToggle.checked;
  const stored  = await chrome.storage.local.get([KEYS.CVD_MODE]);
  let mode      = stored[KEYS.CVD_MODE] ?? 'none';
  if (enabled && mode === 'none') {
    mode = 'protanopia';
    chrome.storage.local.set({ [KEYS.CVD_MODE]: mode });
    setActiveChip(mode);
  }
  chrome.storage.local.set({ [KEYS.CVD_ENABLED]: enabled });
  expandBody(bodyCvd, enabled);
  cardCvd?.classList.toggle('active', enabled);
  refreshFooter();
  sendToTab({ type: 'CVD_FILTER_TOGGLE', enabled, settings: { mode } });
});

chips.forEach(chip => {
  chip.addEventListener('click', async () => {
    const mode       = chip.dataset.mode;
    const stored     = await chrome.storage.local.get([KEYS.CVD_MODE]);
    const currentMode= stored[KEYS.CVD_MODE];
    if (currentMode === mode) {
      setActiveChip('none');
      chrome.storage.local.set({ [KEYS.CVD_MODE]: 'none', [KEYS.CVD_ENABLED]: false });
      cvdToggle.checked = false;
      cardCvd?.classList.remove('active');
      refreshFooter();
      sendToTab({ type: 'CVD_FILTER_TOGGLE', enabled: false });
    } else {
      setActiveChip(mode);
      chrome.storage.local.set({ [KEYS.CVD_MODE]: mode, [KEYS.CVD_ENABLED]: true });
      cvdToggle.checked = true;
      cardCvd?.classList.add('active');
      refreshFooter();
      sendToTab({ type: 'CVD_FILTER_UPDATE', settings: { mode } });
    }
  });
});

// ─── Dyslexia Listeners ───────────────────────────────────────────────────────
dyslexiaFontToggle?.addEventListener('change', async () => {
  const enabled = dyslexiaFontToggle.checked;
  await chrome.storage.local.set({ [KEYS.DYSLEXIA_FONT]: enabled });
  expandBody(bodyDyslexia, enabled);
  cardDyslexiaFont?.classList.toggle('active', enabled);
  refreshFooter();
});

textScaleRange?.addEventListener('input', () => {
  const scale = parseInt(textScaleRange.value, 10);
  if (textScaleOutput) textScaleOutput.textContent = `${scale}%`;
  chrome.storage.local.set({ [KEYS.TEXT_SCALE]: scale });
});

// --- ADDITION: TTS Listeners ---
ttsToggle?.addEventListener('change', async () => {
  const enabled = ttsToggle.checked;
  await chrome.storage.local.set({ [KEYS.TTS_ENABLED]: enabled });
  expandBody(bodyTts, enabled);
  cardTts?.classList.toggle('active', enabled);
  refreshFooter();
});

ttsSpeedRange?.addEventListener('input', () => {
  const val = parseFloat(ttsSpeedRange.value);
  if (ttsSpeedOutput) ttsSpeedOutput.textContent = `${val.toFixed(1)}x`;
  chrome.storage.local.set({ [KEYS.TTS_SPEED]: val });
});

// ─── Reset All ────────────────────────────────────────────────────────────────
resetBtn?.addEventListener('click', async () => {
  await chrome.storage.local.set(DEFAULTS);

  sendToTab({ type: 'FOCUS_RULER_TOGGLE',   enabled: false });
  sendToTab({ type: 'COLOR_OVERLAY_TOGGLE', enabled: false });
  sendToTab({ type: 'DARK_MODE_TOGGLE',     enabled: false });
  sendToTab({ type: 'CVD_FILTER_TOGGLE',    enabled: false });

  // Reset UI elements
  if(rulerToggle) rulerToggle.checked = false;
  if(heightRange) heightRange.value = 40;
  if(heightOutput) heightOutput.textContent = '40 px';
  if(opacityRange) opacityRange.value = 75;
  if(opacityOutput) opacityOutput.textContent = '75%';

  if(overlayToggle) overlayToggle.checked = false;
  if(overlayOpRange) overlayOpRange.value = 15;
  if(overlayOpOutput) overlayOpOutput.textContent = '15%';
  if(customColor) customColor.value = '#ffff99';
  setActiveSwatch('#ffff99');

  if(darkToggle) darkToggle.checked = false;
  if(cvdToggle) cvdToggle.checked = false;
  setActiveChip('none');

  if (dyslexiaFontToggle) dyslexiaFontToggle.checked = false;
  if (textScaleRange) textScaleRange.value = 100;
  if (textScaleOutput) textScaleOutput.textContent = '100%';

  // Reset TTS UI
  if (ttsToggle) ttsToggle.checked = false;
  if (ttsSpeedRange) ttsSpeedRange.value = 1.0;
  if (ttsSpeedOutput) ttsSpeedOutput.textContent = '1.0x';

  [bodyRuler, bodyOverlay, bodyDark, bodyCvd, bodyDyslexia, bodyTts].forEach(b => expandBody(b, false));
  [cardRuler, cardOverlay, cardDark, cardCvd, cardDyslexiaFont, cardTts].forEach(c => c?.classList.remove('active'));
  
  refreshFooter();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHeight()        { return parseInt(heightRange.value, 10); }
function getDimOpacity()    { return parseInt(opacityRange.value, 10) / 100; }
function getColor()         { return customColor.value; }
function getOverlayOpacity(){ return parseInt(overlayOpRange.value, 10) / 100; }

function expandBody(el, open) {
  el?.classList.toggle('hidden', !open);
}

function setActiveSwatch(color) {
  swatches.forEach(s => {
    const match = color !== null && s.dataset.color === color;
    s.classList.toggle('selected', match);
    s.setAttribute('aria-checked', String(match));
  });
}

function setActiveChip(mode) {
  chips.forEach(c => {
    const match = c.dataset.mode === mode;
    c.classList.toggle('selected', match);
    c.setAttribute('aria-checked', String(match));
  });
}

async function refreshFooter() {
  const stored = await chrome.storage.local.get(Object.values(KEYS));
  updateFooter({ ...DEFAULTS, ...stored });
}

function updateFooter(s) {
  const active = [
    s[KEYS.RULER_ENABLED],
    s[KEYS.OVERLAY_ENABLED],
    s[KEYS.DARK_MODE],
    s[KEYS.CVD_ENABLED],
    s[KEYS.DYSLEXIA_FONT],
    s[KEYS.TTS_ENABLED] // Added to active count
  ].filter(Boolean).length;

  const hasActive = active > 0;
  statusDot?.classList.toggle('active', hasActive);
  previewBar?.classList.toggle('visible', hasActive);
  if (activeBadge) activeBadge.classList.toggle('hidden', !hasActive);

  if (statusText) {
    statusText.textContent = hasActive
      ? `${active} feature${active > 1 ? 's' : ''} active`
      : 'No features active';
  }

  // Cards & Sections
  const adhdActive = !!s[KEYS.RULER_ENABLED] || !!s[KEYS.TTS_ENABLED];
  const dyslexiaActive = !!s[KEYS.OVERLAY_ENABLED] || !!s[KEYS.DYSLEXIA_FONT];
  const cbActive = !!s[KEYS.DARK_MODE] || !!s[KEYS.CVD_ENABLED];
  
  document.getElementById('section-adhd')?.classList.toggle('has-active', adhdActive);
  document.getElementById('section-dyslexia')?.classList.toggle('has-active', dyslexiaActive);
  document.getElementById('section-colorblind')?.classList.toggle('has-active', cbActive);
}

function autoOpenActiveSection(s) {
  const adhdActive     = !!s[KEYS.RULER_ENABLED] || !!s[KEYS.TTS_ENABLED];
  const dyslexiaActive = !!s[KEYS.OVERLAY_ENABLED] || !!s[KEYS.DYSLEXIA_FONT];
  const cbActive       = !!s[KEYS.DARK_MODE] || !!s[KEYS.CVD_ENABLED];

  const sectionMap = [
    { id: 'section-adhd',       active: adhdActive },
    { id: 'section-dyslexia',   active: dyslexiaActive },
    { id: 'section-colorblind', active: cbActive },
  ];

  for (const { id, active } of sectionMap) {
    if (active) {
      const el = document.getElementById(id);
      el?.classList.add('open');
      el?.querySelector('.accordion-content')?.classList.remove('hidden');
      break;
    }
  }
}

async function sendToTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (_) {}
}