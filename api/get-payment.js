export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Metode tidak diizinkan."
    });
  }

  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({
        error: "Order ID tidak ditemukan."
      });
    }

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const midtransServerKey =
      process.env.MIDTRANS_SERVER_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey ||
      !midtransServerKey
    ) {
      return res.status(500).json({
        error: "Konfigurasi server belum lengkap."
      });
    }

    const supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/payments?order_id=eq.${encodeURIComponent(order_id)}&select=order_id,draft_id,surat_text,payment_status`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Authorization":
            `Bearer ${supabaseKey}`,
          "Accept": "application/json"
        }
      }
    );

    const rows =
      await supabaseResponse.json();

    if (!supabaseResponse.ok) {
      console.error(
        "Supabase GET error:",
        rows
      );

      return res.status(500).json({
        error: "Gagal mengambil data pembayaran."
      });
    }

    if (
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return res.status(404).json({
        error: "Transaksi tidak ditemukan."
      });
    }

    const payment =
      rows[0];

    if (!payment.draft_id) {
      return res.status(409).json({
        error:
          "Transaksi lama belum terhubung dengan draft_id.",
        order_id:
          payment.order_id,
        draft_id:
          null,
        payment_status:
          payment.payment_status || "pending"
      });
    }

    const auth =
      Buffer
        .from(`${midtransServerKey}:`)
        .toString("base64");

    const midtransResponse =
      await fetch(
        `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(order_id)}/status`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Basic ${auth}`,
            Accept:
              "application/json",
            "Content-Type":
              "application/json"
          }
        }
      );

    const midtransData =
      await midtransResponse.json();

    if (!midtransResponse.ok) {
      console.error(
        "Midtrans status error:",
        midtransData
      );

      return res.status(200).json({
        order_id:
          payment.order_id,
        draft_id:
          payment.draft_id,
        surat_text:
          payment.surat_text,
        payment_status:
          payment.payment_status || "pending"
      });
    }

    const transactionStatus =
      midtransData.transaction_status;

    const fraudStatus =
      midtransData.fraud_status;

    let paymentStatus =
      "pending";

    if (
      transactionStatus ===
      "settlement"
    ) {
      paymentStatus =
        "settlement";
    }

    else if (
      transactionStatus ===
      "capture" &&
      (
        !fraudStatus ||
        fraudStatus === "accept"
      )
    ) {
      paymentStatus =
        "capture";
    }

    else if (
      transactionStatus ===
      "pending"
    ) {
      paymentStatus =
        "pending";
    }

    else if (
      [
        "deny",
        "cancel",
        "expire",
        "failure",
        "refund",
        "partial_refund"
      ].includes(transactionStatus)
    ) {
      paymentStatus =
        transactionStatus;
    }

    if (
      payment.payment_status !==
      paymentStatus
    ) {
      const updateResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/payments?order_id=eq.${encodeURIComponent(order_id)}`,
          {
            method: "PATCH",
            headers: {
              "apikey":
                supabaseKey,
              "Authorization":
                `Bearer ${supabaseKey}`,
              "Content-Type":
                "application/json",
              "Prefer":
                "return=minimal"
            },
            body:
              JSON.stringify({
                payment_status:
                  paymentStatus
              })
          }
        );

      if (!updateResponse.ok) {
        const errorText =
          await updateResponse.text();

        console.error(
          "Supabase update error:",
          errorText
        );
      }
    }

    return res.status(200).json({
      order_id:
        payment.order_id,

      draft_id:
        payment.draft_id,

      surat_text:
        payment.surat_text,

      payment_status:
        paymentStatus,

      transaction_status:
        transactionStatus
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Terjadi kesalahan server."
    });
  }
}
