"use client";
/**
 * RichTextField — Tiptap rich text editor wired via React Hook Form Controller.
 *
 * Architecture (Pitfall 2 from 04-RESEARCH.md):
 * - useEditor must NOT be called inside the Controller render prop (hooks-in-callbacks rule).
 * - The inner RichTextEditor component owns useEditor — it is a real React component.
 * - The outer RichTextField wraps Controller to bridge RHF state to Tiptap.
 *
 * Security: Tiptap outputs HTML via editor.getHTML(). This value is stored in LP.values
 * and passed to the engine on generate. The engine's sanitizeRichText (sanitize-html
 * with allowlist) is applied server-side during renderLp(), not client-side (T-04-02-03).
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Controller, type Control } from "react-hook-form";
import { Bold, Italic, List, ListOrdered, Link2 } from "lucide-react";

// -----------------------------------------------------------------------
// Inner component — owns useEditor (hooks allowed here; it's a real component)
// -----------------------------------------------------------------------

interface RichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  required?: boolean;
}

function RichTextEditor({ value, onChange, label, required }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false, // REQUIRED for Next.js SSR (avoids hydration mismatch)
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div
      aria-label={`${label} rich text editor`}
      className="border border-input rounded-md overflow-hidden"
    >
      {/* Toolbar — Bold, Italic, BulletList, OrderedList, Link */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-input bg-gray-50">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          aria-label="Bold"
          aria-pressed={editor?.isActive("bold")}
          className={`p-1.5 rounded text-sm transition-colors ${
            editor?.isActive("bold")
              ? "bg-gray-200 text-gray-900"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <Bold className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          aria-label="Italic"
          aria-pressed={editor?.isActive("italic")}
          className={`p-1.5 rounded text-sm transition-colors ${
            editor?.isActive("italic")
              ? "bg-gray-200 text-gray-900"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <Italic className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
          aria-pressed={editor?.isActive("bulletList")}
          className={`p-1.5 rounded text-sm transition-colors ${
            editor?.isActive("bulletList")
              ? "bg-gray-200 text-gray-900"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          aria-label="Ordered list"
          aria-pressed={editor?.isActive("orderedList")}
          className={`p-1.5 rounded text-sm transition-colors ${
            editor?.isActive("orderedList")
              ? "bg-gray-200 text-gray-900"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter URL");
            if (url) {
              editor?.chain().focus().setLink({ href: url }).run();
            }
          }}
          aria-label="Link"
          aria-pressed={editor?.isActive("link")}
          className={`p-1.5 rounded text-sm transition-colors ${
            editor?.isActive("link")
              ? "bg-gray-200 text-gray-900"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="min-h-[120px] px-3 py-2 text-sm text-gray-900 prose prose-sm max-w-none focus:outline-none"
        aria-required={required ? "true" : undefined}
      />
    </div>
  );
}

// -----------------------------------------------------------------------
// Outer component — wires Controller
// -----------------------------------------------------------------------

export interface RichTextFieldProps {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  defaultValue?: string;
  label: string;
  required?: boolean;
}

export function RichTextField({
  name,
  control,
  defaultValue = "",
  label,
  required,
}: RichTextFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      render={({ field }) => (
        <RichTextEditor
          value={field.value as string}
          onChange={field.onChange}
          label={label}
          required={required}
        />
      )}
    />
  );
}
