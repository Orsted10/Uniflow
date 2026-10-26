import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSpecificationText,
  MAX_IMPORT_SIZE_BYTES,
} from "../../lib/specs/parser";
import { normalizeSpecification } from "../../lib/specs/normalizer";
import { computeStructuralDiff } from "../../lib/specs/diff";

test("Phase 3 — Specifications Import, Normalization, & Structural Diff Engine", async (t) => {
  await t.test("1. Rejection of Empty and Malformed Content", () => {
    // Empty spec
    assert.throws(() => parseSpecificationText(""), {
      name: "SpecParseError",
      message: /Specification content is empty/,
    });
    assert.throws(() => parseSpecificationText("   \n\t  "), {
      name: "SpecParseError",
      message: /Specification content is empty/,
    });

    // Malformed JSON (must not silently swallow errors)
    assert.throws(() => parseSpecificationText("{ \"name\": \"unclosed\" "), {
      name: "SpecParseError",
      message: /Malformed JSON in specification/,
    });

    // Primitive root
    assert.throws(() => parseSpecificationText("12345"), {
      name: "SpecParseError",
      message: /Specification must be a JSON object or array at its root/,
    });
  });

  await t.test("2. Rejection of YAML and Unsupported Swagger 2.0", () => {
    // YAML extension check
    assert.throws(
      () =>
        parseSpecificationText(
          "openapi: 3.0.0\ninfo:\n  title: Sample\n",
          "contract.yaml"
        ),
      {
        name: "SpecParseError",
        message: /YAML format is not supported in this MVP/,
      }
    );

    // Swagger 2.0 rejection
    const swaggerDoc = JSON.stringify({
      swagger: "2.0",
      info: { title: "Old API", version: "1.0" },
      paths: {},
    });
    assert.throws(() => parseSpecificationText(swaggerDoc, "swagger.json"), {
      name: "SpecParseError",
      message: /Swagger 2.0 is obsolete and unsupported/,
    });

    // Non-3.x OpenAPI
    const unsupportedOpenApi = JSON.stringify({
      openapi: "4.0.0",
      info: { title: "Future API", version: "1.0" },
      paths: {},
    });
    assert.throws(
      () => parseSpecificationText(unsupportedOpenApi, "future.json"),
      {
        name: "SpecParseError",
        message: /Only OpenAPI 3.x is supported/,
      }
    );
  });

  await t.test("3. Conservative File Size Ceiling (1 MiB)", () => {
    // Construct payload slightly larger than 1 MiB
    const largeObject: Record<string, string> = {};
    for (let i = 0; i < 40000; i++) {
      largeObject[`property_${i}`] = "some-long-string-value-exceeding-limit";
    }
    const largeJson = JSON.stringify(largeObject);
    assert.ok(largeJson.length > MAX_IMPORT_SIZE_BYTES);

    assert.throws(() => parseSpecificationText(largeJson, "large.json"), {
      name: "SpecParseError",
      message: /exceeds the 1 MiB limit/,
    });
  });

  await t.test("4. Prohibited Remote URLs and External File References", () => {
    // Remote reference
    const remoteRefDoc = JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        user: {
          $ref: "https://evil.internal.network/schemas/user.json",
        },
      },
    });
    assert.throws(
      () => parseSpecificationText(remoteRefDoc),
      {
        name: "SpecParseError",
        message: /Remote references are not permitted for security reasons/,
      }
    );

    // External file reference
    const fileRefDoc = JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        secret: {
          $ref: "file:///etc/passwd",
        },
      },
    });
    assert.throws(
      () => parseSpecificationText(fileRefDoc),
      {
        name: "SpecParseError",
        message: /External file references are unsupported/,
      }
    );
  });

  await t.test("5. Local Reference Resolution and Circular Reference Guard", () => {
    // Valid local ref
    const localRefDoc = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Store API", version: "1.0.0" },
      components: {
        schemas: {
          Customer: {
            type: "object",
            properties: {
              id: { type: "string" },
              address: { $ref: "#/components/schemas/Address" },
            },
            required: ["id"],
          },
          Address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
          },
        },
      },
    });

    const parsed = parseSpecificationText(localRefDoc, "store.json", "Customer");
    const normalized = normalizeSpecification(parsed, "store-spec");

    assert.equal(normalized.selectedSchema, "Customer");
    assert.ok(normalized.flatFields['$["address"]["street"]']);
    assert.equal(normalized.flatFields['$["address"]["street"]'].type, "string");

    // Circular reference
    const circularDoc = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Graph API", version: "1.0.0" },
      components: {
        schemas: {
          Node: {
            type: "object",
            properties: {
              id: { type: "string" },
              parent: { $ref: "#/components/schemas/Node" },
            },
          },
        },
      },
    });

    // Must resolve safely without infinite loop or crashing
    const parsedCirc = parseSpecificationText(circularDoc, "graph.json", "Node");
    const normCirc = normalizeSpecification(parsedCirc, "graph-spec");
    assert.ok(normCirc.flatFields['$["parent"]']);
  });

  await t.test("6. OpenAPI Multiple Candidate Schemas Picker and Empty Schema Handling", () => {
    const multiSchemaDoc = JSON.stringify({
      openapi: "3.0.1",
      info: { title: "Multi API", version: "1.0" },
      components: {
        schemas: {
          Order: {
            type: "object",
            properties: { orderId: { type: "string" } },
          },
          Payment: {
            type: "object",
            properties: { transactionId: { type: "string" } },
          },
        },
      },
    });

    // Default picks first available schema
    const parsedDefault = parseSpecificationText(multiSchemaDoc, "multi.json");
    assert.deepEqual(parsedDefault.availableSchemas, ["Order", "Payment"]);
    assert.equal(parsedDefault.selectedSchema, "Order");

    // Explicit picker selects second schema
    const parsedPayment = parseSpecificationText(multiSchemaDoc, "multi.json", "Payment");
    assert.equal(parsedPayment.selectedSchema, "Payment");
    const normPayment = normalizeSpecification(parsedPayment, "payment-spec");
    assert.ok(normPayment.flatFields['$["transactionId"]']);

    // Non-existent selection throws understandable error
    assert.throws(
      () => parseSpecificationText(multiSchemaDoc, "multi.json", "NonExistent"),
      {
        name: "SpecParseError",
        message: /Selected schema 'NonExistent' was not found in components.schemas/,
      }
    );

    // No usable schema throws NO_USABLE_SCHEMA
    const emptyDoc = JSON.stringify({
      openapi: "3.0.1",
      info: { title: "Empty API", version: "1.0" },
      paths: {},
    });
    assert.throws(() => parseSpecificationText(emptyDoc, "empty.json"), {
      name: "SpecParseError",
      message: /No usable schema found in OpenAPI document/,
    });
  });

  await t.test("7. Sample JSON Inference", () => {
    const sample = JSON.stringify({
      userId: 42,
      name: "Alice",
      active: true,
      tags: ["admin", "staff"],
      metadata: {
        score: 98.6,
      },
      note: null,
    });

    const parsed = parseSpecificationText(sample, "sample.json");
    assert.equal(parsed.format, "sample+json");
    assert.equal(parsed.isInferred, true);
    assert.ok(parsed.warnings.some((w) => w.includes("inferred from sample JSON")));

    const normalized = normalizeSpecification(parsed, "sample-spec");
    assert.equal(normalized.metadata.isInferred, true);
    assert.equal(normalized.flatFields['$["userId"]'].type, "integer");
    assert.equal(normalized.flatFields['$["name"]'].type, "string");
    assert.equal(normalized.flatFields['$["active"]'].type, "boolean");
    assert.equal(normalized.flatFields['$["tags"]'].type, "array");
    assert.equal(normalized.flatFields['$["tags"][0]'].type, "string");
    assert.equal(normalized.flatFields['$["metadata"]["score"]'].type, "number");
    assert.equal(normalized.flatFields['$["note"]'].nullable, true);
  });

  await t.test("8. Escaped Property Names and Nested Path Fidelity", () => {
    const weirdPropsDoc = JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        "user \"admin\"": { type: "string" },
        "item.sku.code": { type: "integer" },
        "a/b/c": { type: "boolean" },
        "spaced key": { type: "number" },
      },
      required: ["user \"admin\""],
    });

    const parsed = parseSpecificationText(weirdPropsDoc);
    const normalized = normalizeSpecification(parsed, "weird-spec");

    // Path bracket notation with JSON-encoded strings
    assert.ok(normalized.flatFields['$["user \\"admin\\""]']);
    assert.equal(normalized.flatFields['$["user \\"admin\\""]'].required, true);
    assert.ok(normalized.flatFields['$["item.sku.code"]']);
    assert.ok(normalized.flatFields['$["a/b/c"]']);
    assert.ok(normalized.flatFields['$["spaced key"]']);
  });

  await t.test("9. Pure Deterministic Structural Diff Engine", () => {
    const sourceDoc = JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        status: { type: "string", enum: ["active", "suspended"] },
        user_notes: { type: "string", nullable: true },
        tags: { type: "array", items: { type: "string" } },
        config: { type: "object", properties: { level: { type: "integer" } } },
      },
      required: ["id", "name"],
    });

    const targetDoc = JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        id: { type: "string" }, // type_conflict (integer -> string)
        customer_name: { type: "string" }, // renamed candidate
        status: { type: "string", enum: ["active", "archived"] }, // enum_mismatch
        user_notes: { type: "string", nullable: false }, // nullability_conflict
        tags: { type: "object", properties: { key: { type: "string" } } }, // shape_mismatch (array vs object)
        mandatory_token: { type: "string" }, // missing_required
      },
      required: ["id", "customer_name", "status", "user_notes", "mandatory_token"],
    });

    const normSrc = normalizeSpecification(parseSpecificationText(sourceDoc), "src");
    const normTgt = normalizeSpecification(parseSpecificationText(targetDoc), "tgt");

    const diffRun1 = computeStructuralDiff(normSrc, normTgt);
    const diffRun2 = computeStructuralDiff(normSrc, normTgt);

    // Output must be completely stable and deterministic across runs
    assert.deepEqual(diffRun1, diffRun2);

    // Verify categories detected
    const categories = diffRun1.items.map((i) => i.category);
    assert.ok(categories.includes("type_conflict"));
    assert.ok(categories.includes("renamed"));
    assert.ok(categories.includes("enum_mismatch"));
    assert.ok(categories.includes("nullability_conflict"));
    assert.ok(categories.includes("shape_mismatch"));
    assert.ok(categories.includes("missing_required"));

    // Verify facts attached
    const enumMismatch = diffRun1.items.find((i) => i.category === "enum_mismatch");
    assert.ok(enumMismatch?.facts?.sourceEnum);
    assert.ok(enumMismatch?.facts?.targetEnum);

    const nullMismatch = diffRun1.items.find((i) => i.category === "nullability_conflict");
    assert.equal(nullMismatch?.facts?.sourceNullable, true);
    assert.equal(nullMismatch?.facts?.targetNullable, false);
  });

  await t.test("10. Unsupported Schema Keywords Surface as Warnings", () => {
    const keywordDoc = JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        unionField: {
          oneOf: [{ type: "string" }, { type: "number" }],
        },
      },
    });

    const parsed = parseSpecificationText(keywordDoc);
    const normalized = normalizeSpecification(parsed, "union-spec");
    assert.ok(normalized.warnings.some((w) => w.includes("oneOf")));

    const diff = computeStructuralDiff(normalized, normalized);
    assert.ok(diff.summary.unsupportedWarnings >= 1);
    assert.ok(diff.items.some((i) => i.category === "unsupported_keyword"));
  });
});
