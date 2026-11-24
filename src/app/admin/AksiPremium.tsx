"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, X } from "lucide-react";
import { hapusRiwayatPremium, prosesPremium } from "./premium-actions";

/** Tombol Setujui / Tolak untuk satu permintaan Premium. */
export function AksiPremium({ id }: { id: string }) {
  const [pending, mulai] = useTransition();
  const [error, setError] = useState<string>();

  function setujui() {
    if (!confirm("Pembayaran sudah dicek dan sesuai? Premium akan langsung aktif.")) return;
    mulai(async () => setError((await prosesPremium(id, true))?.error));
  }
  function tolak() {
    const alasan = prompt("Alasan penolakan (mis. bukti tidak jelas / nominal tidak sesuai):");
    if (alasan === null) return;
    mulai(async () => setError((await prosesPremium(id, false, alasan))?.error));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={setujui} className="flex items-center gap-1 rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
        <Check size={15} aria-hidden /> Setujui
      </button>
      <button type="button" disabled={pending} onClick={tolak} className="flex items-center gap-1 rounded-full border border-danger px-4 py-1.5 text-sm font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-60">
        <X size={15} aria-hidden /> Tolak
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </div>
  );
}

/** Hapus riwayat: satu permintaan (id) atau semua yang sudah diproses (tanpa id). */
export function HapusRiwayatPremium({ id }: { id?: string }) {
  const [pending, mulai] = useTransition();
  const [error, setError] = useState<string>();
  function hapus() {
    const pesan = id ? "Hapus riwayat permintaan ini beserta foto buktinya?" : "Hapus SEMUA riwayat yang sudah disetujui/ditolak beserta foto buktinya?";
    if (!confirm(pesan)) return;
    mulai(async () => setError((await hapusRiwayatPremium(id ? [id] : undefined))?.error));
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={hapus}
        className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:border-danger hover:text-danger disabled:opacity-60"
      >
        <Trash2 size={13} aria-hidden /> {pending ? "Menghapus..." : id ? "Hapus riwayat" : "Hapus semua riwayat yang sudah diproses"}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
