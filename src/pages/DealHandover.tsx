import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Plus, Trash2, ClipboardCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { sendAppEmail } from "@/lib/appEmail";
import { AppLayout } from "@/components/layout/AppLayout";
import { HandoverWizard } from "@/components/handover/HandoverWizard";
import { VSD_OPTIONS } from "@/components/handover/constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Contact = { name: string; role: string; email: string; phone: string };

interface HandoverRow {
  id: string;
  submitter_user_id: string | null;
  sp_name: string;
  sp_email: string;
  sp_team: string;
  handover_date: string | null;
  company_name: string;
  industry: string;
  website: string;
  sow_url: string;
  strategy_deck_url: string;
  keywords_url: string;
  geo_audit_url: string;
  fireflies_url: string;
  docs_notes: string;
  stage: string;
  bu: string;
  capability: string;
  deal_type: string;
  mrr: number | null;
  total_amount: number | null;
  duration_months: number | null;
  start_date: string | null;
  vsd_suggested: string;
  deal_notes: string;
  contacts: Contact[];
  deal_id: string | null;
  deal_name: string | null;
  vsd_confirmed: string | null;
  status: string;
  created_deal_id: string | null;
  created_at: string;
}

const HANDOVER_LEADS = [
  "arya.gada@peppercontent.io",
  "anirudh@peppercontent.io",
  "priyanka.sharma@peppercontent.io",
];


function StatusBadge({ row }: { row: HandoverRow }) {
  if (row.status === "created") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Created</Badge>;
  const haveDealId = !!(row.deal_id && row.deal_name);
  const haveVsd = !!row.vsd_confirmed;
  if (haveDealId && haveVsd) return <Badge variant="secondary">Processing</Badge>;
  if (haveDealId || haveVsd) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">In progress</Badge>;
  return <Badge variant="outline">Submitted</Badge>;
}

function StaffingBadge({ row, staffingMap }: { row: HandoverRow; staffingMap: Record<string, { locked: boolean }> }) {
  if (row.status !== "created" || !row.created_deal_id) {
    return <Badge variant="outline">Open</Badge>;
  }
  const info = staffingMap[row.created_deal_id];
  if (info?.locked) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Staffed</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Staffing pending</Badge>;
}

