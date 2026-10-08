export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metode tidak diizinkan."
    });
  }

  try {
    const {
      surat_text,
      draft_id
    } = req.body || {};

    if (!surat_text) {
      return res.status(400).json({
        error: "Draft surat tidak ditemukan."
      });
    }

    if (!draft_id) {
      return res.status(400).json({
        error: "Draft ID tidak ditemukan."
      });
    }

    const serverKey =
      process.env.MIDTRANS_SERVER_KEY;

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !serverKey ||
      !supabaseUrl ||
      !supabaseKey
    ) {
      return res.status(500).json({
        error: "Konfigurasi server belum lengkap."
      });
    }

    const orderId =
      "SURAT-" + Date.now();

    // SIMPAN DRAFT KE SUPABASE
    const saveResponse = await fetch(
      `${supabaseUrl}/rest/v1/payments`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "apikey":
            supabaseKey,

          "Authorization":
            `Bearer ${supabaseKey}`,

          "Prefer":
            "return=minimal"
        },

        body: JSON.stringify({
          order_id: orderId,
          draft_id: draft_id,
          surat_text: surat_text,
          payment_status: "pending"
        })
      }
    );

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();

      console.error(
        "Supabase error:",
        errorText
      );

      return res.status(500).json({
        error: `Supabase: ${errorText}`
      });
    }

    // BUAT TRANSAKSI MIDTRANS
    const auth =
      Buffer
        .from(serverKey + ":")
        .toString("base64");

    const response =
      await fetch(
        "https://app.sandbox.midtrans.com/snap/v1/transactions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json",

            "Authorization":
              `Basic ${auth}`
          },

          body: JSON.stringify({
            transaction_details: {
              order_id: orderId,
              gross_amount: 3000
            },

            item_details: [
              {
                id: "surat-download",
                price: 3000,
                quantity: 1,
                name:
                  "Download Surat Word + PDF"
              }
            ]
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      return res
        .status(response.status)
        .json({
          error:
            data?.error_messages?.[0] ||
            "Gagal membuat transaksi Midtrans."
        });
    }

    return res.status(200).json({
      token:
        data.token,

      redirect_url:
        data.redirect_url,

      order_id:
        orderId,

      draft_id:
        draft_id
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Terjadi kesalahan server."
    });
  }
}
