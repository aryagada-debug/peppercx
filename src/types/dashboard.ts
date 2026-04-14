import { type LucideIcon } from "lucide-react";

export type RGYStatus = "R" | "Y" | "G" | "NA";

export interface KPI {
  id: string;
  label: string;
  value: string;
  change?: number;
  suffix?: string;
  isPositiveGood?: boolean;
}

export interface DashboardAlert {
  id: string;
  icon: LucideIcon;
  text: string;
  severity: "destructive" | "warning";
  actionLabel: string;
  actionHref: string;
}

export interface PodMember {
  id: string;
  name: string;
  role: string;
  utilization: number;
  deals: number;
}

export interface RGYRow {
  id: string;
  deal: string;
  client: string;
  bopm: string;
  status?: string;
  dimensions: Record<string, RGYStatus>;
}

export interface MBRHistoryEntry {
  id: string;
  date: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  summary: string;
}

export interface SlackActivityEntry {
  id: string;
  channel: string;
  lastMessage: string;
  timestamp: string;
}
