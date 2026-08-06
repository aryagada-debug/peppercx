import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listDealsTool from "./tools/list-deals";
import listTablesTool from "./tools/list-tables";
import queryTableTool from "./tools/query-table";
import countRowsTool from "./tools/count-rows";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cx-os-mcp",
  title: "CX OS",
  version: "0.1.0",
  instructions:
    "Read-only access to the CX OS database. Start with `list_tables` to discover tables and columns, then use `query_table` to read rows and `count_rows` to size a result before reading it. `list_deals` is a shortcut for the deals table and `whoami` confirms the connection. Every result is limited to what the signed-in user is allowed to see.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listDealsTool, listTablesTool, queryTableTool, countRowsTool],
});