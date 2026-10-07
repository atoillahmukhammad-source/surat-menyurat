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

    const prompt = `
Buat hanya naskah surat final berbahasa Indonesia berdasarkan data berikut.

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
- gunakan bahasa formal, natural, dan ringkas
- jangan mengarang data yang tidak diberikan
- jangan membuat placeholder seperti [tanggal], [alamat], atau [jabatan]
- hindari pengulangan
- utamakan agar surat muat dalam 1 halaman A4
- panjang ideal sekitar 300–450 kata
- surat harus lengkap sampai bagian penutup dan nama pengirim
- jangan berhenti di tengah kalimat
- pastikan ada pembuka, isi utama, penutup, dan salam penutup
- jika detail terlalu panjang, rangkum secara efektif
- jangan menyebut AI, , atau aplikasi
- DILARANG membuat placeholder dalam bentuk apa pun, termasuk teks dalam tanda [ ].
- Surat HARUS diprioritaskan selesai dalam 1 halaman A4.
- Batasi isi sekitar 200–280 kata.
- Maksimal 5 paragraf utama.
- Jangan membuat daftar lampiran kecuali pengguna secara eksplisit memberikan daftar lampiran.
- Jangan menambahkan data atau persyaratan lamaran yang tidak diberikan pengguna.
- Ringkas pengalaman pengguna menjadi maksimal 1 paragraf.
- surat boleh singkat jika jenis surat tidak membutuhkan uraian panjang
- jangan memaksakan panjang minimum
- yang terpenting surat harus lengkap sampai salam penutup dan nama pengirim

FORMAT WAJIB:

- Susun teks secara rapi tanpa indentasi di awal paragraf.
- Gunakan satu baris kosong antarbagian utama.
- Jangan menggunakan tab atau spasi berlebihan.

Bagian penerima:

Yth. [Penerima]
di tempat

Jika ada identitas, gunakan:

Nama : ...
Nomor Telepon : ...
Surel : ...

Salam pembuka:

Dengan hormat,

Bagian penutup:

Hormat saya,

[Nama]

- Jangan membuat teks rata tengah.
- Jangan menambahkan simbol atau dekorasi.

Untuk surat lamaran kerja, susun dengan urutan:
1. Penerima
2. Salam pembuka
3. Maksud melamar
4. Identitas jika memang diberikan
5. Pengalaman/kompetensi
6. Penutup
7. Salam penutup dan nama
`;

const models = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite"
];

    let lastError = "Gemini sedang tidak tersedia.";

    for (const model of models) {
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
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 3000
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        lastError =
          data?.error?.message ||
          `Model ${model} gagal.`;
        continue;
      }

      let text =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

if (!/[.!?]\s*$/.test(text)) {
  lastError =
    `Model ${model} menghasilkan surat yang belum selesai.`;

  continue;
}

      text = text
        .replace(/^Tentu[,!.]?\s*/i, "")
        .replace(/^Baik[,!.]?\s*/i, "")
        .replace(/^Berikut(?: adalah)?(?: contoh)? surat[^:\n]*[:\n]\s*/i, "")
        .replace(/\*\*/g, "")
        .replace(/```/g, "")
        .trim();

      return res.status(200).json({
        result: text
      });
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
