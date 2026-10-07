const generateBtn = document.getElementById("generateBtn");
const output = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");
const statusBox = document.getElementById("status");

function showStatus(message, type = "info") {

  statusBox.classList.remove(
    "hidden",
    "bg-red-100",
    "text-red-700",
    "bg-green-100",
    "text-green-700",
    "bg-blue-100",
    "text-blue-700"
  );

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


generateBtn.addEventListener("click", async () => {

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
      "Mohon lengkapi nama, penerima, dan detail surat.",
      "error"
    );

    return;
  }


  generateBtn.disabled = true;

  generateBtn.textContent =
    "⏳ Gemini sedang menyusun surat...";

  output.textContent =
    "Sedang menyusun surat...";

  showStatus(
    "Permintaan sedang diproses oleh Gemini.",
    "info"
  );


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

});


copyBtn.addEventListener("click", async () => {

  const text =
    output.textContent.trim();


  if (
    !text ||
    text === "Hasil surat akan muncul di sini..." ||
    text === "Surat belum berhasil dibuat."
  ) {

    showStatus(
      "Belum ada surat yang dapat disalin.",
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

  catch (error) {

    showStatus(
      "Gagal menyalin surat.",
      "error"
    );

  }

});
