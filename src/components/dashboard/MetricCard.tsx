import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  suffix?: string;
  isPositiveGood?: boolean;
  className?: string;
}

const transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };

export function MetricCard({ label, value, change, suffix, isPositiveGood = true, className }: MetricCardProps) {
  const getColor = (val: number) => {
    if (val === 0) return "text-muted-foreground";
    const isPositive = val > 0;
    if (isPositiveGood) return isPositive ? "text-positive" : "text-negative";
    return isPositive ? "text-negative" : "text-positive";
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={transition}
      className={cn("data-card", className)}
    >
      <p className="metric-label">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <h2 className="metric-value">{value}</h2>
        {suffix && <span className="text-ui text-muted-foreground">{suffix}</span>}
      </div>
      {change !== undefined && (
        <div className="mt-1">
          <span className={cn(
            "text-ui font-medium font-mono tabular-nums",
            getColor(change)
          )}>
            {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(2)}%
          </span>
        </div>
      )}
    </motion.div>
  );
}
