const ANSWERS: { question: string; answer: string }[] = [
  {
    question: "Untuk siapa Rintisin AI?",
    answer:
      "Perintis yang belum produksi massal dan masih menimbang apakah idenya layak, serta pemilik kedai atau toko fisik yang ingin tahu celah kompetitor di sekitarnya.",
  },
  {
    question: "Apa yang diperhitungkan dari kondisi Indonesia?",
    answer:
      "Ongkir dan ekspedisi lokal, daya beli kota target, komisi marketplace dan ojek online, serta perizinan NIB, PIRT, dan Halal.",
  },
  {
    question: "Dari mana data ulasan kompetitor diambil?",
    answer:
      "Dari ulasan publik pada tautan Google Maps yang Anda tempel sendiri, maksimal tiga kompetitor per analisis. Ulasan diambil sebagai sampel terstratifikasi, bukan seluruh ulasan.",
  },
  {
    question: "Apakah hasil AI bisa salah?",
    answer:
      "Bisa. Hasil AI adalah estimasi untuk diuji, bukan kepastian. Angka kunci seperti margin kotor dihitung sistem, bukan dikarang model, dan setiap respons divalidasi skema sebelum ditampilkan.",
  },
  {
    question: "Apa yang dibutuhkan untuk mulai?",
    answer:
      "Email dan kata sandi, lalu deskripsi ide produk, kategori ekraf, perkiraan modal awal, dan kota target. Untuk PetaSaingan Ekraf: satu sampai tiga tautan Google Maps.",
  },
];

/**
 * The dealt proof section was "One quiet logo row". There are no customers, and inventing proof is
 * forbidden, so the role is filled with the FAQ geometry instead: every answer open, questions
 * large on the left as a scannable index, answers small beside them. Honest content only.
 */
export function Answers() {
  return (
    <section className="section" aria-labelledby="sebelum-mulai-judul" id="sebelum-mulai">
      <div className="frame">
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-[var(--gutter)]">
          <h2
            id="sebelum-mulai-judul"
            className="head text-ink-muted lg:col-span-6 lg:col-start-1"
            data-reveal
          >
            Sebelum mulai
          </h2>
        </div>

        {ANSWERS.map((item, index) => (
          <div
            key={item.question}
            className="mt-14 lg:mt-20 lg:grid lg:grid-cols-12 lg:gap-x-[var(--gutter)]"
            data-reveal
            style={{ "--d": `${Math.min(index, 3) * 60}ms` } as React.CSSProperties}
          >
            <h3 className="head lg:col-span-6 lg:col-start-1">{item.question}</h3>
            <p className="mt-3 max-w-[40ch] lg:col-span-5 lg:col-start-8 lg:mt-0">{item.answer}</p>
          </div>
        ))}
      </div>

    </section>
  );
}
