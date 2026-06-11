"use client";
/**
 * MoveLpDialog — dialog for moving an LP to a folder.
 *
 * UI-SPEC copywriting:
 *   Title: "Move to folder"
 *   CTAs: "Cancel" (outline) + "Move here" (default)
 *   Root option: "Root (All LPs)" = folderId null (D-01)
 *   Success toast: "Moved to [folder name]." or "Moved to All LPs."
 *   Error toast: "Failed to move. Try again."
 *
 * Lists all workspace folders in a flat indented list.
 * Depth indentation follows the same 16px/level pattern as FolderTree.
 */

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { moveLpAction } from "@/lib/catalog/actions";
import type { FolderModel } from "@/generated/prisma/models";

interface MoveLpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lp: { id: string; name: string };
  folders: FolderModel[];
  slug: string;
  onMoved: (folderName: string | null) => void;
}

/** Compute depth of a folder by walking up the adjacency list. */
function getFolderDepth(
  folderId: string,
  folderMap: Map<string, FolderModel>
): number {
  let depth = 0;
  let current = folderMap.get(folderId);
  while (current?.parentId) {
    depth++;
    current = folderMap.get(current.parentId);
  }
  return depth;
}

export function MoveLpDialog({
  open,
  onOpenChange,
  lp,
  folders,
  slug,
  onMoved,
}: MoveLpDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const folderMap = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders]
  );

  function handleMove() {
    startTransition(async () => {
      const result = await moveLpAction(slug, {
        lpId: lp.id,
        folderId: selectedFolderId,
      });
      if (result.ok) {
        const folderName = result.data.folderName;
        toast.success(
          folderName ? `Moved to ${folderName}.` : "Moved to All LPs."
        );
        onMoved(folderName);
        onOpenChange(false);
      } else {
        toast.error("Failed to move. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
        </DialogHeader>

        <div className="py-2 max-h-64 overflow-y-auto">
          {/* Root option */}
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={[
              "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
              selectedFolderId === null
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Root (All LPs)
          </button>

          {/* Folder list — flat with depth indent (16px × depth) */}
          {folders.map((folder) => {
            const depth = getFolderDepth(folder.id, folderMap);
            const isSelected = selectedFolderId === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
                className={[
                  "w-full text-left py-2 pr-3 text-sm rounded-md transition-colors",
                  isSelected
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                {folder.name}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleMove} disabled={isPending}>
            {isPending ? "Moving…" : "Move here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
