-- Analytics v2.
--
-- Three gaps this closes:
--   1. There was no window shorter than 7 days, so "what happened today" was
--      unanswerable.
--   2. "All time" was quietly capped at 56 days in the daily series.
--   3. Counts were artist-level only. Nothing said how many times a specific
--      release or track was played or clicked.
--
-- Adds a 24 hour window with an hourly series, previous-period counts so a
-- number can be shown as growth rather than a bare total, a per-item
-- breakdown, and a split between hub views and profile views.

-- Which page the event happened on, and which release/track it was about.
alter table hub_events add column if not exists page text;   -- hub | profile | label
alter table hub_events add column if not exists item text;   -- release or track title

-- Playing a track in the dock is not the same action as clicking out to a DSP,
-- and folding the two together made click-through meaningless.
alter table hub_events drop constraint if exists hub_events_event_check;
alter table hub_events add constraint hub_events_event_check
  check (event in ('view', 'click', 'play', 'capture'));

drop policy if exists hub_events_insert on hub_events;
create policy hub_events_insert on hub_events for insert to anon, authenticated
  with check (
    event in ('view', 'click', 'play', 'capture')
    and length(coalesce(artist, '')) between 1 and 80
    and length(coalesce(item, '')) <= 200
    and coalesce(page, 'hub') in ('hub', 'profile', 'label')
  );

create index if not exists hub_events_artist_item_idx
  on hub_events (artist, item) where item is not null;

-- Existing rows predate the split. Every one of them came from a hub or a
-- profile page; label them hub so the totals stay honest rather than null.
update hub_events set page = 'hub' where page is null;

