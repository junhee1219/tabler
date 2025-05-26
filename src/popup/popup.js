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
// popup.js
const RECENT_KEY = "recentExports";

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

// 테이블 목록 렌더링 (isPopup: true면 팝업 자체 테이블)
function renderTableList(tables, isPopup = false) {
  const listEl = document.getElementById("table-list");
  listEl.innerHTML = "";
  tables.forEach(tbl => {
    const li = document.createElement("li");
    li.dataset.idx = tbl.index;
    li.dataset.popup = isPopup ? "1" : "0";
    li.innerHTML = `
      <span class="info">#${tbl.index} — ${tbl.rows}×${tbl.cols}, ${tbl.width}×${tbl.height}px</span>
      <span class="action">&#9654;</span>
    `;
    li.addEventListener("click", () => selectTable(tbl.index, isPopup));
    listEl.appendChild(li);
  });
}

// 팝업 내 테이블 목록 가져오기
function fetchPopupTableList() {
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
  renderTableList(tables, true);
}

// 테이블 선택 처리
async function selectTable(index, isPopup) {
  if (isPopup) {
    // 팝업 자체 테이블
    const tbl = document.querySelectorAll("table")[index];
    if (!tbl) return;
    CmmnExcel.exportTableToExcel(tbl);
    window.close();
  } else {
    // 현재 탭의 테이블
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "SELECT_TABLE_BY_INDEX", index });
    window.close();
  }
}

// 페이지상의 테이블 목록 요청
async function fetchTableList() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "GET_TABLE_LIST" }, response => {
    if (response && response.tables) {
      renderTableList(response.tables, false);
    } else {
      // 탭에 콘텐츠 스크립트가 없거나 에러 시 팝업 내 테이블 표시
      fetchPopupTableList();
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // 최근 내보내기 렌더링
  const { [RECENT_KEY]: recentExports = [] } = await chrome.storage.local.get(RECENT_KEY);
  renderRecent(recentExports);

  // 팝업 테이블 목록용 UI 요소 추가
  const tableListContainer = document.createElement("div");
  tableListContainer.innerHTML = `
    <h3>페이지 테이블 목록</h3>
    <ul id="table-list"></ul>
  `;
  document.querySelector(".container").prepend(tableListContainer);

  // 초기 목록 로드
  fetchTableList();

  // "테이블 선택" 버튼 -> 강제 페이지 스크립트 주입 후 선택 모드
  document.getElementById("start-select").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
    chrome.tabs.sendMessage(tab.id, { action: "START_TABLE_SELECTION" });
  });

  // 메시지 리스너 (페이지 측에서 TABLE_SELECTED 전송)
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === "TABLE_SELECTED" && msg.tableHtml) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = msg.tableHtml;
      const tableEl = wrapper.querySelector("table");
      if (tableEl) await CmmnExcel.exportTableToExcel(tableEl);
    }
  });

  // 최근 내보내기 다시내보내기
  document.getElementById("recent-list").addEventListener("click", async e => {
    const idx = +e.target.dataset.idx;
    if (!isNaN(idx)) {
      const { [RECENT_KEY]: recentExports = [] } = await chrome.storage.local.get(RECENT_KEY);
      const rec = recentExports[idx];
      const wrapper = document.createElement("div"); wrapper.innerHTML = rec.tableHtml;
      CmmnExcel.exportTableToExcel(wrapper.querySelector("table"), rec.filename);
    }
  });
});