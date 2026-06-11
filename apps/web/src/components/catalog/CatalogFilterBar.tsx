"use client";
/**
 * CatalogFilterBar — horizontal pill row for tag-based LP filtering.
 *
 * Per UI-SPEC + D-09:
 * - First pill: "All" — always present; active when activeTagId === null.
 * - One pill per workspace tag in the tags prop.
 * - Active pill: bg-gray-900 text-white rounded-full px-3 py-1 text-sm font-medium.
 * - Inactive pill: border border-gray-200 bg-white text-gray-700 rounded-full px-3 py-1 text-sm.
 * - Single-select: clicking an active tag pill deactivates (sets activeTagId to null).
 * - Clicking an inactive tag pill activates it.
 * - Accessibility: role="group" on container; each pill aria-pressed per UI-SPEC.
 *
 * T-05-02-01: Tag names rendered as React text nodes — no dangerouslySetInnerHTML.
 */

import type { TagModel } from "@/generated/prisma/models";

export interface CatalogFilterBarProps {
  tags: TagModel[];
  activeTagId: string | null;
  onTagToggle: (tagId: string | null) => void;
}

export function CatalogFilterBar({
  tags,
  activeTagId,
  onTagToggle,
}: CatalogFilterBarProps) {
  const allActive = activeTagId === null;

  return (
    <div
      role="group"
      aria-label="Filter by tag"
      className="flex flex-wrap gap-2 py-2"
    >
      {/* "All" pill — always first */}
      <button
        type="button"
        onClick={() => onTagToggle(null)}
        aria-pressed={allActive}
        className={
          allActive
            ? "bg-gray-900 text-white rounded-full px-3 py-1 text-sm font-medium transition-colors"
            : "border border-gray-200 bg-white text-gray-700 rounded-full px-3 py-1 text-sm transition-colors hover:bg-gray-50"
        }
      >
        All
      </button>

      {/* One pill per workspace tag */}
      {tags.map((tag) => {
        const isActive = activeTagId === tag.id;
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onTagToggle(isActive ? null : tag.id)}
            aria-pressed={isActive}
            className={
              isActive
                ? "bg-gray-900 text-white rounded-full px-3 py-1 text-sm font-medium transition-colors"
                : "border border-gray-200 bg-white text-gray-700 rounded-full px-3 py-1 text-sm transition-colors hover:bg-gray-50"
            }
          >
            {/* T-05-02-01: React text node — no dangerouslySetInnerHTML */}
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
