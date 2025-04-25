// src/content.js
// // 팝업에서 START_TABLE_SELECTION 메시지를 받으면 선택 모드로 진입
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "START_TABLE_SELECTION") {
    startTableSelection();
  }
});

function startTableSelection() {
  const H = "___tbl_sel___";
  const style = document.createElement("style");
  style.textContent = `.${H}{outline:2px solid orange;cursor:pointer;}`;
  document.head.append(style);

  function cleanup() {
    document.removeEventListener("mouseover", onOver, true);
    document.removeEventListener("mouseout", onOut, true);
    document.removeEventListener("click", onClick, true);
    style.remove();
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

    chrome.runtime.sendMessage({
      action: "TABLE_SELECTED",
      tableHtml: tbl.outerHTML,
    });
  }

  document.addEventListener("mouseover", onOver, true);
  document.addEventListener("mouseout", onOut, true);
  document.addEventListener("click", onClick, true);
}
