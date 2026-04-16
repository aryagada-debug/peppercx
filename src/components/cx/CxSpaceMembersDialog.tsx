import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Member {
  id: string;
  member_name: string;
  role: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  spaceName: string;
}

export function CxSpaceMembersDialog({ open, onClose, spaceId, spaceName }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("member");

  useEffect(() => {
    if (!open) return;
    supabase.from("cx_space_members").select("id, member_name, role").eq("space_id", spaceId).then(({ data }) => {
      setMembers((data as Member[]) || []);
    });
  }, [open, spaceId]);

  const addMember = async () => {
    if (!newName.trim()) return;
    const { data } = await supabase.from("cx_space_members").insert({ space_id: spaceId, member_name: newName.trim(), role: newRole }).select("id, member_name, role").single();
    if (data) {
      setMembers(prev => [...prev, data as Member]);
      setNewName("");
      setNewRole("member");
    }
  };

  const removeMember = async (id: string) => {
    await supabase.from("cx_space_members").delete().eq("id", id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const updateRole = async (id: string, role: string) => {
    await supabase.from("cx_space_members").update({ role } as any).eq("id", id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Members — {spaceName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-foreground">{m.member_name}</span>
              <Select value={m.role} onValueChange={v => updateRole(m.id, v)}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}

          {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No members yet.</p>}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Input
              placeholder="Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addMember()}
              className="h-8 text-sm flex-1"
            />
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={addMember}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
