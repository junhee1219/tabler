// src/popup/popup.js

const CmmnExcel = {
  // CSS 색상(rgb 또는 hex)을 ExcelJS ARGB 형식('FF' + RRGGBB)으로 변환
  getARGBFromColor: function (color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
    const m = color.match(
      /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/
    );
    if (m) {
      const [_, r, g, b] = m;
      return 'FF' +
        parseInt(r).toString(16).padStart(2,'0') +
        parseInt(g).toString(16).padStart(2,'0') +
        parseInt(b).toString(16).padStart(2,'0');
    }
    if (color.startsWith('#')) {
      let hex = color.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
      return 'FF' + hex;
    }
    return null;
  },


  exportTableToExcel: async function (table) {
    let workbook = new ExcelJS.Workbook();
    let worksheet = workbook.addWorksheet("Sheet1");

    let headerRowsCount = 0;

    // 병합 셀 처리를 위한 occupancy 객체
    let occupancy = {};
    function isOccupied(r, c) {
      return occupancy[r + "," + c];
    }
    function markOccupied(r, c, rowSpan, colSpan) {
      for (let i = r; i < r + rowSpan; i++) {
        for (let j = c; j < c + colSpan; j++) {
          occupancy[i + "," + j] = true;
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
        while (isOccupied(excelRowIndex, colIndex)) {
          colIndex++;
        }
        let cell = htmlRow.cells[j];
        let excelCell = worksheet.getCell(excelRowIndex, colIndex);
        excelCell.value = cell.innerText.trim();
        if (cell.innerText.indexOf("\n") !== -1) {
          hasNewLine = true;
        }

        // 기본 테두리 적용
        excelCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        let bg = cell.style.backgroundColor;         // 콘텐츠 스크립트에서 inlined
        let argbBg = this.getARGBFromColor(bg);
        if (argbBg) {
          excelCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: argbBg },
          };
        }

        // 글자색 적용
        let color = cell.style.color;
        let argbFont = this.getARGBFromColor(color);
        if (argbFont) {
          excelCell.font = {
            color: { argb: argbFont },
          };
        }

        let textAlign = cell.style.textAlign || 'left';
        if (!["left", "center", "right"].includes(textAlign)) {
          textAlign = "left"; // 기본값 지정
        }
        // 모든 셀 세로 가운데 정렬, 가로값은 셀마다 text-align 읽어서 적용
        excelCell.alignment = {
          vertical: "middle",
          horizontal: textAlign,
          wrapText: true,
        };

        // 셀 병합 처리 (colspan, rowspan)
        let colspan = cell.colSpan || 1;
        let rowspan = cell.rowSpan || 1;
        if (colspan > 1 || rowspan > 1) {
          let startAddress = excelCell.address;
          let endCell = worksheet.getCell(
            excelRowIndex + rowspan - 1,
            colIndex + colspan - 1
          );
          worksheet.mergeCells(`${startAddress}:${endCell.address}`);
          markOccupied(excelRowIndex, colIndex, rowspan, colspan);
        } else {
          markOccupied(excelRowIndex, colIndex, 1, 1);
        }
        colIndex++;
      }
      const heightByNewLine = hasNewLine ? 1.5 : 1;
      worksheet.getRow(excelRowIndex).height = 22 * heightByNewLine;
    }

    // 열 너비 자동 조절 (각 셀의 문자열 길이에 따라)
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.row <= headerRowsCount) return; // 헤더 행은 건너뜁니다.
        let cellValue = cell.value ? cell.value.toString().trim() : "";
        maxLength = Math.max(maxLength, cellValue.length);
      });
      column.width = maxLength + 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "sheet.xlsx");
  },
};

// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("start-select");
  btn.addEventListener("click", async () => {
    // 1. 현재 활성 탭 가져오기
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab.id) return;
    // 2. content script에 메시지 보내서 테이블 선택 시작
    chrome.tabs.sendMessage(tab.id, { action: "START_TABLE_SELECTION" });
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "TABLE_SELECTED" && msg.tableHtml) {
      // 1) wrapper DIV 를 만들어서
      const wrapper = document.createElement("div");
      wrapper.innerHTML = msg.tableHtml;

      // 2) 실제 <table> 요소를 꺼내서
      const tableEl = wrapper.querySelector("table");
      if (!tableEl) {
        alert(
          "TABLE_SELECTED 메시지에 tableHtml 은 있는데, <table> 요소를 찾을 수 없습니다."
        );
        return;
      }

      const bg = tableEl.querySelector('th')?.style.backgroundColor;
      console.log('첫번째 <th> 인라인 bg:', bg);

      // 3) DOM 요소를 넘겨줌
      CmmnExcel.exportTableToExcel(tableEl);

    }
  });
});
