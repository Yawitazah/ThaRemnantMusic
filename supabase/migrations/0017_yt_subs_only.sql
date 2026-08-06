-- videoCount from the YouTube API is EVERY upload on a channel — Shorts, live
-- streams, reaction videos — not the music. Refreshing it replaced a curated
-- count of 40 music videos with 244 of everything, which measures nothing this
-- dashboard cares about. `channels.videos` is now left alone by the nightly job
-- and stays whatever the team sets deliberately; the catalog table is the real
-- count of music. Subscribers are still refreshed. See the matching change in
-- server.js, which stopped sending videoCount at all.

create or replace function public.yt_apply(
  p_secret   text,
  p_videos   jsonb default '[]'::jsonb,
  p_channels jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ok       boolean;
  n_cat    int := 0;
  n_album  int := 0;
  n_chan   int := 0;
begin
  select exists (select 1 from push_config where secret = p_secret) into ok;
  if not ok then
    raise exception 'bad secret';
  end if;

  /* Views only ever move forward. A transient API answer of 0 or null must not
     wipe a real number, so every update requires the new value to be higher
     than what is stored. That makes the job safely re-runnable. */
  with v as (
    select x.video_id, x.views
    from jsonb_to_recordset(p_videos) as x(video_id text, views bigint)
    where x.video_id is not null and coalesce(x.views, 0) > 0
  )
  update catalog c
     set views = v.views, updated_at = now()
    from v
   where c.video_id = v.video_id
     and v.views > coalesce(c.views, 0);
  get diagnostics n_cat = row_count;

  with v as (
    select x.video_id, x.views
    from jsonb_to_recordset(p_videos) as x(video_id text, views bigint)
    where x.video_id is not null and coalesce(x.views, 0) > 0
  )
  update album_tracks a
     set yt_views = v.views, updated_at = now()
    from v
   where a.video_id = v.video_id
     and v.views > coalesce(a.yt_views, 0);
  get diagnostics n_album = row_count;

  /* Subscriber counts CAN legitimately fall, so these are not gated on growth —
     only on being a real number rather than a null or zero from a failed lookup. */
  with c as (
    select x.handle, x.subs
    from jsonb_to_recordset(p_channels) as x(handle text, subs bigint)
    where x.handle is not null and coalesce(x.subs, 0) > 0
  )
  update channels ch
     set subs = c.subs, updated_at = now()
    from c
   where lower(ch.handle) = lower(c.handle);
  get diagnostics n_chan = row_count;

  return jsonb_build_object(
    'catalog', n_cat, 'album_tracks', n_album, 'channels', n_chan);
end;
$$;

revoke all on function public.yt_apply(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_apply(text, jsonb, jsonb) to anon;

