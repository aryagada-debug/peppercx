import { useState } from "react";
import { cn } from "@/lib/utils";
import { ROLE_SLOTS, type BWRule } from "@/data/staffingData";

interface Props {
  rules: BWRule[];
  onUpdateRules: (rules: BWRule[]) => void;
}

const fmtMRR = (n: number) => {
  if (n === Infinity) return "∞";
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

export function BWRulesTab({ rules, onUpdateRules }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const regions = ["India", "US"] as const;
  const roleKeys = [...new Set(rules.map(r => r.roleKey))];

  const updateRule = (id: string, pct: number) => {
    onUpdateRules(rules.map(r => r.id === id ? { ...r, recommendedPct: pct } : r));
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="data-card">
        <div className="mb-4">
          <h3 className="text-ui font-semibold text-foreground">Bandwidth Allocation Guidelines</h3>
          <p className="text-caption text-muted-foreground mt-1">Recommended allocation % per role by region and MRR tier. Click any value to edit.</p>
        </div>
        {regions.map(region => (
          <div key={region} className="mb-6">
            <h4 className="text-caption font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", region === "US" ? "bg-accent" : "bg-positive")} />
              {region}
            </h4>
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Role</th>
                  {[...new Set(rules.filter(r => r.region === region).map(r => `${fmtMRR(r.mrrMin)} – ${fmtMRR(r.mrrMax)}`))].map(tier => (
                    <th key={tier} className="text-center py-2 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">{tier}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roleKeys.map(roleKey => {
                  const regionRules = rules.filter(r => r.region === region && r.roleKey === roleKey);
                  if (regionRules.length === 0) return null;
                  const roleLabel = ROLE_SLOTS.find(s => s.roleKey === roleKey)?.roleLabel || roleKey;
                  return (
                    <tr key={roleKey} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="py-2 px-3 font-medium text-foreground">{roleLabel}</td>
                      {regionRules.map(rule => (
                        <td key={rule.id} className="py-2 px-3 text-center">
                          {editingId === rule.id ? (
                            <input type="number" step="1" className="w-16 h-7 px-2 rounded border border-accent bg-card text-ui text-foreground text-center font-mono"
                              value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                              onBlur={() => updateRule(rule.id, parseFloat(editValue) || 0)}
                              onKeyDown={e => { if (e.key === "Enter") updateRule(rule.id, parseFloat(editValue) || 0); if (e.key === "Escape") setEditingId(null); }} />
                          ) : (
                            <span onClick={() => { setEditingId(rule.id); setEditValue(String(rule.recommendedPct)); }}
                              className="cursor-pointer font-mono text-caption font-medium px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
                              {rule.recommendedPct}%
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
