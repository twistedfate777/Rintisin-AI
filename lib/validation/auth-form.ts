import { z } from "zod";

// Registration and login field rules (Requirement 1.1, 1.5).

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export const EMAIL_MESSAGE = "Masukkan alamat email yang valid (maksimal 254 karakter).";
export const PASSWORD_MESSAGE = "Kata sandi harus berisi 8–72 karakter.";

export const authFormSchema = z.object({
  email: z.string().trim().max(EMAIL_MAX, EMAIL_MESSAGE).pipe(z.email(EMAIL_MESSAGE)),
  password: z.string().min(PASSWORD_MIN, PASSWORD_MESSAGE).max(PASSWORD_MAX, PASSWORD_MESSAGE),
});

export type AuthFormField = "email" | "password";

export function validateAuthForm(
  raw: unknown
):
  | { success: true; data: z.infer<typeof authFormSchema> }
  | { success: false; errors: Partial<Record<AuthFormField, string>> } {
  const result = authFormSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  const errors: Partial<Record<AuthFormField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as AuthFormField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}
