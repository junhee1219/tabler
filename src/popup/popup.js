// src/popup/popup.js
document.getElementById('export').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'EXPORT_TABLES' });
  });
});
