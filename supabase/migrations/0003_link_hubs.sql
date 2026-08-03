-- Link hubs + first-party analytics.
--
-- Each artist gets a public link hub page (/a/{slug}) served by the dashboard.
-- Every page view and button press lands in hub_events. The public can INSERT
-- events and read hubs, but raw events are readable only by the team; the
-- public dashboard reads aggregate numbers through security-definer RPCs,
-- mirroring the zahbrandsolutions.com analytics pattern.

-- Public URL slug for each artist profile.
alter table artist_profiles add column if not exists slug text unique;

update artist_profiles set slug = 'breed'      where artist = 'BREED'         and slug is null;
update artist_profiles set slug = 'kingkonnect' where artist = 'King Konnect' and slug is null;
update artist_profiles set slug = 'jay'        where artist = 'JayThaRealist' and slug is null;
update artist_profiles set slug = 'yawitazah'  where artist = 'Yawitazah'     and slug is null;

-- The buttons on an artist's hub.
create table if not exists hub_links (
  id          bigserial primary key,
  artist      text not null,
  label       text not null,
  url         text not null,
  kind        text not null default 'link',   -- link | music | video | social | capture
  note        text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists hub_links_artist_idx on hub_links (artist, active, sort_order);

-- Every interaction with a hub. No personal data beyond what the browser
-- volunteers; email captures go to Zah CRM, only the count is recorded here.
create table if not exists hub_events (
  id          bigserial primary key,
  artist      text not null,
  link_id     bigint references hub_links (id) on delete set null,
  event       text not null check (event in ('view', 'click', 'capture')),
  referrer    text,
  ua          text,
  session_id  text,
  created_at  timestamptz not null default now()
);
create index if not exists hub_events_artist_time_idx on hub_events (artist, created_at desc);
create index if not exists hub_events_link_idx on hub_events (link_id) where link_id is not null;

-- Artists sign in with a magic link; this maps their email to their artist.
create table if not exists artist_users (
  email       text primary key,
  artist      text not null,
  note        text,
  added_at    timestamptz not null default now()
);

alter table hub_links    enable row level security;
alter table hub_events   enable row level security;
alter table artist_users enable row level security;

-- Team = an admin or a mapped artist account.
create or replace function is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from artist_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function is_team() from public;
grant execute on function is_team() to authenticated, anon;

-- Which artist does the signed-in account belong to? (null for admins/anon)
create or replace function my_artist() returns text
language sql stable security definer set search_path = public as $$
  select artist from artist_users
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;
revoke all on function my_artist() from public;
grant execute on function my_artist() to authenticated, anon;

-- hub_links: world reads (the public hub needs them), admin or the owning
-- artist writes.
create policy hub_links_read on hub_links for select to anon, authenticated using (true);
create policy hub_links_write on hub_links for all to authenticated
  using      (is_admin() or artist = my_artist())
  with check (is_admin() or artist = my_artist());

-- hub_events: anyone may record an event; only the team may read them raw.
create policy hub_events_insert on hub_events for insert to anon, authenticated
  with check (event in ('view', 'click', 'capture') and length(coalesce(artist, '')) between 1 and 80);
create policy hub_events_read on hub_events for select to authenticated using (is_team());
create policy hub_events_admin on hub_events for delete to authenticated using (is_admin());

-- artist_users: you can see your own mapping; admins manage the list.
create policy artist_users_own   on artist_users for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or is_admin());
create policy artist_users_admin on artist_users for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Public aggregates. The dashboard is public, so growth numbers are served
-- through definer RPCs that expose counts and trends but never raw rows.
-- ---------------------------------------------------------------------------

create or replace function hub_summary() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(a.artist, a.data), '{}'::jsonb) from (
    select artist, jsonb_build_object(
      'views_total',   count(*) filter (where event = 'view'),
      'clicks_total',  count(*) filter (where event = 'click'),
      'captures_total',count(*) filter (where event = 'capture'),
      'views_7d',      count(*) filter (where event = 'view'  and created_at > now() - interval '7 days'),
      'clicks_7d',     count(*) filter (where event = 'click' and created_at > now() - interval '7 days'),
      'views_28d',     count(*) filter (where event = 'view'  and created_at > now() - interval '28 days'),
      'clicks_28d',    count(*) filter (where event = 'click' and created_at > now() - interval '28 days'),
      'captures_28d',  count(*) filter (where event = 'capture' and created_at > now() - interval '28 days'),
      'daily', (
        select coalesce(jsonb_agg(jsonb_build_object('d', d.day, 'views', d.views, 'clicks', d.clicks) order by d.day), '[]'::jsonb)
        from (
          select date_trunc('day', created_at)::date as day,
                 count(*) filter (where event = 'view')  as views,
                 count(*) filter (where event = 'click') as clicks
          from hub_events e2
          where e2.artist = e.artist and e2.created_at > now() - interval '56 days'
          group by 1
        ) d
      ),
      'links', (
        select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'clicks', l.n) order by l.n desc), '[]'::jsonb)
        from (
          select hl.id, hl.label, count(e3.id) as n
          from hub_links hl
          left join hub_events e3 on e3.link_id = hl.id and e3.event = 'click'
          where hl.artist = e.artist
          group by hl.id, hl.label
        ) l
      )
    ) as data
    from hub_events e
    group by artist
  ) a;
$$;
revoke all on function hub_summary() from public;
grant execute on function hub_summary() to anon, authenticated;

-- Recent activity feed, sanitised: no user agents, referrer reduced to host.
create or replace function hub_recent(n integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'artist', r.artist, 'event', r.event, 'label', r.label,
    'ref', r.ref, 'at', r.created_at) order by r.created_at desc), '[]'::jsonb)
  from (
    select e.artist, e.event, hl.label,
           nullif(substring(coalesce(e.referrer, '') from '^https?://([^/]+)'), '') as ref,
           e.created_at
    from hub_events e
    left join hub_links hl on hl.id = e.link_id
    order by e.created_at desc
    limit greatest(1, least(coalesce(n, 30), 100))
  ) r;
$$;
revoke all on function hub_recent(integer) from public;
grant execute on function hub_recent(integer) to anon, authenticated;

-- Seed each artist's hub from the platform links already in the database.
insert into hub_links (artist, label, url, kind, sort_order)
select p.owner, p.platform, p.url, 'social', p.sort_order
from platforms p
where p.url is not null and p.owner is not null
  and not exists (select 1 from hub_links h where h.artist = p.owner and h.url = p.url);
