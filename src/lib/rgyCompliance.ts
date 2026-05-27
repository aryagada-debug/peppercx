import { getMonday, fmtISODate } from "@/hooks/useWeeklyStaffing";

export type ComplianceStatus = "updated" | "reviewed" | "pending";

export function weekRange(d: Date = new Date()): { start: string; end: string } {
  const mon = getMonday(d);
  const end = new Date(mon);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start: fmtISODate(mon), end: fmtISODate(end) };
}

export function shiftWeek(weekStartIso: string, deltaWeeks: number): string {
  const d = new Date(weekStartIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return fmtISODate(d);
}

/** Split a comma-separated name string into normalized lower-case tokens. */
export function splitNames(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}

/** Does `editorName` match any of the people in `roleNames` (comma list)? */
export function nameMatchesRole(editorName: string, roleNames: string | null | undefined): boolean {
  const e = editorName.trim().toLowerCase();
  if (!e) return false;
  const names = splitNames(roleNames);
  return names.some(n => n === e || n.includes(e) || e.includes(n));
}

export const REVIEW_SENTINEL_DIMENSION = "__review__";

export function statusLabel(s: ComplianceStatus): string {
  if (s === "updated") return "Updated";
  if (s === "reviewed") return "Reviewed – No Change";
  return "Pending";
}

export function statusToneClass(s: ComplianceStatus): string {
  if (s === "updated") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (s === "reviewed") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
}