-- Unfollow could never work from the browser. A DELETE with a WHERE clause
-- needs SELECT on the rows it filters, and artist_follows is deliberately
-- readable only by the team — so anon matched zero rows and the delete
-- silently did nothing (HTTP 200, no effect).
--
-- Rather than expose the follow list publicly, unfollowing goes through a
-- definer function scoped to the caller's own visitor id.

create or replace function unfollow(p_artist text, p_session text)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if coalesce(p_session, '') = '' then return 0; end if;
  delete from artist_follows
   where artist = p_artist and session_id = p_session;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function unfollow(text, text) from public;
grant execute on function unfollow(text, text) to anon, authenticated;

-- The browser no longer issues a raw DELETE, so drop that policy.
drop policy if exists follows_delete on artist_follows;
