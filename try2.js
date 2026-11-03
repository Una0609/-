const stitchDefinitions = {
  chain: {
    name: "鎖針",
    code: "CH",
    paths: ['<ellipse cx="24" cy="24" rx="11" ry="6.5"/>']
  },
  slip: {
    name: "引拔針",
    code: "SL ST",
    paths: ['<circle cx="24" cy="24" r="2.8" fill="currentColor"/>']
  },
  single: {
    name: "短針",
    code: "SC",
    paths: ['<path d="M16 16 32 32M32 16 16 32"/>']
  },
  half: {
    name: "中長針",
    code: "HDC",
    paths: ['<path d="M24 37V12M13 14H35"/>']
  },
  double: {
    name: "長針",
    code: "DC",
    paths: ['<path d="M24 38V12M13 14H35M20 24 28 20"/>']
  },
  treble: {
    name: "長長針",
    code: "TR",
    paths: ['<path d="M24 39V10M13 12H35M20 19 28 16M19 26 29 22"/>']
  },
  bubble3: {
    name: "3針泡泡針",
    code: "3 DC POP",
    paths: [
      '<path d="M24 39V33"/>',
      '<path d="M24 33 16 17Q15 13 19 13Q22 13 24 18Q26 13 29 13Q33 13 32 17L24 33"/>',
      '<path d="M18 22 30 22M21 28 27 28"/>'
    ]
  },
  bubble5: {
    name: "5針泡泡針",
    code: "5 TR POP",
    paths: [
      '<path d="M24 39V34"/>',
      '<path d="M24 34 14 18Q12 13 16 12Q20 11 24 19Q28 11 32 12Q36 13 34 18L24 34"/>',
      '<path d="M16 19 32 19M19 25 29 25M22 30 26 30"/>'
    ]
  },
  popcorn: {
    name: "爆米花針",
    code: "5 TR TOG",
    paths: [
      '<path d="M24 39V35"/>',
      '<path d="M24 35C15 31 12 23 14 17 16 11 21 13 24 19 27 13 32 11 34 17 36 23 33 31 24 35Z"/>',
      '<path d="M18 17 30 29M30 17 18 29M15 23H33M24 13V33"/>'
    ]
  }
};

const symbolColors = {
  black: "#242522",
  red: "#cf4b4b",
  green: "#4f8057"
};

const canvasFrame = document.querySelector("#canvasFrame");
const canvasSurface = document.querySelector("#canvasSurface");
const symbolLayer = document.querySelector("#symbolLayer");
const emptyState = document.querySelector("#emptyState");
const quantityInput = document.querySelector("#quantityInput");
const bendInput = document.querySelector("#bendInput");
const arrangementInput = document.querySelector("#arrangementInput");
const selectionLabel = document.querySelector("#selectionLabel");
const bendNote = document.querySelector("#bendNote");
const zoomValue = document.querySelector("#zoomValue");
const toast = document.querySelector("#toast");
const multiSelectToggle = document.querySelector("#multiSelectToggle");
const projectNameInput = document.querySelector("#projectNameInput");
const projectStatus = document.querySelector("#projectStatus");
const libraryDialog = document.querySelector("#libraryDialog");
const draftChart = document.querySelector("#draftChart");
const savedChartsContainer = document.querySelector("#savedCharts");
const storageKey = "crochet-chart-studio-v1";
let toastTimer;

function isValidSymbol(symbol) {
  return symbol
    && Number.isInteger(symbol.id)
    && (symbol.type === "puff" || Object.prototype.hasOwnProperty.call(stitchDefinitions, symbol.type))
    && Number.isFinite(symbol.x)
    && Number.isFinite(symbol.y)
    && Number.isFinite(symbol.rotation)
    && (symbol.scale === undefined || (Number.isFinite(symbol.scale) && symbol.scale > 0 && symbol.scale <= 1))
    && (symbol.color === undefined || Object.prototype.hasOwnProperty.call(symbolColors, symbol.color));
}

function normalizeSymbol(symbol) {
  return {
    ...symbol,
    type: symbol.type === "puff" ? "bubble3" : symbol.type,
    color: symbol.color || "black",
    scale: symbol.scale || 1
  };
}

