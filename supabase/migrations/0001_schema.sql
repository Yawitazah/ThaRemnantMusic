-- Tha Remnant Music Group — Label Command Center
-- Public read, authenticated write.

create table if not exists channels (
  id            bigserial primary key,
  name          text not null,
  handle        text,
  url           text,
  subs          integer not null default 0,
  videos        integer not null default 0,
  recent_avg    integer not null default 0,
  kind          text,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists roster (
  id            bigserial primary key,
  name          text not null,
  role          text,
  channel_name  text,
  handle        text,
  subs          integer not null default 0,
  videos        integer not null default 0,
  recent_avg    integer not null default 0,
  secondary     text,
  verdict       text,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists catalog (
  id            bigserial primary key,
  video_id      text unique not null,
  url           text,
  title         text not null,
  credit        text,
  artists       text[] not null default '{}',
  views         integer not null default 0,
  era           text,
  channel       text,
  note          text,
  updated_at    timestamptz not null default now()
);

create table if not exists album_tracks (
  id            bigserial primary key,
  track_no      integer not null,
  title         text not null,
  features      text,
  released      text,
  video_id      text,
  yt_views      integer not null default 0,
  alt_views     integer,
  alt_label     text,
  spotify       integer not null default 0,
  apple         integer not null default 0,
  other         integer not null default 0,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists prior_catalog (
  id            bigserial primary key,
  title         text not null,
  age           text,
  views         integer not null default 0,
  format        text,
  sort_order    integer not null default 0
);

create table if not exists playbook_items (
  id            bigserial primary key,
  week          text not null,
  phase         text,
  task          text not null,
  done          boolean not null default false,
  note          text,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists opportunities (
  id            bigserial primary key,
  move          text not null,
  owner         text,
  cost          text,
  timeframe     text,
  impact        text not null default 'medium',
  status        text not null default 'Not started',
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists budget_lines (
  id            bigserial primary key,
  label         text not null,
  amount        numeric not null default 0,
  rationale     text,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists weekly_snapshots (
  id                bigserial primary key,
  week_of           date not null unique,
  gt_subs           integer,
  music_subs        integer,
  yt_views_28d      integer,
  spotify_listeners integer,
  spotify_followers integer,
  total_streams     integer,
  revenue           numeric,
  note              text,
  created_at        timestamptz not null default now()
);

create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists catalog_views_idx   on catalog (views desc);
create index if not exists catalog_artists_idx on catalog using gin (artists);
create index if not exists weekly_week_idx     on weekly_snapshots (week_of desc);

-- Row level security: the whole team reads, only signed-in accounts write.
do $$
declare t text;
begin
  foreach t in array array[
    'channels','roster','catalog','album_tracks','prior_catalog',
    'playbook_items','opportunities','budget_lines','weekly_snapshots','settings'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t||'_read', t);
    execute format('create policy %I on %I for all to authenticated using (true) with check (true)', t||'_write', t);
  end loop;
end $$;
