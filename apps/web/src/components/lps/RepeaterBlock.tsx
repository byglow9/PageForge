"use client";
/**
 * RepeaterBlock — collapsible repeater section with useFieldArray.
 *
 * Renders a collapsible block for each repeater in the template schema.
 * Each item sub-card shows the item's fields plus drag handle and remove button.
 *
 * Per UI-SPEC:
 * - Expanded by default on first render.
 * - Header: chevron toggle + repeater name + item count badge + "+ Add {Label}" button.
 * - Each item: bordered sub-card, "{Label} {N}", GripVertical drag handle, × remove button.
 * - Empty state: informational message when no items.
 *
 * Image fields use ImageUploadField (Plan 03) — drag/drop upload with presigned PUT.
 */

import { useState } from "react";
import {
  type FieldArrayWithId,
  type Control,
  type UseFormRegister,
  type FieldErrors,
  useFieldArray,
} from "react-hook-form";
import { ChevronDown, ChevronRight, GripVertical, Plus, X } from "lucide-react";
import type { TokenField } from "pageforge-engine";
import type { MetadataOverlay } from "@/lib/templates/metadata";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RichTextField } from "./RichTextField";
import { ImageUploadField } from "./ImageUploadField";

// -----------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------

export interface RepeaterBlockProps {
  repeaterName: string;
  repeaterLabel: string;
  slug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  itemFields: TokenField[];
  overlay: MetadataOverlay;
}

// -----------------------------------------------------------------------
// RepeaterBlock
// -----------------------------------------------------------------------

export function RepeaterBlock({
  repeaterName,
  repeaterLabel,
  slug,
  control,
  register,
  errors,
  itemFields,
  overlay,
}: RepeaterBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true); // Expanded by default (UI-SPEC)

  const { fields, append, remove } = useFieldArray({
    control,
    name: repeaterName,
  });

  // Build a default item for appending
  function buildDefaultItem(): Record<string, unknown> {
    const item: Record<string, unknown> = {};
    for (const field of itemFields) {
      if (field.type === "button") {
        item[field.name] = { label: "", url: "" };
      } else {
        item[field.name] = "";
      }
    }
    return item;
  }

  // Capitalize for display
  const displayLabel =
    repeaterLabel.charAt(0).toUpperCase() + repeaterLabel.slice(1);

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      {/* Repeater header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          aria-expanded={isExpanded}
          aria-controls={`repeater-${repeaterName}-content`}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{displayLabel}</span>
          <span className="text-sm text-gray-400 font-normal">
            ({fields.length} {fields.length === 1 ? "item" : "items"})
          </span>
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(buildDefaultItem())}
          aria-label={`Add ${displayLabel}`}
          className="flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          + Add {displayLabel}
        </Button>
      </div>

      {/* Repeater content */}
      {isExpanded && (
        <div
          id={`repeater-${repeaterName}-content`}
          className="p-4 space-y-2"
        >
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No {repeaterLabel.toLowerCase()}s added yet. Click &ldquo;+ Add{" "}
              {displayLabel}&rdquo; to start.
            </p>
          ) : (
            fields.map((item: FieldArrayWithId, index: number) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-md p-4 mb-2 bg-white"
              >
                {/* Item header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">
                    {displayLabel} {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <GripVertical
                      className="h-4 w-4 text-gray-300"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={`Remove ${displayLabel} ${index + 1}`}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Item fields */}
                <div className="space-y-3">
                  {itemFields.map((field) => {
                    const fieldId = `${repeaterName}.${index}.${field.name}`;
                    const meta = overlay[field.name] ?? {
                      label: field.name,
                      required: false,
                    };
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const fieldError = (errors as any)?.[repeaterName]?.[index]?.[field.name];

                    if (field.type === "richtext") {
                      return (
                        <div key={fieldId}>
                          <Label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
                            {meta.label}
                            {meta.required && (
                              <span className="text-red-500 ml-1" aria-label="required">*</span>
                            )}
                          </Label>
                          <RichTextField
                            name={fieldId}
                            control={control}
                            defaultValue=""
                            label={meta.label}
                            required={meta.required}
                          />
                          {fieldError && (
                            <p className="text-sm text-red-600 mt-1" role="alert">
                              {fieldError.message}
                            </p>
                          )}
                        </div>
                      );
                    }

                    if (field.type === "button") {
                      return (
                        <div key={fieldId} className="space-y-2">
                          <div>
                            <Label className="mb-1 block text-sm font-medium text-gray-700">
                              {meta.label} — Button Text
                              {meta.required && (
                                <span className="text-red-500 ml-1" aria-label="required">*</span>
                              )}
                            </Label>
                            <Input
                              {...register(`${fieldId}.label`)}
                              placeholder="Button text"
                              aria-required={meta.required ? "true" : undefined}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm font-medium text-gray-700">
                              {meta.label} — Button URL
                            </Label>
                            <Input
                              {...register(`${fieldId}.url`)}
                              type="url"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      );
                    }

                    if (field.type === "image") {
                      return (
                        <div key={fieldId}>
                          <Label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
                            {meta.label}
                            {meta.required && (
                              <span className="text-red-500 ml-1" aria-label="required">*</span>
                            )}
                          </Label>
                          <ImageUploadField
                            name={fieldId}
                            slug={slug}
                            control={control}
                            label={meta.label}
                            required={meta.required}
                          />
                          {fieldError && (
                            <p className="text-sm text-red-600 mt-1" role="alert">
                              {String(fieldError.message ?? "This field is required.")}
                            </p>
                          )}
                        </div>
                      );
                    }

                    // text, color, and fallback
                    return (
                      <div key={fieldId}>
                        <Label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
                          {meta.label}
                          {meta.required && (
                            <span className="text-red-500 ml-1" aria-label="required">*</span>
                          )}
                        </Label>
                        <Input
                          id={fieldId}
                          {...register(fieldId)}
                          type={field.type === "color" ? "text" : "text"}
                          placeholder={field.type === "color" ? "#0f172a" : ""}
                          aria-required={meta.required ? "true" : undefined}
                          aria-describedby={fieldError ? `${fieldId}-error` : undefined}
                        />
                        {fieldError && (
                          <p
                            id={`${fieldId}-error`}
                            className="text-sm text-red-600 mt-1"
                            role="alert"
                          >
                            {fieldError.message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
