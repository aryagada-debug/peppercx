/**
 * Admin-only popover to mark which Departments / Role Types are applicable to
 * a specific deal. Default for everything is "applicable" — a row in
 * `deal_applicability` represents an override.
 */
import { useMemo, useState } from "react";
import { Settings2, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTaxonomyQuery } from "@/hooks/queries/useTaxonomyQuery";
import {
  useDealApplicabilityQuery,
  useDealApplicabilityMutations,
} from "@/hooks/queries/useDealApplicabilityQuery";
import {
  buildApplicabilityIndex,
  isApplicableFromIndex,
} from "@/lib/applicability";

interface Props {
  dealId: string;
  dealLabel?: string;
  className?: string;
}

export function DealApplicabilityPopover({ dealId, dealLabel, className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: taxonomy } = useTaxonomyQuery();
  const { data: rows } = useDealApplicabilityQuery();
  const { setDepartment, setRoleType, clearRoleOverride, resetDeal } =
    useDealApplicabilityMutations();

  const index = useMemo(() => buildApplicabilityIndex(rows), [rows]);

  const overrideCount = useMemo(() => {
    if (!rows) return 0;
    return rows.filter((r) => r.dealId === dealId).length;
  }, [rows, dealId]);

  if (!taxonomy) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Edit applicable departments & roles"
          aria-label="Edit applicable departments & roles"
          className={cn(
            "inline-flex items-center gap-1 rounded border border-border px-1.5 h-5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary",
            overrideCount > 0 && "text-foreground border-primary/40",
            className,
          )}
        >
          <Settings2 className="h-3 w-3" />
          {overrideCount > 0 ? `${overrideCount} hidden` : "Applicability"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">Applicability</div>
            {dealLabel && (
              <div className="text-[10px] text-muted-foreground truncate">{dealLabel}</div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => resetDeal.mutate(dealId)}
            disabled={overrideCount === 0}
            title="Reset all to default (applicable)"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
        <ScrollArea className="max-h-[420px]">
          <div className="p-2 space-y-2">
            {taxonomy.departments.map((dept) => {
              const roleTypes = taxonomy.roleTypesByDept.get(dept.id) || [];
              if (!roleTypes.length) return null;
              const slot = index.get(dealId);
              const deptApplicable = slot?.dept.get(dept.id);
              const deptOn = deptApplicable !== false;
              return (
                <div key={dept.id} className="rounded border border-border">
                  <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-secondary/50">
                    <Checkbox
                      checked={deptOn}
                      onCheckedChange={(checked) => {
                        setDepartment.mutate({
                          dealId,
                          departmentId: dept.id,
                          isApplicable: !!checked,
                        });
                      }}
                    />
                    <span className="text-xs font-medium flex-1">{dept.name}</span>
                  </label>
                  <div className={cn("border-t border-border/60 px-2 py-1 space-y-0.5", !deptOn && "opacity-40")}>
                    {roleTypes.map((rt) => {
                      const applicable = isApplicableFromIndex(
                        index,
                        dealId,
                        dept.id,
                        rt.id,
                      );
                      const hasOverride = slot?.role.has(rt.id);
                      return (
                        <div
                          key={rt.id}
                          className="flex items-center gap-2 px-1 py-0.5"
                        >
                          <Checkbox
                            checked={applicable}
                            disabled={!deptOn && !hasOverride}
                            onCheckedChange={(checked) => {
                              const next = !!checked;
                              // If the resulting state equals the dept default,
                              // clear the override row instead of inserting one.
                              if (next === deptOn) {
                                clearRoleOverride.mutate({ dealId, roleTypeId: rt.id });
                              } else {
                                setRoleType.mutate({
                                  dealId,
                                  departmentId: dept.id,
                                  roleTypeId: rt.id,
                                  isApplicable: next,
                                });
                              }
                            }}
                          />
                          <span className="text-[11px] flex-1">{rt.name}</span>
                          {hasOverride && (
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                              override
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
          Roles marked not applicable are hidden on this deal's staffing table.
        </div>
      </PopoverContent>
    </Popover>
  );
}