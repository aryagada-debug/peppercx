import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { areaColor, type Scorecard } from "./scorecards";
import { useSeoKraMemberHistory } from "@/hooks/queries/useSeoKraReviews";
import type { SeoKraMember } from "@/hooks/queries/useSeoKraTeam";

type Mode = "area" | "kpi";
const RANGES = [4, 8, 12] as const;

export function TrendsChart({ scorecard, team }: { scorecard: Scorecard; team: SeoKraMember[] }) {
  const [memberId, setMemberId] = useState<string>(team[0]?.person_id ?? "");
  const [mode, setMode] = useState<Mode>("area");
  const firstKpiKey = `${scorecard.areas[0].id}:${scorecard.areas[0].kpis[0].id}`;
  const [kpiKey, setKpiKey] = useState<string>(firstKpiKey);
  const [range, setRange] = useState<number>(8);

  const { data: history = [], isLoading } = useSeoKraMemberHistory(scorecard.key, memberId || null, range);

  const chartData = useMemo(() => {
    return history.map(p => {
      const row: Record<string, any> = { label: p.label };
      if (mode === "area") {
        scorecard.areas.forEach(a => { row[a.id] = p.area_averages?.[a.id] ?? null; });
      } else {
        row.kpi = p.kpiScores?.[kpiKey] ?? null;
        const areaId = kpiKey.split(":")[0];
        row.areaAvg = p.area_averages?.[areaId] ?? null;
      }
      row.total = p.weighted_total;
      return row;
    });
  }, [history, mode, scorecard, kpiKey]);

  const activeAreaIndex = scorecard.areas.findIndex(a => a.id === kpiKey.split(":")[0]);
  const member = team.find(m => m.person_id === memberId) || null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
          <span>Trends over time</span>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>
                {team.map(m => <SelectItem key={m.person_id} value={m.person_id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setMode("area")}
                className={`px-2.5 py-1 ${mode === "area" ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted/50"}`}
              >Area averages</button>
              <button
                onClick={() => setMode("kpi")}
                className={`px-2.5 py-1 border-l border-border ${mode === "kpi" ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted/50"}`}
              >Individual KPI</button>
            </div>
            {mode === "kpi" && (
              <Select value={kpiKey} onValueChange={setKpiKey}>
                <SelectTrigger className="h-8 w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {scorecard.areas.map(a => (
                    <SelectGroup key={a.id}>
                      <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.short}</SelectLabel>
                      {a.kpis.map(k => (
                        <SelectItem key={`${a.id}:${k.id}`} value={`${a.id}:${k.id}`}>{k.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 ${r !== RANGES[0] ? "border-l border-border" : ""} ${range === r ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted/50"}`}
                >{r}Q</button>
              ))}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!memberId ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Select a team member to see trends.</div>
        ) : isLoading ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No saved reviews yet for {member?.name || "this member"}.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 5, 6, 8, 10]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <ReferenceLine y={5} stroke="hsl(var(--kra-score-warn))" strokeDasharray="4 4" />
                <ReferenceLine y={8} stroke="hsl(var(--kra-score-good))" strokeDasharray="4 4" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {mode === "area" ? (
                  scorecard.areas.map((a, i) => (
                    <Line
                      key={a.id}
                      type="monotone"
                      dataKey={a.id}
                      name={a.short}
                      stroke={areaColor(i)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="kpi"
                      name={scorecard.areas.flatMap(a => a.kpis).find(k => `${scorecard.areas.find(a => a.kpis.includes(k))?.id}:${k.id}` === kpiKey)?.name || "KPI"}
                      stroke={areaColor(Math.max(0, activeAreaIndex))}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="areaAvg"
                      name="Area avg"
                      stroke={areaColor(Math.max(0, activeAreaIndex), 0.5)}
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
            {chartData.length < 2 && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Save more quarterly reviews to see a full trend line.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}