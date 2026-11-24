import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { KepalaHalaman } from "@/components/KepalaHalaman";
import { LoginButton } from "@/components/LoginButton";
import { StatCard } from "@/components/StatCard";
import { Tabs } from "@/components/Tabs";
import { getCategories, getStats } from "@/lib/data";
import { getJumlahMinatKelas, getLaporan } from "@/lib/komunitas";
import { formatTanggal } from "@/lib/format";
import { getKirimanAdmin, getSesi } from "@/lib/kiriman";
import { KirimanList } from "./KirimanList";
import { getIklanAdmin } from "@/lib/iklan";
import { IklanForm } from "./IklanForm";
import { LihatIklanToggle } from "./LihatIklanToggle";
import { AksiLaporan } from "./AksiLaporan";
import { IklanItem } from "./IklanItem";
import { AksiPremium, HapusRiwayatPremium } from "./AksiPremium";
import { getPermintaanPremium } from "@/lib/premium-admin";
import { cariPaket } from "@/lib/premium";
import { getAkunTerbaru, linkSemuaAkun } from "@/lib/akun-admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Hanya role admin. Cek ulang juga dilakukan di database (RLS + fungsi moderasi).
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="space-y-8 py-10">
      <KepalaHalaman>
        <h1 className="font-display text-4xl font-semibold">Dashboard Moderasi</h1>
      </KepalaHalaman>
      <Suspense fallback={<p className="text-ink-2">Memuat...</p>}>
        <Isi searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const btn = "rounded-full border border-line px-3 py-1 hover:border-brand";

