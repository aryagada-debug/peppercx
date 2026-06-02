import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, KeyRound } from "lucide-react";

interface DemoAccount {
  email: string;
  person: string;
  role: "VSD" | "BOPM" | "Cap Lead";
  pod?: string;
}

const DEMO_PASSWORD = "Demo@1234";

const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "aditya.shaw+demo@peppercontent.io", person: "Aditya Shaw", role: "VSD", pod: "BFSI" },
  { email: "neema.jayadas+demo@peppercontent.io", person: "Neema Jayadas", role: "VSD", pod: "US B2B" },
  { email: "aamir.khan+demo@peppercontent.io", person: "Aamir Khan", role: "VSD", pod: "Integrated" },
  { email: "sumit.shekhawat+demo@peppercontent.io", person: "Sumit Shekhawat", role: "VSD", pod: "India B2B" },
  { email: "sneha.iyer+demo@peppercontent.io", person: "Sneha Iyer", role: "VSD", pod: "FMCG" },
  { email: "ritu.shinde+demo@peppercontent.io", person: "Ritu Shinde", role: "BOPM", pod: "Group BOPM" },
  { email: "tiffany.fernandes+demo@peppercontent.io", person: "Tiffany Fernandes", role: "BOPM", pod: "Sr BOPM" },
  { email: "shreshtha.pathak+demo@peppercontent.io", person: "Shreshtha Pathak", role: "BOPM", pod: "Principal BOPM" },
  { email: "mayur.varade+demo@peppercontent.io", person: "Mayur Varade", role: "Cap Lead", pod: "SEO Capability" },
  { email: "vedanga.bandyopadhyay+demo@peppercontent.io", person: "Vedanga Bandyopadhyay", role: "Cap Lead", pod: "SEO Capability" },
];

export function DemoLoginsCard() {
  const [provisioning, setProvisioning] = useState(false);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    );
  };

  const provision = async () => {
    setProvisioning(true);
    const { data, error } = await supabase.functions.invoke("admin-user-mgmt", {
      body: { action: "provision_demo_logins" },
    });
    setProvisioning(false);
    if (error) {
      toast.error(error.message || "Failed to provision demo logins");
      return;
    }
    const created = (data?.results || []).filter((r: any) => r.status === "created").length;
    const reset = (data?.results || []).filter((r: any) => r.status === "reset").length;
    const errs = (data?.results || []).filter((r: any) => r.status === "error").length;
    toast.success(`Demo logins ready — created ${created}, reset ${reset}${errs ? `, ${errs} errors` : ""}`);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2.5">
        <div>
          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            Demo logins (VSDs & BOPMs)
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Sign in with any of these to preview the app under that persona. Password is the same for all: <span className="font-mono text-foreground">{DEMO_PASSWORD}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => copy(DEMO_PASSWORD, "Password")}>
            <Copy className="h-3 w-3 mr-1" /> Copy password
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={provisioning} onClick={provision}>
            {provisioning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            Provision / repair
          </Button>
        </div>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-secondary/20">
            {["Person", "Role", "Pod / Notes", "Email", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEMO_ACCOUNTS.map((a) => (
            <tr key={a.email} className="border-b border-border/50 hover:bg-secondary/30">
              <td className="px-3 py-2 font-medium text-foreground">{a.person}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    a.role === "VSD"
                      ? "bg-primary/15 text-primary"
                      : a.role === "Cap Lead"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-accent/40 text-foreground"
                  }`}
                >
                  {a.role}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{a.pod}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-foreground">{a.email}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => copy(a.email, "Email")}>
                  <Copy className="h-3 w-3" />
                </Button>
                <a
                  href={`/login?email=${encodeURIComponent(a.email)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline ml-1"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}