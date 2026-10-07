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


    if (
      !jenis ||
      !nama ||
      !penerima ||
      !detail
    ) {

      return res.status(400).json({
        error: "Data surat belum lengkap."
      });

    }


    const apiKey =
      process.env.GEMINI_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        error:
          "GEMINI_API_KEY belum tersedia di Vercel."
      });

    }


    const prompt = `
Anda adalah asisten profesional untuk menyusun surat berbahasa Indonesia.

Tugas Anda adalah membuat surat berikut:

Jenis surat:
${jenis}

Nama pengirim:
${nama}

Penerima atau instansi:
${penerima}

Informasi yang diberikan pengguna:
${detail}


ATURAN PENULISAN:

1. Gunakan bahasa Indonesia yang formal, profesional, natural, dan mudah dipahami.

2. Perbaiki ejaan dan tata bahasa pengguna jika diperlukan.

3. Jangan mengarang data faktual yang tidak diberikan pengguna.

4. Jika tanggal, alamat, jabatan, nomor surat, atau informasi lain tidak diberikan, jangan membuat data palsu.

5. Struktur surat harus sesuai dengan jenis surat.

6. Jangan menggunakan markdown.

7. Jangan menggunakan tanda pagar, tanda bintang, atau format seperti **tebal**.

8. Jangan memberikan penjelasan sebelum atau sesudah surat.

9. Langsung berikan isi surat yang siap digunakan.

10. Hindari bahasa yang terlalu kaku atau berlebihan.

11. Jika informasi pengguna kurang lengkap, susun surat terbaik berdasarkan informasi yang tersedia tanpa mengarang data.

Sekarang buat surat tersebut.
`;


    const geminiResponse =
      await fetch(

        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,

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


    const data =
      await geminiResponse.json();


    if (!geminiResponse.ok) {

      console.error(
        "Gemini API error:",
        JSON.stringify(data)
      );


      return res.status(
        geminiResponse.status
      ).json({

        error:
          data?.error?.message ||
          "Gemini API gagal memproses permintaan."

      });

    }


    const text =
      data?.candidates?.[0]
        ?.content
        ?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();


    if (!text) {

      console.error(
        "Gemini response kosong:",
        JSON.stringify(data)
      );


      return res.status(500).json({

        error:
          "Gemini tidak menghasilkan teks."

      });

    }


    return res.status(200).json({

      result: text

    });


  }

  catch (error) {

    console.error(
      "Server error:",
      error
    );


    return res.status(500).json({

      error:
        "Terjadi kesalahan pada server."

    });

  }

}
