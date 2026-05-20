import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { TRASH_REGISTRY, restoreTrashItem, purgeTrashItem, type TrashItem, type TrashEntityType } from "@/lib/trash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDistanceToNow, format } from "date-fns";

export default function TrashPage() {
  const { isAdmin } = useUserRole();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trash_items")
      .select("*")
      .is("restored_at", null)
      .order("deleted_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data || []) as unknown as TrashItem[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterType !== "all" && i.entity_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !i.entity_label.toLowerCase().includes(q) &&
          !i.deleted_by_name.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [items, filterType, search]);

  const handleRestore = async (item: TrashItem) => {
    const res = await restoreTrashItem(item);
    if (!res.ok) { toast.error(`Restore failed: ${res.error}`); return; }
    toast.success(`${TRASH_REGISTRY[item.entity_type]?.displayName ?? "Item"} restored`);
    load();
  };

  const handlePurge = async (item: TrashItem) => {
    if (!confirm(`Permanently delete "${item.entity_label}"? This cannot be undone.`)) return;
    const ok = await purgeTrashItem(item.id);
    if (!ok) { toast.error("Permanent delete failed"); return; }
    toast.success("Permanently deleted");
    load();
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-2xl font-medium flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Trash
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Deleted items are kept for 7 days, then permanently removed.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        </div>

        <div className="flex gap-2 mt-6 mb-3">
          <Input
            placeholder="Search by name or deleter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(TRASH_REGISTRY) as TrashEntityType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TRASH_REGISTRY[t].displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Deleted by</th>
                <th className="text-left px-3 py-2">Deleted</th>
                <th className="text-left px-3 py-2">Expires</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Trash is empty.</td></tr>
              )}
              {filtered.map((item) => {
                const expiresIn = new Date(item.expires_at).getTime() - Date.now();
                const expiringSoon = expiresIn < 24 * 60 * 60 * 1000;
                const cfg = TRASH_REGISTRY[item.entity_type];
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="font-normal">
                        {cfg?.displayName ?? item.entity_type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-medium">{item.entity_label || item.entity_id}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.deleted_by_name || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground" title={format(new Date(item.deleted_at), "PPpp")}>
                      {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={expiringSoon ? "text-red-600 inline-flex items-center gap-1" : "text-muted-foreground"}>
                        {expiringSoon && <AlertTriangle className="h-3 w-3" />}
                        in {formatDistanceToNow(new Date(item.expires_at))}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRestore(item)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Restore
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handlePurge(item)}>
                            Delete forever
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}