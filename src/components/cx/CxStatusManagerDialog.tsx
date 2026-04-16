import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CxStatus } from "@/pages/CentralCx";

interface Props {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  statuses: CxStatus[];
  onStatusesChange: () => void;
}

export function CxStatusManagerDialog({ open, onClose, spaceId, statuses, onStatusesChange }: Props) {
  const [local, setLocal] = useState<CxStatus[]>(statuses);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#6b7280");

  React.useEffect(() => { setLocal(statuses); }, [statuses]);

  const addStatus = async () => {
    if (!newLabel.trim()) return;
    const sortOrder = local.length;
    const { data } = await supabase.from("cx_statuses").insert({ space_id: spaceId, label: newLabel.trim(), color: newColor, sort_order: sortOrder }).select("*").single();
    if (data) {
      setLocal(prev => [...prev, data as CxStatus]);
      setNewLabel("");
      setNewColor("#6b7280");
      onStatusesChange();
    }
  };

  const removeStatus = async (id: string) => {
    await supabase.from("cx_statuses").delete().eq("id", id);
    setLocal(prev => prev.filter(s => s.id !== id));
    onStatusesChange();
  };

  const updateStatus = async (id: string, label: string, color: string) => {
    await supabase.from("cx_statuses").update({ label, color } as any).eq("id", id);
    setLocal(prev => prev.map(s => s.id === id ? { ...s, label, color } : s));
    onStatusesChange();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Kanban Columns</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {local.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <input
                type="color"
                value={s.color}
                onChange={e => updateStatus(s.id, s.label, e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer"
              />
              <Input
                value={s.label}
                onChange={e => updateStatus(s.id, e.target.value, s.color)}
                className="h-8 text-sm flex-1"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStatus(s.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t border-border">
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="w-8 h-8 rounded border border-border cursor-pointer"
          />
          <Input
            placeholder="New status label"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStatus()}
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" className="h-8" onClick={addStatus}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
