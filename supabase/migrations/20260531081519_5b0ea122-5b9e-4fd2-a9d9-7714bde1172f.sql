
-- =====================================================================
-- Security: tighten public-readable/writable tables to authenticated only.
-- Removes USING(true)/WITH CHECK(true) policies granted to the public
-- (anonymous) role on internal business tables.
-- =====================================================================

-- Helper macro pattern: drop existing public-role policies, then re-create
-- them scoped to the authenticated role. App users are all signed in.

-- ---------- clients ----------
DROP POLICY IF EXISTS "Anyone can read clients"   ON public.clients;
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can delete clients" ON public.clients;
CREATE POLICY "Authenticated read clients"   ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update clients" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete clients" ON public.clients FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.clients FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;

-- ---------- cx_spaces ----------
DROP POLICY IF EXISTS "Anyone can read cx_spaces"   ON public.cx_spaces;
DROP POLICY IF EXISTS "Anyone can insert cx_spaces" ON public.cx_spaces;
DROP POLICY IF EXISTS "Anyone can update cx_spaces" ON public.cx_spaces;
DROP POLICY IF EXISTS "Anyone can delete cx_spaces" ON public.cx_spaces;
CREATE POLICY "Authenticated read cx_spaces"   ON public.cx_spaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cx_spaces" ON public.cx_spaces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cx_spaces" ON public.cx_spaces FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete cx_spaces" ON public.cx_spaces FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.cx_spaces FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.cx_spaces TO authenticated;

-- ---------- cx_space_members ----------
DROP POLICY IF EXISTS "Anyone can read cx_space_members"   ON public.cx_space_members;
DROP POLICY IF EXISTS "Anyone can insert cx_space_members" ON public.cx_space_members;
DROP POLICY IF EXISTS "Anyone can update cx_space_members" ON public.cx_space_members;
DROP POLICY IF EXISTS "Anyone can delete cx_space_members" ON public.cx_space_members;
CREATE POLICY "Authenticated read cx_space_members"   ON public.cx_space_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cx_space_members" ON public.cx_space_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cx_space_members" ON public.cx_space_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete cx_space_members" ON public.cx_space_members FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.cx_space_members FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.cx_space_members TO authenticated;

-- ---------- cx_statuses ----------
DROP POLICY IF EXISTS "Anyone can read cx_statuses"   ON public.cx_statuses;
DROP POLICY IF EXISTS "Anyone can insert cx_statuses" ON public.cx_statuses;
DROP POLICY IF EXISTS "Anyone can update cx_statuses" ON public.cx_statuses;
DROP POLICY IF EXISTS "Anyone can delete cx_statuses" ON public.cx_statuses;
CREATE POLICY "Authenticated read cx_statuses"   ON public.cx_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cx_statuses" ON public.cx_statuses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cx_statuses" ON public.cx_statuses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete cx_statuses" ON public.cx_statuses FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.cx_statuses FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.cx_statuses TO authenticated;

-- ---------- cx_tasks ----------
DROP POLICY IF EXISTS "Anyone can read cx_tasks"   ON public.cx_tasks;
DROP POLICY IF EXISTS "Anyone can insert cx_tasks" ON public.cx_tasks;
DROP POLICY IF EXISTS "Anyone can update cx_tasks" ON public.cx_tasks;
DROP POLICY IF EXISTS "Anyone can delete cx_tasks" ON public.cx_tasks;
CREATE POLICY "Authenticated read cx_tasks"   ON public.cx_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cx_tasks" ON public.cx_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cx_tasks" ON public.cx_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete cx_tasks" ON public.cx_tasks FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.cx_tasks FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.cx_tasks TO authenticated;

-- ---------- deal_financials ----------
DROP POLICY IF EXISTS "Anyone can read deal_financials"   ON public.deal_financials;
DROP POLICY IF EXISTS "Anyone can insert deal_financials" ON public.deal_financials;
DROP POLICY IF EXISTS "Anyone can update deal_financials" ON public.deal_financials;
DROP POLICY IF EXISTS "Anyone can delete deal_financials" ON public.deal_financials;
CREATE POLICY "Authenticated read deal_financials"   ON public.deal_financials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_financials" ON public.deal_financials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_financials" ON public.deal_financials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_financials" ON public.deal_financials FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_financials FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_financials TO authenticated;

