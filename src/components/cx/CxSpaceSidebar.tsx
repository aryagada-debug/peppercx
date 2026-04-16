import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, MoreHorizontal, Pencil, Trash2, FolderOpen, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { CxSpace } from "@/pages/CentralCx";

interface Props {
  spaces: CxSpace[];
  selectedSpaceId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function CxSpaceSidebar({ spaces, selectedSpaceId, onSelect, onAdd, onRename, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName("");
      setAdding(false);
    }
  };

  const handleRename = (id: string) => {
    if (renameVal.trim()) {
      onRename(id, renameVal.trim());
      setRenamingId(null);
    }
  };

  return (
    <div className="w-56 border-r border-border bg-muted/30 flex flex-col flex-shrink-0 h-full">
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Spaces</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {/* All Tasks - admin view */}
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
            selectedSpaceId === null
              ? "bg-primary/10 text-primary font-medium"
              : "text-foreground hover:bg-muted"
          )}
        >
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          <span>All Tasks</span>
          <span className="ml-auto text-xs text-muted-foreground">Admin</span>
        </button>

        {spaces.map(space => (
          <div
            key={space.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors",
              selectedSpaceId === space.id
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground hover:bg-muted"
            )}
            onClick={() => onSelect(space.id)}
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {renamingId === space.id ? (
              <Input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={() => handleRename(space.id)}
                onKeyDown={e => e.key === "Enter" && handleRename(space.id)}
                className="h-6 text-sm py-0 px-1"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1">{space.name}</span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-muted-foreground/10">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); setRenamingId(space.id); setRenameVal(space.name); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); onDelete(space.id); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {adding && (
          <div className="px-3 py-2">
            <Input
              autoFocus
              placeholder="Space name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewName(""); }
              }}
              onBlur={() => { if (!newName.trim()) setAdding(false); else handleAdd(); }}
              className="h-7 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
