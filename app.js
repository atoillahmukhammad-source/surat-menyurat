"use strict";

/* =========================================================
   SURAT MENYURAT AI
   Draft + TTD + Multi Image Layer + Payment
   Robust drag / resize / delete
========================================================= */

const $ = id => document.getElementById(id);

/* =========================================================
   DOM
========================================================= */

const output = $("output");
const preview = $("suratPreview");
const statusBox = $("status");

const generateBtn = $("generateBtn");
const regenerateBtn = $("regenerateBtn");

const copyBtn = $("copyBtn");
const editBtn = $("editBtn");
const printBtn = $("printBtn");

const signaturePad = $("signaturePad");
const clearSignatureBtn = $("clearSignatureBtn");
const addSignatureBtn = $("addSignatureBtn");

const imageUpload = $("imageUpload");

const sendBackwardBtn = $("sendLayerBackwardBtn");
const bringForwardBtn = $("bringLayerForwardBtn");
const deleteLayerBtn = $("deleteSelectedLayerBtn");

const paymentModal = $("paymentInfoModal");
const printModal = $("printModal");

const continuePaymentBtn = $("continuePaymentBtn");

const wordBtn = $("wordBtn");
const pdfBtn = $("pdfBtn");

/* =========================================================
   KONSTANTA
========================================================= */

const STORAGE_KEY = "surat_editor_v5";

const PLACEHOLDER_TEXT =
  "Hasil surat akan muncul di sini...";

const PLACEHOLDER_FULL =
`Hasil surat akan muncul di sini...

Sudah punya draft sendiri? Hapus teks ini lalu tempelkan naskah surat Anda langsung di area ini.`;

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/*
  Layer gambar menggunakan z-index mulai 20.
  Teks pada index.html memiliki z-index 10.

  Jadi gambar tetap bisa diklik dengan stabil.
*/
const LAYER_Z_BASE = 20;

/* =========================================================
   STATE
========================================================= */

let layers = [];

let selectedId = null;

let draftId = null;
let draftSource = null;

let currentOrderId = null;
let paidOrderId = null;

let restoring = false;
let busy = false;

let signatureHasInk = false;

/*
  Interaction global:
  jauh lebih stabil daripada memasang pointermove
  hanya di elemen layer.
*/
let interaction = null;

/* =========================================================
   STYLE TAMBAHAN EDITOR
   Tidak perlu ubah index.html
========================================================= */