-- ---------- deal_onboarding_steps ----------
DROP POLICY IF EXISTS "Anyone can read deal_onboarding_steps"   ON public.deal_onboarding_steps;
DROP POLICY IF EXISTS "Anyone can insert deal_onboarding_steps" ON public.deal_onboarding_steps;
DROP POLICY IF EXISTS "Anyone can update deal_onboarding_steps" ON public.deal_onboarding_steps;
DROP POLICY IF EXISTS "Anyone can delete deal_onboarding_steps" ON public.deal_onboarding_steps;
CREATE POLICY "Authenticated read deal_onboarding_steps"   ON public.deal_onboarding_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_onboarding_steps" ON public.deal_onboarding_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_onboarding_steps" ON public.deal_onboarding_steps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_onboarding_steps" ON public.deal_onboarding_steps FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_onboarding_steps FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_onboarding_steps TO authenticated;

-- ---------- deal_revenue_monthly ----------
DROP POLICY IF EXISTS "Anyone can read deal_revenue_monthly"   ON public.deal_revenue_monthly;
DROP POLICY IF EXISTS "Anyone can insert deal_revenue_monthly" ON public.deal_revenue_monthly;
DROP POLICY IF EXISTS "Anyone can update deal_revenue_monthly" ON public.deal_revenue_monthly;
DROP POLICY IF EXISTS "Anyone can delete deal_revenue_monthly" ON public.deal_revenue_monthly;
CREATE POLICY "Authenticated read deal_revenue_monthly"   ON public.deal_revenue_monthly FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_revenue_monthly" ON public.deal_revenue_monthly FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_revenue_monthly" ON public.deal_revenue_monthly FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_revenue_monthly" ON public.deal_revenue_monthly FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_revenue_monthly FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_revenue_monthly TO authenticated;

-- ---------- deal_rgy_weekly ----------
DROP POLICY IF EXISTS "Anyone can read deal_rgy_weekly"   ON public.deal_rgy_weekly;
DROP POLICY IF EXISTS "Anyone can insert deal_rgy_weekly" ON public.deal_rgy_weekly;
DROP POLICY IF EXISTS "Anyone can update deal_rgy_weekly" ON public.deal_rgy_weekly;
DROP POLICY IF EXISTS "Anyone can delete deal_rgy_weekly" ON public.deal_rgy_weekly;
CREATE POLICY "Authenticated read deal_rgy_weekly"   ON public.deal_rgy_weekly FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_rgy_weekly" ON public.deal_rgy_weekly FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_rgy_weekly" ON public.deal_rgy_weekly FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_rgy_weekly" ON public.deal_rgy_weekly FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_rgy_weekly FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_rgy_weekly TO authenticated;

-- ---------- deal_sow_items ----------
DROP POLICY IF EXISTS "Anyone can read deal_sow_items"   ON public.deal_sow_items;
DROP POLICY IF EXISTS "Anyone can insert deal_sow_items" ON public.deal_sow_items;
DROP POLICY IF EXISTS "Anyone can update deal_sow_items" ON public.deal_sow_items;
DROP POLICY IF EXISTS "Anyone can delete deal_sow_items" ON public.deal_sow_items;
CREATE POLICY "Authenticated read deal_sow_items"   ON public.deal_sow_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_sow_items" ON public.deal_sow_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_sow_items" ON public.deal_sow_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_sow_items" ON public.deal_sow_items FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_sow_items FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_sow_items TO authenticated;

-- ---------- deal_stakeholders ----------
DROP POLICY IF EXISTS "Anyone can read deal_stakeholders"   ON public.deal_stakeholders;
DROP POLICY IF EXISTS "Anyone can insert deal_stakeholders" ON public.deal_stakeholders;
DROP POLICY IF EXISTS "Anyone can update deal_stakeholders" ON public.deal_stakeholders;
DROP POLICY IF EXISTS "Anyone can delete deal_stakeholders" ON public.deal_stakeholders;
CREATE POLICY "Authenticated read deal_stakeholders"   ON public.deal_stakeholders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_stakeholders" ON public.deal_stakeholders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_stakeholders" ON public.deal_stakeholders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_stakeholders" ON public.deal_stakeholders FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_stakeholders FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_stakeholders TO authenticated;

