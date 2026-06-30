import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, RefreshCw, Search, Send, Reply, LogOut, Inbox as InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  connectGmail, disconnectGmail, getGmail, listGmail, modifyGmail,
  useGmailStatus, type GmailMessage, type GmailMessageSummary,
} from "@/hooks/useGmail";
import { ComposeEmailDialog } from "@/components/email/ComposeEmailDialog";

export default function Inbox() {
  const { status, loading: statusLoading, refresh: refreshStatus } = useGmailStatus();
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<GmailMessage | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMeta, setReplyMeta] = useState<{ to: string; subject: string; threadId: string; replyTo: string; references: string } | null>(null);

  const load = useCallback(async (q?: string) => {
    if (!status.connected) return;
    setLoading(true);
    try {
      const data = await listGmail(q || "in:inbox", 25);
      setMessages(data.messages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load inbox");
    } finally { setLoading(false); }
  }, [status.connected]);

  useEffect(() => { if (status.connected) load(); }, [status.connected, load]);

  const openMessage = async (id: string) => {
    setActiveId(id); setActive(null); setActiveLoading(true);
    try {
      const m = await getGmail(id);
      setActive(m);
      if (m.labelIds.includes("UNREAD")) {
        await modifyGmail(id, { removeLabelIds: ["UNREAD"] }).catch(() => null);
        setMessages(prev => prev.map(x => x.id === id ? { ...x, unread: false, labelIds: x.labelIds.filter(l => l !== "UNREAD") } : x));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load message");
    } finally { setActiveLoading(false); }
  };

  const openReply = () => {
    if (!active) return;
    setReplyMeta({
      to: active.from,
      subject: active.subject.startsWith("Re: ") ? active.subject : `Re: ${active.subject}`,
      threadId: active.threadId,
      replyTo: active.messageId,
      references: [active.references, active.messageId].filter(Boolean).join(" "),
    });
    setComposeOpen(true);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {status.connected
                ? <>Connected as <span className="text-foreground font-medium">{status.googleEmail}</span></>
                : "Connect your Gmail to send and read emails from inside Pepper."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status.connected ? (
              <>
                <Button variant="outline" size="sm" onClick={() => load(search)} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
                </Button>
                <Button size="sm" onClick={() => { setReplyMeta(null); setComposeOpen(true); }}>
                  <Send className="h-4 w-4" /> Compose
                </Button>
                <Button variant="ghost" size="sm" onClick={async () => { await disconnectGmail(); toast.success("Gmail disconnected"); refreshStatus(); setMessages([]); setActive(null); setActiveId(null); }}>
                  <LogOut className="h-4 w-4" /> Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => connectGmail()} disabled={statusLoading}>
                <Mail className="h-4 w-4" /> Connect Gmail
              </Button>
            )}
          </div>
        </div>

        {!status.connected ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
            <InboxIcon className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium text-foreground">Your Gmail isn't connected yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Click <b>Connect Gmail</b> above to authorize. You'll be able to send and read emails from your own Gmail account.
              Each user connects their own account — nobody else can see your mail.
            </p>
          </div>
        ) : (
          <>
          {status.scopes !== undefined && !/(gmail\.send|gmail\.readonly|gmail\.modify)/.test(status.scopes || "") && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="text-xs text-foreground">
                Your Google account is connected but is missing Gmail permissions. Reconnect to enable sending and reading mail.
              </div>
              <Button size="sm" variant="outline" onClick={() => connectGmail()}>Reconnect Gmail</Button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 h-[calc(100vh-220px)]">
            <div className="rounded-lg border border-border bg-card flex flex-col overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search} onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") load(search || "in:inbox"); }}
                    placeholder="Search Gmail (e.g. from:alice)" className="h-8 pl-7 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-y-auto divide-y divide-border">
                {loading && <div className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading…</div>}
                {!loading && messages.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No messages</div>}
                {messages.map(m => (
                  <button key={m.id} onClick={() => openMessage(m.id)}
                    className={cn("w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors",
                      activeId === m.id && "bg-primary/5",
                      m.unread && "bg-blue-500/[0.03]")}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={cn("text-xs truncate", m.unread ? "font-semibold text-foreground" : "text-foreground")}>{m.from || "Unknown sender"}</span>
                      {m.date && <span className="text-[10px] text-muted-foreground shrink-0">{safeRelative(m.date)}</span>}
                    </div>
                    <div className={cn("text-xs truncate", m.unread ? "font-medium text-foreground" : "text-muted-foreground")}>{m.subject}</div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{m.snippet}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
              {!activeId && (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Select a message</div>
              )}
              {activeId && activeLoading && (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              )}
              {active && (
                <>
                  <div className="p-4 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">{active.subject}</h2>
                    <div className="mt-1 text-xs text-muted-foreground">
                      From: <span className="text-foreground">{active.from}</span> · {active.date && <span>{safeRelative(active.date)}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">To: {active.to}{active.cc ? ` · Cc: ${active.cc}` : ""}</div>
                    <div className="mt-2"><Button size="sm" variant="outline" onClick={openReply}><Reply className="h-3.5 w-3.5" /> Reply</Button></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {active.html ? (
                      <iframe title="email" srcDoc={active.html} sandbox="" className="w-full h-full border-0 bg-white rounded" />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">{active.text || active.snippet}</pre>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          </>
        )}
      </div>

      <ComposeEmailDialog
        open={composeOpen} onOpenChange={setComposeOpen}
        defaultTo={replyMeta?.to}
        defaultSubject={replyMeta?.subject}
        threadId={replyMeta?.threadId}
        replyToMessageId={replyMeta?.replyTo}
        references={replyMeta?.references}
        onSent={() => load(search)}
      />
    </AppLayout>
  );
}

function safeRelative(d: string) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }); } catch { return ""; }
}