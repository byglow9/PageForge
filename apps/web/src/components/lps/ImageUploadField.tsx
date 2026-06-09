"use client";
/**
 * ImageUploadField — drag-and-drop image upload field for LP forms.
 *
 * States: idle | uploading | uploaded | error
 *
 * Upload flow:
 * 1. Client pre-validates MIME type + file size (UX guard — not trust boundary).
 * 2. Reads first 4100 bytes for server-side magic-bytes validation.
 * 3. Calls requestPresignedUploadAction — server validates magic bytes + size cap,
 *    returns a tenant-scoped presigned PUT URL.
 * 4. Browser PUTs file directly to S3 via XHR (progress tracking via upload event).
 *    App server never receives the full image bytes (D-02).
 * 5. On XHR success: calls validateUploadedImageAction — server fetches first 64 KB
 *    from S3, runs image-size, deletes and rejects if > 5000×5000 px (D-03).
 * 6. On validate success: field.onChange({publicUrl, s3Key}) — stores OBJECT, not plain URL.
 *    generateLpAction (Plan 02) unwraps publicUrl for rendering and s3Key for LpAsset records.
 *
 * Security:
 * - T-04-03-01: magic bytes validated server-side; client MIME check is UX only.
 * - T-04-03-05: only 4100 bytes reach the app server; full bytes go directly to S3.
 * - T-04-03-06: S3 key is constructed server-side using workspaceId from session.
 */

