import { useState } from "react";
import { cn } from "@/lib/utils";

interface RGYDimension {
  key: string;
  label: string;
  owner: string;
  value: string;
  planOfAction?: string;
}

interface Props {
  dimensions: RGYDimension[];
  onSave: (dimensions: RGYDimension[]) => void;
}

const RGY_OPTIONS = [
  { value: "G", label: "Green", className: "rgy-green" },
  { value: "Y", label: "Yellow", className: "rgy-yellow" },
  { value: "R", label: "Red", className: "rgy-red" },
];

export function EditableRGY({ dimensions, onSave }: Props) {
  const [local, setLocal] = useState<RGYDimension[]>(dimensions);
  const [dirty, setDirty] = useState(false);

  const update = (key: string, field: keyof RGYDimension, value: string) => {
    setLocal(prev => prev.map(d => d.key === key ? { ...d, [field]: value } : d));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(local);
    setDirty(false);
  };

  return (
    <div className="data-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-ui font-bold text-foreground">RGY Health Status</h3>
        {dirty && (
          <button onClick={handleSave} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-caption font-medium hover:opacity-90 transition-opacity">
            Save Changes
          </button>
        )}
      </div>
      <div className="space-y-3">
        {local.map(dim => (
          <div key={dim.key} className="border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-ui font-medium text-foreground">{dim.label}</span>
                <span className="text-caption text-muted-foreground ml-2">({dim.owner})</span>
              </div>
              <div className="flex gap-1">
                {RGY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update(dim.key, "value", opt.value)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-caption font-bold transition-all",
                      dim.value === opt.value ? opt.className + " ring-2 ring-offset-2 ring-primary/30" : "bg-secondary text-muted-foreground hover:opacity-80"
                    )}
                  >
                    {opt.value}
                  </button>
                ))}
              </div>
            </div>
            {(dim.value === "Y" || dim.value === "R") && (
              <div className="mt-2 animate-fade-in">
                <label className="text-caption text-muted-foreground block mb-1">Plan of Action</label>
                <textarea
                  value={dim.planOfAction || ""}
                  onChange={e => update(dim.key, "planOfAction", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-ui text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none resize-none"
                  rows={2}
                  placeholder="Describe the plan of action..."
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
