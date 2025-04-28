// src/popup/popup.js

const RECENT_KEY = "recentExports";


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


  exportTableToExcel: async function (table, filename = `export_${Date.now()}.xlsx`) {
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
    saveAs(new Blob([buffer]), filename);
    await saveRecentExport(filename, table.outerHTML);
  },
};

async function saveRecentExport(filename, tableHtml) {
  const { [RECENT_KEY]: recentExports = [] } = await chrome.storage.local.get(RECENT_KEY);
  recentExports.unshift({ filename, tableHtml, timestamp: new Date().toISOString() });
  if (recentExports.length > 5) recentExports.pop();
  await chrome.storage.local.set({ [RECENT_KEY]: recentExports });
}

function renderRecent(list) {
  const listEl = document.getElementById("recent-list");
  listEl.innerHTML = "";
  list.forEach((rec, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="export-info">
        <small class="timestamp">${new Date(rec.timestamp).toLocaleString()}</small>
        <span class="filename">${rec.filename}</span>
      </div>
      <div class="export-actions">
        <button class="reexport" data-idx="${idx}" title="재내보내기">
          <span class="material-icons">download</span>
        </button>
        <button class="delete" data-idx="${idx}" title="삭제">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `;
    listEl.appendChild(li);
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  // 테이블 선택 버튼
  document.getElementById("start-select")
    .addEventListener("click", async () => {
      alert(1)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"],
      });
      alert(2)
      if (tab.id) chrome.tabs.sendMessage(tab.id, { action: "START_TABLE_SELECTION" });
    });

  // 팝업 → 백그라운드 메시지 리스너
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "TABLE_SELECTED" && msg.tableHtml) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = msg.tableHtml;
      const tableEl = wrapper.querySelector("table");
      if (tableEl) CmmnExcel.exportTableToExcel(tableEl);
    }
  });

  // 최근 내보내기 초기 렌더링
  const { [RECENT_KEY]: recentExports = [] } = await chrome.storage.local.get(RECENT_KEY);
  renderRecent(recentExports);

  // 재내보내기·삭제 핸들러
  document.getElementById("recent-list").addEventListener("click", async e => {
    const idx = +e.target.dataset.idx;
    const { [RECENT_KEY]: recentExports = [] } = await chrome.storage.local.get(RECENT_KEY);

    if (e.target.classList.contains("reexport")) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = recentExports[idx].tableHtml;
      const tableEl = wrapper.querySelector("table");
      CmmnExcel.exportTableToExcel(tableEl, recentExports[idx].filename);
    }

    if (e.target.classList.contains("delete")) {
      recentExports.splice(idx, 1);
      await chrome.storage.local.set({ [RECENT_KEY]: recentExports });
      renderRecent(recentExports);
    }
  });
});