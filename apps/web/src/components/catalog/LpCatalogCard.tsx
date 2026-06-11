"use client";
/**
 * LpCatalogCard — extends LpCard with folder badge, tag chips,
 * and "Move to folder…" / "Edit tags…" kebab items.
 *
 * Per UI-SPEC:
 * - Folder badge: Badge (variant: secondary) showing folder name. Gray, informational.
 * - Tag chips: up to 3 tags as Badge (variant: secondary) chips; "+N more" if >3.
 * - Additional kebab items (before "Duplicate"): "Move to folder…", "Edit tags…", separator.
 * - Move to folder: opens MoveLpDialog.
 * - Edit tags: opens inline TagInputDialog (modal around TagInput).
 * - On move success: toast "Moved to [folderName]." per UI-SPEC copy.
 * - On tag dialog close: router.refresh() to reload page with updated tags.
 *
 * Self-contained (does NOT import LpCard) so it can diverge independently.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { duplicateLpAction, deleteLpAction } from "@/lib/lps/actions";
import { MoveLpDialog } from "./MoveLpDialog";
import { TagInput } from "./TagInput";
import type { FolderModel, TagModel } from "@/generated/prisma/models";

// -----------------------------------------------------------------------
// DeleteLpDialog (inline — same pattern as LpCard)
// -----------------------------------------------------------------------

interface DeleteLpDialogProps {
  lpId: string;
  lpName: string;
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

function DeleteLpDialog({
  lpId,
  lpName,
  slug,
  open,
  onOpenChange,
  onDeleted,
}: DeleteLpDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteLpAction(slug, lpId);
      if (result.ok) {
        onDeleted();
        onOpenChange(false);
        toast.success("Landing page deleted.");
      } else {
        toast.error("Failed to delete. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete landing page?</DialogTitle>
          <DialogDescription>
            This will permanently delete &ldquo;{lpName}&rdquo; and cannot be
            undone. Any exported ZIPs you&apos;ve already downloaded are
            unaffected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Keep landing page
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete landing page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------
// TagInputDialog — inline modal wrapping TagInput
// -----------------------------------------------------------------------

interface TagInputDialogProps {
  lpId: string;
  slug: string;
  initialTags: TagModel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

function TagInputDialog({
  lpId,
  slug,
  initialTags,
  open,
  onOpenChange,
  onChanged,
}: TagInputDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tags</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <TagInput
            lpId={lpId}
            slug={slug}
            initialTags={initialTags}
            onChanged={onChanged}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------
// LpCatalogCard
// -----------------------------------------------------------------------

export interface LpCatalogCardProps {
  lp: {
    id: string;
    name: string;
    templateId: string | null;
    schemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
    folderId: string | null;
  };
  folders: FolderModel[];
  tags: TagModel[];
  slug: string;
}

export function LpCatalogCard({ lp, folders, tags, slug }: LpCatalogCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [isDuplicating, startDuplicateTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  // Optimistic folder tracking after move
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    lp.folderId
  );

  if (deleted) return null;

  // Resolve folder name from the flat folders list
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const folderName = currentFolderId ? (folderMap.get(currentFolderId)?.name ?? null) : null;

  const formattedDate = new Date(lp.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  function handleDuplicate() {
    setMenuOpen(false);
    startDuplicateTransition(async () => {
      const result = await duplicateLpAction(slug, lp.id);
      if (result.ok) {
        toast.success("Duplicate created.");
      } else {
        toast.error("Failed to duplicate. Try again.");
      }
    });
  }

  function handleExportZip() {
    setMenuOpen(false);
    setIsExporting(true);
    try {
      const a = document.createElement("a");
      a.href = `/api/lps/${lp.id}/export`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Export ready — downloading.");
    } catch {
      toast.error("Export failed. Try again.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleMoved(newFolderName: string | null) {
    // Find the folder by name to get its ID for optimistic update
    const movedFolder = folders.find((f) => f.name === newFolderName) ?? null;
    setCurrentFolderId(movedFolder?.id ?? null);
    router.refresh();
  }

  function handleTagsChanged() {
    router.refresh();
  }

  // Tag display: up to 3 visible chips + "+N more" if needed
  const visibleTags = tags.slice(0, 3);
  const extraCount = tags.length - visibleTags.length;

  return (
    <>
      <Card className="min-h-[120px]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="truncate text-base font-semibold text-gray-900">
              {lp.name}
            </span>
            <span className="shrink-0 text-sm text-gray-400 font-normal">
              v{lp.schemaVersion}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">{formattedDate}</p>

          {/* Folder badge + tag chips */}
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {/* Folder badge — only shown when LP is in a folder */}
            {folderName && (
              <Badge variant="secondary" className="text-xs">
                {folderName}
              </Badge>
            )}
            {/* Tag chips — up to 3 visible */}
            {visibleTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
            {/* "+N more" overflow badge */}
            {extraCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{extraCount} more
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          {/* Preview link */}
          <Link
            href={`/w/${slug}/lps/${lp.id}/preview`}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Preview
          </Link>
          {/* Edit link */}
          <Link
            href={`/w/${slug}/lps/${lp.id}/edit`}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          {/* Kebab menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Landing page options"
              disabled={isDuplicating || isExporting}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isDuplicating || isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 bottom-full mb-1 z-20 min-w-[160px] bg-white border border-gray-200 rounded-md shadow-md py-1">
                  {/* Move to folder — new item */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setMoveOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Move to folder…
                  </button>
                  {/* Edit tags — new item */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setTagDialogOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Edit tags…
                  </button>
                  {/* Separator before existing items */}
                  <div className="my-1 border-t border-gray-100" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={handleExportZip}
                    disabled={isExporting}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {isExporting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        Exporting…
                      </span>
                    ) : (
                      "Export ZIP"
                    )}
                  </button>
                  {/* Separator */}
                  <div className="my-1 border-t border-gray-100" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete landing page
                  </button>
                </div>
              </>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Delete confirmation dialog */}
      <DeleteLpDialog
        lpId={lp.id}
        lpName={lp.name}
        slug={slug}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => setDeleted(true)}
      />

      {/* Move to folder dialog */}
      <MoveLpDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        lp={{ id: lp.id, name: lp.name }}
        folders={folders}
        slug={slug}
        onMoved={handleMoved}
      />

      {/* Edit tags dialog */}
      <TagInputDialog
        lpId={lp.id}
        slug={slug}
        initialTags={tags}
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        onChanged={handleTagsChanged}
      />
    </>
  );
}
