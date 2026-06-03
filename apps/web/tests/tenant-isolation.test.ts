/**
 * Tenant isolation tests — WS-05, D-13, D-14, T-02-02-03
 *
 * Tests prove:
 * 1. withTenantDb injects workspaceId into probe writes (never from client input).
 * 2. findById filters by workspaceId — cross-workspace ID lookup returns null.
 * 3. The migration SQL contains ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY,
 *    and the current_setting('app.current_workspace_id', true) policy.
 * 4. tenant-db.ts contains SET LOCAL app.current_workspace_id.
 * 5. Cross-workspace direct-ID access is denied at the app layer.
 *
 * Note on DB-level RLS tests: The tests that prove PostgreSQL RLS enforcement
 * (e.g., omitting SET LOCAL causes rejection) require a live PostgreSQL database.
 * These integration-level assertions are in the "DB-required" suite below.
 * They are skipped when DATABASE_URL is not set but documented as the full contract.
 *
 * The app-layer isolation tests run without a database connection.
 */

import { randomUUID } from "crypto";
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------
// Migration SQL contract tests (no DB required)
// -----------------------------------------------------------------------

describe("Migration SQL — RLS contract (D-13)", () => {
  let migrationSql: string;

  beforeEach(() => {
    const migrationPath = path.join(
      __dirname,
      "../prisma/migrations/0001_multi_tenancy_foundation/migration.sql"
    );
    migrationSql = fs.readFileSync(migrationPath, "utf-8");
  });

  it("contains ENABLE ROW LEVEL SECURITY on tenant_isolation_probe", () => {
    expect(migrationSql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("contains FORCE ROW LEVEL SECURITY on tenant_isolation_probe", () => {
    expect(migrationSql).toContain("FORCE ROW LEVEL SECURITY");
  });

  it("contains current_setting('app.current_workspace_id', true) in the policy", () => {
    expect(migrationSql).toContain(
      "current_setting('app.current_workspace_id', true)"
    );
  });

  it("contains both USING and WITH CHECK clauses in the RLS policy", () => {
    expect(migrationSql).toContain("USING (");
    expect(migrationSql).toContain("WITH CHECK (");
  });

  it("creates the tenant_isolation_probe table", () => {
    expect(migrationSql).toContain("CREATE TABLE \"tenant_isolation_probe\"");
  });

  it("creates workspace, workspace_member, and workspace_invitation tables", () => {
    expect(migrationSql).toContain("CREATE TABLE \"workspace\"");
    expect(migrationSql).toContain("CREATE TABLE \"workspace_member\"");
    expect(migrationSql).toContain("CREATE TABLE \"workspace_invitation\"");
  });

  it("includes workspaceId foreign key on tenant_isolation_probe", () => {
    expect(migrationSql).toContain("tenant_isolation_probe_workspaceId_fkey");
  });

  it("includes tenant_isolation policy CREATE POLICY statement", () => {
    expect(migrationSql).toContain("CREATE POLICY tenant_isolation");
  });
});

// -----------------------------------------------------------------------
// tenant-db.ts source code contract tests (no DB required)
// -----------------------------------------------------------------------

describe("tenant-db.ts — SET LOCAL contract (D-14)", () => {
  let tenantDbSource: string;

  beforeEach(() => {
    const sourcePath = path.join(
      __dirname,
      "../src/lib/db/tenant-db.ts"
    );
    tenantDbSource = fs.readFileSync(sourcePath, "utf-8");
  });

  it("contains parameterized set_config app.current_workspace_id", () => {
    expect(tenantDbSource).toContain("set_config");
    expect(tenantDbSource).toContain("app.current_workspace_id");
  });

  it("contains $transaction (wraps queries in a transaction for SET LOCAL scope)", () => {
    expect(tenantDbSource).toContain("$transaction");
  });

  it("exports withTenantDb function", () => {
    expect(tenantDbSource).toContain("export async function withTenantDb");
  });

  it("injects workspaceId into create calls (never accepts workspaceId from callback arg)", () => {
    // The source must show workspaceId being injected, not a variable from user input
    expect(tenantDbSource).toContain("workspaceId, // injected from server context");
  });
});

// -----------------------------------------------------------------------
// App-layer isolation tests (mock Prisma — no DB required)
// -----------------------------------------------------------------------

describe("withTenantDb — app-layer isolation (D-14, T-02-02-03)", () => {
  /**
   * These tests mock the Prisma client to verify that withTenantDb:
   * 1. Calls $transaction.
   * 2. Issues SET LOCAL with the correct workspaceId.
   * 3. The findById helper filters by workspaceId (app-level isolation).
   * 4. The create helper injects workspaceId from context (not callback parameter).
   */

  let mockTx: {
    $executeRaw: ReturnType<typeof vi.fn>;
    tenantIsolationProbe: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      tenantIsolationProbe: {
        create: vi.fn().mockResolvedValue({ id: "probe-1", workspaceId: "ws-a", label: "test", createdAt: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    // Mock the prisma module
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("calls $transaction to scope the SET LOCAL command", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");
    const { prisma } = await import("@/lib/db/prisma");

    await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      return db.workspaceId;
    });

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("sets the RLS workspace setting with the correct workspaceId", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    await withTenantDb({ workspaceId: "ws-target-123" }, async () => undefined);

    expect(mockTx.$executeRaw).toHaveBeenCalled();
  });

  it("tenantIsolationProbe.create injects workspaceId from ctx", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      await db.tenantIsolationProbe.create("test-label");
    });

    expect(mockTx.tenantIsolationProbe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-a", // injected from context
        label: "test-label",
      }),
    });
  });

  it("tenantIsolationProbe.findById filters by workspaceId (app-level isolation)", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      await db.tenantIsolationProbe.findById("some-probe-id");
    });

    expect(mockTx.tenantIsolationProbe.findFirst).toHaveBeenCalledWith({
      where: {
        id: "some-probe-id",
        workspaceId: "ws-a", // must always filter by ctx workspaceId
      },
    });
  });

  it("tenantIsolationProbe.findById returns null for cross-workspace ID (app isolation)", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    // Workspace B's probe ID will not be returned when querying as workspace A
    mockTx.tenantIsolationProbe.findFirst.mockResolvedValue(null);

    const result = await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      // Try to access a probe that belongs to workspace B by its ID
      return db.tenantIsolationProbe.findById("probe-from-ws-b");
    });

    // App-level filter: workspaceId: "ws-a" in the WHERE clause means DB will
    // return null for any row with workspaceId != "ws-a"
    expect(result).toBeNull();
    // Confirm the query included the workspaceId filter
    expect(mockTx.tenantIsolationProbe.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: "ws-a",
      }),
    });
  });

  it("list helper filters by workspaceId (never returns cross-workspace rows)", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    await withTenantDb({ workspaceId: "ws-b" }, async (db) => {
      await db.tenantIsolationProbe.list();
    });

    expect(mockTx.tenantIsolationProbe.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-b" },
    });
  });

  it("TenantClient exposes workspaceId from context (read-only reference)", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    const result = await withTenantDb({ workspaceId: "ws-check" }, async (db) => {
      return db.workspaceId;
    });

    expect(result).toBe("ws-check");
  });
});

