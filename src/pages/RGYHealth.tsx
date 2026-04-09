import { AppLayout } from "@/components/layout/AppLayout";
import { RGYHeatmap } from "@/components/dashboard/RGYHeatmap";
import { MetricCard } from "@/components/dashboard/MetricCard";

type RGYValue = "R" | "G" | "Y" | "NA";

const dimensions = ["Internal", "Customer", "Delivery", "Consumption", "Quality", "Growth", "Ops Hygiene"];

const rgyData = [
  { id: "rgy-h1", deal: "D-2024-047", client: "TechCorp India", bopm: "Rahul S.", dimensions: { Internal: "G" as RGYValue, Customer: "G" as RGYValue, Delivery: "Y" as RGYValue, Consumption: "G" as RGYValue, Quality: "G" as RGYValue, Growth: "G" as RGYValue, "Ops Hygiene": "G" as RGYValue } },
  { id: "rgy-h2", deal: "D-2024-041", client: "FinServe Ltd", bopm: "Priya M.", dimensions: { Internal: "Y" as RGYValue, Customer: "R" as RGYValue, Delivery: "Y" as RGYValue, Consumption: "R" as RGYValue, Quality: "Y" as RGYValue, Growth: "R" as RGYValue, "Ops Hygiene": "Y" as RGYValue } },
  { id: "rgy-h3", deal: "D-2024-038", client: "MediaNext", bopm: "Ankit K.", dimensions: { Internal: "G" as RGYValue, Customer: "G" as RGYValue, Delivery: "G" as RGYValue, Consumption: "Y" as RGYValue, Quality: "G" as RGYValue, Growth: "Y" as RGYValue, "Ops Hygiene": "G" as RGYValue } },
  { id: "rgy-h4", deal: "D-2024-035", client: "RetailMax", bopm: "Meera T.", dimensions: { Internal: "R" as RGYValue, Customer: "Y" as RGYValue, Delivery: "R" as RGYValue, Consumption: "Y" as RGYValue, Quality: "R" as RGYValue, Growth: "Y" as RGYValue, "Ops Hygiene": "R" as RGYValue } },
  { id: "rgy-h5", deal: "D-2024-033", client: "CloudFirst", bopm: "Vikram J.", dimensions: { Internal: "G" as RGYValue, Customer: "G" as RGYValue, Delivery: "G" as RGYValue, Consumption: "G" as RGYValue, Quality: "G" as RGYValue, Growth: "G" as RGYValue, "Ops Hygiene": "G" as RGYValue } },
  { id: "rgy-h6", deal: "D-2024-029", client: "EduPrime", bopm: "Rahul S.", dimensions: { Internal: "Y" as RGYValue, Customer: "Y" as RGYValue, Delivery: "G" as RGYValue, Consumption: "NA" as RGYValue, Quality: "Y" as RGYValue, Growth: "NA" as RGYValue, "Ops Hygiene": "G" as RGYValue } },
  { id: "rgy-h7", deal: "D-2024-025", client: "HealthPlus", bopm: "—", dimensions: { Internal: "NA" as RGYValue, Customer: "NA" as RGYValue, Delivery: "NA" as RGYValue, Consumption: "NA" as RGYValue, Quality: "NA" as RGYValue, Growth: "NA" as RGYValue, "Ops Hygiene": "NA" as RGYValue } },
  { id: "rgy-h8", deal: "D-2024-019", client: "AutoDrive", bopm: "Priya M.", dimensions: { Internal: "G" as RGYValue, Customer: "G" as RGYValue, Delivery: "G" as RGYValue, Consumption: "G" as RGYValue, Quality: "G" as RGYValue, Growth: "G" as RGYValue, "Ops Hygiene": "G" as RGYValue } },
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
