const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");

const output = document.getElementById("output");

const copyBtn = document.getElementById("copyBtn");
const editBtn = document.getElementById("editBtn");
const printBtn = document.getElementById("printBtn");

const statusBox = document.getElementById("status");

// DOCUMENT EDITOR
const documentEditorModal = document.getElementById("documentEditorModal");
const closeDocumentEditor = document.getElementById("closeDocumentEditor");
const cancelDocumentEditor = document.getElementById("cancelDocumentEditor");
const continuePrintBtn = document.getElementById("continuePrintBtn");

const printEditorPreview = document.getElementById("printEditorPreview");
const printEditorText = document.getElementById("printEditorText");

// SIGNATURE
const signatureCanvas = document.getElementById("signatureCanvas");
const clearSignatureCanvas = document.getElementById("clearSignatureCanvas");
const addSignatureToDocument = document.getElementById("addSignatureToDocument");

const signatureLayer = document.getElementById("signatureLayer");
const editorSignatureImage = document.getElementById("editorSignatureImage");
const signatureResizeHandle = document.getElementById("signatureResizeHandle");
const signatureDeleteBtn = document.getElementById("signatureDeleteBtn");

// FORMAT MODAL
const printModal = document.getElementById("printModal");
const closePrintModal = document.getElementById("closePrintModal");
const wordBtn = document.getElementById("wordBtn");
const pdfBtn = document.getElementById("pdfBtn");

let signatureDataUrl = "";
let signatureX = 80;
let signatureY = 650;
let signatureWidth = 150;


/* =========================
   STATUS
========================= */

function showStatus(message, type = "info") {
  statusBox.className = "mt-4 p-3 rounded-lg text-sm";

  if (type === "error") {
    statusBox.classList.add("bg-red-100", "text-red-700");
  } else if (type === "success") {
    statusBox.classList.add("bg-green-100", "text-green-700");
  } else {
    statusBox.classList.add("bg-blue-100", "text-blue-700");
  }

  statusBox.textContent = message;
}


/* =========================
   GENERATE SURAT
========================= */

