"use client";

import { useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LENCANA, lencanaTerbuka, type IdLencana } from "@/lib/lencana";
import { EVENT_PROFIL } from "@/components/AuthNav";

type Props = { awal: string | null; kontribusi: number; premium: boolean; admin: boolean };

/** Pilih lencana (badge) yang tampil di profil & avatar navbar. Hanya lencana yang sudah terbuka bisa dipasang. */
export function KustomLencana({ awal, kontribusi, premium, admin }: Props) {
  const [pakai, setPakai] = useState<string | null>(awal);
  const [pending, mulai] = useTransition();
  const [error, setError] = useState<string>();
  const akun = { kontribusi, premium, admin };

  function pasang(id: IdLencana | null) {
    mulai(async () => {
      setError(undefined);
      const { error: err } = await createClient().rpc("pasang_lencana", { p: id });
      if (err) {
        return setError(/function|schema cache/i.test(err.message) ? "Fitur lencana belum aktif (jalankan migration 0024)." : err.message);
      }
      setPakai(id);
      // Navbar membaca ulang profil (lencana di avatar)
      window.dispatchEvent(new Event(EVENT_PROFIL));
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Kustom lencana</h2>
        <p className="text-sm text-ink-2">Pilih lencana yang tampil di profil dan foto profil di navbar. Lencana terbuka dari level kontributor dan Premium.</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {LENCANA.filter((l) => l.id !== "admin" || admin).map((l) => {
          const terbuka = lencanaTerbuka(l.id, akun);
          const dipakai = pakai === l.id;
          return (
            <li key={l.id} className={`flex items-center gap-3 rounded-lg border p-3 ${dipakai ? "border-brand bg-subtle" : "border-line"} ${terbuka ? "" : "opacity-60"}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg ${l.gaya}`} aria-hidden>{l.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${terbuka ? l.teks : "text-ink"}`}>{l.label}</p>
                <p className="text-xs text-ink-2">{l.syarat}</p>
              </div>
              {!terbuka ? (
                <span className="flex items-center gap-1 text-xs text-ink-2"><Lock size={13} aria-hidden /> Terkunci</span>
              ) : dipakai ? (
                <button type="button" disabled={pending} onClick={() => pasang(null)} className="flex items-center gap-1 rounded-full border border-brand bg-brand px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
                  <Check size={13} aria-hidden /> Dipakai · Lepas
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => pasang(l.id)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-brand hover:text-brand disabled:opacity-60">
                  Pakai
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
