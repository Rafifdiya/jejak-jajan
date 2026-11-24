/** Paket Premium (bayar QRIS / transfer, disetujui admin; migration 0026). */
export const PAKET = [
  { id: "1bulan", label: "1 bulan", harga: "Rp15.000", hari: 30, catatan: "" },
  { id: "3bulan", label: "3 bulan", harga: "Rp30.000", hari: 90, catatan: "Hemat Rp15.000" },
] as const;

export const cariPaket = (id: string) => PAKET.find((p) => p.id === id);

export type PermintaanPremium = {
  id: string;
  user_id: string;
  paket: string;
  nama: string;
  no_hp: string;
  nim: string | null;
  bukti_path: string;
  status: "menunggu" | "disetujui" | "ditolak";
  alasan: string | null;
  created_at: string;
  diproses_at: string | null;
};

/** Permintaan menunggu dianggap masih ditinjau selama 2 hari (sama dengan batas di database). */
export function masihDitinjau(dikirim: string) {
  return Date.now() - new Date(dikirim).getTime() < 2 * 24 * 3600 * 1000;
}
