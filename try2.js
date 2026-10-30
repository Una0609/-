const stitchDefinitions = {
  chain: {
    name: "鎖針",
    code: "CH",
    paths: ['<ellipse cx="24" cy="24" rx="11" ry="6.5"/>']
  },
  slip: {
    name: "引拔",
    code: "SL ST",
    paths: ['<circle cx="24" cy="24" r="2.8" fill="#242522"/>']
  },
  single: {
    name: "短針",
    code: "SC",
    paths: ['<path d="M16 16 32 32M32 16 16 32"/>']
  },
  "single-inc": {
    name: "短針加針",
    code: "SC INC",
    paths: ['<path d="M11 15 19 23M19 15 11 23M29 15 37 23M37 15 29 23"/>']
  },
  "single-dec": {
    name: "短針減針",
    code: "SC DEC",
    paths: ['<path d="M11 15 19 23M19 15 15 19M29 15 37 23M37 15 33 19M15 19 24 34 33 19"/>']
  },
  half: {
    name: "中長針",
    code: "HDC",
    paths: ['<path d="M24 37V12M13 14H35"/>']
  },
  "half-inc": {
    name: "中長針加針",
    code: "HDC INC",
    paths: ['<path d="M24 37 15 14M24 37 33 14M10 15H20M28 15H38"/>']
  },
  "half-dec": {
    name: "中長針減針",
    code: "HDC DEC",
    paths: ['<path d="M15 14V25L24 36 33 25V14M10 15H20M28 15H38"/>']
  },
  double: {
    name: "長針",
    code: "DC",
    paths: ['<path d="M24 38V12M13 14H35M20 24 28 20"/>']
  },
  "double-inc": {
    name: "長針加針",
    code: "DC INC",
    paths: ['<path d="M24 38 15 14M24 38 33 14M10 15H20M28 15H38M12 23 19 21M29 21 36 23"/>']
  },
  "double-dec": {
    name: "長針減針",
    code: "DC DEC",
    paths: ['<path d="M15 14V24L24 37 33 24V14M10 15H20M28 15H38M12 23 19 21M29 21 36 23"/>']
  },
  puff: {
    name: "玉針",
    code: "PUFF",
    paths: ['<path d="M24 36V30"/>', '<ellipse cx="24" cy="21" rx="8" ry="11"/>', '<path d="M20 14c2-2 5-2 7 0"/>']
  },
  flower: {
    name: "花針",
    code: "CLUSTER",
    paths: [
      '<path d="M24 35V29"/>',
      '<ellipse cx="24" cy="16" rx="4.5" ry="7"/>',
      '<ellipse cx="17.5" cy="21" rx="4.5" ry="7" transform="rotate(-55 17.5 21)"/>',
      '<ellipse cx="30.5" cy="21" rx="4.5" ry="7" transform="rotate(55 30.5 21)"/>',
      '<ellipse cx="19" cy="28" rx="4.5" ry="7" transform="rotate(-25 19 28)"/>',
      '<ellipse cx="29" cy="28" rx="4.5" ry="7" transform="rotate(25 29 28)"/>',
      '<circle cx="24" cy="23" r="2.2" fill="#242522"/>'
    ]
  }
};

const canvasFrame = document.querySelector("#canvasFrame");
const canvasSurface = document.querySelector("#canvasSurface");
const symbolLayer = document.querySelector("#symbolLayer");
const emptyState = document.querySelector("#emptyState");
const quantityInput = document.querySelector("#quantityInput");
const bendInput = document.querySelector("#bendInput");
const selectionLabel = document.querySelector("#selectionLabel");
const bendNote = document.querySelector("#bendNote");
const zoomValue = document.querySelector("#zoomValue");
const toast = document.querySelector("#toast");

let activeStitch = "chain";
let symbols = [];
let selectedIds = new Set();
let nextId = 1;
let zoom = 1;
let dragState = null;
let bendOrigins = null;
let toastTimer;

function getSymbolSvg(type) {
  const paths = stitchDefinitions[type].paths.join("");
  return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#242522" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function renderStitchPreviews() {
  const picker = document.querySelector("#stitchPicker");
  picker.innerHTML = Object.entries(stitchDefinitions).map(([type, stitch]) => {
    const active = type === activeStitch;
    return `<button class="stitch-option${active ? " active" : ""}" type="button" data-stitch="${type}" aria-pressed="${active}"><span class="stitch-preview" aria-hidden="true">${getSymbolSvg(type)}</span><span class="stitch-name">${stitch.name}</span><span class="stitch-code">${stitch.code}</span></button>`;
  }).join("");
}

function renderSymbols() {
  symbolLayer.innerHTML = symbols.map((symbol) => {
    const selected = selectedIds.has(symbol.id) ? " selected" : "";
    return `<div class="chart-symbol${selected}" data-id="${symbol.id}" role="button" tabindex="0" aria-label="${stitchDefinitions[symbol.type].name}符號" aria-pressed="${selectedIds.has(symbol.id)}" style="left:${symbol.x}px;top:${symbol.y}px;transform:rotate(${symbol.rotation}deg)">${getSymbolSvg(symbol.type)}</div>`;
  }).join("");
  emptyState.hidden = symbols.length > 0;
  updateSelectionTools();
}

