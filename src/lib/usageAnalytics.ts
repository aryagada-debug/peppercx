export type UsageStatus = "active7" | "active30" | "dormant" | "never_signed_in" | "not_provisioned";

export interface UsageRow {
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  region: string;
  pod: string;
  department: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  days_since_login: number | null;
  writes_30d: number;
  status: UsageStatus;
}

export function classifyStatus(
  hasAuth: boolean,
  lastSignIn: string | null,
  now = Date.now(),
): UsageStatus {
  if (!hasAuth) return "not_provisioned";
  if (!lastSignIn) return "never_signed_in";
  const days = (now - new Date(lastSignIn).getTime()) / 86400000;
  if (days <= 7) return "active7";
  if (days <= 30) return "active30";
  return "dormant";
}

export const STATUS_LABEL: Record<UsageStatus, string> = {
  active7: "Active (7d)",
  active30: "Active (30d)",
  dormant: "Dormant",
  never_signed_in: "Never signed in",
  not_provisioned: "Not provisioned",
};

export const STATUS_TONE: Record<UsageStatus, string> = {
  active7: "bg-positive/15 text-positive",
  active30: "bg-blue-500/15 text-blue-600",
  dormant: "bg-warning/15 text-warning",
  never_signed_in: "bg-destructive/15 text-destructive",
  not_provisioned: "bg-muted text-muted-foreground",
};

export function daysSince(ts: string | null, now = Date.now()): number | null {
  if (!ts) return null;
  return Math.floor((now - new Date(ts).getTime()) / 86400000);
}