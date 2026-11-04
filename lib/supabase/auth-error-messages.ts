// Clear, actionable Bahasa Indonesia error messages for Auth (Login & Registration).

// Requirement 1.4: identical message for unknown email or wrong password on Login so neither is leaked.
export const LOGIN_FAILED =
  "Email atau kata sandi salah. Periksa kembali lalu coba lagi.";

export const LOGIN_EMAIL_NOT_CONFIRMED =
  "Email Anda belum diverifikasi. Silakan cek kotak masuk atau folder spam email Anda untuk mengklik tautan verifikasi.";

export const LOGIN_RATE_LIMITED =
  "Terlalu banyak percobaan masuk. Silakan tunggu beberapa menit lalu coba lagi.";

export const AUTH_CONFIG_MISSING =
  "Konfigurasi kunci API Supabase belum terbaca di server. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sudah terpasang di Environment Variables Vercel lalu lakukan Redeploy.";

export const AUTH_SERVICE_ERROR =
  "Tidak dapat terhubung ke layanan autentikasi. Periksa koneksi internet Anda lalu coba lagi.";

export const REGISTER_ALREADY_EXISTS =
  "Email ini sudah terdaftar. Silakan masuk ke akun Anda atau gunakan alamat email lain.";

export const REGISTER_WEAK_PASSWORD =
  "Kata sandi terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.";

export const REGISTER_RATE_LIMITED =
  "Terlalu banyak permintaan pendaftaran. Silakan tunggu beberapa menit lalu coba lagi.";

export const REGISTER_INVALID_EMAIL =
  "Format alamat email tidak dapat diterima. Gunakan alamat email aktif yang valid.";

export const REGISTER_FAILED =
  "Pendaftaran belum dapat diselesaikan saat ini. Periksa kembali email dan kata sandi Anda lalu coba lagi.";

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

export function formatLoginErrorMessage(error: SupabaseErrorLike | null | undefined): string {
  if (!error) return LOGIN_FAILED;

  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();

  if (
    msg.includes("no api key") ||
    msg.includes("apikey") ||
    msg.includes("invalid api key") ||
    msg.includes("konfigurasi")
  ) {
    return AUTH_CONFIG_MISSING;
  }

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return LOGIN_EMAIL_NOT_CONFIRMED;
  }

  if (
    error.status === 429 ||
    code.includes("rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    return LOGIN_RATE_LIMITED;
  }

  if (
    error.status === 400 ||
    error.status === 401 ||
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials")
  ) {
    return LOGIN_FAILED;
  }

  if (error.status && error.status >= 500) {
    return AUTH_SERVICE_ERROR;
  }

  return LOGIN_FAILED;
}

export function formatRegisterErrorMessage(error: SupabaseErrorLike | null | undefined): string {
  if (!error) return REGISTER_FAILED;

  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();

  if (
    msg.includes("no api key") ||
    msg.includes("apikey") ||
    msg.includes("invalid api key") ||
    msg.includes("konfigurasi")
  ) {
    return AUTH_CONFIG_MISSING;
  }

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already exists")
  ) {
    return REGISTER_ALREADY_EXISTS;
  }

  if (code === "weak_password" || msg.includes("password should be")) {
    return REGISTER_WEAK_PASSWORD;
  }

  if (
    error.status === 429 ||
    code.includes("rate_limit") ||
    code === "over_email_send_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("security purposes")
  ) {
    return REGISTER_RATE_LIMITED;
  }

  if (code === "validation_failed" || msg.includes("invalid email") || msg.includes("unable to validate email")) {
    return REGISTER_INVALID_EMAIL;
  }

  if (error.status && error.status >= 500) {
    return AUTH_SERVICE_ERROR;
  }

  return REGISTER_FAILED;
}
