ALTER TABLE deal_rgy_weekly
  ADD COLUMN issue_date date,
  ADD COLUMN issue_details text DEFAULT '',
  ADD COLUMN discussed_action_plan text DEFAULT '',
  ADD COLUMN action_plan text DEFAULT '',
  ADD COLUMN resolution_due_date date,
  ADD COLUMN issue_status text DEFAULT 'Open';