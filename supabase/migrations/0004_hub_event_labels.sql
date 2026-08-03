-- Not every tracked button is a hub_links row — discography buttons (Spotify /
-- Apple per release) and other inline actions carry their own label instead.

alter table hub_events add column if not exists label text;

-- hub_recent: prefer the hub link's label, fall back to the event's own.
create or replace function hub_recent(n integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'artist', r.artist, 'event', r.event, 'label', r.label,
    'ref', r.ref, 'at', r.created_at) order by r.created_at desc), '[]'::jsonb)
  from (
    select e.artist, e.event, coalesce(hl.label, e.label) as label,
           nullif(substring(coalesce(e.referrer, '') from '^https?://([^/]+)'), '') as ref,
           e.created_at
    from hub_events e
    left join hub_links hl on hl.id = e.link_id
    order by e.created_at desc
    limit greatest(1, least(coalesce(n, 30), 100))
  ) r;
$$;

-- hub_summary: fold labelled (non-hub-link) clicks into the per-link list.
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
        select coalesce(jsonb_agg(jsonb_build_object('label', l.label, 'clicks', l.n) order by l.n desc), '[]'::jsonb)
        from (
          select coalesce(hl.label, e3.label, 'other') as label, count(*) as n
          from hub_events e3
          left join hub_links hl on hl.id = e3.link_id
          where e3.artist = e.artist and e3.event = 'click'
          group by 1
        ) l
      )
    ) as data
    from hub_events e
    group by artist
  ) a;
$$;