function updateSelectionTools() {
  const count = selectedIds.size;
  selectionLabel.textContent = count ? `已選取 ${count} 個符號` : "尚未選取符號";
  document.querySelector("#rotateLeftButton").disabled = count === 0;
  document.querySelector("#rotateRightButton").disabled = count === 0;
  document.querySelector("#duplicateButton").disabled = count === 0;
  document.querySelector("#deleteButton").disabled = count === 0;
  bendInput.disabled = count < 2;
  bendNote.textContent = count < 2 ? "多選後調整弧度" : "左右拖曳";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function getQuantity() {
  const parsed = Number.parseInt(quantityInput.value, 10);
  const quantity = Number.isFinite(parsed) ? Math.min(99, Math.max(1, parsed)) : 1;
  quantityInput.value = String(quantity);
  return quantity;
}

function addSymbols() {
  const quantity = getQuantity();
  const spacing = 38;
  const frameWidth = canvasFrame.clientWidth;
  const rowLength = Math.max(1, Math.floor(Math.min(1800, frameWidth / zoom - 48) / spacing));
  const visibleCenterX = (canvasFrame.scrollLeft + frameWidth / 2) / zoom;
  const visibleCenterY = (canvasFrame.scrollTop + canvasFrame.clientHeight / 2) / zoom;
  const startX = Math.max(20, Math.min(1700, visibleCenterX - (Math.min(quantity, rowLength) * spacing) / 2));
  const startY = Math.max(20, Math.min(940, visibleCenterY - 16));
  const firstId = nextId;

  for (let index = 0; index < quantity; index += 1) {
    const column = index % rowLength;
    const row = Math.floor(index / rowLength);
    symbols.push({
      id: nextId++,
      type: activeStitch,
      x: Math.min(1760, startX + column * spacing),
      y: Math.min(960, startY + row * spacing),
      rotation: 0
    });
  }

  selectedIds = new Set(Array.from({ length: quantity }, (_, index) => firstId + index));
  renderSymbols();
  showToast(`已加入 ${quantity} 個${stitchDefinitions[activeStitch].name}符號`);
}

function getSymbolById(id) {
  return symbols.find((symbol) => symbol.id === id);
}

function handleSymbolPointerDown(event) {
  const element = event.target.closest(".chart-symbol");
  if (!element) return;
  event.preventDefault();
  const id = Number(element.dataset.id);
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
  } else if (!selectedIds.has(id)) {
    selectedIds = new Set([id]);
  }
  renderSymbols();
  if (!selectedIds.has(id)) return;

  const selected = symbols.filter((symbol) => selectedIds.has(symbol.id));
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originals: selected.map((symbol) => ({ id: symbol.id, x: symbol.x, y: symbol.y }))
  };
  canvasSurface.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const deltaX = (event.clientX - dragState.startX) / zoom;
  const deltaY = (event.clientY - dragState.startY) / zoom;
  for (const original of dragState.originals) {
    const symbol = getSymbolById(original.id);
    if (symbol) {
      symbol.x = Math.max(0, Math.min(1768, original.x + deltaX));
      symbol.y = Math.max(0, Math.min(968, original.y + deltaY));
    }
  }
  renderSymbols();
}

function handlePointerUp(event) {
  if (dragState && dragState.pointerId === event.pointerId) {
    if (canvasSurface.hasPointerCapture(event.pointerId)) canvasSurface.releasePointerCapture(event.pointerId);
    dragState = null;
  }
}

function rotateSelected(amount) {
  for (const symbol of symbols) {
    if (selectedIds.has(symbol.id)) symbol.rotation = (symbol.rotation + amount) % 360;
  }
  renderSymbols();
}

function captureBendOrigins() {
  const selected = symbols.filter((symbol) => selectedIds.has(symbol.id));
  if (selected.length < 2) return;
  bendOrigins = selected.map((symbol) => ({ id: symbol.id, x: symbol.x, y: symbol.y }));
}

function bendSelected() {
  if (selectedIds.size < 2) return;
  if (!bendOrigins || bendOrigins.length !== selectedIds.size || bendOrigins.some((entry) => !selectedIds.has(entry.id))) {
    captureBendOrigins();
  }
  if (!bendOrigins) return;

  const minX = Math.min(...bendOrigins.map((entry) => entry.x));
  const maxX = Math.max(...bendOrigins.map((entry) => entry.x));
  const curve = Number(bendInput.value);
  bendOrigins.forEach((origin, index) => {
    const symbol = getSymbolById(origin.id);
    if (!symbol) return;
    const t = maxX > minX ? (origin.x - minX) / (maxX - minX) : index / (bendOrigins.length - 1);
    symbol.y = Math.max(0, Math.min(968, origin.y + curve * 4 * t * (1 - t)));
  });
  renderSymbols();
}

