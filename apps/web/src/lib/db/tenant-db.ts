/**
 * Tenant-scoped database helper.
 *
 * This is the central data layer for all tenant-owned queries (D-14).
 * Feature modules MUST use this helper instead of the raw `prisma` client.
 *
 * Architecture (D-13, D-14):
 *   1. App-level: workspaceId is injected into every query through this helper.
 *   2. Database-level: PostgreSQL RLS policy enforces the same workspaceId
 *      boundary using the transaction-local setting `app.current_workspace_id`.
 *
 * The workspaceId in ctx comes from the SERVER SESSION, not from client input
 * (D-12, T-02-02-04). Do not call this helper with a workspaceId that was
 * provided by the client — always derive it from requireWorkspace() or
 * requireWorkspaceRole().
 *
 * Usage:
 *   const { workspaceId } = await requireWorkspace(slug);
 *   const result = await withTenantDb({ workspaceId }, async (db) => {
 *     return db.tenantIsolationProbe.list();
 *   });
 */
import { prisma } from "./prisma";
import type { WorkspaceContext } from "@/lib/workspaces/guards";
import type { TemplateModel as Template, BrandConfigModel as BrandConfig, LandingPageModel as LandingPage, LpAssetModel as LpAsset, FolderModel as Folder, TagModel as Tag } from "@/generated/prisma/models";
import type { Prisma } from "@/generated/prisma/client";

// -----------------------------------------------------------------------
// TenantContext — minimum context needed to establish tenant scope
// -----------------------------------------------------------------------

export interface TenantContext {
  /** The workspace's canonical ID — must come from the server session. */
  workspaceId: string;
}

// -----------------------------------------------------------------------
// Tenant-scoped helpers for TenantIsolationProbe
// -----------------------------------------------------------------------

/**
 * Tenant-scoped helpers for the TenantIsolationProbe table.
 *
 * These methods:
 * - Always inject ctx.workspaceId into writes (T-02-02-04: workspaceId from server context only)
 * - Always filter reads by ctx.workspaceId (app-level isolation, D-14)
 * - Work inside a transaction that has already SET LOCAL app.current_workspace_id
 *   (RLS backstop, D-13)
 *
 * The raw prisma transaction client (tx) is passed in from withTenantDb.
 */
export interface TenantProbeHelpers {
  /** Create a probe row scoped to the current workspace. */
  create: (label: string) => Promise<{ id: string; workspaceId: string; label: string; createdAt: Date }>;
  /** List probe rows for the current workspace only. */
  list: () => Promise<Array<{ id: string; workspaceId: string; label: string; createdAt: Date }>>;
  /** Find a probe row by ID. Returns null if the row does not exist OR belongs to a different workspace. */
  findById: (id: string) => Promise<{ id: string; workspaceId: string; label: string; createdAt: Date } | null>;
}

// -----------------------------------------------------------------------
// Tenant-scoped helpers for Template
// -----------------------------------------------------------------------

/**
 * Tenant-scoped helpers for the Template table.
 *
 * These methods:
 * - Always inject ctx.workspaceId into writes (T-03-01-03: workspaceId from server context only)
 * - Always filter reads by ctx.workspaceId (app-level isolation, D-14)
 * - update applies schemaVersion: { increment: 1 } atomically on every save (D-10)
 * - Work inside a transaction that has already SET LOCAL app.current_workspace_id
 *   (RLS backstop, T-03-01-01)
 */
export interface TenantTemplateHelpers {
  /** Create a template scoped to the current workspace. */
  create: (data: {
    id?: string;
    name: string;
    markup: string;
    schema: Prisma.InputJsonValue;
    metadataOverlay: Prisma.InputJsonValue;
    kind?: string;
  }) => Promise<Template>;
  /** Find a template by ID. Returns null if the row does not exist OR belongs to a different workspace. */
  findById: (id: string) => Promise<Template | null>;
  /** List all templates for the current workspace, ordered by updatedAt desc. */
  list: () => Promise<Template[]>;
  /**
   * Update a template. schemaVersion is incremented atomically on every save (D-10).
   * Only the fields provided are updated; workspaceId cannot be changed.
   */
  update: (
    id: string,
    data: {
      name?: string;
      markup?: string;
      schema?: Prisma.InputJsonValue;
      metadataOverlay?: Prisma.InputJsonValue;
    }
  ) => Promise<Template>;
  /** Delete a template. Returns null if not found or belongs to a different workspace. */
  delete: (id: string) => Promise<Template | null>;
}

