## Fix fractional allocation percentages

### Problem
The `staffing_assignments.allocation_pct` column mixes two scales:
- 703 rows stored as fractions (0.01 – 0.99), meaning "50%" was saved as `0.5`
- 11 rows correctly stored as percentages (≥ 1, up to 15)
- The rest are 0

The UI treats the column as a percentage, so the fractional rows render as `0.5%` instead of `50%`.

### Fix
Run a one-shot migration that multiplies every fractional value by 100:

```sql
UPDATE public.staffing_assignments
SET allocation_pct = allocation_pct * 100
WHERE allocation_pct > 0 AND allocation_pct < 1;
```

Scope: only `staffing_assignments`. The other allocation table (`staffing_weekly_allocations`) was checked and has no fractional values, so it is left untouched.

### Notes
- This is a data fix, not a schema or UI change.
- After the migration, all 714 non-zero rows will be on the same 0–100 scale and the matrix / capacity views will show correct percentages.
