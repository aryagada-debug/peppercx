import { useMemo, useState } from "react";
import type { Person } from "@/data/staffingData";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Plus, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { uid } from "@/data/staffingData";
import { toast } from "sonner";

interface Props {
  people: Person[];
  onAdd: (p: Person) => void | Promise<void>;
  onUpdate: (id: string, updates: Partial<Person>) => void | Promise<void>;
  onRequestDelete: (p: Person) => void;
}

function InlineText({
  value,
  onSave,
  placeholder = "—",
  list,
  className,
  type = "text",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  list?: string;
  className?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const save = () => {
    if (local.trim() !== value) onSave(local.trim());
    setEditing(false);
  };
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          list={list}
          type={type}
          className="h-7 text-xs"
          autoFocus
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setLocal(value);
              setEditing(false);
            }
          }}
        />
        <button onClick={save} type="button" className="text-primary">
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => {
            setLocal(value);
            setEditing(false);
          }}
          type="button"
          className="text-muted-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setLocal(value);
        setEditing(true);
      }}
      className={cn("group/edit flex items-center gap-1 text-left w-full", className)}
    >
      <span className={cn("text-xs truncate", value ? "text-foreground" : "text-muted-foreground")}>
        {value || placeholder}
      </span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100 shrink-0" />
    </button>
  );
}

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
const USD = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);

export function PeopleReportingTable({ people, onAdd, onUpdate, onRequestDelete }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.designation || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.reportingManager || "").toLowerCase().includes(q),
    );
  }, [people, search]);

  const managerNames = useMemo(
    () =>
      Array.from(new Set(people.map((p) => p.name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [people],
  );

  const handleAdd = async () => {
    const name = prompt("New person name?")?.trim();
    if (!name) return;
    const newPerson: Person = {
      id: uid(),
      name,
      roleCategory: "BOPM" as any,
      roleTitle: "",
      pod: "",
      region: "India",
      leaving: false,
      tbh: false,
      department: "",
      designation: "",
      reportingManager: "",
      band: "",
      hourlyRate: 0,
      email: "",
      slackUserId: "",
      subTeam: "",
      revenueTargetPerPerson: 0,
      revenueTargetCurrency: "INR",
    };
    await onAdd(newPerson);
    toast.success(`Added ${name}`);
  };

  return (
    <div className="space-y-3">
      <datalist id="people-reporting-managers">
        {managerNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, designation, email, or manager…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {people.length}
        </div>
        <button
          onClick={handleAdd}
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add person
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[10px] w-12">#</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[10px] w-[18%]">Name</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[10px] w-[22%]">Designation</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[10px] w-[20%]">Email</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[10px] w-[16%]">Reports to</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[10px]">Rev type</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => {
              const currency = p.revenueTargetCurrency || "INR";
              const symbol = currency === "USD" ? "$" : "₹";
              const fmt = currency === "USD" ? USD : INR;
              return (
                <tr key={p.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <InlineText
                      value={p.name}
                      onSave={(v) => v && onUpdate(p.id, { name: v })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <InlineText
                      value={p.designation || ""}
                      onSave={(v) => onUpdate(p.id, { designation: v })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <InlineText
                      value={p.email || ""}
                      onSave={(v) => onUpdate(p.id, { email: v })}
                      placeholder="—"
                      type="email"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <InlineText
                      value={p.reportingManager || ""}
                      onSave={(v) => {
                        if (v && v === p.name) {
                          toast.error("A person can't report to themselves");
                          return;
                        }
                        onUpdate(p.id, { reportingManager: v });
                      }}
                      list="people-reporting-managers"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={currency}
                        onChange={(e) =>
                          onUpdate(p.id, {
                            revenueTargetCurrency: e.target.value as "INR" | "USD",
                          })
                        }
                        className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="INR">₹ INR</option>
                        <option value="USD">$ USD</option>
                      </select>
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                          {symbol}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          value={p.revenueTargetPerPerson ?? 0}
                          onChange={(e) =>
                            onUpdate(p.id, {
                              revenueTargetPerPerson: Number(e.target.value) || 0,
                            })
                          }
                          className="h-7 pl-5 pr-2 text-xs tabular-nums"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {symbol}
                        {fmt(p.revenueTargetPerPerson || 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRequestDelete(p)}
                      className="text-muted-foreground hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No people match "{search}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}