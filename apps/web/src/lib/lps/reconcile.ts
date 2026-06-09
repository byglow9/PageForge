/**
 * LP schema version reconciliation helper (D-08).
 *
 * Extracted into a standalone module so it can be imported by both:
 * - lib/lps/actions.ts  ("use server" — server actions only allow async exports)
 * - components/lps/LpForm.tsx ("use client" — needs reconciliation for "Apply new version")
 *
 * This file has NO "use server" or "use client" directive — it is a pure
 * shared utility module safe to import from either boundary.
 */
import type { TokenField } from "pageforge-engine";

type FieldType = TokenField["type"];

function defaultForType(type: FieldType): unknown {
  if (type === "button") return { label: "", url: "" };
  return "";
}

/**
 * Reconcile LP values when a new template version is applied (D-08).
 *
 * Rules:
 * - Keep values for fields still present in newFields (match by field.name).
 * - Default new fields with defaultForType(type).
 * - Drop fields not in newFields (prevents stale values from polluting render scope — T-04-02-06).
 *
 * Acceptance proof:
 * reconcileLpValues([{name:"title",type:"text",...},{name:"body",type:"richtext",...}],
 *                   {title:"Old",removed_field:"x"})
 * → {title:"Old", body:""} — "title" kept, "removed_field" dropped, "body" defaulted.
 */
export function reconcileLpValues(
  newFields: TokenField[],
  existingValues: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Top-level fields (non-repeater, non-global)
  for (const field of newFields) {
    if (field.global || field.repeater) continue;
    result[field.name] = existingValues[field.name] ?? defaultForType(field.type);
  }

  // Repeater arrays
  const repeaterNames = [
    ...new Set(
      newFields
        .filter((f) => f.repeater !== undefined && f.repeater !== null)
        .map((f) => f.repeater as string)
    ),
  ];

  for (const rName of repeaterNames) {
    const oldItems = Array.isArray(existingValues[rName])
      ? (existingValues[rName] as unknown[])
      : [];
    const itemFields = newFields.filter((f) => f.repeater === rName);
    result[rName] = oldItems.map((item) => {
      const obj =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};
      const newItem: Record<string, unknown> = {};
      for (const f of itemFields) {
        newItem[f.name] = obj[f.name] ?? defaultForType(f.type);
      }
      return newItem;
    });
  }

  return result;
}
