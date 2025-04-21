import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const CmmnExcel = {
  // CSS 색상(rgb 또는 hex)을 ExcelJS ARGB 형식('FF' + RRGGBB)으로 변환
  getARGBFromColor: function (color) {
      if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') return null;
      let rgb = color.match(/rgb\s*\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/i);
      if (rgb) {
          let r = parseInt(rgb[1]).toString(16).padStart(2, '0');
          let g = parseInt(rgb[2]).toString(16).padStart(2, '0');
          let b = parseInt(rgb[3]).toString(16).padStart(2, '0');
          return 'FF' + r + g + b;
      }
      if (color[0] === '#') {
          let hex = color.replace('#', '');
          if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
          return 'FF' + hex;
      }
      return null;
  },

  // 테이블의 최대 열 수 계산 (colspan 고려)
  getMaxColumnCount: function (table) {
      let max = 0;
      for (let i = 0; i < table.rows.length; i++) {
          let row = table.rows[i];
          let count = 0;
          for (let j = 0; j < row.cells.length; j++) {
              count += row.cells[j].colSpan || 1;
          }
          if (count > max) max = count;
      }
      return max;
  },

  exportTableToExcel: async function (table, header = {}) {
      let workbook = new ExcelJS.Workbook();
      let worksheet = workbook.addWorksheet('Sheet1');

      // 테이블의 최대 열 수 계산 (병합을 위해)
      let numColumns = this.getMaxColumnCount(table);
      let headerRowsCount = 0;

      // header.title이 있으면 첫 행에 추가 (가로 병합)
      if (header.title) {
          let titleRow = worksheet.addRow([header.title]);
          worksheet.mergeCells(titleRow.number, 1, titleRow.number, numColumns);
          titleRow.height = 30; // 위아래 여백 증가
          let titleCell = titleRow.getCell(1);
          titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
          titleCell.font = { bold: true, size: 14 }; // 폰트 크기 14, 볼드체 적용
          headerRowsCount++;
      }

      // header.store가 있으면 매장명 행 추가 (A열)
      if (header.store) {
          let storeRow = worksheet.addRow([`매장명 : ${header.store}`]);
          storeRow.height = 22;
          storeRow.getCell(1).alignment = { vertical: 'middle' };
          headerRowsCount++;
      }
      // header.department 있으면 매장명 행 추가 (A열)
      if (header.department) {
          let departRow = worksheet.addRow([`Department : ${header.department}`]);
          departRow.height = 22;
          departRow.getCell(1).alignment = { vertical: 'middle' };
          headerRowsCount++;
      }
      // header.date가 있으면 날짜 행 추가 (A열)
      if (header.date) {
          let dateRow = worksheet.addRow([`Date : ${header.date}`]);
          dateRow.height = 22;
          dateRow.getCell(1).alignment = { vertical: 'middle' };
          headerRowsCount++;
      }

      // 병합 셀 처리를 위한 occupancy 객체
      let occupancy = {};
      function isOccupied(r, c) {
          return occupancy[r + ',' + c];
      }
      function markOccupied(r, c, rowSpan, colSpan) {
          for (let i = r; i < r + rowSpan; i++) {
              for (let j = c; j < c + colSpan; j++) {
                  occupancy[i + ',' + j] = true;
              }
          }
      }

      let htmlRows = table.rows;
      for (let i = 0; i < htmlRows.length; i++) {
          let htmlRow = htmlRows[i];
          let excelRowIndex = headerRowsCount + i + 1;
          let colIndex = 1;
          let hasNewLine = false;
          for (let j = 0; j < htmlRow.cells.length; j++) {
              while (isOccupied(excelRowIndex, colIndex)) { colIndex++; }
              let cell = htmlRow.cells[j];
              let excelCell = worksheet.getCell(excelRowIndex, colIndex);
              excelCell.value = cell.innerText;
              if (cell.innerText.indexOf('\n') !== -1) {
                  hasNewLine = true;
              }

              // 기본 테두리 적용
              excelCell.border = {
                  top: { style: 'thin' },
                  left: { style: 'thin' },
                  bottom: { style: 'thin' },
                  right: { style: 'thin' }
              };

              // getComputedStyle로 실제 CSS 스타일 읽어오기
              let computedStyle = window.getComputedStyle(cell);

              // 배경색 적용
              let bg = computedStyle.getPropertyValue('background-color');
              let argbBg = this.getARGBFromColor(bg);
              if (argbBg) {
                  excelCell.fill = {
                      type: 'pattern',
                      pattern: 'solid',
                      fgColor: { argb: argbBg }
                  };
              }

              // 글자색 적용
              let color = computedStyle.getPropertyValue('color');
              let argbFont = this.getARGBFromColor(color);
              if (argbFont) {
                  excelCell.font = {
                      color: { argb: argbFont }
                  };
              }

              let textAlign = computedStyle.getPropertyValue('text-align').trim();
              if (!['left', 'center', 'right'].includes(textAlign)) {
                  textAlign = 'left'; // 기본값 지정
              }
              // 모든 셀 세로 가운데 정렬, 가로값은 셀마다 text-align 읽어서 적용
              excelCell.alignment = { vertical: 'middle', horizontal: textAlign, wrapText: true };

              // 셀 병합 처리 (colspan, rowspan)
              let colspan = cell.colSpan || 1;
              let rowspan = cell.rowSpan || 1;
              if (colspan > 1 || rowspan > 1) {
                  let startAddress = excelCell.address;
                  let endCell = worksheet.getCell(excelRowIndex + rowspan - 1, colIndex + colspan - 1);
                  worksheet.mergeCells(`${startAddress}:${endCell.address}`);
                  markOccupied(excelRowIndex, colIndex, rowspan, colspan);
              } else {
                  markOccupied(excelRowIndex, colIndex, 1, 1);
              }
              colIndex++;
          }
          const heightByNewLine = hasNewLine? 1.5 : 1;
          worksheet.getRow(excelRowIndex).height = 22*heightByNewLine;
      }

      // 열 너비 자동 조절 (각 셀의 문자열 길이에 따라)
      worksheet.columns.forEach((column) => {
          let maxLength = 10;
          column.eachCell({ includeEmpty: true }, cell => {
              if (cell.row <= headerRowsCount) return; // 헤더 행은 건너뜁니다.
              let cellValue = cell.value ? cell.value.toString() : "";
              maxLength = Math.max(maxLength, cellValue.length);
          });
          column.width = maxLength + 2;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), 'sheet.xlsx');
  }
};



// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('start-select');
  btn.addEventListener('click', async () => {
    // 1. 현재 활성 탭 가져오기
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;
    // 2. content script에 메시지 보내서 테이블 선택 시작
    chrome.tabs.sendMessage(tab.id, { action: 'START_TABLE_SELECTION' });
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'TABLE_SELECTED' && msg.tableHtml) {
      CmmnExcel.exportTableToExcel(msg.tableHtml);
    }
  });

});

