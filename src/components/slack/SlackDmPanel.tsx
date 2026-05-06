import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Search, MessageSquare, X, ArrowLeft, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Slack DM panel — lets the logged-in user start/continue 1:1 DMs with any Slack
 * workspace user (when `scope="anyone"`) or only with people in `staffing_people`
 * (when `scope="staffing"`).
 */
export type SlackDmScope = "anyone" | "staffing";

interface DmThread {
  id: string;
  slack_user_id: string;
  slack_user_name: string;
  slack_user_email: string;
  im_channel_id: string;
  last_message_at: string | null;
}

interface DmMessage {
  id: string;
  user_name: string;
  text: string;
  source: string;
  created_at: string;
  slack_ts: string;
  sent_by_app_user: string | null;
}

interface StaffingPersonLite {
  id: string;
  name: string;
  email: string;
}

export function SlackDmPanel({ scope = "anyone", className }: { scope?: SlackDmScope; className?: string }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [activeThread, setActiveThread] = useState<DmThread | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [staffingPeople, setStaffingPeople] = useState<StaffingPersonLite[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load threads
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("slack_dm_threads")
      .select("id,slack_user_id,slack_user_name,slack_user_email,im_channel_id,last_message_at")
      .eq("app_user_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        if (!cancelled) setThreads((data as DmThread[]) || []);
      });
    const ch = supabase
      .channel(`dm-threads-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "slack_dm_threads", filter: `app_user_id=eq.${user.id}` }, () => {
        supabase
          .from("slack_dm_threads")
          .select("id,slack_user_id,slack_user_name,slack_user_email,im_channel_id,last_message_at")
          .eq("app_user_id", user.id)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .then(({ data }) => setThreads((data as DmThread[]) || []));
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  // Staffing people for the picker (only when scope === "staffing")
  useEffect(() => {
    if (scope !== "staffing") return;
    supabase.from("staffing_people").select("id,name,email").eq("leaving", false).then(({ data }) => {
      setStaffingPeople(((data as any[]) || []).filter(p => p.email));
    });
  }, [scope]);

  // Load messages for active thread
  useEffect(() => {
    if (!activeThread) { setMessages([]); return; }
    let cancelled = false;
    setLoadingMsgs(true);
    supabase
      .from("slack_messages")
      .select("id,user_name,text,source,created_at,slack_ts,sent_by_app_user")
      .eq("dm_thread_id", activeThread.id)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        setMessages((data as DmMessage[]) || []);
        setLoadingMsgs(false);
      });
    const ch = supabase
      .channel(`dm-msgs-${activeThread.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "slack_messages", filter: `dm_thread_id=eq.${activeThread.id}` }, (payload) => {
        const m = payload.new as DmMessage;
        setMessages(prev => prev.some(x => x.slack_ts === m.slack_ts) ? prev : [...prev, m]);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeThread]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const startThreadByEmail = async (email: string, name?: string) => {
    if (!email && !name) return;
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-resolve-user", { body: { email, name } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const t = (data as any).thread as DmThread;
      setThreads(prev => prev.some(x => x.id === t.id) ? prev : [t, ...prev]);
      setActiveThread(t);
      setFindOpen(false);
      setFindQuery("");
    } catch (e: any) {
      toast.error(e?.message === "user_not_found" ? "Not found in Slack" : `Failed: ${e?.message || e}`);
    } finally { setResolving(false); }
  };

  const send = async () => {
    if (!activeThread || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const { data, error } = await supabase.functions.invoke("slack-send", {
        body: { recipientType: "user", dmThreadId: activeThread.id, text },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    } catch (e: any) {
      toast.error(`Failed: ${e?.message || e}`);
      setDraft(text);
    } finally { setSending(false); }
  };

  const filteredStaffing = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return staffingPeople.slice(0, 30);
    return staffingPeople.filter(p =>
      p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [staffingPeople, findQuery]);

  return (
    <div className={cn("flex flex-col h-full bg-background border border-border rounded-md overflow-hidden", className)}>
      {!activeThread ? (
        <>
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" /> Slack DMs
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setFindOpen(true)}>
              <UserPlus className="h-3 w-3 mr-1" /> New
            </Button>
          </div>
          {findOpen && (
            <div className="px-3 py-2 border-b border-border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 opacity-60" />
                <Input
                  autoFocus
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  placeholder={scope === "staffing" ? "Search teammates by name or email" : "Email (e.g. jane@company.com)"}
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && scope === "anyone" && findQuery.includes("@")) {
                      startThreadByEmail(findQuery.trim());
                    }
                  }}
                />
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setFindOpen(false); setFindQuery(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {scope === "staffing" && (
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredStaffing.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground italic px-1 py-2">No matches</div>
                  ) : filteredStaffing.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => startThreadByEmail(p.email, p.name)}
                      disabled={resolving}
                      className="w-full text-left px-2 py-1 rounded text-xs hover:bg-secondary/60 flex items-center justify-between"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-[10px]">{p.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {scope === "anyone" && findQuery.includes("@") && (
                <Button size="sm" className="h-7 text-xs w-full" disabled={resolving} onClick={() => startThreadByEmail(findQuery.trim())}>
                  {resolving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Start DM with {findQuery.trim()}
                </Button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No DMs yet. Click <span className="font-medium">New</span> to start one.
              </div>
            ) : threads.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveThread(t)}
                className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-secondary/40"
              >
                <div className="text-xs font-medium">{t.slack_user_name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.slack_user_email}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setActiveThread(null)}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{activeThread.slack_user_name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{activeThread.slack_user_email}</div>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 bg-muted/20">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Loading…
              </div>
            ) : messages.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic text-center py-4">Say hi 👋</div>
            ) : messages.map(m => {
              const mine = !!m.sent_by_app_user;
              return (
                <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-md px-2 py-1 text-xs whitespace-pre-wrap break-words",
                    mine ? "bg-primary text-primary-foreground" : "bg-background border border-border"
                  )}>
                    {m.text}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-0.5">{m.user_name}</span>
                </div>
              );
            })}
          </div>
          <div className="px-2 py-2 border-t border-border flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message…"
              className="h-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={sending}
            />
            <Button size="sm" className="h-8 px-2" onClick={send} disabled={sending || !draft.trim()}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}