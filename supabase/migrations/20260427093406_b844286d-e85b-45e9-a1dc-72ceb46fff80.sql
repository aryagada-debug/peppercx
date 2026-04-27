create table public.vsd_financial_targets (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  vsd text not null,
  contraction_target numeric not null default 0,
  contraction_actual numeric not null default 0,
  delivery_target numeric not null default 0,
  delivery_actual numeric not null default 0,
  invoicing_target numeric not null default 0,
  invoicing_actual numeric not null default 0,
  receivables_target numeric not null default 0,
  receivables_actual numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, vsd)
);

alter table public.vsd_financial_targets enable row level security;

create policy "Auth read vsd_financial_targets"
  on public.vsd_financial_targets for select
  to authenticated using (true);

create policy "Admins insert vsd_financial_targets"
  on public.vsd_financial_targets for insert
  to authenticated with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins update vsd_financial_targets"
  on public.vsd_financial_targets for update
  to authenticated using (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins delete vsd_financial_targets"
  on public.vsd_financial_targets for delete
  to authenticated using (has_role(auth.uid(), 'admin'::app_role));

create trigger update_vsd_financial_targets_updated_at
  before update on public.vsd_financial_targets
  for each row execute function public.update_updated_at_column();

create index idx_vsd_financial_targets_month on public.vsd_financial_targets (month);

-- Per-deal financial targets/actuals (for Home and Dashboard tables)
create table public.deal_financial_targets (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  deal_id text not null,
  contraction_target numeric not null default 0,
  contraction_actual numeric not null default 0,
  delivery_target numeric not null default 0,
  delivery_actual numeric not null default 0,
  invoicing_target numeric not null default 0,
  invoicing_actual numeric not null default 0,
  receivables_target numeric not null default 0,
  receivables_actual numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, deal_id)
);

alter table public.deal_financial_targets enable row level security;

create policy "Auth read deal_financial_targets"
  on public.deal_financial_targets for select
  to authenticated using (true);

create policy "Admins insert deal_financial_targets"
  on public.deal_financial_targets for insert
  to authenticated with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins update deal_financial_targets"
  on public.deal_financial_targets for update
  to authenticated using (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins delete deal_financial_targets"
  on public.deal_financial_targets for delete
  to authenticated using (has_role(auth.uid(), 'admin'::app_role));

create trigger update_deal_financial_targets_updated_at
  before update on public.deal_financial_targets
  for each row execute function public.update_updated_at_column();

create index idx_deal_financial_targets_month on public.deal_financial_targets (month);
create index idx_deal_financial_targets_deal on public.deal_financial_targets (deal_id);