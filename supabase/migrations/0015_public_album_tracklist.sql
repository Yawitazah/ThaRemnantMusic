-- The album lineup, exposed read-only to the public label page.
--
-- album_tracks stays locked to the team (migration 0014): its RLS is untouched
-- and anon still cannot touch the table. What fans need is the LINEUP — track
-- order, titles, features, the YouTube id to play it, the release date — so
-- that exact column list goes out through a definer function, same pattern as
-- hub_summary()/hub_recent(). Columns added to the table later never leak by
-- default, because this function names its columns instead of using *.
--
-- Per-track stream counts are deliberately NOT exposed. The label page already
-- shows play counts where Zah chose to show them (Most played); the album
-- section is a tracklist, not a scoreboard.

create or replace function public.album_tracklist()
returns table (
  track_no  integer,
  title     text,
  features  text,
  video_id  text,
  released  text
)
language sql
stable
security definer
set search_path = public
as $$
  select track_no, title, features, video_id, released
  from album_tracks
  order by sort_order, track_no;
$$;

grant execute on function public.album_tracklist() to anon, authenticated;
