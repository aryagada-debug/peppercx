# Give Claude read access to the app's database

## The constraint
This app runs on Lovable Cloud. Direct database credentials — the connection string, database password, and service-role key — are not exposed and cannot be handed out. So there is no "paste these Supabase details into Claude" path.

What is possible, and equivalent in practice: extend the agent integration this app already has (`CX OS` MCP server) with generic, read-only database tools. Claude connects once, signs in as you, and can then read any table — with your row-level access rules applied automatically.

## What gets built

New read-only tools on the existing MCP server:

- `list_tables` — returns every readable table with its columns and types, so Claude can discover the schema itself.
- `query_table` — reads rows from one table with optional column selection, filters (equals / contains / greater / less / in), ordering, and a row limit (max 1000). Read-only by construction; no writes, no raw SQL.
- `count_rows` — row count for a table with the same filters, so Claude can size a result before pulling it.
- Existing `whoami` and `list_deals` stay as-is.

Every call runs through the signed-in user's session, so Claude sees exactly what that user sees in the app — nothing more.

## Connecting Claude
Once deployed, add the server in Claude (Settings → Connectors → Add custom connector) using the app's MCP endpoint:

```text
https://peppercx.lovable.app/functions/v1/mcp
```

Claude opens a sign-in window; you log in with your app account and approve. Since your account is an admin, Claude will then be able to read the full dataset.

## Technical notes
- Tools live in `src/lib/mcp/tools/` and are registered in `src/lib/mcp/index.ts`, following the existing `list-deals.ts` pattern (user-scoped Supabase client built from the request token).
- Filters map to PostgREST operators (`eq`, `ilike`, `gt`, `lt`, `in`) — no string-concatenated SQL, and table/column names validated against the schema before use.
- Schema discovery uses a read-only SQL-definer function returning table and column metadata for the `public` schema.
- All tools are marked `readOnlyHint: true`; no insert, update, or delete surface is added.

## Alternative if you truly need raw SQL
If Claude must run arbitrary SQL rather than table reads, that requires a dedicated read-only database role and a connection string — which Lovable Cloud does not expose. The route there would be moving to your own Supabase project, which is a larger migration. Say the word and I'll plan that separately.
