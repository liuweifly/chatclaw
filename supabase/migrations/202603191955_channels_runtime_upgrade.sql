alter table public.channels
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists connected_at timestamptz,
  add column if not exists last_error text;

create unique index if not exists channels_lobster_type_key
  on public.channels (lobster_id, type);

drop policy if exists channels_update on public.channels;
create policy channels_update
  on public.channels
  for update
  using (
    lobster_id in (
      select lobsters.id
      from public.lobsters
      where lobsters.user_id = auth.uid()
    )
  )
  with check (
    lobster_id in (
      select lobsters.id
      from public.lobsters
      where lobsters.user_id = auth.uid()
    )
  );

drop policy if exists channels_delete on public.channels;
create policy channels_delete
  on public.channels
  for delete
  using (
    lobster_id in (
      select lobsters.id
      from public.lobsters
      where lobsters.user_id = auth.uid()
    )
  );
