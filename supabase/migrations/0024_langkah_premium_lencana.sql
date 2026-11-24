-- =================================================================
-- Jejak Jajan - Langkah pembuatan khusus Premium + Kustom lencana (badge)
-- Jalankan setelah 0023 di Supabase Dashboard > SQL Editor.
-- =================================================================

-- ---------- 1. Langkah pembuatan khusus Premium ----------
-- Langkah (recipe_steps) hanya terbaca oleh Premium, admin, dan pengirim resep.
drop policy if exists "baca langkah" on recipe_steps;
create policy "baca langkah" on recipe_steps for select
  using (
    exists (select 1 from recipes r where r.id = recipe_id)
    and (
      public.is_premium((select auth.uid()))
      or public.is_admin()
      or exists (select 1 from recipes r where r.id = recipe_id and r.created_by = (select auth.uid()))
    )
  );

-- Jumlah langkah resep sebuah jajanan (boleh dilihat semua orang),
-- untuk menampilkan kotak "khusus Premium" tanpa membuka isinya.
create or replace function jumlah_langkah(p_slug text) returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.recipe_steps st
  join public.recipes r on r.id = st.recipe_id
  join public.snacks s on s.id = r.snack_id
  where s.slug = p_slug and s.status = 'approved' and r.status = 'approved';
$$;
grant execute on function jumlah_langkah(text) to anon, authenticated;