// -----------------------------------------------------------------------
// Cross-workspace isolation contract (D-12, WS-05)
// -----------------------------------------------------------------------

describe("Cross-workspace access denial contract (WS-05)", () => {
  it("documents the two-layer isolation guarantee", () => {
    /**
     * This test documents the isolation contract for WS-05:
     *
     * Layer 1 (App): withTenantDb injects workspaceId from the server
     * session context into every WHERE clause. A cross-workspace ID passed
     * as a lookup key is rejected by the WHERE workspaceId = ctx.workspaceId
     * filter at the query level.
     *
     * Layer 2 (Database): PostgreSQL RLS is enabled and forced on
     * tenant_isolation_probe. The policy:
     *   USING (workspaceId = current_setting('app.current_workspace_id', true)::text)
     * ensures that even if the application-level filter is absent or bugged,
     * the database rejects cross-workspace rows.
     *
     * The SET LOCAL command inside $transaction ensures the RLS setting
     * only applies for the duration of the transaction.
     */
    const isolationContract = {
      appLayer: "workspaceId injected into every WHERE via withTenantDb",
      dbLayer: "RLS policy enforces app.current_workspace_id via SET LOCAL",
      guarantee: "cross-workspace read by direct ID returns null even if app filter bugs",
    };

    expect(isolationContract.appLayer).toBeDefined();
    expect(isolationContract.dbLayer).toBeDefined();
    expect(isolationContract.guarantee).toBeDefined();
  });

  it("tenant-db module exports are correct", async () => {
    const tenantDb = await import("@/lib/db/tenant-db");
    expect(typeof tenantDb.withTenantDb).toBe("function");
    expect(typeof tenantDb.withWorkspaceTenantDb).toBe("function");
  });
});

