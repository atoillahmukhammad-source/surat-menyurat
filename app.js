const generateBtn =
  document.getElementById("generateBtn");

const output =
  document.getElementById("output");

generateBtn.addEventListener(
  "click",
  async () => {

    const jenis =
      document.getElementById("jenis").value;

    const nama =
      document.getElementById("nama").value.trim();

    const penerima =
      document.getElementById("penerima").value.trim();

    const detail =
      document.getElementById("detail").value.trim();

    if (!nama || !penerima || !detail) {
      alert(
        "Mohon lengkapi semua data terlebih dahulu."
      );
      return;
    }

    // Loading
    generateBtn.disabled = true;

    generateBtn.textContent =
      "⏳ AI sedang membuat surat...";

    output.textContent =
      "Sedang menyusun surat...";

    try {

      const response =
        await fetch("/api/generate", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
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
          "Gagal membuat surat"
        );
      }

      output.textContent =
        data.result;

    } catch (error) {

      console.error(error);

      output.textContent =
        "Terjadi kesalahan:\n\n" +
        error.message;

    } finally {

      generateBtn.disabled =
        false;

      generateBtn.textContent =
        "✨ Buat Surat dengan AI";

    }
  }
);