async function Isi({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await connection(); // halaman per-request (sesi login), bukan prerender
  const sesi = await getSesi();
  if (!sesi.user) {
    return (
      <p className="text-ink-2">
        Halaman ini khusus admin. <LoginButton className="text-brand underline">Masuk</LoginButton>
      </p>
    );
  }
  if (!sesi.admin) return <p className="text-ink-2">Halaman ini khusus admin.</p>;

  const t = (await searchParams).tab;
  const tab = t === "laporan" || t === "kategori" || t === "iklan" || t === "premium" || t === "akun" ? t : "kiriman";
  const [kiriman, laporan, kategori, stats, minat] = await Promise.all([
    getKirimanAdmin(),
    getLaporan(),
    getCategories(),
    getStats(),
    getJumlahMinatKelas(),
  ]);
  const permintaan = await getPermintaanPremium();
  const akunBaru = tab === "akun" ? await getAkunTerbaru() : { akun: [] };
  const premiumMenunggu = permintaan.filter((p) => p.status === "menunggu").length;
  const iklan = tab === "iklan" ? await getIklanAdmin() : [];
  const menunggu = kiriman.filter((k) => k.status === "pending");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Menunggu" value={menunggu.length} />
        <StatCard label="Laporan terbuka" value={laporan.length} />
        <StatCard label="Total jajanan" value={stats.jajanan} />
        <StatCard label="Kiriman disetujui" value={kiriman.filter((k) => k.status === "approved").length} />
        <StatCard label="Minat kelas" value={minat} />
      </div>

      <Tabs
        basePath="/admin"
        active={tab}
        tabs={[
          { key: "kiriman", label: `Kiriman (${menunggu.length})` },
          { key: "laporan", label: `Laporan (${laporan.length})` },
          { key: "kategori", label: "Kategori" },
          { key: "iklan", label: "Iklan" },
          { key: "premium", label: `Premium (${premiumMenunggu})` },
          { key: "akun", label: "Akun" },
        ]}
      />

      {tab === "kiriman" && <KirimanList kiriman={kiriman} />}

      {tab === "akun" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-2">
              10 akun terbaru{akunBaru.akun[0] ? ` dari total ${akunBaru.akun[0].total} akun` : ""}. Data lengkap ada di database.
            </p>
            <a href={linkSemuaAkun()} target="_blank" rel="noopener noreferrer" className={`${btn} text-sm`}>
              Lihat semua akun di Supabase ↗
            </a>
          </div>
          {akunBaru.error ? (
            <p className="text-danger">Gagal memuat akun{/function|akun_terbaru/.test(akunBaru.error) ? " (jalankan migration 0028)" : `: ${akunBaru.error}`}.</p>
          ) : akunBaru.akun.length === 0 ? (
            <p className="text-ink-2">Belum ada akun.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-subtle">
                  <tr>
                    <th className="p-3">Username</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Dibuat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {akunBaru.akun.map((a, i) => (
                    <tr key={`${a.email}-${i}`}>
                      <td className="p-3 font-semibold">
                        {a.username ? <Link href={`/profil/${a.username}`} className="hover:text-brand hover:underline">@{a.username}</Link> : "-"}
                      </td>
                      <td className="p-3 break-all">{a.email ?? "-"}</td>
                      <td className="p-3 whitespace-nowrap text-ink-2">{formatTanggal(a.dibuat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "premium" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-2">Cek bukti transfer & nominal sesuai paket, lalu Setujui (Premium aktif otomatis, diperpanjang bila masih aktif) atau Tolak dengan alasan.</p>
            {permintaan.some((p) => p.status !== "menunggu") && <HapusRiwayatPremium />}
          </div>
          {permintaan.length === 0 ? (
            <p className="text-ink-2">Belum ada permintaan Premium.</p>
          ) : (
            <ul className="space-y-3">
              {permintaan.map((p) => (
                <li key={p.id} className="flex flex-wrap gap-4 rounded-lg border border-line bg-surface p-4">
                  {p.buktiUrl ? (
                    <a href={p.buktiUrl} target="_blank" rel="noopener noreferrer" title="Buka bukti transfer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- link sementara bucket privat */}
                      <img src={p.buktiUrl} alt="Bukti transfer" className="h-28 w-28 rounded-md border border-line object-cover" />
                    </a>
                  ) : (
                    <span className="flex h-28 w-28 items-center justify-center rounded-md bg-subtle text-xs text-ink-2">Bukti tidak terbaca</span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.nama}</span>
                      {p.username && <span className="text-ink-2">@{p.username}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "menunggu" ? "bg-amber-400/20 text-amber-700" : p.status === "disetujui" ? "bg-green-500/15 text-green-700" : "bg-danger/10 text-danger"}`}>
                        {p.status}
                      </span>
                    </p>
                    <p>Paket <b>{cariPaket(p.paket)?.label ?? p.paket}</b> ({cariPaket(p.paket)?.harga}) · HP {p.no_hp}{p.nim ? ` · NIM ${p.nim}` : ""}</p>
                    <p className="text-ink-2">Dikirim {formatTanggal(p.created_at)}{p.alasan ? ` · Alasan tolak: ${p.alasan}` : ""}</p>
                    {p.status === "menunggu" ? <AksiPremium id={p.id} /> : <HapusRiwayatPremium id={p.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "iklan" && (
        <div className="space-y-6">
          <p className="text-sm text-ink-2">Maksimal 6 iklan aktif, tampil bergantian tiap 6 detik di bawah sidebar (desktop). Nonaktifkan semua untuk kembali ke placeholder.</p>
          <LihatIklanToggle />
          <IklanForm />
          {iklan.length === 0 ? (
            <p className="text-ink-2">Belum ada iklan.</p>
          ) : (
            <ul className="space-y-3">{iklan.map((i) => <IklanItem key={i.id} iklan={i} />)}</ul>
          )}
        </div>
      )}

      {tab === "laporan" && laporan.length === 0 && <p className="text-ink-2">Belum ada laporan terbuka.</p>}

      {tab === "laporan" && (
        <ul className="space-y-3">
          {laporan.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-sm sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-semibold">
                  {r.target}
                  {r.href && <Link href={r.href} className="ml-2 font-normal text-brand underline">Buka</Link>}
                </p>
                <p className="text-ink-2">{r.alasan} · dilaporkan {r.oleh} · {formatTanggal(r.tanggal)}</p>
              </div>
              <AksiLaporan id={r.id} jenis={r.targetType} targetId={r.targetId} />
            </li>
          ))}
        </ul>
      )}

      {tab === "kategori" && (
        <div className="space-y-4">
          <form className="flex max-w-md gap-2">
            <input required placeholder="Nama kategori baru" aria-label="Nama kategori baru" className="flex-1 rounded-sm border border-line bg-surface px-3 py-2 text-sm" />
            <button type="button" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Tambah</button>
          </form>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {kategori.map((k) => (
              <li key={k} className="flex items-center justify-between p-3">
                {k}
                <button className={btn}>Ubah</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