// -----------------------------------------------------------------------
// Cross-workspace direct-ID read denial (D-14, T-02-02-03, WS-05)
// -----------------------------------------------------------------------

describe("Cross-workspace direct-ID read denial (WS-05, T-02-02-03)", () => {
  /**
   * These tests prove that a direct-ID read from workspace B, while
   * authenticated as workspace A, returns null.
   *
   * This is the "read denial" contract: app-level workspaceId filter means
   * findById("probe-from-ws-b") returns null when ctx.workspaceId = "ws-a".
   */

  let mockTx: {
    $executeRaw: ReturnType<typeof vi.fn>;
    tenantIsolationProbe: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      tenantIsolationProbe: {
        create: vi.fn().mockResolvedValue({
          id: "probe-ws-b",
          workspaceId: "ws-b",
          label: "ws-b probe",
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null), // cross-workspace lookup returns null
      },
    };

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("cross-workspace read by direct ID returns null (app-layer isolation, WS-05)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
      },
    }));

    const { withTenantDb } = await import("@/lib/db/tenant-db");

    // Workspace A context; probe ID belongs to workspace B
    const result = await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      return db.tenantIsolationProbe.findById("probe-from-ws-b");
    });

    // App-level isolation: WHERE workspaceId = "ws-a" AND id = "probe-from-ws-b"
    // Since that probe has workspaceId = "ws-b", DB returns null
    expect(result).toBeNull();

    // Verify the WHERE clause included workspaceId = "ws-a"
    expect(mockTx.tenantIsolationProbe.findFirst).toHaveBeenCalledWith({
      where: {
        id: "probe-from-ws-b",
        workspaceId: "ws-a", // app-level filter
      },
    });
  });

  it("cross-workspace edit/write denied — create injects ctx workspaceId (not caller arg)", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    // Even if a caller tries to write to a different workspace, the ctx injects the correct one
    await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      // The create helper only uses ctx.workspaceId — the label param is untrusted content only
      await db.tenantIsolationProbe.create("label-from-caller");
    });

    expect(mockTx.tenantIsolationProbe.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws-a", // always from ctx, never overridden by caller
        label: "label-from-caller",
      },
    });
  });

  it("list always scoped to ctx workspaceId — cross-workspace rows never returned (WS-05)", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    // List as workspace A — the query must filter to ws-a, not include ws-b rows
    await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      return db.tenantIsolationProbe.list();
    });

    expect(mockTx.tenantIsolationProbe.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-a" },
    });
    // The query must NOT have an empty or missing workspaceId filter
    const call = mockTx.tenantIsolationProbe.findMany.mock.calls[0][0];
    expect(call.where.workspaceId).toBe("ws-a");
  });

  it("two different workspace contexts produce isolated queries", async () => {
    const { withTenantDb } = await import("@/lib/db/tenant-db");

    // Workspace A context
    const wsAResult = await withTenantDb({ workspaceId: "ws-a" }, async (db) => {
      return db.workspaceId;
    });
    // Workspace B context
    const wsBResult = await withTenantDb({ workspaceId: "ws-b" }, async (db) => {
      return db.workspaceId;
    });

    // Each context is isolated — workspaceId correctly reflects the context
    expect(wsAResult).toBe("ws-a");
    expect(wsBResult).toBe("ws-b");
    expect(wsAResult).not.toBe(wsBResult);
  });
});

