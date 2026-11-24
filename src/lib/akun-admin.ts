import { createClient } from "@/lib/supabase/server";

export type AkunBaru = { username: string | null; email: string | null; dibuat: string; total: number };

/** Admin: 10 akun terbaru (username + email) lewat RPC akun_terbaru (migration 0028). */
export async function getAkunTerbaru(): Promise<{ akun: AkunBaru[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("akun_terbaru");
  if (error) return { akun: [], error: error.message };
  return { akun: (data ?? []) as AkunBaru[] };
}

/** Link ke daftar semua akun di Supabase Dashboard (perlu login Supabase). */
export function linkSemuaAkun() {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://x.supabase.co").hostname.split(".")[0];
  return `https://supabase.com/dashboard/project/${ref}/auth/users`;
}
