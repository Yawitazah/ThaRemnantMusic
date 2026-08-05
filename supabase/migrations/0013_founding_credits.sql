-- Founding credits, corrected.
--
-- The record said BREED was "label founder". He is not the sole founder. The
-- label was founded by BREED and Yawitazah together, and the professional
-- shape of that is:
--
--   Co-founder            the company was started by the two of them
--   Principal investor    BREED funds it, and the industry word for the person
--                         who puts the money in is the principal
--   Founding artist       King Konnect and JayThaRealist were on the roster
--                         from the start, which is a real credit and a
--                         different one from founding the company
--
-- BREED's second contribution is the audience: the commentary channel is the
-- only real reach the label has, so "the audience the label runs on" stays.
-- Yawitazah's is strategy and marketing, which is what "the brains behind the
-- operation" means in a title someone outside the label will understand.

update artist_profiles set
  role = 'Co-founder · Principal investor · Lead artist',
  tagline = 'Co-founder and principal investor. The audience the label runs on.',
  updated_at = now()
where artist = 'BREED';

update artist_profiles set
  role = 'Co-founder · Strategy, marketing and creative',
  tagline = 'Co-founder. The strategy behind the label, and the marketer who makes the music.',
  updated_at = now()
where artist = 'Yawitazah';

update artist_profiles set
  role = 'Founding artist · under 25',
  updated_at = now()
where artist = 'King Konnect';

update artist_profiles set
  role = 'Founding artist · producer · engineer · under 25',
  updated_at = now()
where artist = 'JayThaRealist';

-- The internal roster carries the same titles, so the two never disagree.
update roster set role = 'Co-founder · Principal investor · Lead artist', updated_at = now()
 where name = 'BREED';
update roster set role = 'Co-founder · Strategy, marketing and creative', updated_at = now()
 where name = 'Yawitazah';
update roster set role = 'Founding artist · under 25', updated_at = now()
 where name = 'King Konnect';
update roster set role = 'Founding artist · producer · engineer · under 25', updated_at = now()
 where name = 'JayThaRealist';

-- Stated once, in one place, so the public pages can read it rather than each
-- of them phrasing it differently.
insert into settings (key, value, updated_at)
values ('founding', jsonb_build_object(
  'line', 'Founded by BREED and Yawitazah.',
  'founders', jsonb_build_array('BREED', 'Yawitazah'),
  'founding_artists', jsonb_build_array('King Konnect', 'JayThaRealist')
), now())
on conflict (key) do update set value = excluded.value, updated_at = now();
