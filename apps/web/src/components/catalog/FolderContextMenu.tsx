"use client";
/**
 * FolderContextMenu — keyboard-accessible kebab menu for folder rows in FolderTree.
 *
 * Uses shadcn DropdownMenu (Base UI Menu via base-nova style) per UI-SPEC Plan 03.
 * Replaces the custom fixed-inset-0 backdrop + absolute-positioned div pattern.
 * DropdownMenu handles: focus trapping, keyboard navigation (ArrowUp/Down, Enter, Esc),
 * and portal positioning automatically.
 *
 * Menu items per UI-SPEC:
 *   - "New subfolder" (creates child folder)
 *   - "Rename"
 *   - separator
 *   - "Delete folder" (destructive / text-red-600)
 *
 * NO "Move folder" item — folder-to-folder move is out of v1 scope (D-02 deferred).
 *
 * Props: folder (for identity), onCreateSubfolder, onRename, onDelete.
 * The open/close state is managed internally by DropdownMenu.
 */

import { MoreHorizontal } from "lucide-react";
import type { FolderModel } from "@/generated/prisma/models";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface FolderContextMenuProps {
  folder: FolderModel;
  onCreateSubfolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function FolderContextMenu({
  onCreateSubfolder,
  onRename,
  onDelete,
}: FolderContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Folder options"
        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreateSubfolder}>
          New subfolder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={onDelete}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
