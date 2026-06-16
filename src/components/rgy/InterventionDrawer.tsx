import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useIsLeadershipViewer } from "@/hooks/useIsLeadershipViewer";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export interface Intervention {
  id: string;
  deal_id: string;
  rgy_week: string | null;
  title: string;
  description: string;
  urgency: "High" | "Medium" | "Low" | string;
  status: "Open" | "Acknowledged" | "In Progress" | "Resolved" | string;
  raised_by_user_id: string;
  raised_by_name: string;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  body: string;
  author_name: string;
  user_id: string;
  created_at: string;
}

const STATUSES = ["Open", "Acknowledged", "In Progress", "Resolved"] as const;

const urgencyClass = (u: string) =>
  u === "High" ? "bg-destructive/10 text-destructive border-destructive/30"
  : u === "Medium" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-muted text-muted-foreground border-border";

const statusClass = (s: string) =>
  s === "Resolved" ? "bg-positive/10 text-positive border-positive/30"
  : s === "In Progress" ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
  : s === "Acknowledged" ? "bg-warning/10 text-warning border-warning/30"
  : "bg-destructive/10 text-destructive border-destructive/30";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intervention: Intervention | null;
  onChanged?: () => void;
  dealLabel?: string;
}

export function InterventionDrawer({ open, onOpenChange, intervention, onChanged, dealLabel }: Props) {
  const { user } = useAuth();
  const isLeader = useIsLeadershipViewer();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!intervention) return;
    setStatus(intervention.status);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("rgy_leadership_intervention_comments")
        .select("*")
        .eq("intervention_id", intervention.id)
        .order("created_at", { ascending: true });
      if (!cancelled) setComments((data || []) as Comment[]);
    })();
    return () => { cancelled = true; };
  }, [intervention]);

  if (!intervention) return null;

  const isRaiser = user?.id === intervention.raised_by_user_id;
  const canEditStatus = isLeader;
  const canDelete = isLeader || (isRaiser && intervention.status === "Open");

  const postComment = async () => {
    if (!user || !body.trim()) return;
    setPosting(true);
    try {
      const { data, error } = await supabase
        .from("rgy_leadership_intervention_comments")
        .insert({
          intervention_id: intervention.id,
          user_id: user.id,
          author_name: (user.user_metadata?.full_name as string) || user.email || "",
          body: body.trim(),
        })
        .select("*")
        .single();
      if (error) throw error;
      setComments((c) => [...c, data as Comment]);
      setBody("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  const changeStatus = async (next: string) => {
    setStatus(next);
    setWorking(true);
    try {
      const patch: any = { status: next };
      if (next === "Resolved") {
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by_user_id = user?.id;
      } else {
        patch.resolved_at = null;
        patch.resolved_by_user_id = null;
      }
      const { error } = await supabase
        .from("rgy_leadership_interventions")
        .update(patch)
        .eq("id", intervention.id);
      if (error) throw error;
      toast.success(`Status set to ${next}`);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
      setStatus(intervention.status);
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this intervention? This cannot be undone.")) return;
    setWorking(true);
    try {
      const { error } = await supabase
        .from("rgy_leadership_interventions")
        .delete()
        .eq("id", intervention.id);
      if (error) throw error;
      toast.success("Intervention deleted");
      onChanged?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setWorking(false);
    }
  };

  const removeComment = async (id: string) => {
    const prev = comments;
    setComments((cs) => cs.filter((c) => c.id !== id));
    const { error } = await supabase
      .from("rgy_leadership_intervention_comments")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      setComments(prev);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">{intervention.title}</SheetTitle>
          <SheetDescription>
            <Link to={`/deals/${intervention.deal_id}`} className="text-primary hover:underline">
              {dealLabel || intervention.deal_id}
            </Link>
            {intervention.rgy_week ? ` • Week of ${format(new Date(intervention.rgy_week), "MMM d, yyyy")}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={urgencyClass(intervention.urgency)}>{intervention.urgency}</Badge>
          {canEditStatus ? (
            <Select value={status} onValueChange={changeStatus} disabled={working}>
              <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={statusClass(intervention.status)}>{intervention.status}</Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Raised by {intervention.raised_by_name || "—"} • {format(new Date(intervention.created_at), "MMM d, yyyy")}
          </span>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
          {intervention.description || <span className="text-muted-foreground">No context provided.</span>}
        </div>

        <div className="mt-5 flex-1 overflow-y-auto pr-1">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Discussion</div>
          {comments.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No comments yet.</div>
          )}
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-card p-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-xs font-medium">{c.author_name || "—"}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                    {(c.user_id === user?.id || isLeader) && (
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => removeComment(c.id)} aria-label="Delete comment">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 border-t border-border pt-3 space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" rows={2} />
          <div className="flex items-center justify-between gap-2">
            <div>
              {canDelete && (
                <Button variant="ghost" size="sm" onClick={remove} disabled={working} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              )}
            </div>
            <Button size="sm" onClick={postComment} disabled={!body.trim() || posting}>
              {posting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Post
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}