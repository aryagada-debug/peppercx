import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import type { BWRule } from "@/data/staffingData";
import { uid } from "@/data/staffingData";

interface Props {
  rules: BWRule[];
  onUpdateRule: (ruleId: string, updates: Partial<BWRule>) => void;
  onAddRule: (rule: BWRule) => void;
  onDeleteRule: (ruleId: string) => void;
  editMode: boolean;
}

const fmtMRR = (n: number) => {
  if (n === Infinity || n >= 999999999) return "∞";
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

export function BWRulesTab({ rules, onUpdateRule, onAddRule, onDeleteRule, editMode }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ capability: "SEO", region: "India", mrrTierLabel: "", mrrMin: 0, mrrMax: 0, roleKey: "", recommendedPct: 0 });

  const capabilities = [...new Set(rules.map(r => r.capability))].sort();
  const regions = ["India", "US"];

  const updatePct = (id: string, pct: number) => {
    onUpdateRule(id, { recommendedPct: pct });
    setEditingId(null);
  };

  const addNewRule = () => {
    onAddRule({ id: `bw_${uid()}`, ...newRule });
    setNewRule({ capability: "SEO", region: "India", mrrTierLabel: "", mrrMin: 0, mrrMax: 0, roleKey: "", recommendedPct: 0 });
    setShowAdd(false);
  };

  if (rules.length === 0) {
    return (
      <div className="space-y-4">
        <div className="data-card text-center py-12">
          <p className="text-ui text-muted-foreground mb-3">No bandwidth rules configured yet.</p>
          {editMode && (
            <button onClick={() => setShowAdd(true)}
              className="h-9 px-4 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add First Rule
            </button>
          )}
        </div>
        {showAdd && renderAddModal()}
      </div>
    );
  }

  function renderAddModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={() => setShowAdd(false)}>
        <div className="bg-card border border-border rounded-lg p-6 w-[450px]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-ui font-semibold text-foreground">Add BW Rule</h3>
            <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-muted-foreground font-medium">Capability</label>
                <input type="text" value={newRule.capability} onChange={e => setNewRule(p => ({ ...p, capability: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1" placeholder="SEO" />
              </div>
              <div>
                <label className="text-caption text-muted-foreground font-medium">Region</label>
                <select value={newRule.region} onChange={e => setNewRule(p => ({ ...p, region: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-border bg-card text-ui text-foreground mt-1">
                  <option value="India">India</option>
                  <option value="US">US</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-caption text-muted-foreground font-medium">MRR Tier Label</label>
                <input type="text" value={newRule.mrrTierLabel} onChange={e => setNewRule(p => ({ ...p, mrrTierLabel: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1" placeholder="< 1.5L" />
              </div>
              <div>
                <label className="text-caption text-muted-foreground font-medium">Role Key</label>
                <input type="text" value={newRule.roleKey} onChange={e => setNewRule(p => ({ ...p, roleKey: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1" placeholder="leader" />
              </div>
              <div>
                <label className="text-caption text-muted-foreground font-medium">Recommended %</label>
                <input type="number" value={newRule.recommendedPct} onChange={e => setNewRule(p => ({ ...p, recommendedPct: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-9 px-3 rounded-md bg-muted/50 border-0 text-ui text-foreground mt-1" />
              </div>
            </div>
            <button onClick={addNewRule} disabled={!newRule.roleKey || !newRule.mrrTierLabel}
              className="w-full h-9 rounded-md bg-foreground text-primary-foreground text-ui font-medium hover:opacity-90 disabled:opacity-50 mt-2">
              Add Rule
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-ui font-semibold text-foreground">Bandwidth Allocation Guidelines</h3>
          <p className="text-caption text-muted-foreground mt-1">Recommended allocation % per role by capability, region, and MRR tier.</p>
        </div>
        {editMode && (
          <button onClick={() => setShowAdd(true)}
            className="h-8 px-3 rounded-md bg-foreground text-primary-foreground text-caption font-medium hover:opacity-90 flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Add Rule
          </button>
        )}
      </div>

      {capabilities.map(cap => (
        <div key={cap} className="data-card">
          <h4 className="text-ui font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            {cap}
          </h4>
          {regions.map(region => {
            const regionRules = rules.filter(r => r.capability === cap && r.region === region);
            if (regionRules.length === 0) return null;
            
            const tiers = [...new Set(regionRules.map(r => r.mrrTierLabel))];
            const roleKeys = [...new Set(regionRules.map(r => r.roleKey))];

            return (
              <div key={region} className="mb-4">
                <h5 className="text-caption font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className={cn("w-1.5 h-1.5 rounded-full", region === "US" ? "bg-accent" : "bg-positive")} />
                  {region}
                </h5>
                <table className="w-full text-ui">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">Role</th>
                      {tiers.map(tier => (
                        <th key={tier} className="text-center py-2 px-3 font-medium text-muted-foreground text-caption uppercase tracking-wider">{tier}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roleKeys.map(roleKey => (
                      <tr key={roleKey} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="py-2 px-3 font-medium text-foreground">{roleKey}</td>
                        {tiers.map(tier => {
                          const rule = regionRules.find(r => r.mrrTierLabel === tier && r.roleKey === roleKey);
                          if (!rule) return <td key={tier} className="py-2 px-3 text-center text-muted-foreground">—</td>;
                          return (
                            <td key={tier} className="py-2 px-3 text-center">
                              {editMode && editingId === rule.id ? (
                                <input type="number" step="1" className="w-16 h-7 px-2 rounded border border-accent bg-card text-ui text-foreground text-center font-mono"
                                  value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                                  onBlur={() => updatePct(rule.id, parseFloat(editValue) || 0)}
                                  onKeyDown={e => { if (e.key === "Enter") updatePct(rule.id, parseFloat(editValue) || 0); if (e.key === "Escape") setEditingId(null); }} />
                              ) : (
                                <span onClick={() => { if (editMode) { setEditingId(rule.id); setEditValue(String(rule.recommendedPct)); } }}
                                  className={cn("font-mono text-caption font-medium px-2 py-1 rounded", editMode ? "cursor-pointer bg-accent/10 text-accent hover:bg-accent/20" : "text-foreground")}>
                                  {rule.recommendedPct}%
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}

      {showAdd && renderAddModal()}
    </div>
  );
}