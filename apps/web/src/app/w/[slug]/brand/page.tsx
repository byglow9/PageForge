/**
 * Brand Settings page — /w/[slug]/brand
 *
 * RSC page. Fetches the current brand config server-side and passes to the
 * BrandConfigForm client island. Only owner/admin/editor can access; viewers
 * are redirected to /w/{slug}. Saving is also enforced server-side in
 * saveBrandConfigAction.
 *
 * Security (T-03-04-01):
 * - requireWorkspaceRole gates access to owner/admin/editor; viewers redirected.
 * - withTenantDb scopes the brandConfig.findFirst query to ctx.workspaceId —
 *   workspaceId is from the server session, never from the URL (D-12).
 * - canEdit is derived from ctx.role server-side — the client never computes
 *   authorization.
 */
import { requireWorkspaceRole, can } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { BrandConfigForm } from "@/components/brand/BrandConfigForm";
import type { BrandConfigModel } from "@/generated/prisma/models";

interface BrandPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params;

  // Only authoring roles reach this page; viewers are redirected to /w/{slug}
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Fetch current brand config server-side (T-03-04-01: workspaceId from session)
  const brandConfig = await withTenantDb(
    { workspaceId: ctx.workspaceId },
    (db) => db.brandConfig.findFirst()
  );

  // Derive canEdit server-side — client receives only a boolean, not the role
  const canEdit = can(ctx.role, "brand", "update");

  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Brand Settings
      </h1>
      <BrandConfigForm
        slug={slug}
        initial={brandConfig as BrandConfigModel | null}
        canEdit={canEdit}
      />
    </div>
  );
}
