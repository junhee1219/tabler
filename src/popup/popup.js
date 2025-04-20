// src/popup/popup.js
document.getElementById('start-select').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [
      'src/utils/tableExtractor.js',
      'src/content.js'
    ]
  });
  chrome.tabs.sendMessage(tab.id, { type: 'START_TABLE_SELECTION' });
  window.close();
});
