-- Tha Remnant Music Group — close the internal tables to the public.
--
-- Until now the dashboard rendered for anyone who typed the URL, and every table
-- behind it granted `SELECT` to `anon` with `USING (true)`. The Supabase anon key
-- ships inside the page, so the budget, the album ledger, the opportunity pipeline
-- and the weekly numbers were readable by anyone who opened devtools — with or
-- without a login screen in front of them.
--
-- /command now requires a team sign-in (public/js/gate.js). This is the half that
-- makes that real: the internal tables move from "anyone" to `is_team()`.
--
-- The tables below were each checked against the anon-facing code first
-- (label.js, hub.js, profile.js, dock.js, install.js, join.js, teambar.js,
-- server.js). None of them are read by the public label page, the link hubs or the
-- artist pages, so locking them cannot break tharemnant.com.
--
-- DELIBERATELY LEFT PUBLIC, because the public pages do read them:
--   artist_profiles, releases, projects, catalog, channels, hub_links, settings,
--   tour_dates, discovered_on, team_members (already `is_public OR is_team()`).
-- `projects` was checked column by column — title, artist, kind, status, video ids,
-- blurb, track_count, priority. No money in it. If financial columns are ever added
-- to `projects`, this decision has to be revisited.

do $$
declare
  t text;
  p text;
  internal text[] := array[
    'budget_lines',      -- the budget
    'weekly_snapshots',  -- weekly tracking
    'opportunities',      -- opportunity pipeline
    'playbook_items',    -- the 90-day playbook
    'album_tracks',      -- album ledger, per track
    'prior_catalog',     -- prior catalog
    'platforms',         -- per-platform internal numbers
    'roster',            -- internal roster rows
    'zah_tracks',
    'name_collisions'
  ];
begin
  foreach t in array internal loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not present', t;
      continue;
    end if;

    -- Drop every existing SELECT policy by name rather than assuming one, so this
    -- is correct even where the policy was called something else (zah_tracks used
    -- `zah_read`, name_collisions used `collisions_read`).
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t and cmd = 'SELECT'
    loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (is_team())',
      t || '_read_team', t);

    -- Belt and braces: even with no policy, a stray future GRANT to anon would be
    -- gated by RLS, but revoking the table grant means anon cannot reach it at all.
    execute format('revoke select on public.%I from anon', t);
  end loop;
end $$;