// -----------------------------------------------------------------------
// Tenant-scoped helpers for BrandConfig
// -----------------------------------------------------------------------

/**
 * Tenant-scoped helpers for the BrandConfig table.
 *
 * One BrandConfig per workspace (workspaceId @unique).
 * upsert is used for save: create if not exists, update if exists.
 */
export interface TenantBrandHelpers {
  /** Find the brand config for the current workspace. Returns null if not set. */
  findFirst: () => Promise<BrandConfig | null>;
  /** Upsert the brand config for the current workspace. Creates or updates. */
  upsert: (data: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    whatsapp?: string | null;
  }) => Promise<BrandConfig>;
}

// -----------------------------------------------------------------------
// Tenant-scoped helpers for LandingPage
// -----------------------------------------------------------------------

/**
 * Tenant-scoped helpers for the LandingPage table.
 *
 * These methods:
 * - Always inject ctx.workspaceId into writes (T-04-01-05: workspaceId from server context only)
 * - Always filter reads by ctx.workspaceId (app-level isolation, D-14)
 * - delete performs a pre-check findFirst before deleting (T-04-01-01)
 * - Work inside a transaction that has already SET LOCAL app.current_workspace_id
 *   (RLS backstop, T-04-01-01)
 */
export interface TenantLpHelpers {
  /** Create a landing page scoped to the current workspace. */
  create: (data: {
    templateId?: string;
    name: string;
    markupSnapshot: string;
    schemaVersion: number;
    values: Prisma.InputJsonValue;
  }) => Promise<LandingPage>;
  /** Find a landing page by ID. Returns null if the row does not exist OR belongs to a different workspace. */
  findById: (id: string) => Promise<LandingPage | null>;
  /** List all landing pages for the current workspace, ordered by updatedAt desc. */
  list: () => Promise<LandingPage[]>;
  /**
   * Update a landing page. Only the fields provided are updated; workspaceId cannot be changed.
   */
  update: (
    id: string,
    data: {
      name?: string;
      values?: Prisma.InputJsonValue;
      markupSnapshot?: string;
      schemaVersion?: number;
      folderId?: string | null;
    }
  ) => Promise<LandingPage>;
  /** Delete a landing page. Returns null if not found or belongs to a different workspace. */
  delete: (id: string) => Promise<LandingPage | null>;
}

// -----------------------------------------------------------------------
// Tenant-scoped helpers for LpAsset
// -----------------------------------------------------------------------

/**
 * Tenant-scoped helpers for the LpAsset table.
 *
 * These methods track S3 keys for LP images (enables cleanup on LP delete).
 */
export interface TenantAssetHelpers {
  /** Create an LP asset record scoped to the current workspace. */
  create: (data: {
    landingPageId: string;
    s3Key: string;
    publicUrl: string;
    filename: string;
    mimeType: string;
    fileSize: number;
  }) => Promise<LpAsset>;
  /** List all LP asset records for a given landing page. */
  listByLp: (landingPageId: string) => Promise<LpAsset[]>;
  /** Delete all LP asset records for a given landing page (before or after LP delete). */
  deleteByLp: (landingPageId: string) => Promise<void>;
}

// -----------------------------------------------------------------------
// Tenant-scoped helpers for Folder (CAT-02)
// -----------------------------------------------------------------------

/**
 * Tenant-scoped helpers for the Folder table.
 *
 * These methods:
 * - Always inject ctx.workspaceId into writes (T-05-01-01: workspaceId from server context only)
 * - Always filter reads by ctx.workspaceId (app-level isolation, D-14)
 * - Work inside a transaction that has already SET LOCAL app.current_workspace_id
 *
 * Note: folder-to-folder move is deferred to a later phase.
 * No isDescendantOf helper is provided — no folder move = no cycle risk in v1 (T-05-01-04).
 */
export interface TenantFolderHelpers {
  /** Create a folder scoped to the current workspace. */
  create: (data: { name: string; parentId?: string | null }) => Promise<Folder>;
  /** Find a folder by ID. Returns null if the row does not exist OR belongs to a different workspace. */
  findById: (id: string) => Promise<Folder | null>;
  /** List all workspace folders, ordered by name asc. Tree assembled client-side from the flat adjacency list. */
  list: () => Promise<Folder[]>;
  /** Update a folder's name and/or parentId. Only the fields provided are updated. */
  update: (id: string, data: { name?: string; parentId?: string | null }) => Promise<Folder>;
  /**
   * Delete a folder row. The caller MUST re-parent child LPs and subfolders first
   * (deleteFolderAction handles this within the same withTenantDb tx). D-03.
   */
  delete: (id: string) => Promise<Folder | null>;
}

