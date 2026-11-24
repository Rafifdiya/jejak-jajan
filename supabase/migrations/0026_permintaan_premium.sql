-- =================================================================
-- Jejak Jajan - Permintaan Premium (bayar QRIS/transfer, disetujui admin)
-- Paket: 1 bulan Rp15.000 / 3 bulan Rp30.000. User mengirim bukti transfer,
-- admin menyetujui -> Premium aktif otomatis; tanpa payment gateway.
-- Premium demo (gratis) dimatikan untuk user biasa.
-- Jalankan setelah 0025 di Supabase Dashboard > SQL Editor.
-- =================================================================

create table if not exists premium_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade default auth.uid(),
  paket text not null check (paket in ('1bulan', '3bulan')),
  nama text not null check (char_length(trim(nama)) between 2 and 80),
  no_hp text not null check (no_hp ~ '^[0-9+ -]{8,20}$'),
  nim text check (nim is null or char_length(nim) <= 20),
  bukti_path text not null,
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  alasan text check (alasan is null or char_length(alasan) <= 300),
  created_at timestamptz not null default now(),
  diproses_at timestamptz
);
create index if not exists premium_requests_user_idx on premium_requests (user_id, created_at desc);

alter table premium_requests enable row level security;

drop policy if exists "baca permintaan sendiri atau admin" on premium_requests;
create policy "baca permintaan sendiri atau admin" on premium_requests for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());

drop policy if exists "kirim permintaan sendiri" on premium_requests;
create policy "kirim permintaan sendiri" on premium_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'menunggu' and alasan is null and diproses_at is null);
-- Tidak ada policy update/delete: status hanya diubah lewat proses_premium (admin).

-- Anti-spam: satu permintaan menunggu per akun. Boleh kirim lagi bila sudah
-- diproses admin, atau permintaan sebelumnya didiamkan lebih dari 2 hari.
create or replace function cek_permintaan_premium() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.premium_requests
    where user_id = new.user_id and status = 'menunggu' and created_at > now() - interval '2 days'
  ) then
    raise exception 'Permintaan sebelumnya masih ditinjau admin. Kamu bisa mengirim lagi setelah diproses atau setelah 2 hari.';
  end if;
  return new;
end;
$$;
drop trigger if exists premium_requests_cek on premium_requests;
create trigger premium_requests_cek before insert on premium_requests
  for each row execute function cek_permintaan_premium();

-- Admin menyetujui / menolak. Setuju = Premium aktif (diperpanjang bila masih aktif)
-- 30 hari (1 bulan) atau 90 hari (3 bulan), lencana Premium otomatis terpasang.
create or replace function proses_premium(p_id uuid, p_setujui boolean, p_alasan text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.premium_requests;
  v_hari int;
begin
  if not public.is_admin() then
    raise exception 'Khusus admin';
  end if;
  select * into r from public.premium_requests where id = p_id for update;
  if r.id is null then
    raise exception 'Permintaan tidak ditemukan';
  end if;
  if r.status <> 'menunggu' then
    raise exception 'Permintaan sudah diproses';
  end if;

  update public.premium_requests
     set status = case when p_setujui then 'disetujui' else 'ditolak' end,
         alasan = case when p_setujui then null else nullif(trim(p_alasan), '') end,
         diproses_at = now()
   where id = p_id;

  if p_setujui then
    v_hari := case when r.paket = '3bulan' then 90 else 30 end;
    perform set_config('jj.premium_demo', '1', true);
    perform set_config('jj.lencana', '1', true);
    update public.profiles
       set premium_sampai = greatest(now(), coalesce(premium_sampai, now())) + make_interval(days => v_hari),
           lencana = 'premium'
     where id = r.user_id;
  end if;
end;
$$;
revoke execute on function proses_premium(uuid, boolean, text) from public, anon;
grant execute on function proses_premium(uuid, boolean, text) to authenticated;

-- Premium gratis (demo) tidak bisa lagi diaktifkan sendiri oleh user.
revoke execute on function aktifkan_premium_demo() from authenticated;

-- ---------- Bucket bukti transfer (privat) ----------
insert into storage.buckets (id, name, public)
values ('bukti-premium', 'bukti-premium', false)
on conflict (id) do nothing;

drop policy if exists "unggah bukti sendiri" on storage.objects;
create policy "unggah bukti sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'bukti-premium' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "baca bukti sendiri atau admin" on storage.objects;
create policy "baca bukti sendiri atau admin" on storage.objects for select to authenticated
  using (bucket_id = 'bukti-premium' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
