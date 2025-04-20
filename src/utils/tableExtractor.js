// src/utils/tableExtractor.js

// 전역(window) 객체에 tableExtractor 등록
window.tableExtractor = {
    getTitleBySearchType: function(search_type, period1, period2) {
      const DICT_MONTH = ['', 'January', 'Feburary', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      if (search_type === 'year') {
        return `AVERAGE OF ${period1} YEAR REPORT`;
      } else if (search_type === 'semiyear') {
        return `AVERAGE OF ${period2} HALF YEAR REPORT`;
      } else if (search_type === 'quarter') {
        return `AVERAGE OF ${period2} QUARTER REPORT`;
      } else if (search_type === 'month') {
        return `AVERAGE OF ${DICT_MONTH[period2].toUpperCase()} REPORT`;
      } else if (search_type === 'week') {
        return `WEEK OF ${period2} WEEKLY REPORT`;
      }
      return 'Untitled';
    },
  
    getARGBFromColor: function(color) {
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
  
    getMaxColumnCount: function(table) {
      let max = 0;
      for (let i = 0; i < table.rows.length; i++) {
        let row = table.rows[i], count = 0;
        for (let j = 0; j < row.cells.length; j++) {
          count += row.cells[j].colSpan || 1;
        }
        if (count > max) max = count;
      }
      return max;
    },
  
    /**
     * HTML 테이블을 엑셀로 내보내기
     * @param {string} id
     * @param {object} header
     */
    exportTableToExcel: async function(tbl, header = {}) {
      // 1) id로 테이블 찾기
      let table = tbl
  
      // 2) ExcelJS 워크북/시트 설정
      let workbook = new ExcelJS.Workbook();
      let worksheet = workbook.addWorksheet('Sheet1');
  
      // 병합 등을 위해 열 개수 계산
      let numColumns = this.getMaxColumnCount(table);
      let headerRowsCount = 0;
  
      // (옵션) title, store, department, date 셀 추가
      if (header.title) {
        let row = worksheet.addRow([header.title]);
        worksheet.mergeCells(row.number, 1, row.number, numColumns);
        row.height = 30;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(1).font      = { bold: true, size: 14 };
        headerRowsCount++;
      }
      if (header.store) {
        let row = worksheet.addRow([`매장명 : ${header.store}`]);
        row.height = 22;
        row.getCell(1).alignment = { vertical: 'middle' };
        headerRowsCount++;
      }
      if (header.department) {
        let row = worksheet.addRow([`Department : ${header.department}`]);
        row.height = 22;
        row.getCell(1).alignment = { vertical: 'middle' };
        headerRowsCount++;
      }
      if (header.date) {
        let row = worksheet.addRow([`Date : ${header.date}`]);
        row.height = 22;
        row.getCell(1).alignment = { vertical: 'middle' };
        headerRowsCount++;
      }
  
      // occupancy 맵으로 rowspan/colspan 처리
      let occupancy = {};
      function isOccupied(r,c){ return occupancy[`${r},${c}`]; }
      function markOccupied(r,c,rs,cs){
        for(let i=r;i<r+rs;i++)for(let j=c;j<c+cs;j++){
          occupancy[`${i},${j}`] = true;
        }
      }
  
      // 3) 실제 테이블 순회하며 셀 추가
      for (let i = 0; i < table.rows.length; i++) {
        let htmlRow = table.rows[i];
        let excelRowIndex = headerRowsCount + i + 1;
        let colIndex = 1, hasNewLine = false;
        for (let j = 0; j < htmlRow.cells.length; j++) {
          while (isOccupied(excelRowIndex, colIndex)) colIndex++;
          let cell     = htmlRow.cells[j];
          let excelCel = worksheet.getCell(excelRowIndex, colIndex);
          excelCel.value = cell.innerText;
  
          if (cell.innerText.includes('\n')) hasNewLine = true;
          excelCel.border = {
            top:{style:'thin'}, left:{style:'thin'},
            bottom:{style:'thin'}, right:{style:'thin'}
          };
  
          // CSS 스타일 반영
          let style = getComputedStyle(cell);
          let bg    = this.getARGBFromColor(style.backgroundColor);
          let fg    = this.getARGBFromColor(style.color);
          if (bg) excelCel.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:bg } };
          if (fg) excelCel.font = { color:{ argb:fg } };
  
          let ta = style.textAlign.trim();
          if (!['left','center','right'].includes(ta)) ta = 'left';
          excelCel.alignment = { vertical:'middle', horizontal:ta, wrapText: true };
  
          // 병합
          let cs = cell.colSpan||1, rs = cell.rowSpan||1;
          if (cs>1||rs>1) {
            let start=excelCel.address;
            let end  = worksheet.getCell(excelRowIndex+rs-1, colIndex+cs-1).address;
            worksheet.mergeCells(`${start}:${end}`);
            markOccupied(excelRowIndex, colIndex, rs, cs);
          } else markOccupied(excelRowIndex, colIndex, 1, 1);
  
          colIndex++;
        }
        worksheet.getRow(headerRowsCount + i + 1).height = hasNewLine ? 33 : 22;
      }
  
      // 4) 열 너비 자동 조정
      worksheet.columns.forEach(col => {
        let maxLen = 10;
        col.eachCell({ includeEmpty:true }, c => {
          let v = c.value ? c.value.toString() : '';
          if (v.length > maxLen) maxLen = v.length;
        });
        col.width = maxLen + 2;
      });
  
      // 5) 다운로드
      const buf = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `asdf.xlsx`);
    }
  };
  