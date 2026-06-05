/**
 * TemplateEditor — client island for creating and editing templates.
 *
 * Architecture (D-01, D-02):
 * - Left panel: monospace textarea (markup editor, flex-1)
 * - Right panel: SchemaPanel (w-80) with live parse results
 *
 * Live parse (D-02, Pitfall 7):
 * - 400ms debounce after each keystroke
 * - parse() runs client-side for ADVISORY feedback only
 * - Only { parse } imported — never { render } (Pitfall 1)
 * - Wrapped in try/catch; setLiveSchema(null) on error (Pitfall 7)
 *
 * Save (D-02, D-03):
 * - Server-side parse is authoritative (runs in createTemplateAction/updateTemplateAction)
 * - Warnings from server parse appear as Alert components (D-03)
 * - Warnings never block saving (D-03)
 * - Toast "Template saved — schema v{N}" on success
 *
 * Security:
 * - markup is rendered as textarea controlled value (browser renders as plain text, T-03-03-06)
 * - Only { parse } imported from pageforge-engine — never render (T-03-03-07)
 */
"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { parse } from "pageforge-engine";
import type { ParsedSchema } from "pageforge-engine";
import { toast } from "sonner";
import { createTemplateAction, updateTemplateAction } from "@/lib/templates/actions";
import type { MetadataOverlay } from "@/lib/templates/metadata";
import { SchemaPanel } from "./SchemaPanel";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface TemplateEditorProps {
  slug: string;
  mode: "create" | "edit";
  initialTemplate?: {
    id: string;
    name: string;
    markup: string;
    schema: unknown;
    metadataOverlay: unknown;
    schemaVersion: number;
  };
}

