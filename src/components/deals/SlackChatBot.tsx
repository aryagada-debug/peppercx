import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Send, Search, Hash, Lock, RefreshCw,
  MessageSquare, X, Minus, Link2Off,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SlackChatBotProps {
  dealId: string;
  dealName: string;
}

interface SlackMessage {
  id: string;
  channel_id?: string;
  dm_thread_id?: string | null;
  user_name: string;
  text: string;
  source: string;
  created_at: string;
  slack_ts: string;
}

interface Channel { id: string; name: string; is_private: boolean }
interface ChannelListResponse { channels?: Channel[]; error?: string }
interface SlackHistoryResponse { messages?: SlackMessage[]; error?: string }
interface SlackSendResponse { ok?: boolean; ts?: string; error?: string }

export function SlackChatBot({ dealId, dealName }: SlackChatBotProps) {
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState<string>("");
  const [channelName, setChannelName] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [chSearch, setChSearch] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load linked channel for this deal
  useEffect(() => {
    if (!dealId) return;
    supabase
      .from("staffing_deals")
      .select("slack_channel_id")
      .eq("id", dealId)
      .maybeSingle()
      .then(({ data }) => {
        setChannelId(data?.slack_channel_id || "");
      });
  }, [dealId]);

  // Resolve channel name when channelId is set
  useEffect(() => {
    if (!channelId) { setChannelName(""); return; }
    const found = channels.find(c => c.id === channelId);
    if (found) setChannelName(found.name);
  }, [channelId, channels]);

  // Load live Slack history when chat opens with linked channel.
  useEffect(() => {
    if (!open || !channelId || !dealId) return;
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke<SlackHistoryResponse>("slack-channel-history", { body: { channelId, limit: 100 } })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error || data?.error) {
          toast.error(`Failed to load history: ${data?.error || error?.message || "unknown"}`);
          setMessages([]);
          return;
        }
        setMessages(data?.messages || []);
      });
    return () => { cancelled = true; };
  }, [open, channelId, dealId]);

  // Realtime subscription
  useEffect(() => {
    if (!open || !dealId || !channelId) return;
    const ch = supabase
      .channel(`slack-bot-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "slack_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        const m = payload.new as SlackMessage;
        if (m.dm_thread_id) return;
        setMessages(prev => {
          const next = prev.some(x => x.slack_ts === m.slack_ts)
            ? prev.map(x => x.slack_ts === m.slack_ts ? { ...x, ...m } : x)
            : [...prev, m];
          return next.sort((a, b) => Number(a.slack_ts) - Number(b.slack_ts));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, dealId, channelId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, open]);

  const loadChannels = async () => {
    setLoadingChannels(true);
    const { data, error } = await supabase.functions.invoke<ChannelListResponse>("slack-list-channels");
    setLoadingChannels(false);
    if (error || data?.error) {
      toast.error("Failed to load Slack channels. Check SLACK_BOT_TOKEN.");
      return;
    }
    setChannels(data?.channels || []);
  };

  // Auto-load channels when picker opens
  useEffect(() => {
    if (pickerOpen && channels.length === 0) loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  const filteredChannels = useMemo(() => {
    const q = chSearch.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(c => c.name.toLowerCase().includes(q));
  }, [channels, chSearch]);

  const linkChannel = async (ch: Channel) => {
    const { error } = await supabase.from("staffing_deals").update({ slack_channel_id: ch.id }).eq("id", dealId);
    if (error) { toast.error("Failed to link channel"); return; }
    toast.success(`Linked to #${ch.name}`);
    setChannelId(ch.id);
    setChannelName(ch.name);
    setPickerOpen(false);
    setMessages([]);
  };

  const unlinkChannel = async () => {
    const { error } = await supabase.from("staffing_deals").update({ slack_channel_id: "" }).eq("id", dealId);
    if (error) { toast.error("Failed to unlink channel"); return; }
    toast.success("Channel unlinked");
    setChannelId("");
    setChannelName("");
    setMessages([]);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !channelId) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke<SlackSendResponse>("slack-send", {
      body: { dealId, channelId, text },
    });
    setSending(false);
    if (error || data?.error) {
      toast.error(`Send failed: ${data?.error || error?.message || "unknown"}`);
      return;
    }
    setDraft("");
  };

  // Floating bubble (collapsed)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        title="Open Slack chat"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-3rem)] rounded-xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border bg-primary/5 flex items-center gap-2">
        <Hash className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{dealName}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {channelName ? `#${channelName}` : channelId ? `Channel ${channelId}` : "No channel linked"}
          </div>
        </div>
        {channelId && !pickerOpen && (
          <>
            <button
              onClick={() => setPickerOpen(true)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Change channel"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={unlinkChannel}
              className="text-muted-foreground hover:text-destructive p-1"
              title="Unlink channel"
            >
              <Link2Off className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1" title="Minimize">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1" title="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {(!channelId || pickerOpen) ? (
        <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
          <p className="text-[11px] text-muted-foreground">
            {pickerOpen ? "Pick a different Slack channel." : "Link a Slack channel to start chatting. Make sure the bot is in the channel."}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={chSearch} onChange={e => setChSearch(e.target.value)} placeholder="Search channels..." className="h-8 pl-7 text-xs" />
            </div>
            <Button size="sm" variant="ghost" onClick={loadChannels} disabled={loadingChannels}>
              <RefreshCw className={cn("h-3.5 w-3.5", loadingChannels && "animate-spin")} />
            </Button>
            {pickerOpen && channelId && (
              <Button size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>Cancel</Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto border border-border rounded-lg">
            {loadingChannels ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filteredChannels.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No channels found.</div>
            ) : filteredChannels.map(ch => (
              <button key={ch.id} onClick={() => linkChannel(ch)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/30 border-b border-border/50 last:border-0">
                {ch.is_private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Hash className="h-3 w-3 text-muted-foreground" />}
                <span className="text-xs font-medium text-foreground">{ch.name}</span>
                {ch.id === channelId && <span className="text-[9px] text-primary ml-1">linked</span>}
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">{ch.id}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No messages yet. Send the first one!</p>
            ) : messages.map(m => (
              <div key={m.id} className="text-xs">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={cn("font-semibold", m.source === "app" ? "text-primary" : "text-foreground")}>{m.user_name || "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</span>
                </div>
                <div className="text-foreground/90 whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-2.5 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message #channel… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-md border border-border bg-background text-xs p-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button size="sm" onClick={send} disabled={sending || !draft.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="px-3 pb-2 text-[10px] text-muted-foreground">
            Sending as you (your profile name in Slack)
          </div>
        </>
      )}
    </div>
  );
}
