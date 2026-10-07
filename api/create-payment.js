export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metode tidak diizinkan."
    });
  }

  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
      return res.status(500).json({
        error: "MIDTRANS_SERVER_KEY belum tersedia."
      });
    }

    const orderId =
      "SURAT-" + Date.now();

    const auth =
      Buffer.from(serverKey + ":").toString("base64");

    const response = await fetch(
      "https://app.sandbox.midtrans.com/snap/v1/transactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Basic ${auth}`
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
              name: "Download Surat Word + PDF"
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error_messages?.[0] ||
          "Gagal membuat transaksi Midtrans."
      });
    }

    return res.status(200).json({
      token: data.token,
      redirect_url: data.redirect_url,
      order_id: orderId
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Terjadi kesalahan server."
    });
  }
}
