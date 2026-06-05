/**
 * Template Server Actions.
 *
 * All mutations require an authenticated workspace member with role
 * owner, admin, or editor. workspaceId is always derived from the
 * server session via requireWorkspaceRole — never from client input.
 *
 * Architecture:
 * - createTemplateAction and updateTemplateAction call parse(markup)
 *   server-side on every save (D-02). The result stored in the DB is
 *   the save-time parse result, not the live advisory output.
 * - Warnings from parse() do NOT block saving (D-03). They are returned
 *   in the result data so the client can surface them as Alert components.
 * - schemaVersion is incremented atomically in db.template.update (D-10).
 * - Only { parse } is imported from pageforge-engine — never { render }.
 *   Importing render would bundle the Liquid engine into the Server Action
 *   module graph, which can cause "sanitize-html is not a browser module"
 *   build errors when the action is used from a client component (Pitfall 1).
 * - D-11: these actions do not touch LP records (LP records do not exist
 *   in Phase 3). schema_version is incremented as a traceability stamp only.
 *
 * Security (T-03-03-01 through T-03-03-08):
 * - workspaceId is always derived from requireWorkspaceRole (session-backed).
 * - findById always filters by workspaceId — cross-workspace IDs return null.
 * - viewer role cannot mutate templates (requires owner/admin/editor).
 * - slug forging is blocked by requireWorkspaceRole's membership validation.
 */
"use server";

import { parse } from "pageforge-engine";
import { ParsedSchemaSchema } from "pageforge-engine";
import { requireWorkspaceRole, requireWorkspace } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { CreateTemplateSchema, UpdateTemplateSchema } from "./schema";
import { reconcileMetadataOverlay, type MetadataOverlay } from "./metadata";
import type { ActionResult } from "@/lib/workspaces/actions";

// -----------------------------------------------------------------------
// createTemplateAction
// -----------------------------------------------------------------------

/**
 * Create a new template in the given workspace.
 *
 * Steps:
 * 1. Gate: owner/admin/editor only (viewers cannot create templates).
 * 2. Zod validate input.
 * 3. parse(markup) server-side — authoritative schema (D-02).
 * 4. reconcileMetadataOverlay — build default overlay for detected fields (D-05).
 * 5. Persist via TenantClient.template.create (workspaceId injected server-side).
 *
 * Returns { ok: true, data: { id, schemaVersion, warnings } } on success.
 * Returns { ok: false, error, fieldErrors? } on validation failure.
 * Returns { ok: false, error } on DB/unexpected error.
 *
 * D-03: warnings from parse() do NOT block saving.
 */
export async function createTemplateAction(
  slug: string,
  input: { name: string; markup: string; metadataOverlay?: MetadataOverlay }
): Promise<ActionResult<{ id: string; schemaVersion: number; warnings: string[] }>> {
  // Step 1: Require owner/admin/editor — viewer cannot create templates (T-03-03-03)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Step 2: Validate input
  const parsed = CreateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const { name, markup, metadataOverlay: inputOverlay } = parsed.data;

  try {
    // Step 3: Server-side authoritative parse (D-02). Only { parse } imported — never render (Pitfall 1).
    const schema = parse(markup);

    // Step 4: Reconcile metadata overlay — preserves existing labels/required flags,
    // creates defaults for new fields, drops fields no longer in schema (D-05).
    const overlay = reconcileMetadataOverlay(schema.fields, inputOverlay ?? {});

    // Step 5: Persist with workspaceId from server context (T-03-03-01)
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const template = await db.template.create({
        name,
        markup,
        schema: schema as object,
        metadataOverlay: overlay as object,
      });
      return {
        ok: true,
        data: {
          id: template.id,
          schemaVersion: template.schemaVersion,
          warnings: schema.warnings,
        },
      };
    });
  } catch {
    return { ok: false, error: "Failed to save template. Please try again." };
  }
}

// -----------------------------------------------------------------------
// updateTemplateAction
// -----------------------------------------------------------------------

