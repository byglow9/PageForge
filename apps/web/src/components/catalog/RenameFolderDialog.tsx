"use client";
/**
 * RenameFolderDialog — dialog for renaming an existing folder.
 *
 * UI-SPEC copywriting:
 *   Title: "Rename folder"
 *   Name label: "Folder name"
 *   CTAs: "Cancel" (outline) + "Rename folder" (default)
 *   Success toast: "Folder renamed."
 *   Error toast: "Failed to rename folder. Try again."
 *   Inline validation: "Folder name is required."
 */

import { useState, useTransition, useEffect } from "react";
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
import { renameFolderAction } from "@/lib/catalog/actions";
import type { FolderModel } from "@/generated/prisma/models";

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: FolderModel;
  slug: string;
  onRenamed: () => void;
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  folder,
  slug,
  onRenamed,
}: RenameFolderDialogProps) {
  const [name, setName] = useState(folder.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync pre-fill when dialog opens with a (possibly different) folder
  useEffect(() => {
    if (open) {
      setName(folder.name);
      setNameError(null);
    }
  }, [open, folder.name]);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
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
      const result = await renameFolderAction(slug, {
        folderId: folder.id,
        name: trimmed,
      });
      if (result.ok) {
        toast.success("Folder renamed.");
        onRenamed();
        handleOpenChange(false);
      } else {
        toast.error("Failed to rename folder. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          <div className="py-4 space-y-2">
            <Label htmlFor="rename-folder-name">Folder name</Label>
            <Input
              id="rename-folder-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
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
              {isPending ? "Renaming…" : "Rename folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
