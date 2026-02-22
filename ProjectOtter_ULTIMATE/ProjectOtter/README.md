# 🦦 ProjectOtter

> **A Chrome extension that makes the web more accessible for students with dyslexia, ADHD, and color vision deficiencies.**

Project Otter injects a suite of non-invasive accessibility tools into any webpage helping students read more comfortably, stay focused, and reduce visual stress all without modifying the page's content.

---

## ✨ Features

### 🧠 ADHD Tools
| Feature | Description |
|---|---|
| **Focus Ruler** | A reading mask that follows your cursor, dimming everything except a configurable horizontal strip — so you stay locked on one line at a time. Uses Shadow DOM for full CSS isolation from the host page. |
| **Text to Speech** | Highlight any text on the page and have it read aloud using the Chrome TTS API. Configurable voice speed. |

### 📖 Dyslexia Tools
| Feature | Description |
|---|---|
| **Specialized Font** | Swaps all page fonts to OpenDyslexic (or Arial, Comic Sans, or Sans-Serif) via injected CSS overrides. Bundles the OpenDyslexic3 TTF font locally. |
| **Color Overlay / Tint** | Overlays a semi-transparent tint (yellow, blue, mint, pink, lavender, peach, or custom) over the page to reduce visual stress. Adjustable opacity. |
| **Text Scaling** | Rescales the page's root font size from 50% to 200% while preserving layout ratios. |

### 🎨 Color Blindness Tools
| Feature | Description |
|---|---|
| **Dark Mode** | Inverts page brightness to reduce eye strain in low-light environments. |
| **CVD Filter** | Applies SVG color matrix filters to simulate Protanopia, Deuteranopia, or Tritanopia — useful for testing accessible designs. |

---

## 🗂️ Project Structure

```
ProjectOtter/
├── background/
│   └── service-worker.js       # MV3 service worker: TTS, keyboard shortcuts, tab navigation guard
├── content-scripts/
│   ├── focus-ruler.js          # Focus Ruler engine (Shadow DOM and CSS custom properties)
│   ├── visual-filters.js       # Color overlay and Dark mode
│   ├── typography.js           # Font override and text scaling via injected <style> tags
│   └── tts-engine.js           # Text selection listener → TTS via chrome.tts API
├── utils/
│   └── storage-helper.js       # Single source of truth for all chrome.storage.local keys
├── popup/
│   ├── popup.html              # Extension popup UI (accordion layout, toggles, sliders)
│   ├── popup.js                # Popup logic: reads/writes storage, messages content scripts
│   └── popup.css               # Popup styles (dark theme, toggle switches, swatches)
├── styles/
│   ├── global.css              # Injected into all pages (currently reserved/empty)
│   └── ruler-shadow.css        # Shadow DOM styles for the Focus Ruler overlay
├── assets/
│   └── icons/
│       ├── logo.png
│       └── fonts/
│           └── OpenDyslexic3-Regular.ttf
└── manifest.json               # MV3 manifest
```

---

## 🏗️ Architecture

Project Otter is a **Manifest V3** Chrome extension with four layers:

1. **Popup UI** (`popup/`) — The user-facing control panel. Writes settings to `chrome.storage.local` and sends messages directly to the active tab's content scripts.

2. **Content Scripts** (`content-scripts/`) — Injected into every page at `document_idle`. Each feature is a self-contained IIFE with a guard flag to prevent double-injection. Features listen for messages from the popup and re-apply state on navigation via the `REAPPLY_STATE` message.

3. **Service Worker** (`background/`) — Handles TTS requests, keyboard shortcuts, and re-broadcasts state to tabs after navigation. Follows MV3 best practices — no live state is stored in the service worker; everything persists in `chrome.storage.local`.

4. **Storage** (`utils/storage-helper.js`) — A single flat key-value schema loaded first by the manifest. All content scripts share `window.STORAGE_KEYS` and `window.StorageHelper` at runtime.

### Focus Ruler — Technical Notes
- Uses a **closed Shadow DOM** for complete CSS isolation from the host page
- A single-element **CSS gradient mask** avoids sub-pixel gaps at non-integer device pixel ratios
- Mouse position is captured in `mousemove` but only written to the DOM once per frame via a **`requestAnimationFrame` loop** — capping DOM writes at display refresh rate regardless of mouse polling speed
- JS → CSS communication uses **CSS custom properties** (`--ruler-y`, `--ruler-height`, `--dim-opacity`) for GPU-composited rendering

---

## 🚀 Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `ProjectOtter/` folder.
5. The 🦦 icon will appear in your toolbar — click it to open the popup.

---

## 🔑 Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist all feature settings across sessions |
| `activeTab` | Send messages to the current tab |
| `scripting` | Inject content scripts programmatically |
| `tabs` | Re-apply features after tab navigation |
| `tts` | Drive the Chrome Text-to-Speech API |
| `<all_urls>` (host) | Inject content scripts on any website |

---

## 🛠️ Tech Stack

- **Chrome Extensions Manifest V3**
- Vanilla JavaScript (no framework)
- CSS with Shadow DOM isolation
- Chrome APIs: `storage`, `tts`, `tabs`, `scripting`, `runtime`, `commands`
- Font: [OpenDyslexic](https://opendyslexic.org/) (bundled locally)
