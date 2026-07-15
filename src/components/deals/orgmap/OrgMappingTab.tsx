import { useMemo, useState } from "react";
import { Plus, Search, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useStakeholders } from "./useStakeholders";
import { StakeholderList, FUNCTIONS } from "./StakeholderList";

export function OrgMappingTab({ dealId, clientName }: { dealId: string; clientName: string }) {
  const { data, loading, lastSavedAt, add, update, remove, duplicate } = useStakeholders(dealId, clientName);
  const [search, setSearch] = useState("");
  const [fnFilter, setFnFilter] = useState<string>("all");
  const [powerFilter, setPowerFilter] = useState<string>("all");

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
    await add();
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
      <StakeholderList
        stakeholders={filtered}
        loading={loading}
        emptyText={data.length === 0 ? "No stakeholders mapped yet" : "No matches for this filter"}
        addLabel="Add another person"
        onAdd={handleAdd}
        onUpdate={(id, patch) => update(id, patch)}
        onDuplicate={(id) => duplicate(id)}
        onDelete={(id) => remove(id)}
      />
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
