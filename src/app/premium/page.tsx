import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Check, X } from "lucide-react";
import { KepalaHalaman } from "@/components/KepalaHalaman";
import { LoginButton } from "@/components/LoginButton";
import { formatTanggal } from "@/lib/format";
import { getSesi } from "@/lib/kiriman";
import { createClient } from "@/lib/supabase/server";
import { PAKET, cariPaket, masihDitinjau, type PermintaanPremium } from "@/lib/premium";
import { FormPremium } from "./FormPremium";

export const metadata: Metadata = {
  title: "Premium",
  description: "Arsip tetap gratis. Premium untuk bebas iklan, langkah pembuatan, dan unduh resep.",
};

// [fitur, gratis, premium]: true = ada, false = tidak, string = keterangan
const fitur: [string, boolean | string, boolean | string][] = [
  ["Baca semua cerita, resep, dan lokasi", true, true],
  ["Kirim jajanan, vote, Forum Jajanan", true, true],
  ["Simpan jajanan", "Maks. 10", "Tanpa batas"],
  ["Langkah pembuatan (tutorial)", false, true],
  ["Unduh resep", false, true],
  ["Lencana & bingkai Premium di profil", false, true],
  ["Bebas iklan sponsor", false, true],
  ["Kelas Bersama Penjual (segera hadir)", "-", "Diskon 20% + daftar lebih dulu"],
];

function Sel({ v }: { v: boolean | string }) {
  if (typeof v === "string") return <span className={`text-sm font-semibold ${v === "Tanpa batas" ? "text-green-600" : v.startsWith("Maks") ? "text-danger" : ""}`}>{v}</span>;
  return v ? <Check size={20} className="mx-auto text-accent" aria-label="Ya" /> : <X size={20} className="mx-auto text-danger" aria-label="Tidak" />;
}

export default function PremiumPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-1 pb-8 [zoom:0.85]">
      <KepalaHalaman className="space-y-3 py-4! text-center">
        <span className="inline-block rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-brand">
          Bayar via QRIS · aktif setelah diverifikasi admin
        </span>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Jejak Jajan Premium</h1>
        <p className="font-hand text-2xl text-brand">arsip tetap gratis, premium untuk yang ingin lebih nyaman</p>
      </KepalaHalaman>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left">
          <thead className="border-b border-line bg-subtle">
            <tr>
              <th className="p-4">Fitur</th>
              <th className="p-4 text-center">Gratis</th>
              <th className="p-4 text-center text-brand">Premium</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {fitur.map(([nama, gratis, premium]) => (
              <tr key={nama}>
                <td className="p-4">{nama}</td>
                <td className="p-4 text-center"><Sel v={gratis} /></td>
                <td className="p-4 text-center"><Sel v={premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mx-auto max-w-md space-y-4 rounded-xl border-2 border-orange-500/40 bg-surface p-6 text-center">
        <p className="text-sm text-ink-2">Pilihan paket</p>
        <div className="grid grid-cols-2 gap-3">
          {PAKET.map((p) => (
            <div key={p.id} className="rounded-lg bg-subtle p-3">
              <p className="font-display text-3xl font-semibold">{p.harga}</p>
              <p className="text-sm text-ink-2">/{p.label}</p>
              {p.catatan && <p className="text-xs font-semibold text-green-700">{p.catatan}</p>}
            </div>
          ))}
        </div>
        <Suspense fallback={<p className="text-sm text-ink-2">Memuat...</p>}>
          <Status />
        </Suspense>
      </section>
    </div>
  );
}

async function Status() {
  await connection(); // tergantung user yang login
  const sesi = await getSesi();
  if (!sesi.user) {
    return (
      <LoginButton className="w-full rounded-full bg-brand py-2.5 font-semibold text-white hover:bg-brand-hover">
        Masuk untuk berlangganan Premium
      </LoginButton>
    );
  }
  if (sesi.admin) {
    return <p className="rounded-md bg-accent/10 p-2 text-sm font-semibold text-accent">Akun admin otomatis Premium</p>;
  }

  // Permintaan terakhir (tabel dari migration 0026; bila belum ada, anggap belum pernah)
  const supabase = await createClient();
  const { data } = await supabase
    .from("premium_requests")
    .select("id, paket, status, alasan, created_at")
    .eq("user_id", sesi.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<PermintaanPremium, "id" | "paket" | "status" | "alasan" | "created_at">>();
  const menunggu = data?.status === "menunggu" && masihDitinjau(data.created_at);

  return (
    <div className="space-y-4">
      {sesi.premiumSampai && (
        <p className="rounded-md bg-accent/10 p-2 text-sm font-semibold text-accent">
          Premium aktif sampai {formatTanggal(sesi.premiumSampai)}
        </p>
      )}
      {data?.status === "ditolak" && (
        <p className="rounded-md bg-danger/10 p-2 text-left text-sm text-danger">
          Permintaan terakhir ditolak{data.alasan ? `: ${data.alasan}` : "."} Silakan kirim ulang dengan bukti yang benar.
        </p>
      )}
      {menunggu ? (
        <div className="space-y-1 rounded-lg border border-amber-400/70 bg-amber-50/60 p-4 text-left text-sm">
          <p className="font-semibold">Permintaanmu sedang ditinjau admin</p>
          <p className="text-ink-2">
            Paket {cariPaket(data!.paket)?.label ?? data!.paket}, dikirim {formatTanggal(data!.created_at)}. Premium aktif otomatis setelah
            pembayaran diverifikasi.
          </p>
        </div>
      ) : (
        <>
          <ol className="list-inside list-decimal space-y-1 rounded-lg bg-subtle p-4 text-left text-sm">
            <li>Bayar sesuai paket lewat QRIS Jejak Jajan (tersedia di booth) atau transfer.</li>
            <li>Simpan screenshot / foto bukti pembayaran.</li>
            <li>Isi form di bawah dan unggah buktinya.</li>
            <li>Admin memverifikasi pembayaran, lalu Premium aktif otomatis di akunmu.</li>
          </ol>
          <FormPremium userId={sesi.user.id} />
        </>
      )}
    </div>
  );
}
