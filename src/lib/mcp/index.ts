import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listDealsTool from "./tools/list-deals";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cx-os-mcp",
  title: "CX OS",
  version: "0.1.0",
  instructions:
    "Tools for CX OS. Use `whoami` to confirm the connection and `list_deals` to read the signed-in user's accessible deals (RLS-enforced).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listDealsTool],
});