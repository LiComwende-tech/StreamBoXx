-- StreamBoXx account, catalogue, trial, and paid-access foundation.
-- Apply through Supabase migrations after creating a project. Do not expose the
-- Supabase secret/service-role key in the browser or a packaged desktop app.

create table public.owner_control (
  singleton boolean primary key default true check (singleton),
  owner_user_id uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

insert into public.owner_control (singleton, owner_user_id) values (true, null);

create or replace function public.is_streamboxx_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_control
    where singleton = true and owner_user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_streamboxx_owner() from public, anon;
grant execute on function public.is_streamboxx_owner() to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  suspended_at timestamptz,
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint profile_trial_is_two_days check (trial_ends_at = trial_started_at + interval '48 hours'),
  constraint suspension_timestamp_matches_status check (
    (account_status = 'active' and suspended_at is null)
    or (account_status = 'suspended' and suspended_at is not null)
  )
);

create unique index profiles_email_lower_unique_idx
  on public.profiles (lower(email)) where email is not null;

create or replace function public.handle_streamboxx_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  started_at timestamptz := now();
begin
  insert into public.profiles (id, email, display_name, trial_started_at, trial_ends_at)
  values (
    new.id,
    lower(new.email),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''),
    started_at,
    started_at + interval '48 hours'
  );
  return new;
end;
$$;

create trigger streamboxx_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_streamboxx_new_user();

create or replace function public.handle_streamboxx_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger streamboxx_auth_email_changed
  after update of email on auth.users
  for each row execute function public.handle_streamboxx_email_change();

create or replace function public.guard_streamboxx_profile_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.account_status is distinct from old.account_status
      or new.suspended_at is distinct from old.suspended_at)
     and auth.role() <> 'service_role'
     and not public.is_streamboxx_owner() then
    raise exception 'Only the StreamBoXx owner may change account status';
  end if;
  return new;
end;
$$;

create trigger streamboxx_profile_admin_fields_guard
  before update on public.profiles
  for each row execute function public.guard_streamboxx_profile_admin_fields();

revoke all on function public.guard_streamboxx_profile_admin_fields() from public, anon;
grant execute on function public.guard_streamboxx_profile_admin_fields() to authenticated, service_role;

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 180),
  synopsis text not null default '' check (char_length(synopsis) <= 3000),
  kind text not null check (kind in ('film', 'series')),
  release_year integer check (release_year between 1888 and 2200),
  genre text not null default 'Drama',
  artwork_path text check (artwork_path is null or artwork_path like 'https://%'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private legal evidence is kept outside the public title rows. PostgreSQL
-- column grants alone cannot hide rights evidence once a public row is visible.
create table public.catalog_rights (
  title_id uuid primary key references public.titles(id) on delete cascade,
  rights_basis text not null check (rights_basis in ('owned', 'public_domain', 'licensed')),
  rights_reference text not null check (char_length(btrim(rights_reference)) between 1 and 500),
  artwork_rights_reference text check (artwork_rights_reference is null or char_length(btrim(artwork_rights_reference)) between 1 and 500),
  rights_cleared_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete restrict,
  provider text not null check (char_length(provider) between 2 and 60),
  provider_asset_id text not null check (char_length(provider_asset_id) between 1 and 500),
  status text not null default 'processing' check (status in ('processing', 'ready', 'unavailable')),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_asset_id),
  constraint ready_asset_has_timestamp check (status <> 'ready' or ready_at is not null)
);

create index media_assets_ready_title_idx on public.media_assets (title_id, ready_at desc)
  where status = 'ready';

create or replace function public.guard_streamboxx_title_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published_at is not null then
    if not exists (
      select 1 from public.catalog_rights r
      where r.title_id = new.id
        and r.rights_cleared_at is not null
        and nullif(btrim(r.rights_reference), '') is not null
        and (new.artwork_path is null or nullif(btrim(r.artwork_rights_reference), '') is not null)
    ) then
      raise exception 'A title needs verified rights and a private rights record before publication';
    end if;

    if not exists (
      select 1 from public.media_assets m
      where m.title_id = new.id and m.status = 'ready' and m.ready_at <= now()
    ) then
      raise exception 'A title needs a ready streaming asset before publication';
    end if;
  end if;
  return new;
end;
$$;

create trigger streamboxx_title_publication_guard
  before insert or update on public.titles
  for each row execute function public.guard_streamboxx_title_publication();

revoke all on function public.guard_streamboxx_title_publication() from public, anon;
grant execute on function public.guard_streamboxx_title_publication() to authenticated, service_role;

