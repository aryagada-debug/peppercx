# Sync deals & staffing into Creator Compass

One-way push: this app stays the source of truth, Creator Compass receives a mirrored copy of every deal and staffing change.

## What gets synced

- **Deal created** — a matching deal row is created in Creator Compass.
- **Deal updated** — status, MRR, total value, dates, BU, VSD, deal type etc. are pushed on change.
- **Staffing changed** — every assignment add / edit / removal (person, role, allocation %, dates) is pushed.

Deletes are pushed as a "removed" signal so the other side can clean up.

## How it works

```text
staffing_deals / staffing_assignments
        |  (database trigger)
        v
   sync_outbox table  (queued change events)
        |  (runs every minute)
        v
 creator-compass-sync  edge function
        |  writes with service credentials
        v
   Creator Compass database
```

An outbox queue is used instead of a direct call so nothing is lost if the other app is briefly down — failed events retry with the error recorded, and there is a small admin view to see queue health and retry manually.

## What I need from you before building

Creator Compass is not in this workspace, so I cannot read its database. To write directly into it I need:

1. Its backend URL and service key (I'll request these through the secure secret form).
2. Its target table names and columns for deals and staffing — either paste the schema, or add me to that project so I can read it.

If you'd rather not share service credentials, the alternative is a small receiving endpoint in Creator Compass that this app POSTs to; say the word and I'll switch the plan to that.

## Technical detail

- New table `public.sync_outbox`: `entity` (deal / assignment), `entity_id`, `op` (insert/update/delete), `payload` jsonb, `status`, `attempts`, `last_error`, timestamps. Admin-only read; written by triggers (security definer) and processed by the edge function via service role.
- Triggers `trg_sync_outbox_deals` on `staffing_deals` and `trg_sync_outbox_assignments` on `staffing_assignments` (AFTER INSERT/UPDATE/DELETE) enqueue the row snapshot. Deal updates only enqueue when a synced field actually changes, so bulk touch-ups don't flood the queue.
- New edge function `supabase/functions/creator-compass-sync/index.ts`: claims pending rows in batches, maps this app's fields to Creator Compass columns, upserts on a stable external key (`staffing_deals.id`, and `deal_id + person_id + role_key` for assignments), marks rows done or failed with the provider error text.
- Scheduled every minute with pg_cron + pg_net.
- Secrets: `CREATOR_COMPASS_SUPABASE_URL`, `CREATOR_COMPASS_SERVICE_KEY`.
- Backfill: one-time run mode on the edge function to push all existing active deals and their staffing, so both apps start aligned.
- Optional small "Creator Compass sync" card in Settings showing pending/failed counts with a retry button.
