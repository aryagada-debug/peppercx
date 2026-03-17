import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

const users = [
  { name: "Anirudh Kumar", email: "anirudh@pepper.com", role: "Admin", pod: "Central CX", status: "Active" },
  { name: "Priya Shah", email: "priya@pepper.com", role: "Admin", pod: "Central CX", status: "Active" },
  { name: "Rahul Sharma", email: "rahul@pepper.com", role: "VSD", pod: "Pod A", status: "Active" },
  { name: "Meera Thakur", email: "meera@pepper.com", role: "VSD", pod: "Pod B", status: "Active" },
  { name: "Vikram Joshi", email: "vikram@pepper.com", role: "Group BOPM", pod: "Pod B", status: "Active" },
  { name: "Sneha Pillai", email: "sneha@pepper.com", role: "Capability Lead", pod: "Content", status: "Active" },
  { name: "Deepak Rao", email: "deepak@pepper.com", role: "Capability Lead", pod: "SEO", status: "Active" },
];

const tabs = ["Users & Roles", "Sheets Sync", "Slack Config", "Notifications"];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-subhead font-semibold tracking-tight text-foreground mb-6">Settings</h1>

        <div className="border-b border-border mb-6">
          <div className="flex gap-0 -mb-px">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                className={cn(
                  "px-4 py-2.5 text-ui font-medium transition-colors border-b-2",
                  i === 0 ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="data-card p-0 overflow-hidden">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Name", "Email", "Role", "Pod/Team", "Status"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground text-caption uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.email} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{u.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-md text-caption font-medium bg-secondary text-foreground">{u.role}</span></td>
                  <td className="py-3 px-4 text-muted-foreground">{u.pod}</td>
                  <td className="py-3 px-4 text-positive font-medium">{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
