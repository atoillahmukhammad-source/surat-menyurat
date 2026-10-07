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

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Konfigurasi Supabase belum lengkap."
      });
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/payments?order_id=eq.${encodeURIComponent(order_id)}&select=order_id,surat_text,payment_status`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Accept": "application/json"
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Supabase error:", data);

      return res.status(500).json({
        error: "Gagal mengambil draft surat."
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({
        error: "Draft surat tidak ditemukan."
      });
    }

    return res.status(200).json({
      order_id: data[0].order_id,
      surat_text: data[0].surat_text,
      payment_status: data[0].payment_status
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Terjadi kesalahan server."
    });
  }
}
