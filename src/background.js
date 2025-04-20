import XLSX from 'xlsx';
import { saveAs } from 'file-saver';

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'TABLES_DATA') {
    const { data, header, tableId } = msg.payload;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, header.title || tableId);

    // (옵션) header에 title/store/date를 첫 행에 삽입하고 싶으면
    // 별도 로직을 여기에 추가하세요.

    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, `${header.title || tableId}.xlsx`);
  }
});