// -----------------------------------------------------------------------
// Tenant-scoped helpers for Tag (CAT-03)
// -----------------------------------------------------------------------

/**
 * Tenant-scoped helpers for the Tag table and LpTag join table.
 *
 * These methods:
 * - Always inject ctx.workspaceId into writes
 * - Always filter reads by ctx.workspaceId
 * - tag.upsertByName normalizes name (trim + toLowerCase) before upsert (D-07)
 * - tag.setTagsForLp replaces all tags for an LP atomically (delete+insert in same tx)
 */
export interface TenantTagHelpers {
  /**
   * Create-if-not-exists a tag by normalized name.
   * Normalizes: trim + toLowerCase (D-07).
   * Uses @@unique([workspaceId, name]) as the upsert key.
   */
  upsertByName: (name: string) => Promise<Tag>;
  /** List all workspace tags ordered by name asc. Used by FilterBar vocabulary (D-05/D-06). */
  listWorkspaceTags: () => Promise<Tag[]>;
  /** Upsert a tag assignment on an LP (@@unique guard prevents duplicates). */
  assignToLp: (lpId: string, tagId: string) => Promise<void>;
  /** Remove a tag assignment from an LP. */
  removeFromLp: (lpId: string, tagId: string) => Promise<void>;
  /** List all tags assigned to a single LP. */
  listForLp: (lpId: string) => Promise<Tag[]>;
  /**
   * Replace all tags for an LP atomically: delete existing lp_tag rows then insert new ones.
   * Runs within the same withTenantDb transaction for atomicity.
   */
  setTagsForLp: (lpId: string, tagIds: string[]) => Promise<void>;
  /**
   * Load all LP-tag assignments for the workspace in a single query.
   * Returns an array of { landingPageId, tag } pairs for grouping by the caller.
   * Single query: avoids N+1 when rendering the full catalog LP grid (T-05-02-05).
   */
  listAllForWorkspace: () => Promise<Array<{ landingPageId: string; tag: Tag }>>;
}

// -----------------------------------------------------------------------
// TenantClient — what the callback receives
// -----------------------------------------------------------------------

export interface TenantClient {
  /** workspaceId extracted from the context (read-only reference). */
  readonly workspaceId: string;
  /** Tenant-scoped helpers for TenantIsolationProbe. */
  readonly tenantIsolationProbe: TenantProbeHelpers;
  /** Tenant-scoped helpers for Template. */
  readonly template: TenantTemplateHelpers;
  /** Tenant-scoped helpers for BrandConfig. */
  readonly brandConfig: TenantBrandHelpers;
  /** Tenant-scoped helpers for LandingPage. */
  readonly lp: TenantLpHelpers;
  /** Tenant-scoped helpers for LpAsset. */
  readonly lpAsset: TenantAssetHelpers;
  /** Tenant-scoped helpers for Folder (CAT-02). */
  readonly folder: TenantFolderHelpers;
  /** Tenant-scoped helpers for Tag and LpTag (CAT-03). */
  readonly tag: TenantTagHelpers;
}

// -----------------------------------------------------------------------
// withTenantDb
// -----------------------------------------------------------------------

/**
 * Execute a callback inside a Prisma transaction with the RLS workspace
 * setting applied.
 *
 * The function:
 * 1. Opens a `$transaction`.
 * 2. Sets `app.current_workspace_id` transaction-locally — the RLS policy on
 *    tenant-owned tables reads this setting.
 * 3. Passes a `TenantClient` to the callback. The client exposes only
 *    tenant-scoped helpers (never the raw transaction).
 * 4. Commits on success; rolls back on error.
 *
 * @param ctx - Tenant context with workspaceId from server session.
 * @param callback - Async function that receives a TenantClient.
 * @returns The value returned by the callback.
 */
