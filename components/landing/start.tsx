/**
 * cta — "First step, already open". The page ends with the product's first screen already open on
 * a full-bleed field in the accent colour: the real first step of Modul 1, at interface size, in a
 * dialog whose root carries data-ui (so its own border, radii and the shadow an open dialog casts
 * are correct inside it).
 *
 * It is a plain form with method="get" pointing at /daftar, so it works with no JavaScript at all:
 * what the visitor types and chooses is carried into sign-up as query parameters. The field holds
 * the product's own worked example, editable.
 */
export function Start() {
  return (
    <section
      className="relative flex flex-col justify-end bg-brand-fill px-[var(--margin)] pt-24 pb-[var(--margin)] lg:min-h-[76svh] lg:pt-0"
      aria-labelledby="mulai"
    >
      <div className="frame w-full px-0 lg:grid lg:min-h-[76svh] lg:grid-cols-12 lg:items-end lg:gap-x-[var(--gutter)] lg:py-[var(--margin)]">
        {/* The closing line, anchored bottom-left. The upper-left stays empty. */}
        <div className="order-2 lg:order-1 lg:col-span-6 lg:col-start-1">
          <h2
            id="mulai"
            className="display lines max-w-[13ch] leading-[0.92] text-on-brand"
          >
            <span className="line">
              <span data-line style={{ "--i": 0 } as React.CSSProperties}>
                Audit dulu,
              </span>
            </span>
            <span className="line">
              <span data-line style={{ "--i": 1 } as React.CSSProperties}>
                produksi nanti.
              </span>
            </span>
          </h2>
          <p className="mt-6 max-w-[42ch] text-on-brand" data-reveal>
            Tombol ini membawa ide yang Anda tulis ke halaman daftar. Setelah akun jadi, Modul 1
            langsung mengaudit margin, risiko, dan kesiapan rilisnya.
          </p>
        </div>

        {/* The product's own first step, open. */}
        <div
          className="order-1 mb-14 lg:order-2 lg:col-span-5 lg:col-start-8 lg:mb-0 lg:self-center lg:justify-self-end"
          data-reveal
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          <form
            action="/daftar"
            method="get"
            data-ui
            className="ui-edge ui-open w-full max-w-[440px] p-5 sm:p-6"
          >
            <p className="ui-title">Mulai dari ide Anda</p>
            <p className="ui-label mt-1">
              Satu baris tentang produk yang ingin Anda uji. Bisa diubah nanti.
            </p>

            <div className="mt-5">
              <label className="ui-label block" htmlFor="mulai-ide">
                Draf ide produk
              </label>
              <textarea
                id="mulai-ide"
                name="ide"
                rows={3}
                className="field mt-1.5 h-auto resize-none py-2 leading-5"
                defaultValue="Sambal bawang rendah kalori kemasan 150g, minyak kelapa murni, tanpa MSG."
              />
            </div>

            <fieldset className="mt-5 border-0 p-0">
              <legend className="ui-label">Mulai dari modul</legend>
              <div className="segment mt-1.5">
                <label className="flex-1">
                  <input
                    type="radio"
                    name="modul"
                    value="lokaltrend"
                    defaultChecked
                    className="peer sr-only"
                  />
                  <span className="flex min-h-[34px] cursor-pointer items-center justify-center rounded-[var(--radius-control)] bg-raised px-2.5 text-[13px] text-ink-muted peer-checked:bg-active peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brand)]">
                    Uji ide produk
                  </span>
                </label>
                <label className="flex-1">
                  <input type="radio" name="modul" value="petasaingan" className="peer sr-only" />
                  <span className="flex min-h-[34px] cursor-pointer items-center justify-center rounded-[var(--radius-control)] bg-raised px-2.5 text-[13px] text-ink-muted peer-checked:bg-active peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brand)]">
                    Bedah kompetitor
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="mt-5">
              <label className="ui-label block" htmlFor="mulai-email">
                Email
              </label>
              <input
                id="mulai-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nama@usaha.id"
                className="field mt-1.5"
              />
            </div>

            <button type="submit" className="action mt-5 w-full">
              Buat akun dan audit
            </button>
            <p className="ui-label mt-3">
              Gratis di tahap ini. Hasil analisis hanya terlihat oleh akun Anda.
            </p>
          </form>
        </div>
      </div>

    </section>
  );
}
