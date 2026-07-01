import { AppLayout } from "@/components/layout/AppLayout";
import { SlackReviewTab } from "@/components/rgy/SlackReviewTab";

export default function SlackReview() {
  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Slack Review</h1>
          <p className="text-sm text-muted-foreground">
            Slack channel connectivity and health across active retainer deals.
          </p>
        </div>
        <SlackReviewTab />
      </div>
    </AppLayout>
  );
}