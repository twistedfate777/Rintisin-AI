import { z } from "zod";
import { KATEGORI_EKRAF } from "@/lib/types";

// Shared Idea_Form schema (Requirement 4). The server action will reuse it unchanged.

export const IDEA_MIN = 20;
export const IDEA_MAX = 1000;
export const CAPITAL_MIN = 1;
export const CAPITAL_MAX = 10_000_000_000;
export const CITY_MIN = 2;
export const CITY_MAX = 100;

const ideaMessage = `Draf ide produk harus berisi ${IDEA_MIN}–1.000 karakter.`;
const capitalMessage = "Estimasi modal harus bilangan bulat antara Rp 1 dan Rp 10.000.000.000.";
const cityMessage = `Lokasi atau kota target harus berisi ${CITY_MIN}–${CITY_MAX} karakter.`;
const categoryMessage = "Pilih salah satu kategori ekonomi kreatif.";

export const ideaFormSchema = z.object({
  product_idea: z
    .string({ error: ideaMessage })
    .trim()
    .min(IDEA_MIN, ideaMessage)
    .max(IDEA_MAX, ideaMessage),
  category: z.enum(KATEGORI_EKRAF, { error: categoryMessage }),
  initial_capital_idr: z
    .number({ error: capitalMessage })
    .int(capitalMessage)
    .min(CAPITAL_MIN, capitalMessage)
    .max(CAPITAL_MAX, capitalMessage),
  target_city: z
    .string({ error: cityMessage })
    .trim()
    .min(CITY_MIN, cityMessage)
    .max(CITY_MAX, cityMessage),
});

export type IdeaFormValues = z.infer<typeof ideaFormSchema>;
export type IdeaFormField = keyof IdeaFormValues;
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Validates raw form values; returns the parsed input or one message per invalid field. */
export function validateIdeaForm(
  raw: unknown
):
  | { success: true; data: IdeaFormValues }
  | { success: false; errors: FieldErrors<IdeaFormField> } {
  const result = ideaFormSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  const errors: FieldErrors<IdeaFormField> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as IdeaFormField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}
