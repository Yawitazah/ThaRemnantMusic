-- Writes were originally open to any authenticated user. Supabase allows public
-- sign-up by default, which would have let anyone who created an account edit the
-- label's numbers. Writes are now limited to an explicit list of admin emails.

create table if not exists admins (
  email      text primary key,
  note       text,
  added_at   timestamptz not null default now()
);

insert into admins (email, note)
values ('zahbrandsolutions@gmail.com', 'Zah — label marketing lead')
on conflict (email) do nothing;

alter table admins enable row level security;

drop policy if exists admins_read  on admins;
drop policy if exists admins_write on admins;

create policy admins_read on admins for select to authenticated
  using (lower(auth.jwt() ->> 'email') in (select lower(email) from admins));

create policy admins_write on admins for all to authenticated
  using      (lower(auth.jwt() ->> 'email') in (select lower(email) from admins))
  with check (lower(auth.jwt() ->> 'email') in (select lower(email) from admins));

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated, anon;

do $$
declare t text;
begin
  foreach t in array array[
    'channels','roster','catalog','album_tracks','prior_catalog',
    'playbook_items','opportunities','budget_lines','weekly_snapshots','settings'
  ]
  loop
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t||'_write', t);
  end loop;
end $$;

-- To add another admin later:
--   insert into admins (email, note) values ('someone@example.com', 'who they are');
