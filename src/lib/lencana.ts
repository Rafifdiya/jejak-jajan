/** Lencana (badge) yang bisa dipasang user. Terbuka sesuai level kontributor, Premium, atau admin (migration 0024). */
export type IdLencana = "pencicip" | "penjelajah" | "penjaga_resep" | "penjaga_warisan" | "premium" | "admin";

export type Lencana = {
  id: IdLencana;
  label: string;
  /** Tulisan pendek untuk lencana kecil di avatar navbar */
  pendek: string;
  emoji: string;
  syarat: string;
  /** Kelas warna chip */
  gaya: string;
  /** Kelas teks (efek kilau untuk Premium & Admin) */
  teks: string;
};

export const LENCANA: Lencana[] = [
  { id: "pencicip", label: "Pencicip", pendek: "🥄", emoji: "🥄", syarat: "Terbuka untuk semua akun", gaya: "border-line bg-subtle", teks: "text-ink" },
  { id: "penjelajah", label: "Penjelajah", pendek: "🧭", emoji: "🧭", syarat: "5 kontribusi disetujui", gaya: "border-orange-300 bg-orange-50", teks: "text-orange-800" },
  { id: "penjaga_resep", label: "Penjaga Resep", pendek: "📜", emoji: "📜", syarat: "10 kontribusi disetujui", gaya: "border-rose-300 bg-rose-50", teks: "text-rose-800" },
  { id: "penjaga_warisan", label: "Penjaga Warisan", pendek: "🏛️", emoji: "🏛️", syarat: "20 kontribusi disetujui", gaya: "border-violet-300 bg-violet-50", teks: "text-violet-800" },
  { id: "premium", label: "Premium", pendek: "Prem", emoji: "👑", syarat: "Berlangganan Premium", gaya: "border-amber-400 bg-amber-500/15", teks: "kilau font-bold" },
  { id: "admin", label: "Admin", pendek: "Admin", emoji: "🛡️", syarat: "Khusus admin", gaya: "border-sky-400 bg-sky-500/15", teks: "kilau kilau-biru font-bold" },
];

export const cariLencana = (id: string | null | undefined) => LENCANA.find((l) => l.id === id);

/** Lencana yang sudah terbuka untuk user (sama dengan aturan di database). */
export function lencanaTerbuka(id: IdLencana, u: { kontribusi: number; premium: boolean; admin: boolean }) {
  if (u.admin) return true;
  switch (id) {
    case "pencicip": return true;
    case "penjelajah": return u.kontribusi >= 5;
    case "penjaga_resep": return u.kontribusi >= 10;
    case "penjaga_warisan": return u.kontribusi >= 20;
    case "premium": return u.premium;
    default: return false;
  }
}