-- Kirim jajanan: langkah hanya disimpan untuk akun Premium / admin;
-- resep tetap disimpan bila ada bahan walau tanpa langkah.
create or replace function kirim_jajanan(data jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_slug text;
  v_snack uuid;
  v_recipe uuid;
  v_prov smallint;
  langkah jsonb;
  lok jsonb;
  i int := 0;
  v_premium boolean;
begin
  if uid is null then
    raise exception 'Harus masuk dulu';
  end if;

  -- Provinsi kini opsional (boleh kosong)
  v_prov := (select id from public.provinces where slug = nullif(data ->> 'provinsi', ''));

  -- Slug dari nama; tambah akhiran acak kalau sudah dipakai.
  v_slug := trim(both '-' from regexp_replace(lower(data ->> 'nama'), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    raise exception 'Nama tidak valid';
  end if;
  if exists (select 1 from public.snacks where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end if;

  insert into public.snacks (slug, nama, nama_lain, province_id, daerah_detail, category_id,
                             deskripsi_singkat, cerita, sumber_info, cover_url, status, created_by)
  values (
    v_slug,
    trim(data ->> 'nama'),
    coalesce(array(select trim(x) from jsonb_array_elements_text(data -> 'namaLain') x where trim(x) <> ''), '{}'),
    v_prov,
    nullif(trim(data ->> 'daerah'), ''),
    (select id from public.categories where nama = data ->> 'kategori'),
    nullif(trim(data ->> 'deskripsi'), ''),
    nullif(trim(data ->> 'cerita'), ''),
    nullif(trim(data ->> 'sumber'), ''),
    nullif(data ->> 'cover', ''),
    'pending',
    uid
  )
  returning id into v_snack;

  -- Langkah pembuatan khusus Premium (admin otomatis Premium)
  v_premium := public.is_premium(uid) or public.is_admin();

  -- Resep (opsional): disimpan bila ada bahan, atau ada langkah dari akun Premium.
  if jsonb_array_length(coalesce(data -> 'resep' -> 'bahan', '[]')) > 0
     or (v_premium and exists (
       select 1 from jsonb_array_elements(coalesce(data -> 'resep' -> 'langkah', '[]')) l
       where trim(coalesce(l ->> 'instruksi', '')) <> '')) then
    insert into public.recipes (snack_id, judul_versi, bahan, porsi, waktu_menit, kesulitan, video_url, status, created_by)
    values (
      v_snack,
      coalesce(nullif(trim(data -> 'resep' ->> 'judulVersi'), ''), 'Versi rumahan'),
      coalesce(data -> 'resep' -> 'bahan', '[]'),
      nullif(data -> 'resep' ->> 'porsi', '')::smallint,
      nullif(data -> 'resep' ->> 'waktuMenit', '')::smallint,
      nullif(data -> 'resep' ->> 'kesulitan', '')::public.difficulty,
      nullif(trim(data -> 'resep' ->> 'videoUrl'), ''),
      'pending',
      uid
    )
    returning id into v_recipe;

    for langkah in select * from jsonb_array_elements(case when v_premium then coalesce(data -> 'resep' -> 'langkah', '[]') else '[]'::jsonb end) loop
      if trim(coalesce(langkah ->> 'instruksi', '')) <> '' then
        i := i + 1;
        insert into public.recipe_steps (recipe_id, urutan, instruksi, foto_url, video_url)
        values (v_recipe, i, trim(langkah ->> 'instruksi'),
                nullif(langkah ->> 'foto', ''), nullif(trim(langkah ->> 'videoUrl'), ''));
      end if;
    end loop;
  end if;

  -- Lokasi terlihat (opsional)
  lok := data -> 'lokasi';
  if lok is not null and trim(coalesce(lok ->> 'tempat', '')) <> '' then
    insert into public.sightings (snack_id, nama_tempat, area, province_id, jenis, maps_url,
                                  tanggal_terlihat, order_url, izin_publik, status, created_by)
    values (
      v_snack,
      trim(lok ->> 'tempat'),
      coalesce(nullif(trim(lok ->> 'area'), ''), (select nama from public.provinces where id = v_prov), '-'),
      v_prov,
      coalesce(nullif(lok ->> 'jenis', ''), 'kios_tetap')::public.sighting_kind,
      nullif(trim(lok ->> 'mapsUrl'), ''),
      coalesce(nullif(lok ->> 'tanggal', '')::date, current_date),
      nullif(trim(lok ->> 'orderUrl'), ''),
      coalesce((lok ->> 'izinPublik')::boolean, false),
      'pending',
      uid
    );
  end if;

  -- Vote kelangkaan dari pengirim (opsional)
  if nullif(data ->> 'rarity', '') is not null then
    insert into public.rarity_votes (user_id, snack_id, nilai)
    values (uid, v_snack, (data ->> 'rarity')::public.rarity_level);
  end if;

  return v_slug;
end;
$$;

-- Edit kontribusi: langkah hanya bisa diubah akun Premium / admin.
create or replace function edit_jajanan(p_slug text, data jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_snack uuid;
  v_recipe uuid;
  lama jsonb;
  langkah text;
  i int := 0;
begin
  select id into v_snack from public.snacks
   where slug = p_slug and created_by = uid and status = 'approved';
  if v_snack is null then
    raise exception 'Hanya pengirim yang bisa mengedit, dan hanya setelah disetujui admin';
  end if;
  if char_length(trim(data ->> 'nama')) not between 2 and 80 then
    raise exception 'Nama 2-80 karakter';
  end if;

  update public.snacks set
    nama = trim(data ->> 'nama'),
    nama_lain = coalesce(array(select trim(x) from jsonb_array_elements_text(data -> 'namaLain') x where trim(x) <> ''), '{}'),
    deskripsi_singkat = left(nullif(trim(data ->> 'deskripsi'), ''), 200),
    cerita = nullif(trim(data ->> 'cerita'), ''),
    daerah_detail = nullif(trim(data ->> 'daerah'), ''),
    sumber_info = nullif(trim(data ->> 'sumber'), ''),
    diedit_at = now(),
    updated_at = now()
  where id = v_snack;

  select id into v_recipe from public.recipes
   where snack_id = v_snack and created_by = uid order by created_at limit 1;
  if v_recipe is not null and data ? 'resep' then
    update public.recipes set
      bahan = coalesce(data -> 'resep' -> 'bahan', bahan),
      porsi = nullif(data -> 'resep' ->> 'porsi', '')::smallint,
      waktu_menit = nullif(data -> 'resep' ->> 'waktuMenit', '')::smallint,
      kesulitan = nullif(data -> 'resep' ->> 'kesulitan', '')::public.difficulty,
      video_url = nullif(trim(data -> 'resep' ->> 'videoUrl'), '')
    where id = v_recipe;

    -- Langkah pembuatan hanya bisa diubah akun Premium / admin
    if (public.is_premium(uid) or public.is_admin())
       and jsonb_array_length(coalesce(data -> 'resep' -> 'langkah', '[]')) > 0 then
      select coalesce(jsonb_agg(jsonb_build_object('foto', foto_url, 'video', video_url) order by urutan), '[]')
        into lama from public.recipe_steps where recipe_id = v_recipe;
      delete from public.recipe_steps where recipe_id = v_recipe;
      for langkah in select jsonb_array_elements_text(data -> 'resep' -> 'langkah') loop
        if trim(langkah) <> '' then
          i := i + 1;
          insert into public.recipe_steps (recipe_id, urutan, instruksi, foto_url, video_url)
          values (v_recipe, i, trim(langkah), lama -> (i - 1) ->> 'foto', lama -> (i - 1) ->> 'video');
        end if;
      end loop;
    end if;
  end if;
end;
$$;

-- ---------- 2. Kustom lencana (badge) ----------
-- Lencana yang dipakai user; terbuka sesuai level, Premium, atau admin.
alter table profiles add column if not exists lencana text;
alter table profiles drop constraint if exists profiles_lencana_check;
alter table profiles add constraint profiles_lencana_check check (
  lencana is null or lencana in ('pencicip', 'penjelajah', 'penjaga_resep', 'penjaga_warisan', 'premium', 'admin')
);

-- Lencana hanya boleh diubah lewat fungsi di bawah (atau oleh admin).
create or replace function protect_lencana() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.lencana is distinct from old.lencana
     and (select auth.uid()) is not null
     and coalesce(current_setting('jj.lencana', true), '') <> '1'
     and not public.is_admin() then
    raise exception 'Tidak boleh mengubah lencana langsung';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_lencana on profiles;
create trigger profiles_protect_lencana before update on profiles
  for each row execute function protect_lencana();

-- Apakah lencana sudah terbuka untuk user?
create or replace function lencana_terbuka(uid uuid, p text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_admin boolean := exists (select 1 from public.profiles where id = uid and role = 'admin');
  n int := (select count(*) from public.snacks where created_by = uid and status = 'approved');
begin
  if v_admin then return true; end if;
  return case p
    when 'pencicip' then true
    when 'penjelajah' then n >= 5
    when 'penjaga_resep' then n >= 10
    when 'penjaga_warisan' then n >= 20
    when 'premium' then public.is_premium(uid)
    else false
  end;
end;
$$;

-- Pasang (equip) / lepas (p = null) lencana milik sendiri.
create or replace function pasang_lencana(p text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Harus masuk dulu';
  end if;
  if p is not null and not public.lencana_terbuka(auth.uid(), p) then
    raise exception 'Lencana belum terbuka';
  end if;
  perform set_config('jj.lencana', '1', true);
  update public.profiles set lencana = p where id = auth.uid();
end;
$$;
revoke execute on function pasang_lencana(text) from public, anon;
grant execute on function pasang_lencana(text) to authenticated;

-- Premium demo: saat aktif, lencana Premium otomatis dipasang; saat batal, dilepas.
create or replace function aktifkan_premium_demo() returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_sampai timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null then
    raise exception 'Harus masuk dulu';
  end if;
  perform set_config('jj.premium_demo', '1', true);
  perform set_config('jj.lencana', '1', true);
  update public.profiles set premium_sampai = v_sampai, lencana = 'premium' where id = auth.uid();
  return v_sampai;
end;
$$;

create or replace function batalkan_premium_demo() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Harus masuk dulu';
  end if;
  perform set_config('jj.premium_demo', '1', true);
  perform set_config('jj.lencana', '1', true);
  update public.profiles
     set premium_sampai = null,
         lencana = case when lencana = 'premium' then null else lencana end
   where id = auth.uid();
end;
$$;

-- Isi awal: admin memakai lencana Admin, Premium aktif memakai lencana Premium.
update profiles set lencana = 'admin' where role = 'admin' and lencana is null;
update profiles set lencana = 'premium' where role <> 'admin' and premium_sampai > now() and lencana is null;
