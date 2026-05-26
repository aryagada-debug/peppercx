import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useStaffingQueries } from "@/hooks/queries/useStaffingQueries";
import { useStaffingMutations } from "@/hooks/queries/useStaffingMutations";
import { useCurrencyVersion } from "@/contexts/CurrencyContext";
import { PeopleReportingTable } from "@/components/settings/PeopleReportingTable";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function PeopleOps() {
  useCurrencyVersion();
  const { people, assignments, loading } = useStaffingQueries();
  const { addPerson, updatePerson, deletePerson } = useStaffingMutations();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePerson(confirmDelete.id);
      toast.success(`${confirmDelete.name} removed`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <div className="mb-4">
          <h1 className="text-subhead font-bold tracking-tight text-foreground">People Ops</h1>
          <p className="text-ui text-muted-foreground mt-1">
            {people.filter(p => !p.tbh).length} people • reporting, capacity &amp; utilisation
          </p>
        </div>
        <PeopleReportingTable
          people={people}
          assignments={assignments}
          onAdd={addPerson}
          onUpdate={updatePerson}
          onRequestDelete={(p) => setConfirmDelete({ id: p.id, name: p.name })}
        />
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the person from People Ops. Their staffing assignments will be unlinked.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}