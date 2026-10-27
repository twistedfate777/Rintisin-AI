"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_COMPETITORS, validateCompetitorForm } from "@/lib/validation/competitor-form";

interface Field {
  key: number;
  value: string;
}

export function CompetitorForm({
  onSubmit,
  disabled,
  disabledReason,
  serverFieldErrors,
  serverError,
}: {
  onSubmit: (urls: string[]) => void;
  disabled: boolean;
  disabledReason?: string;
  serverFieldErrors?: Record<number, string>;
  serverError?: string | null;
}) {
  const nextKey = useRef(1);
  const [fields, setFields] = useState<Field[]>([{ key: 0, value: "" }]);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const update = (key: number, value: string) =>
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));

  const add = () => {
    if (fields.length >= MAX_COMPETITORS) return;
    const key = nextKey.current++;
    setFields((prev) => [...prev, { key, value: "" }]);
    setErrors({});
    requestAnimationFrame(() => document.getElementById(`url-${key}`)?.focus());
  };

  const remove = (key: number) => {
    if (fields.length <= 1) return;
    setFields((prev) => prev.filter((f) => f.key !== key));
    setErrors({});
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    const result = validateCompetitorForm(fields.map((f) => f.value));
    if (!result.success) {
      setErrors(result.errors);
      const firstIndex = Math.min(...Object.keys(result.errors).map(Number));
      document.getElementById(`url-${fields[firstIndex]?.key}`)?.focus();
      return;
    }
    setErrors({});
    onSubmit(result.urls);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-sm text-ink-muted">
        Tempel tautan tempat dari Google Maps, satu per kompetitor. Shortlink maps.app.goo.gl juga bisa.
      </p>
      <ul className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const error = errors[index] ?? serverFieldErrors?.[index];
          const inputId = `url-${field.key}`;
          return (
            <li key={field.key} className="flex flex-col gap-2">
              <Label htmlFor={inputId}>Kompetitor {index + 1}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={inputId}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={field.value}
                  onChange={(e) => update(field.key, e.target.value)}
                  placeholder="https://maps.app.goo.gl/…"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${inputId}-err` : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => remove(field.key)}
                  disabled={fields.length <= 1}
                  aria-label={`Hapus kolom kompetitor ${index + 1}`}
                  title={fields.length <= 1 ? "Minimal satu kompetitor" : undefined}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              {error ? (
                <p id={`${inputId}-err`} className="text-[13px] text-negative">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={add} disabled={fields.length >= MAX_COMPETITORS}>
          <Plus aria-hidden="true" />
          Tambah kompetitor
        </Button>
        <span className="num text-[13px] text-ink-muted">
          {fields.length} dari {MAX_COMPETITORS} kolom
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-rule pt-5">
        {serverError ? (
          <p role="alert" className="text-[13px] text-negative">
            {serverError}
          </p>
        ) : null}
        <div>
          <Button type="submit" size="lg" disabled={disabled}>
            Analisis 3 Kompetitor
          </Button>
        </div>
        {disabled && disabledReason ? <p className="text-[13px] text-ink-muted">{disabledReason}</p> : null}
      </div>
    </form>
  );
}