export async function withTenantDb<T>(
  ctx: TenantContext,
  callback: (db: TenantClient) => Promise<T>
): Promise<T> {
  const { workspaceId } = ctx;

  return prisma.$transaction(async (tx) => {
    // D-13, D-14: Set the transaction-local workspace ID for the RLS policy.
    // set_config() accepts bind parameters, unlike SET LOCAL syntax, so this
    // avoids interpolating workspaceId into SQL.
    await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;

    // Build the tenant-scoped client for the callback
    const tenantClient: TenantClient = {
      workspaceId,

      tenantIsolationProbe: {
        create: async (label: string) => {
          return tx.tenantIsolationProbe.create({
            data: {
              workspaceId, // injected from server context, never from client
              label,
            },
          });
        },

        list: async () => {
          return tx.tenantIsolationProbe.findMany({
            where: { workspaceId }, // app-level filter (D-14)
          });
        },

        findById: async (id: string) => {
          // App-level filter: the where clause includes workspaceId so a
          // cross-workspace ID lookup returns null without hitting the DB row.
          // RLS is the backstop if the app-level filter is somehow bypassed.
          return tx.tenantIsolationProbe.findFirst({
            where: {
              id,
              workspaceId, // app-level isolation
            },
          });
        },
      },

      template: {
        create: async (data) => {
          return tx.template.create({
            data: {
              ...data,
              workspaceId, // injected from server context, never from client (T-03-01-03)
            },
          });
        },

        findById: async (id: string) => {
          // App-level filter: id + workspaceId ensures cross-workspace lookup returns null (T-03-01-01)
          return tx.template.findFirst({
            where: {
              id,
              workspaceId, // app-level isolation
            },
          });
        },

        list: async () => {
          return tx.template.findMany({
            where: { workspaceId }, // app-level filter (D-14)
            orderBy: { updatedAt: "desc" },
          });
        },

        update: async (id: string, data) => {
          return tx.template.update({
            where: {
              id,
              workspaceId, // app-level isolation: prevents cross-workspace update
            },
            data: {
              ...data,
              schemaVersion: { increment: 1 }, // D-10: atomic increment on every save
            },
          });
        },

        delete: async (id: string) => {
          // App-level check before delete: confirm the template belongs to this workspace
          const existing = await tx.template.findFirst({
            where: { id, workspaceId },
          });
          if (!existing) {
            return null;
          }
          return tx.template.delete({
            where: { id, workspaceId },
          });
        },
      },

      brandConfig: {
        findFirst: async () => {
          return tx.brandConfig.findFirst({
            where: { workspaceId }, // app-level filter (D-14)
          });
        },

        upsert: async (data) => {
          // workspaceId @unique enables upsert with where: { workspaceId }
          return tx.brandConfig.upsert({
            where: { workspaceId },
            create: { workspaceId, ...data },
            update: { ...data },
          });
        },
      },

      lp: {
        create: async (data) => {
          return tx.landingPage.create({
            data: {
              ...data,
              workspaceId, // injected from server context, never from client (T-04-01-05)
            },
          });
        },

        findById: async (id: string) => {
          // App-level filter: id + workspaceId ensures cross-workspace lookup returns null (T-04-01-01)
          return tx.landingPage.findFirst({
            where: {
              id,
              workspaceId, // app-level isolation
            },
          });
        },

        list: async () => {
          return tx.landingPage.findMany({
            where: { workspaceId }, // app-level filter (D-14)
            orderBy: { updatedAt: "desc" },
          });
        },

        update: async (id: string, data) => {
          return tx.landingPage.update({
            where: {
              id,
              workspaceId, // app-level isolation: prevents cross-workspace update
            },
            data,
          });
        },

        delete: async (id: string) => {
          // App-level check before delete: confirm the LP belongs to this workspace (T-04-01-01)
          const existing = await tx.landingPage.findFirst({
            where: { id, workspaceId },
          });
          if (!existing) {
            return null;
          }
          return tx.landingPage.delete({
            where: { id, workspaceId },
          });
        },
      },

      lpAsset: {
        create: async (data) => {
          return tx.lpAsset.create({
            data: {
              ...data,
              workspaceId, // injected from server context, never from client
            },
          });
        },

        listByLp: async (landingPageId: string) => {
          return tx.lpAsset.findMany({
            where: { landingPageId, workspaceId }, // always scope by workspaceId for defence-in-depth
          });
        },

        deleteByLp: async (landingPageId: string) => {
          await tx.lpAsset.deleteMany({
            where: { landingPageId, workspaceId },
          });
        },
      },

      // -----------------------------------------------------------------------
      // folder helpers (CAT-02)
      // -----------------------------------------------------------------------

      folder: {
        create: async (data) => {
          return tx.folder.create({
            data: {
              workspaceId, // injected from server context, never from client (T-05-01-01)
              name: data.name,
              parentId: data.parentId ?? null,
            },
          });
        },

        findById: async (id: string) => {
          // App-level filter: id + workspaceId ensures cross-workspace lookup returns null (T-05-01-01)
          return tx.folder.findFirst({
            where: {
              id,
              workspaceId, // app-level isolation
            },
          });
        },

        list: async () => {
          return tx.folder.findMany({
            where: { workspaceId }, // app-level filter (D-14)
            orderBy: { name: "asc" },
          });
        },

        update: async (id: string, data) => {
          return tx.folder.update({
            where: {
              id,
              workspaceId, // app-level isolation: prevents cross-workspace update
            },
            data: {
              ...(data.name !== undefined ? { name: data.name } : {}),
              ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
            },
          });
        },

        delete: async (id: string) => {
          // App-level check before delete: confirm the folder belongs to this workspace
          // NOTE: caller MUST re-parent child LPs and subfolders first within the same tx (D-03)
          const existing = await tx.folder.findFirst({
            where: { id, workspaceId },
          });
          if (!existing) {
            return null;
          }
          return tx.folder.delete({
            where: { id, workspaceId },
          });
        },
      },

      // -----------------------------------------------------------------------
      // tag helpers (CAT-03)
      // -----------------------------------------------------------------------

      tag: {
        upsertByName: async (name: string) => {
          // D-07: normalize — trim + toLowerCase before upsert
          const normalized = name.trim().toLowerCase();
          return tx.tag.upsert({
            where: {
              workspaceId_name: {
                workspaceId,
                name: normalized,
              },
            },
            create: {
              workspaceId, // injected from server context
              name: normalized,
            },
            update: {}, // no-op on conflict — row already exists with correct name
          });
        },

        listWorkspaceTags: async () => {
          return tx.tag.findMany({
            where: { workspaceId }, // app-level filter (D-14)
            orderBy: { name: "asc" },
          });
        },

        assignToLp: async (lpId: string, tagId: string) => {
          // @@unique([landingPageId, tagId]) guards against duplicate assignment
          await tx.lpTag.upsert({
            where: {
              landingPageId_tagId: {
                landingPageId: lpId,
                tagId,
              },
            },
            create: {
              landingPageId: lpId,
              tagId,
              workspaceId, // denormalized for RLS
            },
            update: {}, // no-op on conflict
          });
        },

        removeFromLp: async (lpId: string, tagId: string) => {
          await tx.lpTag.deleteMany({
            where: {
              landingPageId: lpId,
              tagId,
              workspaceId, // app-level isolation
            },
          });
        },

        listForLp: async (lpId: string) => {
          const lpTags = await tx.lpTag.findMany({
            where: {
              landingPageId: lpId,
              workspaceId, // app-level isolation
            },
            include: { tag: true },
          });
          return lpTags.map((lt) => lt.tag);
        },

        setTagsForLp: async (lpId: string, tagIds: string[]) => {
          // Delete all existing lp_tag rows for this LP (workspace-scoped) then insert new ones.
          // Runs within the same withTenantDb transaction for atomicity.
          await tx.lpTag.deleteMany({
            where: {
              landingPageId: lpId,
              workspaceId, // app-level isolation
            },
          });
          if (tagIds.length > 0) {
            await tx.lpTag.createMany({
              data: tagIds.map((tagId) => ({
                landingPageId: lpId,
                tagId,
                workspaceId,
              })),
            });
          }
        },

        listAllForWorkspace: async () => {
          // Single query joining lp_tag + tag for the workspace.
          // Avoids N+1 when rendering the full catalog LP grid (T-05-02-05).
          const lpTags = await tx.lpTag.findMany({
            where: { workspaceId }, // app-level isolation (D-14)
            include: { tag: true },
          });
          return lpTags.map((lt) => ({
            landingPageId: lt.landingPageId,
            tag: lt.tag,
          }));
        },
      },
    };

    return callback(tenantClient);
  });
}

/**
 * Convenience overload that accepts a full WorkspaceContext (from guards.ts).
 * Extracts workspaceId and delegates to withTenantDb.
 */
export async function withWorkspaceTenantDb<T>(
  ctx: WorkspaceContext,
  callback: (db: TenantClient) => Promise<T>
): Promise<T> {
  return withTenantDb({ workspaceId: ctx.workspaceId }, callback);
}
