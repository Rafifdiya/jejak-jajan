"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, ExternalLink, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Langkah = { urutan: number; instruksi: string; foto_url: string | null; video_url: string | null };
type Resep = { created_at: string; verified: boolean; status: string; recipe_steps: Langkah[] };

/**
 * Langkah pembuatan khusus Premium. Isinya hanya bisa dibaca Premium, admin, dan
 * pengirim resep (dijaga RLS, migration 0024), jadi diambil di browser sesuai akun.
 * Akun lain hanya melihat kotak terkunci bila langkahnya ada; tidak tampil bila belum ada.
 */
export function LangkahPremium({ slug }: { slug: string }) {
  const [langkah, setLangkah] = useState<Langkah[]>();
  const [terkunci, setTerkunci] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("snacks")
        .select("recipes (created_at, verified, status, recipe_steps (urutan, instruksi, foto_url, video_url))")
        .eq("slug", slug)
        .maybeSingle<{ recipes: Resep[] }>();
      // Resep utama sama seperti di server: terverifikasi dulu, lalu versi paling awal
      const r = (data?.recipes ?? [])
        .filter((x) => x.status === "approved")
        .sort((a, b) => Number(b.verified) - Number(a.verified) || a.created_at.localeCompare(b.created_at))[0];
      const isi = [...(r?.recipe_steps ?? [])].sort((a, b) => a.urutan - b.urutan);
      if (isi.length > 0) return setLangkah(isi);
      // Tidak terbaca: belum ada langkah, atau akun bukan Premium -> cek jumlahnya saja
      const { data: n } = await supabase.rpc("jumlah_langkah", { p_slug: slug });
      setTerkunci(typeof n === "number" ? n : 0);
      setLangkah([]);
    })();
  }, [slug]);

  if (!langkah) return null;

  if (langkah.length === 0) {
    if (terkunci === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-amber-400/70 bg-amber-50/60 p-4 print:hidden">
        <Lock size={20} className="shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">
            Langkah pembuatan ({terkunci} langkah) <Crown size={15} className="text-amber-600" aria-label="Premium" />
          </p>
          <p className="text-sm text-ink-2">Tutorial langkah demi langkah khusus anggota Premium.</p>
        </div>
        <Link href="/premium" className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover">
          Buka dengan Premium
        </Link>
      </div>
    );
  }

  return (
    <>
      <h3 className="flex items-center gap-1.5 font-semibold">
        Langkah pembuatan <Crown size={15} className="text-amber-600 print:hidden" aria-label="Premium" />
      </h3>
      <ol className="space-y-3">
        {langkah.map((l, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm text-white">{i + 1}</span>
            <div className="min-w-0 space-y-2 pt-0.5">
              <p>{l.instruksi}</p>
              {l.foto_url && (
                <Image src={l.foto_url} alt={`Langkah ${i + 1}`} width={480} height={360} sizes="(max-width: 640px) 80vw, 320px" className="h-auto w-full max-w-xs rounded-md object-cover" />
              )}
              {l.video_url && (
                <a href={l.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand underline print:hidden">
                  Video langkah ini <ExternalLink size={13} aria-hidden />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
