
"use strict";

/* ==========================================
   SURAT MENYURAT AI — APP.JS
   Editor multilayer + Midtrans
========================================== */

const $ = id => document.getElementById(id);

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

const STORAGE_KEY = "surat_editor_v3";

const PLACEHOLDER =
  "Hasil surat akan muncul di sini...";

let layers = [];
let selectedId = null;
let currentOrderId = null;
let paidOrderId = null;
let draftId = crypto.randomUUID();
let busy = false;
let restoring = false;
let signatureHasInk = false;

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/* ==========================================
   UTILITAS
========================================== */

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

function getText() {
  return output.innerText.trim();
}

function hasDraft() {
  const text = getText();

  return Boolean(
    text &&
    !text.startsWith(PLACEHOLDER) &&
    text !== "Surat belum berhasil dibuat." &&
    text !== "Sedang menyusun surat..."
  );
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function newId() {
  return crypto.randomUUID();
}

function setBusy(value) {
  busy = value;
  continuePaymentBtn.disabled = value;
  continuePaymentBtn.textContent =
    value ? "⏳ Menyiapkan..." : "Lanjut Cetak";
}

function saveState() {
  if (restoring) return;

  const state = {
    draftId,
    text: getText(),
    layers,
    currentOrderId,
    paidOrderId,
    form: {
      jenis: $("jenis").value,
      nama: $("nama").value,
      penerima: $("penerima").value,
      detail: $("detail").value
    }
  };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.warn("Penyimpanan lokal penuh:", error);
    showStatus(
      "Gambar terlalu besar untuk penyimpanan browser. " +
      "Gunakan gambar yang lebih kecil.",
      "error"
    );
  }
}

function resetPayment() {
  currentOrderId = null;
  paidOrderId = null;
  draftId = newId();
  saveState();
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    restoring = true;

    const state = JSON.parse(raw);

    draftId = state.draftId || newId();
    currentOrderId = state.currentOrderId || null;
    paidOrderId = state.paidOrderId || null;

    if (state.text) {
      output.textContent = state.text;
    }

    const form = state.form || {};

    for (const key of [
      "jenis", "nama", "penerima", "detail"
    ]) {
      if (form[key] !== undefined && $(key)) {
        $(key).value = form[key];
      }
    }

    layers = Array.isArray(state.layers)
      ? state.layers
      : [];

    renderLayers();

  } catch (error) {
    console.error("Restore gagal:", error);
  } finally {
    restoring = false;
  }
}

/* ==========================================
   GENERATE DENGAN AI
========================================== */

async function generateSurat() {
  const jenis = $("jenis").value;
  const nama = $("nama").value.trim();
  const penerima = $("penerima").value.trim();
  const detail = $("detail").value.trim();

  if (!nama || !penerima || !detail) {
    showStatus(
      "Lengkapi nama, penerima, dan rincian surat.",
      "error"
    );
    return;
  }

  generateBtn.disabled = true;
  regenerateBtn.disabled = true;
  generateBtn.textContent = "⏳ Menyusun surat...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jenis, nama, penerima, detail
      })
    });

    const data = await response.json();

    if (!response.ok || !data.result) {
      throw new Error(
        data.error || "Gagal membuat surat."
      );
    }

    // Reset hanya setelah AI berhasil.
    resetPayment();
    layers = [];
    selectedId = null;

    output.textContent = data.result.trim();
    renderLayers();
    saveState();

    showStatus(
      "Draft berhasil dibuat. Silakan edit atau tambahkan gambar.",
      "success"
    );

  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");

  } finally {
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
    generateBtn.textContent = "✨ Buat Draft Surat";
  }
}

generateBtn.addEventListener("click", generateSurat);
regenerateBtn.addEventListener("click", generateSurat);

/* ==========================================
   EDIT DRAFT SENDIRI
========================================== */

let editTimer = null;

output.addEventListener("input", () => {
  clearTimeout(editTimer);

  editTimer = setTimeout(() => {
    // Perubahan teks menjadi versi draft baru.
    // Tidak menghapus layer gambar.
    resetPayment();
    saveState();
  }, 500);
});

editBtn.addEventListener("click", () => {
  const editing =
    output.getAttribute("contenteditable") === "true";

  if (editing) {
    output.setAttribute("contenteditable", "false");
    editBtn.textContent = "✏️ Edit";
    output.classList.remove("ring-2", "ring-blue-300");
    saveState();
  } else {
    output.setAttribute("contenteditable", "true");
    editBtn.textContent = "💾 Selesai Edit";
    output.classList.add("ring-2", "ring-blue-300");
    output.focus();
  }
});