import { useRef, useState, useCallback } from "react";
import { Controller, type Control } from "react-hook-form";
import { UploadCloud, AlertCircle, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { requestPresignedUploadAction, validateUploadedImageAction } from "@/lib/lps/actions";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

type UploadState = "idle" | "uploading" | "uploaded" | "error";

export interface ImageUploadFieldProps {
  name: string;
  slug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  label: string;
  required?: boolean;
}

// -----------------------------------------------------------------------
// Helper: format file size as "1.2 MB" or "450 KB"
// -----------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

// -----------------------------------------------------------------------
// ImageUploadField
// -----------------------------------------------------------------------

export function ImageUploadField({
  name,
  slug,
  control,
  label,
  required,
}: ImageUploadFieldProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  // -----------------------------------------------------------------------
  // Core upload handler
  // -----------------------------------------------------------------------

  const handleFile = useCallback(
    async (file: File, onChange: (value: string | { publicUrl: string; s3Key: string }) => void) => {
      // Reset error state
      setErrorMessage("");

      // Client-side pre-validation (UX guard — not the trust boundary)
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setUploadState("error");
        setErrorMessage("Only PNG, JPG, and WEBP images are accepted.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setUploadState("error");
        setErrorMessage(
          "File exceeds the 5 MB limit. Compress or resize the image and try again."
        );
        return;
      }

      setUploadState("uploading");
      setUploadProgress(0);
      setFilename(file.name);
      setFileSize(file.size);

      // Read first 4100 bytes for server-side magic-bytes validation
      const buffer = await file.slice(0, 4100).arrayBuffer();
      const firstBytes = Array.from(new Uint8Array(buffer));

      // Request presigned URL — server validates magic bytes + size cap
      const presignResult = await requestPresignedUploadAction(slug, {
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
        firstBytes,
      });

      if (!presignResult.ok) {
        setUploadState("error");
        setErrorMessage(
          presignResult.error ?? "File does not appear to be a valid image. Try a different file."
        );
        onChange("");
        return;
      }

      const { presignedUrl, publicUrl, key } = presignResult.data;

      // XHR PUT directly to S3 — app server never handles the full image bytes (D-02)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 PUT failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      }).catch((err: Error) => {
        xhrRef.current = null;
        if (err.message === "Upload cancelled") {
          setUploadState("idle");
          setUploadProgress(0);
          onChange("");
        } else {
          setUploadState("error");
          setErrorMessage(
            "Upload failed. Check your connection and try again."
          );
          onChange("");
        }
        return null;
      }).then(async (result) => {
        if (result === null) return; // Error path already handled

        xhrRef.current = null;

        // Server-side pixel cap validation (D-03)
        const validateResult = await validateUploadedImageAction(slug, { key });

        if (!validateResult.ok) {
          setUploadState("error");
          setErrorMessage(
            validateResult.error ??
              "Image dimensions exceed the limit. Resize the image and try again."
          );
          onChange("");
          return;
        }

        // Success — store {publicUrl, s3Key} object (BLOCKER 3: generateLpAction unwraps this)
        setUploadState("uploaded");
        setPreviewUrl(publicUrl);
        onChange({ publicUrl, s3Key: key });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug]
  );

  // -----------------------------------------------------------------------
  // Drag & drop handlers
  // -----------------------------------------------------------------------

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>,
    onChange: (value: string | { publicUrl: string; s3Key: string }) => void
  ) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      void handleFile(file, onChange);
    }
  }

  function handleFileInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: string | { publicUrl: string; s3Key: string }) => void
  ) {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file, onChange);
    }
    // Reset input so the same file can be re-selected after removal
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // -----------------------------------------------------------------------
  // Cancel upload
  // -----------------------------------------------------------------------

  function handleCancel(
    onChange: (value: string | { publicUrl: string; s3Key: string }) => void
  ) {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploadState("idle");
    setUploadProgress(0);
    onChange("");
  }

  // -----------------------------------------------------------------------
  // Remove uploaded image
  // -----------------------------------------------------------------------

  function handleRemove(
    onChange: (value: string | { publicUrl: string; s3Key: string }) => void
  ) {
    setUploadState("idle");
    setPreviewUrl("");
    setFilename("");
    setFileSize(0);
    onChange("");
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const onChange = field.onChange as (
          value: string | { publicUrl: string; s3Key: string }
        ) => void;

        return (
          <div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => handleFileInputChange(e, onChange)}
            />

            {/* ---- Idle state ---- */}
            {uploadState === "idle" && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload image"
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg min-h-[128px] bg-gray-50 cursor-pointer transition-colors ${
                  isDragOver
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, onChange)}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <UploadCloud
                  className="text-gray-300"
                  style={{ width: 32, height: 32 }}
                  aria-hidden="true"
                />
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Drag and drop or click to upload
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    PNG, JPG, WEBP · Max 5 MB
                  </p>
                </div>
                {required && (
                  <span className="sr-only">Required</span>
                )}
              </div>
            )}

            {/* ---- Uploading state ---- */}
            {uploadState === "uploading" && (
              <div className="border border-gray-200 rounded-lg min-h-[64px] bg-white px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate max-w-[80%]">{filename}</p>
                  <button
                    type="button"
                    onClick={() => handleCancel(onChange)}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    aria-label="Cancel upload"
                  >
                    Cancel
                  </button>
                </div>
                <Progress
                  value={uploadProgress}
                  className="h-1.5"
                  aria-label="Upload progress"
                  aria-valuenow={uploadProgress}
                />
                <p className="text-sm text-gray-500">
                  Uploading… {uploadProgress}%
                </p>
              </div>
            )}

            {/* ---- Uploaded (success) state ---- */}
            {uploadState === "uploaded" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                {/* Thumbnail */}
                <img
                  src={previewUrl}
                  alt={filename}
                  className="object-cover rounded shrink-0"
                  style={{ width: 48, height: 48 }}
                />
                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {filename}
                  </p>
                  <p className="text-sm text-gray-500">
                    Uploaded · {formatBytes(fileSize)}
                  </p>
                </div>
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(onChange)}
                  aria-label="Remove image"
                  className="text-gray-400 hover:text-red-500 transition-colors shrink-0 p-1"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* ---- Error state ---- */}
            {uploadState === "error" && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className="text-red-500 shrink-0 mt-0.5"
                    style={{ width: 16, height: 16 }}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-red-600">{errorMessage}</p>
                    <button
                      type="button"
                      className="text-sm text-red-500 hover:text-red-700 underline mt-1 transition-colors"
                      onClick={() => {
                        setUploadState("idle");
                        setErrorMessage("");
                        // Small delay to allow state update before reopening picker
                        setTimeout(() => fileInputRef.current?.click(), 50);
                      }}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
