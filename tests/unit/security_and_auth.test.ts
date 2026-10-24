import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { projectStore } from "../../lib/store/project-store";
import { CANONICAL_TARGET_SPEC } from "../../lib/specs/fixtures";
import { parseSpecificationText } from "../../lib/specs/parser";
import { normalizeSpecification } from "../../lib/specs/normalizer";
import { validateLocalMigrations } from "../../db/validate_schema";

test("UNIFLOW ∞ Phase 2 — Security, RLS & Tenant Isolation Test Suite", async (t) => {
  const aliceId = "00000000-0000-0000-0000-00000000000a";
  const bobId = "00000000-0000-0000-0000-00000000000b";

  await t.test("1. SQL Migrations & RLS Integrity", async () => {
    const result = await validateLocalMigrations();
    assert.equal(result.valid, true, `Local migrations must be valid: ${result.errors.join(", ")}`);

    const schemaPath = path.resolve(process.cwd(), "db/schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf-8");

    // Verify all 9 tables have RLS enabled
    const tables = [
      "projects",
      "specs",
      "mapping_sets",
      "mappings",
      "transformation_plans",
      "test_runs",
      "adapters",
      "compatibility_reports",
      "report_artifacts",
    ];

    for (const tbl of tables) {
      assert.ok(
        sql.includes(`alter table public.${tbl} enable row level security;`),
        `Table '${tbl}' must have RLS enabled`
      );
    }

    // Verify ownership policies scope through projects.owner_id = auth.uid()
    assert.ok(
      sql.includes("auth.uid() = owner_id"),
      "projects table must check auth.uid() = owner_id"
    );
    assert.ok(
      sql.includes("p.owner_id = auth.uid()"),
      "child tables must resolve ownership via p.owner_id = auth.uid()"
    );
  });

  await t.test("2. Client-Supplied owner_id is Never Trusted", async () => {
    // When Alice creates a project, the store must strictly bind it to Alice's authenticated ID
    const project = projectStore.createProject(aliceId, "Alice Payment Gateway");
    assert.equal(project.owner_id, aliceId);
    assert.notEqual(project.owner_id, bobId);

    // List projects for Alice returns her project
    const aliceProjects = projectStore.listProjects(aliceId);
    assert.ok(aliceProjects.some((p) => p.id === project.id));

    // List projects for Bob does NOT return Alice's project
    const bobProjects = projectStore.listProjects(bobId);
    assert.ok(!bobProjects.some((p) => p.id === project.id));
  });

  await t.test("3. Cross-Tenant Read Rejection (User B cannot read User A's project)", async () => {
    const aliceProj = projectStore.createProject(aliceId, "Confidential Billing");

    // Alice can read her own project
    const aliceState = projectStore.getProjectState(aliceProj.id, aliceId);
    assert.ok(aliceState);
    assert.equal(aliceState.project.name, "Confidential Billing");

    // Bob attempting to read Alice's project must throw FORBIDDEN
    assert.throws(
      () => {
        projectStore.getProjectState(aliceProj.id, bobId);
      },
      /FORBIDDEN/,
      "User B should be strictly rejected when reading User A's project"
    );
  });

  await t.test("4. Cross-Tenant Mutation Rejection (User B cannot mutate User A's specs)", async () => {
    const aliceProj = projectStore.createProject(aliceId, "Alice Target Spec");
    const rawTarget = parseSpecificationText(CANONICAL_TARGET_SPEC);
    const normalized = normalizeSpecification(rawTarget);

    // Alice can add specs
    projectStore.setSpec(
      aliceProj.id,
      aliceId,
      "target",
      "target.json",
      "openapi+json",
      normalized,
      CANONICAL_TARGET_SPEC.length,
      CANONICAL_TARGET_SPEC
    );

    // Bob attempting to mutate Alice's project must throw FORBIDDEN
    assert.throws(
      () => {
        projectStore.setSpec(
          aliceProj.id,
          bobId,
          "source",
          "hacked.json",
          "openapi+json",
          normalized,
          100
        );
      },
      /FORBIDDEN/,
      "User B should be strictly rejected when adding specs to User A's project"
    );
  });

  await t.test("5. Project Rename & Safe Deletion Lifecycle", async () => {
    const proj = projectStore.createProject(aliceId, "Old Name", "Original description");
    assert.equal(proj.name, "Old Name");

    // Rename project
    const renamed = projectStore.renameProject(proj.id, aliceId, "New Renamed Name", "Updated desc");
    assert.equal(renamed.name, "New Renamed Name");
    assert.equal(renamed.description, "Updated desc");

    // Cross-user rename fails
    assert.throws(
      () => {
        projectStore.renameProject(proj.id, bobId, "Malicious Rename");
      },
      /FORBIDDEN/
    );

    // Safe deletion: removes project and confirms child count
    const delResult = projectStore.deleteProject(proj.id, aliceId);
    assert.equal(delResult.success, true);

    // Confirm deletion: reading deleted project returns null
    const afterDel = projectStore.getProjectState(proj.id, aliceId);
    assert.equal(afterDel, null);

    // Cross-user delete on non-existent or other's project fails
    assert.throws(
      () => {
        projectStore.deleteProject(proj.id, bobId);
      },
      /Project not found|FORBIDDEN/
    );
  });
});
