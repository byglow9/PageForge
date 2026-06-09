"use client";
/**
 * BrandGlobalsPanel — read-only display of brand globals at top of LP form.
 *
 * Per UI-SPEC:
 * - gray-50 background, border border-gray-200, rounded-md, p-4, mb-6.
 * - Heading: "Brand Globals" text-sm font-semibold text-gray-500 uppercase tracking-wide.
 * - Three rows: brand.logo, brand.primary_color, brand.whatsapp.
 * - Unset values: "(not configured)" in text-gray-400 italic.
 * - Bottom right: "Configure brand →" link to /w/[slug]/brand.
 *
 * Per D-04: brand globals are LIVE — always resolved from BrandConfig at render time.
 * This panel shows what will be injected into the LP.
 * Per D-05: missing brand.* fields render as empty string in the LP — no error.
 */

import Link from "next/link";

export interface BrandGlobalsPanelProps {
  brand: {
    logoUrl: string | null;
    primaryColor: string | null;
    whatsapp: string | null;
  } | null;
  slug: string;
}

export function BrandGlobalsPanel({ brand, slug }: BrandGlobalsPanelProps) {
  return (
    <div
      className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6"
      aria-label="Brand globals (read-only)"
    >
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Brand Globals
      </p>

      <div className="font-mono text-sm text-gray-600 space-y-1">
        <p>
          <span className="text-gray-400">brand.logo</span>
          {" = "}
          {brand?.logoUrl ? (
            <span className="text-gray-700">{brand.logoUrl}</span>
          ) : (
            <em className="text-gray-400 not-italic">(not configured)</em>
          )}
        </p>
        <p>
          <span className="text-gray-400">brand.primary_color</span>
          {" = "}
          {brand?.primaryColor ? (
            <span className="text-gray-700">{brand.primaryColor}</span>
          ) : (
            <em className="text-gray-400 not-italic">(not configured)</em>
          )}
        </p>
        <p>
          <span className="text-gray-400">brand.whatsapp</span>
          {" = "}
          {brand?.whatsapp ? (
            <span className="text-gray-700">{brand.whatsapp}</span>
          ) : (
            <em className="text-gray-400 not-italic">(not configured)</em>
          )}
        </p>
      </div>

      <div className="flex justify-end mt-3">
        <Link
          href={`/w/${slug}/brand`}
          className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors"
        >
          Configure brand →
        </Link>
      </div>
    </div>
  );
}
