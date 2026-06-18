"use client";
/**
 * CatalogSearchBar — full-width search input for the LP catalog.
 *
 * Per UI-SPEC:
 * - Full-width Input with Search icon (Lucide, 16px) on the left.
 * - Placeholder: "Search landing pages…" (exact copy, trailing ellipsis).
 * - aria-label="Search landing pages".
 * - Controlled by props — no debounce, no API call (D-08 client-side filter).
 */

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface CatalogSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function CatalogSearchBar({ value, onChange }: CatalogSearchBarProps) {
  return (
    <div className="relative w-full">
      {/* Search icon — absolutely positioned left of the input */}
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        size={16}
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search landing pages…"
        aria-label="Search landing pages"
        className="pl-8 w-full text-sm bg-white/80 backdrop-blur-sm"
      />
    </div>
  );
}
