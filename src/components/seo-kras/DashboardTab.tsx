import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { scorecards, scorecardByKey, areaColor, areaToken } from "./scorecards";
import { useSeoKraTeam } from "@/hooks/queries/useSeoKraTeam";
import { useSeoKraReviews } from "@/hooks/queries/useSeoKraReviews";
import { TrendsChart } from "./TrendsChart";

const YEARS = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
const QUARTERS = [1, 2, 3, 4];

function toneClass(n: number) {
  if (n >= 8.5) return "bg-[hsl(var(--kra-score-good)/0.15)] text-[hsl(var(--kra-score-good))] border-[hsl(var(--kra-score-good)/0.35)]";
  if (n >= 6.5) return "bg-[hsl(var(--kra-score-warn)/0.15)] text-[hsl(var(--kra-score-warn))] border-[hsl(var(--kra-score-warn)/0.4)]";
  if (n > 0)   return "bg-[hsl(var(--kra-score-bad)/0.15)] text-[hsl(var(--kra-score-bad))] border-[hsl(var(--kra-score-bad)/0.4)]";
  return "bg-muted text-muted-foreground border-border";
}

export function DashboardTab() {
  const [scorecardKey, setScorecardKey] = useState(scorecards[0].key);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const scorecard = scorecardByKey(scorecardKey);

  const { data: team = [] } = useSeoKraTeam(scorecardKey);
  const { data: reviews = [], isLoading } = useSeoKraReviews(scorecardKey, year, quarter);

  const reviewByMember = useMemo(() => {
    const m = new Map<string, typeof reviews[number]>();
    reviews.forEach(r => { if (r.member_person_id) m.set(r.member_person_id, r); });
    return m;
  }, [reviews]);

  const scored = team.map(t => ({ member: t, review: reviewByMember.get(t.person_id) || null }));
  const withScores = scored.filter(s => s.review && typeof s.review.weighted_total === "number");
  const teamAvg = withScores.length
    ? withScores.reduce((sum, s) => sum + (s.review!.weighted_total || 0), 0) / withScores.length
    : 0;
  const areaAvgs = scorecard.areas.map(area => {
    const vals = withScores
      .map(s => (s.review!.area_averages as any)?.[area.id])
      .filter((n: any): n is number => typeof n === "number");
    return {
      area,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
    };
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Scorecard</label>
              <Select value={scorecardKey} onValueChange={setScorecardKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {scorecards.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Year</label>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Quarter</label>
              <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUARTERS.map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Team members</div>
          <div className="text-2xl font-medium mt-1">{team.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Reviews completed</div>
          <div className="text-2xl font-medium mt-1">{withScores.length}<span className="text-sm text-muted-foreground"> / {team.length}</span></div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Team average</div>
          <div className="text-2xl font-medium mt-1">{teamAvg.toFixed(2)}<span className="text-sm text-muted-foreground"> / 10</span></div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Coverage</div>
          <div className="text-2xl font-medium mt-1">{team.length ? Math.round((withScores.length / team.length) * 100) : 0}%</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Area averages</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {areaAvgs.map(({ area, avg }, i) => (
              <div
                key={area.id}
                className="rounded-md border p-3 relative overflow-hidden"
                style={{
                  borderColor: areaColor(i, 0.35),
                  background: `linear-gradient(135deg, hsl(var(${areaToken(i)}) / 0.10), hsl(var(${areaToken(i)}) / 0.02))`,
                }}
              >
                <div className="absolute left-0 top-0 h-full w-1" style={{ background: areaColor(i) }} />
                <div className="text-xs font-medium" style={{ color: areaColor(i) }}>{area.short}</div>
                <div className="text-xl font-medium mt-1">{avg.toFixed(2)}<span className="text-xs text-muted-foreground"> / 10</span></div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Weight {Math.round(area.weight * 100)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TrendsChart scorecard={scorecard} team={team} />

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Member scorecards</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Member</th>
                  <th className="text-left p-2">Role</th>
                  {scorecard.areas.map((a, i) => (
                    <th key={a.id} className="text-center p-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: areaColor(i) }} />
                        {a.short}
                      </span>
                    </th>
                  ))}
                  <th className="text-center p-2">Total</th>
                  <th className="text-left p-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={scorecard.areas.length + 4} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && scored.map(({ member, review }) => (
                  <tr key={member.person_id} className="border-t border-border">
                    <td className="p-2 font-medium">{member.name}</td>
                    <td className="p-2 text-xs text-muted-foreground">{member.designation || member.role_title || "—"}</td>
                    {scorecard.areas.map(a => {
                      const v = review?.area_averages?.[a.id];
                      return (
                        <td key={a.id} className="p-2 text-center">
                          {typeof v === "number"
                            ? <span className={`inline-block px-2 py-0.5 rounded border text-xs ${toneClass(v)}`}>{v.toFixed(2)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                    <td className="p-2 text-center">
                      {review && typeof review.weighted_total === "number"
                        ? <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${toneClass(review.weighted_total)}`}>{review.weighted_total.toFixed(2)}</span>
                        : <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {review ? new Date(review.updated_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {!isLoading && !scored.length && (
                  <tr><td colSpan={scorecard.areas.length + 4} className="p-6 text-center text-muted-foreground">No team members found for this scorecard.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}