"use strict";

/* ==========================================
   SURAT MENYURAT AI — APP.JS
   Draft AI + Draft Manual + Multi Layer
   Pembayaran melekat pada 1 draft
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

const STORAGE_KEY = "surat_editor_v4";

const PLACEHOLDER_TEXT =
  "Hasil surat akan muncul di sini...";

const PLACEHOLDER_FULL =
`Hasil surat akan muncul di sini...

Sudah punya draft sendiri? Hapus teks ini lalu tempelkan naskah surat Anda langsung di area ini.`;

let layers = [];
let selectedId = null;

let draftId = null;
let currentOrderId = null;
let paidOrderId = null;

let draftSource = null;
// nilai:
// null
// "ai"
// "manual"

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


function isPlaceholderText(text) {
  const cleaned = String(text || "").trim();

  return (
    !cleaned ||
    cleaned === PLACEHOLDER_TEXT ||
    cleaned === PLACEHOLDER_FULL.trim() ||
    cleaned.startsWith(PLACEHOLDER_TEXT)
  );
}


function hasDraft() {
  return !isPlaceholderText(getText());
}


function newId() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}


function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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


/* ==========================================
   DRAFT SESSION
========================================== */

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


/* ==========================================
   SAVE / RESTORE
========================================== */

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
      jenis: $("jenis")?.value || "",
      nama: $("nama")?.value || "",
      penerima: $("penerima")?.value || "",
      detail: $("detail")?.value || ""
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
      "Data editor terlalu besar untuk penyimpanan browser. " +
      "Coba gunakan gambar dengan ukuran file lebih kecil.",
      "error"
    );
  }
}


