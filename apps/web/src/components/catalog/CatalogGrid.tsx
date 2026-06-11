"use client";
/**
 * CatalogGrid — client-side LP grid with folder + search + tag filtering.
 *
 * Receives all LPs (with folderId + tags) from the RSC page and handles:
 * - Folder selection state (selectedFolderId) from FolderTree.
 * - Name/tag search state (searchQuery, activeTagId) from SearchBar/FilterBar.
 * - Folder subtree filtering (D-10): selected folder + all descendants.
 * - Client-side name substring filter (D-08/D-09): case-insensitive includes.
 * - Tag filter (D-09): LP must have the active tag (AND-combined with search).
 * - Three empty states:
 *   1. Zero LPs in workspace + no search: "No landing pages yet" + CTA.
 *   2. Zero LPs in selected folder + no search: "This folder is empty."
 *   3. Zero results from filter: "No landing pages match your search."
 *
 * Layout (UI-SPEC):
 *   flex flex-row container filling the main content area (below page header).
 *   Left: FolderTree w-60 shrink-0 border-r border-gray-200 py-4 px-2.
 *   Right: flex-1 px-6 py-0 — SearchBar + FilterBar + LP grid.
 */

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { FolderTree } from "./FolderTree";
import { CatalogSearchBar } from "./CatalogSearchBar";
import { CatalogFilterBar } from "./CatalogFilterBar";
import { LpCatalogCard } from "./LpCatalogCard";
import type { FolderModel, TagModel } from "@/generated/prisma/models";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface CatalogLp {
  id: string;
  name: string;
  templateId: string | null;
  schemaVersion: number;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogGridProps {
  lps: CatalogLp[];
  /** tags[lpId] = TagModel[] for that LP */
  lpTagsMap: Record<string, TagModel[]>;
  folders: FolderModel[];
  workspaceTags: TagModel[];
  slug: string;
  canCreate: boolean;
  canManage: boolean;
}

// -----------------------------------------------------------------------
// Folder subtree helpers
// -----------------------------------------------------------------------

/**
 * Compute all folder IDs in the subtree rooted at startId (inclusive).
 * Uses the flat adjacency list (O(n) per folder query).
 */
function getSubtreeFolderIds(
  startId: string,
  folders: FolderModel[]
): Set<string> {
  const result = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.add(current);
    for (const folder of folders) {
      if (folder.parentId === current) {
        queue.push(folder.id);
      }
    }
  }
  return result;
}

// -----------------------------------------------------------------------
// CatalogGrid
// -----------------------------------------------------------------------

export function CatalogGrid({
  lps,
  lpTagsMap,
  folders,
  workspaceTags,
  slug,
  canCreate,
  canManage,
}: CatalogGridProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // 1. Folder filter (D-10): scope to selected folder + descendants
  // -----------------------------------------------------------------------

  let folderFilteredLps: CatalogLp[];
  if (selectedFolderId === null) {
    // "All LPs" — no folder filter
    folderFilteredLps = lps;
  } else {
    const subtreeIds = getSubtreeFolderIds(selectedFolderId, folders);
    folderFilteredLps = lps.filter(
      (lp) => lp.folderId !== null && subtreeIds.has(lp.folderId)
    );
  }

  // -----------------------------------------------------------------------
  // 2. Name + tag client-side filter (D-08/D-09): AND-combined
  // -----------------------------------------------------------------------

  const hasActiveFilter = searchQuery.trim() !== "" || activeTagId !== null;

  let filteredLps: CatalogLp[];
  if (!hasActiveFilter) {
    filteredLps = folderFilteredLps;
  } else {
    const lowerQuery = searchQuery.trim().toLowerCase();
    filteredLps = folderFilteredLps.filter((lp) => {
      // (a) Name substring match (case-insensitive)
      const nameMatch =
        lowerQuery === "" || lp.name.toLowerCase().includes(lowerQuery);

      // (b) Tag match: LP must have the active tag (AND-combined)
      let tagMatch = true;
      if (activeTagId !== null) {
        const lpTags = lpTagsMap[lp.id] ?? [];
        tagMatch = lpTags.some((t) => t.id === activeTagId);
      }

      return nameMatch && tagMatch;
    });
  }

  // -----------------------------------------------------------------------
  // Empty state detection
  // -----------------------------------------------------------------------

  const isWorkspaceEmpty = lps.length === 0;
  const isFolderEmpty =
    !isWorkspaceEmpty && selectedFolderId !== null && folderFilteredLps.length === 0;
  const isSearchEmpty =
    !isWorkspaceEmpty && hasActiveFilter && filteredLps.length === 0;

  return (
    <div className="flex flex-row flex-1 min-h-0">
      {/* Left panel: FolderTree */}
      <div className="w-60 shrink-0 border-r border-gray-200 py-4 px-2">
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          slug={slug}
          onFolderSelect={setSelectedFolderId}
          canManage={canManage}
        />
      </div>

      {/* Right panel: SearchBar + FilterBar + LP grid */}
      <div className="flex-1 px-6 py-0 min-w-0">
        {/* SearchBar */}
        <div className="pt-0 pb-2">
          <CatalogSearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* FilterBar — only shown when there are workspace tags */}
        {workspaceTags.length > 0 && (
          <CatalogFilterBar
            tags={workspaceTags}
            activeTagId={activeTagId}
            onTagToggle={setActiveTagId}
          />
        )}

        {/* LP grid or empty states */}
        {isWorkspaceEmpty ? (
          /* Empty workspace: "No landing pages yet" */
          <div className="flex flex-col items-center justify-center min-h-[360px] text-center">
            <FileText
              className="h-12 w-12 text-gray-300 mb-4"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No landing pages yet
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Pick a template and fill in the form to generate your first landing page.
            </p>
            {canCreate && (
              <Link
                href={`/w/${slug}/lps/new`}
                className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Generate LP
              </Link>
            )}
          </div>
        ) : isFolderEmpty ? (
          /* Folder has no LPs: "This folder is empty." */
          <div className="flex flex-col items-center justify-center min-h-[360px] text-center">
            <p className="text-sm text-gray-500">This folder is empty.</p>
          </div>
        ) : isSearchEmpty ? (
          /* Search/filter yielded no results */
          <div className="flex flex-col items-center justify-center min-h-[360px] text-center">
            <p className="text-sm text-gray-500">
              No landing pages match your search.
            </p>
          </div>
        ) : (
          /* LP card grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {filteredLps.map((lp) => (
              <LpCatalogCard
                key={lp.id}
                lp={lp}
                folders={folders}
                tags={lpTagsMap[lp.id] ?? []}
                slug={slug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
