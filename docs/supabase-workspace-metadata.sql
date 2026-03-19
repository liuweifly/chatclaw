alter table public.lobsters
  add column if not exists description text;

create table if not exists public.lobster_agents (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.lobsters(id) on delete cascade,
  name text not null,
  avatar_url text,
  description text not null default '',
  specialty text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lobster_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.lobsters(id) on delete cascade,
  name text not null,
  description text,
  agent_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lobster_agents_user_company_idx
  on public.lobster_agents (user_id, company_id, created_at);

create index if not exists lobster_teams_user_company_idx
  on public.lobster_teams (user_id, company_id, created_at);

alter table public.lobsters enable row level security;
alter table public.lobster_agents enable row level security;
alter table public.lobster_teams enable row level security;

drop policy if exists "Users manage own lobsters" on public.lobsters;
create policy "Users manage own lobsters"
  on public.lobsters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own lobster agents" on public.lobster_agents;
create policy "Users manage own lobster agents"
  on public.lobster_agents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own lobster teams" on public.lobster_teams;
create policy "Users manage own lobster teams"
  on public.lobster_teams
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
