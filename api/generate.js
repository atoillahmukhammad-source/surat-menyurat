export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { jenis, nama, penerima, detail } = req.body;

    if (!jenis || !nama || !penerima || !detail) {
      return res.status(400).json({
        error: "Data belum lengkap"
      });
    }

    const prompt = `
Anda adalah asisten penulisan surat profesional berbahasa Indonesia.

Buat sebuah ${jenis} berdasarkan data berikut:

Nama pengirim:
${nama}

Penerima:
${penerima}

Informasi/kebutuhan surat:
${detail}

Ketentuan:
- gunakan bahasa Indonesia formal dan natural
- jangan mengarang informasi yang tidak diberikan
- perbaiki tata bahasa jika perlu
- susun surat secara lengkap
- jangan menggunakan markdown
- langsung tampilkan isi surat
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gagal menghubungi Gemini"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        error: "Gemini tidak menghasilkan teks"
      });
    }

    return res.status(200).json({
      result: text
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Terjadi kesalahan server"
    });
  }
}
