import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, ExternalLink, Plus, Mail, Phone, Linkedin, AlertTriangle, Users, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isStakeholderComplete, type Stakeholder } from "@/components/deals/orgmap/useStakeholders";
import { softDelete } from "@/lib/trash";
import { cn } from "@/lib/utils";

const FUNCTIONS = [
  "SEO Team", "Content Team", "Performance Marketing Team", "Corp Comm/PR Team",
  "Digital/Growth Marketing Team", "Brand Marketing Team", "Creative Team",
  "Marketing (No Specific Team)", "Overall Marketing",
] as const;
const SENIORITIES = ["C-Suite · CXO", "C-1 · VP", "C-2 · Director", "C-3 · Sr Mgr", "C-3 · Mgr", "C-4 · Lead", "Other"] as const;

export type ByDealDeal = {
  id: string;
  account: string;
  deal_name: string;
  vsd: string;
  bopm: string;
  region: string;
  deal_status: string;
  client_id: string | null;
};

interface Props {
  deals: ByDealDeal[];
  stakeholders: Stakeholder[];
  loading: boolean;
  canEdit: boolean;
  onChanged: () => void;
}

export function ByDealTab({ deals, stakeholders, loading, canEdit, onChanged }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("Active Deal");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const byDeal = useMemo(() => {
    const m = new Map<string, Stakeholder[]>();
    for (const s of stakeholders) {
      if (!s.deal_id) continue;
      const arr = m.get(s.deal_id) || [];
      arr.push(s);
      m.set(s.deal_id, arr);
    }
    return m;
  }, [stakeholders]);

  const statuses = useMemo(
    () => Array.from(new Set(deals.map(d => d.deal_status).filter(Boolean))).sort(),
    [deals],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return deals
      .filter(d => {
        if (statusF !== "all" && d.deal_status !== statusF) return false;
        const contacts = byDeal.get(d.id) || [];
        if (onlyMissing) {
          const anyIncomplete = contacts.some(c => !isStakeholderComplete(c));
          if (contacts.length > 0 && !anyIncomplete) return false;
        }
        if (!s) return true;
        return [d.account, d.deal_name, d.vsd, d.bopm, d.id].some(v => v?.toLowerCase().includes(s));
      });
  }, [deals, byDeal, q, statusF, onlyMissing]);

  const totals = useMemo(() => {
    let dealsMissing = 0, contactsIncomplete = 0, totalContacts = 0;
    for (const d of filtered) {
      const contacts = byDeal.get(d.id) || [];
      totalContacts += contacts.length;
      if (contacts.length === 0) dealsMissing++;
      contactsIncomplete += contacts.filter(c => !isStakeholderComplete(c)).length;
    }
    return { dealsMissing, contactsIncomplete, totalContacts };
  }, [filtered, byDeal]);

  const addContact = async (d: ByDealDeal) => {
    const existing = byDeal.get(d.id) || [];
    const sort = existing.length ? Math.max(...existing.map(s => s.sort_order)) + 1 : 0;
    const { error } = await supabase.from("deal_stakeholders").insert({
      deal_id: d.id,
      client_name: d.account || "",
      name: "",
      sort_order: sort,
    });
    if (error) { toast.error("Failed to add contact"); return; }
    toast.success("Contact added — fill in the details");
    setExpanded(prev => new Set(prev).add(d.id));
    onChanged();
  };

  return (
    <div className="space-y-4 mt-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search deal, client, VSD, BOPM…" className="pl-9 h-9" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={onlyMissing ? "default" : "outline"}
          onClick={() => setOnlyMissing(v => !v)}
          className="h-9"
        >
          <AlertTriangle className="h-4 w-4" />
          {onlyMissing ? "Showing incomplete only" : "Show incomplete only"}
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} deals · <span className="text-foreground font-medium">{totals.totalContacts}</span> contacts ·{" "}
          <span className="text-destructive font-medium">{totals.dealsMissing}</span> without contacts ·{" "}
          <span className="text-amber-600 dark:text-amber-400 font-medium">{totals.contactsIncomplete}</span> incomplete
        </div>
      </div>

      {loading && <div className="text-center text-sm text-muted-foreground py-10">Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-foreground font-medium">No deals match</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-2.5"></th>
                <th className="text-left px-3 py-2.5">Deal</th>
                <th className="text-left px-3 py-2.5">Client</th>
                <th className="text-left px-3 py-2.5">VSD</th>
                <th className="text-left px-3 py-2.5">BOPM</th>
                <th className="text-left px-3 py-2.5">Region</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Contacts</th>
                <th className="text-right px-3 py-2.5">Incomplete</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const contacts = byDeal.get(d.id) || [];
                const incomplete = contacts.filter(c => !isStakeholderComplete(c)).length;
                const noContacts = contacts.length === 0;
                const isOpen = expanded.has(d.id);
                return (
                  <Fragment key={d.id}>
                    <tr
                      onClick={() => toggle(d.id)}
                      className={cn(
                        "border-b border-border hover:bg-muted/30 transition-colors cursor-pointer",
                        noContacts && "bg-destructive/5",
                      )}
                    >
                      <td className="px-2 py-2.5 text-muted-foreground">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Link to={`/deals/${d.id}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1">
                          {d.deal_name || d.id} <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{d.account || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{d.vsd || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{d.bopm || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{d.region || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{d.deal_status || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {noContacts ? (
                          <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                            <AlertTriangle className="h-3 w-3" /> 0
                          </span>
                        ) : (
                          <span className="text-foreground">{contacts.length}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {incomplete > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">{incomplete}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => addContact(d)}>
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/10">
                        <td colSpan={10} className="p-0">
                          <ContactSubTable
                            deal={d}
                            contacts={contacts}
                            canEdit={canEdit}
                            onChanged={onChanged}
                            onAdd={() => addContact(d)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContactSubTable({ deal, contacts, canEdit, onChanged, onAdd }: {
  deal: ByDealDeal; contacts: Stakeholder[]; canEdit: boolean; onChanged: () => void; onAdd: () => void;
}) {
  if (contacts.length === 0) {
    return (
      <div className="px-6 py-6 border-t border-border text-sm text-muted-foreground flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        No contacts mapped for this deal yet.
        {canEdit && <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> Add contact</Button>}
      </div>
    );
  }
  return (
    <div className="border-t border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Name</th>
            <th className="text-left px-3 py-2">Designation</th>
            <th className="text-left px-3 py-2">Team</th>
            <th className="text-left px-3 py-2">Seniority</th>
            <th className="text-left px-3 py-2">Email</th>
            <th className="text-left px-3 py-2">Phone</th>
            <th className="text-left px-3 py-2">LinkedIn</th>
            <th className="text-left px-3 py-2">City</th>
            <th className="text-left px-3 py-2">Influence</th>
            <th className="text-left px-3 py-2">Status</th>
            {canEdit && <th className="px-2 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {contacts.map(c => (
            <ContactRow key={c.id} contact={c} canEdit={canEdit} onChanged={onChanged} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactRow({ contact, canEdit, onChanged }: { contact: Stakeholder; canEdit: boolean; onChanged: () => void }) {
  const complete = isStakeholderComplete(contact);
  const save = async (patch: Partial<Stakeholder>) => {
    const { error } = await supabase.from("deal_stakeholders").update(patch).eq("id", contact.id);
    if (error) { toast.error("Save failed"); return; }
    onChanged();
  };
  const remove = async () => {
    const ok = await softDelete("deal_stakeholder", contact.id);
    if (!ok) { toast.error("Delete failed"); return; }
    toast.success("Moved to Trash");
    onChanged();
  };
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/20">
      <td className="px-3 py-1.5 min-w-[160px]">
        {canEdit ? (
          <EditableText value={contact.name} placeholder="Name" onSave={v => save({ name: v })} />
        ) : <span>{contact.name || "—"}</span>}
      </td>
      <td className="px-3 py-1.5 min-w-[160px]">
        {canEdit ? <EditableText value={contact.role} placeholder="Designation" onSave={v => save({ role: v })} /> : <span>{contact.role || "—"}</span>}
      </td>
      <td className="px-3 py-1.5 min-w-[180px]">
        {canEdit ? (
          <Select value={contact.function || ""} onValueChange={v => save({ function: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{FUNCTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        ) : <span>{contact.function || "—"}</span>}
      </td>
      <td className="px-3 py-1.5 min-w-[140px]">
        {canEdit ? (
          <Select value={contact.seniority || ""} onValueChange={v => save({ seniority: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{SENIORITIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        ) : <span>{contact.seniority || "—"}</span>}
      </td>
      <td className="px-3 py-1.5 min-w-[200px]">
        {canEdit ? <EditableText value={contact.email} placeholder="name@company.com" onSave={v => save({ email: v })} /> : (
          contact.email ? <a href={`mailto:${contact.email}`} className="text-primary hover:underline inline-flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</a> : <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-1.5 min-w-[140px]">
        {canEdit ? <EditableText value={contact.phone} placeholder="Phone" onSave={v => save({ phone: v })} /> : (
          contact.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span> : <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-1.5 min-w-[200px]">
        {canEdit ? <EditableText value={contact.linkedin_url} placeholder="linkedin.com/in/…" onSave={v => save({ linkedin_url: v })} /> : (
          contact.linkedin_url ? <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><Linkedin className="h-3 w-3" /> Profile</a> : <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-1.5 min-w-[120px]">
        {canEdit ? <EditableText value={contact.city} placeholder="City" onSave={v => save({ city: v })} /> : <span>{contact.city || "—"}</span>}
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-0.5">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              disabled={!canEdit}
              onClick={() => save({ decision_power: n === contact.decision_power ? 0 : n })}
              className={cn("h-1.5 w-1.5 rounded-full", n <= contact.decision_power ? "bg-primary" : "bg-muted", canEdit && "hover:opacity-80")}
            />
          ))}
        </div>
      </td>
      <td className="px-3 py-1.5">
        {complete ? (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Complete</span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">Incomplete</span>
        )}
      </td>
      {canEdit && (
        <td className="px-2 py-1.5 text-right">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      )}
    </tr>
  );
}

function EditableText({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value || "");
  return (
    <Input
      value={v}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== (value || "")) onSave(v); }}
      className="h-8 text-xs"
    />
  );
}