-- =================================================================
-- Jejak Jajan - Admin bisa menghapus riwayat permintaan Premium yang sudah diproses
-- (beserta foto bukti transfer). Permintaan yang masih menunggu tidak bisa dihapus.
-- Jalankan setelah 0026 di Supabase Dashboard > SQL Editor.
-- =================================================================

drop policy if exists "admin hapus riwayat premium" on premium_requests;
create policy "admin hapus riwayat premium" on premium_requests for delete to authenticated
  using (is_admin() and status <> 'menunggu');

drop policy if exists "admin hapus bukti premium" on storage.objects;
create policy "admin hapus bukti premium" on storage.objects for delete to authenticated
  using (bucket_id = 'bukti-premium' and public.is_admin());
