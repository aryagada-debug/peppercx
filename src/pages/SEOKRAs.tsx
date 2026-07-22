import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EnterReviewTab } from "@/components/seo-kras/EnterReviewTab";
import { DashboardTab } from "@/components/seo-kras/DashboardTab";

export default function SEOKRAs() {
  const [tab, setTab] = useState("enter");
  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">SEO KRAs</h1>
          <p className="text-sm text-muted-foreground">
            Quarterly KRA scorecards for the SEO team. Enter reviews or track team performance in the dashboard.
          </p>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="enter">Enter review</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>
          <TabsContent value="enter" className="mt-4"><EnterReviewTab /></TabsContent>
          <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}