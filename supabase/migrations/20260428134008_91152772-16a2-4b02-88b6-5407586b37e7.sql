
create table public.staffing_review_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null,
  requested_by uuid not null,
  requested_by_name text not null default '',
  note text not null default '',
  status text not null default 'open',
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_staffing_review_requests_deal on public.staffing_review_requests(deal_id);
create index idx_staffing_review_requests_status on public.staffing_review_requests(status);
alter table public.staffing_review_requests enable row level security;

create policy "Auth read staffing review requests" on public.staffing_review_requests
  for select to authenticated using (true);
create policy "Auth insert own staffing review requests" on public.staffing_review_requests
  for insert to authenticated with check (auth.uid() = requested_by);
create policy "Admins update staffing review requests" on public.staffing_review_requests
  for update to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins delete staffing review requests" on public.staffing_review_requests
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));

create table public.deal_rgy_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null,
  week_start date,
  dimension text not null,
  from_value text not null default '',
  to_value text not null default '',
  note text not null default '',
  updated_by uuid not null,
  updated_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index idx_deal_rgy_notes_deal on public.deal_rgy_notes(deal_id, created_at desc);
alter table public.deal_rgy_notes enable row level security;

create policy "Auth read deal rgy notes" on public.deal_rgy_notes
  for select to authenticated using (true);
create policy "Auth insert own deal rgy notes" on public.deal_rgy_notes
  for insert to authenticated with check (auth.uid() = updated_by);
