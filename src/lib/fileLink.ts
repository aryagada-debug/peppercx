import { FileText, FileSpreadsheet, Presentation, FileImage, FileVideo, File as FileIcon, Link as LinkIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const HOST_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /docs\.google\.com\/presentation/i, label: "Google Slides" },
  { match: /docs\.google\.com\/document/i, label: "Google Doc" },
  { match: /docs\.google\.com\/spreadsheets/i, label: "Google Sheet" },
  { match: /drive\.google\.com/i, label: "Google Drive file" },
  { match: /dropbox\.com/i, label: "Dropbox file" },
  { match: /onedrive\.live\.com|1drv\.ms|sharepoint\.com/i, label: "OneDrive file" },
  { match: /notion\.so/i, label: "Notion page" },
  { match: /figma\.com/i, label: "Figma file" },
  { match: /loom\.com/i, label: "Loom video" },
  { match: /youtube\.com|youtu\.be/i, label: "YouTube video" },
];

export function getLinkLabel(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    // 1. Filename in path?
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    const decoded = (() => { try { return decodeURIComponent(last); } catch { return last; } })();
    if (decoded && /\.[a-z0-9]{2,5}$/i.test(decoded)) {
      return decoded;
    }
    // 2. Known host labels
    for (const { match, label } of HOST_LABELS) {
      if (match.test(u.hostname + u.pathname)) return label;
    }
    // 3. Hostname fallback
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getFileExt(url: string): string {
  const label = getLinkLabel(url);
  const m = label.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : "";
}

export function getFileIcon(url: string): LucideIcon {
  const ext = getFileExt(url);
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return Presentation;
  if (["pdf"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return FileSpreadsheet;
  if (["doc", "docx", "odt", "rtf", "txt", "md"].includes(ext)) return FileText;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return FileImage;
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return FileVideo;

  try {
    const u = new URL(url);
    const host = u.hostname + u.pathname;
    if (/presentation|slides|loom\.com|youtube|youtu\.be/i.test(host)) return Presentation;
    if (/document|docs\.google\.com\/document|notion/i.test(host)) return FileText;
    if (/spreadsheets|sheets/i.test(host)) return FileSpreadsheet;
  } catch {
    // fall through
  }
  return url ? LinkIcon : FileIcon;
}