function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return;

  try {
    restoring = true;

    const state = JSON.parse(raw);

    draftId = state.draftId || null;
    draftSource = state.draftSource || null;

    currentOrderId =
      state.currentOrderId || null;

    paidOrderId =
      state.paidOrderId || null;

    if (
      state.text &&
      !isPlaceholderText(state.text)
    ) {
      output.textContent = state.text;
    }

    const form = state.form || {};

    for (const key of [
      "jenis",
      "nama",
      "penerima",
      "detail"
    ]) {
      if (
        form[key] !== undefined &&
        $(key)
      ) {
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
   GENERATE SURAT AI
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

  generateBtn.textContent =
    "⏳ Menyusun surat...";

  try {
    const response =
      await fetch("/api/generate", {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          jenis,
          nama,
          penerima,
          detail
        })
      });

    const data = await response.json();

    if (!response.ok || !data.result) {
      throw new Error(
        data.error ||
        "Gagal membuat surat."
      );
    }

    /*
      HANYA DI SINI pembayaran di-reset.

      Artinya:
      klik "Buat Draft Surat" lagi
      = draft baru
      = harus bayar lagi ketika cetak.
    */
    createFreshDraftSession("ai");

    layers = [];
    selectedId = null;

    output.textContent =
      data.result.trim();

    renderLayers();
    saveState();

    showStatus(
      "Draft baru berhasil dibuat. " +
      "Anda dapat mengedit, menambahkan tanda tangan, " +
      "atau menambahkan gambar sebelum mencetak.",
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


/* ==========================================
   EDIT TEKS
========================================== */

let editTimer = null;

output.addEventListener("input", () => {
  clearTimeout(editTimer);

  editTimer = setTimeout(() => {

    /*
      Pengguna yang langsung menempel draft sendiri
      otomatis dibuatkan draftId.

      Setelah itu seluruh edit tetap dianggap
      draft yang sama.
    */
    ensureManualDraftSession();

    saveState();

  }, 400);
});


output.addEventListener("paste", () => {
  setTimeout(() => {
    ensureManualDraftSession();
    saveState();
  }, 50);
});


editBtn.addEventListener("click", () => {
  const editing =
    output.getAttribute("contenteditable") ===
    "true";

  if (editing) {
    output.setAttribute(
      "contenteditable",
      "false"
    );

    editBtn.textContent = "✏️ Edit";

    output.classList.remove(
      "ring-2",
      "ring-blue-300"
    );

    ensureManualDraftSession();
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
});


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
      await navigator.clipboard.writeText(
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


/* ==========================================
   CANVAS TANDA TANGAN
========================================== */

const ctx =
  signaturePad.getContext("2d");

ctx.lineWidth = 3;
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = "#111827";

let drawing = false;
let lastPoint = null;


function canvasPoint(event) {
  const rect =
    signaturePad.getBoundingClientRect();

  return {
    x:
      (event.clientX - rect.left) *
      signaturePad.width /
      rect.width,

    y:
      (event.clientY - rect.top) *
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

    signaturePad.setPointerCapture(
      event.pointerId
    );

    ctx.beginPath();

    ctx.arc(
      lastPoint.x,
      lastPoint.y,
      1.5,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#111827";
    ctx.fill();
  }
);


signaturePad.addEventListener(
  "pointermove",
  event => {

    if (!drawing) return;

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


function stopDrawing() {
  drawing = false;
  lastPoint = null;
}


signaturePad.addEventListener(
  "pointerup",
  stopDrawing
);

signaturePad.addEventListener(
  "pointercancel",
  stopDrawing
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


/* ==========================================
   POTONG AREA TRANSPARAN TTD
========================================== */

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

  const pixels = image.data;

  let minX = canvas.width;
  let minY = canvas.height;

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
        pixels[
          (y * canvas.width + x) *
          4 +
          3
        ];

      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);

        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) {
    return null;
  }

  const pad = 12;

  minX =
    Math.max(
      0,
      minX - pad
    );

  minY =
    Math.max(
      0,
      minY - pad
    );

  maxX =
    Math.min(
      canvas.width - 1,
      maxX + pad
    );

  maxY =
    Math.min(
      canvas.height - 1,
      maxY + pad
    );

  const width =
    maxX - minX + 1;

  const height =
    maxY - minY + 1;

  const cropped =
    document.createElement("canvas");

  cropped.width = width;
  cropped.height = height;

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


addSignatureBtn.addEventListener(
  "click",
  () => {

    if (!hasDraft()) {
      showStatus(
        "Masukkan atau buat draft surat terlebih dahulu.",
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
      src: result.src,

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
      "Tanda tangan ditambahkan. " +
      "Geser atau ubah ukurannya sesuai kebutuhan.",
      "success"
    );
  }
);


/* ==========================================
   UPLOAD GAMBAR
========================================== */

imageUpload.addEventListener(
  "change",
  async event => {

    if (!hasDraft()) {
      showStatus(
        "Masukkan atau buat draft surat terlebih dahulu.",
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

    for (const file of files) {

      const allowed = [
        "image/png",
        "image/jpeg",
        "image/webp"
      ];

      if (!allowed.includes(file.type)) {
        showStatus(
          "Gunakan file PNG, JPG, atau WebP.",
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
          await readImage(file);

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
    (resolve, reject) => {

      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            reader.result
          );

      reader.onerror =
        reject;

      reader.readAsDataURL(file);
    }
  );
}


function getImageDimensions(src) {
  return new Promise(
    (resolve, reject) => {

      const img =
        new Image();

      img.onload =
        () =>
          resolve({
            width:
              img.naturalWidth,

            height:
              img.naturalHeight
          });

      img.onerror =
        reject;

      img.src = src;
    }
  );
}


/* ==========================================
   SISTEM MULTI LAYER
========================================== */

function addLayer(config) {
  ensureManualDraftSession();

  const layer = {
    id:
      newId(),

    name:
      config.name,

    type:
      config.type,

    src:
      config.src,

    x:
      config.x,

    y:
      config.y,

    width:
      config.width,

    ratio:
      config.ratio,

    z:
      layers.length + 1
  };

  layers.push(layer);

  selectedId =
    layer.id;

  renderLayers();
  saveState();
}


function getSelectedLayer() {
  return layers.find(
    layer =>
      layer.id === selectedId
  );
}


function scaleFactor() {
  return (
    preview.clientWidth /
    A4_WIDTH
  );
}


function renderLayers() {
  preview
    .querySelectorAll(
      ".editor-layer"
    )
    .forEach(
      element =>
        element.remove()
    );

  const scale =
    scaleFactor();

  for (const layer of layers) {

    const element =
      document.createElement(
        "div"
      );

    element.className =
      "editor-layer";

    element.dataset.layerId =
      layer.id;

    if (
      selectedId === layer.id
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
        layer.width /
        layer.ratio *
        scale
      }px`;

    element.style.zIndex =
      String(layer.z);

    const img =
      document.createElement(
        "img"
      );

    img.src =
      layer.src;

    img.alt =
      layer.name;

    img.draggable =
      false;

    element.appendChild(img);


    const resize =
      document.createElement(
        "div"
      );

    resize.className =
      "resize-handle";


    const remove =
      document.createElement(
        "button"
      );

    remove.className =
      "delete-layer";

    remove.type =
      "button";

    remove.textContent =
      "×";

    remove.title =
      "Hapus layer";

    element.appendChild(
      resize
    );

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
}


/* ==========================================
   DRAG / RESIZE LAYER
========================================== */

function attachLayerEvents(
  element,
  layer,
  resize,
  remove
) {

  element.addEventListener(
    "pointerdown",
    event => {

      if (
        event.target === resize ||
        event.target === remove
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      selectedId =
        layer.id;

      const startX =
        event.clientX;

      const startY =
        event.clientY;

      const originalX =
        layer.x;

      const originalY =
        layer.y;

      const scale =
        scaleFactor();

      element.setPointerCapture(
        event.pointerId
      );

      element.classList.add(
        "layer-selected"
      );

      function move(e) {
        const dx =
          (
            e.clientX -
            startX
          ) /
          scale;

        const dy =
          (
            e.clientY -
            startY
          ) /
          scale;

        layer.x =
          Math.max(
            0,
            Math.min(
              A4_WIDTH -
              layer.width,

              originalX + dx
            )
          );

        layer.y =
          Math.max(
            0,
            Math.min(
              A4_HEIGHT -
              (
                layer.width /
                layer.ratio
              ),

              originalY + dy
            )
          );

        element.style.left =
          `${layer.x * scale}px`;

        element.style.top =
          `${layer.y * scale}px`;
      }

      function end() {
        element.removeEventListener(
          "pointermove",
          move
        );

        element.removeEventListener(
          "pointerup",
          end
        );

        element.removeEventListener(
          "pointercancel",
          end
        );

        renderLayers();
        saveState();
      }

      element.addEventListener(
        "pointermove",
        move
      );

      element.addEventListener(
        "pointerup",
        end
      );

      element.addEventListener(
        "pointercancel",
        end
      );
    }
  );


  resize.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();
      event.stopPropagation();

      selectedId =
        layer.id;

      const startX =
        event.clientX;

      const originalWidth =
        layer.width;

      const scale =
        scaleFactor();

      resize.setPointerCapture(
        event.pointerId
      );

      function move(e) {

        const dx =
          (
            e.clientX -
            startX
          ) /
          scale;

        const maxWidth =
          Math.min(
            A4_WIDTH -
            layer.x,

            (
              A4_HEIGHT -
              layer.y
            ) *
            layer.ratio
          );

        const minWidth =
          Math.min(
            35,
            maxWidth
          );

        layer.width =
          Math.max(
            minWidth,

            Math.min(
              maxWidth,

              originalWidth +
              dx
            )
          );

        element.style.width =
          `${layer.width * scale}px`;

        element.style.height =
          `${
            layer.width /
            layer.ratio *
            scale
          }px`;
      }

      function end() {
        resize.removeEventListener(
          "pointermove",
          move
        );

        resize.removeEventListener(
          "pointerup",
          end
        );

        resize.removeEventListener(
          "pointercancel",
          end
        );

        renderLayers();
        saveState();
      }

      resize.addEventListener(
        "pointermove",
        move
      );

      resize.addEventListener(
        "pointerup",
        end
      );

      resize.addEventListener(
        "pointercancel",
        end
      );
    }
  );


  remove.addEventListener(
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


/* ==========================================
   DELETE LAYER
========================================== */

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

  renderLayers();
  saveState();
}


deleteLayerBtn.addEventListener(
  "click",
  () => {

    if (!selectedId) {
      showStatus(
        "Pilih layer terlebih dahulu.",
        "error"
      );

      return;
    }

    deleteLayer(
      selectedId
    );
  }
);


/* ==========================================
   URUTAN LAYER
========================================== */

bringForwardBtn.addEventListener(
  "click",
  () => {

    const layer =
      getSelectedLayer();

    if (!layer) {
      showStatus(
        "Pilih layer terlebih dahulu.",
        "error"
      );

      return;
    }

    layer.z =
      Math.min(
        100,
        layer.z + 1
      );

    renderLayers();
    saveState();
  }
);


sendBackwardBtn.addEventListener(
  "click",
  () => {

    const layer =
      getSelectedLayer();

    if (!layer) {
      showStatus(
        "Pilih layer terlebih dahulu.",
        "error"
      );

      return;
    }

    layer.z =
      Math.max(
        1,
        layer.z - 1
      );

    renderLayers();
    saveState();
  }
);


/* ==========================================
   DESELECT LAYER
========================================== */

preview.addEventListener(
  "pointerdown",
  event => {

    if (
      event.target === preview ||
      event.target === output
    ) {
      selectedId = null;
      renderLayers();
    }
  }
);


/* ==========================================
   PEMBAYARAN
========================================== */

/*
  CATATAN KEAMANAN:

  Browser tidak menentukan sendiri
  apakah pembayaran sukses.

  Backend /api/get-payment
  harus mengembalikan payment_status
  yang telah diverifikasi berdasarkan Midtrans.
*/

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
        cache:
          "no-store"
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

  const paidStatuses = [
    "settlement",
    "capture"
  ];

  const paid =
    paidStatuses.includes(
      data.payment_status
    );

  if (!paid) {
    return false;
  }

  /*
    Pembayaran melekat pada draft_id,
    bukan isi teks persis.

    Jadi setelah pembayaran:
    edit teks / TTD / layer tetap sah.
  */

  if (
    data.draft_id &&
    draftId &&
    data.draft_id !== draftId
  ) {
    return false;
  }

  return true;
}


/* ==========================================
   TOMBOL CETAK
========================================== */

printBtn.addEventListener(
  "click",
  async () => {

    if (!hasDraft()) {
      showStatus(
        "Buat atau tempelkan draft surat terlebih dahulu.",
        "error"
      );

      return;
    }

    ensureManualDraftSession();

    saveState();

    /*
      Bila pernah bayar:
      verifikasi dulu ke server.
    */

    if (paidOrderId) {
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
        console.error(error);
      }
    }

    /*
      Belum bayar:
      tampilkan popup Rp3.000.
    */

    openModal(
      paymentModal
    );
  }
);


/* ==========================================
   MODAL PEMBAYARAN
========================================== */

$("closePaymentInfoModal")
  .addEventListener(
    "click",
    () =>
      closeModal(
        paymentModal
      )
  );


$("cancelPaymentBtn")
  .addEventListener(
    "click",
    () =>
      closeModal(
        paymentModal
      )
  );


paymentModal.addEventListener(
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


/* ==========================================
   BUAT TRANSAKSI
========================================== */

continuePaymentBtn.addEventListener(
  "click",
  async () => {

    if (busy) return;

    if (!hasDraft()) {
      showStatus(
        "Draft surat belum tersedia.",
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
            method:
              "POST",

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


/* ==========================================
   KEMBALI DARI MIDTRANS
========================================== */

async function checkPaymentReturn() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const orderId =
    params.get("order_id") ||
    currentOrderId;

  if (!orderId) {
    return;
  }

  try {
    const data =
      await getPaymentData(
        orderId
      );

    /*
      Bila backend menyimpan text/draft,
      kita bisa pulihkan jika localStorage hilang.
    */

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

      /*
        Cocokkan transaksi dengan draft.
      */

      if (
        data.draft_id &&
        draftId &&
        data.draft_id !==
        draftId
      ) {

        showStatus(
          "Pembayaran ditemukan, tetapi transaksi tersebut berasal dari draft lain.",
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
        "Pembayaran berhasil diverifikasi. " +
        "Word dan PDF sekarang dapat digunakan untuk draft ini.",
        "success"
      );

      /*
        Bersihkan query Midtrans
        agar refresh tidak terus dianggap return.
      */

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
      params.has("order_id") ||
      params.has(
        "transaction_status"
      )
    ) {
      showStatus(
        "Pembayaran belum terkonfirmasi. " +
        "Jika baru saja membayar, tunggu sebentar lalu klik Cetak kembali.",
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


/* ==========================================
   MODAL FORMAT
========================================== */

$("closePrintModal")
  .addEventListener(
    "click",
    () =>
      closeModal(
        printModal
      )
  );


printModal.addEventListener(
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


/* ==========================================
   PDF / PRINT
========================================== */

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


/* ==========================================
   WORD
========================================== */

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

      /*
        Word HTML-compatible .doc

        Catatan:
        posisi layer absolut belum tentu
        100% identik pada semua versi MS Word.
      */

      const layerHtml =
        layers
          .map(layer => {

            const leftMm =
              layer.x /
              A4_WIDTH *
              210;

            const topMm =
              layer.y /
              A4_HEIGHT *
              297;

            const widthMm =
              layer.width /
              A4_WIDTH *
              210;

            const heightMm =
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
                  left:${leftMm}mm;
                  top:${topMm}mm;
                  width:${widthMm}mm;
                  height:${heightMm}mm;
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
          })
          .join("");


      const paragraphs =
        getText()
          .split(/\n{2,}/)
          .map(part => {

            return `
              <p
                style="
                  margin:0 0 12pt 0;
                  text-align:justify;
                  line-height:1.5;
                "
              >
                ${
                  escapeHtml(part)
                    .replace(
                      /\n/g,
                      "<br>"
                    )
                }
              </p>
            `;
          })
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

              font-size:
                11pt;

              line-height:
                1.5;
            }

            .page {
              position:
                relative;

              width:
                166mm;

              min-height:
                257mm;
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
        () =>
          URL.revokeObjectURL(
            url
          ),
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


/* ==========================================
   RESPONSIVE
========================================== */

window.addEventListener(
  "resize",
  () => {
    renderLayers();
  }
);


/* ==========================================
   ESC KEY
========================================== */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key !== "Escape"
    ) {
      return;
    }

    closeModal(
      paymentModal
    );

    closeModal(
      printModal
    );

    selectedId = null;
    renderLayers();
  }
);


/* ==========================================
   SIMPAN FORM OTOMATIS
========================================== */

[
  "jenis",
  "nama",
  "penerima",
  "detail"
].forEach(id => {

  const element = $(id);

  if (!element) return;

  element.addEventListener(
    "input",
    saveState
  );

  element.addEventListener(
    "change",
    saveState
  );
});


/* ==========================================
   INIT
========================================== */

restoreState();

checkPaymentReturn();
