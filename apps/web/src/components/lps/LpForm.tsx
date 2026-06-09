"use client";
/**
 * LpForm — dynamic form for generating and editing landing pages.
 *
 * Modes:
 * - "generate": empty form, submits → generateLpAction → redirects to preview
 * - "edit": pre-populated form, submits → updateLpAction → redirects to preview
 *
 * Architecture:
 * - Derives Zod schema at component init via deriveZodSchema(fields, overlay).
 * - Uses React Hook Form with zodResolver for validation.
 * - Renders one input per field type (text, richtext, color, button+URL, image).
 * - Renders RepeaterBlock for each repeater in schema.repeaters.
 * - BrandGlobalsPanel shown read-only at top of form.
 * - D-08: schema version mismatch alert shown in edit mode.
 *
 * Security:
 * - generateLpAction / updateLpAction are Server Actions (run server-side).
 * - Rendering of template HTML never happens in this component.
 */

import { useMemo, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ParsedSchema } from "pageforge-engine";
import type { MetadataOverlay } from "@/lib/templates/metadata";
import { deriveZodSchema } from "@/lib/lps/schema-derive";
import { generateLpAction, updateLpAction } from "@/lib/lps/actions";
import { reconcileLpValues } from "@/lib/lps/reconcile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { BrandGlobalsPanel } from "./BrandGlobalsPanel";
import { RepeaterBlock } from "./RepeaterBlock";
import { RichTextField } from "./RichTextField";
import { ImageUploadField } from "./ImageUploadField";

// -----------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------

export interface LpFormProps {
  slug: string;
  mode: "generate" | "edit";
  template: {
    id: string;
    markup: string;
    schemaVersion: number;
    schema: ParsedSchema;
    metadataOverlay: MetadataOverlay;
  };
  brandConfig: {
    logoUrl: string | null;
    primaryColor: string | null;
    whatsapp: string | null;
  } | null;
  initialValues?: Record<string, unknown>;
  lpId?: string;
  lpName?: string;
  templateCurrentSchemaVersion?: number;
}

// -----------------------------------------------------------------------
// Helper: build default values for a repeater item
// -----------------------------------------------------------------------

function buildDefaultItem(
  repeaterName: string,
  fields: ParsedSchema["fields"]
): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.repeater !== repeaterName) continue;
    if (field.type === "button") {
      item[field.name] = { label: "", url: "" };
    } else {
      item[field.name] = "";
    }
  }
  return item;
}

// -----------------------------------------------------------------------
// RepeaterFieldController — one per repeater, calls useFieldArray at top level
// -----------------------------------------------------------------------

interface RepeaterFieldControllerProps {
  repeaterName: string;
  slug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  itemFields: ParsedSchema["fields"];
  overlay: MetadataOverlay;
}

function RepeaterFieldController({
  repeaterName,
  slug,
  control,
  register,
  errors,
  itemFields,
  overlay,
}: RepeaterFieldControllerProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: repeaterName,
  });

  const displayLabel =
    repeaterName.charAt(0).toUpperCase() + repeaterName.slice(1);

  // We're using RepeaterBlock but need to pass down the fields from useFieldArray
  return (
    <RepeaterBlock
      repeaterName={repeaterName}
      repeaterLabel={displayLabel}
      slug={slug}
      control={control}
      register={register}
      errors={errors}
      itemFields={itemFields.filter((f) => f.repeater === repeaterName)}
      overlay={overlay}
    />
  );
}

// suppress unused: fields/append/remove are used internally by RepeaterBlock
void RepeaterFieldController;

// -----------------------------------------------------------------------
// LpForm
// -----------------------------------------------------------------------

