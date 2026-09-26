-- Extend the current catalogue without replacing its existing tables or playback flow.
alter table public.titles
  add column if not exists format text not null default 'film',
  add column if not exists region text not null default 'global',
  add column if not exists country text,
  add column if not exists language text,
  add column if not exists duration_seconds integer,
  add column if not exists cast_names text[] not null default '{}',
  add column if not exists director text,
  add column if not exists age_rating text,
  add column if not exists trailer_url text,
  add column if not exists featured boolean not null default false,
  add column if not exists download_permitted boolean not null default false;

alter table public.titles drop constraint if exists titles_format_check;
alter table public.titles add constraint titles_format_check
  check (format in ('film', 'series', 'short', 'trailer'));
alter table public.titles drop constraint if exists titles_region_check;
alter table public.titles add constraint titles_region_check
  check (region in ('african', 'asian', 'global'));
alter table public.titles drop constraint if exists titles_duration_seconds_check;
alter table public.titles add constraint titles_duration_seconds_check
  check (duration_seconds is null or duration_seconds > 0);

update public.titles set format = case when kind = 'series' then 'series' else 'film' end
where format = 'film' and kind = 'series';

alter table public.catalog_rights
  add column if not exists streaming_permitted boolean not null default true,
  add column if not exists territory text[] not null default array['global']::text[],
  add column if not exists licence_start date,
  add column if not exists licence_expiry date,
  add column if not exists contract_reference text,
  add column if not exists expiry_warning_days integer not null default 30;

alter table public.catalog_rights drop constraint if exists catalog_rights_licence_dates_check;
alter table public.catalog_rights add constraint catalog_rights_licence_dates_check
  check (licence_start is null or licence_expiry is null or licence_expiry >= licence_start);
alter table public.catalog_rights drop constraint if exists catalog_rights_warning_days_check;
alter table public.catalog_rights add constraint catalog_rights_warning_days_check
  check (expiry_warning_days between 1 and 365);

-- New trials begin only after Supabase Auth confirms the viewer's phone.
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles alter column trial_started_at drop not null;
alter table public.profiles alter column trial_ends_at drop not null;
alter table public.profiles drop constraint if exists profile_trial_is_two_days;
alter table public.profiles add constraint profile_trial_is_two_days
  check ((trial_started_at is null and trial_ends_at is null)
      or (trial_started_at is not null and trial_ends_at = trial_started_at + interval '48 hours'));
create unique index if not exists profiles_phone_number_unique_idx
  on public.profiles (phone_number) where phone_number is not null;

create table if not exists public.trial_phone_claims (
  phone_e164 text primary key check (phone_e164 ~ '^\+254[17][0-9]{8}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.trial_phone_claims enable row level security;
revoke all on public.trial_phone_claims from public, anon, authenticated;
grant all on public.trial_phone_claims to service_role;

create or replace function public.handle_streamboxx_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, trial_started_at, trial_ends_at)
  values (new.id, lower(new.email), nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), ''), null, null);
  return new;
end;
$$;

create or replace function public.claim_streamboxx_phone_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_claim uuid;
  had_claim boolean;
  trial_start timestamptz;
begin
  if new.phone_confirmed_at is null or nullif(btrim(new.phone), '') is null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.phone_confirmed_at is not distinct from old.phone_confirmed_at
        and new.phone is not distinct from old.phone then return new; end if;
  end if;

  select exists(select 1 from public.trial_phone_claims c where c.user_id = new.id) into had_claim;
  if not had_claim then
    insert into public.trial_phone_claims (phone_e164, user_id)
    values (new.phone, new.id) on conflict do nothing;
    select c.user_id into existing_claim from public.trial_phone_claims c where c.phone_e164 = new.phone;
    if existing_claim is distinct from new.id then
      raise exception 'This verified phone number has already claimed a StreamBoXX trial';
    end if;
  else
    select c.user_id into existing_claim from public.trial_phone_claims c where c.phone_e164 = new.phone;
    if existing_claim is not null and existing_claim is distinct from new.id then
      raise exception 'This verified phone number has already claimed a StreamBoXX trial';
    end if;
  end if;

  select trial_started_at into trial_start from public.profiles where id = new.id;
  if not had_claim and trial_start is null then trial_start := now(); end if;
  update public.profiles
    set phone_number = new.phone,
        trial_started_at = coalesce(trial_started_at, trial_start),
        trial_ends_at = coalesce(trial_ends_at, case when trial_start is not null then trial_start + interval '48 hours' else null end)
    where id = new.id;
  return new;
