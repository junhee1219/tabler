import { extractTables } from '../utils/tableExtractor';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXPORT_TABLES') {
    const tables = extractTables();
    chrome.runtime.sendMessage({ type: 'TABLES_DATA', payload: tables });
  }
});
