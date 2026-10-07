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
- gunakan bahasa Indonesia yang formal, natural, dan profesional
- jangan mengarang informasi yang tidak diberikan pengguna
- perbaiki tata bahasa pengguna apabila diperlukan
- susun surat secara lengkap
- hindari kalimat berlebihan
- jangan menggunakan markdown
- langsung tampilkan isi surat
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-6-luna",
          input: prompt
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gagal menghubungi AI"
      });
    }

    // Ambil teks dari Responses API
    const text =
      data.output
        ?.flatMap(item => item.content || [])
        ?.find(item => item.type === "output_text")
        ?.text;

    if (!text) {
      return res.status(500).json({
        error: "AI tidak menghasilkan teks"
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