/**
 * Update an existing template in the given workspace.
 *
 * Steps:
 * 1. Gate: owner/admin/editor only.
 * 2. Zod validate input.
 * 3. If markup provided: parse(markup) server-side (D-02); else fetch existing schema.
 * 4. reconcileMetadataOverlay.
 * 5. db.template.update — schemaVersion: { increment: 1 } is applied atomically (D-10).
 *
 * D-10: schemaVersion increments on every save. The increment is applied inside
 * TenantClient.template.update, not here — this keeps the atomic guarantee at the
 * DB layer even if the action is called multiple times concurrently.
 *
 * D-11: no LP records are touched. schema_version increments as a traceability stamp only.
 */
export async function updateTemplateAction(
  slug: string,
  input: {
    id: string;
    name?: string;
    markup?: string;
    metadataOverlay?: MetadataOverlay;
  }
): Promise<ActionResult<{ id: string; schemaVersion: number; warnings: string[] }>> {
  // Step 1: Gate (T-03-03-03)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Step 2: Validate input
  const parsed = UpdateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const { id, name, markup, metadataOverlay: inputOverlay } = parsed.data;

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      let schema: ReturnType<typeof parse> | null = null;
      let overlay: MetadataOverlay;

      if (markup) {
        // Step 3a: Re-parse when markup is provided — authoritative schema (D-02)
        schema = parse(markup);
        overlay = reconcileMetadataOverlay(schema.fields, inputOverlay ?? {});
      } else {
        // Step 3b: No markup change — fetch existing schema to reconcile overlay
        const existing = await db.template.findById(id);
        if (existing) {
          // Validate DB JSON with ParsedSchemaSchema before use (RESEARCH anti-pattern: never cast directly)
          const schemaParsed = ParsedSchemaSchema.safeParse(existing.schema);
          const existingFields = schemaParsed.success ? schemaParsed.data.fields : [];
          overlay = reconcileMetadataOverlay(existingFields, inputOverlay ?? {});
        } else {
          overlay = {};
        }
      }

      // Step 5: Update — schemaVersion: { increment: 1 } is applied atomically inside
      // TenantClient.template.update (D-10). workspaceId filter prevents cross-workspace update (T-03-03-02).
      const updated = await db.template.update(id, {
        ...(name !== undefined ? { name } : {}),
        ...(markup !== undefined ? { markup } : {}),
        ...(schema !== null ? { schema: schema as object } : {}),
        metadataOverlay: overlay as object,
      });

      return {
        ok: true,
        data: {
          id: updated.id,
          schemaVersion: updated.schemaVersion,
          warnings: schema?.warnings ?? [],
        },
      };
    });
  } catch {
    return { ok: false, error: "Failed to save template. Please try again." };
  }
}

// -----------------------------------------------------------------------
// deleteTemplateAction
// -----------------------------------------------------------------------

/**
 * Delete a template from the given workspace.
 *
 * Cross-workspace delete attempts return { ok: false } because
 * db.template.findById filters by workspaceId (T-03-03-02).
 */
export async function deleteTemplateAction(
  slug: string,
  templateId: string
): Promise<ActionResult> {
  // Gate: owner/admin/editor only
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      // findById filters by workspaceId — cross-workspace ID returns null (T-03-03-02)
      const existing = await db.template.findById(templateId);
      if (!existing) {
        return { ok: false, error: "Template not found in this workspace." };
      }

      await db.template.delete(templateId);
      return { ok: true, data: undefined };
    });
  } catch {
    return { ok: false, error: "Failed to delete template. Please try again." };
  }
}

// -----------------------------------------------------------------------
// listTemplatesAction
// -----------------------------------------------------------------------

/**
 * List all templates for the given workspace.
 *
 * Any workspace member (including viewers) can list templates — the viewer
 * role has template "read" permission (permissions.ts). This uses requireWorkspace
 * (any member) rather than requireWorkspaceRole (specific roles).
 *
 * T-03-03-01: withTenantDb injects workspaceId into list query
 * (WHERE workspaceId = ctx.workspaceId); RLS backstop active on template table.
 */
export async function listTemplatesAction(
  slug: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      schemaVersion: number;
      schema: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>
  >
> {
  // Any workspace member can list templates (viewer has template.read)
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const templates = await db.template.list();
      return {
        ok: true,
        data: templates.map((t) => ({
          id: t.id,
          name: t.name,
          schemaVersion: t.schemaVersion,
          schema: t.schema,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      };
    });
  } catch {
    return { ok: false, error: "Failed to load templates. Please try again." };
  }
}
