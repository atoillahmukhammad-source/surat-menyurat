const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");

const output = document.getElementById("output");

const copyBtn = document.getElementById("copyBtn");
const editBtn = document.getElementById("editBtn");
const printBtn = document.getElementById("printBtn");

const statusBox = document.getElementById("status");


function showStatus(message, type = "info") {

  statusBox.className =
    "mt-4 p-3 rounded-lg text-sm";

  if (type === "error") {
    statusBox.classList.add(
      "bg-red-100",
      "text-red-700"
    );
  }

  else if (type === "success") {
    statusBox.classList.add(
      "bg-green-100",
      "text-green-700"
    );
  }

  else {
    statusBox.classList.add(
      "bg-blue-100",
      "text-blue-700"
    );
  }

  statusBox.textContent = message;
}


async function generateSurat() {

  const jenis =
    document.getElementById("jenis").value;

  const nama =
    document.getElementById("nama").value.trim();

  const penerima =
    document.getElementById("penerima").value.trim();

  const detail =
    document.getElementById("detail").value.trim();


  if (!nama || !penerima || !detail) {

    showStatus(
      "Mohon lengkapi semua data terlebih dahulu.",
      "error"
    );

    return;
  }


  generateBtn.disabled = true;

  generateBtn.textContent =
    "⏳ AI sedang menyusun surat...";

  output.textContent =
    "Sedang menyusun surat...";


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


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal membuat surat."
      );

    }


    output.textContent =
      data.result;


    showStatus(
      "Surat berhasil dibuat.",
      "success"
    );


  }

  catch (error) {

    console.error(error);

    output.textContent =
      "Surat belum berhasil dibuat.";

    showStatus(
      error.message,
      "error"
    );

  }

  finally {

    generateBtn.disabled = false;

    generateBtn.textContent =
      "✨ Buat Surat dengan AI";

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



copyBtn.addEventListener(
  "click",
  async () => {

    const text =
      output.innerText.trim();

    if (
      !text ||
      text === "Hasil surat akan muncul di sini..."
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

    }

    catch {

      showStatus(
        "Gagal menyalin surat.",
        "error"
      );

    }

  }
);



editBtn.addEventListener(
  "click",
  () => {

    const editable =
      output.getAttribute("contenteditable");

    if (editable === "true") {

      output.setAttribute(
        "contenteditable",
        "false"
      );

      editBtn.textContent =
        "✏️ Edit";

      output.classList.remove(
        "ring-2",
        "ring-blue-300",
        "p-2"
      );

      showStatus(
        "Perubahan selesai.",
        "success"
      );

    }

    else {

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

  }
);



printBtn.addEventListener(
  "click",
  () => {

    window.print();

  }
);