async function generateSurat() {
  const jenis = document.getElementById("jenis").value;
  const nama = document.getElementById("nama").value.trim();
  const penerima = document.getElementById("penerima").value.trim();
  const detail = document.getElementById("detail").value.trim();

  if (!nama || !penerima || !detail) {
    showStatus(
      "Mohon lengkapi semua data terlebih dahulu.",
      "error"
    );
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "⏳ AI sedang menyusun surat...";

  output.textContent = "Sedang menyusun surat...";

  try {
    const response = await fetch("/api/generate", {
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

    if (!response.ok) {
      throw new Error(
        data.error || "Gagal membuat surat."
      );
    }

    output.textContent = data.result;

    // DRAFT BARU = RESET AKSES BAYAR
    localStorage.removeItem("paymentUnlocked");
    localStorage.removeItem("paidOrderId");
    localStorage.removeItem("orderId");

    // RESET TANDA TANGAN DOKUMEN
    signatureDataUrl = "";
    signatureLayer.style.display = "none";

    showStatus(
      "Surat berhasil dibuat.",
      "success"
    );

  } catch (error) {
    console.error(error);

    output.textContent =
      "Surat belum berhasil dibuat.";

    showStatus(
      error.message,
      "error"
    );

  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent =
      "✨ Buat Draft Surat";
  }
}

generateBtn.addEventListener("click", generateSurat);
regenerateBtn.addEventListener("click", generateSurat);


/* =========================
   SALIN
========================= */

copyBtn.addEventListener("click", async () => {
  const text = output.innerText.trim();

  if (
    !text ||
    text === "Hasil surat akan muncul di sini..." ||
    text === "Surat belum berhasil dibuat."
  ) {
    showStatus(
      "Belum ada surat untuk disalin.",
      "error"
    );
    return;
  }

  try {
    await navigator.clipboard.writeText(text);

    showStatus(
      "Surat berhasil disalin.",
      "success"
    );

  } catch {
    showStatus(
      "Gagal menyalin surat.",
      "error"
    );
  }
});


/* =========================
   EDIT
========================= */

editBtn.addEventListener("click", () => {
  const editable =
    output.getAttribute("contenteditable");

  if (editable === "true") {
    output.setAttribute(
      "contenteditable",
      "false"
    );

    editBtn.textContent = "✏️ Edit";

    output.classList.remove(
      "ring-2",
      "ring-blue-300",
      "p-2"
    );

    showStatus(
      "Perubahan selesai.",
      "success"
    );

  } else {
    output.setAttribute(
      "contenteditable",
      "true"
    );

    output.focus();

    output.classList.add(
      "ring-2",
      "ring-blue-300",
      "p-2"
    );

    editBtn.textContent =
      "💾 Selesai Edit";

    showStatus(
      "Anda sekarang dapat mengedit isi surat.",
      "info"
    );
  }
});


/* =========================
   BUKA EDITOR DOKUMEN
========================= */

printBtn.addEventListener("click", () => {
  const text = output.innerText.trim();

  if (
    !text ||
    text === "Hasil surat akan muncul di sini..." ||
    text === "Surat belum berhasil dibuat."
  ) {
    showStatus(
      "Buat surat terlebih dahulu sebelum mencetak.",
      "error"
    );
    return;
  }

  printEditorText.textContent = text;

  documentEditorModal.classList.remove("hidden");
  documentEditorModal.classList.add("flex");
});


/* =========================
   TUTUP EDITOR
========================= */

function closeEditor() {
  documentEditorModal.classList.add("hidden");
  documentEditorModal.classList.remove("flex");
}

closeDocumentEditor.addEventListener("click", closeEditor);
cancelDocumentEditor.addEventListener("click", closeEditor);


/* =========================
   SIGNATURE CANVAS
========================= */

if (signatureCanvas) {
  const ctx = signatureCanvas.getContext("2d");

  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111827";

  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function getCanvasPosition(event) {
    const rect =
      signatureCanvas.getBoundingClientRect();

    const clientX =
      event.touches
        ? event.touches[0].clientX
        : event.clientX;

    const clientY =
      event.touches
        ? event.touches[0].clientY
        : event.clientY;

    return {
      x:
        (clientX - rect.left) *
        (signatureCanvas.width / rect.width),

      y:
        (clientY - rect.top) *
        (signatureCanvas.height / rect.height)
    };
  }

  function startDrawing(event) {
    event.preventDefault();

    drawing = true;

    const pos = getCanvasPosition(event);

    lastX = pos.x;
    lastY = pos.y;
  }

  function draw(event) {
    if (!drawing) return;

    event.preventDefault();

    const pos = getCanvasPosition(event);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
  }

  function stopDrawing(event) {
    if (event) {
      event.preventDefault();
    }

    drawing = false;
  }

  signatureCanvas.addEventListener(
    "mousedown",
    startDrawing
  );

  signatureCanvas.addEventListener(
    "mousemove",
    draw
  );

  window.addEventListener(
    "mouseup",
    stopDrawing
  );

  signatureCanvas.addEventListener(
    "touchstart",
    startDrawing,
    { passive: false }
  );

  signatureCanvas.addEventListener(
    "touchmove",
    draw,
    { passive: false }
  );

  signatureCanvas.addEventListener(
    "touchend",
    stopDrawing,
    { passive: false }
  );

  clearSignatureCanvas.addEventListener(
    "click",
    () => {
      ctx.clearRect(
        0,
        0,
        signatureCanvas.width,
        signatureCanvas.height
      );

      signatureDataUrl = "";

      signatureLayer.style.display =
        "none";
    }
  );

  addSignatureToDocument.addEventListener(
    "click",
    () => {
      signatureDataUrl =
        signatureCanvas.toDataURL("image/png");

      editorSignatureImage.src =
        signatureDataUrl;

      signatureLayer.style.display =
        "block";

      signatureLayer.style.left =
        `${signatureX}px`;

      signatureLayer.style.top =
        `${signatureY}px`;

      signatureLayer.style.width =
        `${signatureWidth}px`;
    }
  );
}


/* =========================
   DRAG SIGNATURE
========================= */

let draggingSignature = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

signatureLayer.addEventListener(
  "pointerdown",
  (event) => {
    if (
      event.target === signatureResizeHandle ||
      event.target === signatureDeleteBtn
    ) {
      return;
    }

    draggingSignature = true;

    const layerRect =
      signatureLayer.getBoundingClientRect();

    dragOffsetX =
      event.clientX - layerRect.left;

    dragOffsetY =
      event.clientY - layerRect.top;

    signatureLayer.setPointerCapture(
      event.pointerId
    );
  }
);


signatureLayer.addEventListener(
  "pointermove",
  (event) => {
    if (!draggingSignature) return;

    const previewRect =
      printEditorPreview.getBoundingClientRect();

    let newX =
      event.clientX -
      previewRect.left -
      dragOffsetX;

    let newY =
      event.clientY -
      previewRect.top -
      dragOffsetY;

    const maxX =
      printEditorPreview.clientWidth -
      signatureLayer.offsetWidth;

    const maxY =
      printEditorPreview.clientHeight -
      signatureLayer.offsetHeight;

    newX = Math.max(
      0,
      Math.min(newX, maxX)
    );

    newY = Math.max(
      0,
      Math.min(newY, maxY)
    );

    signatureX = newX;
    signatureY = newY;

    signatureLayer.style.left =
      `${signatureX}px`;

    signatureLayer.style.top =
      `${signatureY}px`;
  }
);


signatureLayer.addEventListener(
  "pointerup",
  () => {
    draggingSignature = false;
  }
);


/* =========================
   RESIZE SIGNATURE
========================= */

let resizingSignature = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

signatureResizeHandle.addEventListener(
  "pointerdown",
  (event) => {
    event.stopPropagation();

    resizingSignature = true;

    resizeStartX =
      event.clientX;

    resizeStartWidth =
      signatureLayer.offsetWidth;

    signatureResizeHandle.setPointerCapture(
      event.pointerId
    );
  }
);


signatureResizeHandle.addEventListener(
  "pointermove",
  (event) => {
    if (!resizingSignature) return;

    const deltaX =
      event.clientX -
      resizeStartX;

    let newWidth =
      resizeStartWidth +
      deltaX;

    newWidth =
      Math.max(
        60,
        Math.min(newWidth, 320)
      );

    signatureWidth =
      newWidth;

    signatureLayer.style.width =
      `${signatureWidth}px`;
  }
);


signatureResizeHandle.addEventListener(
  "pointerup",
  () => {
    resizingSignature = false;
  }
);


/* =========================
   HAPUS SIGNATURE
========================= */

signatureDeleteBtn.addEventListener(
  "click",
  (event) => {
    event.stopPropagation();

    signatureDataUrl = "";

    signatureLayer.style.display =
      "none";
  }
);


/* =========================
   LANJUT CETAK
========================= */

continuePrintBtn.addEventListener(
  "click",
  async () => {
    const text =
      output.innerText.trim();

    closeEditor();

    // SUDAH BAYAR UNTUK DRAFT INI
    if (
      localStorage.getItem("paymentUnlocked") === "true"
    ) {
      printModal.classList.remove("hidden");
      printModal.classList.add("flex");

      return;
    }

    try {
      continuePrintBtn.disabled = true;
      continuePrintBtn.textContent =
        "⏳ Menyiapkan...";

      const response =
        await fetch(
          "/api/create-payment",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              surat_text: text
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

      if (!data.redirect_url) {
        throw new Error(
          "URL pembayaran tidak ditemukan."
        );
      }

      localStorage.setItem(
        "orderId",
        data.order_id || ""
      );

      // SIMPAN POSISI TTD LOKAL
      if (signatureDataUrl) {
        localStorage.setItem(
          "signatureDataUrl",
          signatureDataUrl
        );

        localStorage.setItem(
          "signatureX",
          String(signatureX)
        );

        localStorage.setItem(
          "signatureY",
          String(signatureY)
        );

        localStorage.setItem(
          "signatureWidth",
          String(signatureWidth)
        );
      } else {
        localStorage.removeItem(
          "signatureDataUrl"
        );
      }

      window.location.href =
        data.redirect_url;

    } catch (error) {
      console.error(error);

      showStatus(
        error.message,
        "error"
      );

      continuePrintBtn.disabled = false;

      continuePrintBtn.textContent =
        "Lanjut Cetak";
    }
  }
);


/* =========================
   FORMAT MODAL
========================= */

closePrintModal.addEventListener(
  "click",
  () => {
    printModal.classList.add("hidden");
    printModal.classList.remove("flex");
  }
);


printModal.addEventListener(
  "click",
  (event) => {
    if (event.target === printModal) {
      printModal.classList.add("hidden");
      printModal.classList.remove("flex");
    }
  }
);


/* =========================
   PDF
========================= */

pdfBtn.addEventListener(
  "click",
  () => {
    printModal.classList.add("hidden");
    printModal.classList.remove("flex");

    // Salin kembali isi editor + tanda tangan ke preview utama
    output.textContent =
      printEditorText.textContent;

    if (signatureDataUrl) {
      injectSignatureIntoMainPreview();
    }

    window.print();
  }
);


/* =========================
   WORD
========================= */

wordBtn.addEventListener(
  "click",
  () => {
    const text =
      printEditorText.textContent.trim();

    let signatureHtml = "";

    if (signatureDataUrl) {
      signatureHtml = `
        <img
          src="${signatureDataUrl}"
          style="
            position:absolute;
            left:${signatureX}px;
            top:${signatureY}px;
            width:${signatureWidth}px;
            height:auto;
          "
        >
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">

        <style>
          @page {
            size:A4;
            margin:2cm;
          }

          body {
            font-family:
              Arial,
              Helvetica,
              sans-serif;

            font-size:11pt;
            line-height:1.5;
          }

          .page {
            position:relative;
            width:17cm;
            min-height:25cm;
          }

          .surat {
            white-space:pre-wrap;
            text-align:justify;
          }
        </style>
      </head>

      <body>

        <div class="page">

          <div class="surat">
            ${escapeHtml(text).replace(/\n/g, "<br>")}
          </div>

          ${signatureHtml}

        </div>

      </body>
      </html>
    `;

    const blob =
      new Blob(
        ["\ufeff", htmlContent],
        {
          type:
            "application/msword"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = "surat.doc";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    printModal.classList.add("hidden");
    printModal.classList.remove("flex");
  }
);


/* =========================
   SIGNATURE UNTUK PRINT
========================= */

function injectSignatureIntoMainPreview() {
  const oldSignature =
    document.getElementById(
      "mainPrintSignature"
    );

  if (oldSignature) {
    oldSignature.remove();
  }

  if (!signatureDataUrl) return;

  const img =
    document.createElement("img");

  img.id =
    "mainPrintSignature";

  img.src =
    signatureDataUrl;

  img.style.position =
    "absolute";

  img.style.left =
    `${signatureX}px`;

  img.style.top =
    `${signatureY}px`;

  img.style.width =
    `${signatureWidth}px`;

  img.style.height =
    "auto";

  img.style.zIndex =
    "10";

  document
    .getElementById("suratPreview")
    .appendChild(img);
}


/* =========================
   KEMBALI DARI MIDTRANS
========================= */

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const transactionStatus =
      params.get("transaction_status");

    const statusCode =
      params.get("status_code");

    const orderIdFromUrl =
      params.get("order_id");


    // RESTORE SIGNATURE
    const savedSignature =
      localStorage.getItem(
        "signatureDataUrl"
      );

    if (savedSignature) {
      signatureDataUrl =
        savedSignature;

      signatureX =
        Number(
          localStorage.getItem(
            "signatureX"
          ) || 80
        );

      signatureY =
        Number(
          localStorage.getItem(
            "signatureY"
          ) || 650
        );

      signatureWidth =
        Number(
          localStorage.getItem(
            "signatureWidth"
          ) || 150
        );

      editorSignatureImage.src =
        signatureDataUrl;

      signatureLayer.style.display =
        "block";

      signatureLayer.style.left =
        `${signatureX}px`;

      signatureLayer.style.top =
        `${signatureY}px`;

      signatureLayer.style.width =
        `${signatureWidth}px`;
    }


    if (
      transactionStatus === "settlement" ||
      statusCode === "200"
    ) {
      const orderId =
        orderIdFromUrl ||
        localStorage.getItem("orderId");

      if (!orderId) {
        showStatus(
          "Order ID tidak ditemukan.",
          "error"
        );

        return;
      }

      try {
        const response =
          await fetch(
            `/api/get-payment?order_id=${encodeURIComponent(orderId)}`
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Gagal mengambil draft surat."
          );
        }

        if (data.surat_text) {
          output.textContent =
            data.surat_text;

          printEditorText.textContent =
            data.surat_text;
        }

        localStorage.setItem(
          "paymentUnlocked",
          "true"
        );

        localStorage.setItem(
          "paidOrderId",
          orderId
        );

        printModal.classList.remove("hidden");
        printModal.classList.add("flex");

        showStatus(
          "Dokumen siap dicetak.",
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
  }
);


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
