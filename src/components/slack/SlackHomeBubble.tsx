import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Minus, Send, Search, Hash, Lock, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SlackDmPanel } from "./SlackDmPanel";
import { getSlackMentionLabels, normalizeSlackMentionsForSend, renderSlackText, slackMentionToken } from "./SlackText";
import { loadSlackChannels } from "@/lib/slackChannels";

interface Channel { id: string; name: string; is_private: boolean }
interface ChannelMsg { id: string; user_name: string; text: string; source: string; created_at: string; slack_ts: string; dm_thread_id?: string | null }
interface ChannelListResponse { channels?: Channel[]; error?: string }
interface SlackHistoryResponse { messages?: ChannelMsg[]; users?: Record<string, string>; error?: string }
interface SlackSendResponse { ok?: boolean; ts?: string; error?: string }
interface SlackWorkspaceUser { id: string; name: string; real_name: string; display_name: string; email: string }
interface SlackUserListResponse { users?: SlackWorkspaceUser[]; error?: string }
type MentionOption = { id: string; label: string; token: string; sub?: string };

const BROADCASTS: MentionOption[] = [
  { id: "all", label: "all", token: "<!channel|all>", sub: "Notify everyone in this channel" },
  { id: "channel", label: "channel", token: "<!channel>", sub: "Notify everyone in this channel" },
  { id: "here", label: "here", token: "<!here>", sub: "Notify active members" },
  { id: "everyone", label: "everyone", token: "<!everyone>", sub: "Notify the whole workspace" },
];

/**
 * Unified Slack bubble for the Home page: lets the user choose between
 * messaging a Slack channel or a Slack user (DM) from a single floating widget.
 */
