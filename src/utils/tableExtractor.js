// src/utils/tableExtractor.js
export function extractTables() {
    return Array.from(document.querySelectorAll('table')).map(table => {
      const rows = Array.from(table.rows);
      return rows.map(row =>
        Array.from(row.cells).map(cell => cell.innerText.trim())
      );
    });
  }
  