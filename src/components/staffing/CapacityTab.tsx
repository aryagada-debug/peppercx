import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Deal, Person, StaffingAssignment, RoleCategory } from "@/data/staffingData";
import { ROLE_SLOTS, ROLE_CATEGORIES } from "@/data/staffingData";

interface Props {
  deals: Deal[];
  people: Person[];
  assignments: StaffingAssignment[];
}

const fmtPct = (n: number) => n === 0 ? "—" : `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;

interface TreeNode {
  person: Person;
  totalPct: number;
  dealCount: number;
  mrrOwned: number;
  dealDetails: { id: string; account: string; roleLabel: string; allocationPct: number }[];
  children: TreeNode[];
  rollupAvgUtil: number;
  rollupPeopleCount: number;
}

function buildTree(people: Person[], assignments: StaffingAssignment[], deals: Deal[]): TreeNode[] {
  const nameToPersons = new Map<string, Person[]>();
  people.forEach(p => {
    const key = p.name.toLowerCase();
    if (!nameToPersons.has(key)) nameToPersons.set(key, []);
    nameToPersons.get(key)!.push(p);
  });

  // Compute person data
  const personDataMap = new Map<string, { totalPct: number; dealCount: number; mrrOwned: number; dealDetails: any[] }>();
  people.forEach(p => {
    const pAssignments = assignments.filter(a => a.personId === p.id);
    const totalPct = pAssignments.reduce((s, a) => s + a.allocationPct, 0);
    const dealIds = [...new Set(pAssignments.map(a => a.dealId))];
    const mrrOwned = dealIds.reduce((s, did) => {
      const deal = deals.find(d => d.id === did);
      return s + (deal?.mrr || 0);
    }, 0);
    const dealDetails = pAssignments.map(a => {
      const deal = deals.find(d => d.id === a.dealId);
      const roleLabel = ROLE_SLOTS.find(s => s.roleKey === a.roleKey)?.roleLabel || a.roleKey;
      return { id: a.id, account: deal?.account || "Unknown", roleLabel, allocationPct: a.allocationPct };
    });
    personDataMap.set(p.id, { totalPct, dealCount: dealIds.length, mrrOwned, dealDetails });
  });

  // Build parent-child relationships
  const childrenMap = new Map<string, Person[]>();
  const hasParent = new Set<string>();

  people.forEach(p => {
    if (p.tbh) return;
    const mgr = p.reportingManager;
    if (mgr) {
      // Find manager in the people list
      const mgrPerson = people.find(m => m.name === mgr && !m.tbh);
      if (mgrPerson) {
        hasParent.add(p.id);
        if (!childrenMap.has(mgrPerson.id)) childrenMap.set(mgrPerson.id, []);
        childrenMap.get(mgrPerson.id)!.push(p);
      }
    }
  });

  function buildNode(person: Person): TreeNode {
    const data = personDataMap.get(person.id) || { totalPct: 0, dealCount: 0, mrrOwned: 0, dealDetails: [] };
    const children = (childrenMap.get(person.id) || [])
      .sort((a, b) => {
        const bandOrder = (b.band || "L0").localeCompare(a.band || "L0");
        return bandOrder !== 0 ? bandOrder : a.name.localeCompare(b.name);
      })
      .map(buildNode);

    // Rollup: average util of self + all descendants
    let totalUtil = data.totalPct;
    let totalCount = 1;
    children.forEach(c => {
      totalUtil += c.rollupAvgUtil * c.rollupPeopleCount;
      totalCount += c.rollupPeopleCount;
    });

    return {
      person,
      totalPct: data.totalPct,
      dealCount: data.dealCount,
      mrrOwned: data.mrrOwned,
      dealDetails: data.dealDetails,
      children,
      rollupAvgUtil: totalCount > 0 ? totalUtil / totalCount : 0,
      rollupPeopleCount: totalCount,
    };
  }

  // Root nodes: people without a parent in the list
  const roots = people
    .filter(p => !p.tbh && !hasParent.has(p.id))
    .sort((a, b) => {
      const bandOrder = (b.band || "L0").localeCompare(a.band || "L0");
      return bandOrder !== 0 ? bandOrder : a.name.localeCompare(b.name);
    })
    .map(buildNode);

  return roots;
}

export function CapacityTab({ deals, people, assignments }: Props) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<RoleCategory | "All">("All");

  const filteredPeople = useMemo(() => {
    if (categoryFilter === "All") return people.filter(p => !p.tbh);
    return people.filter(p => !p.tbh && p.roleCategory === categoryFilter);
  }, [people, categoryFilter]);

  const tree = useMemo(() => buildTree(filteredPeople, assignments, deals), [filteredPeople, assignments, deals]);

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (nodes: TreeNode[]) => { nodes.forEach(n => { allIds.add(n.person.id); collect(n.children); }); };
    collect(tree);
    setExpandedNodes(allIds);
  };
  const collapseAll = () => setExpandedNodes(new Set());

  // Render a tree row recursively
  const renderNode = (node: TreeNode, depth: number): React.ReactNode[] => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.person.id);
    const isDetailExpanded = expandedDetails === node.person.id;

    const rows: React.ReactNode[] = [];

    rows.push(
      <tr key={node.person.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
        <td className="py-2 px-3" style={{ paddingLeft: `${12 + depth * 20}px` }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button onClick={() => toggleExpand(node.person.id)} className="p-0.5 rounded hover:bg-secondary">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            ) : <span className="w-5" />}
            <span className={cn("font-medium cursor-pointer hover:text-accent", node.person.leaving && "line-through text-muted-foreground")}
              onClick={() => setExpandedDetails(isDetailExpanded ? null : node.person.id)}>
              {node.person.name}
            </span>
            {hasChildren && (
              <span className="text-caption text-muted-foreground ml-1">({node.rollupPeopleCount - 1} reports)</span>
            )}
          </div>
        </td>
        <td className="py-2 px-3 text-muted-foreground text-caption">{node.person.designation || node.person.roleTitle}</td>
        <td className="py-2 px-3 text-muted-foreground text-caption">{node.person.band}</td>
        <td className="py-2 px-3 text-center font-mono text-foreground">{node.dealCount}</td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-sm overflow-hidden">
              <div className={cn("h-full rounded-sm transition-all", node.totalPct > 100 ? "bg-destructive" : node.totalPct > 80 ? "bg-warning" : "bg-positive")}
                style={{ width: `${Math.min(node.totalPct, 100)}%` }} />
            </div>
          </div>
        </td>
        <td className="py-2 px-3 text-right">
          <span className={cn("font-mono text-caption font-medium", node.totalPct > 100 ? "text-destructive" : node.totalPct > 80 ? "text-warning" : "text-positive")}>{fmtPct(node.totalPct)}</span>
        </td>
        {hasChildren && (
          <td className="py-2 px-3 text-right">
            <span className={cn("font-mono text-caption", node.rollupAvgUtil > 100 ? "text-destructive" : node.rollupAvgUtil > 80 ? "text-warning" : "text-muted-foreground")}>
              avg {node.rollupAvgUtil.toFixed(0)}%
            </span>
          </td>
        )}
        {!hasChildren && <td />}
      </tr>
    );

    // Detail expansion
    if (isDetailExpanded && node.dealDetails.length > 0) {
      rows.push(
        <tr key={`${node.person.id}-detail`}>
          <td colSpan={7} className="px-8 py-2 bg-secondary/10" style={{ paddingLeft: `${32 + depth * 20}px` }}>
            <div className="space-y-1">
              {node.dealDetails.map(d => (
                <div key={d.id} className="flex items-center justify-between text-caption py-0.5">
                  <span className="text-muted-foreground">{d.account} — <span className="text-foreground">{d.roleLabel}</span></span>
                  <span className={cn("font-mono", d.allocationPct === 0 ? "text-warning" : "text-foreground")}>{d.allocationPct}%</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      );
    }

    // Render children if expanded
    if (isExpanded && hasChildren) {
      node.children.forEach(child => {
        rows.push(...renderNode(child, depth + 1));
      });
    }

    return rows;
  };

  return (
    <div className="space-y-6">
      {/* Category Filter + controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button onClick={() => setCategoryFilter("All")} className={cn(
            "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
            categoryFilter === "All" ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
          )}>All</button>
          {ROLE_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn(
              "px-3 py-1.5 rounded-md text-caption font-medium whitespace-nowrap transition-colors",
              categoryFilter === cat ? "bg-foreground text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}>{cat}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-caption text-accent hover:text-accent/80">Expand All</button>
          <button onClick={collapseAll} className="text-caption text-muted-foreground hover:text-foreground">Collapse All</button>
        </div>
      </div>

      {/* Tiered Capacity Table */}
      <div className="data-card p-0 overflow-x-auto">
        <table className="w-full text-ui">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[280px]">Name</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Designation</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-16">Band</th>
              <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-16"># Deals</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider min-w-[160px]">BW Used</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-20">Total %</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider w-20">Team Avg</th>
            </tr>
          </thead>
          <tbody>
            {tree.flatMap(node => renderNode(node, 0))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