export function SlackHomeBubble() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"dm" | "channel">("dm");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:brightness-110 transition-all flex items-center gap-2 text-xs font-medium"
        title="Slack"
      >
        <MessageCircle className="h-4 w-4" /> Slack
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[380px] h-[540px] shadow-2xl rounded-md overflow-hidden bg-background border border-border flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-medium">Slack</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setOpen(false)} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "dm" | "channel")} className="flex-1 flex flex-col min-h-0">
        <div className="px-2 pt-2">
          <TabsList className="h-8 w-full grid grid-cols-2">
            <TabsTrigger value="dm" className="text-xs h-6">Direct message</TabsTrigger>
            <TabsTrigger value="channel" className="text-xs h-6">Channel</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dm" className="flex-1 min-h-0 mt-2">
          <SlackDmPanel scope="anyone" className="h-full border-0 rounded-none" />
        </TabsContent>
        <TabsContent value="channel" className="flex-1 min-h-0 mt-2">
          <ChannelChat />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChannelChat() {
  const [channelId, setChannelId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [chSearch, setChSearch] = useState("");
  const [messages, setMessages] = useState<ChannelMsg[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [wsUsers, setWsUsers] = useState<SlackWorkspaceUser[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      setChannels(await loadSlackChannels());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load Slack channels");
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (pickerOpen && channels.length === 0) loadChannels();
  }, [pickerOpen, channels.length]);

  const filtered = useMemo(() => {
    const q = chSearch.trim().toLowerCase();
    return q ? channels.filter(c => c.name.toLowerCase().includes(q)) : channels;
  }, [channels, chSearch]);

  // Load live history from Slack + subscribe to realtime inserts for new messages
  useEffect(() => {
    if (!channelId) { setMessages([]); return; }
    let cancelled = false;
    setLoadingMsgs(true);
    supabase.functions
      .invoke<SlackHistoryResponse>("slack-channel-history", { body: { channelId, limit: 100 } })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadingMsgs(false);
        if (error || data?.error) {
          toast.error(`Failed to load history: ${data?.error || error?.message || "unknown"}`);
          setMessages([]);
          return;
        }
        setMessages(data?.messages || []);
        setUserNames(data?.users || {});
      });
    const ch = supabase
      .channel(`slack-home-ch-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "slack_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        const m = payload.new as ChannelMsg;
        if (m.dm_thread_id) return;
        setMessages(prev => {
          const next = prev.some(x => x.slack_ts === m.slack_ts)
            ? prev.map(x => x.slack_ts === m.slack_ts ? { ...x, ...m } : x)
            : [...prev, m];
          return next.sort((a, b) => Number(a.slack_ts) - Number(b.slack_ts));
        });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [channelId]);

  useEffect(() => {
    if (!channelId || wsUsers.length > 0) return;
    supabase.functions.invoke<SlackUserListResponse>("slack-list-users").then(({ data, error }) => {
      if (error || data?.error) return;
      const users = data?.users || [];
      setWsUsers(users);
      setUserNames(prev => users.reduce((acc, u) => ({ ...acc, [u.id]: u.display_name || u.real_name || u.name || u.id }), prev));
    });
  }, [channelId, wsUsers.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const pick = (c: Channel) => {
    setChannelId(c.id);
    setChannelName(c.name);
    setPickerOpen(false);
  };

  const send = async () => {
    const text = normalizeSlackMentionsForSend(draft.trim());
    if (!text || !channelId || sending) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke<SlackSendResponse>("slack-send", { body: { channelId, text } });
    setSending(false);
    if (error || data?.error) {
      toast.error(`Send failed: ${data?.error || error?.message || "unknown"}`);
      return;
    }
    setDraft("");
  };

  const mentionOptions = useMemo<MentionOption[]>(() => {
    const q = mentionQuery.trim().toLowerCase();
    const broadcasts = BROADCASTS.filter(b => !q || b.label.startsWith(q));
    const users = wsUsers
      .filter(u => !q || u.display_name.toLowerCase().includes(q) || u.real_name.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 8)
      .map<MentionOption>(u => {
        const label = u.display_name || u.real_name || u.name || u.id;
        return { id: u.id, label, token: slackMentionToken(u.id, label), sub: u.email || u.real_name };
      });
    return [...broadcasts, ...users];
  }, [mentionQuery, wsUsers]);

  const onDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDraft(v);
    const caret = e.target.selectionStart ?? v.length;
    const upto = v.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at >= 0 && (at === 0 || /\s/.test(upto[at - 1]))) {
      const q = upto.slice(at + 1);
      if (!/\s/.test(q)) {
        setMentionStart(at);
        setMentionQuery(q);
        setMentionIdx(0);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
    setMentionStart(-1);
  };

  const insertMention = (opt: MentionOption) => {
    if (mentionStart < 0) return;
    const before = draft.slice(0, mentionStart);
    const after = draft.slice(mentionStart + 1 + mentionQuery.length);
    const insert = `${opt.token} `;
    const next = before + insert + after;
    setDraft(next);
    setMentionOpen(false);
    setMentionStart(-1);
    setMentionQuery("");
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  if (!channelId || pickerOpen) {
    return (
      <div className="h-full flex flex-col p-2 gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={chSearch} onChange={(e) => setChSearch(e.target.value)} placeholder="Search channels…" className="h-8 pl-7 text-xs" />
          </div>
          <Button size="sm" variant="ghost" className="h-8" onClick={loadChannels} disabled={loadingChannels}>
            <RefreshCw className={cn("h-3.5 w-3.5", loadingChannels && "animate-spin")} />
          </Button>
          {channelId && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPickerOpen(false)}>Cancel</Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto border border-border rounded-md">
          {loadingChannels ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No channels.</div>
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => pick(c)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 border-b border-border/40 last:border-0">
              {c.is_private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Hash className="h-3 w-3 text-muted-foreground" />}
              <span className="text-xs">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
        <Hash className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium flex-1 truncate">{channelName}</span>
        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setPickerOpen(true)}>Change</Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-muted/20">
        {loadingMsgs ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic text-center py-4">No messages yet.</div>
        ) : messages.map(m => (
          <div key={m.id} className="text-xs">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className={cn("font-medium", m.source === "app" ? "text-primary" : "text-foreground")}>{m.user_name || "Unknown"}</span>
              <span className="text-[9px] text-muted-foreground">{new Date(m.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</span>
            </div>
            <div className="whitespace-pre-wrap break-words">{renderSlackText(m.text, userNames)}</div>
          </div>
        ))}
      </div>
      <div className="px-2 py-2 border-t border-border flex items-center gap-1.5 relative">
        {mentionOpen && mentionOptions.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-10">
            {mentionOptions.map((opt, i) => (
              <button
                key={opt.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(opt); }}
                onMouseEnter={() => setMentionIdx(i)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 border-b border-border/40 last:border-0",
                  i === mentionIdx ? "bg-accent/50" : "hover:bg-accent/30"
                )}
              >
                <span className="font-medium text-primary">@{opt.label}</span>
                {opt.sub && <span className="text-[10px] text-muted-foreground truncate">{opt.sub}</span>}
              </button>
            ))}
          </div>
        )}
        <Input
          ref={inputRef}
          value={draft}
          onChange={onDraftChange}
          placeholder={`Message #${channelName}… Type @ to mention`}
          className="h-8 text-xs"
          onBlur={() => setTimeout(() => setMentionOpen(false), 120)}
          onKeyDown={(e) => {
            if (mentionOpen && mentionOptions.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionOptions.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionOptions.length) % mentionOptions.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionOptions[mentionIdx]); return; }
              if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
            }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          disabled={sending}
        />
        <Button size="sm" className="h-8 px-2" onClick={send} disabled={sending || !draft.trim()}>
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {getSlackMentionLabels(draft, userNames).length > 0 && (
        <div className="px-2 pb-2 flex flex-wrap gap-1">
          {getSlackMentionLabels(draft, userNames).map(label => (
            <span key={label} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-primary">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}