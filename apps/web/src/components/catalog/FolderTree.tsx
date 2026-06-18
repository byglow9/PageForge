"use client";
/**
 * FolderTree — recursive folder tree for the catalog left panel.
 *
 * Per UI-SPEC:
 * - Root item "All LPs" (always first, not deletable) — activates when selectedFolderId === null.
 * - Each folder row: h-8, padding-left = depth × 16px + base 8px.
 * - ChevronRight/ChevronDown icon 14px for expand/collapse.
 * - Folder icon (Folder from lucide-react) 14px.
 * - Name text-sm truncate.
 * - MoreHorizontal 14px button (aria-label="Folder options") triggers FolderContextMenu.
 *   Only shown when canManage=true.
 * - All interactive elements are button elements (UI-SPEC accessibility).
 * - aria-expanded={boolean} on the folder button.
 * - "New folder" button at the top of the panel.
 *
 * Tree is assembled client-side from the flat adjacency list (folder.parentId).
 * router.refresh() is called after successful mutations to re-fetch the folder list
 * from the RSC page.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  Plus,
} from "lucide-react";
import type { FolderModel } from "@/generated/prisma/models";
import { FolderContextMenu } from "./FolderContextMenu";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { RenameFolderDialog } from "./RenameFolderDialog";
import { DeleteFolderDialog } from "./DeleteFolderDialog";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface DialogState {
  type: "create" | "rename" | "delete" | null;
  folder: FolderModel | null;
  parentId: string | null;
}

interface FolderTreeProps {
  folders: FolderModel[];
  selectedFolderId: string | null;
  slug: string;
  onFolderSelect: (id: string | null) => void;
  canManage: boolean;
}

// -----------------------------------------------------------------------
// FolderNode — recursive row renderer
// -----------------------------------------------------------------------

interface FolderNodeProps {
  folder: FolderModel;
  depth: number;
  childrenMap: Map<string | null, FolderModel[]>;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  selectedFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
  canManage: boolean;
  onDialogOpen: (state: DialogState) => void;
  slug: string;
}

function FolderNode({
  folder,
  depth,
  childrenMap,
  expandedIds,
  onToggleExpand,
  selectedFolderId,
  onFolderSelect,
  canManage,
  onDialogOpen,
}: FolderNodeProps) {
  const children = childrenMap.get(folder.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  // padding-left = depth × 16px + base 8px (UI-SPEC: 16px per level)
  const paddingLeft = depth * 16 + 8;

  return (
    <>
      <div
        className={[
          "group relative flex items-center h-8 gap-1 rounded-md pr-1 cursor-pointer",
          isSelected
            ? "bg-white shadow-sm ring-1 ring-gray-200 font-semibold text-gray-900"
            : "text-gray-700 hover:bg-white/80",
        ].join(" ")}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {/* Expand/collapse chevron button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(folder.id);
          }}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )
          ) : (
            // Spacer to maintain alignment when no children
            <span className="h-3.5 w-3.5 inline-block" aria-hidden="true" />
          )}
        </button>

        {/* Folder icon */}
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />

        {/* Folder name button — triggers selection */}
        <button
          type="button"
          onClick={() => onFolderSelect(folder.id)}
          className="flex-1 min-w-0 text-left text-sm truncate"
        >
          {folder.name}
        </button>

        {/* Context menu — only shown when canManage=true */}
        {canManage && (
          <FolderContextMenu
            folder={folder}
            onCreateSubfolder={() =>
              onDialogOpen({ type: "create", folder, parentId: folder.id })
            }
            onRename={() =>
              onDialogOpen({ type: "rename", folder, parentId: null })
            }
            onDelete={() =>
              onDialogOpen({ type: "delete", folder, parentId: null })
            }
          />
        )}
      </div>

      {/* Recursive children — shown when expanded */}
      {isExpanded &&
        children.map((child) => (
          <FolderNode
            key={child.id}
            folder={child}
            depth={depth + 1}
            childrenMap={childrenMap}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            selectedFolderId={selectedFolderId}
            onFolderSelect={onFolderSelect}
            canManage={canManage}
            onDialogOpen={onDialogOpen}
            slug=""
          />
        ))}
    </>
  );
}

// -----------------------------------------------------------------------
// FolderTree
// -----------------------------------------------------------------------

export function FolderTree({
  folders,
  selectedFolderId,
  slug,
  onFolderSelect,
  canManage,
}: FolderTreeProps) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialogState, setDialogState] = useState<DialogState>({
    type: null,
    folder: null,
    parentId: null,
  });

  // Build adjacency map: parentId (or null for root) → children[]
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, FolderModel[]>();
    for (const folder of folders) {
      const key = folder.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(folder);
      map.set(key, list);
    }
    return map;
  }, [folders]);

  const rootFolders = childrenMap.get(null) ?? [];

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openDialog(state: DialogState) {
    setDialogState(state);
  }

  function closeDialog() {
    setDialogState({ type: null, folder: null, parentId: null });
  }

  function handleMutation() {
    // Refresh the RSC page to re-fetch updated folder list
    router.refresh();
    closeDialog();
  }

  return (
    <div className="flex flex-col gap-1 py-4 px-2">
      {/* "New folder" button — top of panel */}
      {canManage && (
        <button
          type="button"
          onClick={() =>
            openDialog({ type: "create", folder: null, parentId: null })
          }
          className="flex items-center gap-1.5 h-8 px-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white/80 rounded-md transition-colors"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          New folder
        </button>
      )}

      {/* "All LPs" root item — always first, always present */}
      <button
        type="button"
        onClick={() => onFolderSelect(null)}
        className={[
          "flex items-center h-8 px-2 text-sm rounded-md transition-colors w-full text-left",
          selectedFolderId === null
            ? "bg-white shadow-sm ring-1 ring-gray-200 font-semibold text-gray-900"
            : "text-gray-700 hover:bg-white/80",
        ].join(" ")}
      >
        All LPs
      </button>

      {/* Folder tree — recursive nodes */}
      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={0}
          childrenMap={childrenMap}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          selectedFolderId={selectedFolderId}
          onFolderSelect={onFolderSelect}
          canManage={canManage}
          onDialogOpen={openDialog}
          slug={slug}
        />
      ))}

      {/* Dialogs */}
      {dialogState.type === "create" && (
        <CreateFolderDialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
          }}
          parentId={dialogState.parentId}
          slug={slug}
          onCreated={() => handleMutation()}
        />
      )}

      {dialogState.type === "rename" && dialogState.folder && (
        <RenameFolderDialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
          }}
          folder={dialogState.folder}
          slug={slug}
          onRenamed={() => handleMutation()}
        />
      )}

      {dialogState.type === "delete" && dialogState.folder && (
        <DeleteFolderDialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
          }}
          folder={dialogState.folder}
          slug={slug}
          onDeleted={() => handleMutation()}
        />
      )}
    </div>
  );
}
