-- =================================================================
-- Jejak Jajan - Batas simpan jajanan: akun gratis maks. 10, Premium/admin tanpa batas
-- Jalankan setelah 0024 di Supabase Dashboard > SQL Editor.
-- =================================================================

create or replace function batas_simpan() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_premium(new.user_id) or exists (select 1 from public.profiles where id = new.user_id and role = 'admin'))
     and (select count(*) from public.saves where user_id = new.user_id) >= 10 then
    raise exception 'Batas simpan akun gratis 10 jajanan. Upgrade ke Premium untuk simpan tanpa batas.';
  end if;
  return new;
end;
$$;

drop trigger if exists saves_batas on saves;
create trigger saves_batas before insert on saves
  for each row execute function batas_simpan();