function loadStoredState() {
  const emptyState = {
    draft: { name: "未命名織圖", symbols: [], nextId: 1, savedId: null, dirty: true, gridEnabled: true },
    savedCharts: []
  };
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return emptyState;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") throw new Error("無效的織圖資料");
    const draft = parsed.draft && typeof parsed.draft === "object" ? parsed.draft : emptyState.draft;
    const loadedSymbols = Array.isArray(draft.symbols) ? draft.symbols.filter(isValidSymbol).map(normalizeSymbol) : [];
    const savedCharts = Array.isArray(parsed.savedCharts)
      ? parsed.savedCharts.filter((chart) => chart && typeof chart.id === "string" && typeof chart.name === "string")
        .map((chart) => ({
          id: chart.id,
          name: chart.name,
          symbols: Array.isArray(chart.symbols) ? chart.symbols.filter(isValidSymbol).map(normalizeSymbol) : [],
          createdAt: Number.isFinite(chart.createdAt) ? chart.createdAt : Date.now(),
          updatedAt: Number.isFinite(chart.updatedAt) ? chart.updatedAt : Date.now()
        }))
      : [];
    return {
      draft: {
        name: typeof draft.name === "string" ? draft.name : emptyState.draft.name,
        symbols: loadedSymbols,
        nextId: Number.isInteger(draft.nextId) ? draft.nextId : 1,
        savedId: typeof draft.savedId === "string" ? draft.savedId : null,
        dirty: Boolean(draft.dirty),
        gridEnabled: typeof draft.gridEnabled === "boolean" ? draft.gridEnabled : true
      },
      savedCharts
    };
  } catch (error) {
    showToast("讀取本機織圖失敗，請確認瀏覽器儲存權限");
    return emptyState;
  }
}

const storedState = loadStoredState();

let activeStitch = "chain";
let activeColor = "black";
let symbols = storedState.draft.symbols;
let selectedIds = new Set();
let nextId = symbols.reduce((highestId, symbol) => Math.max(highestId, symbol.id + 1), Math.max(storedState.draft.nextId, 1));
let zoom = 1;
let multiSelectMode = false;
let dragState = null;
let bendOrigins = null;
let projectName = storedState.draft.name;
let currentSavedId = storedState.draft.savedId;
let savedCharts = storedState.savedCharts;
let isDirty = storedState.draft.dirty;

if (currentSavedId && !savedCharts.some((chart) => chart.id === currentSavedId)) {
  currentSavedId = null;
  isDirty = true;
}

projectNameInput.value = projectName;
document.querySelector("#gridToggle").checked = storedState.draft.gridEnabled;
canvasSurface.classList.toggle("grid-on", storedState.draft.gridEnabled);
projectStatus.textContent = isDirty ? "編輯中" : "已儲存";

function getSymbolSvg(type, color = "black") {
  const paths = stitchDefinitions[type].paths.join("");
  const hexColor = symbolColors[color];
  return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" color="${hexColor}" stroke="${hexColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
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
    return `<div class="chart-symbol${selected}" data-id="${symbol.id}" role="button" tabindex="0" aria-label="${stitchDefinitions[symbol.type].name}符號，${symbol.color === "black" ? "黑色" : symbol.color === "red" ? "紅色" : "綠色"}" aria-pressed="${selectedIds.has(symbol.id)}" style="left:${symbol.x}px;top:${symbol.y}px;transform:rotate(${symbol.rotation}deg) scale(${symbol.scale || 1})">${getSymbolSvg(symbol.type, symbol.color)}</div>`;
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
  bendNote.textContent = count < 2
    ? "多選後調整弧度"
    : arrangementInput.value === "circle" ? "調整圓形緊密度" : "左右拖曳";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function updateProjectStatus() {
  projectStatus.textContent = isDirty ? "編輯中" : "已儲存";
}

function persistAppState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      draft: {
        name: projectName,
        symbols,
        nextId,
        savedId: currentSavedId,
        dirty: isDirty,
        gridEnabled: document.querySelector("#gridToggle").checked
      },
      savedCharts
    }));
    return true;
  } catch (error) {
    showToast("本機儲存失敗，請確認瀏覽器儲存空間或權限");
    return false;
  }
}

function markProjectDirty() {
  isDirty = true;
  updateProjectStatus();
  persistAppState();
}

