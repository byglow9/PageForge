/**
 * TemplateCard — card component for the template list grid.
 *
 * Per UI-SPEC:
 * - Header: template.name (text-base font-semibold) + "v{N}" badge (text-sm text-gray-400)
 * - Body: field count summary "{N} fields · {R} repeater(s)" — 0 repeaters omitted
 * - Footer: "Edit Template" button (outline) + kebab MoreHorizontal button with "Delete template"
 *
 * Template schema from DB is validated with ParsedSchemaValidator before use.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { ParsedSchemaValidator } from "@/lib/templates/parsed-schema-validator";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteTemplateDialog } from "./DeleteTemplateDialog";

export interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    schemaVersion: number;
    schema: unknown;
  };
  slug: string;
}

function getFieldSummary(schema: unknown): string {
  const result = ParsedSchemaValidator.safeParse(schema);
  if (!result.success) {
    return "? fields";
  }
  const { fields, repeaters } = result.data;
  const fieldCount = fields.length;
  const repeaterCount = repeaters.length;

  if (repeaterCount === 0) {
    return `${fieldCount} field${fieldCount !== 1 ? "s" : ""}`;
  }
  return `${fieldCount} field${fieldCount !== 1 ? "s" : ""} · ${repeaterCount} repeater${repeaterCount !== 1 ? "s" : ""}`;
}

export function TemplateCard({ template, slug }: TemplateCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return null;
  }

  const fieldSummary = getFieldSummary(template.schema);

  return (
    <>
      <Card className="min-h-[120px]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="truncate text-base font-semibold text-gray-900">
              {template.name}
            </span>
            <span className="shrink-0 text-sm text-gray-400 font-normal">
              v{template.schemaVersion}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">{fieldSummary}</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          <Link
            href={`/w/${slug}/templates/${template.id}/edit`}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit Template
          </Link>
          {/* Kebab menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Template options"
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 bottom-full mb-1 z-20 min-w-[140px] bg-white border border-gray-200 rounded-md shadow-md py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete template
                  </button>
                </div>
              </>
            )}
          </div>
        </CardFooter>
      </Card>

      <DeleteTemplateDialog
        templateId={template.id}
        templateName={template.name}
        slug={slug}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => setDeleted(true)}
      />
    </>
  );
}
