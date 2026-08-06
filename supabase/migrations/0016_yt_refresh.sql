-- Nightly YouTube refresh: the write side.
--
-- The server holds only the publishable key, which cannot write to catalog,
-- album_tracks or channels (those need is_admin()). Rather than give the server
-- a service-role key, this follows the pattern push_claim() already set: one
-- SECURITY DEFINER function gated on the shared secret in push_config, so the
-- server's power is exactly "apply these view counts" and nothing else.
--
-- Everything it can touch is a public metric that YouTube already shows the
-- world. It cannot insert or delete rows, cannot create tracks, and cannot reach
-- any other table — a leaked secret means someone could rewrite view counts,
-- not read the budget.
--
-- Shape of p_videos:  [{"video_id":"abc123","views":4821}, ...]
-- Shape of p_channels:[{"handle":"@Name","subs":237000,"videos":2201}, ...]

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
    select x.handle, x.subs, x.videos
    from jsonb_to_recordset(p_channels) as x(handle text, subs bigint, videos bigint)
    where x.handle is not null and coalesce(x.subs, 0) > 0
  )
  update channels ch
     set subs = c.subs,
         videos = case when coalesce(c.videos, 0) > 0 then c.videos else ch.videos end,
         updated_at = now()
    from c
   where lower(ch.handle) = lower(c.handle);
  get diagnostics n_chan = row_count;

  return jsonb_build_object(
    'catalog', n_cat, 'album_tracks', n_album, 'channels', n_chan);
end;
$$;

revoke all on function public.yt_apply(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_apply(text, jsonb, jsonb) to anon;

-- The ids the job needs to ask YouTube about. Read-only, no metrics returned, so
-- it stays harmless even though anon can call it.
create or replace function public.yt_video_ids()
returns table (video_id text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct video_id from (
    select video_id from catalog      where video_id is not null and video_id <> ''
    union
    select video_id from album_tracks where video_id is not null and video_id <> ''
  ) s;
$$;

create or replace function public.yt_handles()
returns table (handle text)
language sql
stable
security definer
set search_path = public
as $$
  select handle from channels where handle is not null and handle <> '';
$$;

grant execute on function public.yt_video_ids() to anon, authenticated;
grant execute on function public.yt_handles()   to anon, authenticated;
