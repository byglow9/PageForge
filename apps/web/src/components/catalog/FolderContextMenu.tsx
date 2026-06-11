"use client";
/**
 * FolderContextMenu — kebab menu for folder rows in FolderTree.
 *
 * Uses the same custom div pattern as LpCard (not shadcn DropdownMenu —
 * that is reserved for Plan 03 when dropdown-menu is installed).
 *
 * Menu items per UI-SPEC:
 *   - "New subfolder" (creates child folder)
 *   - "Rename"
 *   - separator
 *   - "Delete folder" (text-red-600)
 *
 * NO "Move folder" item — folder-to-folder move is out of v1 scope (D-02 deferred).
 */

import { MoreHorizontal } from "lucide-react";
import type { FolderModel } from "@/generated/prisma/models";

interface FolderContextMenuProps {
  folder: FolderModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSubfolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function FolderContextMenu({
  open,
  onOpenChange,
  onCreateSubfolder,
  onRename,
  onDelete,
}: FolderContextMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        aria-label="Folder options"
        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
            }}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full mt-0.5 z-20 min-w-[160px] bg-white border border-gray-200 rounded-md shadow-md py-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                onCreateSubfolder();
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              New subfolder
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                onRename();
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Rename
            </button>
            {/* Separator */}
            <div className="my-1 border-t border-gray-100" aria-hidden="true" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                onDelete();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete folder
            </button>
          </div>
        </>
      )}
    </div>
  );
}
