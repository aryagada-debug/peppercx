import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { ensureGmailConnected, sendGmail } from "@/hooks/useGmail";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  threadId?: string;
  replyToMessageId?: string;
  references?: string;
  onSent?: () => void;
};

function parseList(v: string): string[] {
  return v.split(/[,;\n]/).map(s => s.trim()).filter(s => s.includes("@"));
}

export function ComposeEmailDialog({
  open, onOpenChange, defaultTo = "", defaultSubject = "", defaultBody = "",
  threadId, replyToMessageId, references, onSent,
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);

  const reset = () => {
    setTo(defaultTo); setCc(""); setBcc(""); setSubject(defaultSubject); setBody(defaultBody); setShowCc(false);
  };

  const handleSend = async () => {
    const toList = parseList(to);
    if (toList.length === 0) { toast.error("Add at least one recipient"); return; }
    if (!subject.trim()) { toast.error("Add a subject"); return; }
    if (!body.trim()) { toast.error("Write a message"); return; }
    setSending(true);
    try {
      const ok = await ensureGmailConnected();
      if (!ok) { setSending(false); return; }
      await sendGmail({
        to: toList,
        cc: parseList(cc),
        bcc: parseList(bcc),
        subject: subject.trim(),
        body: body.replace(/\n/g, "<br/>"),
        threadId, replyTo: replyToMessageId, references,
      });
      toast.success("Email sent");
      reset();
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{replyToMessageId ? "Reply" : "New email"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-12">To</label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" />
          </div>
          {!showCc && (
            <button onClick={() => setShowCc(true)} className="text-xs text-primary hover:underline">Add Cc / Bcc</button>
          )}
          {showCc && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12">Cc</label>
                <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12">Bcc</label>
                <Input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@example.com" />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-12">Subject</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
          </div>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={10} placeholder="Write your message…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}