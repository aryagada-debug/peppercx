import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, ExternalLink, AlertTriangle, Users, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { softDelete } from "@/lib/trash";
import { StakeholderList } from "@/components/deals/orgmap/StakeholderList";
import { isStakeholderComplete, type Stakeholder } from "@/components/deals/orgmap/useStakeholders";

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

type SortKey = "account" | "deal_name" | "vsd" | "bopm" | "region" | "deal_status" | "contacts" | "incomplete";

interface Props {
  deals: ByDealDeal[];
  stakeholders: Stakeholder[];
  loading: boolean;
  canEdit: boolean;
  onChanged: () => void;
  /** Global filters — applied here for consistency across tabs. */
  search: string;
  vsdF: string;
  bopmF: string;
  statusF: string;
  onlyMissing: boolean;
}

export function ByDealTab({ deals, stakeholders, loading, canEdit, onChanged, search, vsdF, bopmF, statusF, onlyMissing }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "account", dir: "asc" });

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
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [stakeholders]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const bopmLc = bopmF.toLowerCase();
    const list = deals.filter(d => {
      if (statusF !== "all" && d.deal_status !== statusF) return false;
      if (vsdF !== "all" && d.vsd !== vsdF) return false;
      if (bopmF !== "all" && !d.bopm.toLowerCase().split(",").map(x => x.trim()).includes(bopmLc)) return false;
      const contacts = byDeal.get(d.id) || [];
      if (onlyMissing) {
        const anyIncomplete = contacts.some(c => !isStakeholderComplete(c));
        if (contacts.length > 0 && !anyIncomplete) return false;
      }
      if (!s) return true;
      return [d.account, d.deal_name, d.vsd, d.bopm, d.id].some(v => v?.toLowerCase().includes(s));
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const key = sort.key;
      if (key === "contacts") return ((byDeal.get(a.id)?.length || 0) - (byDeal.get(b.id)?.length || 0)) * dir;
      if (key === "incomplete") {
        const ai = (byDeal.get(a.id) || []).filter(c => !isStakeholderComplete(c)).length;
        const bi = (byDeal.get(b.id) || []).filter(c => !isStakeholderComplete(c)).length;
        return (ai - bi) * dir;
      }
      return String((a as any)[key] || "").localeCompare(String((b as any)[key] || "")) * dir;
    });
  }, [deals, byDeal, search, vsdF, bopmF, statusF, onlyMissing, sort]);

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
    const sortOrder = existing.length ? Math.max(...existing.map(s => s.sort_order)) + 1 : 0;
    const { error } = await supabase.from("deal_stakeholders").insert({
      deal_id: d.id, client_name: d.account || "", name: "", sort_order: sortOrder,
    });
    if (error) { toast.error("Failed to add contact"); return; }
    setExpanded(prev => new Set(prev).add(d.id));
    onChanged();
  };

  const updateContact = async (id: string, patch: Partial<Stakeholder>) => {
    const { error } = await supabase.from("deal_stakeholders").update(patch).eq("id", id);
    if (error) { toast.error("Save failed"); return; }
    onChanged();
  };

  const duplicateContact = async (id: string) => {
    const src = stakeholders.find(s => s.id === id);
    if (!src) return;
    const { id: _i, updated_at: _u, ...rest } = src;
    const existing = byDeal.get(src.deal_id) || [];
    const sortOrder = existing.length ? Math.max(...existing.map(s => s.sort_order)) + 1 : 0;
    const { error } = await supabase.from("deal_stakeholders").insert({
      ...rest, name: `${src.name} (copy)`, sort_order: sortOrder,
    });
    if (error) { toast.error("Duplicate failed"); return; }
    onChanged();
  };

  const deleteContact = async (id: string) => {
    const ok = await softDelete("deal_stakeholder", id);
    if (!ok) { toast.error("Delete failed"); return; }
    toast.success("Moved to Trash");
    onChanged();
  };

  return (
    <div className="space-y-3 mt-0">
      <div className="text-xs text-muted-foreground">
        {filtered.length} deals · <span className="text-foreground font-medium">{totals.totalContacts}</span> contacts ·{" "}
        <span className="text-destructive font-medium">{totals.dealsMissing}</span> without contacts ·{" "}
        <span className="text-amber-600 dark:text-amber-400 font-medium">{totals.contactsIncomplete}</span> incomplete
      </div>

      {loading && <div className="text-center text-sm text-muted-foreground py-10">Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-foreground font-medium">No deals match your filters</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-260px)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 backdrop-blur border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="w-8 px-2 py-2.5"></th>
                  <SortTh label="Client" k="account" sort={sort} onSort={setSort} />
                  <SortTh label="Deal" k="deal_name" sort={sort} onSort={setSort} />
                  <SortTh label="VSD" k="vsd" sort={sort} onSort={setSort} />
                  <SortTh label="BOPM" k="bopm" sort={sort} onSort={setSort} />
                  <SortTh label="Region" k="region" sort={sort} onSort={setSort} />
                  <SortTh label="Status" k="deal_status" sort={sort} onSort={setSort} />
                  <SortTh label="Contacts" k="contacts" sort={sort} onSort={setSort} align="right" />
                  <SortTh label="Incomplete" k="incomplete" sort={sort} onSort={setSort} align="right" />
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
                          noContacts && !isOpen && "bg-destructive/5",
                          isOpen && "bg-primary/5",
                        )}
                      >
                        <td className="px-2 py-2.5 text-muted-foreground align-middle">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap max-w-[240px] truncate">
                          {d.account || "—"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap max-w-[260px] truncate">
                          <Link to={`/deals/${d.id}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1">
                            {d.deal_name || d.id} <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap max-w-[180px] truncate">{d.vsd || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground max-w-[220px] truncate">{d.bopm || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{d.region || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{d.deal_status || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {noContacts ? (
                            <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                              <AlertTriangle className="h-3 w-3" /> 0
                            </span>
                          ) : (
                            <span className="text-foreground">{contacts.length}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {incomplete > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">{incomplete}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/10">
                          <td colSpan={9} className="p-0">
                            <div className="px-4 py-4 border-t border-border">
                              <StakeholderList
                                stakeholders={contacts}
                                loading={false}
                                emptyText="No contacts mapped for this deal yet"
                                addLabel="Add contact"
                                onAdd={() => addContact(d)}
                                onUpdate={updateContact}
                                onDuplicate={duplicateContact}
                                onDelete={deleteContact}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SortTh({ label, k, sort, onSort, align = "left" }: {
  label: string; k: SortKey; sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (s: { key: SortKey; dir: "asc" | "desc" }) => void; align?: "left" | "right";
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-2.5 select-none", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onSort(active ? { key: k, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" })}
        className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors", active && "text-foreground")}
      >
        <span>{label}</span>
        <Icon className={cn("h-3 w-3", !active && "opacity-50")} />
      </button>
    </th>
  );
}