copyBtn.addEventListener("click", async () => {
  if (!hasDraft()) {
    showStatus("Belum ada surat untuk disalin.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(getText());
    showStatus("Teks berhasil disalin.", "success");
  } catch {
    showStatus("Gagal menyalin teks.", "error");
  }
});

/* ==========================================
   CANVAS TANDA TANGAN
========================================== */

const ctx = signaturePad.getContext("2d");

ctx.lineWidth = 3;
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = "#111827";

let drawing = false;
let lastPoint = null;

function canvasPoint(event) {
  const rect = signaturePad.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) *
       signaturePad.width / rect.width,
    y: (event.clientY - rect.top) *
       signaturePad.height / rect.height
  };
}

signaturePad.addEventListener("pointerdown", event => {
  event.preventDefault();
  drawing = true;
  signatureHasInk = true;

  lastPoint = canvasPoint(event);
  signaturePad.setPointerCapture(event.pointerId);

  // Titik awal, termasuk untuk tanda tangan berupa titik.
  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#111827";
  ctx.fill();
});

signaturePad.addEventListener("pointermove", event => {
  if (!drawing) return;

  const point = canvasPoint(event);

  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();

  lastPoint = point;
});

function stopDrawing() {
  drawing = false;
  lastPoint = null;
}

signaturePad.addEventListener("pointerup", stopDrawing);
signaturePad.addEventListener("pointercancel", stopDrawing);

clearSignatureBtn.addEventListener("click", () => {
  ctx.clearRect(
    0, 0, signaturePad.width, signaturePad.height
  );

  signatureHasInk = false;
  showStatus("Papan tanda tangan dibersihkan.");
});

function trimTransparentCanvas(canvas) {
  const context = canvas.getContext("2d");
  const image = context.getImageData(
    0, 0, canvas.width, canvas.height
  );

  const pixels = image.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha =
        pixels[(y * canvas.width + x) * 4 + 3];

      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) return null;

  const pad = 12;

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(canvas.width - 1, maxX + pad);
  maxY = Math.min(canvas.height - 1, maxY + pad);

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  const cropped = document.createElement("canvas");
  cropped.width = width;
  cropped.height = height;

  cropped.getContext("2d").drawImage(
    canvas,
    minX, minY, width, height,
    0, 0, width, height
  );

  return {
    src: cropped.toDataURL("image/png"),
    ratio: width / height
  };
}

addSignatureBtn.addEventListener("click", () => {
  if (!signatureHasInk) {
    showStatus(
      "Gambar tanda tangan terlebih dahulu.",
      "error"
    );
    return;
  }

  const result = trimTransparentCanvas(signaturePad);

  if (!result) return;

  addLayer({
    src: result.src,
    name: "Tanda tangan",
    type: "signature",
    ratio: result.ratio,
    width: 155,
    x: 420,
    y: 850
  });

  showStatus(
    "Tanda tangan ditambahkan. Geser atau ubah ukurannya.",
    "success"
  );
});

/* ==========================================
   UPLOAD GAMBAR
========================================== */

imageUpload.addEventListener("change", async event => {
  const files = Array.from(event.target.files || []);

  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp"]
      .includes(file.type)) {
      showStatus("Gunakan PNG, JPG, atau WebP.", "error");
      continue;
    }

    if (file.size > 5 * 1024 * 1024) {
      showStatus(
        "Ukuran gambar maksimal 5 MB.",
        "error"
      );
      continue;
    }

    try {
      const src = await readImage(file);
      const dimensions = await getImageDimensions(src);

      addLayer({
        src,
        name: file.name,
        type: "image",
        ratio: dimensions.width / dimensions.height,
        width: 200,
        x: 70,
        y: 70
      });

    } catch (error) {
      console.error(error);
      showStatus("Gagal membaca gambar.", "error");
    }
  }

  imageUpload.value = "";
});

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    img.onerror = reject;
    img.src = src;
  });
}

/* ==========================================
   SISTEM MULTILAYER
   Koordinat dalam ruang A4 794 x 1123
========================================== */

function addLayer(config) {
  const layer = {
    id: newId(),
    name: config.name,
    type: config.type,
    src: config.src,
    x: config.x,
    y: config.y,
    width: config.width,
    ratio: config.ratio,
    z: layers.length + 1
  };

  layers.push(layer);
  selectedId = layer.id;

  renderLayers();
  resetPayment();
}

function getSelectedLayer() {
  return layers.find(layer => layer.id === selectedId);
}

function scaleFactor() {
  return preview.clientWidth / A4_WIDTH;
}

