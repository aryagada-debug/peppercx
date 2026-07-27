import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Loader2, Search, Send, Mail, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVsdUsers, nameKey } from "@/hooks/queries/legacy";
import { BopmFilter } from "@/components/access/BopmFilter";
import { useUserRole } from "@/hooks/useUserRole";
import PulseEmailTemplateEditor from "./PulseEmailTemplateEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const ANIRUDH_CC = "anirudh@peppercontent.io";

const UNASSIGNED_VSD_VALUES = new Set([
  "", "Not Assigned", "Unassigned", "Not Applicable", "To Be Assigned", "Yet to be assigned",
]);

type Deal = {
  deal_id: string;
  raw_id?: string;
  account: string | null;
  deal_name: string | null;
  vsd: string | null;
  principal_bopm: string | null;
  senior_bopm: string | null;
  bopm: string | null;
  deal_status?: string | null;
  business_unit?: string | null;
};

type Stakeholder = {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  deal_id: string | null;
  client_name: string | null;
};

type Invite = {
  id: string;
  token: string;
  deal_id: string;
  account_snapshot: string | null;
  deal_name_snapshot: string | null;
  recipient_name: string;
  recipient_email: string;
  email_status: string;
  cc_emails: string[];
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  error: string | null;
};

type SendResult = {
  email: string;
  ok: boolean;
  inviteId?: string;
  link?: string;
  error?: string | null;
};

const PAGE_SIZE = 50;

function surveyLinkForToken(token: string) {
  // Always use the published production domain so external recipients never
  // hit Lovable's editor auth wall (preview/editor origins require login).
  return `https://peppercx.lovable.app/survey/${token}`;
}

