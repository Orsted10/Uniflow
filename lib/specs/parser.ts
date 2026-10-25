export const MAX_IMPORT_SIZE_BYTES = 1024 * 1024; // 1 MiB MVP ceiling
export const MAX_RECURSION_DEPTH = 64;
export const MAX_REF_RESOLUTIONS = 100;

export type ParsedSpecResult = {
  format: "openapi+json" | "json-schema" | "sample+json";
  title: string;
  version: string;
  rootSchema: Record<string, unknown>;
  availableSchemas?: string[];
  selectedSchema?: string;
  warnings: string[];
  raw: unknown;
  isInferred?: boolean;
};

export class SpecParseError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "SpecParseError";
    this.code = code;
  }
}

/**
 * Safely parses untrusted specification text with strict bounds on size,
 * recursion depth, local reference resolution, and schema extraction.
 */
export function parseSpecificationText(
  rawText: string,
  fileName = "schema.json",
  selectedSchemaName?: string
): ParsedSpecResult {
  if (!rawText || rawText.trim().length === 0) {
    throw new SpecParseError("Specification content is empty", "EMPTY_SPEC");
  }

  // File extension validation
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) {
    throw new SpecParseError(
      "YAML format is not supported in this MVP. Please convert and supply OpenAPI or JSON Schema as JSON.",
      "UNSUPPORTED_FORMAT_YAML"
    );
  }

  // Size limit check
  const byteLength = new TextEncoder().encode(rawText).length;
  if (byteLength > MAX_IMPORT_SIZE_BYTES) {
    throw new SpecParseError(
      `Specification size (${byteLength} bytes) exceeds the 1 MiB limit (${MAX_IMPORT_SIZE_BYTES} bytes).`,
      "SIZE_LIMIT_EXCEEDED"
    );
  }

  // Parseable JSON validation
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SpecParseError(
      `Malformed JSON in specification: ${message}`,
      "INVALID_JSON"
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new SpecParseError(
      "Specification must be a JSON object or array at its root",
      "INVALID_ROOT_TYPE"
    );
  }

  return extractRootSchema(
    parsed as Record<string, unknown>,
    fileName,
    selectedSchemaName
  );
}

function extractRootSchema(
  doc: Record<string, unknown>,
  fileName: string,
  selectedSchemaName?: string
): ParsedSpecResult {
  const warnings: string[] = [];

  // 1. Version rejection: Swagger 2.0
  if (doc.swagger === "2.0") {
    throw new SpecParseError(
      "Swagger 2.0 is obsolete and unsupported. Please upgrade your specification to OpenAPI 3.x.",
      "UNSUPPORTED_SWAGGER_VERSION"
    );
  }

  // 2. Check if OpenAPI 3.x
  if (typeof doc.openapi === "string") {
    if (!doc.openapi.startsWith("3.")) {
      throw new SpecParseError(
        `Unsupported OpenAPI version: "${doc.openapi}". Only OpenAPI 3.x is supported.`,
        "UNSUPPORTED_OPENAPI_VERSION"
      );
    }

    const info = (doc.info as Record<string, unknown>) || {};
    const title = typeof info.title === "string" ? info.title : fileName;
    const version = typeof info.version === "string" ? info.version : "1.0.0";

    const components = doc.components as Record<string, unknown> | undefined;
    let availableSchemas: string[] = [];
    let primarySchema: Record<string, unknown> | null = null;
    let chosenSchemaName = selectedSchemaName;

    if (components && typeof components.schemas === "object" && components.schemas !== null) {
      const schemas = components.schemas as Record<string, unknown>;
      availableSchemas = Object.keys(schemas);

      if (availableSchemas.length > 0) {
        if (selectedSchemaName) {
          if (schemas[selectedSchemaName] && typeof schemas[selectedSchemaName] === "object") {
            primarySchema = schemas[selectedSchemaName] as Record<string, unknown>;
          } else {
            throw new SpecParseError(
              `Selected schema '${selectedSchemaName}' was not found in components.schemas. Available schemas: [${availableSchemas.join(
                ", "
              )}]`,
              "SCHEMA_NOT_FOUND"
            );
          }
        } else {
          // Default to the first schema and inform caller of options
          chosenSchemaName = availableSchemas[0];
          primarySchema = schemas[chosenSchemaName] as Record<string, unknown>;
        }
      }
    }

    // Fallback to path operations if components.schemas is absent
    if (!primarySchema && doc.paths && typeof doc.paths === "object") {
      primarySchema = extractFirstPathSchema(doc.paths as Record<string, unknown>);
      if (primarySchema) {
        chosenSchemaName = "PathResponseSchema";
      }
    }

    if (!primarySchema) {
      throw new SpecParseError(
        "No usable schema found in OpenAPI document under 'components.schemas' or operation response bodies. Please ensure contract defines schema objects.",
        "NO_USABLE_SCHEMA"
      );
    }

    // Resolve local references safely within document
    const dereferenced = resolveLocalRefs(primarySchema, doc, warnings);

    return {
      format: "openapi+json",
      title,
      version,
      rootSchema: dereferenced,
      availableSchemas: availableSchemas.length > 0 ? availableSchemas : undefined,
      selectedSchema: chosenSchemaName,
      warnings,
      raw: doc,
    };
  }

  // 3. Check if standard JSON Schema ($schema or properties/type)
  if (
    typeof doc.$schema === "string" ||
    typeof doc.properties === "object" ||
    typeof doc.type === "string"
  ) {
    const title = typeof doc.title === "string" ? doc.title : fileName;
    const version = typeof doc.version === "string" ? doc.version : "1.0.0";
    const dereferenced = resolveLocalRefs(doc, doc, warnings);

    return {
      format: "json-schema",
      title,
      version,
      rootSchema: dereferenced,
      warnings,
      raw: doc,
    };
  }

  // 4. Sample JSON payload inference (Clearly labeled)
  const inferred = inferJsonSchemaFromSample(doc);
  warnings.push(
    "Contract was inferred from sample JSON. Property types and required constraints are estimated and not an authoritative API specification."
  );

  return {
    format: "sample+json",
    title: fileName,
    version: "1.0.0",
    rootSchema: inferred,
    warnings,
    raw: doc,
    isInferred: true,
  };
}

