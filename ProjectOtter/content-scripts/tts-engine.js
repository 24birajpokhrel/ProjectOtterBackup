// Text-to-Voice Implementation


(() => {
    'use strict';
  
    if (window.__alTTSLoaded) return;
    window.__alTTSLoaded = true;
  
    document.addEventListener('mouseup', () => {
      chrome.storage.local.get(['ttsEnabled'], (res) => {
        if (!res.ttsEnabled) return;
  
        const selection = window.getSelection().toString().trim();
        if (selection.length > 0) {
          chrome.runtime.sendMessage({
            type: 'SPEAK_TEXT',
            text: selection
          });
        }
      });
    });
  
    // Stop speaking if the user clicks a blank area to deselect
    document.addEventListener('mousedown', () => {
      chrome.runtime.sendMessage({ type: 'STOP_SPEAKING' });
    });
  })();