function installEditorStyles() {
  const style = document.createElement("style");

  style.textContent = `
    .editor-layer {
      position: absolute;
      user-select: none;
      touch-action: none;
      cursor: grab;
      box-sizing: border-box;
    }

    .editor-layer:active {
      cursor: grabbing;
    }

    .editor-layer img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
    }

    .editor-layer.layer-selected {
      outline: 2px dashed #2563eb;
      outline-offset: 2px;
    }

    .editor-layer .resize-handle {
      position: absolute;

      right: -14px;
      bottom: -14px;

      width: 30px;
      height: 30px;

      border-radius: 999px;

      background: #2563eb;
      border: 3px solid white;

      box-shadow:
        0 2px 8px rgba(0,0,0,.30);

      cursor: nwse-resize;

      touch-action: none;

      z-index: 10000;
    }

    .editor-layer .delete-layer {
      position: absolute;

      right: -15px;
      top: -15px;

      width: 32px;
      height: 32px;

      border: 0;
      border-radius: 999px;

      background: #dc2626;
      color: white;

      font-size: 21px;
      font-weight: 500;
      line-height: 1;

      display: flex;
      align-items: center;
      justify-content: center;

      cursor: pointer;

      box-shadow:
        0 2px 8px rgba(0,0,0,.30);

      touch-action: manipulation;

      z-index: 10001;
    }

    .editor-layer:not(.layer-selected)
    .resize-handle,

    .editor-layer:not(.layer-selected)
    .delete-layer {
      display: none;
    }

    @media (max-width: 768px) {

      .editor-layer .resize-handle {
        width: 34px;
        height: 34px;

        right: -17px;
        bottom: -17px;
      }

      .editor-layer .delete-layer {
        width: 36px;
        height: 36px;

        right: -18px;
        top: -18px;

        font-size: 23px;
      }
    }

    @media print {

      .editor-layer {
        outline: none !important;
      }

      .resize-handle,
      .delete-layer {
        display: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}

installEditorStyles();

/* =========================================================
   UTILITAS
========================================================= */

function showStatus(message, type = "info") {
  if (!statusBox) return;

  const colors = {
    info: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700"
  };

  statusBox.className =
    "mt-4 p-3 rounded-lg text-sm " +
    (colors[type] || colors.info);

  statusBox.textContent = message;
}

function openModal(element) {
  if (!element) return;

  element.classList.remove("hidden");
  element.classList.add("flex");
}

function closeModal(element) {
  if (!element) return;

  element.classList.add("hidden");
  element.classList.remove("flex");
}

function newId() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

function getText() {
  return output.innerText.trim();
}

function isPlaceholderText(text) {
  const clean = String(text || "").trim();

  return (
    !clean ||
    clean === PLACEHOLDER_TEXT ||
    clean === PLACEHOLDER_FULL.trim() ||
    clean.startsWith(PLACEHOLDER_TEXT)
  );
}

function hasDraft() {
  return !isPlaceholderText(getText());
}

function escapeHtml(text) {
  return String(text)

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;");
}

function scaleFactor() {
  if (!preview.clientWidth) return 1;

  return preview.clientWidth / A4_WIDTH;
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function setBusy(value) {
  busy = value;

  if (!continuePaymentBtn) return;

  continuePaymentBtn.disabled = value;

  continuePaymentBtn.textContent =
    value
      ? "⏳ Menyiapkan..."
      : "Lanjut Cetak";
}

/* =========================================================
   DRAFT SESSION
========================================================= */

function createFreshDraftSession(source = "manual") {
  draftId = newId();

  draftSource = source;

  currentOrderId = null;
  paidOrderId = null;

  saveState();
}

function ensureManualDraftSession() {
  if (!hasDraft()) return;

  if (!draftId) {
    createFreshDraftSession("manual");
  }

  if (!draftSource) {
    draftSource = "manual";

    saveState();
  }
}

/* =========================================================
   SAVE / RESTORE
========================================================= */

function saveState() {
  if (restoring) return;

  const state = {
    draftId,
    draftSource,

    text: getText(),

    layers,

    currentOrderId,
    paidOrderId,

    form: {
      jenis:
        $("jenis")?.value || "",

      nama:
        $("nama")?.value || "",

      penerima:
        $("penerima")?.value || "",

      detail:
        $("detail")?.value || ""
    }
  };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

  } catch (error) {
    console.warn(
      "Local storage penuh:",
      error
    );

    showStatus(
      "Penyimpanan browser penuh. Gunakan gambar dengan ukuran file lebih kecil.",
      "error"
    );
  }
}

function restoreState() {
  const raw =
    localStorage.getItem(
      STORAGE_KEY
    );

  if (!raw) return;

  try {
    restoring = true;

    const state =
      JSON.parse(raw);

    draftId =
      state.draftId || null;

    draftSource =
      state.draftSource || null;

    currentOrderId =
      state.currentOrderId || null;

    paidOrderId =
      state.paidOrderId || null;

    if (
      state.text &&
      !isPlaceholderText(
        state.text
      )
    ) {
      output.textContent =
        state.text;
    }

    const form =
      state.form || {};

    [
      "jenis",
      "nama",
      "penerima",
      "detail"
    ].forEach(id => {

      if (
        $(id) &&
        form[id] !== undefined
      ) {
        $(id).value =
          form[id];
      }

    });

    layers =
      Array.isArray(state.layers)
        ? state.layers
        : [];

  } catch (error) {
    console.error(
      "Restore gagal:",
      error
    );

  } finally {
    restoring = false;
  }
}

/* =========================================================
   GENERATE SURAT
========================================================= */

async function generateSurat() {
  const jenis =
    $("jenis").value;

  const nama =
    $("nama").value.trim();

  const penerima =
    $("penerima").value.trim();

  const detail =
    $("detail").value.trim();

  if (
    !nama ||
    !penerima ||
    !detail
  ) {
    showStatus(
      "Lengkapi nama, penerima, dan rincian surat.",
      "error"
    );

    return;
  }

  generateBtn.disabled = true;
  regenerateBtn.disabled = true;

  generateBtn.textContent =
    "⏳ Menyusun surat...";

  try {

    const response =
      await fetch(
        "/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              jenis,
              nama,
              penerima,
              detail
            })
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.result
    ) {
      throw new Error(
        data.error ||
        "Gagal membuat surat."
      );
    }

    /*
      Generate lagi =
      draft baru =
      pembayaran baru.
    */

    createFreshDraftSession(
      "ai"
    );

    layers = [];

    selectedId = null;

    output.textContent =
      data.result.trim();

    renderLayers();

    saveState();

    showStatus(
      "Draft baru berhasil dibuat.",
      "success"
    );

  } catch (error) {

    console.error(error);

    showStatus(
      error.message ||
      "Terjadi kesalahan.",
      "error"
    );

  } finally {

    generateBtn.disabled = false;

    regenerateBtn.disabled = false;

    generateBtn.textContent =
      "✨ Buat Draft Surat";
  }
}

generateBtn.addEventListener(
  "click",
  generateSurat
);

regenerateBtn.addEventListener(
  "click",
  generateSurat
);

/* =========================================================
   EDIT TEKS
========================================================= */

let editTimer = null;

output.addEventListener(
  "input",
  () => {

    clearTimeout(editTimer);

    editTimer =
      setTimeout(
        () => {

          ensureManualDraftSession();

          saveState();

        },
        400
      );
  }
);

output.addEventListener(
  "paste",
  () => {

    setTimeout(
      () => {

        ensureManualDraftSession();

        saveState();

      },
      50
    );
  }
);

editBtn.addEventListener(
  "click",
  () => {

    const editing =
      output.getAttribute(
        "contenteditable"
      ) === "true";

    if (editing) {

      output.setAttribute(
        "contenteditable",
        "false"
      );

      editBtn.textContent =
        "✏️ Edit";

      output.classList.remove(
        "ring-2",
        "ring-blue-300"
      );

      saveState();

    } else {

      output.setAttribute(
        "contenteditable",
        "true"
      );

      editBtn.textContent =
        "💾 Selesai Edit";

      output.classList.add(
        "ring-2",
        "ring-blue-300"
      );

      output.focus();
    }
  }
);

copyBtn.addEventListener(
  "click",
  async () => {

    if (!hasDraft()) {

      showStatus(
        "Belum ada surat untuk disalin.",
        "error"
      );

      return;
    }

    try {

      await navigator.clipboard
        .writeText(
          getText()
        );

      showStatus(
        "Teks berhasil disalin.",
        "success"
      );

    } catch {

      showStatus(
        "Gagal menyalin teks.",
        "error"
      );
    }
  }
);

/* =========================================================
   SIGNATURE CANVAS
========================================================= */

const ctx =
  signaturePad.getContext(
    "2d"
  );

ctx.lineWidth = 3;

ctx.lineCap =
  "round";

ctx.lineJoin =
  "round";

ctx.strokeStyle =
  "#111827";

let drawing = false;
let lastPoint = null;

function canvasPoint(event) {

  const rect =
    signaturePad
      .getBoundingClientRect();

  return {

    x:
      (
        event.clientX -
        rect.left
      ) *
      signaturePad.width /
      rect.width,

    y:
      (
        event.clientY -
        rect.top
      ) *
      signaturePad.height /
      rect.height
  };
}

signaturePad.addEventListener(
  "pointerdown",
  event => {

    event.preventDefault();

    drawing = true;

    signatureHasInk = true;

    lastPoint =
      canvasPoint(event);

    try {
      signaturePad
        .setPointerCapture(
          event.pointerId
        );
    } catch {}

    ctx.beginPath();

    ctx.arc(
      lastPoint.x,
      lastPoint.y,
      1.5,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#111827";

    ctx.fill();
  }
);

signaturePad.addEventListener(
  "pointermove",
  event => {

    if (!drawing) return;

    event.preventDefault();

    const point =
      canvasPoint(event);

    ctx.beginPath();

    ctx.moveTo(
      lastPoint.x,
      lastPoint.y
    );

    ctx.lineTo(
      point.x,
      point.y
    );

    ctx.stroke();

    lastPoint = point;
  }
);

function stopSignatureDrawing() {
  drawing = false;

  lastPoint = null;
}

signaturePad.addEventListener(
  "pointerup",
  stopSignatureDrawing
);

signaturePad.addEventListener(
  "pointercancel",
  stopSignatureDrawing
);

clearSignatureBtn.addEventListener(
  "click",
  () => {

    ctx.clearRect(
      0,
      0,
      signaturePad.width,
      signaturePad.height
    );

    signatureHasInk = false;

    showStatus(
      "Papan tanda tangan dibersihkan."
    );
  }
);

/* =========================================================
   CROP SIGNATURE
========================================================= */

function trimTransparentCanvas(canvas) {

  const context =
    canvas.getContext("2d");

  const image =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

  const data =
    image.data;

  let minX =
    canvas.width;

  let minY =
    canvas.height;

  let maxX = -1;
  let maxY = -1;

  for (
    let y = 0;
    y < canvas.height;
    y++
  ) {

    for (
      let x = 0;
      x < canvas.width;
      x++
    ) {

      const alpha =
        data[
          (
            y *
            canvas.width +
            x
          ) *
          4 +
          3
        ];

      if (alpha > 0) {

        minX =
          Math.min(
            minX,
            x
          );

        minY =
          Math.min(
            minY,
            y
          );

        maxX =
          Math.max(
            maxX,
            x
          );

        maxY =
          Math.max(
            maxY,
            y
          );
      }
    }
  }

  if (maxX < 0) {
    return null;
  }

  const padding = 12;

  minX =
    Math.max(
      0,
      minX - padding
    );

  minY =
    Math.max(
      0,
      minY - padding
    );

  maxX =
    Math.min(
      canvas.width - 1,
      maxX + padding
    );

  maxY =
    Math.min(
      canvas.height - 1,
      maxY + padding
    );

  const width =
    maxX - minX + 1;

  const height =
    maxY - minY + 1;

  const cropped =
    document.createElement(
      "canvas"
    );

  cropped.width =
    width;

  cropped.height =
    height;

  cropped
    .getContext("2d")
    .drawImage(
      canvas,

      minX,
      minY,
      width,
      height,

      0,
      0,
      width,
      height
    );

  return {

    src:
      cropped.toDataURL(
        "image/png"
      ),

    ratio:
      width / height
  };
}

/* =========================================================
   ADD SIGNATURE
========================================================= */

addSignatureBtn.addEventListener(
  "click",
  () => {

    if (!hasDraft()) {

      showStatus(
        "Buat atau masukkan draft surat terlebih dahulu.",
        "error"
      );

      return;
    }

    if (!signatureHasInk) {

      showStatus(
        "Gambar tanda tangan terlebih dahulu.",
        "error"
      );

      return;
    }

    ensureManualDraftSession();

    const result =
      trimTransparentCanvas(
        signaturePad
      );

    if (!result) return;

    addLayer({

      src:
        result.src,

      name:
        "Tanda tangan",

      type:
        "signature",

      ratio:
        result.ratio,

      width:
        155,

      x:
        430,

      y:
        820

    });

    showStatus(
      "Tanda tangan ditambahkan. Klik tanda tangan untuk mengatur posisi atau ukurannya.",
      "success"
    );
  }
);

/* =========================================================
   UPLOAD IMAGE
========================================================= */

imageUpload.addEventListener(
  "change",
  async event => {

    if (!hasDraft()) {

      showStatus(
        "Buat atau masukkan draft surat terlebih dahulu.",
        "error"
      );

      imageUpload.value = "";

      return;
    }

    ensureManualDraftSession();

    const files =
      Array.from(
        event.target.files || []
      );

    for (
      const file of files
    ) {

      if (
        ![
          "image/png",
          "image/jpeg",
          "image/webp"
        ].includes(
          file.type
        )
      ) {

        showStatus(
          "Gunakan PNG, JPG, atau WebP.",
          "error"
        );

        continue;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {

        showStatus(
          "Ukuran gambar maksimal 5 MB.",
          "error"
        );

        continue;
      }

      try {

        const src =
          await readImage(
            file
          );

        const dimensions =
          await getImageDimensions(
            src
          );

        addLayer({

          src,

          name:
            file.name,

          type:
            "image",

          ratio:
            dimensions.width /
            dimensions.height,

          width:
            200,

          x:
            70,

          y:
            70

        });

      } catch (error) {

        console.error(error);

        showStatus(
          "Gagal membaca gambar.",
          "error"
        );
      }
    }

    imageUpload.value = "";
  }
);

function readImage(file) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            reader.result
          );

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}

function getImageDimensions(src) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const img =
        new Image();

      img.onload =
        () => {

          resolve({

            width:
              img.naturalWidth,

            height:
              img.naturalHeight

          });
        };

      img.onerror =
        reject;

      img.src =
        src;
    }
  );
}

/* =========================================================
   LAYER
========================================================= */

function normalizeLayerOrder() {

  const sorted =
    [...layers]
      .sort(
        (a, b) =>
          (a.z || 0) -
          (b.z || 0)
      );

  sorted.forEach(
    (
      layer,
      index
    ) => {

      layer.z =
        index + 1;
    }
  );
}

function addLayer(config) {

  ensureManualDraftSession();

  normalizeLayerOrder();

  const maxZ =
    layers.length
      ? Math.max(
          ...layers.map(
            item =>
              item.z || 1
          )
        )
      : 0;

  const layer = {

    id:
      newId(),

    name:
      config.name ||
      "Gambar",

    type:
      config.type ||
      "image",

    src:
      config.src,

    x:
      Number(
        config.x || 0
      ),

    y:
      Number(
        config.y || 0
      ),

    width:
      Number(
        config.width || 150
      ),

    ratio:
      Number(
        config.ratio || 1
      ),

    z:
      maxZ + 1

  };

  layers.push(layer);

  selectedId =
    layer.id;

  renderLayers();

  saveState();
}

function getLayer(id) {

  return layers.find(
    layer =>
      layer.id === id
  );
}

function getSelectedLayer() {

  if (!selectedId) {
    return null;
  }

  return getLayer(
    selectedId
  );
}

/* =========================================================
   RENDER LAYERS
========================================================= */

function renderLayers() {

  preview
    .querySelectorAll(
      ".editor-layer"
    )
    .forEach(
      element =>
        element.remove()
    );

  normalizeLayerOrder();

  const scale =
    scaleFactor();

  layers.forEach(
    layer => {

      const element =
        document.createElement(
          "div"
        );

      element.className =
        "editor-layer";

      element.dataset.layerId =
        layer.id;

      if (
        selectedId ===
        layer.id
      ) {

        element.classList.add(
          "layer-selected"
        );
      }

      element.style.left =
        `${layer.x * scale}px`;

      element.style.top =
        `${layer.y * scale}px`;

      element.style.width =
        `${layer.width * scale}px`;

      element.style.height =
        `${
          (
            layer.width /
            layer.ratio
          ) *
          scale
        }px`;

      /*
        Semua gambar berada di atas text,
        supaya selalu bisa dipilih.

        Order antar gambar tetap mengikuti layer.z.
      */
      element.style.zIndex =
        String(
          LAYER_Z_BASE +
          layer.z
        );

      element.title =
        "Klik untuk memilih. Geser untuk memindahkan.";

      const img =
        document.createElement(
          "img"
        );

      img.src =
        layer.src;

      img.alt =
        layer.name || "";

      img.draggable =
        false;

      element.appendChild(
        img
      );

      const resize =
        document.createElement(
          "div"
        );

      resize.className =
        "resize-handle";

      resize.title =
        "Tarik untuk memperbesar / memperkecil";

      element.appendChild(
        resize
      );

      const remove =
        document.createElement(
          "button"
        );

      remove.type =
        "button";

      remove.className =
        "delete-layer";

      remove.innerHTML =
        "&times;";

      remove.title =
        "Hapus gambar";

      element.appendChild(
        remove
      );

      preview.appendChild(
        element
      );

      attachLayerEvents(
        element,
        layer,
        resize,
        remove
      );
    }
  );
}

/* =========================================================
   SELECT
========================================================= */

function selectLayer(id) {

  selectedId = id;

  renderLayers();
}

/* =========================================================
   DRAG / RESIZE
   GLOBAL POINTER SYSTEM
========================================================= */

function attachLayerEvents(
  element,
  layer,
  resizeHandle,
  deleteButton
) {

  /*
    SELECT + DRAG
  */

  element.addEventListener(
    "pointerdown",
    event => {

      if (
        event.target ===
        resizeHandle
      ) {
        return;
      }

      if (
        event.target ===
        deleteButton
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      selectedId =
        layer.id;

      document
        .querySelectorAll(
          ".editor-layer"
        )
        .forEach(el => {

          el.classList.remove(
            "layer-selected"
          );

        });

      element.classList.add(
        "layer-selected"
      );

      const scale =
        scaleFactor();

      interaction = {

        mode:
          "drag",

        layerId:
          layer.id,

        pointerId:
          event.pointerId,

        startClientX:
          event.clientX,

        startClientY:
          event.clientY,

        startX:
          layer.x,

        startY:
          layer.y,

        scale

      };
    }
  );

  /*
    RESIZE
  */

  resizeHandle.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();
      event.stopPropagation();

      selectedId =
        layer.id;

      const scale =
        scaleFactor();

      interaction = {

        mode:
          "resize",

        layerId:
          layer.id,

        pointerId:
          event.pointerId,

        startClientX:
          event.clientX,

        startWidth:
          layer.width,

        scale

      };
    }
  );

  /*
    DELETE
  */

  deleteButton.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();
      event.stopPropagation();
    }
  );

  deleteButton.addEventListener(
    "click",
    event => {

      event.preventDefault();
      event.stopPropagation();

      deleteLayer(
        layer.id
      );
    }
  );
}

/* =========================================================
   GLOBAL MOVE
========================================================= */

document.addEventListener(
  "pointermove",
  event => {

    if (!interaction) {
      return;
    }

    if (
      interaction.pointerId !==
      event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    const layer =
      getLayer(
        interaction.layerId
      );

    if (!layer) {
      interaction = null;
      return;
    }

    const scale =
      interaction.scale ||
      scaleFactor();

    if (
      interaction.mode ===
      "drag"
    ) {

      const dx =
        (
          event.clientX -
          interaction.startClientX
        ) /
        scale;

      const dy =
        (
          event.clientY -
          interaction.startClientY
        ) /
        scale;

      const height =
        layer.width /
        layer.ratio;

      layer.x =
        clamp(
          interaction.startX +
          dx,
          0,
          Math.max(
            0,
            A4_WIDTH -
            layer.width
          )
        );

      layer.y =
        clamp(
          interaction.startY +
          dy,
          0,
          Math.max(
            0,
            A4_HEIGHT -
            height
          )
        );

    }

    if (
      interaction.mode ===
      "resize"
    ) {

      const dx =
        (
          event.clientX -
          interaction.startClientX
        ) /
        scale;

      let width =
        interaction.startWidth +
        dx;

      const minWidth =
        40;

      const maxWidthByPage =
        A4_WIDTH -
        layer.x;

      const maxWidthByHeight =
        (
          A4_HEIGHT -
          layer.y
        ) *
        layer.ratio;

      const maxWidth =
        Math.max(
          minWidth,
          Math.min(
            maxWidthByPage,
            maxWidthByHeight
          )
        );

      width =
        clamp(
          width,
          minWidth,
          maxWidth
        );

      layer.width =
        width;
    }

    /*
      Update langsung tanpa rebuild DOM.
      Ini membuat drag lebih mulus.
    */

    updateLayerElement(
      layer
    );
  },
  {
    passive: false
  }
);

/* =========================================================
   GLOBAL END
========================================================= */

function finishInteraction(
  event
) {

  if (!interaction) {
    return;
  }

  if (
    event &&
    event.pointerId !==
    interaction.pointerId
  ) {
    return;
  }

  interaction = null;

  saveState();

  renderLayers();
}

document.addEventListener(
  "pointerup",
  finishInteraction
);

document.addEventListener(
  "pointercancel",
  finishInteraction
);

/* =========================================================
   UPDATE ONLY ONE ELEMENT
========================================================= */

function updateLayerElement(
  layer
) {

  const element =
    preview.querySelector(
      `[data-layer-id="${layer.id}"]`
    );

  if (!element) return;

  const scale =
    scaleFactor();

  element.style.left =
    `${layer.x * scale}px`;

  element.style.top =
    `${layer.y * scale}px`;

  element.style.width =
    `${layer.width * scale}px`;

  element.style.height =
    `${
      (
        layer.width /
        layer.ratio
      ) *
      scale
    }px`;
}

/* =========================================================
   DELETE
========================================================= */

function deleteLayer(id) {

  layers =
    layers.filter(
      layer =>
        layer.id !== id
    );

  if (
    selectedId === id
  ) {
    selectedId = null;
  }

  interaction = null;

  normalizeLayerOrder();

  renderLayers();

  saveState();

  showStatus(
    "Layer berhasil dihapus.",
    "success"
  );
}

deleteLayerBtn.addEventListener(
  "click",
  () => {

    if (!selectedId) {

      showStatus(
        "Klik gambar atau tanda tangan yang ingin dihapus terlebih dahulu.",
        "error"
      );

      return;
    }

    deleteLayer(
      selectedId
    );
  }
);

/* =========================================================
   BRING FORWARD
========================================================= */

bringForwardBtn.addEventListener(
  "click",
  () => {

    const layer =
      getSelectedLayer();

    if (!layer) {

      showStatus(
        "Pilih gambar atau tanda tangan terlebih dahulu.",
        "error"
      );

      return;
    }

    normalizeLayerOrder();

    const maxZ =
      Math.max(
        ...layers.map(
          item =>
            item.z
        )
      );

    if (
      layer.z < maxZ
    ) {

      const other =
        layers.find(
          item =>
            item.z ===
            layer.z + 1
        );

      if (other) {
        other.z--;
      }

      layer.z++;
    }

    renderLayers();

    saveState();
  }
);

/* =========================================================
   SEND BACKWARD
========================================================= */

sendBackwardBtn.addEventListener(
  "click",
  () => {

    const layer =
      getSelectedLayer();

    if (!layer) {

      showStatus(
        "Pilih gambar atau tanda tangan terlebih dahulu.",
        "error"
      );

      return;
    }

    normalizeLayerOrder();

    if (
      layer.z > 1
    ) {

      const other =
        layers.find(
          item =>
            item.z ===
            layer.z - 1
        );

      if (other) {
        other.z++;
      }

      layer.z--;
    }

    renderLayers();

    saveState();
  }
);

/* =========================================================
   DESELECT
========================================================= */

preview.addEventListener(
  "pointerdown",
  event => {

    /*
      Bila yang diklik bukan layer,
      layer tidak langsung dihapus.

      Hanya selection yang dilepas.
    */

    if (
      event.target.closest(
        ".editor-layer"
      )
    ) {
      return;
    }

    selectedId = null;

    renderLayers();
  }
);

/* =========================================================
   PEMBAYARAN
========================================================= */

async function getPaymentData(
  orderId
) {

  const response =
    await fetch(
      `/api/get-payment?order_id=${
        encodeURIComponent(
          orderId
        )
      }`,
      {
        cache: "no-store"
      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data.error ||
      "Gagal memeriksa pembayaran."
    );
  }

  return data;
}

async function verifyPayment(
  orderId
) {

  if (!orderId) {
    return false;
  }

  const data =
    await getPaymentData(
      orderId
    );

  const isPaid =
    [
      "settlement",
      "capture"
    ].includes(
      data.payment_status
    );

  if (!isPaid) {
    return false;
  }

  /*
    Bila backend sudah memiliki draft_id,
    cocokkan draft.
  */

  if (
    data.draft_id &&
    draftId &&
    data.draft_id !==
      draftId
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   CETAK
========================================================= */

printBtn.addEventListener(
  "click",
  async () => {

    if (!hasDraft()) {

      showStatus(
        "Buat atau masukkan draft surat terlebih dahulu.",
        "error"
      );

      return;
    }

    ensureManualDraftSession();

    saveState();

    if (
      paidOrderId
    ) {

      try {

        const paid =
          await verifyPayment(
            paidOrderId
          );

        if (paid) {

          openModal(
            printModal
          );

          return;
        }

      } catch (error) {

        console.warn(
          "Verifikasi pembayaran:",
          error
        );
      }
    }

    openModal(
      paymentModal
    );
  }
);

/* =========================================================
   PAYMENT MODAL
========================================================= */

$("closePaymentInfoModal")
  ?.addEventListener(
    "click",
    () => {

      closeModal(
        paymentModal
      );
    }
  );

$("cancelPaymentBtn")
  ?.addEventListener(
    "click",
    () => {

      closeModal(
        paymentModal
      );
    }
  );

paymentModal?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      paymentModal
    ) {

      closeModal(
        paymentModal
      );
    }
  }
);

/* =========================================================
   CREATE PAYMENT
========================================================= */

continuePaymentBtn.addEventListener(
  "click",
  async () => {

    if (busy) return;

    if (!hasDraft()) {

      showStatus(
        "Draft belum tersedia.",
        "error"
      );

      return;
    }

    ensureManualDraftSession();

    setBusy(true);

    try {

      saveState();

      const response =
        await fetch(
          "/api/create-payment",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                surat_text:
                  getText(),

                draft_id:
                  draftId

              })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Gagal membuat pembayaran."
        );
      }

      if (
        !data.redirect_url ||
        !data.order_id
      ) {

        throw new Error(
          "Data pembayaran tidak lengkap."
        );
      }

      currentOrderId =
        data.order_id;

      saveState();

      window.location.assign(
        data.redirect_url
      );

    } catch (error) {

      console.error(error);

      showStatus(
        error.message ||
        "Gagal membuat pembayaran.",
        "error"
      );

      setBusy(false);

      closeModal(
        paymentModal
      );
    }
  }
);

/* =========================================================
   RETURN MIDTRANS
========================================================= */

async function checkPaymentReturn() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const orderId =
    params.get(
      "order_id"
    ) ||
    currentOrderId;

  if (!orderId) {
    return;
  }

  try {

    const data =
      await getPaymentData(
        orderId
      );

    if (
      !hasDraft() &&
      data.surat_text
    ) {

      output.textContent =
        data.surat_text;
    }

    if (
      !draftId &&
      data.draft_id
    ) {

      draftId =
        data.draft_id;
    }

    const paid =
      [
        "settlement",
        "capture"
      ].includes(
        data.payment_status
      );

    if (paid) {

      if (
        data.draft_id &&
        draftId &&
        data.draft_id !==
          draftId
      ) {

        showStatus(
          "Transaksi berasal dari draft yang berbeda.",
          "error"
        );

        return;
      }

      paidOrderId =
        orderId;

      currentOrderId =
        orderId;

      saveState();

      openModal(
        printModal
      );

      showStatus(
        "Pembayaran berhasil diverifikasi. Word dan PDF sudah dapat digunakan.",
        "success"
      );

      if (
        window.history &&
        window.history.replaceState
      ) {

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }

      return;
    }

    if (
      params.has(
        "order_id"
      ) ||
      params.has(
        "transaction_status"
      )
    ) {

      showStatus(
        "Pembayaran belum terkonfirmasi. Tunggu beberapa saat lalu klik Cetak kembali.",
        "info"
      );
    }

  } catch (error) {

    console.error(error);

    showStatus(
      "Belum dapat memverifikasi pembayaran: " +
      error.message,
      "error"
    );
  }
}

/* =========================================================
   PRINT MODAL
========================================================= */

$("closePrintModal")
  ?.addEventListener(
    "click",
    () => {

      closeModal(
        printModal
      );
    }
  );

printModal?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      printModal
    ) {

      closeModal(
        printModal
      );
    }
  }
);

/* =========================================================
   PDF
========================================================= */

pdfBtn.addEventListener(
  "click",
  async () => {

    try {

      const paid =
        await verifyPayment(
          paidOrderId
        );

      if (!paid) {

        throw new Error(
          "Pembayaran untuk draft ini belum terverifikasi."
        );
      }

      closeModal(
        printModal
      );

      selectedId = null;

      renderLayers();

      window.print();

    } catch (error) {

      console.error(error);

      showStatus(
        error.message,
        "error"
      );
    }
  }
);

/* =========================================================
   WORD
========================================================= */

wordBtn.addEventListener(
  "click",
  async () => {

    try {

      const paid =
        await verifyPayment(
          paidOrderId
        );

      if (!paid) {

        throw new Error(
          "Pembayaran untuk draft ini belum terverifikasi."
        );
      }

      const layerHtml =
        layers
          .map(
            layer => {

              const left =
                layer.x /
                A4_WIDTH *
                210;

              const top =
                layer.y /
                A4_HEIGHT *
                297;

              const width =
                layer.width /
                A4_WIDTH *
                210;

              const height =
                (
                  layer.width /
                  layer.ratio
                ) /
                A4_HEIGHT *
                297;

              return `
                <div
                  style="
                    position:absolute;
                    left:${left}mm;
                    top:${top}mm;
                    width:${width}mm;
                    height:${height}mm;
                    z-index:${layer.z};
                  "
                >
                  <img
                    src="${layer.src}"
                    style="
                      width:100%;
                      height:100%;
                      object-fit:contain;
                    "
                  >
                </div>
              `;
            }
          )
          .join("");

      const paragraphs =
        getText()
          .split(/\n{2,}/)
          .map(
            part => {

              return `
                <p
                  style="
                    margin:0 0 12pt 0;
                    line-height:1.5;
                    text-align:justify;
                  "
                >
                  ${
                    escapeHtml(
                      part
                    )
                      .replace(
                        /\n/g,
                        "<br>"
                      )
                  }
                </p>
              `;
            }
          )
          .join("");

      const html = `
        <!DOCTYPE html>

        <html>

        <head>

          <meta charset="UTF-8">

          <style>

            @page {
              size: A4;
              margin: 20mm 22mm;
            }

            body {
              margin: 0;
              font-family:
                Arial,
                Helvetica,
                sans-serif;

              font-size: 11pt;
              line-height: 1.5;
            }

            .page {
              position: relative;
              width: 166mm;
              min-height: 257mm;
            }

          </style>

        </head>

        <body>

          <div class="page">

            ${paragraphs}

            ${layerHtml}

          </div>

        </body>

        </html>
      `;

      const blob =
        new Blob(
          [
            "\ufeff",
            html
          ],
          {
            type:
              "application/msword"
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        "surat.doc";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      setTimeout(
        () => {

          URL.revokeObjectURL(
            url
          );

        },
        1000
      );

      closeModal(
        printModal
      );

      showStatus(
        "Dokumen Word telah disiapkan.",
        "success"
      );

    } catch (error) {

      console.error(error);

      showStatus(
        error.message,
        "error"
      );
    }
  }
);

/* =========================================================
   RESPONSIVE
========================================================= */

let resizeTimer = null;

window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      resizeTimer
    );

    resizeTimer =
      setTimeout(
        () => {

          renderLayers();

        },
        100
      );
  }
);

/* =========================================================
   ESCAPE
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key !==
      "Escape"
    ) {
      return;
    }

    if (
      selectedId
    ) {

      selectedId = null;

      renderLayers();

      return;
    }

    closeModal(
      paymentModal
    );

    closeModal(
      printModal
    );
  }
);

/* =========================================================
   FORM AUTO SAVE
========================================================= */

[
  "jenis",
  "nama",
  "penerima",
  "detail"
].forEach(
  id => {

    const element =
      $(id);

    if (!element) return;

    element.addEventListener(
      "input",
      saveState
    );

    element.addEventListener(
      "change",
      saveState
    );
  }
);

/* =========================================================
   INIT
========================================================= */

restoreState();

renderLayers();

checkPaymentReturn();
