"use client";

/**
 * ProjectTemplateForm — client component for VITE_SPA project template upload.
 *
 * The ZIP file goes directly to the Server Action via FormData (not presigned URL).
 * This is appropriate because the ZIP must be processed server-side before storage
 * (zip-slip check, zip-bomb check, secret scan, S3 upload).
 *
 * On success: redirects to the templates list.
 * On success with findings: shows a warning toast listing finding count before redirect.
 * On error: shows an error toast.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProjectTemplateAction } from "@/lib/project-templates/actions";

interface ProjectTemplateFormProps {
  slug: string;
}

export function ProjectTemplateForm({ slug }: ProjectTemplateFormProps) {
  const router = useRouter();
  const [findings, setFindings] = useState<
    Array<{ file: string; type: string; description: string }>
  >([]);
  const [isPending, startTransition] = useTransition();
  const [nameError, setNameError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createProjectTemplateAction(slug, formData);

      if (result.ok) {
        setFindings(result.data.findings);
        if (result.data.findings.length > 0) {
          // Stay on the page so the user can read the findings rendered below
          // before navigating away (D6: warn before concluding).
          toast.warning(
            `Template created with ${result.data.findings.length} security warning(s). Review the findings below before deploying.`
          );
        } else {
          toast.success("Project template created.");
          router.push(`/w/${slug}/templates`);
        }
      } else {
        if (result.fieldErrors?.name) {
          setNameError(result.fieldErrors.name[0]);
        }
        toast.error(result.error ?? "Upload failed.");
      }
    });
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <Link
        href={`/w/${slug}/templates`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to templates
      </Link>
      <h1 className="text-2xl font-semibold">New Project Template</h1>

      <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4">
        {/* Template name */}
        <div className="space-y-1">
          <Label htmlFor="name">Template name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Template name"
            maxLength={128}
            aria-describedby={nameError ? "name-error" : undefined}
          />
          {nameError && (
            <p id="name-error" className="text-sm text-red-600">
              {nameError}
            </p>
          )}
        </div>

        {/* ZIP file upload */}
        <div className="space-y-1">
          <Label htmlFor="zipFile">Vite dist/ ZIP</Label>
          <input
            id="zipFile"
            name="zipFile"
            type="file"
            accept=".zip"
            required
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Upload the pre-built dist/ folder as a ZIP. Maximum 50 MB compressed / 200 MB
            uncompressed.
          </p>
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Uploading..." : "Upload Template"}
        </Button>
      </form>

      {/* Security findings (shown after submission, before redirect) */}
      {findings.length > 0 && (
        <section className="bg-amber-50 rounded p-3 space-y-2">
          <h2 className="font-medium text-amber-900">Security Warnings</h2>
          <ul className="text-amber-700 space-y-1 text-sm list-disc list-inside">
            {findings.map((finding, i) => (
              <li key={i}>
                <span className="font-medium">{finding.type}</span> in{" "}
                <code className="text-xs">{finding.file}</code>: {finding.description}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/w/${slug}/templates`)}
          >
            I&apos;ve reviewed these — continue to templates
          </Button>
        </section>
      )}
    </div>
  );
}
