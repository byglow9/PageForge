"use client";
/**
 * DeleteFolderDialog — confirmation dialog for deleting a folder.
 *
 * UI-SPEC copywriting (with D-03 reconciliation per plan spec):
 *   Title: "Delete folder?"
 *   Body: "This will delete the folder. Landing pages and subfolders inside
 *          will be moved to the root catalog."
 *   CTAs: "Keep folder" (outline) + "Delete folder" (destructive)
 *   Success toast: "Folder deleted."
 *   Error toast: "Failed to delete folder. Try again."
 *
 * Note: UI-SPEC body copy mentions only LPs; D-03 also re-parents subfolders.
 * The corrected copy (mentioning both LPs and subfolders) is used here per plan spec.
 */

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteFolderAction } from "@/lib/catalog/actions";
import type { FolderModel } from "@/generated/prisma/models";

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: FolderModel;
  slug: string;
  onDeleted: () => void;
}

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folder,
  slug,
  onDeleted,
}: DeleteFolderDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteFolderAction(slug, { folderId: folder.id });
      if (result.ok) {
        toast.success("Folder deleted.");
        onDeleted();
        onOpenChange(false);
      } else {
        toast.error("Failed to delete folder. Try again.");
        // Keep dialog open on error so user can retry
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder?</DialogTitle>
          <DialogDescription>
            This will delete the folder. Landing pages and subfolders inside
            will be moved to the root catalog.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Keep folder
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