create or replace function public.unpublish_streamboxx_title_without_rights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_title_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_title_id := old.title_id;
  else
    affected_title_id := new.title_id;
  end if;
  update public.titles t set published_at = null, updated_at = now()
  where t.id = affected_title_id and t.published_at is not null
    and not exists (
      select 1 from public.catalog_rights r
      where r.title_id = t.id
        and r.rights_cleared_at is not null
        and nullif(btrim(r.rights_reference), '') is not null
        and (t.artwork_path is null or nullif(btrim(r.artwork_rights_reference), '') is not null)
    );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger streamboxx_rights_revoke_unpublishes
  after update or delete on public.catalog_rights
  for each row execute function public.unpublish_streamboxx_title_without_rights();

create or replace function public.unpublish_streamboxx_title_without_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_title_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_title_id := old.title_id;
    update public.titles set published_at = null, updated_at = now()
    where id = affected_title_id and published_at is not null
      and not exists (select 1 from public.media_assets m
        where m.title_id = affected_title_id and m.status = 'ready' and m.ready_at <= now());
    return old;
  end if;

  if old.title_id is distinct from new.title_id then
    affected_title_id := old.title_id;
    update public.titles set published_at = null, updated_at = now()
    where id = affected_title_id and published_at is not null
      and not exists (select 1 from public.media_assets m
        where m.title_id = affected_title_id and m.status = 'ready' and m.ready_at <= now());
  end if;

  if new.status <> 'ready' then
    affected_title_id := new.title_id;
    update public.titles set published_at = null, updated_at = now()
    where id = affected_title_id and published_at is not null
      and not exists (select 1 from public.media_assets m
        where m.title_id = affected_title_id and m.id <> new.id
          and m.status = 'ready' and m.ready_at <= now());
  end if;
  return new;
end;
$$;

create trigger streamboxx_media_unavailable_unpublishes
  after update of status, title_id or delete on public.media_assets
  for each row execute function public.unpublish_streamboxx_title_without_media();

create table public.viewer_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id),
  constraint watch_position_within_duration check (
    duration_seconds is null or position_seconds <= duration_seconds
  )
);

create table public.daily_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_kes integer not null check (amount_kes = 50),
  status text not null check (status in ('pending', 'paid', 'failed', 'reversed')),
  starts_at timestamptz,
  ends_at timestamptz,
  provider text not null check (provider in ('mpesa')),
  provider_checkout_id text unique,
  provider_receipt text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint paid_pass_has_receipt_and_period check (
    status <> 'paid' or (nullif(btrim(provider_receipt), '') is not null
      and starts_at is not null and ends_at is not null
      and ends_at > starts_at and paid_at is not null)
  )
);

create index daily_passes_active_user_idx
  on public.daily_passes (user_id, ends_at desc)
  where status = 'paid';

-- Only the verified server callback calls this function. A pass is granted
-- atomically and at most once for a provider checkout ID.
create or replace function public.complete_streamboxx_mpesa_pass(
  p_checkout_request_id text,
  p_receipt text,
  p_amount integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pass_row public.daily_passes%rowtype;
  pass_start timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the verified payment service may complete a pass';
  end if;
  if nullif(btrim(p_checkout_request_id), '') is null
     or nullif(btrim(p_receipt), '') is null
     or p_amount is distinct from 50 then
    return 'invalid_payment';
  end if;

  select * into pass_row from public.daily_passes
  where provider_checkout_id = p_checkout_request_id
  for update;
  if not found then return 'unknown_checkout'; end if;
  if pass_row.amount_kes <> p_amount then return 'amount_mismatch'; end if;
  if pass_row.status = 'paid' then
    if pass_row.provider_receipt = p_receipt then return 'already_completed'; end if;
    return 'receipt_conflict';
  end if;
  if pass_row.status <> 'pending' then return 'pass_not_pending'; end if;

  insert into public.payment_events (provider, event_key, event_type, daily_pass_id, processed_at, outcome)
  values ('mpesa', 'checkout:' || p_checkout_request_id, 'stk_payment_confirmed', pass_row.id, now(), 'processed')
  on conflict (event_key) do nothing;
  if not found then return 'duplicate_event'; end if;

  select greatest(now(), coalesce(p.trial_ends_at, now()), coalesce(max(d.ends_at), now()))
  into pass_start
  from public.profiles p
  left join public.daily_passes d on d.user_id = p.id and d.status = 'paid'
  where p.id = pass_row.user_id and p.account_status = 'active'
  group by p.trial_ends_at;
  if pass_start is null then
    update public.payment_events set outcome = 'ignored' where event_key = 'checkout:' || p_checkout_request_id;
    return 'account_unavailable';
  end if;

  update public.daily_passes
  set status = 'paid', provider_receipt = p_receipt,
      starts_at = pass_start, ends_at = pass_start + interval '24 hours', paid_at = now()
  where id = pass_row.id;
  return 'completed';
end;
$$;

revoke all on function public.complete_streamboxx_mpesa_pass(text, text, integer) from public, anon, authenticated;
grant execute on function public.complete_streamboxx_mpesa_pass(text, text, integer) to service_role;

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('mpesa')),
  event_key text not null unique,
  event_type text not null,
  daily_pass_id uuid references public.daily_passes(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null check (outcome in ('received', 'processed', 'ignored', 'error'))
);

