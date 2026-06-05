/**
 * SchemaPanel — live parse results side panel for TemplateEditor.
 *
 * Displays detected token fields with color-coded type badges and parse warnings.
 * Updates live as the author types (via debounced parse in TemplateEditor).
 *
 * Accessibility:
 * - aria-live="polite" region so screen readers announce field count changes.
 * - Re-parse button has aria-label per UI-SPEC accessibility requirements.
 * - Loader2 spinner is visible while parse is pending.
 *
 * Badge color map (UI-SPEC):
 * - text / rich_text / image / color / button: bg-blue-50 text-blue-700
 * - repeater group indicator: bg-purple-50 text-purple-700
 * - global/brand field: bg-green-50 text-green-700
 * - warning chip: bg-amber-100 text-amber-800
 */
"use client";

import { RefreshCw, Loader2 } from "lucide-react";
import type { ParsedSchema } from "pageforge-engine";

interface SchemaPanelProps {
  /** The live parse result from TemplateEditor debounce. Null if never parsed or error. */
  schema: ParsedSchema | null;
  /** Whether a parse debounce is currently in progress. */
  isParsing: boolean;
  /** Callback to force an immediate re-parse. */
  onReparse: () => void;
}

// Badge color classes per field type (UI-SPEC badge color map)
function getFieldTypeBadgeClass(type: string): string {
  switch (type) {
    case "repeater":
      return "bg-purple-50 text-purple-700";
    default:
      // text, richtext, image, color, button
      return "bg-blue-50 text-blue-700";
  }
}

export function SchemaPanel({ schema, isParsing, onReparse }: SchemaPanelProps) {
  return (
    <aside
      className="w-80 shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col overflow-auto"
      aria-label="Schema panel"
    >
      {/* Panel header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Detected Fields
        </h2>
        <div className="flex items-center gap-1">
          {isParsing && (
            <Loader2
              className="h-4 w-4 text-gray-400 animate-spin"
              aria-label="Parsing markup…"
            />
          )}
          <button
            type="button"
            onClick={onReparse}
            aria-label="Re-parse markup"
            title="Re-parse markup"
            className="p-2.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Live parse results region */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="flex-1 px-4 pb-4"
      >
        {!schema || schema.fields.length === 0 ? (
          <p className="text-sm text-gray-400 italic mt-2">
            No tokens found yet. Use{" "}
            <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
              {`{{ field:type }}`}
            </code>{" "}
            syntax.
          </p>
        ) : (
          <ul className="space-y-2 mt-1">
            {schema.fields.map((field) => (
              <li
                key={field.name}
                className="flex items-center gap-2"
              >
                <span className="text-sm font-semibold text-gray-800 truncate flex-1">
                  {field.name}
                </span>
                {/* Global/brand field badge */}
                {field.global ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700">
                    brand
                  </span>
                ) : null}
                {/* Type badge */}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getFieldTypeBadgeClass(field.type)}`}
                >
                  {field.type}
                </span>
                {/* Repeater parent indicator */}
                {field.repeater ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700">
                    {field.repeater}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Parse warnings */}
        {schema && schema.warnings.length > 0 && (
          <div className="mt-4 space-y-1">
            {schema.warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2"
              >
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 shrink-0">
                  warning
                </span>
                <span className="text-sm text-amber-800">{warning.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