function renderLayers() {
  preview.querySelectorAll(".editor-layer")
    .forEach(element => element.remove());

  const scale = scaleFactor();

  for (const layer of layers) {
    const element = document.createElement("div");

    element.className = "editor-layer";
    element.dataset.layerId = layer.id;

    if (selectedId === layer.id) {
      element.classList.add("layer-selected");
    }

    element.style.left = `${layer.x * scale}px`;
    element.style.top = `${layer.y * scale}px`;
    element.style.width = `${layer.width * scale}px`;
    element.style.height =
      `${layer.width / layer.ratio * scale}px`;

    // Layer gambar bisa berada di depan / belakang teks.
    element.style.zIndex = String(layer.z);

    const img = document.createElement("img");
    img.src = layer.src;
    img.alt = layer.name;
    img.draggable = false;

    element.appendChild(img);

    const resize = document.createElement("div");
    resize.className = "resize-handle";

    const remove = document.createElement("button");
    remove.className = "delete-layer";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Hapus layer";

    element.appendChild(resize);
    element.appendChild(remove);
    preview.appendChild(element);

    attachLayerEvents(element, layer, resize, remove);
  }
}

function selectLayer(id) {
  selectedId = id;
  renderLayers();
}

function attachLayerEvents(element, layer, resize, remove) {
  element.addEventListener("pointerdown", event => {
    if (event.target === resize ||
        event.target === remove) return;

    event.preventDefault();
    event.stopPropagation();

    selectedId = layer.id;

    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = layer.x;
    const originalY = layer.y;
    const scale = scaleFactor();

    element.setPointerCapture(event.pointerId);
    element.classList.add("layer-selected");

    function move(e) {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;

      layer.x = Math.max(
        0,
        Math.min(A4_WIDTH - layer.width, originalX + dx)
      );

      layer.y = Math.max(
        0,
        Math.min(
          A4_HEIGHT - layer.width / layer.ratio,
          originalY + dy
        )
      );

      element.style.left = `${layer.x * scale}px`;
      element.style.top = `${layer.y * scale}px`;
    }

    function end() {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);

      renderLayers();
      resetPayment();
    }

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
  });

  resize.addEventListener("pointerdown", event => {
    event.preventDefault();
    event.stopPropagation();

    selectedId = layer.id;

    const startX = event.clientX;
    const originalWidth = layer.width;
    const scale = scaleFactor();

    resize.setPointerCapture(event.pointerId);

    function move(e) {
      const dx = (e.clientX - startX) / scale;

      const maxWidth = Math.min(
        A4_WIDTH - layer.x,
        (A4_HEIGHT - layer.y) * layer.ratio
      );

      layer.width = Math.max(
        Math.min(35, maxWidth),
        Math.min(maxWidth, originalWidth + dx)
      );

      element.style.width =
        `${layer.width * scale}px`;

      element.style.height =
        `${layer.width / layer.ratio * scale}px`;
    }

    function end() {
      resize.removeEventListener("pointermove", move);
      resize.removeEventListener("pointerup", end);
      resize.removeEventListener("pointercancel", end);

      renderLayers();
      resetPayment();
    }

    resize.addEventListener("pointermove", move);
    resize.addEventListener("pointerup", end);
    resize.addEventListener("pointercancel", end);
  });

  remove.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    deleteLayer(layer.id);
  });
}

function deleteLayer(id) {
  layers = layers.filter(layer => layer.id !== id);
  if (selectedId === id) selectedId = null;

  renderLayers();
  resetPayment();
}

deleteLayerBtn.addEventListener("click", () => {
  if (!selectedId) {
    showStatus("Pilih layer terlebih dahulu.", "error");
    return;
  }

  deleteLayer(selectedId);
});

bringForwardBtn.addEventListener("click", () => {
  const layer = getSelectedLayer();
  if (!layer) return;

  layer.z = Math.min(100, layer.z + 1);
  renderLayers();
  resetPayment();
});

sendBackwardBtn.addEventListener("click", () => {
  const layer = getSelectedLayer();
  if (!layer) return;

  layer.z = Math.max(1, layer.z - 1);
  renderLayers();
  resetPayment();
});

preview.addEventListener("pointerdown", event => {
  if (event.target === preview) {
    selectedId = null;
    renderLayers();
  }
});

/* ==========================================
   PEMBAYARAN DAN VERIFIKASI
========================================== */

// Backend harus memverifikasi status ke Midtrans,
// bukan percaya pada parameter URL atau localStorage.
async function verifyPayment(orderId) {
  if (!orderId) return false;

  const response = await fetch(
    `/api/get-payment?order_id=${encodeURIComponent(orderId)}`,
    { cache: "no-store" }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Gagal memeriksa pembayaran."
    );
  }

  const paid = ["settlement", "capture"]
    .includes(data.payment_status);

  if (!paid) return false;

  // Cocokkan draft yang dibayar dengan draft saat ini.
  if (data.surat_text !== getText()) {
    return false;
  }

  return true;
}

