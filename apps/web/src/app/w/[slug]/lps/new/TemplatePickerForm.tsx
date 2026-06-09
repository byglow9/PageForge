"use client";
/**
 * TemplatePickerForm — client island for the template picker page.
 *
 * Handles Select + Input state + router.push navigation.
 * "Continue" navigates to /w/[slug]/lps/new/[templateId]?name=...
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Template {
  id: string;
  name: string;
  schemaVersion: number;
}

interface TemplatePickerFormProps {
  slug: string;
  templates: Template[];
}

export function TemplatePickerForm({ slug, templates }: TemplatePickerFormProps) {
  const router = useRouter();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [lpName, setLpName] = useState("");

  const canContinue = selectedTemplateId !== "" && lpName.trim() !== "";

  function handleContinue() {
    if (!canContinue) return;
    const params = new URLSearchParams({ name: lpName.trim() });
    router.push(`/w/${slug}/lps/new/${selectedTemplateId}?${params.toString()}`);
  }

  return (
    <Card className="max-w-[480px] mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Select a Template
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {templates.length === 0 ? (
          <Alert>
            <AlertDescription>
              No templates found. Create a template first.{" "}
              <Link
                href={`/w/${slug}/templates/new`}
                className="underline hover:text-gray-900"
              >
                Create a template
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Template picker */}
            <div>
              <Label
                htmlFor="template-select"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Template
              </Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(value) => setSelectedTemplateId(value ?? "")}
              >
                <SelectTrigger
                  id="template-select"
                  aria-label="Select a template"
                >
                  <SelectValue placeholder="Select a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} (schema v{template.schemaVersion})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LP Name */}
            <div>
              <Label
                htmlFor="lp-name-input"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Landing Page Name
                <span className="text-red-500 ml-1" aria-label="required">
                  *
                </span>
              </Label>
              <Input
                id="lp-name-input"
                type="text"
                value={lpName}
                onChange={(e) => setLpName(e.target.value)}
                placeholder="e.g. Grécia Jun/2026"
                aria-required="true"
                aria-describedby="lp-name-help"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue) {
                    handleContinue();
                  }
                }}
              />
              <p id="lp-name-help" className="text-sm text-gray-500 mt-1">
                This name identifies your LP in the catalog.
              </p>
            </div>

            {/* Continue CTA */}
            <Button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="w-full bg-gray-900 text-white hover:bg-gray-800"
            >
              Continue
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
