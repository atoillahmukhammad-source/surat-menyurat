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

    /* =========================================
       ENVIRONMENT VARIABLES
    ========================================= */

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const midtransServerKey =
      process.env.MIDTRANS_SERVER_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Konfigurasi Supabase belum lengkap."
      });
    }

    if (!midtransServerKey) {
      return res.status(500).json({
        error: "MIDTRANS_SERVER_KEY belum tersedia."
      });
    }

    /* =========================================
       1. AMBIL DATA DRAFT DARI SUPABASE
    ========================================= */

    const supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/payments?order_id=eq.${encodeURIComponent(order_id)}&select=order_id,surat_text,payment_status`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json"
        }
      }
    );

    const paymentRows =
      await supabaseResponse.json();

    if (!supabaseResponse.ok) {
      console.error(
        "Supabase GET error:",
        paymentRows
      );

      return res.status(500).json({
        error: "Gagal mengambil data pembayaran."
      });
    }

    if (
      !Array.isArray(paymentRows) ||
      paymentRows.length === 0
    ) {
      return res.status(404).json({
        error: "Draft atau transaksi tidak ditemukan."
      });
    }

    const payment =
      paymentRows[0];

    /* =========================================
       2. CEK STATUS LANGSUNG KE MIDTRANS
    ========================================= */

    const auth =
      Buffer
        .from(`${midtransServerKey}:`)
        .toString("base64");

    /*
      Karena saat ini Anda menggunakan Sandbox.
      Saat production nanti endpoint ini diganti menjadi:
      https://api.midtrans.com/v2/...
    */

    const midtransResponse = await fetch(
      `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(order_id)}/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          "Content-Type": "application/json"
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

      /*
        Jika Midtrans sementara gagal dibaca,
        jangan langsung merusak transaksi.

        Kita masih kembalikan status terakhir
        yang tersimpan di Supabase.
      */

      return res.status(200).json({
        order_id: payment.order_id,
        surat_text: payment.surat_text,
        payment_status:
          payment.payment_status || "pending",

        midtrans_check: "failed"
      });
    }

    /* =========================================
       3. BACA STATUS MIDTRANS
    ========================================= */

    const transactionStatus =
      midtransData.transaction_status;

    const fraudStatus =
      midtransData.fraud_status;

    let paymentStatus = "pending";

    /*
      Settlement:
      pembayaran selesai.
    */

    if (
      transactionStatus === "settlement"
    ) {
      paymentStatus = "settlement";
    }

    /*
      Capture:
      biasanya kartu kredit.

      Hanya dianggap sukses jika fraud_status
      accept atau tidak tersedia.
    */

    else if (
      transactionStatus === "capture" &&
      (
        !fraudStatus ||
        fraudStatus === "accept"
      )
    ) {
      paymentStatus = "capture";
    }

    /*
      Pending:
      pembayaran belum selesai.
    */

    else if (
      transactionStatus === "pending"
    ) {
      paymentStatus = "pending";
    }

    /*
      Berbagai kondisi gagal.
    */

    else if (
      [
        "deny",
        "cancel",
        "expire",
        "failure"
      ].includes(transactionStatus)
    ) {
      paymentStatus =
        transactionStatus;
    }

    /*
      Refund tetap dicatat.
    */

    else if (
      [
        "refund",
        "partial_refund"
      ].includes(transactionStatus)
    ) {
      paymentStatus =
        transactionStatus;
    }

    /* =========================================
       4. UPDATE STATUS DI SUPABASE
    ========================================= */

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
              apikey:
                supabaseKey,

              Authorization:
                `Bearer ${supabaseKey}`,

              "Content-Type":
                "application/json",

              Prefer:
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
        const updateError =
          await updateResponse.text();

        console.error(
          "Supabase UPDATE error:",
          updateError
        );

        /*
          Tidak perlu menggagalkan respons,
          karena Midtrans sendiri sudah memberi
          status pembayaran yang valid.
        */
      }
    }

    /* =========================================
       5. KIRIM STATUS TERBARU KE FRONTEND
    ========================================= */

    return res.status(200).json({
      order_id:
        payment.order_id,

      surat_text:
        payment.surat_text,

      payment_status:
        paymentStatus,

      transaction_status:
        transactionStatus
    });

  } catch (error) {
    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      error:
        "Terjadi kesalahan saat memeriksa pembayaran."
    });
  }
}
