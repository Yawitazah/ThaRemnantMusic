-- Web push: one tap to turn on, notifications when a fan joins a list.
--
-- The dashboard server polls push_claim() on a timer and sends the pushes.
-- It authenticates with a shared secret rather than a service-role key, so no
-- god-mode credential has to live in Railway's environment.

create table if not exists push_subscriptions (
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  email       text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
alter table push_subscriptions enable row level security;

-- Team members manage their own device subscriptions.
create policy push_subs_insert on push_subscriptions for insert to authenticated
  with check (is_team());
create policy push_subs_read on push_subscriptions for select to authenticated
  using (is_team());
create policy push_subs_delete on push_subscriptions for delete to authenticated
  using (is_team());

-- Which captures have already been pushed.
alter table hub_captures add column if not exists notified_at timestamptz;

-- Shared secret for the fanout worker. No policy = no direct access; only the
-- security-definer function below can read it.
create table if not exists push_config (
  id      integer primary key default 1,
  secret  text not null,
  check (id = 1)
);
alter table push_config enable row level security;

insert into push_config (id, secret)
values (1, 'VYawfzWCaOefTTgsx4PJmt_7yJpmoxsW')
on conflict (id) do nothing;

-- Hand the worker everything it needs for one round, and mark those captures
-- so they are never pushed twice.
create or replace function push_claim(p_secret text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
  claimed jsonb;
  subs jsonb;
begin
  select exists (select 1 from push_config where secret = p_secret) into ok;
  if not ok then
    raise exception 'bad secret';
  end if;

  with pending as (
    update hub_captures
       set notified_at = now()
     where notified_at is null
       and created_at > now() - interval '2 days'   -- never spam a backlog
    returning artist, name, email, created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'artist', artist, 'name', name, 'email', email, 'at', created_at)), '[]'::jsonb)
    into claimed from pending;

  select coalesce(jsonb_agg(jsonb_build_object(
    'endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
    into subs from push_subscriptions;

  return jsonb_build_object('captures', claimed, 'subs', subs);
end;
$$;
revoke all on function push_claim(text) from public;
grant execute on function push_claim(text) to anon, authenticated;

-- Dead endpoints (uninstalled apps) get cleaned up by the worker.
create or replace function push_drop(p_secret text, p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from push_config where secret = p_secret) then
    raise exception 'bad secret';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
end;
$$;
revoke all on function push_drop(text, text) from public;
grant execute on function push_drop(text, text) to anon, authenticated;

-- Anything already captured before push existed should not fire a notification.
update hub_captures set notified_at = now() where notified_at is null;
