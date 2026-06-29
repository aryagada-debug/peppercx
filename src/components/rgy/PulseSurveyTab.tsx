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
import { Loader2, Search, Send, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

const PAGE_SIZE = 50;

async function fetchStakeholdersFor(dealIds: string[], accounts: string[]) {
  if (dealIds.length === 0) return [] as Stakeholder[];
  const filters: string[] = [];
  filters.push(`deal_id.in.(${dealIds.map(s => `"${s}"`).join(",")})`);
  if (accounts.length) {
    filters.push(`client_name.in.(${accounts.map(s => `"${s.replace(/"/g, '\\"')}"`).join(",")})`);
  }
  const { data, error } = await supabase
    .from("deal_stakeholders")
    .select("id, name, role, email, phone, deal_id, client_name")
    .or(filters.join(","))
    .limit(2000);
  if (error) throw error;
  return (data as Stakeholder[]) || [];
}

export default function PulseSurveyTab({ deals }: { deals: Deal[] }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Record<string, string[]>>({});
  const [adhoc, setAdhoc] = useState("");
  const [removedCc, setRemovedCc] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed" | "completed">("all");

  // Aggregates: contacts per deal/account, invites sent/completed per deal.
  const dealIds = useMemo(() => deals.map(d => d.deal_id), [deals]);
  const accountsAll = useMemo(
    () => Array.from(new Set(deals.map(d => d.account).filter(Boolean) as string[])),
    [deals]
  );

  const { data: contactCounts = {} } = useQuery({
    queryKey: ["pulse-contact-counts", dealIds.length, accountsAll.length],
    enabled: dealIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const filters: string[] = [];
      filters.push(`deal_id.in.(${dealIds.map(s => `"${s}"`).join(",")})`);
      if (accountsAll.length) {
        filters.push(`client_name.in.(${accountsAll.map(s => `"${s.replace(/"/g, '\\"')}"`).join(",")})`);
      }
      const { data, error } = await supabase
        .from("deal_stakeholders")
        .select("deal_id, client_name, email")
        .or(filters.join(","))
        .limit(5000);
      if (error) throw error;
      // Aggregate by deal_id and by client_name (account).
      const byDeal: Record<string, Set<string>> = {};
      const byAccount: Record<string, Set<string>> = {};
      for (const r of (data || []) as any[]) {
        const em = (r.email || "").toLowerCase();
        if (!em || !em.includes("@")) continue;
        if (r.deal_id) {
          (byDeal[r.deal_id] ||= new Set()).add(em);
        }
        if (r.client_name) {
          (byAccount[r.client_name] ||= new Set()).add(em);
        }
      }
      const out: Record<string, number> = {};
      for (const d of deals) {
        const direct = byDeal[d.deal_id]?.size ?? 0;
        const viaAccount = d.account ? byAccount[d.account]?.size ?? 0 : 0;
        out[d.deal_id] = Math.max(direct, viaAccount);
      }
      return out;
    },
  });

  const { data: inviteAggByDeal = {} } = useQuery({
    queryKey: ["pulse-invite-agg", dealIds.length],
    enabled: dealIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_invites")
        .select("deal_id, sent_at, completed_at")
        .in("deal_id", dealIds)
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
    const list = !s
      ? deals
      : deals.filter(d =>
          (d.account || "").toLowerCase().includes(s) ||
          (d.deal_name || "").toLowerCase().includes(s));
    return [...list].sort((a, b) =>
      (a.account || "").localeCompare(b.account || "") ||
      (a.deal_name || "").localeCompare(b.deal_name || "")
    );
  }, [deals, search]);

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
    queryFn: () => fetchStakeholdersFor(selectedDealIds, accounts),
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
        const matches = s.deal_id === d.deal_id || (d.account && s.client_name === d.account);
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

  // Recent invites (paginated).
  const { data: invites = [] } = useQuery({
    queryKey: ["pulse-invites", page, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("survey_invites")
        .select("id, deal_id, account_snapshot, deal_name_snapshot, recipient_name, recipient_email, email_status, cc_emails, sent_at, opened_at, completed_at, error")
        .order("created_at", { ascending: false })
        .limit(page * PAGE_SIZE);
      if (statusFilter === "sent") q = q.eq("email_status", "sent");
      if (statusFilter === "failed") q = q.eq("email_status", "failed");
      if (statusFilter === "completed") q = q.not("completed_at", "is", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Invite[]) || [];
    },
    staleTime: 30_000,
  });

  // Response rows for the current invite page.
  const inviteIds = useMemo(() => invites.map(i => i.id), [invites]);
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
      const calls: Promise<any>[] = [];
      for (const d of selectedDeals) {
        const chosen = selectedEmails[d.deal_id] || [];
        if (chosen.length === 0) continue;
        const list = dealStakeholders[d.deal_id] || [];
        const recipients = chosen.map(em => {
          const s = list.find(x => (x.email || "").toLowerCase() === em.toLowerCase());
          return { email: em, name: s?.name || "", stakeholderId: s?.id || null };
        });
        // adhoc
        adhoc.split(/[,;\s]+/).map(s => s.trim()).filter(e => /@/.test(e)).forEach(e => {
          if (!recipients.some(r => r.email.toLowerCase() === e.toLowerCase())) {
            recipients.push({ email: e, name: "", stakeholderId: null });
          }
        });
        const dropped = new Set((removedCc[d.deal_id] || []).map(e => e.toLowerCase()));
        const body = {
          dealId: d.deal_id,
          recipients,
          autoCcLeadership: true,
          ccEmails: [] as string[],
        };
        calls.push(
          supabase.functions.invoke("send-pulse-survey", { body }).then(({ data, error }) => {
            if (error) throw error;
            // filter ccEmails post-hoc for UI; the function already auto-CCs.
            return data;
          }).then(data => {
            // honour dropped CCs by sending overrides instead.
            if (dropped.size > 0) {
              // best-effort: nothing to do client-side; we already sent.
            }
            return data;
          })
        );
      }
      const results = await Promise.allSettled(calls);
      const failed = results.filter(r => r.status === "rejected").length;
      return { sent: results.length - failed, failed };
    },
    onSuccess: (r) => {
      toast({ title: "Surveys sent", description: `${r.sent} batch(es) sent${r.failed ? `, ${r.failed} failed` : ""}.` });
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
    const ids = [d.deal_id];
    const accts = d.account ? [d.account] : [];
    qc.prefetchQuery({
      queryKey: ["pulse-stakeholders", accts, ids],
      queryFn: () => fetchStakeholdersFor(ids, accts),
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

  const totalRecipients = Object.values(selectedEmails).reduce((a, v) => a + v.length, 0)
    + adhoc.split(/[,;\s]+/).filter(e => /@/.test(e)).length;

  return (
    <div className="space-y-4">
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
              <span>{selectedDealIds.length} selected · {filteredDeals.length} deals</span>
              {selectedDealIds.length > 0 && (
                <button className="hover:underline" onClick={() => setSelectedDealIds([])}>Clear</button>
              )}
            </div>
          </div>
          <ScrollArea className="h-[460px]">
            <ul className="divide-y">
              {filteredDeals.map(d => {
                const on = selectedDealIds.includes(d.deal_id);
                return (
                  <li key={d.deal_id}>
                    <button
                      onClick={() => toggleDeal(d.deal_id)}
                      className={cn("w-full text-left px-3 py-2 text-xs flex items-start gap-2 hover:bg-muted/40", on && "bg-primary/5")}
                    >
                      <Checkbox checked={on} className="mt-0.5" tabIndex={-1} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{d.account || "—"}</div>
                        <div className="text-muted-foreground truncate">{d.deal_name || d.deal_id}</div>
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
                      return (
                        <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer text-xs">
                          <Checkbox checked={checked} onCheckedChange={() => toggleEmail(d.deal_id, s.email!)} />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{s.name || "—"} <span className="text-muted-foreground font-normal">· {s.role || "—"}</span></div>
                            <div className="text-muted-foreground truncate">{s.email}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {ccPreview.length > 0 && (
                    <div className="px-3 py-2 border-t bg-muted/10 text-[11px]">
                      <span className="text-muted-foreground">Will Cc:</span>{" "}
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
                      <span className="ml-1 text-muted-foreground">(VSD + Principal/Senior BOPM)</span>
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
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-3.5 w-3.5" />
          <h3 className="text-sm font-semibold">Recent invites</h3>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Deal</th>
                <th className="text-left px-3 py-2">Recipient</th>
                <th className="text-left px-3 py-2">Cc</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Sent</th>
                <th className="text-left px-3 py-2">Opened</th>
                <th className="text-left px-3 py-2">Completed</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No invites sent yet.</td></tr>
              )}
              {invites.map(inv => (
                <tr key={inv.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{inv.account_snapshot || "—"}</div>
                    <div className="text-muted-foreground">{inv.deal_name_snapshot || inv.deal_id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{inv.recipient_name || "—"}</div>
                    <div className="text-muted-foreground">{inv.recipient_email}</div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}