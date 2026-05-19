import type { ReactNode } from "react";

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function renderSlackText(text: string, users: Record<string, string>): ReactNode {
  if (!text) return null;
  const tokenRe = /<(@[UW][A-Z0-9]+(?:\|[^>]+)?|#[CG][A-Z0-9]+(?:\|[^>]+)?|!(?:channel|here|everyone|subteam\^[A-Z0-9]+(?:\|[^>]+)?)|https?:\/\/[^>]+)>/g;
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
      const parts = body.split("|");
      nodes.push(<span key={key++} className="text-primary font-medium">@{body.startsWith("subteam^") ? parts[1] || "group" : body}</span>);
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