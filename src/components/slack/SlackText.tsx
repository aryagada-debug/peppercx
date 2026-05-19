import type { ReactNode } from "react";

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function renderSlackText(text: string, users: Record<string, string>): ReactNode {
  if (!text) return null;
  const tokenRe = /<(@[UW][A-Z0-9]+(?:\|[^>]+)?|#[CG][A-Z0-9]+(?:\|[^>]+)?|!(?:(?:channel|here|everyone)(?:\|[^>]+)?|subteam\^[A-Z0-9]+(?:\|[^>]+)?)|https?:\/\/[^>]+)>/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(decodeEntities(text.slice(last, m.index)));
    const inner = m[1];
    if (inner.startsWith("@")) {
      const [id, label] = inner.slice(1).split("|");
      const name = label || users[id] || id;
      nodes.push(<span key={key++} className="text-primary font-medium">@{name}</span>);
    } else if (inner.startsWith("#")) {
      const [, label] = inner.slice(1).split("|");
      nodes.push(<span key={key++} className="text-primary font-medium">#{label || inner.slice(1)}</span>);
    } else if (inner.startsWith("!")) {
      const body = inner.slice(1);
      const [token, label] = body.split("|");
      nodes.push(<span key={key++} className="text-primary font-medium">@{label || (token.startsWith("subteam^") ? "group" : token)}</span>);
    } else {
      const url = inner.split("|")[0];
      nodes.push(<a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">URL</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(decodeEntities(text.slice(last)));

  const out: ReactNode[] = [];
  const bareUrlRe = /(https?:\/\/[^\s<>]+)/g;
  nodes.forEach((node, idx) => {
    if (typeof node !== "string") { out.push(node); return; }
    let lastIdx = 0;
    let bm: RegExpExecArray | null;
    while ((bm = bareUrlRe.exec(node)) !== null) {
      if (bm.index > lastIdx) out.push(node.slice(lastIdx, bm.index));
      out.push(<a key={`b-${idx}-${bm.index}`} href={bm[1]} target="_blank" rel="noopener noreferrer" className="text-primary underline">URL</a>);
      lastIdx = bm.index + bm[0].length;
    }
    if (lastIdx < node.length) out.push(node.slice(lastIdx));
  });
  return out;
}

export function slackMentionToken(id: string, label: string) {
  const safeLabel = label.replace(/[<>|]/g, "").trim() || id;
  return `<@${id}|${safeLabel}>`;
}

export function normalizeSlackMentionsForSend(text: string) {
  return text
    .replace(/<@([UW][A-Z0-9]+)\|[^>]+>/g, "<@$1>")
    .replace(/<!(channel|here|everyone)\|[^>]+>/g, "<!$1>")
    .replace(/<!subteam\^([A-Z0-9]+)\|[^>]+>/g, "<!subteam^$1>")
    .replace(/(^|\s)@all(?=\s|$)/gi, "$1<!channel>")
    .replace(/(^|\s)@(channel|here|everyone)(?=\s|$)/gi, (_match, lead, word) => `${lead}<!${word.toLowerCase()}>`);
}

export function getSlackMentionLabels(text: string, users: Record<string, string> = {}) {
  const labels: string[] = [];
  const tokenRe = /<@([UW][A-Z0-9]+)(?:\|([^>]+))?>|<!(channel|here|everyone)(?:\|([^>]+))?>|<!subteam\^[A-Z0-9]+(?:\|([^>]+))?>/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(text)) !== null) {
    const label = match[2] || (match[1] ? users[match[1]] || match[1] : "") || match[4] || match[3] || match[5] || "group";
    const display = `@${label}`;
    if (!labels.includes(display)) labels.push(display);
  }
  return labels;
}