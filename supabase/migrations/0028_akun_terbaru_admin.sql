-- =================================================================
-- Jejak Jajan - Admin melihat 10 akun terbaru (username + email)
-- Email ada di auth.users (tidak bisa dibaca klien), jadi lewat fungsi
-- security definer yang hanya bisa dipakai admin.
-- Jalankan setelah 0027 di Supabase Dashboard > SQL Editor.
-- =================================================================

create or replace function akun_terbaru()
returns table (username text, email text, dibuat timestamptz, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Khusus admin';
  end if;
  return query
    select p.username::text, u.email::text, u.created_at, count(*) over ()
      from auth.users u
      left join public.profiles p on p.id = u.id
     order by u.created_at desc
     limit 10;
end;
$$;
revoke execute on function akun_terbaru() from public, anon;
grant execute on function akun_terbaru() to authenticated;
