import { AppLayout } from "@/components/layout/AppLayout";
import { RGYHeatmap } from "@/components/dashboard/RGYHeatmap";
import { MetricCard } from "@/components/dashboard/MetricCard";

type RGYValue = "R" | "G" | "Y" | "NA";

const dimensions = ["Internal", "Customer", "Delivery", "Consumption", "Quality", "Growth", "Ops Hygiene"];

const rgyData: { deal: string; client: string; dimensions: Record<string, RGYValue> }[] = [
  { deal: "D-2024-047", client: "TechCorp India", dimensions: { Internal: "G", Customer: "G", Delivery: "Y", Consumption: "G", Quality: "G", Growth: "G", "Ops Hygiene": "G" } },
  { deal: "D-2024-041", client: "FinServe Ltd", dimensions: { Internal: "Y", Customer: "R", Delivery: "Y", Consumption: "R", Quality: "Y", Growth: "R", "Ops Hygiene": "Y" } },
  { deal: "D-2024-038", client: "MediaNext", dimensions: { Internal: "G", Customer: "G", Delivery: "G", Consumption: "Y", Quality: "G", Growth: "Y", "Ops Hygiene": "G" } },
  { deal: "D-2024-035", client: "RetailMax", dimensions: { Internal: "R", Customer: "Y", Delivery: "R", Consumption: "Y", Quality: "R", Growth: "Y", "Ops Hygiene": "R" } },
  { deal: "D-2024-033", client: "CloudFirst", dimensions: { Internal: "G", Customer: "G", Delivery: "G", Consumption: "G", Quality: "G", Growth: "G", "Ops Hygiene": "G" } },
  { deal: "D-2024-029", client: "EduPrime", dimensions: { Internal: "Y", Customer: "Y", Delivery: "G", Consumption: "NA", Quality: "Y", Growth: "NA", "Ops Hygiene": "G" } },
  { deal: "D-2024-025", client: "HealthPlus", dimensions: { Internal: "NA", Customer: "NA", Delivery: "NA", Consumption: "NA", Quality: "NA", Growth: "NA", "Ops Hygiene": "NA" } },
  { deal: "D-2024-019", client: "AutoDrive", dimensions: { Internal: "G", Customer: "G", Delivery: "G", Consumption: "G", Quality: "G", Growth: "G", "Ops Hygiene": "G" } },
];

export default function RGYHealth() {
  const redCount = rgyData.reduce((acc, d) => acc + Object.values(d.dimensions).filter(v => v === "R").length, 0);
  const yellowCount = rgyData.reduce((acc, d) => acc + Object.values(d.dimensions).filter(v => v === "Y").length, 0);
  const greenCount = rgyData.reduce((acc, d) => acc + Object.values(d.dimensions).filter(v => v === "G").length, 0);

  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-1">RGY Health Tracker</h1>
        <p className="text-ui text-muted-foreground mb-6">Multi-dimensional deal health assessment — March 2026</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard label="Red Flags" value={String(redCount)} />
          <MetricCard label="Yellow Warnings" value={String(yellowCount)} />
          <MetricCard label="Green (Healthy)" value={String(greenCount)} />
          <MetricCard label="Portfolio Score" value="72.4" suffix="/ 100" />
        </div>

        <div className="data-card">
          <p className="metric-label mb-4">Deal × Dimension Heatmap</p>
          <RGYHeatmap data={rgyData} dimensions={dimensions} />
        </div>
      </div>
    </AppLayout>
  );
}