function extractFirstPathSchema(
  paths: Record<string, unknown>
): Record<string, unknown> | null {
  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey] as Record<string, unknown>;
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const method of ["get", "post", "put", "patch"]) {
      const op = pathItem[method] as Record<string, unknown> | undefined;
      if (!op || typeof op !== "object") continue;

      // Check requestBody
      const reqBody = op.requestBody as Record<string, unknown> | undefined;
      const content = reqBody?.content as Record<string, unknown> | undefined;
      const jsonContent = content?.["application/json"] as Record<string, unknown> | undefined;
      if (jsonContent?.schema && typeof jsonContent.schema === "object") {
        return jsonContent.schema as Record<string, unknown>;
      }

      // Check responses 200 or 201
      const responses = op.responses as Record<string, unknown> | undefined;
      if (responses) {
        const success = (responses["200"] || responses["201"]) as Record<string, unknown> | undefined;
        const resContent = success?.content as Record<string, unknown> | undefined;
        const resJson = resContent?.["application/json"] as Record<string, unknown> | undefined;
        if (resJson?.schema && typeof resJson.schema === "object") {
          return resJson.schema as Record<string, unknown>;
        }
      }
    }
  }
  return null;
}

export function resolveLocalRefs(
  target: Record<string, unknown>,
  rootDoc: Record<string, unknown>,
  warnings: string[] = [],
  depth = 0,
  visitedRefs = new Set<string>()
): Record<string, unknown> {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new SpecParseError(
      `Recursion depth limit exceeded (${MAX_RECURSION_DEPTH}) while resolving references.`,
      "MAX_DEPTH_EXCEEDED"
    );
  }

  if (visitedRefs.size > MAX_REF_RESOLUTIONS) {
    throw new SpecParseError(
      `Maximum local reference resolutions exceeded (${MAX_REF_RESOLUTIONS}). Cyclic dependency detected.`,
      "MAX_REF_RESOLUTIONS_EXCEEDED"
    );
  }

  // Detect unsupported constructs and record warnings
  if (target.oneOf) {
    warnings.push("Keyword 'oneOf' is not fully flattened in MVP; treating first union option as primary.");
  }
  if (target.anyOf) {
    warnings.push("Keyword 'anyOf' is not fully flattened in MVP; treating first union option as primary.");
  }
  if (target.patternProperties) {
    warnings.push("Keyword 'patternProperties' is unsupported; matching relies on declared properties.");
  }

  if (typeof target.$ref === "string") {
    const ref = target.$ref;

    // Security check 1: Disallow remote network URLs
    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      throw new SpecParseError(
        `Remote references are not permitted for security reasons: ${ref}`,
        "REMOTE_REF_PROHIBITED"
      );
    }

    // Security check 2: Disallow external file references
    if (ref.startsWith("file://") || ref.includes(".json#") || ref.startsWith("../")) {
      throw new SpecParseError(
        `External file references are unsupported. All specifications must be self-contained: ${ref}`,
        "EXTERNAL_REF_UNSUPPORTED"
      );
    }

    // Circular reference detection guard
    if (visitedRefs.has(ref)) {
      return {
        type: "object",
        description: `[Circular reference to ${ref}]`,
        $circularRef: ref,
      };
    }

    visitedRefs.add(ref);
    const resolved = resolveJsonPointer(rootDoc, ref);
    if (!resolved || typeof resolved !== "object") {
      throw new SpecParseError(
        `Unable to resolve local reference within document: "${ref}"`,
        "UNRESOLVED_REF"
      );
    }

    return resolveLocalRefs(
      resolved as Record<string, unknown>,
      rootDoc,
      warnings,
      depth + 1,
      visitedRefs
    );
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(target)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      result[key] = resolveLocalRefs(
        val as Record<string, unknown>,
        rootDoc,
        warnings,
        depth + 1,
        visitedRefs
      );
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? resolveLocalRefs(item as Record<string, unknown>, rootDoc, warnings, depth + 1, visitedRefs)
          : item
      );
    } else {
      result[key] = val;
    }
  }

  return result;
}

function resolveJsonPointer(doc: Record<string, unknown>, pointer: string): unknown {
  if (!pointer.startsWith("#/")) {
    return null;
  }

  const parts = pointer
    .slice(2)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = doc;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current;
}

export function inferJsonSchemaFromSample(sample: unknown): Record<string, unknown> {
  if (sample === null) {
    return { type: "null" };
  }
  if (Array.isArray(sample)) {
    const itemSchema = sample.length > 0 ? inferJsonSchemaFromSample(sample[0]) : { type: "any" };
    return {
      type: "array",
      items: itemSchema,
    };
  }
  if (typeof sample === "object") {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, val] of Object.entries(sample as Record<string, unknown>)) {
      properties[key] = inferJsonSchemaFromSample(val);
      required.push(key);
    }
    return {
      type: "object",
      properties,
      required,
    };
  }
  if (typeof sample === "number") {
    return { type: Number.isInteger(sample) ? "integer" : "number" };
  }
  if (typeof sample === "boolean") {
    return { type: "boolean" };
  }
  if (typeof sample === "string") {
    const isIsoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(sample);
    return {
      type: "string",
      format: isIsoDate ? "date-time" : undefined,
    };
  }
  return { type: "any" };
}
