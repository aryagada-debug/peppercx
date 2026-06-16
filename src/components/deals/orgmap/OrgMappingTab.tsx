import { useMemo, useState } from "react";
import { Plus, Search, Filter, Download, ChevronRight, MoreHorizontal, Mail, Phone, Linkedin, Copy, Trash2, Users, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useStakeholders, type Stakeholder } from "./useStakeholders";

const FUNCTIONS = [
  "SEO Team",
  "Content Team",
  "Performance Marketing Team",
  "Corp Comm/PR Team",
  "Digital/Growth Marketing Team",
  "Brand Marketing Team",
  "Creative Team",
  "Marketing (No Specific Team)",
  "Overall Marketing",
] as const;
const SENIORITIES = ["C-Suite · CXO", "C-1 · VP", "C-2 · Director", "C-3 · Sr Mgr", "C-3 · Mgr", "C-4 · Lead", "Other"] as const;

function isStakeholderComplete(s: { name: string; role: string; email: string; linkedin_url: string; function: string; seniority: string; city: string }) {
  return !!(s.name?.trim() && s.role?.trim() && s.email?.trim() && s.linkedin_url?.trim() && s.function?.trim() && s.seniority?.trim() && s.city?.trim()
    && s.name.trim().toLowerCase() !== "new stakeholder");
}

const FUNCTION_DOT: Record<string, string> = {
  "SEO Team": "bg-primary",
  "Content Team": "bg-emerald-500",
  "Performance Marketing Team": "bg-blue-500",
  "Corp Comm/PR Team": "bg-orange-600",
  "Digital/Growth Marketing Team": "bg-amber-500",
  "Brand Marketing Team": "bg-rose-500",
  "Creative Team": "bg-purple-500",
  "Marketing (No Specific Team)": "bg-muted-foreground/60",
  "Overall Marketing": "bg-muted-foreground",
};

const TAG_STYLES: Record<string, string> = {
  SPOC: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Champion: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "Not met": "bg-muted text-muted-foreground",
};