export function LpForm({
  slug,
  mode,
  template,
  brandConfig,
  initialValues,
  lpId,
  lpName,
  templateCurrentSchemaVersion,
}: LpFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isApplyingVersion, setIsApplyingVersion] = useState(false);

  // Derive Zod schema once at component init (Rule: call deriveZodSchema only once)
  const zodSchema = useMemo(
    () => deriveZodSchema(template.schema.fields, template.metadataOverlay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Build default values for the form
  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};

    // LP name
    defaults._lpName = lpName ?? "";

    if (initialValues && Object.keys(initialValues).length > 0) {
      // Edit mode: populate from saved values
      return { ...defaults, ...initialValues, _lpName: lpName ?? "" };
    }

    // Generate mode: empty defaults per field type
    for (const field of template.schema.fields) {
      if (field.global || field.repeater) continue;
      if (field.type === "button") {
        defaults[field.name] = { label: "", url: "" };
      } else {
        defaults[field.name] = "";
      }
    }

    // Repeater arrays: start empty
    for (const repeaterName of template.schema.repeaters) {
      defaults[repeaterName] = [];
    }

    return defaults;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    getValues,
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // Schema version mismatch detection (D-08)
  const hasSchemaVersionMismatch =
    mode === "edit" &&
    templateCurrentSchemaVersion !== undefined &&
    templateCurrentSchemaVersion > template.schemaVersion;

  // Handle "Apply new version" (D-08)
  async function handleApplyNewVersion() {
    if (!lpId) return;
    setIsApplyingVersion(true);
    try {
      const currentValues = getValues();
      // Extract raw values (remove _lpName)
      const { _lpName, ...fieldValues } = currentValues as Record<string, unknown>;

      // Reconcile values with new schema (server-side logic — call via updateLpAction)
      const reconciledValues = reconcileLpValues(
        template.schema.fields,
        fieldValues as Record<string, unknown>
      );

      const result = await updateLpAction(slug, {
        id: lpId,
        name: (_lpName as string) || undefined,
        values: reconciledValues,
        markupSnapshot: template.markup,
        schemaVersion: templateCurrentSchemaVersion,
      });

      if (result.ok) {
        toast.success("New template version applied.");
        router.push(`/w/${slug}/lps/${lpId}/preview`);
        router.refresh();
      } else {
        toast.error("Failed to apply new version. Try again.");
      }
    } catch {
      toast.error("Failed to apply new version. Try again.");
    } finally {
      setIsApplyingVersion(false);
    }
  }

  // Form submit handler
  function onSubmit(data: Record<string, unknown>) {
    const { _lpName, ...fieldValues } = data;
    const name = (_lpName as string).trim();

    startTransition(async () => {
      if (mode === "generate") {
        const result = await generateLpAction(slug, {
          templateId: template.id,
          name,
          values: fieldValues as Record<string, unknown>,
        });

        if (result.ok) {
          toast.success("LP generated successfully.");
          router.push(`/w/${slug}/lps/${result.data.id}/preview`);
        } else {
          toast.error(result.error ?? "Failed to generate LP. Try again.");
        }
      } else {
        // Edit mode
        if (!lpId) {
          toast.error("LP ID is missing. Please refresh and try again.");
          return;
        }

        const result = await updateLpAction(slug, {
          id: lpId,
          name,
          values: fieldValues as Record<string, unknown>,
        });

        if (result.ok) {
          toast.success("Changes saved.");
          router.push(`/w/${slug}/lps/${lpId}/preview`);
        } else {
          toast.error(result.error ?? "Failed to save changes. Try again.");
        }
      }
    });
  }

  // Non-repeater, non-global fields
  const topLevelFields = template.schema.fields.filter(
    (f) => !f.global && !f.repeater
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])}
      className="max-w-[720px] mx-auto"
      noValidate
    >
      {/* Brand Globals Panel (D-04: always read-only at top) */}
      <BrandGlobalsPanel brand={brandConfig} slug={slug} />

      {/* Schema version mismatch alert (D-08, edit mode only) */}
      {hasSchemaVersionMismatch && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTitle className="text-amber-900">Template updated</AlertTitle>
          <AlertDescription className="text-amber-800">
            <p>
              The template has been updated to v{templateCurrentSchemaVersion}.
              New fields have been added and missing ones removed. Your existing
              values are preserved where possible.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={isApplyingVersion}
              onClick={handleApplyNewVersion}
            >
              {isApplyingVersion ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Applying…
                </>
              ) : (
                "Apply new version"
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* LP Name field (D-11: first required field in form) */}
      <div className="mb-6">
        <Label
          htmlFor="lp-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Landing Page Name
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        </Label>
        <Input
          id="lp-name"
          type="text"
          {...register("_lpName")}
          placeholder="e.g. Grécia Jun/2026"
          aria-required="true"
          aria-describedby={
            errors._lpName ? "lp-name-error" : "lp-name-help"
          }
        />
        {errors._lpName ? (
          <p id="lp-name-error" className="text-sm text-red-600 mt-1" role="alert">
            {String(errors._lpName.message ?? "Landing page name is required.")}
          </p>
        ) : (
          <p id="lp-name-help" className="text-sm text-gray-500 mt-1">
            This name identifies your LP in the catalog.
          </p>
        )}
      </div>

      {/* Top-level fields (non-repeater, non-global) */}
      {topLevelFields.length > 0 && (
        <div className="space-y-6 mb-6">
          {topLevelFields.map((field) => {
            const meta = template.metadataOverlay[field.name] ?? {
              label: field.name,
              required: false,
            };
            const fieldId = `field-${field.name}`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fieldError = (errors as any)[field.name];

            if (field.type === "richtext") {
              return (
                <div key={field.name}>
                  <Label
                    htmlFor={fieldId}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {meta.label}
                    {meta.required && (
                      <span className="text-red-500 ml-1" aria-label="required">*</span>
                    )}
                  </Label>
                  <RichTextField
                    name={field.name}
                    control={control}
                    defaultValue={
                      (initialValues?.[field.name] as string) ?? ""
                    }
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

            if (field.type === "image") {
              return (
                <div key={field.name}>
                  <Label
                    htmlFor={fieldId}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {meta.label}
                    {meta.required && (
                      <span className="text-red-500 ml-1" aria-label="required">*</span>
                    )}
                  </Label>
                  <ImageUploadField
                    name={field.name}
                    slug={slug}
                    control={control}
                    label={meta.label}
                    required={meta.required}
                  />
                  {fieldError && (
                    <p
                      id={`${fieldId}-error`}
                      className="text-sm text-red-600 mt-1"
                      role="alert"
                    >
                      {String(fieldError.message ?? "This field is required.")}
                    </p>
                  )}
                </div>
              );
            }

            if (field.type === "color") {
              // Color input with live swatch
              const colorValue = watch(field.name) as string ?? "";
              return (
                <div key={field.name}>
                  <Label
                    htmlFor={fieldId}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {meta.label}
                    {meta.required && (
                      <span className="text-red-500 ml-1" aria-label="required">*</span>
                    )}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={fieldId}
                      type="text"
                      {...register(field.name)}
                      placeholder="#0f172a"
                      aria-required={meta.required ? "true" : undefined}
                      aria-describedby={fieldError ? `${fieldId}-error` : undefined}
                    />
                    <div
                      className="shrink-0 rounded border border-gray-200"
                      style={{
                        width: "24px",
                        height: "24px",
                        backgroundColor: colorValue || "transparent",
                      }}
                      aria-label="Color preview"
                      role="img"
                    />
                  </div>
                  {fieldError && (
                    <p
                      id={`${fieldId}-error`}
                      className="text-sm text-red-600 mt-1"
                      role="alert"
                    >
                      {String(fieldError.message ?? "Enter a valid hex color (e.g. #0f172a).")}
                    </p>
                  )}
                </div>
              );
            }

            if (field.type === "button") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const buttonErrors = (errors as any)[field.name] as any;
              return (
                <div key={field.name} className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {meta.label}
                    {meta.required && (
                      <span className="text-red-500 ml-1" aria-label="required">*</span>
                    )}
                  </p>
                  <div>
                    <Label
                      htmlFor={`${fieldId}-label`}
                      className="block text-xs text-gray-500 mb-1"
                    >
                      Button Text
                    </Label>
                    <Input
                      id={`${fieldId}-label`}
                      type="text"
                      {...register(`${field.name}.label`)}
                      placeholder="Button text"
                      aria-required={meta.required ? "true" : undefined}
                    />
                    {buttonErrors?.label && (
                      <p className="text-sm text-red-600 mt-1" role="alert">
                        {String(buttonErrors.label.message ?? "This field is required.")}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label
                      htmlFor={`${fieldId}-url`}
                      className="block text-xs text-gray-500 mb-1"
                    >
                      Button URL
                    </Label>
                    <Input
                      id={`${fieldId}-url`}
                      type="url"
                      {...register(`${field.name}.url`)}
                      placeholder="https://..."
                    />
                    {buttonErrors?.url && (
                      <p className="text-sm text-red-600 mt-1" role="alert">
                        {String(buttonErrors.url.message ?? "Enter a valid URL starting with https://.")}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Default: text field
            return (
              <div key={field.name}>
                <Label
                  htmlFor={fieldId}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {meta.label}
                  {meta.required && (
                    <span className="text-red-500 ml-1" aria-label="required">*</span>
                  )}
                </Label>
                <Input
                  id={fieldId}
                  type="text"
                  {...register(field.name)}
                  aria-required={meta.required ? "true" : undefined}
                  aria-describedby={fieldError ? `${fieldId}-error` : `${fieldId}-help`}
                />
                {fieldError ? (
                  <p
                    id={`${fieldId}-error`}
                    className="text-sm text-red-600 mt-1"
                    role="alert"
                  >
                    {String(fieldError.message ?? "This field is required.")}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Repeater blocks */}
      {template.schema.repeaters.length > 0 && (
        <div className="space-y-4 mb-6">
          {template.schema.repeaters.map((repeaterName) => {
            const itemFields = template.schema.fields.filter(
              (f) => f.repeater === repeaterName
            );
            const displayLabel =
              repeaterName.charAt(0).toUpperCase() + repeaterName.slice(1);

            return (
              <RepeaterBlock
                key={repeaterName}
                repeaterName={repeaterName}
                repeaterLabel={displayLabel}
                slug={slug}
                control={control}
                register={register}
                errors={errors}
                itemFields={itemFields}
                overlay={template.metadataOverlay}
              />
            );
          })}
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 py-4 bg-white border-t border-gray-200 -mx-8 px-8">
        <div className="max-w-[720px] mx-auto flex justify-end">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-gray-900 text-white hover:bg-gray-800 px-8"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                {mode === "generate" ? "Generating…" : "Saving…"}
              </>
            ) : mode === "generate" ? (
              "Generate LP"
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