async function fetchStakeholdersFor(dealIds: string[], accounts: string[]) {
  if (dealIds.length === 0 && accounts.length === 0) return [] as Stakeholder[];
  // Two simple queries in parallel — avoids PostgREST .or()/.in.() quoting
  // pitfalls when account names contain commas, parens, or quotes (e.g.
  // "Lifescan (OneTouch)"), which previously caused the combined filter to
  // silently drop rows.
  const [byId, byAcct] = await Promise.all([
    dealIds.length
      ? supabase
          .from("deal_stakeholders")
          .select("id, name, role, email, phone, deal_id, client_name")
          .in("deal_id", dealIds)
          .limit(5000)
      : Promise.resolve({ data: [] as any[], error: null }),
    accounts.length
      ? supabase
          .from("deal_stakeholders")
          .select("id, name, role, email, phone, deal_id, client_name")
          .in("client_name", accounts)
          .limit(5000)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (byId.error) throw byId.error;
  if (byAcct.error) throw byAcct.error;
  const seen = new Set<string>();
  const out: Stakeholder[] = [];
  for (const r of [...(byId.data || []), ...(byAcct.data || [])]) {
    if (seen.has((r as any).id)) continue;
    seen.add((r as any).id);
    out.push(r as Stakeholder);
  }
  return out;
}

export default function PulseSurveyTab({
  deals,
  showClosed,
  onShowClosedChange,
}: {
  deals: Deal[];
  showClosed?: boolean;
  onShowClosedChange?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { isAdmin, canEditAll } = useUserRole();
  const { vsdUsers, isVsdName, canonVsd } = useVsdUsers();
  const showVsdChips = !!(isAdmin || canEditAll);
  const [search, setSearch] = useState("");
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Record<string, string[]>>({});
  const [adhoc, setAdhoc] = useState("");
  const [removedCc, setRemovedCc] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed" | "completed">("all");
  const [activeVsd, setActiveVsd] = useState<string>("All");
  const [activeBopm, setActiveBopm] = useState<string>("All");
  const [activeBU, setActiveBU] = useState<string>("All");
  const [activeStatus, setActiveStatus] = useState<string>("All");
  const [campaignId, setCampaignId] = useState<string>("none");
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignDesc, setNewCampaignDesc] = useState("");
  const [ccAnirudh, setCcAnirudh] = useState<boolean>(true);
  const [uniqueOnly, setUniqueOnly] = useState<boolean>(false);
  const [sendMode, setSendMode] = useState<"in_app" | "google_form">("in_app");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["pulse-campaigns"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pulse_campaigns")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  const BU_OPTIONS = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => { const bu = (d.business_unit || "").trim(); if (bu) set.add(bu); });
    return Array.from(set).sort();
  }, [deals]);

  const STATUS_OPTIONS = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => { const s = (d.deal_status || "").trim(); if (s) set.add(s); });
    return Array.from(set).sort();
  }, [deals]);

  const createCampaignMut = useMutation({
    mutationFn: async () => {
      const name = newCampaignName.trim();
      if (!name) throw new Error("Name is required");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("pulse_campaigns")
        .insert({ name, description: newCampaignDesc.trim() || null, created_by: user?.id ?? null })
        .select("id, name").single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["pulse-campaigns"] });
      setCampaignId(c.id);
      setCampaignDialogOpen(false);
      setNewCampaignName("");
      setNewCampaignDesc("");
      toast({ title: "Campaign created" });
    },
    onError: (e: any) => toast({ title: "Failed to create campaign", description: e?.message, variant: "destructive" }),
  });

  // Build chip list: All · {VSDs} · Other · Unassigned (mirrors Clients).
  const VSD_FILTERS = useMemo(() => {
    const items: { key: string; label: string }[] = [{ key: "All", label: "All" }];
    vsdUsers.forEach((u: any) => items.push({ key: u.displayName, label: u.displayName }));
    items.push({ key: "Other", label: "Other" });
    items.push({ key: "Unassigned", label: "Unassigned" });
    return items;
  }, [vsdUsers]);

  const splitNames = (s: string | null | undefined) =>
    (s || "").split(/[,/]/).map(x => x.trim()).filter(Boolean);

  // Aggregates: contacts per deal/account, invites sent/completed per deal.
  // Org Mapping stores `deal_stakeholders.deal_id` = raw `staffing_deals.id`,
  // while `deals[].deal_id` here is the formulated ID. Always join on raw IDs.
  const dealIds = useMemo(() => deals.map(d => d.deal_id), [deals]);
  const rawDealIds = useMemo(
    () => Array.from(new Set(deals.map(d => d.raw_id || d.deal_id).filter(Boolean) as string[])),
    [deals]
  );
  const normAcct = (s: string | null | undefined) => (s || "").trim().toLowerCase();
  const accountsAll = useMemo(
    () => Array.from(new Set(deals.map(d => d.account).filter(Boolean) as string[])),
    [deals]
  );

  const { data: contactCounts = {} } = useQuery({
    queryKey: ["pulse-contact-counts", rawDealIds.length, accountsAll.length],
    enabled: rawDealIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // Split into two queries to avoid PostgREST .or() parsing issues on
      // account names with commas/parens/quotes. Merge and dedupe by
      // (deal_id, email) — rows are cheap.
      const [byId, byAcct] = await Promise.all([
        supabase
          .from("deal_stakeholders")
          .select("deal_id, client_name, email")
          .in("deal_id", rawDealIds)
          .limit(10000),
        accountsAll.length
          ? supabase
              .from("deal_stakeholders")
              .select("deal_id, client_name, email")
              .in("client_name", accountsAll)
              .limit(10000)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      if (byId.error) throw byId.error;
      if (byAcct.error) throw byAcct.error;
      const data = [...(byId.data || []), ...(byAcct.data || [])];
      // Aggregate by raw deal_id and by normalized client_name (account).
      const byDeal: Record<string, Set<string>> = {};
      const byAccount: Record<string, Set<string>> = {};
      for (const r of (data || []) as any[]) {
        const em = (r.email || "").toLowerCase();
        if (!em || !em.includes("@")) continue;
        if (r.deal_id) {
          (byDeal[r.deal_id] ||= new Set()).add(em);
        }
        const ak = normAcct(r.client_name);
        if (ak) {
          (byAccount[ak] ||= new Set()).add(em);
        }
      }
      const out: Record<string, number> = {};
      for (const d of deals) {
        const rawKey = d.raw_id || d.deal_id;
        const direct = byDeal[rawKey]?.size ?? 0;
        const viaAccount = d.account ? byAccount[normAcct(d.account)]?.size ?? 0 : 0;
        out[d.deal_id] = Math.max(direct, viaAccount);
      }
      return out;
    },
  });

  const { data: inviteAggByDeal = {} } = useQuery({
    queryKey: ["pulse-invite-agg", rawDealIds.length],
    enabled: rawDealIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_invites")
        .select("deal_id, sent_at, completed_at")
        .in("deal_id", rawDealIds)
        .limit(5000);
      if (error) throw error;
      const map: Record<string, { sent: number; completed: number }> = {};
      for (const r of (data || []) as any[]) {
        const m = (map[r.deal_id] ||= { sent: 0, completed: 0 });
        if (r.sent_at) m.sent += 1;
        if (r.completed_at) m.completed += 1;
      }
      return map;
    },
  });

  const filteredDeals = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = deals;
    if (activeVsd === "Unassigned") {
      list = list.filter(d => UNASSIGNED_VSD_VALUES.has((d.vsd || "").trim()));
    } else if (activeVsd === "Other") {
      list = list.filter(d => {
        const v = (d.vsd || "").trim();
        return !!v && !UNASSIGNED_VSD_VALUES.has(v) && !isVsdName(v);
      });
    } else if (activeVsd !== "All") {
      list = list.filter(d => canonVsd(d.vsd) === activeVsd);
    }
    if (activeBopm !== "All") {
      list = list.filter(d =>
        splitNames(d.principal_bopm).some(n => n === activeBopm) ||
        splitNames(d.senior_bopm).some(n => n === activeBopm) ||
        splitNames(d.bopm).some(n => n === activeBopm)
      );
    }
    if (activeBU !== "All") {
      list = list.filter(d => (d.business_unit || "").trim() === activeBU);
    }
    if (activeStatus !== "All") {
      list = list.filter(d => (d.deal_status || "").trim() === activeStatus);
    }
    if (s) {
      list = list.filter(d =>
        (d.account || "").toLowerCase().includes(s) ||
        (d.deal_name || "").toLowerCase().includes(s) ||
        (d.deal_id || "").toLowerCase().includes(s));
    }
    return [...list].sort((a, b) =>
      (a.account || "").localeCompare(b.account || "") ||
      (a.deal_name || "").localeCompare(b.deal_name || "")
    );
  }, [deals, search, activeVsd, activeBopm, activeBU, activeStatus, isVsdName, canonVsd]);

  const selectedDeals = useMemo(
    () => deals.filter(d => selectedDealIds.includes(d.deal_id)),
    [deals, selectedDealIds]
  );

  // Stakeholders for selected deals (account-scoped to mirror Contacts insights logic).
  const accounts = useMemo(
    () => Array.from(new Set(selectedDeals.map(d => d.account).filter(Boolean) as string[])),
    [selectedDeals]
  );
  const { data: stakeholders = [], isLoading: shLoading } = useQuery({
    queryKey: ["pulse-stakeholders", accounts, selectedDealIds],
    queryFn: () => {
      const rawIds = Array.from(new Set(
        selectedDeals.map(d => d.raw_id || d.deal_id).filter(Boolean) as string[]
      ));
      return fetchStakeholdersFor(rawIds, accounts);
    },
    enabled: selectedDealIds.length > 0,
    staleTime: 60_000,
  });

  // Map stakeholders → deal(s).
  const dealStakeholders = useMemo(() => {
    const m: Record<string, Stakeholder[]> = {};
    for (const d of selectedDeals) {
      const seen = new Set<string>();
      const arr: Stakeholder[] = [];
      for (const s of stakeholders) {
        if (!s.email || !/@/.test(s.email)) continue;
        const rawKey = d.raw_id || d.deal_id;
        const matches =
          s.deal_id === rawKey ||
          (d.account && normAcct(s.client_name) === normAcct(d.account));
        if (!matches) continue;
        const key = s.email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        arr.push(s);
      }
      m[d.deal_id] = arr;
    }
    return m;
  }, [selectedDeals, stakeholders]);

  // Auto-select all stakeholder emails for newly opened deals.
  useEffect(() => {
    if (selectedDealIds.length === 0) return;
    setSelectedEmails(prev => {
      const next = { ...prev };
      let changed = false;
      for (const id of selectedDealIds) {
        if (next[id] !== undefined) continue;
        const emails = (dealStakeholders[id] || []).map(s => s.email!).filter(Boolean);
        if (emails.length === 0) continue;
        next[id] = emails;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedDealIds, dealStakeholders]);

  // Map invite.deal_id (== staffing_deals.id == raw_id) → owners for display + filtering.
  const dealOwnersById = useMemo(() => {
    const m: Record<string, { vsd: string | null; principal_bopm: string | null; senior_bopm: string | null }> = {};
    for (const d of deals) {
      const key = d.raw_id || d.deal_id;
      if (!key) continue;
      m[key] = { vsd: d.vsd ?? null, principal_bopm: d.principal_bopm ?? null, senior_bopm: d.senior_bopm ?? null };
    }
    return m;
  }, [deals]);

  // Chip list of P/Sr BOPMs sourced from the loaded deals.
  const BOPM_FILTERS = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      splitNames(d.principal_bopm).forEach(n => set.add(n));
      splitNames(d.senior_bopm).forEach(n => set.add(n));
    }
    return [{ key: "All", label: "All" }, ...Array.from(set).sort().map(n => ({ key: n, label: n }))];
  }, [deals]);

  // When VSD/BOPM chips are active, restrict invites to matching deals only.
  const inviteFilterDealIds = useMemo<string[] | null>(() => {
    if (activeVsd === "All" && activeBopm === "All") return null;
    const ids: string[] = [];
    for (const d of deals) {
      const v = (d.vsd || "").trim();
      let vsdOk = true;
      if (activeVsd === "Unassigned") vsdOk = UNASSIGNED_VSD_VALUES.has(v);
      else if (activeVsd === "Other") vsdOk = !!v && !UNASSIGNED_VSD_VALUES.has(v) && !isVsdName(v);
      else if (activeVsd !== "All") vsdOk = canonVsd(d.vsd) === activeVsd;

      let bopmOk = true;
      if (activeBopm !== "All") {
        bopmOk =
          splitNames(d.principal_bopm).some(n => n === activeBopm) ||
          splitNames(d.senior_bopm).some(n => n === activeBopm) ||
          splitNames(d.bopm).some(n => n === activeBopm);
      }
      if (vsdOk && bopmOk) ids.push(d.raw_id || d.deal_id);
    }
    return ids;
  }, [deals, activeVsd, activeBopm, isVsdName, canonVsd]);

  // Recent invites (paginated).
  const { data: invites = [] } = useQuery({
    queryKey: ["pulse-invites", page, statusFilter, activeVsd, activeBopm, inviteFilterDealIds?.length ?? -1],
    queryFn: async () => {
      if (inviteFilterDealIds && inviteFilterDealIds.length === 0) return [] as Invite[];
      let q = supabase
        .from("survey_invites")
        .select("id, token, deal_id, account_snapshot, deal_name_snapshot, recipient_name, recipient_email, email_status, cc_emails, sent_at, opened_at, completed_at, error")
        .order("created_at", { ascending: false })
        .limit(page * PAGE_SIZE);
      if (statusFilter === "sent") q = q.eq("email_status", "sent");
      if (statusFilter === "failed") q = q.eq("email_status", "failed");
      if (statusFilter === "completed") q = q.not("completed_at", "is", null);
      if (inviteFilterDealIds) q = q.in("deal_id", inviteFilterDealIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Invite[]) || [];
    },
    staleTime: 30_000,
  });

  // Optionally dedupe invites by recipient_email (latest action wins).
  const displayedInvites = useMemo(() => {
    if (!uniqueOnly) return invites;
    const ts = (inv: any) => {
      const vals = [inv.completed_at, inv.opened_at, inv.sent_at]
        .map(v => (v ? new Date(v).getTime() : 0));
      return Math.max(0, ...vals);
    };
    const byEmail = new Map<string, Invite>();
    for (const inv of invites) {
      const key = (inv.recipient_email || "").toLowerCase().trim();
      if (!key) continue;
      const prev = byEmail.get(key);
      if (!prev || ts(inv) > ts(prev)) byEmail.set(key, inv);
    }
    return Array.from(byEmail.values());
  }, [invites, uniqueOnly]);

  // Response rows for the current invite page.
  const inviteIds = useMemo(() => displayedInvites.map(i => i.id), [displayedInvites]);
  const { data: responsesByInvite = {} } = useQuery({
    queryKey: ["pulse-responses", inviteIds],
    enabled: inviteIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("invite_id, nps, csat_avg, submitted_at")
        .in("invite_id", inviteIds);
      if (error) throw error;
      const m: Record<string, { nps: number | null; csat: number | null }> = {};
      for (const r of (data || []) as any[]) {
        if (!r.invite_id) continue;
        m[r.invite_id] = { nps: r.nps ?? null, csat: r.csat_avg != null ? Number(r.csat_avg) : null };
      }
      return m;
    },
  });

  // 30-day summary stats.
  const { data: summary } = useQuery({
    queryKey: ["pulse-summary-30d"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [inv, resp] = await Promise.all([
        supabase.from("survey_invites")
          .select("id, sent_at, opened_at, completed_at", { count: "exact" })
          .gte("created_at", since)
          .limit(2000),
        supabase.from("survey_responses")
          .select("nps, csat_avg, submitted_at")
          .gte("submitted_at", since)
          .limit(2000),
      ]);
      if (inv.error) throw inv.error;
      if (resp.error) throw resp.error;
      const sent = (inv.data || []).filter((r: any) => r.sent_at).length;
      const opened = (inv.data || []).filter((r: any) => r.opened_at).length;
      const completed = (inv.data || []).filter((r: any) => r.completed_at).length;
      const npsVals = (resp.data || []).map((r: any) => r.nps).filter((n: any) => typeof n === "number");
      const csatVals = (resp.data || []).map((r: any) => r.csat_avg).filter((n: any) => n != null).map(Number);
      const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
      // NPS score = %promoters (9-10) - %detractors (0-6)
      let npsScore: number | null = null;
      if (npsVals.length) {
        const promoters = npsVals.filter((n: number) => n >= 9).length;
        const detractors = npsVals.filter((n: number) => n <= 6).length;
        npsScore = Math.round(((promoters - detractors) / npsVals.length) * 100);
      }
      return { sent, opened, completed, avgCsat: avg(csatVals), nps: npsScore, responses: resp.data?.length || 0 };
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const calls: Promise<{ ok?: boolean; error?: string; results?: SendResult[] }>[] = [];
      const seenAdhoc = new Set<string>();
      const skippedNoContacts: string[] = [];
      for (const d of selectedDeals) {
        const list = dealStakeholders[d.deal_id] || [];
        const hasContacts = list.some(s => (s.email || "").trim() !== "");
        if (!hasContacts) {
          skippedNoContacts.push(d.account || d.deal_name || d.deal_id);
          continue;
        }
        const chosen = uniqueOnly
          ? (dedupedSelectedEmails[d.deal_id] || [])
          : (selectedEmails[d.deal_id] || []);
        if (chosen.length === 0) continue;
        const recipients = chosen.map(em => {
          const s = list.find(x => (x.email || "").toLowerCase() === em.toLowerCase());
          return { email: em, name: s?.name || "", stakeholderId: s?.id || null };
        });
        // adhoc
        adhoc.split(/[,;\s]+/).map(s => s.trim()).filter(e => /@/.test(e)).forEach(e => {
          const key = e.toLowerCase();
          if (recipients.some(r => r.email.toLowerCase() === key)) return;
          if (uniqueOnly) {
            // Skip if already sent via another deal or an earlier ad-hoc pass.
            if (duplicateOwner.has(key) && duplicateOwner.get(key) !== "ad-hoc") return;
            if (seenAdhoc.has(key)) return;
            seenAdhoc.add(key);
          }
          recipients.push({ email: e, name: "", stakeholderId: null });
        });
        if (recipients.length === 0) continue;
        const body = {
          dealId: d.raw_id || d.deal_id,
          recipients,
          autoCcLeadership: true,
          ccEmails: [] as string[],
          excludeCcNames: removedCc[d.deal_id] || [],
          campaignId: campaignId !== "none" ? campaignId : null,
          ccAnirudh,
          mode: sendMode,
        };
        calls.push(
          supabase.functions.invoke("send-pulse-survey", { body }).then(({ data, error }) => {
            if (error) {
              const msg = (data as any)?.error || (error as any)?.context?.error || error.message || "";
              if (typeof msg === "string" && msg.includes("central_mailbox")) {
                throw new Error("Central mailbox not connected. Ask an admin to connect centralcx@peppercontent.io in Settings → Email.");
              }
              throw error;
            }
            return data;
          })
        );
      }
      if (calls.length === 0) {
        if (skippedNoContacts.length > 0) {
          throw new Error(`No emails sent. ${skippedNoContacts.length} selected deal(s) have no Org Mapping contacts.`);
        }
        throw new Error("Select at least one recipient email.");
      }
      const results = await Promise.allSettled(calls);
      const payloads = results.flatMap(r =>
        r.status === "fulfilled"
          ? [r.value]
          : [{ ok: false, error: r.reason?.message || "send_failed", results: [] as SendResult[] }]
      );
      const recipientResults = payloads.flatMap(p => p.results || []);
      const inviteCount = recipientResults.filter(r => r.inviteId).length;
      const sentCount = recipientResults.filter(r => r.ok).length;
      const failedCount = recipientResults.filter(r => !r.ok).length + results.filter(r => r.status === "rejected").length;
      const topError = payloads.find(p => !p.ok && p.error)?.error || recipientResults.find(r => r.error)?.error || null;
      return { batches: calls.length, inviteCount, sentCount, failedCount, topError, skippedNoContacts };
    },
    onSuccess: (r) => {
      const centralMissing = String(r.topError || "").includes("central_mailbox");
      toast({
        title: r.sentCount > 0 ? "Surveys sent" : r.inviteCount > 0 ? "Survey links created" : "Send failed",
        description: centralMissing
          ? `${r.inviteCount} survey link(s) were created, but email was not sent because centralcx@peppercontent.io is not connected.`
          : `${r.inviteCount} link(s) created · ${r.sentCount} email(s) sent${r.failedCount ? ` · ${r.failedCount} failed` : ""}${r.skippedNoContacts?.length ? ` · Skipped ${r.skippedNoContacts.length} deal(s) with no Org Mapping contacts` : ""}.`,
        variant: r.sentCount === 0 && r.failedCount > 0 ? "destructive" : undefined,
      });
      if (r.skippedNoContacts?.length) {
        toast({
          title: "Deals skipped — no contacts",
          description: r.skippedNoContacts.slice(0, 5).join(", ") + (r.skippedNoContacts.length > 5 ? ` +${r.skippedNoContacts.length - 5} more` : ""),
        });
      }
      setSelectedEmails({});
      setAdhoc("");
      qc.invalidateQueries({ queryKey: ["pulse-invites"] });
      qc.invalidateQueries({ queryKey: ["pulse-invite-agg"] });
      qc.invalidateQueries({ queryKey: ["pulse-summary-30d"] });
    },
    onError: (e: any) => {
      toast({ title: "Send failed", description: e?.message || "Try again.", variant: "destructive" });
    },
  });

  const toggleDeal = (id: string) =>
    setSelectedDealIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const prefetchDeal = (d: Deal) => {
    // Prefetch using the exact same query key shape and payload as the
    // main "pulse-stakeholders" query so a hover doesn't shadow the real
    // result with a filtered-by-formulated-ID (empty) cache entry.
    const accts = d.account ? [d.account] : [];
    const rawIds = [d.raw_id || d.deal_id];
    qc.prefetchQuery({
      queryKey: ["pulse-stakeholders", accts, [d.deal_id]],
      queryFn: () => fetchStakeholdersFor(rawIds, accts),
      staleTime: 60_000,
    });
  };

  const toggleEmail = (dealId: string, email: string) => {
    setSelectedEmails(prev => {
      const cur = prev[dealId] || [];
      const next = cur.includes(email) ? cur.filter(e => e !== email) : [...cur, email];
      return { ...prev, [dealId]: next };
    });
  };

  // Dedup selected emails across selected deals (first-deal-wins), based on the
  // rendered order of `selectedDeals`. Used both for UI display and for send.
  const { dedupedSelectedEmails, dedupedTotal, duplicateOwner } = useMemo(() => {
    const seen = new Map<string, string>(); // emailLower -> owning deal account/name
    const out: Record<string, string[]> = {};
    for (const d of selectedDeals) {
      const emails = selectedEmails[d.deal_id] || [];
      const kept: string[] = [];
      for (const em of emails) {
        const key = em.trim().toLowerCase();
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.set(key, d.account || d.deal_name || d.deal_id);
        kept.push(em);
      }
      out[d.deal_id] = kept;
    }
    const adhocEmails = adhoc.split(/[,;\s]+/).map(s => s.trim()).filter(e => /@/.test(e));
    let adhocUnique = 0;
    for (const e of adhocEmails) {
      const key = e.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, "ad-hoc");
      adhocUnique += 1;
    }
    const dedupedTotal = Object.values(out).reduce((a, v) => a + v.length, 0) + adhocUnique;
    return { dedupedSelectedEmails: out, dedupedTotal, duplicateOwner: seen };
  }, [selectedDeals, selectedEmails, adhoc]);

  const rawTotal = Object.values(selectedEmails).reduce((a, v) => a + v.length, 0)
    + adhoc.split(/[,;\s]+/).filter(e => /@/.test(e)).length;
  const totalRecipients = uniqueOnly ? dedupedTotal : rawTotal;

  const copyText = async (text: string, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label });
    } catch {
      toast({ title: "Copy failed", description: text, variant: "destructive" });
    }
  };

  // Select-all helpers for the left deal pane. Deals with 0 Org Mapping
  // contacts are excluded from selection entirely.
  const selectableDeals = useMemo(
    () => filteredDeals.filter(d => (contactCounts[d.deal_id] ?? 0) > 0),
    [filteredDeals, contactCounts]
  );
  const allFilteredSelected = selectableDeals.length > 0
    && selectableDeals.every(d => selectedDealIds.includes(d.deal_id));
  const handleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedDealIds(prev => prev.filter(id => !selectableDeals.some(d => d.deal_id === id)));
      return;
    }
    const apply = () => setSelectedDealIds(prev => {
      const next = new Set(prev);
      selectableDeals.forEach(d => next.add(d.deal_id));
      return Array.from(next);
    });
    if (selectableDeals.length > 50) {
      const ok = typeof window !== "undefined"
        ? window.confirm(`Select all ${selectableDeals.length} deals? Stakeholders will load in the background.`)
        : true;
      if (!ok) return;
    }
    apply();
  };

  return (
    <div className="space-y-4">
      <PulseEmailTemplateEditor />
      {/* Top filters — mirrors Clients & Deals */}
      <div className="flex items-center gap-2 flex-wrap">
        {showVsdChips && (
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5 overflow-x-auto max-w-full">
            {VSD_FILTERS.map(v => (
              <button
                key={v.key}
                onClick={() => setActiveVsd(v.key)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                  activeVsd === v.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <BopmFilter
          value={activeBopm}
          onChange={setActiveBopm}
          scopedVsd={showVsdChips && activeVsd !== "All" && activeVsd !== "Other" && activeVsd !== "Unassigned" ? activeVsd : undefined}
        />

        {BU_OPTIONS.length > 0 && (
          <Select value={activeBU} onValueChange={setActiveBU}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Pepper BU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All BUs</SelectItem>
              {BU_OPTIONS.map(bu => (
                <SelectItem key={bu} value={bu}>{bu}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {STATUS_OPTIONS.length > 0 && (
          <Select value={activeStatus} onValueChange={setActiveStatus}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Deal status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative flex-1 min-w-[260px] max-w-[480px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients, deals or deal ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-9 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {onShowClosedChange && (
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={!!showClosed}
              onCheckedChange={(v) => onShowClosedChange(!!v)}
            />
            Closed
          </label>
        )}
      </div>

      <div className="grid lg:grid-cols-[320px,1fr] gap-4">
        {/* Deal picker */}
        <div className="border rounded-lg bg-card">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search deals…"
                className="pl-7 h-8 text-xs"
              />
            </div>
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-muted-foreground">
              <span>{selectedDealIds.length} selected · {selectableDeals.length} deals</span>
              <div className="flex items-center gap-2">
                <button
                  className="hover:underline disabled:opacity-50"
                  onClick={handleSelectAll}
                  disabled={selectableDeals.length === 0}
                >
                  {allFilteredSelected ? "Clear selection" : `Select all (${selectableDeals.length})`}
                </button>
                {selectedDealIds.length > 0 && !allFilteredSelected && (
                  <button className="hover:underline" onClick={() => setSelectedDealIds([])}>Clear</button>
                )}
              </div>
            </div>
          </div>
          <ScrollArea className="h-[460px]">
            <ul className="divide-y">
              {filteredDeals.map(d => {
                const on = selectedDealIds.includes(d.deal_id);
                const cc = contactCounts[d.deal_id] ?? 0;
                const agg = inviteAggByDeal[d.raw_id || d.deal_id];
                const disabled = cc === 0;
                return (
                  <li key={d.deal_id}>
                    <button
                      onClick={() => { if (!disabled) toggleDeal(d.deal_id); }}
                      onMouseEnter={() => prefetchDeal(d)}
                      disabled={disabled}
                      title={disabled ? "No contacts in Org Mapping — add contacts to enable" : undefined}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs flex items-start gap-2 hover:bg-muted/40",
                        on && "bg-primary/5",
                        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                      )}
                    >
                      <Checkbox checked={on} disabled={disabled} className="mt-0.5" tabIndex={-1} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{d.account || "—"}</div>
                        <div className="text-muted-foreground truncate">{d.deal_name || d.deal_id}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          <span className={cn("px-1.5 py-0.5 rounded bg-muted", cc === 0 && "text-amber-700 bg-amber-50")}>
                            {cc} contact{cc === 1 ? "" : "s"}
                          </span>
                          {agg?.sent ? (
                            <span className="px-1.5 py-0.5 rounded bg-muted">{agg.sent} sent</span>
                          ) : null}
                          {agg?.completed ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{agg.completed} done</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>

        {/* Recipient picker */}
        <div className="border rounded-lg bg-card">
          <div className="p-3 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-medium">
              Recipients
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                {totalRecipients} selected
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none"
                title="Deduplicates emails across the selected deals (each address gets one invite)"
              >
                <Checkbox checked={uniqueOnly} onCheckedChange={(v) => setUniqueOnly(!!v)} />
                Unique contacts only
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <Checkbox checked={ccAnirudh} onCheckedChange={(v) => setCcAnirudh(!!v)} />
                Cc {ANIRUDH_CC}
              </label>
              <Select
                value={campaignId}
                onValueChange={(v) => {
                  if (v === "__new__") { setCampaignDialogOpen(true); return; }
                  setCampaignId(v);
                }}
              >
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="Add to campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  <SelectItem value="__new__">➕ New campaign…</SelectItem>
                </SelectContent>
              </Select>
              <Button
              size="sm"
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending || totalRecipients === 0 || selectedDealIds.length === 0}
              className="h-8 gap-1.5"
            >
              {sendMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send surveys
              </Button>
            </div>
          </div>
          <div className="max-h-[460px] overflow-y-auto p-3 space-y-4">
            {selectedDealIds.length === 0 && (
              <div className="text-xs text-muted-foreground py-10 text-center">
                Select one or more deals on the left to pick recipients.
              </div>
            )}
            {shLoading && selectedDealIds.length > 0 && (
              <div className="text-xs text-muted-foreground py-4 text-center">Loading contacts…</div>
            )}
            {selectedDeals.map(d => {
              const list = dealStakeholders[d.deal_id] || [];
              const ccDropped = new Set((removedCc[d.deal_id] || []).map(e => e.toLowerCase()));
              const ccPreview = [d.vsd, d.principal_bopm, d.senior_bopm]
                .filter(Boolean).flatMap(n => (n as string).split(/[,/]/).map(x => x.trim()).filter(Boolean));
              return (
                <div key={d.deal_id} className="border rounded-md">
                  <div className="px-3 py-2 bg-muted/30 text-xs font-medium border-b">
                    {d.account || "—"} <span className="text-muted-foreground font-normal">· {d.deal_name || d.deal_id}</span>
                  </div>
                  <div className="p-2">
                    {list.length === 0 && (
                      <div className="text-[11px] text-muted-foreground px-2 py-3">
                        No contacts in Org Mapping for this deal. Use the ad-hoc emails field below.
                      </div>
                    )}
                    {list.map(s => {
                      const checked = (selectedEmails[d.deal_id] || []).includes(s.email!);
                      const emailKey = (s.email || "").toLowerCase();
                      const keptForThisDeal = (dedupedSelectedEmails[d.deal_id] || [])
                        .some(e => e.toLowerCase() === emailKey);
                      const isDuplicate = uniqueOnly && checked && !keptForThisDeal;
                      const owner = duplicateOwner.get(emailKey);
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer text-xs",
                            isDuplicate && "opacity-50"
                          )}
                          title={isDuplicate && owner ? `Already included via ${owner}` : undefined}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleEmail(d.deal_id, s.email!)} />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {s.name || "—"} <span className="text-muted-foreground font-normal">· {s.role || "—"}</span>
                            </div>
                            <div className="text-muted-foreground truncate">
                              {s.email}
                              {isDuplicate && owner && (
                                <span className="ml-1 italic">· duplicate, kept in {owner}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {(ccPreview.length > 0 || ccAnirudh) && (
                    <div className="px-3 py-2 border-t bg-muted/10 text-[11px]">
                      <span className="text-muted-foreground">Will Cc:</span>{" "}
                      {ccAnirudh && (
                        <Badge
                          variant="secondary"
                          className="mr-1 mb-1 text-[10px] gap-1 cursor-pointer"
                          onClick={() => setCcAnirudh(false)}
                          title="Remove Anirudh from Cc"
                        >
                          {ANIRUDH_CC} <X className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                      {ccPreview.map(n => {
                        const dropped = ccDropped.has(n.toLowerCase());
                        return (
                          <Badge
                            key={n}
                            variant={dropped ? "outline" : "secondary"}
                            className={cn("mr-1 mb-1 text-[10px] gap-1 cursor-pointer", dropped && "opacity-50 line-through")}
                            onClick={() => setRemovedCc(prev => {
                              const cur = prev[d.deal_id] || [];
                              return { ...prev, [d.deal_id]: dropped ? cur.filter(x => x.toLowerCase() !== n.toLowerCase()) : [...cur, n] };
                            })}
                          >
                            {n} {!dropped && <X className="h-2.5 w-2.5" />}
                          </Badge>
                        );
                      })}
                      <span className="ml-1 text-muted-foreground">(VSD + Principal/Senior BOPM{ccAnirudh ? " + Anirudh" : ""})</span>
                    </div>
                  )}
                </div>
              );
            })}
            {selectedDealIds.length > 0 && (
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Ad-hoc emails (comma/space separated)</label>
                <Input value={adhoc} onChange={e => setAdhoc(e.target.value)} placeholder="someone@example.com, other@example.com" className="h-8 text-xs" />
                <p className="text-[10px] text-muted-foreground mt-1">Each ad-hoc email is sent for every selected deal.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Sent invites */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Mail className="h-3.5 w-3.5" />
          <h3 className="text-sm font-semibold">Recent invites</h3>
          <div className="ml-auto flex items-center gap-1">
            {(["all","sent","completed","failed"] as const).map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] border",
                  statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted/40"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 30-day summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {[
            { label: "Sent (30d)", value: summary?.sent ?? "—" },
            { label: "Opened", value: summary?.opened ?? "—" },
            { label: "Completed", value: summary?.completed ?? "—" },
            { label: "NPS", value: summary?.nps ?? "—" },
            { label: "Avg CSAT", value: summary?.avgCsat ?? "—" },
          ].map(s => (
            <div key={s.label} className="border rounded-md p-2 bg-card">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="text-base font-semibold">{s.value as any}</div>
            </div>
          ))}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Deal</th>
                <th className="text-left px-3 py-2">Recipient</th>
                <th className="text-left px-3 py-2">P / Sr BOPM</th>
                <th className="text-left px-3 py-2">Cc</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Sent</th>
                <th className="text-left px-3 py-2">Opened</th>
                <th className="text-left px-3 py-2">Completed</th>
                <th className="text-left px-3 py-2">NPS</th>
                <th className="text-left px-3 py-2">CSAT</th>
                <th className="text-left px-3 py-2">Link</th>
                <th className="text-left px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {displayedInvites.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">No invites sent yet.</td></tr>
              )}
              {displayedInvites.map(inv => {
                const r = responsesByInvite[inv.id];
                const link = surveyLinkForToken(inv.token);
                const owners = dealOwnersById[inv.deal_id];
                return (
                <tr key={inv.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{inv.account_snapshot || "—"}</div>
                    <div className="text-muted-foreground">{inv.deal_name_snapshot || inv.deal_id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{inv.recipient_name || "—"}</div>
                    <div className="text-muted-foreground">{inv.recipient_email}</div>
                  </td>
                  <td className="px-3 py-2">
                    {owners?.principal_bopm || owners?.senior_bopm ? (
                      <>
                        <div className="font-medium">{owners?.principal_bopm || "—"}</div>
                        <div className="text-muted-foreground">{owners?.senior_bopm || "—"}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{(inv.cc_emails || []).length}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={inv.email_status === "sent" ? "secondary" : inv.email_status === "failed" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {inv.email_status}
                    </Badge>
                    {inv.error && <div className="text-[10px] text-destructive mt-1">{inv.error}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{inv.sent_at ? new Date(inv.sent_at).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{inv.opened_at ? new Date(inv.opened_at).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2">
                    {inv.completed_at
                      ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r?.nps ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r?.csat ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyText(link, "Survey link copied")}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        aria-label="Copy survey link"
                        title="Copy survey link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        aria-label="Open survey link"
                        title="Open survey link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete invite for ${inv.recipient_email}? This also removes any submitted response.`)) return;
                          const { error } = await supabase.from("survey_invites").delete().eq("id", inv.id);
                          if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
                          toast({ title: "Invite deleted" });
                          qc.invalidateQueries({ queryKey: ["pulse-invites"] });
                          qc.invalidateQueries({ queryKey: ["pulse-summary-30d"] });
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        aria-label="Delete invite"
                        title="Delete invite"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {invites.length >= page * PAGE_SIZE && (
            <div className="p-2 border-t bg-muted/20 text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                className="text-xs text-primary hover:underline"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pulse-campaign-name" className="text-xs">Name</Label>
              <Input
                id="pulse-campaign-name"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="e.g. Q4 renewals pulse"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pulse-campaign-desc" className="text-xs">Description (optional)</Label>
              <Textarea
                id="pulse-campaign-desc"
                value={newCampaignDesc}
                onChange={(e) => setNewCampaignDesc(e.target.value)}
                rows={3}
                placeholder="What is this campaign for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCampaignMut.mutate()}
              disabled={createCampaignMut.isPending || !newCampaignName.trim()}
            >
              {createCampaignMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}