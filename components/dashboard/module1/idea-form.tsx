"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDigitGroups, formatInteger, parseDigitGroups } from "@/lib/format";
import { KATEGORI_LABEL } from "@/lib/labels";
import { KATEGORI_EKRAF, type IdeaInput, type KategoriEkraf } from "@/lib/types";
import {
  IDEA_MAX,
  validateIdeaForm,
  type FieldErrors,
  type IdeaFormField,
} from "@/lib/validation/idea-form";

const CATEGORY_ITEMS = KATEGORI_EKRAF.map((value) => ({ value, label: KATEGORI_LABEL[value] }));

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13px] text-negative">
      {message}
    </p>
  );
}

export function IdeaForm({
  onSubmit,
  busy,
  serverError,
}: {
  onSubmit: (input: IdeaInput) => void;
  busy: boolean;
  serverError?: string | null;
}) {
  const [idea, setIdea] = useState("");
  const [category, setCategory] = useState<KategoriEkraf | null>(null);
  const [capital, setCapital] = useState("");
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<FieldErrors<IdeaFormField>>({});

  const ideaLength = idea.trim().length;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const result = validateIdeaForm({
      product_idea: idea,
      category: category ?? undefined,
      initial_capital_idr: parseDigitGroups(capital),
      target_city: city,
    });
    if (!result.success) {
      // Values stay as typed; only the messages change (Req 4.2–4.5, 4.8).
      setErrors(result.errors);
      const first = (["product_idea", "category", "initial_capital_idr", "target_city"] as const).find(
        (field) => result.errors[field]
      );
      if (first) document.getElementById(`field-${first}`)?.focus();
      return;
    }
    setErrors({});
    onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" aria-describedby="form-help">
      <p id="form-help" className="text-sm text-ink-muted">
        Semua kolom wajib diisi. Analisis berjalan dalam dua langkah dan hasilnya tersimpan di riwayat.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="field-product_idea">Draf ide produk</Label>
          <span className="num text-xs text-ink-muted" aria-live="polite">
            {formatInteger(ideaLength)} / {formatInteger(IDEA_MAX)} karakter
          </span>
        </div>
        <Textarea
          id="field-product_idea"
          name="product_idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Contoh: Sambal bawang rendah kalori dalam kemasan 150g, dimasak dengan minyak kelapa murni tanpa MSG."
          rows={4}
          aria-invalid={errors.product_idea ? true : undefined}
          aria-describedby={errors.product_idea ? "err-product_idea" : "hint-product_idea"}
        />
        {errors.product_idea ? (
          <FieldError id="err-product_idea" message={errors.product_idea} />
        ) : (
          <p id="hint-product_idea" className="text-[13px] text-ink-muted">
            Tulis produk, bahan utama, ukuran kemasan, dan apa yang membuatnya berbeda. 20–1.000 karakter.
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label id="label-category" htmlFor="field-category">
            Kategori ekonomi kreatif
          </Label>
          <Select
            items={CATEGORY_ITEMS}
            value={category}
            onValueChange={(value) => setCategory(value as KategoriEkraf | null)}
          >
            <SelectTrigger
              id="field-category"
              className="w-full"
              aria-labelledby="label-category"
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={errors.category ? "err-category" : undefined}
            >
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="err-category" message={errors.category} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="field-initial_capital_idr">Estimasi modal awal</Label>
          <div className="relative">
            <span
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted"
              aria-hidden="true"
            >
              Rp
            </span>
            <Input
              id="field-initial_capital_idr"
              name="initial_capital_idr"
              inputMode="numeric"
              autoComplete="off"
              value={capital}
              onChange={(e) => setCapital(formatDigitGroups(e.target.value))}
              placeholder="15.000.000"
              className="num pl-9"
              aria-invalid={errors.initial_capital_idr ? true : undefined}
              aria-describedby={
                errors.initial_capital_idr ? "err-initial_capital_idr" : "hint-initial_capital_idr"
              }
            />
          </div>
          {errors.initial_capital_idr ? (
            <FieldError id="err-initial_capital_idr" message={errors.initial_capital_idr} />
          ) : (
            <p id="hint-initial_capital_idr" className="text-[13px] text-ink-muted">
              Dalam rupiah, bilangan bulat Rp 1–Rp 10.000.000.000.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="field-target_city">Lokasi atau kota target pasar</Label>
        <Input
          id="field-target_city"
          name="target_city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Contoh: Jakarta Selatan"
          autoComplete="address-level2"
          aria-invalid={errors.target_city ? true : undefined}
          aria-describedby={errors.target_city ? "err-target_city" : undefined}
        />
        <FieldError id="err-target_city" message={errors.target_city} />
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Sedang menganalisis…" : "Analisis Ide"}
        </Button>
      </div>
    </form>
  );
}
