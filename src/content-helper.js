// src/content-helper.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_TABLE_LIST") {
    const tables = Array.from(document.querySelectorAll("table")).map((tbl, idx) => {
      const rect = tbl.getBoundingClientRect();
      return {
        index: idx,
        rows: tbl.rows.length,
        cols: tbl.rows[0]?.cells.length || 0,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
    sendResponse({ tables });
  }
});
