"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { PAKET } from "@/lib/premium";

const input = "w-full rounded-sm border border-line bg-surface px-3 py-2";

/** Form permintaan Premium: pilih paket, data pembeli, unggah bukti transfer. Disetujui admin (migration 0026). */
export function FormPremium({ userId }: { userId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paket, setPaket] = useState<string>("1bulan");
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [nim, setNim] = useState("");
  const [bukti, setBukti] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nama.trim().length < 2) return setError("Isi nama pembeli.");
    if (!/^[0-9+ -]{8,20}$/.test(hp.trim())) return setError("Nomor HP tidak valid (8-20 angka).");
    if (!bukti) return setError("Unggah foto bukti transfer.");
    setBusy(true);
    try {
      const supabase = createClient();
      const { file } = await compressImage(bukti, { maxSizeMB: 1, maxWidthOrHeight: 1600 });
      const path = `${userId}/${Date.now()}.webp`;
      const up = await supabase.storage.from("bukti-premium").upload(path, file, { contentType: "image/webp" });
      if (up.error) throw new Error(/bucket/i.test(up.error.message) ? "Fitur ini belum aktif (jalankan migration 0026)." : up.error.message);
      const { error: err } = await supabase.from("premium_requests").insert({
        paket,
        nama: nama.trim(),
        no_hp: hp.trim(),
        nim: nim.trim() || null,
        bukti_path: path,
      });
      if (err) throw new Error(err.message);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={kirim} className="space-y-3 text-left">
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1.5 text-sm font-semibold">Pilih paket</legend>
        {PAKET.map((p) => (
          <label key={p.id} className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-colors ${paket === p.id ? "border-brand bg-subtle" : "border-line hover:border-ink-2"}`}>
            <input type="radio" name="paket" value={p.id} checked={paket === p.id} onChange={() => setPaket(p.id)} className="sr-only" />
            <span className="block font-semibold">{p.label}</span>
            <span className="font-display text-xl font-semibold text-brand">{p.harga}</span>
            {p.catatan && <span className="block text-xs text-green-700">{p.catatan}</span>}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1 text-sm font-semibold">Nama pembeli
        <input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={80} className={input} placeholder="Sesuai nama di bukti transfer" />
      </label>
      <label className="block space-y-1 text-sm font-semibold">Nomor HP / WhatsApp
        <input value={hp} onChange={(e) => setHp(e.target.value)} inputMode="tel" maxLength={20} className={input} placeholder="mis. 0812xxxxxxxx" />
      </label>
      <label className="block space-y-1 text-sm font-semibold">NIM <span className="font-bold opacity-[0.56]">(jika mahasiswa)</span>
        <input value={nim} onChange={(e) => setNim(e.target.value)} maxLength={20} className={input} />
      </label>
      <div className="space-y-1 text-sm">
        <p className="font-semibold">Bukti transfer</p>
        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line px-3 py-3 hover:border-brand">
          <Camera size={18} aria-hidden /> {bukti ? bukti.name : "Unggah foto / screenshot bukti transfer"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setBukti(e.target.files?.[0])} />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-2.5 font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
        <Send size={16} aria-hidden /> {busy ? "Mengirim..." : "Kirim permintaan Premium"}
      </button>
      <p className="text-xs text-ink-2">Data hanya dipakai untuk verifikasi pembayaran oleh admin Jejak Jajan.</p>
    </form>
  );
}