printBtn.addEventListener("click", async () => {
  if (!hasDraft()) {
    showStatus(
      "Buat atau tempelkan draft surat terlebih dahulu.",
      "error"
    );
    return;
  }

  // Selalu verifikasi ke server.
  if (paidOrderId) {
    try {
      if (await verifyPayment(paidOrderId)) {
        openModal(printModal);
        return;
      }
    } catch (error) {
      console.error(error);
      showStatus(error.message, "error");
      return;
    }
  }

  openModal(paymentModal);
});

$("closePaymentInfoModal").addEventListener(
  "click", () => closeModal(paymentModal)
);

$("cancelPaymentBtn").addEventListener(
  "click", () => closeModal(paymentModal)
);

continuePaymentBtn.addEventListener("click", async () => {
  if (busy) return;

  setBusy(true);

  try {
    saveState();

    const response = await fetch("/api/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        surat_text: getText(),
        draft_id: draftId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Gagal membuat pembayaran."
      );
    }

    if (!data.redirect_url || !data.order_id) {
      throw new Error(
        "Data pembayaran tidak lengkap."
      );
    }

    currentOrderId = data.order_id;
    saveState();

    window.location.assign(data.redirect_url);

  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
    setBusy(false);
    closeModal(paymentModal);
  }
});

/* ==========================================
   KEMBALI DARI MIDTRANS
========================================== */

async function checkPaymentReturn() {
  const params = new URLSearchParams(location.search);

  const orderId =
    params.get("order_id") || currentOrderId;

  if (!orderId) return;

  // Pemeriksaan tetap dilakukan ke backend,
  // termasuk saat URL tidak membawa status.
  try {
    const paid = await verifyPayment(orderId);

    if (paid) {
      paidOrderId = orderId;
      currentOrderId = orderId;
      saveState();

      openModal(printModal);

      showStatus(
        "Pembayaran terverifikasi. Word dan PDF siap digunakan.",
        "success"
      );
    } else if (params.has("order_id") ||
               params.has("transaction_status")) {
      showStatus(
        "Pembayaran belum terkonfirmasi. " +
        "Silakan periksa kembali beberapa saat lagi."
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

/* ==========================================
   MODAL FORMAT
========================================== */

$("closePrintModal").addEventListener(
  "click", () => closeModal(printModal)
);

printModal.addEventListener("click", event => {
  if (event.target === printModal) {
    closeModal(printModal);
  }
});

/* ==========================================
   PDF / PRINT
========================================== */

pdfBtn.addEventListener("click", async () => {
  try {
    if (!await verifyPayment(paidOrderId)) {
      throw new Error("Pembayaran belum terverifikasi.");
    }

    closeModal(printModal);

    selectedId = null;
    renderLayers();

    window.print();

  } catch (error) {
    showStatus(error.message, "error");
  }
});

/* ==========================================
   WORD
   HTML-compatible .doc
========================================== */

wordBtn.addEventListener("click", async () => {
  try {
    if (!await verifyPayment(paidOrderId)) {
      throw new Error("Pembayaran belum terverifikasi.");
    }

    const scale = 96 / 72;

    const layerHtml = layers.map(layer => {
      const left = layer.x / scale;
      const top = layer.y / scale;
      const width = layer.width / scale;
      const height =
        layer.width / layer.ratio / scale;

      return `
        <div style="
          position:absolute;
          left:${left}pt;
          top:${top}pt;
          width:${width}pt;
          height:${height}pt;
          z-index:${layer.z};
        ">
          <img src="${layer.src}"
            width="${Math.round(width)}"
            height="${Math.round(height)}">
        </div>
      `;
    }).join("");

    const paragraphs = getText()
      .split(/\n{2,}/)
      .map(part => `
        <p style="
          margin:0 0 12pt 0;
          text-align:justify;
          white-space:pre-wrap;
        ">${escapeHtml(part).replace(/\n/g, "<br>")}</p>
      `).join("");

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
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
          }
          .page {
            position:relative;
            min-height:250mm;
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

    const blob = new Blob(
      ["\ufeff", html],
      { type: "application/msword" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "surat.doc";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    closeModal(printModal);

    showStatus(
      "Dokumen Word telah disiapkan.",
      "success"
    );

  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
  }
});

/* ==========================================
   RESPONSIVE
========================================== */

window.addEventListener("resize", () => {
  renderLayers();
});

/* ==========================================
   INIT
========================================== */

restoreState();
checkPaymentReturn();