-- Access is always calculated from server-owned timestamps and payment status.
create or replace function public.has_streamboxx_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when (select public.is_streamboxx_owner()) then true
    else exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_status = 'active' and p.trial_ends_at > now()
    ) or exists (
      select 1 from public.daily_passes d
      where d.user_id = (select auth.uid())
        and d.status = 'paid'
        and d.starts_at <= now()
        and d.ends_at > now()
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.account_status = 'active'
        )
    )
  end;
$$;

revoke all on function public.has_streamboxx_access() from public, anon;
grant execute on function public.has_streamboxx_access() to authenticated;

alter table public.owner_control enable row level security;
alter table public.profiles enable row level security;
alter table public.titles enable row level security;
alter table public.catalog_rights enable row level security;
alter table public.media_assets enable row level security;
alter table public.viewer_watchlist enable row level security;
alter table public.watch_progress enable row level security;
alter table public.daily_passes enable row level security;
alter table public.payment_events enable row level security;

-- Explicit privileges accompany RLS; a policy alone does not remove table grants.
revoke all on public.owner_control, public.profiles, public.titles,
  public.catalog_rights, public.media_assets, public.viewer_watchlist,
  public.watch_progress, public.daily_passes, public.payment_events from anon, authenticated;

grant select on public.profiles, public.viewer_watchlist,
  public.watch_progress, public.daily_passes to authenticated;
grant update (display_name, account_status, suspended_at) on public.profiles to authenticated;
grant insert, update, delete on public.titles to authenticated;
grant insert, delete on public.viewer_watchlist to authenticated;
grant insert, update, delete on public.watch_progress to authenticated;
grant select (id,slug,title,synopsis,kind,release_year,genre,artwork_path,published_at,created_at,updated_at) on public.titles to anon, authenticated;
grant all on public.owner_control, public.profiles, public.titles,
  public.catalog_rights, public.media_assets, public.viewer_watchlist,
  public.watch_progress, public.daily_passes, public.payment_events to service_role;
grant select on public.catalog_rights, public.media_assets to authenticated;
grant insert, update, delete on public.catalog_rights to authenticated;
grant usage, select on sequence public.payment_events_id_seq to service_role;

create policy "viewer reads own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "owner reads viewer profiles" on public.profiles
  for select to authenticated using ((select public.is_streamboxx_owner()));
create policy "viewer edits own display name" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "owner controls viewer account status" on public.profiles
  for update to authenticated
  using ((select public.is_streamboxx_owner()))
  with check ((select public.is_streamboxx_owner()));

create policy "public reads cleared published titles" on public.titles
  for select to anon, authenticated
  using (published_at is not null and published_at <= now());
create policy "owner manages catalogue" on public.titles
  for all to authenticated
  using ((select public.is_streamboxx_owner()))
  with check ((select public.is_streamboxx_owner()));

create policy "owner manages private catalogue rights" on public.catalog_rights
  for all to authenticated
  using ((select public.is_streamboxx_owner()))
  with check ((select public.is_streamboxx_owner()));
create policy "owner inspects media asset readiness" on public.media_assets
  for select to authenticated
  using ((select public.is_streamboxx_owner()));

create policy "viewer reads own watchlist" on public.viewer_watchlist
  for select to authenticated using (user_id = (select auth.uid()));
create policy "viewer adds own watchlist items" on public.viewer_watchlist
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "viewer removes own watchlist items" on public.viewer_watchlist
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "viewer manages own playback progress" on public.watch_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "viewer reads own daily passes" on public.daily_passes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner reads daily passes" on public.daily_passes
  for select to authenticated using ((select public.is_streamboxx_owner()));

create policy "owner reads payment events" on public.payment_events
  for select to authenticated using ((select public.is_streamboxx_owner()));

-- Stream files belong in a private bucket. The client receives short-lived
-- signed URLs only after a server endpoint verifies auth and has_streamboxx_access().
insert into storage.buckets (id, name, public)
values ('streamboxx-media', 'streamboxx-media', false)
on conflict (id) do update set public = false;

create policy "owner manages StreamBoXx media objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'streamboxx-media' and (select public.is_streamboxx_owner()))
  with check (bucket_id = 'streamboxx-media' and (select public.is_streamboxx_owner()));

grant select, insert, update, delete on storage.objects to authenticated;