function createLibraryRow(name, detail, actionLabel, onAction, deleteAction) {
  const row = document.createElement("div");
  row.className = "library-row";
  const info = document.createElement("div");
  info.className = "library-row-info";
  const title = document.createElement("strong");
  title.textContent = name;
  const description = document.createElement("span");
  description.textContent = detail;
  info.append(title, description);
  const actions = document.createElement("div");
  actions.className = "library-row-actions";
  const actionButton = document.createElement("button");
  actionButton.className = "text-button";
  actionButton.type = "button";
  actionButton.textContent = actionLabel;
  actionButton.addEventListener("click", onAction);
  actions.append(actionButton);
  if (deleteAction) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "text-button delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "刪除";
    deleteButton.addEventListener("click", deleteAction);
    actions.append(deleteButton);
  }
  row.append(info, actions);
  return row;
}

function renderLibrary() {
  draftChart.replaceChildren(createLibraryRow(
    projectName.trim() || "未命名織圖",
    `${symbols.length} 個符號・${isDirty ? "尚未儲存的修改" : "目前版本"}`,
    "繼續編輯",
    () => libraryDialog.close()
  ));
  savedChartsContainer.replaceChildren();
  if (savedCharts.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "library-empty";
    emptyMessage.textContent = "尚無已儲存織圖";
    savedChartsContainer.append(emptyMessage);
    return;
  }

  [...savedCharts]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((chart) => {
      savedChartsContainer.append(createLibraryRow(
        chart.name,
        `${chart.symbols.length} 個符號・已儲存`,
        "開啟編輯",
        () => openSavedChart(chart.id),
        () => {
          if (!window.confirm(`確定刪除「${chart.name}」？`)) return;
          savedCharts = savedCharts.filter((savedChart) => savedChart.id !== chart.id);
          if (currentSavedId === chart.id) {
            currentSavedId = null;
            isDirty = true;
          }
          persistAppState();
          renderLibrary();
          updateProjectStatus();
        }
      ));
    });
}

function openSavedChart(id) {
  const chart = savedCharts.find((savedChart) => savedChart.id === id);
  if (!chart) {
    showToast("找不到這張已儲存的織圖");
    renderLibrary();
    return;
  }
  const hasUnsavedWork = isDirty && (currentSavedId !== null || symbols.length > 0 || projectName !== "未命名織圖");
  if (hasUnsavedWork && !window.confirm("目前織圖有尚未儲存的修改，切換後會捨棄這些修改。仍要開啟嗎？")) return;
  projectName = chart.name;
  projectNameInput.value = projectName;
  symbols = chart.symbols.map((symbol) => ({ ...symbol }));
  nextId = symbols.reduce((highestId, symbol) => Math.max(highestId, symbol.id + 1), 1);
  selectedIds.clear();
  currentSavedId = chart.id;
  isDirty = false;
  bendOrigins = null;
  updateProjectStatus();
  renderSymbols();
  libraryDialog.close();
  if (!persistAppState()) {
    isDirty = true;
    updateProjectStatus();
  }
}

