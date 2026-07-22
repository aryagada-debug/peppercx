import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Target as TargetIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { scorecards, scorecardByKey, areaColor, areaToken } from "./scorecards";
import { useSeoKraTeam } from "@/hooks/queries/useSeoKraTeam";
import { useSeoKraReviews, useSaveSeoKraReview, type ScoreRow } from "@/hooks/queries/useSeoKraReviews";
import { computeScores } from "./scoring";
import { SEO_KRA_REVIEWERS, isSeoKraReviewerEmail } from "@/lib/seoKraAccess";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

const YEARS = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
const QUARTERS = [1, 2, 3, 4];

const BAND_STYLES = [
  "bg-[hsl(var(--kra-score-good)/0.18)] text-[hsl(var(--kra-score-good))]",
  "bg-[hsl(var(--kra-score-good)/0.10)] text-[hsl(var(--kra-score-good))]",
  "bg-[hsl(var(--kra-score-warn)/0.18)] text-[hsl(var(--kra-score-warn))]",
  "bg-[hsl(var(--kra-score-bad)/0.18)] text-[hsl(var(--kra-score-bad))]",
];
const BAND_LABELS = ["10", "8–9", "5–7", "<5"];

function scoreButtonTone(n: number, active: boolean) {
  if (!active) return "border-border bg-background text-foreground hover:bg-muted";
  if (n >= 9) return "border-[hsl(var(--kra-score-good))] bg-[hsl(var(--kra-score-good))] text-white";
  if (n >= 7) return "border-[hsl(var(--kra-score-warn))] bg-[hsl(var(--kra-score-warn))] text-white";
  return "border-[hsl(var(--kra-score-bad))] bg-[hsl(var(--kra-score-bad))] text-white";
}

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
  const { user } = useAuth();
  const { isAdmin, isActuallyAdmin } = useUserRole();
  const currentEmail = (user?.email || "").toLowerCase();
  const reviewerOptions = useMemo(() => {
    const opts = SEO_KRA_REVIEWERS.map(r => ({ email: r.email.toLowerCase(), name: r.name }));
    if ((isAdmin || isActuallyAdmin) && currentEmail && !opts.find(o => o.email === currentEmail)) {
      opts.unshift({ email: currentEmail, name: user?.user_metadata?.full_name || user?.email || "Admin" });
    }
    return opts;
  }, [isAdmin, isActuallyAdmin, currentEmail, user]);
  const [reviewerEmail, setReviewerEmail] = useState<string>(() =>
    isSeoKraReviewerEmail(currentEmail) ? currentEmail : reviewerOptions[0]?.email || ""
  );
  useEffect(() => {
    if (!reviewerEmail && reviewerOptions[0]) setReviewerEmail(reviewerOptions[0].email);
  }, [reviewerOptions, reviewerEmail]);
  const reviewerName = reviewerOptions.find(o => o.email === reviewerEmail)?.name || "";

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
        reviewer_email: reviewerEmail || null,
        reviewer_name: reviewerName || null,
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Reviewer</label>
              <Select value={reviewerEmail} onValueChange={setReviewerEmail}>
                <SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger>
                <SelectContent>
                  {reviewerOptions.map(o => (
                    <SelectItem key={o.email} value={o.email}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {scorecard.areas.map((area, i) => {
            const areaAvg = areaAverages[area.id] || 0;
            const scored = area.kpis.some(k => {
              const c = scores[`${area.id}:${k.id}`];
              return c?.score && c.score !== "";
            });
            return (
              <Card key={area.id} className="overflow-hidden" style={{ borderColor: areaColor(i, 0.3) }}>
                <CardHeader
                  className="py-3"
                  style={{ background: `linear-gradient(90deg, hsl(var(${areaToken(i)}) / 0.12), transparent)` }}
                >
                  <CardTitle className="text-sm flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-3">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-medium"
                        style={{ background: areaColor(i) }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-base font-medium" style={{ color: areaColor(i) }}>{area.name}</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {scored ? `Avg ${areaAvg.toFixed(2)}` : "not scored"}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Weight {Math.round(area.weight * 100)}%
                      </span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {area.kpis.map((k, idx) => {
                    const key = `${area.id}:${k.id}`;
                    const cell = scores[key] || { score: "", note: "" };
                    const activeScore = cell.score === "" ? null : Number(cell.score);
                    return (
                      <div
                        key={k.id}
                        className={cn(
                          "rounded-lg border border-border bg-background p-4",
                          idx > 0 && "mt-1"
                        )}
                      >
                        <div className="font-medium text-sm">{k.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{k.def}</div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {k.bands.map((band, bi) => (
                            <span
                              key={bi}
                              className={cn("text-[11px] px-2 py-1 rounded-md font-medium", BAND_STYLES[bi])}
                            >
                              <span className="font-semibold mr-1">{BAND_LABELS[bi]}</span>
                              <span className="opacity-90 font-normal">{band}</span>
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 flex items-start gap-2 text-sm">
                          <TargetIcon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: areaColor(i) }} />
                          <span className="font-medium">{k.target}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground italic pl-6">{k.measure}</div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Array.from({ length: 10 }, (_, n) => n + 1).map(n => {
                            const active = activeScore === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() =>
                                  setScores(s => ({ ...s, [key]: { ...cell, score: String(n) } }))
                                }
                                className={cn(
                                  "h-9 w-9 rounded-md border text-sm font-medium transition-colors",
                                  scoreButtonTone(n, active)
                                )}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">
                            {activeScore ? `rated ${activeScore}/10` : "tap to rate"}
                          </span>
                          {activeScore != null && (
                            <button
                              type="button"
                              className="text-muted-foreground underline hover:text-foreground"
                              onClick={() =>
                                setScores(s => ({ ...s, [key]: { ...cell, score: "" } }))
                              }
                            >
                              clear
                            </button>
                          )}
                        </div>

                        <Textarea
                          rows={2}
                          value={cell.note}
                          onChange={e =>
                            setScores(s => ({ ...s, [key]: { ...cell, note: e.target.value } }))
                          }
                          placeholder="Evidence, context, examples…"
                          className="mt-3"
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

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
              {reviewerName ? <> · by <span className="font-medium text-foreground">{reviewerName}</span></> : null}
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