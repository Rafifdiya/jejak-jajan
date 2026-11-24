import { cariLencana } from "@/lib/lencana";

/** Lencana yang dipasang user, tampil di sebelah nama profil. Kosong bila tidak memasang. */
export function ChipLencana({ id, className = "" }: { id: string | null | undefined; className?: string }) {
  const l = cariLencana(id);
  if (!l) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-sans text-sm ${l.gaya} ${className}`}>
      <span aria-hidden>{l.emoji}</span>
      <span className={`font-semibold ${l.teks}`}>{l.label}</span>
    </span>
  );
}
