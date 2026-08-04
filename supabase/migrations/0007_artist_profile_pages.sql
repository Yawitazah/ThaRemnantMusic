-- Full artist profile pages (/artist/{slug}) — the Spotify-shaped view that
-- the link hub points at. Adds the pieces the label's data did not already
-- carry: tour dates, an artist pick, playlist placements, and follows.

-- Artist pick (a pinned release the artist wants front and centre) plus the
-- header numbers.
alter table artist_profiles add column if not exists pick_release_id bigint references releases (id) on delete set null;
alter table artist_profiles add column if not exists pick_note text;
alter table artist_profiles add column if not exists monthly_listeners integer;
alter table artist_profiles add column if not exists world_rank text;   -- e.g. "#1,204 in the world"
alter table artist_profiles add column if not exists hometown_rank text;

-- Seed monthly listeners from the platform rows already recorded.
update artist_profiles p
set monthly_listeners = pl.metric_value
from platforms pl
where p.monthly_listeners is null
  and pl.owner = p.artist
  and pl.platform = 'Spotify'
  and pl.metric = 'monthly listeners'
  and pl.metric_value is not null;

-- Tour dates.
create table if not exists tour_dates (
  id          bigserial primary key,
  artist      text not null,
  event_date  date not null,
  city        text not null,
  venue       text,
  ticket_url  text,
  note        text,
  sold_out    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists tour_dates_artist_idx on tour_dates (artist, event_date);
alter table tour_dates enable row level security;
create policy tour_dates_read  on tour_dates for select to anon, authenticated using (true);
create policy tour_dates_write on tour_dates for all to authenticated
  using (is_admin() or artist = my_artist()) with check (is_admin() or artist = my_artist());

-- "Discovered on" — playlists and shows carrying the artist's music.
create table if not exists discovered_on (
  id          bigserial primary key,
  artist      text not null,
  name        text not null,
  curator     text,
  url         text,
  followers   integer,
  image_url   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists discovered_on_artist_idx on discovered_on (artist, sort_order);
alter table discovered_on enable row level security;
create policy discovered_read  on discovered_on for select to anon, authenticated using (true);
create policy discovered_write on discovered_on for all to authenticated
  using (is_admin() or artist = my_artist()) with check (is_admin() or artist = my_artist());

-- Follows. A fan taps Follow without an account, so the row is keyed by the
-- browser's own id; an email is attached only when they also join the list.
create table if not exists artist_follows (
  id          bigserial primary key,
  artist      text not null,
  session_id  text not null,
  email       text,
  created_at  timestamptz not null default now(),
  unique (artist, session_id)
);
create index if not exists artist_follows_artist_idx on artist_follows (artist);
alter table artist_follows enable row level security;
-- Anyone may follow or unfollow themselves; only the team reads the raw rows.
create policy follows_insert on artist_follows for insert to anon, authenticated
  with check (length(artist) between 1 and 80 and length(session_id) between 4 and 64);
create policy follows_delete on artist_follows for delete to anon, authenticated
  using (true);
create policy follows_read on artist_follows for select to authenticated using (is_team());

-- Public follower counts without exposing the rows themselves.
create or replace function follower_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(artist, n), '{}'::jsonb)
  from (select artist, count(*) as n from artist_follows group by artist) t;
$$;
revoke all on function follower_counts() from public;
grant execute on function follower_counts() to anon, authenticated;