-- ---------------------------------------------------------------------------
-- hub_summary v2
-- ---------------------------------------------------------------------------
create or replace function hub_summary() returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select now() - interval '24 hours' as t24,
           now() - interval '48 hours' as t48,
           now() - interval '7 days'   as t7,
           now() - interval '14 days'  as t14,
           now() - interval '28 days'  as t28,
           now() - interval '56 days'  as t56
  )
  select coalesce(jsonb_object_agg(a.artist, a.data), '{}'::jsonb) from (
    select e.artist, jsonb_build_object(
      'views_total',     count(*) filter (where e.event = 'view'),
      'clicks_total',    count(*) filter (where e.event = 'click'),
      'plays_total',     count(*) filter (where e.event = 'play'),
      'captures_total',  count(*) filter (where e.event = 'capture'),

      -- Rolling 24 hours, and the 24 hours before it for comparison.
      'views_24h',       count(*) filter (where e.event = 'view'    and e.created_at > b.t24),
      'clicks_24h',      count(*) filter (where e.event = 'click'   and e.created_at > b.t24),
      'plays_24h',       count(*) filter (where e.event = 'play'    and e.created_at > b.t24),
      'captures_24h',    count(*) filter (where e.event = 'capture' and e.created_at > b.t24),
      'views_prev_24h',  count(*) filter (where e.event = 'view'    and e.created_at > b.t48 and e.created_at <= b.t24),
      'clicks_prev_24h', count(*) filter (where e.event = 'click'   and e.created_at > b.t48 and e.created_at <= b.t24),
      'plays_prev_24h',  count(*) filter (where e.event = 'play'    and e.created_at > b.t48 and e.created_at <= b.t24),

      'views_7d',        count(*) filter (where e.event = 'view'    and e.created_at > b.t7),
      'clicks_7d',       count(*) filter (where e.event = 'click'   and e.created_at > b.t7),
      'plays_7d',        count(*) filter (where e.event = 'play'    and e.created_at > b.t7),
      'captures_7d',     count(*) filter (where e.event = 'capture' and e.created_at > b.t7),
      'views_prev_7d',   count(*) filter (where e.event = 'view'    and e.created_at > b.t14 and e.created_at <= b.t7),
      'clicks_prev_7d',  count(*) filter (where e.event = 'click'   and e.created_at > b.t14 and e.created_at <= b.t7),
      'plays_prev_7d',   count(*) filter (where e.event = 'play'    and e.created_at > b.t14 and e.created_at <= b.t7),

      'views_28d',       count(*) filter (where e.event = 'view'    and e.created_at > b.t28),
      'clicks_28d',      count(*) filter (where e.event = 'click'   and e.created_at > b.t28),
      'plays_28d',       count(*) filter (where e.event = 'play'    and e.created_at > b.t28),
      'captures_28d',    count(*) filter (where e.event = 'capture' and e.created_at > b.t28),
      'views_prev_28d',  count(*) filter (where e.event = 'view'    and e.created_at > b.t56 and e.created_at <= b.t28),
      'clicks_prev_28d', count(*) filter (where e.event = 'click'   and e.created_at > b.t56 and e.created_at <= b.t28),
      'plays_prev_28d',  count(*) filter (where e.event = 'play'    and e.created_at > b.t56 and e.created_at <= b.t28),

      -- Where the views landed. Legacy rows were backfilled to hub above.
      'views_hub',       count(*) filter (where e.event = 'view' and coalesce(e.page, 'hub') = 'hub'),
      'views_profile',   count(*) filter (where e.event = 'view' and e.page = 'profile'),

      'first_at',        min(e.created_at),
      'last_at',         max(e.created_at),

      -- Full history. The client slices this to whatever window is selected,
      -- so all time now means all time.
      'daily', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'd', d.day, 'views', d.views, 'clicks', d.clicks, 'plays', d.plays
               ) order by d.day), '[]'::jsonb)
        from (
          select date_trunc('day', e2.created_at)::date as day,
                 count(*) filter (where e2.event = 'view')  as views,
                 count(*) filter (where e2.event = 'click') as clicks,
                 count(*) filter (where e2.event = 'play')  as plays
          from hub_events e2
          where e2.artist = e.artist
          group by 1
        ) d
      ),

      -- Hour buckets for the 24 hour view.
      'hourly', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'h', to_char(h.hour, 'YYYY-MM-DD"T"HH24:00'), 'views', h.views, 'clicks', h.clicks, 'plays', h.plays
               ) order by h.hour), '[]'::jsonb)
        from (
          select date_trunc('hour', e5.created_at) as hour,
                 count(*) filter (where e5.event = 'view')  as views,
                 count(*) filter (where e5.event = 'click') as clicks,
                 count(*) filter (where e5.event = 'play')  as plays
          from hub_events e5
          where e5.artist = e.artist and e5.created_at > b.t24
          group by 1
        ) h
      ),

      -- Per hub link: clicks, with the same windows the header cards use.
      'links', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', l.id, 'label', l.label, 'clicks', l.n,
                 'clicks_24h', l.n24, 'clicks_7d', l.n7, 'clicks_28d', l.n28, 'last_at', l.last_at
               ) order by l.n desc), '[]'::jsonb)
        from (
          select hl.id, hl.label,
                 count(e3.id) as n,
                 count(e3.id) filter (where e3.created_at > b.t24) as n24,
                 count(e3.id) filter (where e3.created_at > b.t7)  as n7,
                 count(e3.id) filter (where e3.created_at > b.t28) as n28,
                 max(e3.created_at) as last_at
          from hub_links hl
          left join hub_events e3 on e3.link_id = hl.id and e3.event = 'click'
          where hl.artist = e.artist
          group by hl.id, hl.label
        ) l
      ),

      -- Per release/track: how many times it was played and clicked out.
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'item', i.item, 'plays', i.plays, 'clicks', i.clicks,
                 'plays_24h', i.plays24, 'clicks_24h', i.clicks24,
                 'plays_7d', i.plays7, 'clicks_7d', i.clicks7,
                 'plays_28d', i.plays28, 'clicks_28d', i.clicks28,
                 'last_at', i.last_at
               ) order by (i.plays + i.clicks) desc, i.item), '[]'::jsonb)
        from (
          select e4.item,
                 count(*) filter (where e4.event = 'play')   as plays,
                 count(*) filter (where e4.event = 'click')  as clicks,
                 count(*) filter (where e4.event = 'play'  and e4.created_at > b.t24) as plays24,
                 count(*) filter (where e4.event = 'click' and e4.created_at > b.t24) as clicks24,
                 count(*) filter (where e4.event = 'play'  and e4.created_at > b.t7)  as plays7,
                 count(*) filter (where e4.event = 'click' and e4.created_at > b.t7)  as clicks7,
                 count(*) filter (where e4.event = 'play'  and e4.created_at > b.t28) as plays28,
                 count(*) filter (where e4.event = 'click' and e4.created_at > b.t28) as clicks28,
                 max(e4.created_at) as last_at
          from hub_events e4
          where e4.artist = e.artist and e4.item is not null and e4.item <> ''
          group by e4.item
        ) i
      )
    ) as data
    from hub_events e cross join b
    group by e.artist, b.t24, b.t48, b.t7, b.t14, b.t28, b.t56
  ) a;
$$;
revoke all on function hub_summary() from public;
grant execute on function hub_summary() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- hub_recent v2 — carries page and item so the feed can say what actually
-- happened instead of printing the raw event name.
-- ---------------------------------------------------------------------------
create or replace function hub_recent(n integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'artist', r.artist, 'event', r.event, 'label', r.label, 'item', r.item,
    'page', r.page, 'ref', r.ref, 'at', r.created_at, 'sid', r.sid) order by r.created_at desc), '[]'::jsonb)
  from (
    select e.artist, e.event, coalesce(hl.label, e.label) as label, e.item,
           coalesce(e.page, 'hub') as page,
           nullif(substring(coalesce(e.referrer, '') from '^https?://([^/]+)'), '') as ref,
           -- A short opaque tag so repeat activity from one visitor is visible
           -- without exposing the session id itself.
           substring(md5(coalesce(e.session_id, e.id::text)) from 1 for 4) as sid,
           e.created_at
    from hub_events e
    left join hub_links hl on hl.id = e.link_id
    order by e.created_at desc
    limit greatest(1, least(coalesce(n, 30), 100))
  ) r;
$$;
revoke all on function hub_recent(integer) from public;
grant execute on function hub_recent(integer) to anon, authenticated;
