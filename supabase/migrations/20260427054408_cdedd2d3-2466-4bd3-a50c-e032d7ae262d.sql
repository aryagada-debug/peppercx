do $$
begin
  begin
    alter publication supabase_realtime add table public.deal_tasks;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.cx_tasks;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.personal_todos;
  exception when duplicate_object then null; end;
end $$;

alter table public.deal_tasks replica identity full;
alter table public.cx_tasks replica identity full;
alter table public.personal_todos replica identity full;