const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-muted text-foreground",
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "??";
}
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function OrgMappingTab({ dealId, clientName }: { dealId: string; clientName: string }) {
  const { data, loading, lastSavedAt, add, update, remove, duplicate } = useStakeholders(dealId, clientName);
  const [search, setSearch] = useState("");
  const [fnFilter, setFnFilter] = useState<string>("all");
  const [powerFilter, setPowerFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Stakeholder | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(s => {
      if (fnFilter !== "all" && s.function !== fnFilter) return false;
      if (powerFilter !== "all" && String(s.decision_power) !== powerFilter) return false;
      if (!q) return true;
      return [s.name, s.role, s.email, s.phone].some(v => v?.toLowerCase().includes(q));
    });
  }, [data, search, fnFilter, powerFilter]);

  const stats = useMemo(() => {
    const functions = new Set(data.map(d => d.function).filter(Boolean));
    const spocs = data.filter(d => d.tags.includes("SPOC")).length;
    const notMet = data.filter(d => d.tags.includes("Not met")).length;
    return { total: data.length, functions: functions.size, spocs, notMet };
  }, [data]);

  const handleAdd = async () => {
    const created = await add();
    if (created) setOpenId(created.id);
  };

  const exportCsv = () => {
    const header = ["Name", "Role", "Function", "Seniority", "Email", "Phone", "LinkedIn", "Decision power", "Tags", "Notes"];
    const rows = filtered.map(s => [s.name, s.role, s.function, s.seniority, s.email, s.phone, s.linkedin_url, s.decision_power, s.tags.join("|"), s.notes.replace(/\n/g, " ")]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `org-map-${clientName || dealId}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Org map · {clientName || "Deal"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} stakeholder{stats.total === 1 ? "" : "s"} mapped
            {lastSavedAt && (
              <>
                {" · last updated "}{formatDistanceToNow(new Date(lastSavedAt), { addSuffix: true })}
                <span className="ml-3 inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All saved
                </span>
              </>
            )}
          </p>
        </div>
        <Button onClick={handleAdd} size="sm"><Plus className="h-4 w-4" /> Add person</Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, email…" className="pl-9 h-9" />
        </div>
        <Select value={fnFilter} onValueChange={setFnFilter}>
          <SelectTrigger className="h-9 w-[170px]"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="All functions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All functions</SelectItem>
            {FUNCTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={powerFilter} onValueChange={setPowerFilter}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All power levels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All power levels</SelectItem>
            {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} of 5</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv} className="h-9"><Download className="h-4 w-4" /> Export</Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-10 gap-y-3 rounded-lg border border-border bg-card px-5 py-4">
        <Stat label="Total stakeholders" value={stats.total} />
        <Stat label="Functions covered" value={stats.functions} />
        <Stat label="SPOCs" value={stats.spocs} />
        <Stat label="Not yet met" value={stats.notMet} tone={stats.notMet > 0 ? "warn" : undefined} />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[36px_1.6fr_1.1fr_140px_120px_110px_40px] gap-3 px-4 py-3 bg-muted/40 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div></div>
          <div>Name &amp; role</div>
          <div>Contact</div>
          <div>Function</div>
          <div>Seniority</div>
          <div>Power</div>
          <div className="text-center"></div>
        </div>

        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading stakeholders…</div>}
        {!loading && filtered.length === 0 && (
          <div className="p-10 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-foreground font-medium">{data.length === 0 ? "No stakeholders mapped yet" : "No matches for this filter"}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.length === 0 ? "Map the people you interact with at this client." : "Try a different search or filter."}</p>
          </div>
        )}

        {filtered.map(s => (
          <Row
            key={s.id}
            stakeholder={s}
            isOpen={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onUpdate={(patch) => update(s.id, patch)}
            onDuplicate={() => duplicate(s.id)}
            onAskDelete={() => setConfirmDelete(s)}
          />
        ))}

        <button onClick={handleAdd} className="w-full flex items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted/30 border-t border-border transition-colors">
          <Plus className="h-4 w-4" /> Add another person
        </button>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove stakeholder?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove {confirmDelete?.name || "this person"} from the org map.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) remove(confirmDelete.id); setConfirmDelete(null); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("text-2xl font-semibold tabular-nums leading-none", tone === "warn" && value > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Row({ stakeholder: s, isOpen, onToggle, onUpdate, onDuplicate, onAskDelete }: {
  stakeholder: Stakeholder; isOpen: boolean; onToggle: () => void;
  onUpdate: (patch: Partial<Stakeholder>) => void;
  onDuplicate: () => void; onAskDelete: () => void;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div
        onClick={onToggle}
        className={cn("grid md:grid-cols-[36px_1.6fr_1.1fr_140px_120px_110px_40px] grid-cols-[28px_1fr_40px] gap-3 px-4 py-3 items-center cursor-pointer transition-colors",
          isOpen ? "bg-primary/5" : "hover:bg-muted/30")}
      >
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90 text-primary")} />

        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0", avatarColor(s.id))}>{initials(s.name || "?")}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate">{s.name || "Untitled"}</span>
              {!isStakeholderComplete(s) && (
                <span className="text-[9px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Incomplete
                </span>
              )}
              {s.tags.slice(0, 2).map(t => (
                <span key={t} className={cn("text-[9px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded-full", TAG_STYLES[t] ?? "bg-muted text-muted-foreground")}>{t}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{s.role || "—"}</p>
          </div>
        </div>

        <div className="hidden md:flex flex-col gap-0.5 text-xs text-muted-foreground min-w-0">
          <span className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" />{s.email || <span className="italic opacity-70">No email</span>}</span>
          <span className="flex items-center gap-1.5 truncate"><Phone className="h-3 w-3 shrink-0" />{s.phone || <span className="italic opacity-70">No phone</span>}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className={cn("h-2 w-2 rounded-full", FUNCTION_DOT[s.function] || "bg-muted-foreground/40")} />
          <span className="text-foreground">{s.function || "—"}</span>
        </div>

        <div className="hidden md:block text-xs text-muted-foreground">{s.seniority || "—"}</div>

        <div className="hidden md:flex items-center gap-1">
          {[1,2,3,4,5].map(n => (
            <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= s.decision_power ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
              {s.email && <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(s.email); toast.success("Email copied"); }}><Mail className="h-3.5 w-3.5 mr-2" /> Copy email</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onAskDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete person</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isOpen && <DetailPanel stakeholder={s} onUpdate={onUpdate} onDuplicate={onDuplicate} onAskDelete={onAskDelete} />}
    </div>
  );
}

function DetailPanel({ stakeholder: s, onUpdate, onDuplicate, onAskDelete }: {
  stakeholder: Stakeholder;
  onUpdate: (patch: Partial<Stakeholder>) => void;
  onDuplicate: () => void; onAskDelete: () => void;
}) {
  const [name, setName] = useState(s.name);
  const [role, setRole] = useState(s.role);
  const [email, setEmail] = useState(s.email);
  const [phone, setPhone] = useState(s.phone);
  const [linkedin, setLinkedin] = useState(s.linkedin_url);
  const [notes, setNotes] = useState(s.notes);
  const [newTag, setNewTag] = useState("");

  const removeTag = (t: string) => onUpdate({ tags: s.tags.filter(x => x !== t) });
  const addTag = () => {
    const v = newTag.trim();
    if (!v || s.tags.includes(v)) return;
    onUpdate({ tags: [...s.tags, v] });
    setNewTag("");
  };

  return (
    <div className="px-4 pb-4 bg-muted/20">
      <div className="rounded-lg border border-border bg-card p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left col */}
        <div className="space-y-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identity & contact</h4>

          <Field label="Name" required error={!name.trim() ? "Required" : undefined}>
            <Input value={name} onChange={e => setName(e.target.value)} onBlur={() => {
              if (!name.trim()) { setName(s.name); return; }
              if (name !== s.name) onUpdate({ name });
            }} />
          </Field>
          <Field label="Role / title" required error={!role.trim() ? "Required" : undefined}>
            <Input value={role} onChange={e => setRole(e.target.value)} onBlur={() => {
              if (!role.trim()) { setRole(s.role); return; }
              if (role !== s.role) onUpdate({ role });
            }} />
          </Field>
          <Field label="Email" icon={<Mail className="h-3 w-3" />} required error={!email.trim() ? "Required" : undefined}>
            <Input value={email} onChange={e => setEmail(e.target.value)} onBlur={() => {
              if (!email.trim()) { setEmail(s.email); return; }
              if (email !== s.email) onUpdate({ email });
            }} placeholder="name@company.com" />
          </Field>
          <Field label="Phone" icon={<Phone className="h-3 w-3" />}>
            <Input value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => phone !== s.phone && onUpdate({ phone })} placeholder="+91 …" />
          </Field>
          <Field label="LinkedIn" icon={<Linkedin className="h-3 w-3" />} required error={!linkedin.trim() ? "Required" : undefined}>
            <Input value={linkedin} onChange={e => setLinkedin(e.target.value)} onBlur={() => {
              if (!linkedin.trim()) { setLinkedin(s.linkedin_url); return; }
              if (linkedin !== s.linkedin_url) onUpdate({ linkedin_url: linkedin });
            }} placeholder="https://linkedin.com/in/…" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Function" required error={!s.function ? "Required" : undefined}>
              <Select value={s.function || ""} onValueChange={(v) => onUpdate({ function: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{FUNCTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Seniority" required error={!s.seniority ? "Required" : undefined}>
              <Select value={s.seniority || ""} onValueChange={(v) => onUpdate({ seniority: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SENIORITIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Decision power">
            <div className="flex items-center gap-2 px-2 py-2 rounded-md border border-input bg-background">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => onUpdate({ decision_power: n === s.decision_power ? 0 : n })}
                  className={cn("h-3 w-3 rounded-full transition-colors", n <= s.decision_power ? "bg-primary" : "bg-muted hover:bg-primary/30")} />
              ))}
              <span className="ml-auto text-xs text-muted-foreground">{s.decision_power} of 5</span>
            </div>
          </Field>
        </div>

        {/* Right col */}
        <div className="space-y-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tags & notes</h4>

          <Field label="Tags">
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-md border border-input bg-background min-h-[40px]">
              {s.tags.map(t => (
                <span key={t} className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full", TAG_STYLES[t] ?? "bg-muted text-foreground")}>
                  {t}
                  <button onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted">
                    <Plus className="h-3 w-3" /> Add tag
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {["SPOC", "Champion", "Not met", "Blocker", "Influencer"].filter(t => !s.tags.includes(t)).map(t => (
                      <button key={t} onClick={() => onUpdate({ tags: [...s.tags, t] })}
                        className={cn("text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full", TAG_STYLES[t] ?? "bg-muted text-foreground")}>{t}</button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTag(); }} placeholder="Custom tag" className="h-8 text-xs" />
                    <Button size="sm" className="h-8" onClick={addTag}>Add</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </Field>

          <Field label="Notes">
            <Textarea rows={8} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== s.notes && onUpdate({ notes })}
              placeholder="Context, preferences, history…" />
          </Field>
        </div>

        <div className="md:col-span-2 flex items-center justify-between pt-3 border-t border-border">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
            {s.email && <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(s.email); toast.success("Email copied"); }}><Mail className="h-3.5 w-3.5" /> Copy email</Button>}
          </div>
          <Button variant="ghost" size="sm" onClick={onAskDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Delete person</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children, required, error }: { label: string; icon?: React.ReactNode; children: React.ReactNode; required?: boolean; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}{label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}