export function TemplateEditor({ slug, mode, initialTemplate }: TemplateEditorProps) {
  // Form state
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [markup, setMarkup] = useState(initialTemplate?.markup ?? "");
  const [metadataOverlay, setMetadataOverlay] = useState<MetadataOverlay>(
    (initialTemplate?.metadataOverlay as MetadataOverlay) ?? {}
  );
  const [nameError, setNameError] = useState<string | null>(null);

  // Live parse state (advisory only — D-02)
  const [liveSchema, setLiveSchema] = useState<ParsedSchema | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Save state
  const [isPending, startTransition] = useTransition();
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
  const [savedSchemaVersion, setSavedSchemaVersion] = useState<number>(
    initialTemplate?.schemaVersion ?? 0
  );

  // Metadata overlay panel
  const [metadataExpanded, setMetadataExpanded] = useState(false);

  // Debounce timer ref for live parse
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Force immediate parse (for re-parse button)
  const doLiveParse = useCallback((markupValue: string) => {
    setIsParsing(true);
    try {
      const result = parse(markupValue);
      setLiveSchema(result);
    } catch {
      // Pitfall 7: wrap parse() in try/catch; null on error
      setLiveSchema(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  // Debounced parse on markup change (400ms — UI-SPEC)
  const handleMarkupChange = useCallback(
    (value: string) => {
      setMarkup(value);
      setIsParsing(true);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        doLiveParse(value);
      }, 400);
    },
    [doLiveParse]
  );

  // Re-parse immediately (RefreshCw button)
  const handleReparse = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    doLiveParse(markup);
  }, [markup, doLiveParse]);

  // Save handler
  function handleSave() {
    // Client-side validation: name required
    if (!name.trim()) {
      setNameError("Template name is required.");
      return;
    }
    setNameError(null);
    setSaveWarnings([]);

    startTransition(async () => {
      let result;
      if (mode === "create") {
        result = await createTemplateAction(slug, { name, markup, metadataOverlay });
      } else {
        result = await updateTemplateAction(slug, {
          id: initialTemplate!.id,
          name,
          markup,
          metadataOverlay,
        });
      }

      if (result.ok) {
        setSavedSchemaVersion(result.data.schemaVersion);
        if (result.data.warnings.length > 0) {
          setSaveWarnings(result.data.warnings);
        }
        toast.success(`Template saved — schema v${result.data.schemaVersion}`);
      } else {
        toast.error("Failed to save. Try again.");
      }
    });
  }

  const breadcrumbLabel = mode === "create" ? "New Template" : (initialTemplate?.name ?? "Edit Template");

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar row: breadcrumb + save button */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white">
        <nav className="text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href={`/w/${slug}/templates`}
            className="hover:text-gray-700 transition-colors"
          >
            Templates
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">{breadcrumbLabel}</span>
        </nav>
        <Button
          onClick={handleSave}
          disabled={isPending || !name.trim()}
          className="bg-gray-900 text-white hover:bg-gray-800"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save Template"
          )}
        </Button>
      </div>

      {/* Template name input */}
      <div className="px-8 pt-6 pb-2">
        <label
          htmlFor="template-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Template name
        </label>
        <input
          id="template-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError && e.target.value.trim()) {
              setNameError(null);
            }
          }}
          onBlur={() => {
            if (!name.trim()) setNameError("Template name is required.");
          }}
          placeholder="My landing page template"
          required
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-base font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          aria-invalid={nameError ? "true" : undefined}
          aria-describedby={nameError ? "name-error" : undefined}
        />
        {nameError && (
          <p id="name-error" className="text-sm text-red-600 mt-1" role="alert">
            {nameError}
          </p>
        )}
      </div>

      {/* Save-time parse warnings (D-03: warnings don't block saving) */}
      {saveWarnings.length > 0 && (
        <div className="px-8 py-2">
          <Alert>
            <AlertTitle>Parse warnings ({saveWarnings.length})</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {saveWarnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Two-panel editor */}
      <div className="flex flex-1 overflow-hidden mx-8 mb-8 mt-4 rounded-md border border-gray-200">
        {/* Left: Markup editor (flex-1) */}
        <div className="flex-1 flex flex-col min-w-0">
          <textarea
            id="template-markup"
            value={markup}
            onChange={(e) => handleMarkupChange(e.target.value)}
            placeholder={`<h1>{{ hero_title:text }}</h1>\n<p>{{ description:rich_text }}</p>`}
            className="flex-1 w-full h-full min-h-[500px] resize-none font-mono text-sm text-gray-900 p-4 border-0 outline-none bg-white placeholder-gray-300 focus:ring-0"
            spellCheck={false}
            aria-label="Template markup editor"
          />
        </div>

        {/* Right: Schema panel (w-80) */}
        <SchemaPanel
          schema={liveSchema}
          isParsing={isParsing}
          onReparse={handleReparse}
        />
      </div>

      {/* Metadata overlay section */}
      {liveSchema && liveSchema.fields.filter((f) => !f.global).length > 0 && (
        <div className="px-8 pb-6">
          <button
            type="button"
            onClick={() => setMetadataExpanded((v) => !v)}
            className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors"
          >
            Edit field metadata
          </button>
          {metadataExpanded && (
            <div className="mt-3 border border-gray-200 rounded-md p-4 bg-white space-y-3">
              {liveSchema.fields
                .filter((f) => !f.global)
                .map((field) => {
                  const meta = metadataOverlay[field.name] ?? {
                    label: field.name,
                    required: false,
                  };
                  return (
                    <div
                      key={field.name}
                      className="flex items-center gap-3"
                    >
                      <span className="w-32 shrink-0 text-sm text-gray-600 truncate font-mono">
                        {field.name}
                      </span>
                      <input
                        type="text"
                        value={meta.label}
                        onChange={(e) =>
                          setMetadataOverlay((prev) => ({
                            ...prev,
                            [field.name]: { ...meta, label: e.target.value },
                          }))
                        }
                        placeholder={field.name}
                        className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                        aria-label={`Label for ${field.name}`}
                      />
                      <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={meta.required}
                          onChange={(e) =>
                            setMetadataOverlay((prev) => ({
                              ...prev,
                              [field.name]: {
                                ...meta,
                                required: e.target.checked,
                              },
                            }))
                          }
                          className="rounded border-gray-300"
                          aria-label={`${field.name} required`}
                        />
                        Required
                      </label>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-8 py-4 border-t border-gray-200 bg-white">
        <Link
          href={`/w/${slug}/templates`}
          className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
        {savedSchemaVersion > 0 && (
          <span className="text-sm text-gray-400">
            v{savedSchemaVersion}
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={isPending || !name.trim()}
          className="bg-gray-900 text-white hover:bg-gray-800"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save Template"
          )}
        </Button>
      </div>
    </div>
  );
}
