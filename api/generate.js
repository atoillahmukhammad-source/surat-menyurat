export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metode tidak diizinkan."
    });
  }

  try {
    const { jenis, nama, penerima, detail } = req.body || {};

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

    const models = [
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite"
    ];

    const prompt = `
Buat hanya naskah surat final berbahasa Indonesia.

Jenis surat:
${jenis}

Nama pengirim:
${nama}

Penerima:
${penerima}

Detail:
${detail}

ATURAN:
- langsung tulis isi surat
- jangan menulis "Berikut suratnya", "Tentu", "Catatan", atau penjelasan lain
- jangan menggunakan markdown
- gunakan bahasa formal, natural, profesional, dan ringkas
- jangan mengarang data yang tidak diberikan
- jangan membuat placeholder seperti [tanggal], [alamat], [jabatan], dan sejenisnya
- hindari pengulangan
- surat boleh singkat jika memang jenis suratnya sederhana
- yang penting surat harus lengkap sampai salam penutup dan nama pengirim
- jangan berhenti di tengah kalimat
- jangan menyebut AI, Gemini, atau aplikasi

FORMAT:
- penerima:
Yth. ${penerima}
di tempat

- salam pembuka:
Dengan hormat,

- isi surat disusun dalam paragraf pendek dan rapi
- penutup harus lengkap
- akhir surat:
Hormat saya,

${nama}
`;

    async function callGemini(model, textPrompt) {
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
                    text: textPrompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2200
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          `Model ${model} gagal.`
        );
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

      return text || "";
    }

    function cleanText(text) {
      return text
        .replace(/^Tentu[,!.]?\s*/i, "")
        .replace(/^Baik[,!.]?\s*/i, "")
        .replace(/^Berikut(?: adalah)?(?: contoh)? surat[^:\n]*[:\n]\s*/i, "")
        .replace(/\*\*/g, "")
        .replace(/```/g, "")
        .trim();
    }

    function looksComplete(text) {
      const trimmed = text.trim();

      return (
        /Hormat saya/i.test(trimmed) &&
        trimmed.toLowerCase().includes(nama.toLowerCase())
      );
    }

    let lastError = "Gemini gagal menghasilkan surat.";

    for (const model of models) {
      try {
        let text = cleanText(
          await callGemini(model, prompt)
        );

        if (!text) {
          lastError = `Model ${model} tidak menghasilkan teks.`;
          continue;
        }

        if (!looksComplete(text)) {
          const continuationPrompt = `
Lanjutkan naskah surat berikut sampai benar-benar selesai.

JANGAN mengulang bagian yang sudah ada.
JANGAN menambahkan penjelasan.
Langsung lanjutkan dari kalimat terakhir.
Pastikan surat berakhir dengan:

Hormat saya,

${nama}

Naskah saat ini:

${text}
`;

          const continuation = cleanText(
            await callGemini(model, continuationPrompt)
          );

          if (continuation) {
            text = `${text}\n${continuation}`.trim();
          }
        }

        if (!looksComplete(text)) {
          lastError =
            `Model ${model} masih menghasilkan surat yang belum lengkap.`;
          continue;
        }

        return res.status(200).json({
          result: text
        });

      } catch (error) {
        console.error(`Error ${model}:`, error);

        lastError =
          error.message ||
          `Model ${model} gagal.`;
      }
    }

    return res.status(503).json({
      error: lastError
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server."
    });
  }
}
