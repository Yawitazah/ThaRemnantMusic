-- Self-serve onboarding, team-visible fan captures, YouTube on releases.

-- 1. YouTube links on releases (hub + dashboard discography buttons).
alter table releases add column if not exists youtube_url text;

-- Best effort: singles that match a catalog video by title inherit its link.
update releases r set youtube_url = c.url
from catalog c
where r.youtube_url is null and lower(c.title) = lower(r.title);

-- 2. Invite codes. An invite ties a future account to an artist (or to plain
-- team membership when artist is null). Codes are handed out by Zah; claiming
-- one after sign-up is what links the new login to the roster.
create table if not exists team_invites (
  code       text primary key,
  artist     text,            -- null = team member without an artist page
  note       text,
  used_by    text,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table team_invites enable row level security;
create policy team_invites_admin on team_invites for all to authenticated
  using (is_admin()) with check (is_admin());

-- artist_users may now hold plain members (empty artist).
alter table artist_users alter column artist set default '';

create or replace function claim_invite(invite_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv team_invites;
begin
  if my_email = '' then
    raise exception 'Sign in first, then claim your invite.';
  end if;
  select * into inv from team_invites
    where upper(code) = upper(trim(invite_code)) and used_at is null;
  if inv.code is null then
    raise exception 'That invite code is not valid or was already used.';
  end if;
  update team_invites set used_by = my_email, used_at = now() where code = inv.code;
  insert into artist_users (email, artist, note)
    values (my_email, coalesce(inv.artist, ''), inv.note)
    on conflict (email) do update set artist = excluded.artist;
  return jsonb_build_object('artist', coalesce(inv.artist, ''));
end;
$$;
revoke all on function claim_invite(text) from public;
grant execute on function claim_invite(text) to authenticated;

-- Invite codes for the current roster (single use each).
insert into team_invites (code, artist, note) values
  ('REMNANT-BREED-7K2M', 'BREED',         'BREED — lead artist'),
  ('REMNANT-KING-4T9X',  'King Konnect',  'King Konnect'),
  ('REMNANT-JAY-8R3W',   'JayThaRealist', 'JayThaRealist'),
  ('REMNANT-ZAH-5N6Q',   'Yawitazah',     'Yawitazah'),
  ('REMNANT-TEAM-2J7V',  null,            'Team member — full visibility, no artist page')
on conflict (code) do nothing;

-- 3. Fan captures, stored in the label's own database so the whole team sees
-- every lead as it lands (they also forward to the Remnant CRM account).
create table if not exists hub_captures (
  id         bigserial primary key,
  artist     text not null,
  name       text,
  email      text not null,
  created_at timestamptz not null default now()
);
create index if not exists hub_captures_time_idx on hub_captures (created_at desc);
alter table hub_captures enable row level security;
create policy hub_captures_insert on hub_captures for insert to anon, authenticated
  with check (length(artist) between 1 and 80 and position('@' in email) > 1);
create policy hub_captures_read on hub_captures for select to authenticated using (is_team());
create policy hub_captures_admin on hub_captures for delete to authenticated using (is_admin());