function saveCurrentProject() {
  const name = projectNameInput.value.trim();
  if (!name) {
    showToast("請先輸入織圖名稱");
    projectNameInput.focus();
    return;
  }
  projectName = name;
  projectNameInput.value = name;
  const now = Date.now();
  const existing = savedCharts.find((chart) => chart.id === currentSavedId);
  const id = currentSavedId || (window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${now}-${Math.random().toString(36).slice(2)}`);
  const chart = {
    id,
    name,
    symbols: symbols.map((symbol) => ({ ...symbol })),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };
  savedCharts = existing
    ? savedCharts.map((savedChart) => savedChart.id === id ? chart : savedChart)
    : [...savedCharts, chart];
  currentSavedId = id;
  isDirty = false;
  updateProjectStatus();
  if (!persistAppState()) {
    isDirty = true;
    updateProjectStatus();
    return;
  }
  showToast("織圖已儲存，可從資料夾再次編輯");
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
  const viewportLeft = Math.max(0, canvasFrame.scrollLeft / zoom);
  const viewportTop = Math.max(0, canvasFrame.scrollTop / zoom);
  const viewportRight = Math.min(1800, (canvasFrame.scrollLeft + canvasFrame.clientWidth) / zoom);
  const viewportBottom = Math.min(1000, (canvasFrame.scrollTop + canvasFrame.clientHeight) / zoom);
  const availableWidth = Math.max(1, viewportRight - viewportLeft - 48);
  const availableHeight = Math.max(1, viewportBottom - viewportTop - 48);
  const visibleCenterX = (canvasFrame.scrollLeft + canvasFrame.clientWidth / 2) / zoom;
  const visibleCenterY = (canvasFrame.scrollTop + canvasFrame.clientHeight / 2) / zoom;
  const layout = arrangementInput.value;
  const scale = layout === "circle" && quantity > 1
    ? Math.min(1, (Math.min(availableWidth, availableHeight) / 2) / (spacing / (2 * Math.sin(Math.PI / quantity)) + 16))
    : layout === "horizontal"
      ? Math.min(1, availableWidth / (32 + spacing * (quantity - 1)), availableHeight / 32)
      : Math.min(1, availableWidth / 32, availableHeight / (32 + spacing * (quantity - 1)));
  const radius = layout === "circle" && quantity > 1
    ? spacing * scale / (2 * Math.sin(Math.PI / quantity))
    : 0;
  const groupWidth = layout === "circle"
    ? 2 * (radius + 16 * scale)
    : layout === "horizontal"
      ? (32 + spacing * (quantity - 1)) * scale
      : 32 * scale;
  const groupHeight = layout === "circle"
    ? groupWidth
    : layout === "horizontal"
      ? 32 * scale
      : (32 + spacing * (quantity - 1)) * scale;
  const centerX = Math.max(viewportLeft + groupWidth / 2, Math.min(viewportRight - groupWidth / 2, visibleCenterX));
  const centerY = Math.max(viewportTop + groupHeight / 2, Math.min(viewportBottom - groupHeight / 2, visibleCenterY));
  const firstId = nextId;

  for (let index = 0; index < quantity; index += 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / quantity;
    const symbolCenterX = layout === "circle"
      ? centerX + radius * Math.cos(angle)
      : layout === "horizontal"
        ? centerX + (index - (quantity - 1) / 2) * spacing * scale
        : centerX;
    const symbolCenterY = layout === "circle"
      ? centerY + radius * Math.sin(angle)
      : layout === "horizontal"
        ? centerY
        : centerY + (index - (quantity - 1) / 2) * spacing * scale;
    symbols.push({
      id: nextId++,
      type: activeStitch,
      color: activeColor,
      scale,
      x: symbolCenterX - 16,
      y: symbolCenterY - 16,
      rotation: layout === "circle" && quantity > 1 ? (angle * 180) / Math.PI : 0
    });
  }

  selectedIds = new Set(Array.from({ length: quantity }, (_, index) => firstId + index));
  renderSymbols();
  markProjectDirty();
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
  if (multiSelectMode && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    renderSymbols();
    return;
  }
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
    hasMoved: false,
    originals: selected.map((symbol) => ({ id: symbol.id, x: symbol.x, y: symbol.y }))
  };
  canvasSurface.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const deltaX = (event.clientX - dragState.startX) / zoom;
  const deltaY = (event.clientY - dragState.startY) / zoom;
  if (deltaX !== 0 || deltaY !== 0) dragState.hasMoved = true;
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
    if (dragState.hasMoved) markProjectDirty();
    dragState = null;
  }
}

function rotateSelected(amount) {
  for (const symbol of symbols) {
    if (selectedIds.has(symbol.id)) symbol.rotation = (symbol.rotation + amount) % 360;
  }
  renderSymbols();
  if (selectedIds.size) markProjectDirty();
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

  const curve = Number(bendInput.value);
  if (arrangementInput.value === "circle") {
    const centerX = bendOrigins.reduce((sum, origin) => sum + origin.x, 0) / bendOrigins.length;
    const centerY = bendOrigins.reduce((sum, origin) => sum + origin.y, 0) / bendOrigins.length;
    const averageRadius = bendOrigins.reduce((sum, origin) => (
      sum + Math.hypot(origin.x - centerX, origin.y - centerY)
    ), 0) / bendOrigins.length;
    const defaultRadius = 38 / (2 * Math.sin(Math.PI / bendOrigins.length));
    const radius = Math.max(0, (averageRadius || defaultRadius) + curve * 2);
    bendOrigins.forEach((origin, index) => {
      const symbol = getSymbolById(origin.id);
      if (!symbol) return;
      const dx = origin.x - centerX;
      const dy = origin.y - centerY;
      const angle = dx === 0 && dy === 0
        ? -Math.PI / 2 + (2 * Math.PI * index) / bendOrigins.length
        : Math.atan2(dy, dx);
      symbol.x = Math.max(0, Math.min(1768, centerX + radius * Math.cos(angle)));
      symbol.y = Math.max(0, Math.min(968, centerY + radius * Math.sin(angle)));
      symbol.rotation = (angle * 180) / Math.PI;
    });
  } else {
    const isVertical = arrangementInput.value === "vertical";
    const positions = bendOrigins.map((origin) => isVertical ? origin.y : origin.x);
    const minPosition = Math.min(...positions);
    const maxPosition = Math.max(...positions);
    bendOrigins.forEach((origin, index) => {
      const symbol = getSymbolById(origin.id);
      if (!symbol) return;
      const position = isVertical ? origin.y : origin.x;
      const t = maxPosition > minPosition
        ? (position - minPosition) / (maxPosition - minPosition)
        : index / (bendOrigins.length - 1);
      const offset = curve * 4 * t * (1 - t);
      if (isVertical) {
        symbol.x = Math.max(0, Math.min(1768, origin.x + offset));
      } else {
        symbol.y = Math.max(0, Math.min(968, origin.y + offset));
      }
    });
  }
  renderSymbols();
  markProjectDirty();
}

function deleteSelected() {
  symbols = symbols.filter((symbol) => !selectedIds.has(symbol.id));
  selectedIds.clear();
  bendOrigins = null;
  renderSymbols();
  markProjectDirty();
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
  markProjectDirty();
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
    const color = symbolColors[symbol.color || "black"];
    return `<g color="${color}" stroke="${color}" transform="translate(${x} ${y}) rotate(${symbol.rotation}) scale(${symbol.scale || 1}) translate(-24 -24)">${stitchDefinitions[symbol.type].paths.join("")}</g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1000" viewBox="0 0 1800 1000"><g fill="none" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">${grid}${contents}</g></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = (projectName.trim() || "我的編織織圖").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
  link.download = `${fileName}.svg`;
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

document.querySelector("#colorPicker").addEventListener("click", (event) => {
  const option = event.target.closest("[data-color]");
  if (!option) return;
  activeColor = option.dataset.color;
  document.querySelectorAll(".color-option").forEach((button) => {
    const active = button === option;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (selectedIds.size === 0) return;
  for (const symbol of symbols) {
    if (selectedIds.has(symbol.id)) symbol.color = activeColor;
  }
  renderSymbols();
  markProjectDirty();
});

document.querySelector("#addButton").addEventListener("click", addSymbols);
document.querySelector("#composerToggle").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const expanded = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(expanded));
  document.querySelector("#composerBody").hidden = !expanded;
  document.querySelector("#composerToggleLabel").textContent = expanded ? "收合" : "展開";
  document.querySelector("#composerToggleIcon").textContent = expanded ? "⌄" : "⌃";
  button.setAttribute("aria-label", expanded ? "收合鉤針符號面板" : "展開鉤針符號面板");
});
projectNameInput.addEventListener("input", () => {
  projectName = projectNameInput.value;
  markProjectDirty();
});
document.querySelector("#saveButton").addEventListener("click", saveCurrentProject);
document.querySelector("#libraryButton").addEventListener("click", () => {
  renderLibrary();
  libraryDialog.showModal();
});
document.querySelector("#closeLibraryButton").addEventListener("click", () => libraryDialog.close());
multiSelectToggle.addEventListener("click", () => {
  multiSelectMode = !multiSelectMode;
  multiSelectToggle.setAttribute("aria-pressed", String(multiSelectMode));
  multiSelectToggle.textContent = multiSelectMode ? "完成多選" : "點選多選";
  multiSelectToggle.setAttribute("aria-label", multiSelectMode ? "關閉點選多選模式" : "開啟點選多選模式");
});
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
arrangementInput.addEventListener("change", () => {
  bendOrigins = null;
  updateSelectionTools();
});
bendInput.addEventListener("pointerdown", captureBendOrigins);
bendInput.addEventListener("input", bendSelected);
bendInput.addEventListener("change", () => { bendOrigins = null; });
document.querySelector("#deleteButton").addEventListener("click", deleteSelected);
document.querySelector("#duplicateButton").addEventListener("click", duplicateSelected);
document.querySelector("#gridToggle").addEventListener("change", (event) => {
  canvasSurface.classList.toggle("grid-on", event.target.checked);
  markProjectDirty();
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
  markProjectDirty();
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
