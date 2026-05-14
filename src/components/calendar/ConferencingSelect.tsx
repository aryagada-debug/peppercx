import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video } from "lucide-react";

export type ConferencingType = "meet" | "teams" | "zoom" | "none";

interface Props {
  value: ConferencingType;
  onChange: (v: ConferencingType) => void;
  link: string;
  onLinkChange: (s: string) => void;
  compact?: boolean;
}

export function ConferencingSelect({ value, onChange, link, onLinkChange, compact }: Props) {
  const needLink = value === "teams" || value === "zoom";
  return (
    <div className={compact ? "space-y-2" : "space-y-2"}>
      <div>
        <Label className="text-xs flex items-center gap-1"><Video className="h-3 w-3" /> Conferencing</Label>
        <Select value={value} onValueChange={(v) => onChange(v as ConferencingType)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meet">Google Meet (auto-generate)</SelectItem>
            <SelectItem value="teams">Microsoft Teams (paste link)</SelectItem>
            <SelectItem value="zoom">Zoom (paste link)</SelectItem>
            <SelectItem value="none">No video link</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {needLink && (
        <div>
          <Label className="text-xs">{value === "teams" ? "Teams" : "Zoom"} meeting link</Label>
          <Input
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder={value === "teams" ? "https://teams.microsoft.com/l/meetup-join/…" : "https://zoom.us/j/…"}
            className="h-9"
          />
        </div>
      )}
    </div>
  );
}