-- Record where a catalogue work comes from separately from its private rights evidence.
alter table public.titles
  add column content_origin text not null default 'unverified'
    check (content_origin in ('unverified', 'streamboxx_original', 'independent_creator', 'public_domain', 'licensed')),
  add column creation_method text not null default 'human_created'
    check (creation_method in ('human_created', 'ai_assisted', 'ai_generated'));

create or replace function public.guard_streamboxx_title_origin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published_at is not null and new.content_origin = 'unverified' then
    raise exception 'Select a verified content origin before publication';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_streamboxx_title_origin() from public, anon;
grant execute on function public.guard_streamboxx_title_origin() to authenticated, service_role;
create trigger streamboxx_title_origin_required
  before insert or update of published_at, content_origin on public.titles
  for each row execute function public.guard_streamboxx_title_origin();

grant select (content_origin, creation_method) on public.titles to anon, authenticated;