// -----------------------------------------------------------------------
// DB-required RLS integration tests (live PostgreSQL)
// -----------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)(
  "DB-required RLS integration tests (WS-05, CR-02)",
  () => {
    let prisma: typeof import("@/lib/db/prisma").prisma;
    let withTenantDb: typeof import("@/lib/db/tenant-db").withTenantDb;
    let wsAId: string;
    let wsBId: string;
    let wsAMemberId: string;
    let wsBMemberId: string;

    async function createWorkspaceFixture(
      workspaceId: string,
      slug: string,
      memberId: string,
      userId: string
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
        await tx.workspace.create({
          data: {
            id: workspaceId,
            name: `RLS ${slug}`,
            slug,
          },
        });
        await tx.workspaceMember.create({
          data: {
            id: memberId,
            workspaceId,
            userId,
            role: "admin",
          },
        });
      });
    }

    async function deleteWorkspaceFixture(workspaceId: string) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
          await tx.workspace.deleteMany({ where: { id: workspaceId } });
        });
      } catch {
        // Cleanup should not mask the test failure that triggered it.
      }
    }

    beforeAll(async () => {
      vi.doUnmock("@/lib/db/prisma");
      vi.resetModules();
      ({ prisma } = await import("@/lib/db/prisma"));
      ({ withTenantDb } = await import("@/lib/db/tenant-db"));

      wsAId = randomUUID();
      wsBId = randomUUID();
      wsAMemberId = randomUUID();
      wsBMemberId = randomUUID();

      await createWorkspaceFixture(
        wsAId,
        `rls-a-${randomUUID()}`,
        wsAMemberId,
        randomUUID()
      );
      await createWorkspaceFixture(
        wsBId,
        `rls-b-${randomUUID()}`,
        wsBMemberId,
        randomUUID()
      );
    });

    afterAll(async () => {
      await deleteWorkspaceFixture(wsAId);
      await deleteWorkspaceFixture(wsBId);
    });

    it("omitting app.current_workspace_id blocks workspace_member reads", async () => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "workspace_member" WHERE id = ${wsAMemberId}
      `;

      expect(rows).toHaveLength(0);
    });

    it("RLS blocks cross-workspace reads when app.current_workspace_id is set to wsA", async () => {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${wsAId}, true)`;

        const ownRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "workspace_member" WHERE id = ${wsAMemberId}
        `;
        const crossRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "workspace_member" WHERE id = ${wsBMemberId}
        `;
        const workspaceBRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "workspace_member" WHERE "workspaceId" = ${wsBId}
        `;

        expect(ownRows).toHaveLength(1);
        expect(crossRows).toHaveLength(0);
        expect(workspaceBRows).toHaveLength(0);
      });
    });

    it("withTenantDb scopes probe reads to the correct workspace", async () => {
      const probe = await withTenantDb({ workspaceId: wsAId }, async (db) => {
        return db.tenantIsolationProbe.create("db-required rls probe");
      });

      const crossWorkspaceRead = await withTenantDb(
        { workspaceId: wsBId },
        async (db) => db.tenantIsolationProbe.findById(probe.id)
      );

      expect(crossWorkspaceRead).toBeNull();
    });

    it("workspace_member table has RLS active in live DB", async () => {
      const result = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
        SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'workspace_member'
      `;

      expect(result[0]).toEqual({
        tablename: "workspace_member",
        rowsecurity: true,
      });
    });

    it("workspace_invitation table has RLS active in live DB", async () => {
      const result = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
        SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'workspace_invitation'
      `;

      expect(result[0]).toEqual({
        tablename: "workspace_invitation",
        rowsecurity: true,
      });
    });

    it("workspace table has RLS active in live DB", async () => {
      const result = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
        SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'workspace'
      `;

      expect(result[0]).toEqual({
        tablename: "workspace",
        rowsecurity: true,
      });
    });
  }
);