-- ---------- deal_targets_monthly ----------
DROP POLICY IF EXISTS "Anyone can read deal_targets_monthly"   ON public.deal_targets_monthly;
DROP POLICY IF EXISTS "Anyone can insert deal_targets_monthly" ON public.deal_targets_monthly;
DROP POLICY IF EXISTS "Anyone can update deal_targets_monthly" ON public.deal_targets_monthly;
DROP POLICY IF EXISTS "Anyone can delete deal_targets_monthly" ON public.deal_targets_monthly;
CREATE POLICY "Authenticated read deal_targets_monthly"   ON public.deal_targets_monthly FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_targets_monthly" ON public.deal_targets_monthly FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_targets_monthly" ON public.deal_targets_monthly FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_targets_monthly" ON public.deal_targets_monthly FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_targets_monthly FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_targets_monthly TO authenticated;

-- ---------- deal_tasks ----------
DROP POLICY IF EXISTS "Anyone can read deal_tasks"   ON public.deal_tasks;
DROP POLICY IF EXISTS "Anyone can insert deal_tasks" ON public.deal_tasks;
DROP POLICY IF EXISTS "Anyone can update deal_tasks" ON public.deal_tasks;
DROP POLICY IF EXISTS "Anyone can delete deal_tasks" ON public.deal_tasks;
CREATE POLICY "Authenticated read deal_tasks"   ON public.deal_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_tasks" ON public.deal_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_tasks" ON public.deal_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete deal_tasks" ON public.deal_tasks FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.deal_tasks FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.deal_tasks TO authenticated;

-- ---------- mbr_entries ----------
DROP POLICY IF EXISTS "Anyone can read mbr_entries"   ON public.mbr_entries;
DROP POLICY IF EXISTS "Anyone can insert mbr_entries" ON public.mbr_entries;
DROP POLICY IF EXISTS "Anyone can update mbr_entries" ON public.mbr_entries;
DROP POLICY IF EXISTS "Anyone can delete mbr_entries" ON public.mbr_entries;
CREATE POLICY "Authenticated read mbr_entries"   ON public.mbr_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert mbr_entries" ON public.mbr_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update mbr_entries" ON public.mbr_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete mbr_entries" ON public.mbr_entries FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.mbr_entries FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.mbr_entries TO authenticated;

-- ---------- staffing_assignments ----------
DROP POLICY IF EXISTS "Anyone can read staffing_assignments"   ON public.staffing_assignments;
DROP POLICY IF EXISTS "Anyone can insert staffing_assignments" ON public.staffing_assignments;
DROP POLICY IF EXISTS "Anyone can update staffing_assignments" ON public.staffing_assignments;
DROP POLICY IF EXISTS "Anyone can delete staffing_assignments" ON public.staffing_assignments;
CREATE POLICY "Authenticated read staffing_assignments"   ON public.staffing_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staffing_assignments" ON public.staffing_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staffing_assignments" ON public.staffing_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete staffing_assignments" ON public.staffing_assignments FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.staffing_assignments FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.staffing_assignments TO authenticated;

-- ---------- staffing_bw_rules ----------
DROP POLICY IF EXISTS "Anyone can read staffing_bw_rules"   ON public.staffing_bw_rules;
DROP POLICY IF EXISTS "Anyone can insert staffing_bw_rules" ON public.staffing_bw_rules;
DROP POLICY IF EXISTS "Anyone can update staffing_bw_rules" ON public.staffing_bw_rules;
DROP POLICY IF EXISTS "Anyone can delete staffing_bw_rules" ON public.staffing_bw_rules;
CREATE POLICY "Authenticated read staffing_bw_rules"   ON public.staffing_bw_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staffing_bw_rules" ON public.staffing_bw_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staffing_bw_rules" ON public.staffing_bw_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete staffing_bw_rules" ON public.staffing_bw_rules FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.staffing_bw_rules FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.staffing_bw_rules TO authenticated;

-- ---------- staffing_deals ----------
DROP POLICY IF EXISTS "Anyone can read staffing_deals"   ON public.staffing_deals;
DROP POLICY IF EXISTS "Anyone can insert staffing_deals" ON public.staffing_deals;
DROP POLICY IF EXISTS "Anyone can update staffing_deals" ON public.staffing_deals;
DROP POLICY IF EXISTS "Anyone can delete staffing_deals" ON public.staffing_deals;
CREATE POLICY "Authenticated read staffing_deals"   ON public.staffing_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staffing_deals" ON public.staffing_deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staffing_deals" ON public.staffing_deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete staffing_deals" ON public.staffing_deals FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.staffing_deals FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.staffing_deals TO authenticated;

