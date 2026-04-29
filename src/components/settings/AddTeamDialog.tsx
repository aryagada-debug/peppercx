import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "team" | "subteam";
  parentTeam?: string; // when mode === "subteam"
  /**
   * Called with the new team / sub-team name. Caller is responsible for
   * persisting it (typically by adding a placeholder person OR by tracking
   * the empty bucket in local UI state).
   */
  onCreate: (name: string) => Promise<void> | void;
}

export function AddTeamDialog({ open, onOpenChange, mode, parentTeam, onCreate }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const v = name.trim();
    if (!v) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await onCreate(v);
      toast.success(mode === "team" ? `Team "${v}" added` : `Sub-team "${v}" added`);
      setName("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "team" ? "Add a team" : `Add a sub-team to ${parentTeam || "team"}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setName(""); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <label className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</div>
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus
            className="h-8" placeholder={mode === "team" ? "e.g. Capability — AI" : "e.g. Strategy"}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          {mode === "team"
            ? "The team becomes available immediately. It will persist once you assign at least one person to it."
            : "The sub-team becomes available under this team. It will persist once you assign at least one person to it."}
        </p>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)}
            className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary/50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving}
            className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium disabled:opacity-50">
            {saving ? "Adding…" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}