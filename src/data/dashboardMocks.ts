import { AlertTriangle, Clock, MessageSquare, UserMinus } from "lucide-react";
import type { KPI, DashboardAlert, PodMember, RGYRow, RGYStatus, MBRHistoryEntry, SlackActivityEntry } from "@/types/dashboard";

export const kpis: KPI[] = [
  { id: "kpi-1", label: "Active Deals", value: "47", change: 4.26, suffix: "deals" },
  { id: "kpi-2", label: "Total MRR", value: "₹1.82Cr", change: 7.14 },
  { id: "kpi-3", label: "Total Deal Value", value: "₹18.4Cr", change: 3.21 },
  { id: "kpi-4", label: "Attainment", value: "91.2%", change: -1.38 },
];

export const alerts: DashboardAlert[] = [
  { id: "alert-1", icon: AlertTriangle, text: "3 deals have Red RGY status", severity: "destructive", actionLabel: "View →", actionHref: "/rgy-health" },
  { id: "alert-2", icon: Clock, text: "5 MBRs overdue (>35 days)", severity: "warning", actionLabel: "View →", actionHref: "/mbr-tracker" },
  { id: "alert-3", icon: MessageSquare, text: "4 Slack channels inactive >3 days", severity: "warning", actionLabel: "View →", actionHref: "/slack-health" },
  { id: "alert-4", icon: UserMinus, text: "2 deals unstaffed", severity: "destructive", actionLabel: "View →", actionHref: "/staffing" },
];

export const podMembers: PodMember[] = [
  { id: "pod-1", name: "Rahul S.", role: "Sr. BOPM", utilization: 82, deals: 6 },
  { id: "pod-2", name: "Priya M.", role: "Group BOPM", utilization: 71, deals: 5 },
  { id: "pod-3", name: "Ankit K.", role: "Jr. BOPM", utilization: 93, deals: 4 },
  { id: "pod-4", name: "Meera T.", role: "Sr. BOPM", utilization: 67, deals: 7 },
  { id: "pod-5", name: "Vikram J.", role: "Jr. BOPM", utilization: 88, deals: 3 },
];

export const rgyData: RGYRow[] = [
  { id: "rgy-1", deal: "D-2024-047", client: "TechCorp India", bopm: "Rahul S.", dimensions: { Internal: "G" as RGYStatus, Customer: "G" as RGYStatus, Delivery: "Y" as RGYStatus, Consumption: "G" as RGYStatus } },
  { id: "rgy-2", deal: "D-2024-041", client: "FinServe Ltd", bopm: "Priya M.", dimensions: { Internal: "Y" as RGYStatus, Customer: "R" as RGYStatus, Delivery: "Y" as RGYStatus, Consumption: "R" as RGYStatus } },
  { id: "rgy-3", deal: "D-2024-038", client: "MediaNext", bopm: "Ankit K.", dimensions: { Internal: "G" as RGYStatus, Customer: "G" as RGYStatus, Delivery: "G" as RGYStatus, Consumption: "Y" as RGYStatus } },
  { id: "rgy-4", deal: "D-2024-035", client: "RetailMax", bopm: "Meera T.", dimensions: { Internal: "R" as RGYStatus, Customer: "Y" as RGYStatus, Delivery: "R" as RGYStatus, Consumption: "Y" as RGYStatus } },
  { id: "rgy-5", deal: "D-2024-033", client: "CloudFirst", bopm: "Vikram J.", dimensions: { Internal: "G" as RGYStatus, Customer: "G" as RGYStatus, Delivery: "G" as RGYStatus, Consumption: "G" as RGYStatus } },
  { id: "rgy-6", deal: "D-2024-029", client: "EduPrime", bopm: "Rahul S.", dimensions: { Internal: "Y" as RGYStatus, Customer: "Y" as RGYStatus, Delivery: "G" as RGYStatus, Consumption: "NA" as RGYStatus } },
];

export const rgyDimensions = ["Internal", "Customer", "Delivery", "Consumption"];

export const mbrHistory: Record<string, MBRHistoryEntry[]> = {
  "rgy-1": [
    { id: "mbr-1a", date: "2026-03-01", sentiment: "Positive", summary: "Client happy with Q1 delivery. Expanding scope." },
    { id: "mbr-1b", date: "2026-02-01", sentiment: "Positive", summary: "On track. No escalations." },
    { id: "mbr-1c", date: "2026-01-01", sentiment: "Neutral", summary: "Onboarding phase. Setting baselines." },
  ],
  "rgy-2": [
    { id: "mbr-2a", date: "2026-03-01", sentiment: "Negative", summary: "Client raised concerns on delivery timelines." },
    { id: "mbr-2b", date: "2026-02-01", sentiment: "Neutral", summary: "Team ramp-up in progress." },
    { id: "mbr-2c", date: "2026-01-01", sentiment: "Positive", summary: "Kickoff went well." },
  ],
  "rgy-4": [
    { id: "mbr-4a", date: "2026-03-01", sentiment: "Negative", summary: "Multiple red flags. Escalation needed." },
    { id: "mbr-4b", date: "2026-02-01", sentiment: "Negative", summary: "Delivery delays reported." },
    { id: "mbr-4c", date: "2026-01-01", sentiment: "Neutral", summary: "Initial setup completed." },
  ],
};

export const slackActivity: Record<string, SlackActivityEntry[]> = {
  "rgy-1": [
    { id: "slack-1a", channel: "#techcorp-delivery", lastMessage: "Sprint review notes shared", timestamp: "2h ago" },
    { id: "slack-1b", channel: "#techcorp-internal", lastMessage: "Resource allocation updated", timestamp: "5h ago" },
  ],
  "rgy-2": [
    { id: "slack-2a", channel: "#finserve-ops", lastMessage: "Client escalation flagged", timestamp: "1d ago" },
    { id: "slack-2b", channel: "#finserve-internal", lastMessage: "Action items from MBR", timestamp: "3d ago" },
  ],
  "rgy-4": [
    { id: "slack-4a", channel: "#retailmax-delivery", lastMessage: "No messages in 5 days", timestamp: "5d ago" },
  ],
};

export const availableMonths = [
  { value: "2026-06", label: "June 2026" },
  { value: "2026-05", label: "May 2026" },
  { value: "2026-04", label: "April 2026" },
  { value: "2026-03", label: "March 2026" },
  { value: "2026-02", label: "February 2026" },
  { value: "2026-01", label: "January 2026" },
  { value: "2025-12", label: "December 2025" },
  { value: "2025-11", label: "November 2025" },
  { value: "2025-10", label: "October 2025" },
];
