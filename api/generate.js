export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metode tidak diizinkan."
    });
  }

  try {
    const {
      jenis,
      nama,
      penerima,
      detail
    } = req.body || {};

    if (!jenis || !nama || !penerima || !detail) {
      return res.status(400).json({
        error: "Data surat belum lengkap."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum tersedia di server."
      });
    }

    const prompt = `
Anda adalah asisten profesional untuk menyusun surat berbahasa Indonesia.

Buat surat berdasarkan data berikut:

Jenis surat:
${jenis}

Nama pengirim:
${nama}

Penerima atau instansi:
${penerima}

Informasi kebutuhan surat:
${detail}

Ketentuan:
- gunakan bahasa Indonesia formal, profesional, natural, dan mudah dipahami
- perbaiki ejaan dan tata bahasa bila diperlukan
- jangan mengarang informasi yang tidak diberikan pengguna
- jangan membuat alamat, tanggal, jabatan, atau nomor surat yang tidak tersedia
- struktur surat harus menyesuaikan jenis surat
- jangan menggunakan markdown
- jangan memberikan penjelasan sebelum atau sesudah surat
- langsung berikan naskah surat siap digunakan
`;

    const models = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash-lite"
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 2500
              }
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          const text =
            data?.candidates?.[0]
              ?.content
              ?.parts
              ?.map(part => part.text || "")
              .join("")
              .trim();

          if (text) {
            return res.status(200).json({
              result: text,
              model
            });
          }
        }

        lastError =
          data?.error?.message ||
          `Model ${model} gagal memproses permintaan.`;

        console.error(
          `Gemini ${model} error:`,
          JSON.stringify(data)
        );

      } catch (error) {
        lastError = error.message;

        console.error(
          `Error ${model}:`,
          error
        );
      }
    }

    return res.status(503).json({
      error:
        lastError ||
        "Semua model AI sedang sibuk. Silakan coba lagi beberapa saat."
    });

  } catch (error) {
    console.error(
      "Server error:",
      error
    );

    return res.status(500).json({
      error: "Terjadi kesalahan pada server."
    });
  }
}
