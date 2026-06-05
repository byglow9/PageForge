/**
 * TemplateCard — placeholder stub.
 * Full implementation in Task 2b.
 */
"use client";

export interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    schemaVersion: number;
    schema: unknown;
  };
  slug: string;
}

export function TemplateCard({ template, slug }: TemplateCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <p className="font-semibold text-sm">{template.name}</p>
      <p className="text-xs text-gray-400">v{template.schemaVersion}</p>
    </div>
  );
}
