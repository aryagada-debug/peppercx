ALTER TABLE deal_rgy_weekly ADD COLUMN invoicing text NOT NULL DEFAULT 'G';
ALTER TABLE deal_rgy_weekly ADD COLUMN receivables text NOT NULL DEFAULT 'G';
ALTER TABLE deal_rgy_weekly ADD COLUMN margins text NOT NULL DEFAULT 'G';