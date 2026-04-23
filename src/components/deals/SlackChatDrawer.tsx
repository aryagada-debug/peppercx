import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Search, Hash, Lock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SlackChatDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
  dealName: string;
  channelId: string;
  onChannelLinked: (channelId: string) => void;
}

interface SlackMessage {
  id: string;
  user_name: string;
  text: string;
  source: string;
  created_at: string;
  slack_ts: string;
}

interface Channel { id: string; name: string; is_private: boolean }

export function SlackChatDrawer({ open, onOpenChange, dealId, dealName, channelId, onChannelLinked }: SlackChatDrawerProps) {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [chSearch, setChSearch] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history when channel known
  useEffect(() => {
    if (!open || !channelId || !dealId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("slack_messages")
      .select("id,user_name,text,source,created_at,slack_ts")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error("Failed to load messages");
        setMessages((data as SlackMessage[]) || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, channelId, dealId]);

  // Realtime subscription
  useEffect(() => {
    if (!open || !dealId || !channelId) return;
    const ch = supabase
      .channel(`slack-${dealId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "slack_messages", filter: `deal_id=eq.${dealId}` }, (payload) => {
        const m = payload.new as SlackMessage;
        setMessages(prev => prev.some(x => x.slack_ts === m.slack_ts) ? prev : [...prev, m]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, dealId, channelId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const loadChannels = async () => {
    setLoadingChannels(true);
    const { data, error } = await supabase.functions.invoke("slack-list-channels");
    setLoadingChannels(false);
    if (error || (data as any)?.error) {
      toast.error("Failed to load Slack channels. Check SLACK_BOT_TOKEN.");
      return;
    }
    setChannels(((data as any).channels) || []);
  };

  // When opened without channelId, fetch channel list
  useEffect(() => {
    if (open && !channelId) loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channelId]);

  const filteredChannels = useMemo(() => {
    const q = chSearch.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(c => c.name.toLowerCase().includes(q));
  }, [channels, chSearch]);

  const linkChannel = async (ch: Channel) => {
    const { error } = await supabase.from("staffing_deals").update({ slack_channel_id: ch.id } as any).eq("id", dealId);
    if (error) { toast.error("Failed to link channel"); return; }
    toast.success(`Linked to #${ch.name}`);
    onChannelLinked(ch.id);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !channelId) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("slack-send", {
      body: { dealId, channelId, text },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error(`Send failed: ${(data as any)?.error || error?.message || "unknown"}`);
      return;
    }
    setDraft("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" /> Slack — {dealName}
          </SheetTitle>
        </SheetHeader>

        {!channelId ? (
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
            <p className="text-xs text-muted-foreground">Pick a Slack channel to link to this deal. Make sure the bot is a member of the channel.</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={chSearch} onChange={e => setChSearch(e.target.value)} placeholder="Search channels..." className="h-8 pl-7 text-xs" />
              </div>
              <Button size="sm" variant="ghost" onClick={loadChannels} disabled={loadingChannels}>
                <RefreshCw className={cn("h-3.5 w-3.5", loadingChannels && "animate-spin")} />
              </Button>
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
                  <span className="text-[10px] text-muted-foreground ml-auto font-mono">{ch.id}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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
            <div className="border-t border-border p-3 flex items-end gap-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Message #channel… (Enter to send, Shift+Enter for newline)"
                rows={2}
                className="flex-1 resize-none rounded-md border border-border bg-background text-xs p-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button size="sm" onClick={send} disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="px-3 pb-2 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Sending as you (your profile name in Slack)</span>
              <button className="hover:underline" onClick={() => onChannelLinked("")}>Change channel</button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}