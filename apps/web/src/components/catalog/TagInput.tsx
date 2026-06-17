"use client";
/**
 * TagInput — chip input for assigning/removing tags on an LP.
 *
 * Per UI-SPEC + D-07:
 * - Renders existing tags as Badge (variant: secondary) chips with × remove button.
 * - Remove button: aria-label="Remove tag {name}" (UI-SPEC accessibility).
 * - Add tag: press Enter or comma — trims, validates max 32 chars (D-07).
 * - Max 10 tags per LP (D-07): input disabled when limit reached.
 * - Calls setTagsForLpAction on every remove (immediate) and on Enter/blur (batch).
 * - On error: toast.error("Failed to save tags.").
 *
 * T-05-02-02: Tag chips are rendered as React text nodes — no dangerouslySetInnerHTML.
 */

import { useState, useRef, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setTagsForLpAction } from "@/lib/catalog/actions";
import type { TagModel } from "@/generated/prisma/models";

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 32;

export interface TagInputProps {
  lpId: string;
  slug: string;
  initialTags: TagModel[];
  /** All tags already used anywhere in the workspace — offered as quick-add suggestions. */
  workspaceTags?: TagModel[];
  onChanged?: () => void;
}

export function TagInput({ lpId, slug, initialTags, workspaceTags = [], onChanged }: TagInputProps) {
  const [currentTags, setCurrentTags] = useState<TagModel[]>(initialTags);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const atMax = currentTags.length >= MAX_TAGS;

  // Workspace tags not yet assigned to this LP — shown as one-click suggestions.
  const assignedNames = new Set(currentTags.map((t) => t.name.toLowerCase()));
  const suggestions = workspaceTags.filter(
    (t) => !assignedNames.has(t.name.toLowerCase())
  );

  async function saveTags(tagNames: string[]) {
    setIsSaving(true);
    try {
      const result = await setTagsForLpAction(slug, { lpId, tagNames });
      if (result.ok) {
        // The action normalizes names; reconstruct local tag models with returned data.
        // We rely on router.refresh() from the parent to update the canonical list;
        // for immediate local feedback, rebuild from the submitted names.
        const updatedTags = tagNames.map((name, i) => ({
          id: result.ok && result.data ? (result.data.tagIds[i] ?? `temp-${i}`) : `temp-${i}`,
          workspaceId: currentTags[0]?.workspaceId ?? "",
          name: name.trim().toLowerCase(),
          createdAt: new Date(),
        }));
        setCurrentTags(updatedTags);
        onChanged?.();
      } else {
        toast.error("Failed to save tags.");
      }
    } catch {
      toast.error("Failed to save tags.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleRemove(tagId: string) {
    const updatedTags = currentTags.filter((t) => t.id !== tagId);
    setCurrentTags(updatedTags);
    // Save immediately on remove
    saveTags(updatedTags.map((t) => t.name));
  }

  function commitInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setInputValue("");
      return;
    }
    if (trimmed.length > MAX_TAG_LENGTH) {
      // Silently skip — do not add, do not show error (spec: if value.length > 32 skip)
      setInputValue("");
      return;
    }
    if (atMax) {
      setInputValue("");
      return;
    }
    // Check for duplicate (case-insensitive)
    const normalized = trimmed.toLowerCase();
    if (currentTags.some((t) => t.name.toLowerCase() === normalized)) {
      setInputValue("");
      return;
    }
    const newTag: TagModel = {
      id: `pending-${Date.now()}`,
      workspaceId: currentTags[0]?.workspaceId ?? "",
      name: normalized,
      createdAt: new Date(),
    };
    const updatedTags = [...currentTags, newTag];
    setCurrentTags(updatedTags);
    setInputValue("");
    saveTags(updatedTags.map((t) => t.name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitInput(inputValue);
    }
  }

  function handleBlur() {
    if (inputValue.trim()) {
      commitInput(inputValue);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="tag-input" className="text-sm font-medium text-gray-700">
        Tags
      </Label>

      {/* Current tag chips */}
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {currentTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1"
            >
              <Badge variant="secondary" className="text-xs pr-1">
                {/* T-05-02-02: React text node — no dangerouslySetInnerHTML */}
                {tag.name}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag.name}`}
                  onClick={() => handleRemove(tag.id)}
                  disabled={isSaving}
                  className="ml-1 rounded-full text-gray-500 hover:text-gray-900 disabled:opacity-50 focus:outline-none"
                >
                  ×
                </button>
              </Badge>
            </span>
          ))}
        </div>
      )}

      {/* Input for adding new tags */}
      {atMax ? (
        <p className="text-xs text-gray-500">Maximum 10 tags reached.</p>
      ) : (
        <Input
          id="tag-input"
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Add a tag…"
          disabled={isSaving}
          className="text-sm"
          aria-label="Add a tag"
        />
      )}

      {/* Suggestions from the workspace tag vocabulary */}
      {!atMax && suggestions.length > 0 && (
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-xs text-gray-500">Suggestions</span>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => commitInput(tag.name)}
                disabled={isSaving}
                className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
              >
                + {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
