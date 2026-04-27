create table public.personal_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default '',
  notes text not null default '',
  done boolean not null default false,
  due_date date,
  priority text not null default 'Medium',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_todos enable row level security;

create policy "Own todos select" on public.personal_todos
  for select to authenticated using (auth.uid() = user_id);
create policy "Own todos insert" on public.personal_todos
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own todos update" on public.personal_todos
  for update to authenticated using (auth.uid() = user_id);
create policy "Own todos delete" on public.personal_todos
  for delete to authenticated using (auth.uid() = user_id);

create trigger personal_todos_updated_at
  before update on public.personal_todos
  for each row execute function public.update_updated_at_column();

insert into public.route_visibility (role, route_key, visible)
select r, 'home', true
from unnest(array['admin','member','user','view_only']::app_role[]) r
on conflict do nothing;