-- ---------- staffing_hiring_needs ----------
DROP POLICY IF EXISTS "Anyone can read staffing_hiring_needs"   ON public.staffing_hiring_needs;
DROP POLICY IF EXISTS "Anyone can insert staffing_hiring_needs" ON public.staffing_hiring_needs;
DROP POLICY IF EXISTS "Anyone can update staffing_hiring_needs" ON public.staffing_hiring_needs;
DROP POLICY IF EXISTS "Anyone can delete staffing_hiring_needs" ON public.staffing_hiring_needs;
CREATE POLICY "Authenticated read staffing_hiring_needs"   ON public.staffing_hiring_needs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staffing_hiring_needs" ON public.staffing_hiring_needs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staffing_hiring_needs" ON public.staffing_hiring_needs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete staffing_hiring_needs" ON public.staffing_hiring_needs FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.staffing_hiring_needs FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.staffing_hiring_needs TO authenticated;

-- ---------- staffing_people ----------
DROP POLICY IF EXISTS "Anyone can read staffing_people"   ON public.staffing_people;
DROP POLICY IF EXISTS "Anyone can insert staffing_people" ON public.staffing_people;
DROP POLICY IF EXISTS "Anyone can update staffing_people" ON public.staffing_people;
DROP POLICY IF EXISTS "Anyone can delete staffing_people" ON public.staffing_people;
CREATE POLICY "Authenticated read staffing_people"   ON public.staffing_people FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staffing_people" ON public.staffing_people FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staffing_people" ON public.staffing_people FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete staffing_people" ON public.staffing_people FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.staffing_people FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.staffing_people TO authenticated;

-- ---------- staffing_revenue_targets ----------
DROP POLICY IF EXISTS "Anyone can read staffing_revenue_targets"   ON public.staffing_revenue_targets;
DROP POLICY IF EXISTS "Anyone can insert staffing_revenue_targets" ON public.staffing_revenue_targets;
DROP POLICY IF EXISTS "Anyone can update staffing_revenue_targets" ON public.staffing_revenue_targets;
DROP POLICY IF EXISTS "Anyone can delete staffing_revenue_targets" ON public.staffing_revenue_targets;
CREATE POLICY "Authenticated read staffing_revenue_targets"   ON public.staffing_revenue_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staffing_revenue_targets" ON public.staffing_revenue_targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staffing_revenue_targets" ON public.staffing_revenue_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete staffing_revenue_targets" ON public.staffing_revenue_targets FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.staffing_revenue_targets FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.staffing_revenue_targets TO authenticated;

-- ---------- staffing_weekly_allocations ----------
DROP POLICY IF EXISTS "Anyone can read staffing_weekly_allocations"   ON public.staffing_weekly_allocations;
DROP POLICY IF EXISTS "Anyone can insert staffing_weekly_allocations" ON public.staffing_weekly_allocations;
DROP POLICY IF EXISTS "Anyone can update staffing_weekly_allocations" ON public.staffing_weekly_allocations;
DROP POLICY IF EXISTS "Anyone can delete staffing_weekly_allocations" ON public.staffing_weekly_allocations;
CREATE POLICY "Authenticated read staffing_weekly_allocations"   ON public.staffing_weekly_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staffing_weekly_allocations" ON public.staffing_weekly_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staffing_weekly_allocations" ON public.staffing_weekly_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete staffing_weekly_allocations" ON public.staffing_weekly_allocations FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.staffing_weekly_allocations FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.staffing_weekly_allocations TO authenticated;

-- ---------- task_templates ----------
DROP POLICY IF EXISTS "Anyone can read task_templates"   ON public.task_templates;
DROP POLICY IF EXISTS "Anyone can insert task_templates" ON public.task_templates;
DROP POLICY IF EXISTS "Anyone can update task_templates" ON public.task_templates;
DROP POLICY IF EXISTS "Anyone can delete task_templates" ON public.task_templates;
CREATE POLICY "Authenticated read task_templates"   ON public.task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert task_templates" ON public.task_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update task_templates" ON public.task_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete task_templates" ON public.task_templates FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.task_templates FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;

-- ---------- slack_messages: scope UPDATE to author ----------
DROP POLICY IF EXISTS "Anyone authenticated can update slack_messages" ON public.slack_messages;
CREATE POLICY "Authors update own slack_messages"
  ON public.slack_messages FOR UPDATE TO authenticated
  USING (sent_by_app_user = auth.uid())
  WITH CHECK (sent_by_app_user = auth.uid());
