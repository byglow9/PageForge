/**
 * TemplateEditor — placeholder stub.
 * Full implementation in Task 2b.
 */
"use client";

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
  return (
    <div className="p-8">
      <p className="text-sm text-gray-500">
        Template editor ({mode}) — {slug}
        {initialTemplate ? ` — editing: ${initialTemplate.name}` : ""}
      </p>
    </div>
  );
}
