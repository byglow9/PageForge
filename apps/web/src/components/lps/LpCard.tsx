"use client";
/**
 * LpCard — card component for the LP list grid.
 *
 * Per UI-SPEC:
 * - Header: LP name (text-base font-semibold) + "from template v{N}" muted text.
 * - Body: formatted date.
 * - Footer: Preview link, Edit link, kebab MoreHorizontal menu.
 * - Kebab menu items: "Duplicate", "Export ZIP", separator, "Delete landing page".
 *
 * Duplicate: immediate action (no dialog, D-12 per UI-SPEC LP-03).
 * Delete: confirmation dialog (DeleteLpDialog).
 *
 * Per D-12: duplicateLpAction creates a fully independent copy — editing copy
 * never affects origin.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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

// -----------------------------------------------------------------------
// DeleteLpDialog
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
        // Keep dialog open on error so user can retry
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
// LpCard
// -----------------------------------------------------------------------

export interface LpCardProps {
  lp: {
    id: string;
    name: string;
    templateId: string | null;
    schemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
  };
  slug: string;
}

export function LpCard({ lp, slug }: LpCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [isDuplicating, startDuplicateTransition] = useTransition();

  if (deleted) return null;

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
    // Navigate to export route handler (implemented in Plan 04)
    window.location.href = `/api/lps/${lp.id}/export`;
  }

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
              disabled={isDuplicating}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isDuplicating ? (
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
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Export ZIP
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

      <DeleteLpDialog
        lpId={lp.id}
        lpName={lp.name}
        slug={slug}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => setDeleted(true)}
      />
    </>
  );
}