end;
$$;

revoke all on function public.claim_streamboxx_phone_trial() from public, anon, authenticated;
grant execute on function public.claim_streamboxx_phone_trial() to service_role;
drop trigger if exists streamboxx_auth_phone_trial on auth.users;
create trigger streamboxx_auth_phone_trial
  after insert or update of phone, phone_confirmed_at on auth.users
  for each row execute function public.claim_streamboxx_phone_trial();

-- Preserve existing users' current trial dates while recording already verified phones.
insert into public.trial_phone_claims (phone_e164, user_id)
select u.phone, u.id from auth.users u
where u.phone_confirmed_at is not null and u.phone ~ '^\+254[17][0-9]{8}$'
on conflict do nothing;
update public.profiles p set phone_number = u.phone
from auth.users u where u.id = p.id and u.phone_confirmed_at is not null
  and u.phone ~ '^\+254[17][0-9]{8}$' and p.phone_number is null;

create table if not exists public.catalogue_seasons (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  title text,
  created_at timestamptz not null default now(),
  unique (title_id, season_number)
);

create table if not exists public.catalogue_episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.catalogue_seasons(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null check (char_length(title) between 1 and 180),
  synopsis text not null default '' check (char_length(synopsis) <= 3000),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  artwork_path text check (artwork_path is null or artwork_path like 'https://%'),
  created_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

alter table public.catalogue_seasons enable row level security;
alter table public.catalogue_episodes enable row level security;
revoke all on public.catalogue_seasons, public.catalogue_episodes from anon, authenticated;
grant select, insert, update, delete on public.catalogue_seasons, public.catalogue_episodes to authenticated;
grant all on public.catalogue_seasons, public.catalogue_episodes to service_role;

create policy "owner manages catalogue seasons" on public.catalogue_seasons
  for all to authenticated using (public.is_streamboxx_owner()) with check (public.is_streamboxx_owner());
create policy "owner manages catalogue episodes" on public.catalogue_episodes
  for all to authenticated using (public.is_streamboxx_owner()) with check (public.is_streamboxx_owner());

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
        and r.streaming_permitted
        and (r.licence_start is null or r.licence_start <= current_date)
        and (r.licence_expiry is null or r.licence_expiry >= current_date)
        and nullif(btrim(r.rights_reference), '') is not null
        and (new.artwork_path is null or nullif(btrim(r.artwork_rights_reference), '') is not null)
    ) then
      raise exception 'A title needs current streaming rights and a private rights record before publication';
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

create or replace function public.unpublish_streamboxx_title_without_rights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare affected_title_id uuid;
begin
  if tg_op = 'DELETE' then affected_title_id := old.title_id;
  else affected_title_id := new.title_id;
  end if;
  update public.titles t set published_at = null, updated_at = now()
  where t.id = affected_title_id and t.published_at is not null
    and not exists (
      select 1 from public.catalog_rights r
      where r.title_id = t.id and r.rights_cleared_at is not null and r.streaming_permitted
        and (r.licence_start is null or r.licence_start <= current_date)
        and (r.licence_expiry is null or r.licence_expiry >= current_date)
        and nullif(btrim(r.rights_reference), '') is not null
        and (t.artwork_path is null or nullif(btrim(r.artwork_rights_reference), '') is not null)
    );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.unpublish_streamboxx_expired_rights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.titles set published_at = null, updated_at = now()
  where id = new.title_id and published_at is not null
    and (not new.streaming_permitted or new.rights_cleared_at is null
      or (new.licence_start is not null and new.licence_start > current_date)
      or (new.licence_expiry is not null and new.licence_expiry < current_date));
  return new;
end;
$$;

drop trigger if exists streamboxx_rights_expiry_unpublishes on public.catalog_rights;
create trigger streamboxx_rights_expiry_unpublishes
  after insert or update on public.catalog_rights
  for each row execute function public.unpublish_streamboxx_expired_rights();

-- Expired rights are also excluded at query time by the publication view below.
create or replace view public.streamboxx_public_titles as
select t.* from public.titles t
where t.published_at is not null and t.published_at <= now()
  and exists (
    select 1 from public.catalog_rights r where r.title_id = t.id
      and r.rights_cleared_at is not null and r.streaming_permitted
      and (r.licence_start is null or r.licence_start <= current_date)
      and (r.licence_expiry is null or r.licence_expiry >= current_date)
  );

revoke all on public.streamboxx_public_titles from anon, authenticated;
grant select on public.streamboxx_public_titles to anon, authenticated;