function deleteSelected() {
  symbols = symbols.filter((symbol) => !selectedIds.has(symbol.id));
  selectedIds.clear();
  bendOrigins = null;
  renderSymbols();
}

function duplicateSelected() {
  const copies = symbols.filter((symbol) => selectedIds.has(symbol.id)).map((symbol) => ({
    ...symbol,
    id: nextId++,
    x: Math.min(1768, symbol.x + 38),
    y: Math.min(968, symbol.y + 38)
  }));
  symbols.push(...copies);
  selectedIds = new Set(copies.map((symbol) => symbol.id));
  bendOrigins = null;
  renderSymbols();
}

function setZoom(nextZoom) {
  zoom = Math.max(0.6, Math.min(1.5, Math.round(nextZoom * 10) / 10));
  canvasSurface.style.transform = `scale(${zoom})`;
  canvasSurface.style.marginBottom = `${1000 * (zoom - 1)}px`;
  canvasSurface.style.marginRight = `${1800 * (zoom - 1)}px`;
  zoomValue.textContent = `${Math.round(zoom * 100)}%`;
}

function downloadChart() {
  const grid = document.querySelector("#gridToggle").checked
    ? '<defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#e8e7df" stroke-width="1"/></pattern></defs><rect width="1800" height="1000" fill="url(#grid)"/>'
    : '<rect width="1800" height="1000" fill="#fffefb"/>';
  const contents = symbols.map((symbol) => {
    const x = symbol.x + 16;
    const y = symbol.y + 16;
    return `<g transform="translate(${x} ${y}) rotate(${symbol.rotation}) translate(-24 -24)">${stitchDefinitions[symbol.type].paths.join("")}</g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1000" viewBox="0 0 1800 1000">${grid}<g fill="none" stroke="#343a34" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">${contents}</g></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "我的編織織圖.svg";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("織圖已匯出為 SVG");
}

document.querySelector("#stitchPicker").addEventListener("click", (event) => {
  const option = event.target.closest("[data-stitch]");
  if (!option) return;
  activeStitch = option.dataset.stitch;
  document.querySelectorAll(".stitch-option").forEach((button) => {
    const active = button === option;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
});

document.querySelector("#addButton").addEventListener("click", addSymbols);
document.querySelector("#quantityMinus").addEventListener("click", () => {
  quantityInput.value = String(Math.max(1, getQuantity() - 1));
});
document.querySelector("#quantityPlus").addEventListener("click", () => {
  quantityInput.value = String(Math.min(99, getQuantity() + 1));
});
quantityInput.addEventListener("change", getQuantity);
symbolLayer.addEventListener("pointerdown", handleSymbolPointerDown);
canvasSurface.addEventListener("pointermove", handlePointerMove);
canvasSurface.addEventListener("pointerup", handlePointerUp);
canvasSurface.addEventListener("pointercancel", handlePointerUp);
canvasSurface.addEventListener("click", (event) => {
  if (event.target === canvasSurface || event.target === symbolLayer) {
    selectedIds.clear();
    bendOrigins = null;
    renderSymbols();
  }
});
document.querySelector("#rotateLeftButton").addEventListener("click", () => rotateSelected(-15));
document.querySelector("#rotateRightButton").addEventListener("click", () => rotateSelected(15));
bendInput.addEventListener("pointerdown", captureBendOrigins);
bendInput.addEventListener("input", bendSelected);
bendInput.addEventListener("change", () => { bendOrigins = null; });
document.querySelector("#deleteButton").addEventListener("click", deleteSelected);
document.querySelector("#duplicateButton").addEventListener("click", duplicateSelected);
document.querySelector("#gridToggle").addEventListener("change", (event) => {
  canvasSurface.classList.toggle("grid-on", event.target.checked);
});
document.querySelector("#zoomOutButton").addEventListener("click", () => setZoom(zoom - 0.1));
document.querySelector("#zoomInButton").addEventListener("click", () => setZoom(zoom + 0.1));
document.querySelector("#resetViewButton").addEventListener("click", () => {
  setZoom(1);
  canvasFrame.scrollTo({ left: 0, top: 0, behavior: "smooth" });
});
document.querySelector("#clearButton").addEventListener("click", () => {
  if (symbols.length === 0) {
    showToast("畫布目前是空的");
    return;
  }
  symbols = [];
  selectedIds.clear();
  bendOrigins = null;
  renderSymbols();
  showToast("畫布已清空");
});
document.querySelector("#exportButton").addEventListener("click", downloadChart);
document.addEventListener("keydown", (event) => {
  if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.size > 0) {
    if (event.target.matches("input")) return;
    deleteSelected();
  }
  if (event.key === "Escape") {
    selectedIds.clear();
    bendOrigins = null;
    renderSymbols();
  }
});

renderStitchPreviews();
renderSymbols();
