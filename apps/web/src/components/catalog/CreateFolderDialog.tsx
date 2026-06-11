"use client";
/**
 * CreateFolderDialog — dialog for creating a new folder.
 *
 * UI-SPEC copywriting:
 *   Title: "New folder"
 *   Name label: "Folder name"
 *   CTAs: "Cancel" (outline) + "Create folder" (default)
 *   Success toast: "Folder created."
 *   Error toast: "Failed to create folder. Try again."
 *   Inline validation: "Folder name is required."
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFolderAction } from "@/lib/catalog/actions";
import type { FolderModel } from "@/generated/prisma/models";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  slug: string;
  onCreated: (folder: FolderModel) => void;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentId,
  slug,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      // Reset form state on close
      setName("");
      setNameError(null);
    }
    onOpenChange(isOpen);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Folder name is required.");
      return;
    }
    setNameError(null);

    startTransition(async () => {
      const result = await createFolderAction(slug, { name: trimmed, parentId });
      if (result.ok) {
        toast.success("Folder created.");
        // The action returns { id } — we need to construct a minimal folder for onCreated
        // The parent will refresh via router.refresh() or revalidatePath; pass the id.
        onCreated({ id: result.data.id } as FolderModel);
        handleOpenChange(false);
      } else {
        toast.error("Failed to create folder. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          <div className="py-4 space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder=""
              maxLength={64}
              disabled={isPending}
              autoFocus
            />
            {nameError && (
              <p className="text-sm text-red-600">{nameError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
