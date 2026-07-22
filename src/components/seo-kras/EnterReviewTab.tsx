import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { scorecards, scorecardByKey, areaColor, areaToken } from "./scorecards";
import { useSeoKraTeam } from "@/hooks/queries/useSeoKraTeam";
import { useSeoKraReviews, useSaveSeoKraReview, type ScoreRow } from "@/hooks/queries/useSeoKraReviews";
import { computeScores } from "./scoring";

const YEARS = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
const QUARTERS = [1, 2, 3, 4];

function scoreTone(n: number) {
  if (n >= 8.5) return "bg-[hsl(var(--kra-score-good)/0.15)] text-[hsl(var(--kra-score-good))] border-[hsl(var(--kra-score-good)/0.4)]";
  if (n >= 6.5) return "bg-[hsl(var(--kra-score-warn)/0.15)] text-[hsl(var(--kra-score-warn))] border-[hsl(var(--kra-score-warn)/0.4)]";
  if (n > 0)   return "bg-[hsl(var(--kra-score-bad)/0.15)] text-[hsl(var(--kra-score-bad))] border-[hsl(var(--kra-score-bad)/0.4)]";
  return "bg-muted text-muted-foreground border-border";
}

export function EnterReviewTab() {
  const [scorecardKey, setScorecardKey] = useState(scorecards[0].key);
  const scorecard = scorecardByKey(scorecardKey);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [memberId, setMemberId] = useState<string>("");
  const [scores, setScores] = useState<Record<string, { score: string; note: string }>>({});
  const [reviewerNotes, setReviewerNotes] = useState("");

  const { data: team = [], isLoading: teamLoading } = useSeoKraTeam(scorecardKey);
  const { data: reviews = [] } = useSeoKraReviews(scorecardKey, year, quarter);
  const save = useSaveSeoKraReview();

  const member = team.find(m => m.person_id === memberId) || null;
  const existing = useMemo(() => reviews.find(r => r.member_person_id === memberId), [reviews, memberId]);

  useEffect(() => {
    const next: Record<string, { score: string; note: string }> = {};
    if (existing) {
      existing.scores.forEach(s => {
        next[`${s.area_id}:${s.kpi_id}`] = {
          score: s.score == null ? "" : String(s.score),
          note: s.note || "",
        };
      });
      setReviewerNotes(existing.reviewer_notes || "");
    } else {
      setReviewerNotes("");
    }
    setScores(next);
  }, [existing?.id, memberId, scorecardKey, year, quarter]);

  const parsedScores: ScoreRow[] = useMemo(() => {
    const rows: ScoreRow[] = [];
    scorecard.areas.forEach(a => a.kpis.forEach(k => {
      const cell = scores[`${a.id}:${k.id}`];
      const v = cell?.score?.trim();
      const n = v === "" || v == null ? null : Number(v);
      rows.push({
        area_id: a.id,
        kpi_id: k.id,
        score: n != null && !Number.isNaN(n) ? Math.max(1, Math.min(10, n)) : null,
        note: cell?.note || null,
      });
    }));
    return rows;
  }, [scores, scorecard]);

  const { areaAverages, weightedTotal } = useMemo(
    () => computeScores(scorecard, parsedScores),
    [scorecard, parsedScores],
  );

  const handleSave = async () => {
    if (!member) {
      toast.error("Pick a team member to review");
      return;
    }
    try {
      await save.mutateAsync({
        scorecard_key: scorecardKey,
        member_person_id: member.person_id,
        member_user_id: member.user_id,
        member_name: member.name,
        year,
        quarter,
        weighted_total: weightedTotal,
        area_averages: areaAverages,
        reviewer_notes: reviewerNotes,
        scores: parsedScores.filter(s => s.score != null || (s.note && s.note.length > 0)),
      });
      toast.success(`Saved review for ${member.name}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save review");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
            <div>
              <label className="text-xs text-muted-foreground">Team member</label>
              <Select value={memberId} onValueChange={setMemberId} disabled={teamLoading}>
                <SelectTrigger><SelectValue placeholder={teamLoading ? "Loading…" : "Select member"} /></SelectTrigger>
                <SelectContent>
                  {team.map(m => (
                    <SelectItem key={m.person_id} value={m.person_id}>
                      {m.name}{m.designation ? ` — ${m.designation}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {member ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Weighted Total</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <div className="text-3xl font-medium">{weightedTotal.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">/ 10</div>
                </div>
                {existing && (
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    Last saved {new Date(existing.updated_at).toLocaleDateString()}
                  </Badge>
                )}
              </CardContent>
            </Card>
            {scorecard.areas.map((a, i) => (
              <Card
                key={a.id}
                className="relative overflow-hidden"
                style={{
                  borderColor: areaColor(i, 0.35),
                  background: `linear-gradient(135deg, hsl(var(${areaToken(i)}) / 0.08), transparent)`,
                }}
              >
                <div className="absolute left-0 top-0 h-full w-1" style={{ background: areaColor(i) }} />
                <CardContent className="p-4">
                  <div className="text-xs font-medium" style={{ color: areaColor(i) }}>{a.short} · {Math.round(a.weight * 100)}%</div>
                  <div className={`mt-1 inline-flex items-baseline gap-1 px-2 py-0.5 rounded border ${scoreTone(areaAverages[a.id] || 0)}`}>
                    <span className="text-xl font-medium">{(areaAverages[a.id] || 0).toFixed(2)}</span>
                    <span className="text-xs">/ 10</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {scorecard.areas.map((area, i) => (
            <Card key={area.id} className="overflow-hidden" style={{ borderColor: areaColor(i, 0.3) }}>
              <CardHeader
                className="py-3"
                style={{ background: `linear-gradient(90deg, hsl(var(${areaToken(i)}) / 0.12), transparent)` }}
              >
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: areaColor(i) }} />
                    <span style={{ color: areaColor(i) }}>{area.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">Weight {Math.round(area.weight * 100)}% · Avg {(areaAverages[area.id] || 0).toFixed(2)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left p-2 w-1/3">KPI</th>
                        <th className="text-left p-2 w-1/4">Target · Measure</th>
                        <th className="text-left p-2 w-24">Score (1–10)</th>
                        <th className="text-left p-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {area.kpis.map(k => {
                        const key = `${area.id}:${k.id}`;
                        const cell = scores[key] || { score: "", note: "" };
                        return (
                          <tr key={k.id} className="border-t border-border align-top">
                            <td className="p-2">
                              <div className="font-medium">{k.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{k.def}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                10: {k.bands[0]} · 8–9: {k.bands[1]} · 5–7: {k.bands[2]} · &lt;5: {k.bands[3]}
                              </div>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              <div>{k.target}</div>
                              <div className="mt-1 italic">{k.measure}</div>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                step={0.5}
                                value={cell.score}
                                onChange={e => setScores(s => ({ ...s, [key]: { ...cell, score: e.target.value } }))}
                                className="h-8 w-20"
                              />
                            </td>
                            <td className="p-2">
                              <Textarea
                                rows={2}
                                value={cell.note}
                                onChange={e => setScores(s => ({ ...s, [key]: { ...cell, note: e.target.value } }))}
                                placeholder="Evidence, context, examples…"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Reviewer summary</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={reviewerNotes}
                onChange={e => setReviewerNotes(e.target.value)}
                placeholder="Overall observations, strengths, areas to develop…"
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <div className="text-xs text-muted-foreground mr-auto">
              Reviewing <span className="font-medium text-foreground">{member.name}</span> · {scorecard.label} · Q{quarter} {year}
            </div>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Saving…" : existing ? "Update review" : "Save review"}
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {teamLoading ? "Loading SEO team…" : team.length ? "Select a team member to start their review." : "No SEO team members found for this scorecard."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}