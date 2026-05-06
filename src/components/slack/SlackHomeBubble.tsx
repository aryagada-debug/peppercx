import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Minus, Send, Search, Hash, Lock, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SlackDmPanel } from "./SlackDmPanel";

interface Channel { id: string; name: string; is_private: boolean }
interface ChannelMsg { id: string; user_name: string; text: string; source: string; created_at: string; slack_ts: string }

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
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadChannels = async () => {
    setLoadingChannels(true);
    const { data, error } = await supabase.functions.invoke("slack-list-channels");
    setLoadingChannels(false);
    if (error || (data as any)?.error) {
      toast.error("Failed to load Slack channels");
      return;
    }
    setChannels(((data as any).channels) || []);
  };

  useEffect(() => { if (pickerOpen && channels.length === 0) loadChannels(); /* eslint-disable-next-line */ }, [pickerOpen]);

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
      .invoke("slack-channel-history", { body: { channelId, limit: 100 } })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadingMsgs(false);
        if (error || (data as any)?.error) {
          toast.error(`Failed to load history: ${(data as any)?.error || error?.message || "unknown"}`);
          setMessages([]);
          return;
        }
        setMessages(((data as any).messages as ChannelMsg[]) || []);
      });
    const ch = supabase
      .channel(`slack-home-ch-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "slack_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        const m = payload.new as ChannelMsg;
        if ((payload.new as any).dm_thread_id) return;
        setMessages(prev => prev.some(x => x.slack_ts === m.slack_ts) ? prev : [...prev, m]);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [channelId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const pick = (c: Channel) => {
    setChannelId(c.id);
    setChannelName(c.name);
    setPickerOpen(false);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !channelId || sending) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("slack-send", { body: { channelId, text } });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error(`Send failed: ${(data as any)?.error || error?.message || "unknown"}`);
      return;
    }
    setDraft("");
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
            <div className="whitespace-pre-wrap break-words">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="px-2 py-2 border-t border-border flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message #${channelName}…`}
          className="h-8 text-xs"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={sending}
        />
        <Button size="sm" className="h-8 px-2" onClick={send} disabled={sending || !draft.trim()}>
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}