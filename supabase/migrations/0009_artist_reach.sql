-- Aggregated reach per artist, computed from the platform rows that actually
-- exist rather than invented chart positions. Every follower, subscriber and
-- monthly-listener figure the label has verified, summed, plus a rank inside
-- the roster and a per-platform breakdown for the About panel.

create or replace function artist_reach()
returns jsonb
language sql stable security definer set search_path = public as $$
  with per_platform as (
    select owner as artist, platform, url,
           coalesce(metric, '') as metric,
           coalesce(metric_value, 0) as value
    from platforms
    where owner is not null and coalesce(metric_value, 0) > 0
  ),
  totals as (
    select artist, sum(value) as reach, count(*) as counted
    from per_platform group by artist
  ),
  ranked as (
    select artist, reach, counted,
           rank() over (order by reach desc) as pos,
           (select count(*) from totals) as of_total
    from totals
  )
  select coalesce(jsonb_object_agg(r.artist, jsonb_build_object(
    'reach', r.reach,
    'rank', r.pos,
    'of', r.of_total,
    'platforms', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'platform', p.platform, 'metric', p.metric, 'value', p.value) order by p.value desc), '[]'::jsonb)
      from per_platform p where p.artist = r.artist
    )
  )), '{}'::jsonb)
  from ranked r;
$$;
revoke all on function artist_reach() from public;
grant execute on function artist_reach() to anon, authenticated;
