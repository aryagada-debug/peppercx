import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { UsersTab } from "@/pages/admin/UsersTab";
import { AccessControlsTab } from "@/pages/admin/AccessControlsTab";
import { UsageTab } from "@/pages/admin/UsageTab";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import Targets from "@/pages/Targets";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

const tabs = [
  "Users & Roles",
  "Access Controls",
  "Usage",
  "Targets",
  "Notifications",
] as const;
type SettingsTab = typeof tabs[number];

export default function SettingsPage() {
  useCurrencyVersion();
  const [activeTab, setActiveTab] = useState<SettingsTab>("Users & Roles");
  const { isActuallyAdmin } = useUserRole();

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <h1 className="mb-6 text-subhead font-semibold tracking-tight text-foreground">Settings</h1>

        <div className="mb-6 border-b border-border">
          <div className="-mb-px flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-ui font-medium transition-colors",
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "Users & Roles" && (
          isActuallyAdmin ? (
            <UsersTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Access Controls" && (
          isActuallyAdmin ? (
            <AccessControlsTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Usage" && (
          isActuallyAdmin ? (
            <UsageTab />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Admin access required.</p>
            </div>
          )
        )}

        {activeTab === "Notifications" && (
          <NotificationsPanel />
        )}

        {activeTab === "Targets" && (
          <Targets embedded />
        )}
      </div>
    </AppLayout>
  );
}

// ── Notifications panel ────────────────────────────────────────────────────
function NotificationsPanel() {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("weekly_summary_opt_in").eq("user_id", user.id).maybeSingle();
      setOptIn(data?.weekly_summary_opt_in !== false);
      setLoading(false);
    })();
  }, [user]);
  const onToggle = async (v: boolean) => {
    setOptIn(v);
    await supabase.from("profiles").update({ weekly_summary_opt_in: v }).eq("user_id", user!.id);
    toast.success(v ? "You'll get the weekly summary on Slack every Monday" : "Weekly summary turned off");
  };
  const sendTest = async () => {
    if (!user?.email) return;
    setSendingTest(true);
    const { data, error } = await supabase.functions.invoke("weekly-summary-slack", { body: { onlyEmail: user.email } });
    setSendingTest(false);
    if (error) toast.error(error.message);
    else if (!(data as any)?.results?.length) toast.error("No matching Slack user found for your account");
    else if ((data as any).results[0].sent === false) toast.error("Send failed: " + ((data as any).results[0].error || "unknown"));
    else toast.success("Test summary sent — check your Slack DMs");
  };
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Weekly Slack summary</h2>
        <p className="text-xs text-muted-foreground mt-1">Every Monday at 10:00 IST you'll get a Slack DM recapping last week's tasks, MBRs and RGY updates plus what still needs attention. Scoped to your role: admins see all, VSDs see their team, BOPMs see their deals.</p>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">DM me the weekly summary</p>
          <p className="text-[11px] text-muted-foreground">Delivered via Slack to your linked account</p>
        </div>
        <Switch checked={optIn} onCheckedChange={onToggle} disabled={loading} />
      </div>
      <div className="border-t border-border pt-4">
        <button onClick={sendTest} disabled={sendingTest} className="text-xs text-primary hover:underline disabled:opacity-50">
          {sendingTest ? "Sending…" : "Send me a test Slack DM now"}
        </button>
      </div>
    </div>
  );
}


