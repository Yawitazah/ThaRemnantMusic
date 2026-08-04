-- Label staff who are not recording artists.
--
-- Byron "Breakout" Davis joins as artist manager and A&R. Putting him in
-- artist_profiles would have listed him on the public roster as a recording
-- artist and given him a growth page with no music behind it, which
-- misrepresents what he does. This is the right shape for management,
-- and every future non-artist hire lands here too.

create table if not exists team_members (
  id          bigserial primary key,
  name        text not null,
  title       text not null,           -- Artist manager, A&R, engineer, and so on
  short       text,                    -- one line, used on cards
  bio         text,
  highlights  text[] not null default '{}',
  based       text,
  image_url   text,
  links       jsonb not null default '[]'::jsonb,  -- [{label, url}]
  is_public   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table team_members enable row level security;

-- The public label page reads the published rows; the team edits.
create policy team_members_read on team_members for select to anon, authenticated
  using (is_public or is_team());
create policy team_members_write on team_members for all to authenticated
  using (is_admin()) with check (is_admin());

insert into team_members (name, title, short, bio, highlights, based, sort_order)
select
  'Byron "Breakout" Davis',
  'Artist manager · A&R · music executive',
  'Founded BreakoutYear Entertainment at 17. Atlanta, Los Angeles, Charlotte, China and Taiwan.',
  'Byron "Breakout" Davis is a music executive, artist manager and A&R strategist whose '
  || 'career spans artist development, songwriting, publishing, producer management, event '
  || 'production and music business consulting. He founded BreakoutYear Entertainment at 17, '
  || 'built around finding raw talent before the rest of the industry does, and learned the '
  || 'business from inside Atlanta''s recording studios rather than from the outside. He '
  || 'believes artists are built through vision, relationships, consistency and strategic '
  || 'execution, not viral moments alone.',
  array[
    'Founded BreakoutYear Entertainment at 17',
    'Interned with Creative Artists Agency (CAA) in Los Angeles',
    'Managed Jalen Santoy, whose breakout "Foreplay" led to releases through Empire Distribution',
    'Managed Philadelphia rapper Young Gliss and songwriter-producer Devonte',
    'Worked alongside people connected to RCA, Sony/ATV, Atlantic and Warner Music Group',
    'Assistant to songwriter TC through Make Ah Sound',
    'Producer partnerships worldwide, including Germany-based Sky High Beats',
    'Booked and ran events at Charlotte''s Music Factory, including Club Label',
    'Built entertainment relationships across China and Taiwan from 2015'
  ],
  'Atlanta · Los Angeles · Charlotte',
  1
where not exists (select 1 from team_members where name = 'Byron "Breakout" Davis');

-- His own single-use code for /join. artist is null: full team visibility, no
-- artist page of his own.
insert into team_invites (code, artist, note)
select 'REMNANT-BYRON-3D8P', null, 'Byron "Breakout" Davis — artist manager and A&R'
where not exists (select 1 from team_invites where code = 'REMNANT-BYRON-3D8P');