export default function DealHandover() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const userEmail = (user?.email || "").toLowerCase();
  const isLead = HANDOVER_LEADS.includes(userEmail);
  const canEditDealId = isAdmin || userEmail === "priyanka.sharma@peppercontent.io";
  const canEditVsd = isAdmin || userEmail === "anirudh@peppercontent.io";

  const [tab, setTab] = useState("submit");
  const [rows, setRows] = useState<HandoverRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [open, setOpen] = useState<HandoverRow | null>(null);
  const [staffingMap, setStaffingMap] = useState<Record<string, { locked: boolean }>>({});
  const loadRows = async () => {
    setLoadingRows(true);
    const { data, error } = await supabase
      .from("deal_handovers" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load handovers", description: error.message, variant: "destructive" });
    } else {
      const mapped = (data as any[]).map((r) => ({ ...r, contacts: Array.isArray(r.contacts) ? r.contacts : [] }));
      setRows(mapped);
      const dealIds = Array.from(new Set(mapped.map((r) => r.created_deal_id).filter(Boolean))) as string[];
      if (dealIds.length) {
        const { data: sd } = await supabase
          .from("staffing_deals")
          .select("id, staffing_locked_at")
          .in("id", dealIds);
        const m: Record<string, { locked: boolean }> = {};
        (sd || []).forEach((d: any) => { m[d.id] = { locked: !!d.staffing_locked_at }; });
        setStaffingMap(m);
      } else {
        setStaffingMap({});
      }
    }
    setLoadingRows(false);
  };
  useEffect(() => {
    loadRows();
  }, []);
  const saveLeadUpdate = async (row: HandoverRow, patch: Partial<HandoverRow>) => {
    const stamped: any = { ...patch };
    if (patch.deal_id !== undefined || patch.deal_name !== undefined) {
      stamped.deal_id_filled_at = new Date().toISOString();
      stamped.deal_id_filled_by = user?.id || null;
    }
    if (patch.vsd_confirmed !== undefined) {
      stamped.vsd_filled_at = new Date().toISOString();
      stamped.vsd_filled_by = user?.id || null;
    }
    const { data, error } = await supabase
      .from("deal_handovers" as any)
      .update(stamped)
      .eq("id", row.id)
      .select()
      .single();
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    const updated = { ...(data as any), contacts: Array.isArray((data as any).contacts) ? (data as any).contacts : [] } as HandoverRow;
    setRows((rs) => rs.map((r) => (r.id === row.id ? updated : r)));
    setOpen(updated);
    // Notify next-in-line
    const nextRecipients: string[] = [];
    if (patch.deal_id !== undefined || patch.deal_name !== undefined) nextRecipients.push("anirudh@peppercontent.io");
    if (patch.vsd_confirmed !== undefined) nextRecipients.push("priyanka.sharma@peppercontent.io");
    if (updated.status === "created") nextRecipients.push(...HANDOVER_LEADS);
    if (nextRecipients.length) {
      sendAppEmail({
        event: "test",
        recipients: Array.from(new Set(nextRecipients)),
        payload: {
          kind: updated.status === "created" ? "handover_completed" : "handover_partial",
          company: updated.company_name,
          deal_id: updated.deal_id,
          deal_name: updated.deal_name,
          vsd: updated.vsd_confirmed,
        },
      });
    }
    toast({ title: "Saved", description: updated.status === "created" ? "Deal created in Clients & Deals." : "Updated." });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Deal Handover</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Sales fills the handover form. Priyanka adds Deal ID + Deal Name; Anirudh adds the VSD. Once both are filled the deal
          is auto-created in Clients & Deals.
        </p>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="submit">Submit handover</TabsTrigger>
            <TabsTrigger value="queue">Queue ({rows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-4">
            <HandoverWizard onSubmitted={() => { setTab("queue"); loadRows(); }} />
          </TabsContent>

          <TabsContent value="queue" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Deal ID</TableHead>
                    <TableHead>VSD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Staffing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRows ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No handovers yet.</TableCell></TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(r)}>
                        <TableCell className="font-medium">{r.company_name}</TableCell>
                        <TableCell className="text-sm">{r.sp_name || r.sp_email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">
                          {r.deal_id ? <span className="font-mono">{r.deal_id}</span> : <Badge variant="outline" className="text-amber-700 border-amber-300">Pending</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.vsd_confirmed ? r.vsd_confirmed : <Badge variant="outline" className="text-amber-700 border-amber-300">Pending</Badge>}
                        </TableCell>
                        <TableCell><StatusBadge row={r} /></TableCell>
                        <TableCell><StaffingBadge row={r} staffingMap={staffingMap} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <HandoverDrawer
          row={open}
          onClose={() => setOpen(null)}
          canEditDealId={canEditDealId}
          canEditVsd={canEditVsd}
          onSave={saveLeadUpdate}
        />
      </div>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}

function HandoverDrawer({
  row, onClose, canEditDealId, canEditVsd, onSave,
}: {
  row: HandoverRow | null;
  onClose: () => void;
  canEditDealId: boolean;
  canEditVsd: boolean;
  onSave: (row: HandoverRow, patch: Partial<HandoverRow>) => Promise<void>;
}) {
  const [dealId, setDealId] = useState("");
  const [dealName, setDealName] = useState("");
  const [vsd, setVsd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDealId(row?.deal_id || "");
    setDealName(row?.deal_name || "");
    setVsd(row?.vsd_confirmed || "");
  }, [row?.id]); // eslint-disable-line

  if (!row) return null;

  const saveDealId = async () => {
    if (!dealId.trim() || !dealName.trim()) {
      toast({ title: "Add both Deal ID and Deal Name", variant: "destructive" });
      return;
    }
    setSaving(true);
    await onSave(row, { deal_id: dealId.trim(), deal_name: dealName.trim() });
    setSaving(false);
  };
  const saveVsd = async () => {
    if (!vsd.trim()) return;
    setSaving(true);
    await onSave(row, { vsd_confirmed: vsd.trim() });
    setSaving(false);
  };

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {row.company_name} <StatusBadge row={row} />
          </SheetTitle>
        </SheetHeader>

        {row.status === "created" && row.created_deal_id && (
          <div className="mt-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-3 py-2 text-sm flex items-center justify-between gap-2">
            <span>Deal created in Clients &amp; Deals.</span>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/deals/${encodeURIComponent(row.created_deal_id)}`}><ExternalLink className="h-3 w-3 mr-1" /> Open deal</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/staffing?tab=staffing&deal=${encodeURIComponent(row.created_deal_id)}`}><ExternalLink className="h-3 w-3 mr-1" /> Open in Staffing</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <Card className="p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Priyanka — Deal ID & Name</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Deal ID</Label>
                <Input value={dealId} onChange={(e) => setDealId(e.target.value)} disabled={!canEditDealId || row.status === "created"} placeholder="e.g. D-2026-001" />
              </div>
              <div>
                <Label className="text-xs">Deal Name</Label>
                <Input value={dealName} onChange={(e) => setDealName(e.target.value)} disabled={!canEditDealId || row.status === "created"} placeholder="e.g. HDFC — SEO Retainer" />
              </div>
            </div>
            {canEditDealId && row.status !== "created" && (
              <div className="flex justify-end">
                <Button size="sm" onClick={saveDealId} disabled={saving}>Save Deal ID</Button>
              </div>
            )}
            {!canEditDealId && (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Only Priyanka / admin can edit.</p>
            )}
          </Card>

          <Card className="p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Anirudh — Confirmed VSD</h3>
            <Select value={vsd} onValueChange={setVsd} disabled={!canEditVsd || row.status === "created"}>
              <SelectTrigger><SelectValue placeholder="Select VSD" /></SelectTrigger>
              <SelectContent>
                {VSD_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            {canEditVsd && row.status !== "created" && (
              <div className="flex justify-end">
                <Button size="sm" onClick={saveVsd} disabled={saving}>Save VSD</Button>
              </div>
            )}
            {!canEditVsd && (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Only Anirudh / admin can edit.</p>
            )}
          </Card>

          <Card className="p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Submitted details</h3>
            <DL k="Submitted by" v={`${row.sp_name} <${row.sp_email}>`} />
            <DL k="Team" v={row.sp_team} />
            <DL k="Handover date" v={row.handover_date || ""} />
            <DL k="Company" v={row.company_name} />
            <DL k="Industry" v={row.industry} />
            <DL k="Website" v={row.website} />
            <DL k="Stage" v={row.stage} />
            <DL k="BU / Capability" v={[row.bu, row.capability].filter(Boolean).join(" / ")} />
            <DL k="Deal type" v={row.deal_type} />
            <DL k="MRR" v={row.mrr ? String(row.mrr) : ""} />
            <DL k="Total amount" v={row.total_amount ? String(row.total_amount) : ""} />
            <DL k="Duration" v={row.duration_months ? `${row.duration_months} months` : ""} />
            <DL k="Start date" v={row.start_date || ""} />
            <DL k="Notes" v={row.deal_notes} />
          </Card>

          <Card className="p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Documents</h3>
            <LinkRow label="SoW" url={row.sow_url} />
            <LinkRow label="Strategy deck" url={row.strategy_deck_url} />
            <LinkRow label="Keywords" url={row.keywords_url} />
            <LinkRow label="GEO audit" url={row.geo_audit_url} />
            <LinkRow label="Fireflies" url={row.fireflies_url} />
            {row.docs_notes && <p className="text-sm text-muted-foreground">{row.docs_notes}</p>}
          </Card>

          <Card className="p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Contacts</h3>
            {(row.contacts || []).length === 0 && <p className="text-xs text-muted-foreground">None</p>}
            {(row.contacts || []).map((c, i) => (
              <div key={i} className="text-sm border-b last:border-0 pb-1">
                <div className="font-medium">{c.name}{c.role && <span className="text-muted-foreground"> — {c.role}</span>}</div>
                <div className="text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</div>
              </div>
            ))}
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
function DL({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex text-sm gap-2">
      <span className="text-muted-foreground w-32 flex-shrink-0">{k}</span>
      <span className="flex-1 break-words">{v}</span>
    </div>
  );
}
function LinkRow({ label, url }: { label: string; url: string }) {
  if (!url) return null;
  return (
    <div className="flex text-sm gap-2 items-center">
      <span className="text-muted-foreground w-32 flex-shrink-0">{label}</span>
      <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
        <ExternalLink className="h-3 w-3" /> {url}
      </a>
    </div>
  );
}