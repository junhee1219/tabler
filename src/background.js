import XLSX from 'xlsx';
import { saveAs } from 'file-saver';

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'TABLES_DATA') {
    const wb = XLSX.utils.book_new();
    msg.payload.forEach((table, idx) => {
      const ws = XLSX.utils.aoa_to_sheet(table);
      XLSX.utils.book_append_sheet(wb, ws, `Sheet${idx+1}`);
    });
    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, 'tables.xlsx');
  }
});
