"use client";
/**
 * ViteSpaLpForm — form for generating and editing VITE_SPA landing pages.
 *
 * Modes:
 * - "generate": empty form with name + optional entryRoute; submits →
 *   generateViteSpaLpAction → redirects to preview
 * - "edit": pre-populated form; submits → updateLpAction (VITE_SPA branch) →
 *   refreshes current page
 *
 * Fields:
 * - name: required, user-provided LP name (D-11)
 * - entryRoute: optional SPA sub-route (D-01); null/blank = root '/'
 *
 * Security:
 * - generateViteSpaLpAction / updateLpAction are Server Actions (run server-side).
 * - entryRoute validated and normalized server-side by GenerateViteSpaLpSchema.
 */

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generateViteSpaLpAction, updateLpAction } from "@/lib/lps/actions";
import { GenerateViteSpaLpSchema } from "@/lib/lps/schema";

/**
 * Raw form field values before Zod transforms.
 * useForm<T> uses the pre-transform shape so RHF can bind inputs correctly.
 * (GenerateViteSpaLpInput is the post-transform output type with entryRoute: string | null)
 */
interface ViteSpaFormValues {
  templateId: string;
  name: string;
  entryRoute?: string;
}

// -----------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------

export interface ViteSpaLpFormProps {
  slug: string;
  mode: "generate" | "edit";
  /** generate mode: ID of the source VITE_SPA template */
  templateId?: string;
  /** generate mode: human-readable template name (for context, not submitted) */
  templateName?: string;
  /** edit mode: ID of the landing page to update */
  lpId?: string;
  /** edit mode: current LP name (pre-fills name field) */
  lpName?: string;
  /** edit mode: current entry route (pre-fills entryRoute field) */
  initialEntryRoute?: string;
  /** generate mode: name pre-filled from searchParams (e.g. ?name=...) */
  initialLpName?: string;
}

// -----------------------------------------------------------------------
// ViteSpaLpForm
// -----------------------------------------------------------------------

export function ViteSpaLpForm({
  slug,
  mode,
  templateId,
  lpId,
  lpName,
  initialEntryRoute,
  initialLpName,
}: ViteSpaLpFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ViteSpaFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(GenerateViteSpaLpSchema) as any,
    defaultValues: {
      templateId: templateId ?? "",
      name: mode === "edit" ? (lpName ?? "") : (initialLpName ?? ""),
      entryRoute: initialEntryRoute ?? "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  function onSubmit(values: ViteSpaFormValues) {
    startTransition(async () => {
      if (mode === "generate") {
        const result = await generateViteSpaLpAction(slug, {
          templateId: values.templateId,
          name: values.name,
          // Normalize: Zod transform in the action handles entryRoute → null for empty
          // but the action's input type requires string | null (not undefined)
          entryRoute: values.entryRoute ?? null,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Failed to generate. Try again.");
          return;
        }
        toast.success("Landing page created.");
        router.push(`/w/${slug}/lps/${result.data.id}/preview`);
      } else {
        // edit mode
        if (!lpId) {
          toast.error("Landing page ID is missing.");
          return;
        }
        const result = await updateLpAction(slug, {
          id: lpId,
          name: values.name,
          entryRoute: values.entryRoute ?? undefined,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Failed to save. Try again.");
          return;
        }
        toast.success("Landing page updated.");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
      {/* Landing page name */}
      <div className="space-y-2">
        <Label htmlFor="vite-lp-name">Landing page name</Label>
        <Input
          id="vite-lp-name"
          placeholder="e.g. Grécia — Outubro 2026"
          autoFocus={mode === "generate"}
          {...register("name")}
          aria-describedby={errors.name ? "vite-lp-name-error" : undefined}
        />
        {errors.name && (
          <p id="vite-lp-name-error" className="text-sm text-red-600">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Entry route (optional) */}
      <div className="space-y-2">
        <Label htmlFor="vite-lp-entry-route">
          Entry route{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Input
          id="vite-lp-entry-route"
          placeholder="e.g. /grecia"
          {...register("entryRoute")}
          aria-describedby="vite-lp-entry-route-hint"
        />
        <p id="vite-lp-entry-route-hint" className="text-sm text-gray-500">
          {mode === "generate"
            ? "Leave blank for single-page projects (defaults to /). For multi-route projects, type the path you want to link to (e.g. /grecia)."
            : "Leave blank for the root page (/). The preview will reload with the updated route after saving."}
        </p>
        {errors.entryRoute && (
          <p className="text-sm text-red-600">{errors.entryRoute.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {mode === "generate" ? "Generating…" : "Saving…"}
          </>
        ) : mode === "generate" ? (
          "Generate landing page"
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
}
