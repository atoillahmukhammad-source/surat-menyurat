const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");

const output = document.getElementById("output");

const copyBtn = document.getElementById("copyBtn");
const editBtn = document.getElementById("editBtn");
const printBtn = document.getElementById("printBtn");

const printModal = document.getElementById("printModal");
const closePrintModal = document.getElementById("closePrintModal");
const wordBtn = document.getElementById("wordBtn");
const pdfBtn = document.getElementById("pdfBtn");

const statusBox = document.getElementById("status");


function showStatus(message, type = "info") {
  statusBox.className = "mt-4 p-3 rounded-lg text-sm";

  if (type === "error") {
    statusBox.classList.add(
      "bg-red-100",
      "text-red-700"
    );
  } else if (type === "success") {
    statusBox.classList.add(
      "bg-green-100",
      "text-green-700"
    );
  } else {
    statusBox.classList.add(
      "bg-blue-100",
      "text-blue-700"
    );
  }

  statusBox.textContent = message;
}


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

    showStatus(
      "Surat berhasil dibuat.",
      "success"
    );

  } catch (error) {
    console.error(error);

    output.textContent = "Surat belum berhasil dibuat.";

    showStatus(
      error.message,
      "error"
    );

  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "✨ Buat Surat dengan AI";
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


// SALIN
copyBtn.addEventListener(
  "click",
  async () => {
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
  }
);


// EDIT
editBtn.addEventListener(
  "click",
  () => {
    const editable = output.getAttribute("contenteditable");

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

      editBtn.textContent = "💾 Selesai Edit";

      showStatus(
        "Anda sekarang dapat mengedit isi surat.",
        "info"
      );
    }
  }
);


// CETAK -> BAYAR MIDTRANS
printBtn.addEventListener(
  "click",
  async () => {
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

    try {
      printBtn.disabled = true;
      printBtn.textContent = "⏳ Membuat pembayaran...";

const response = await fetch(
  "/api/create-payment",
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      surat_text: text
    })
  }
);

      const data = await response.json();

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

      // Simpan surat sementara
     localStorage.setItem(
        "suratSetelahBayar",
        text
      );

      sessionStorage.setItem(
        "orderId",
        data.order_id || ""
      );

      // Redirect langsung ke Midtrans
      window.location.href =
        data.redirect_url;

    } catch (error) {
      console.error(error);

      showStatus(
        error.message,
        "error"
      );

      printBtn.disabled = false;
      printBtn.textContent = "🖨️ Cetak";
    }
  }
);


// TUTUP POPUP
if (closePrintModal) {
  closePrintModal.addEventListener(
    "click",
    () => {
      printModal.classList.add("hidden");
      printModal.classList.remove("flex");
    }
  );
}


// TUTUP SAAT KLIK AREA GELAP
if (printModal) {
  printModal.addEventListener(
    "click",
    (event) => {
      if (event.target === printModal) {
        printModal.classList.add("hidden");
        printModal.classList.remove("flex");
      }
    }
  );
}


// PDF
if (pdfBtn) {
  pdfBtn.addEventListener(
    "click",
    () => {
      printModal.classList.add("hidden");
      printModal.classList.remove("flex");

      window.print();
    }
  );
}


// WORD
if (wordBtn) {
  wordBtn.addEventListener(
    "click",
    () => {
      const text = output.innerText.trim();

      if (
        !text ||
        text === "Hasil surat akan muncul di sini..."
      ) {
        showStatus(
          "Belum ada surat untuk diunduh.",
          "error"
        );

        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">

          <style>
            @page {
              size: A4;
              margin: 2cm;
            }

            body {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11pt;
              line-height: 1.5;
            }

            .surat {
              white-space: pre-wrap;
              text-align: justify;
            }
          </style>
        </head>

        <body>
          <div class="surat">
            ${escapeHtml(text).replace(/\n/g, "<br>")}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(
        ["\ufeff", htmlContent],
        {
          type: "application/msword"
        }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "surat.doc";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      printModal.classList.add("hidden");
      printModal.classList.remove("flex");

      showStatus(
        "File Word berhasil dibuat.",
        "success"
      );
    }
  );
}
// PULIHKAN DRAFT SETELAH KEMBALI DARI MIDTRANS
window.addEventListener("DOMContentLoaded", () => {
  const savedSurat =
    localStorage.getItem("suratSetelahBayar");

  if (savedSurat) {
    output.textContent = savedSurat;

    showStatus(
      "Draft surat berhasil dipulihkan setelah pembayaran.",
      "success"
    );
  }

  const params =
    new URLSearchParams(window.location.search);

  const transactionStatus =
    params.get("transaction_status");

  const statusCode =
    params.get("status_code");

  if (
    transactionStatus === "settlement" ||
    statusCode === "200"
  ) {
    if (printModal) {
      printModal.classList.remove("hidden");
      printModal.classList.add("flex");
    }

    showStatus(
      "Pembayaran berhasil. Silakan pilih Word atau PDF.",
      "success"
    );
  }
});

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
