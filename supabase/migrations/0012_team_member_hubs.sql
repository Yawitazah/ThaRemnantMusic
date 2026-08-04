-- Give team members the same public surface an artist gets: a slug, a link hub
-- at /a/{slug}, and the hub analytics that come with it.
--
-- Management does not belong on the public label page, which is the artists'
-- page. Byron's presence is the Command Center plus his own link hub, exactly
-- the way each artist has a page, stats and a hub.

alter table team_members add column if not exists slug text unique;

update team_members set slug = 'byron'
 where name = 'Byron "Breakout" Davis' and slug is null;

-- hub_links and hub_events key on a plain artist name, so a team member's hub
-- works through the same machinery with no special case. This lets the owner
-- edit their own hub the way an artist edits theirs.
create or replace function my_artist() returns text
language sql stable security definer set search_path = public as $$
  select artist from (
    select artist from artist_users
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    union all
    select name from team_members
     where lower(coalesce(owner_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) m limit 1;
$$;
revoke all on function my_artist() from public;
grant execute on function my_artist() to authenticated, anon;

-- Which email owns this team member's profile and hub. Set when they claim
-- their invite code.
alter table team_members add column if not exists owner_email text;

-- is_team() must recognise a team member the same way it recognises an artist.
create or replace function is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin()
    or exists (select 1 from artist_users
                where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    or exists (select 1 from team_members
                where lower(coalesce(owner_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function is_team() from public;
grant execute on function is_team() to authenticated, anon;

-- A team member may edit their own row; admins edit everyone.
drop policy if exists team_members_write on team_members;
create policy team_members_write on team_members for all to authenticated
  using      (is_admin() or lower(coalesce(owner_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (is_admin() or lower(coalesce(owner_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
