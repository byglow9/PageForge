"use client";

/**
 * BrandConfigForm — client island for brand settings.
 *
 * Renders the brand config form with:
 * - Logo URL (validated as https:// on blur)
 * - Primary Color (validated as 6-digit hex on blur, live color swatch)
 * - WhatsApp / Contact (free text, no blur validation in v1)
 * - Brand token reference block (shows resolved values below fields)
 * - Save button (disabled for viewer role or while pending)
 *
 * Security:
 * - saveBrandConfigAction re-validates on the server; client validation is UX-only.
 * - canEdit comes from the server (RSC page) — client never computes authorization.
 *
 * UI contract: 03-UI-SPEC.md — Brand Settings page section.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { saveBrandConfigAction } from "@/lib/brand/actions";
import type { BrandConfigModel } from "@/generated/prisma/models";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/** Returns true if the string is a valid 6-digit hex color. */
function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

// -----------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------

interface BrandConfigFormProps {
  slug: string;
  initial: BrandConfigModel | null;
  canEdit: boolean;
}

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export function BrandConfigForm({ slug, initial, canEdit }: BrandConfigFormProps) {
  // Field state — initialised from server-fetched values
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    initial?.primaryColor ?? ""
  );
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "");

  // Field-level blur-validation errors
  const [logoUrlError, setLogoUrlError] = useState<string | null>(null);
  const [primaryColorError, setPrimaryColorError] = useState<string | null>(
    null
  );

  // Transition for async save
  const [isPending, startTransition] = useTransition();

  // -----------------------------------------------------------------------
  // Blur handlers
  // -----------------------------------------------------------------------

  function handleLogoUrlBlur() {
    if (logoUrl !== "" && !logoUrl.startsWith("https://")) {
      setLogoUrlError("Enter a valid URL starting with https://.");
    } else {
      setLogoUrlError(null);
    }
  }

  function handlePrimaryColorBlur() {
    if (primaryColor !== "" && !isValidHex(primaryColor)) {
      setPrimaryColorError("Enter a valid 6-digit hex color (e.g. #0f172a).");
    } else {
      setPrimaryColorError(null);
    }
  }

  // -----------------------------------------------------------------------
  // Save handler
  // -----------------------------------------------------------------------

  function handleSave() {
    startTransition(async () => {
      const result = await saveBrandConfigAction(slug, {
        logoUrl: logoUrl || undefined,
        primaryColor: primaryColor || undefined,
        whatsapp: whatsapp || undefined,
      });

      if (result.ok) {
        toast("Brand settings saved.");
      } else {
        toast("Failed to save brand settings. Try again.", {
          description: result.error,
        });
      }
    });
  }

  // Swatch background: show the actual color if valid hex, else gray-200
  const swatchColor = isValidHex(primaryColor) ? primaryColor : "#e5e7eb";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Card className="max-w-[560px] mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Brand Configuration
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ---- Logo URL ---- */}
        <div className="space-y-1.5">
          <Label htmlFor="brand-logo-url">Logo URL</Label>
          <Input
            id="brand-logo-url"
            type="url"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              if (logoUrlError) setLogoUrlError(null);
            }}
            onBlur={handleLogoUrlBlur}
            disabled={!canEdit}
            placeholder="https://example.com/logo.png"
            aria-describedby={logoUrlError ? "logo-url-error" : "logo-url-help"}
          />
          {logoUrlError ? (
            <p
              id="logo-url-error"
              className="text-sm text-red-600 mt-1"
              role="alert"
            >
              {logoUrlError}
            </p>
          ) : (
            <p id="logo-url-help" className="text-sm text-gray-500">
              Paste a publicly accessible image URL. Image upload coming later.
            </p>
          )}
        </div>

        {/* ---- Primary Color ---- */}
        <div className="space-y-1.5">
          <Label htmlFor="brand-primary-color">Primary Color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="brand-primary-color"
              type="text"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                if (primaryColorError) setPrimaryColorError(null);
              }}
              onBlur={handlePrimaryColorBlur}
              disabled={!canEdit}
              placeholder="#0f172a"
              aria-describedby={
                primaryColorError
                  ? "primary-color-error"
                  : "primary-color-help"
              }
            />
            {/* Live color swatch — 24x24px */}
            <div
              className="inline-flex shrink-0 rounded border border-gray-200"
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: swatchColor,
              }}
              aria-label="Color preview"
              role="img"
            />
          </div>
          {primaryColorError ? (
            <p
              id="primary-color-error"
              className="text-sm text-red-600 mt-1"
              role="alert"
            >
              {primaryColorError}
            </p>
          ) : (
            <p id="primary-color-help" className="text-sm text-gray-500">
              Hex color. Used in templates via{" "}
              <code className="font-mono">brand.primary_color</code>.
            </p>
          )}
        </div>

        {/* ---- WhatsApp / Contact ---- */}
        <div className="space-y-1.5">
          <Label htmlFor="brand-whatsapp">WhatsApp / Contact</Label>
          <Input
            id="brand-whatsapp"
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            disabled={!canEdit}
            placeholder="+55 11 99999-9999"
            aria-describedby="whatsapp-help"
          />
          <p id="whatsapp-help" className="text-sm text-gray-500">
            Used in templates via{" "}
            <code className="font-mono">brand.whatsapp</code>.
          </p>
        </div>

        <Separator />

        {/* ---- Brand token reference block ---- */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-2">
            Brand tokens in this workspace
          </p>
          <div className="font-mono text-sm text-gray-600 bg-gray-50 rounded p-3 border border-gray-200 space-y-1">
            <p>
              <span className="text-gray-400">brand.logo</span> ={" "}
              {logoUrl || "(not configured)"}
            </p>
            <p>
              <span className="text-gray-400">brand.primary_color</span> ={" "}
              {primaryColor || "(not configured)"}
            </p>
            <p>
              <span className="text-gray-400">brand.whatsapp</span> ={" "}
              {whatsapp || "(not configured)"}
            </p>
          </div>
        </div>
      </CardContent>

      {/* ---- Save button (only when canEdit) ---- */}
      {canEdit && (
        <CardFooter>
          <Button
            type="button"
            className="w-full"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Save Brand Settings"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
