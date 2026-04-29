import { useEffect, useMemo, useState } from "react";
import { Search, CheckCircle2, AlertTriangle, MinusCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Person } from "@/data/staffingData";
import { toast } from "sonner";

interface Props {
  people: Person[];
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void> | void;
}

interface ProfileLink {
  staffingPersonId: string;
  userId: string;
  displayName: string;
}

type Status = "ok" | "missing" | "unlinked" | "invalid";

const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);

export function EmailMappingTable({ people, onUpdate }: Props) {
  const [search, setSearch] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [profiles, setProfiles] = useState<ProfileLink[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, staffing_person_id");
      if (!mounted) return;
      const list: ProfileLink[] = (data || [])
        .filter((p: any) => p.staffing_person_id)
        .map((p: any) => ({
          staffingPersonId: p.staffing_person_id,
          userId: p.user_id,
          displayName: p.display_name || "",
        }));
      setProfiles(list);
    })();
    return () => { mounted = false; };
  }, []);

  const profileByPerson = useMemo(() => {
    const m = new Map<string, ProfileLink>();
    profiles.forEach(p => m.set(p.staffingPersonId, p));
    return m;
  }, [profiles]);

  const statusOf = (p: Person): Status => {
    const link = profileByPerson.get(p.id);
    const email = (p.email || "").trim();
    if (!email) return "missing";
    if (!isEmail(email)) return "invalid";
    if (!link) return "unlinked";
    return "ok";
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people
      .filter(p => !p.tbh)
      .filter(p => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.email || "").toLowerCase().includes(q) ||
          (p.department || "").toLowerCase().includes(q)
        );
      })
      .filter(p => !issuesOnly || statusOf(p) !== "ok")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [people, search, issuesOnly, profileByPerson]);

  const counts = useMemo(() => {
    const c = { ok: 0, missing: 0, unlinked: 0, invalid: 0 };
    people.filter(p => !p.tbh).forEach(p => { c[statusOf(p)]++; });
    return c;
  }, [people, profileByPerson]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, team…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={issuesOnly} onChange={e => setIssuesOnly(e.target.checked)} className="h-3.5 w-3.5" />
          Show issues only
        </label>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <Pill tone="ok">{counts.ok} OK</Pill>
          <Pill tone="missing">{counts.missing} missing</Pill>
          <Pill tone="invalid">{counts.invalid} invalid</Pill>
          <Pill tone="unlinked">{counts.unlinked} unlinked</Pill>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Team</th>
              <th className="px-3 py-2 text-left font-medium">Designation</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Login</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <EmailRow
                key={p.id}
                person={p}
                link={profileByPerson.get(p.id) || null}
                status={statusOf(p)}
                onUpdate={onUpdate}
              />
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">No people match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmailRow({ person, link, status, onUpdate }: {
  person: Person; link: ProfileLink | null; status: Status;
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(person.email || "");
  useEffect(() => { setVal(person.email || ""); }, [person.email]);

  const save = async () => {
    const v = val.trim();
    if (v && !isEmail(v)) { toast.error("Invalid email"); return; }
    if (v === (person.email || "")) { setEditing(false); return; }
    await onUpdate(person.id, { email: v });
    toast.success("Email updated");
    setEditing(false);
  };

  return (
    <tr className={cn("border-t border-border/60 hover:bg-secondary/20", person.leaving && "opacity-60")}>
      <td className="px-3 py-2 font-medium text-foreground">{person.name}</td>
      <td className="px-3 py-2 text-muted-foreground">{person.department || "—"}</td>
      <td className="px-3 py-2 text-muted-foreground">{person.designation || "—"}</td>
      <td className="px-3 py-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input value={val} onChange={e => setVal(e.target.value)} className="h-7 text-xs" autoFocus
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(person.email || ""); setEditing(false); } }}
            />
            <button onClick={save} className="text-primary text-xs px-1">Save</button>
            <button onClick={() => { setVal(person.email || ""); setEditing(false); }} className="text-muted-foreground text-xs px-1">×</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-foreground hover:underline">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {person.email || <span className="text-muted-foreground italic">— add email —</span>}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground text-[11px]">
        {link ? <span className="text-emerald-700">Linked</span> : <span>Not linked</span>}
      </td>
      <td className="px-3 py-2">
        <StatusPill status={status} />
      </td>
    </tr>
  );
}

function Pill({ tone, children }: { tone: Status | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "ok" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
    tone === "missing" ? "bg-stone-100 text-stone-700 border-stone-200" :
    tone === "invalid" ? "bg-rose-50 text-rose-800 border-rose-200" :
    "bg-amber-50 text-amber-800 border-amber-200";
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium", cls)}>{children}</span>;
}

function StatusPill({ status }: { status: Status }) {
  if (status === "ok") return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="h-3 w-3" /> OK</span>;
  if (status === "missing") return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><MinusCircle className="h-3 w-3" /> Missing</span>;
  if (status === "invalid") return <span className="inline-flex items-center gap-1 text-[11px] text-rose-700"><AlertTriangle className="h-3 w-3" /> Invalid</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle className="h-3 w-3" /> Unlinked</span>;
}