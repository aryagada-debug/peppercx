import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, Save, Eye } from "lucide-react";
import SurveyWizard from "./SurveyWizard";
import { defaultConfig, PulseConfig } from "@/lib/pulseSurvey";
import { useUserRole } from "@/hooks/useUserRole";

export default function SurveyFormEditor() {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState<string>(JSON.stringify(defaultConfig, null, 2));
  const [rowId, setRowId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [parseErr, setParseErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pulse_survey_config" as any)
        .select("id, config")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = data as any;
      if (row?.id) setRowId(row.id);
      if (row?.config && row.config.steps) setText(JSON.stringify(row.config, null, 2));
      setLoading(false);
    })();
  }, []);

  const parsed: PulseConfig | null = useMemo(() => {
    try {
      const v = JSON.parse(text);
      if (!v?.steps) throw new Error("Missing 'steps' object.");
      setParseErr(null);
      return v as PulseConfig;
    } catch (e: any) {
      setParseErr(e.message || "Invalid JSON");
      return null;
    }
  }, [text]);

  const save = async () => {
    if (!parsed) {
      toast({ title: "Fix JSON first", description: parseErr || "" });
      return;
    }
    setSaving(true);
    try {
      if (rowId) {
        const { error } = await supabase.from("pulse_survey_config" as any).update({ config: parsed as any, updated_by: (await supabase.auth.getUser()).data.user?.id || null }).eq("id", rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("pulse_survey_config" as any).insert({ config: parsed as any, is_active: true }).select("id").single();
        if (error) throw error;
        setRowId((data as any).id);
      }
      toast({ title: "Saved", description: "Survey copy updated for all new respondents." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (!confirm("Reset to the default survey copy? Unsaved edits will be lost.")) return;
    setText(JSON.stringify(defaultConfig, null, 2));
  };

  if (loading) return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium text-sm">Survey copy (JSON)</div>
            <div className="text-xs text-muted-foreground">Edit eyebrows, questions, options. Save to publish.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={!isAdmin}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset</Button>
            <Button size="sm" onClick={save} disabled={!isAdmin || saving || !parsed}><Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
        {!isAdmin && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">Read-only — admins can edit.</div>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="w-full font-mono text-[11px] leading-snug border rounded p-2 bg-muted/30"
          style={{ height: "70vh", resize: "vertical" }}
        />
        {parseErr && <div className="text-xs text-destructive">JSON error: {parseErr}</div>}
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <div className="text-sm font-medium flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Live preview</div>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide" : "Show"}</Button>
        </div>
        {showPreview && (
          <div style={{ maxHeight: "75vh", overflow: "auto" }}>
            <SurveyWizard
              key={text}
              config={parsed || defaultConfig}
              preview
              headerSubtitle="Preview · sample data"
              initial={{ respondent: { role: "" as any, name: "Ananya", email: "ananya@example.com", company: "HDFC Bank", capabilities: [], wants_followup: "" } }}
              onSubmit={async () => ({ ok: true })}
            />
          </div>
        )}
      </Card>
    </div>
  );
}