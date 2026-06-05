/**
 * DeleteTemplateDialog — confirmation dialog for template deletion.
 *
 * Per UI-SPEC:
 * - Title: "Delete template?"
 * - Body: "This will permanently delete "{name}" and cannot be undone."
 * - Destructive button: "Delete template"
 * - Cancel: "Keep template"
 *
 * Security: deleteTemplateAction is a server action that validates workspace
 * membership and filters by workspaceId before deleting (T-03-03-02).
 */
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteTemplateAction } from "@/lib/templates/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteTemplateDialogProps {
  templateId: string;
  templateName: string;
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteTemplateDialog({
  templateId,
  templateName,
  slug,
  open,
  onOpenChange,
  onDeleted,
}: DeleteTemplateDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteTemplateAction(slug, templateId);
      if (result.ok) {
        onDeleted();
        onOpenChange(false);
        toast.success("Template deleted.");
      } else {
        toast.error("Failed to delete. Try again.");
        // Keep dialog open on error so user can retry
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete template?</DialogTitle>
          <DialogDescription>
            This will permanently delete &ldquo;{templateName}&rdquo; and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Keep template
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
