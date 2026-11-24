"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HasilPremium = { error?: string } | undefined;

/** Admin menyetujui / menolak permintaan Premium (cek admin di fungsi SQL proses_premium, migration 0026). */
export async function prosesPremium(id: string, setujui: boolean, alasan?: string): Promise<HasilPremium> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("proses_premium", { p_id: id, p_setujui: setujui, p_alasan: alasan ?? null });
  if (error) return { error: error.message };
  revalidatePath("/admin");
}

/** Hapus riwayat permintaan yang sudah diproses (disetujui / ditolak) beserta foto buktinya. ids kosong = semua yang sudah diproses. */
export async function hapusRiwayatPremium(ids?: string[]): Promise<HasilPremium> {
  const supabase = await createClient();
  let q = supabase.from("premium_requests").select("id, bukti_path").neq("status", "menunggu");
  if (ids?.length) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) return { error: error.message };
  if (!data?.length) return;
  const { error: errHapus, count } = await supabase
    .from("premium_requests")
    .delete({ count: "exact" })
    .in("id", data.map((r) => r.id));
  if (errHapus) return { error: errHapus.message };
  if (!count) return { error: "Tidak bisa menghapus (jalankan migration 0027)." };
  // Foto bukti ikut dihapus dari penyimpanan
  await supabase.storage.from("bukti-premium").remove(data.map((r) => r.bukti_path));
  revalidatePath("/admin");
}
