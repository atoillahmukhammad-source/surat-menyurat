document
  .getElementById("generateBtn")
  .addEventListener("click", () => {

    const jenis = document.getElementById("jenis").value;
    const nama = document.getElementById("nama").value.trim();
    const penerima = document.getElementById("penerima").value.trim();
    const detail = document.getElementById("detail").value.trim();

    if (!nama || !penerima || !detail) {
      alert("Mohon lengkapi semua data terlebih dahulu.");
      return;
    }

    let isiSurat = "";

    if (jenis === "Surat Lamaran Kerja") {

      isiSurat = `
SURAT LAMARAN KERJA

Kepada Yth.
${penerima}

Dengan hormat,

Saya yang bertanda tangan di bawah ini:

Nama: ${nama}

Dengan ini bermaksud mengajukan lamaran pekerjaan kepada ${penerima}.

Adapun informasi tambahan yang ingin saya sampaikan adalah:

${detail}

Saya berharap dapat diberikan kesempatan untuk mengikuti proses seleksi lebih lanjut.

Demikian surat lamaran ini saya sampaikan. Atas perhatian dan kesempatan yang diberikan, saya mengucapkan terima kasih.

Hormat saya,

${nama}
`;

    } else if (jenis === "Surat Izin Kerja") {

      isiSurat = `
SURAT IZIN KERJA

Kepada Yth.
${penerima}

Dengan hormat,

Saya yang bertanda tangan di bawah ini:

Nama: ${nama}

Dengan ini bermaksud mengajukan izin untuk tidak dapat menjalankan pekerjaan sebagaimana mestinya.

Alasan/keterangan:

${detail}

Demikian surat izin ini saya sampaikan. Atas perhatian dan pengertiannya, saya mengucapkan terima kasih.

Hormat saya,

${nama}
`;

    } else if (jenis === "Surat Pengunduran Diri") {

      isiSurat = `
SURAT PENGUNDURAN DIRI

Kepada Yth.
${penerima}

Dengan hormat,

Saya yang bertanda tangan di bawah ini:

Nama: ${nama}

Dengan surat ini bermaksud menyampaikan pengunduran diri saya.

Keterangan:

${detail}

Saya mengucapkan terima kasih atas kesempatan, pengalaman, dan kepercayaan yang telah diberikan selama ini.

Demikian surat pengunduran diri ini saya sampaikan dengan sebenar-benarnya.

Hormat saya,

${nama}
`;

    }

    document.getElementById("output").textContent = isiSurat;

  });
