import { createClient } from "@/lib/supabase/server";
import type { PermintaanPremium } from "@/lib/premium";

export type PermintaanAdmin = PermintaanPremium & { username: string | null; buktiUrl: string | null };

/** Admin: permintaan Premium terbaru (menunggu dulu) + link sementara foto bukti transfer (bucket privat). */
export async function getPermintaanPremium(): Promise<PermintaanAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("premium_requests")
    .select("*, profiles (username)")
    .order("created_at", { ascending: false })
    .limit(100);
  // Tabel belum dibuat (migration 0026): tampilkan kosong
  if (error || !data) return [];
  const rows = data as (PermintaanPremium & { profiles: { username: string | null } | null })[];
  const { data: link } = await supabase.storage.from("bukti-premium").createSignedUrls(rows.map((r) => r.bukti_path), 3600);
  return rows
    .map((r, i) => ({ ...r, username: r.profiles?.username ?? null, buktiUrl: link?.[i]?.signedUrl ?? null }))
    .sort((a, b) => Number(b.status === "menunggu") - Number(a.status === "menunggu"));
}
