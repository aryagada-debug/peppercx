import { HandoverWizard } from "@/components/handover/HandoverWizard";
import { Card } from "@/components/ui/card";

export default function PublicHandover() {
  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Pepper — Deal Handover</h1>
          <p className="text-sm text-muted-foreground">
            Sales — please share the deal details below. Your submission goes straight to the CX Handover queue.
          </p>
        </div>
        <Card className="p-2 md:p-4">
          <HandoverWizard mode="public" onSubmitted={() => { /* wizard shows its own confirmation */ }} />
        </Card>
        <p className="text-center text-[11px] text-muted-foreground">Pepper Content · centralcx@peppercontent.io</p>
      </div>
    </div>
  );
}