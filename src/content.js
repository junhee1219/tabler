// src/content.js
// // 팝업에서 START_TABLE_SELECTION 메시지를 받으면 선택 모드로 진입
// 기존 content.js 최상단에 추가
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("table").forEach(tbl => {
    tbl.classList.add("selectable-table");
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "SELECT_TABLE_BY_INDEX") {
    const target = document.querySelectorAll("table")[msg.index];
    if (!target) return;
    const clone = target.cloneNode(true);
    chrome.runtime.sendMessage({action: "TABLE_SELECTED", tableHtml: clone.outerHTML});
  } else if (msg.action === "START_TABLE_SELECTION") {
    enterSelectionMode();
  } else if (msg.action === 'HOVER_TABLE') {
    const tbl = document.querySelectorAll('table')[msg.index];
    if (tbl) tbl.classList.add('selectable-hover');
  } else if (msg.action === 'UNHOVER_TABLE') {
    const tbl = document.querySelectorAll('table')[msg.index];
    if (tbl) tbl.classList.remove('selectable-hover');
  }
});

function enterSelectionMode() {
  // 1) 모든 테이블에 기본 dashed 테두리 추가
  const tables = Array.from(document.querySelectorAll('table'));
  tables.forEach(tbl => tbl.classList.add('selectable-table'));

  // 2) hover / click 이벤트 바인딩 (기존 startTableSelection 로직 활용)
  startTableSelection(() => {
    // cleanup 콜백: 선택 모드 종료 시 호출
    tables.forEach(tbl => tbl.classList.remove('selectable-table', 'selectable-hover'));
  });
}
function startTableSelection(onDone) {
  const H = "___tbl_sel___";
  const style = document.createElement("style");
  style.textContent = `.${H}{outline:2px solid orange;cursor:pointer;}`;
  document.head.append(style);

  function cleanup() {
    document.removeEventListener("mouseover", onOver, true);
    document.removeEventListener("mouseout", onOut, true);
    document.removeEventListener("click", onClick, true);
    style.remove();
    if (onDone) onDone();
  }

  function getRealBackgroundColor(el) {
    let bg = window.getComputedStyle(el).backgroundColor;
    // 'transparent' 또는 투명 rgba(0,0,0,0)이면 부모로 올라가 봄
    if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
      if (el.parentElement) {
        return getRealBackgroundColor(el.parentElement);
      }
      return null;
    }
    return bg;
  }

  function onOver(e) {
    const tbl = e.target.closest("table");
    if (tbl) tbl.classList.add(H);
  }

  function onOut(e) {
    const tbl = e.target.closest("table");
    if (tbl) tbl.classList.remove(H);
  }

  function onClick(e) {
    const tbl = e.target.closest("table");
    if (!tbl) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup();

    const originals = Array.from(tbl.querySelectorAll('th, td')).map(cell => {
      const cs = window.getComputedStyle(cell);
      return {
        bg: getRealBackgroundColor(cell),
        color: cs.color,
        align: cs.textAlign
      };
    });

    const clone = tbl.cloneNode(true);
    clone.querySelectorAll('th, td').forEach((cell, i) => {
      const {bg, color, align} = originals[i];
      const parts = [];
      if (bg) parts.push(`background-color:${bg}`);
      if (color) parts.push(`color:${color}`);
      if (align) parts.push(`text-align:${align}`);
      cell.style.cssText = parts.join(';');
    });

    chrome.runtime.sendMessage({
      action: "TABLE_SELECTED",
      tableHtml: clone.outerHTML,
    });
    cleanup();
  }

  document.addEventListener("mouseover", onOver, true);
  document.addEventListener("mouseout", onOut, true);
  document.addEventListener("click", onClick, true);
}
