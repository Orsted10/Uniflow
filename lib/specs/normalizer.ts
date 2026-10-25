import { FieldType, NormalizedField, NormalizedSchema } from "./types";
import { ParsedSpecResult } from "./parser";

/**
 * Format path segment according to the frozen standard:
 * Root: '$'
 * Object property: '$["propName"]' (safe escaping of quotes, slashes, unicode)
 * Array item: '$["items"][0]'
 */
export function formatPropertyPath(parentPath: string | null, propertyName: string): string {
  const safeProp = JSON.stringify(propertyName);
  if (!parentPath || parentPath === "$") {
    return `$[${safeProp}]`;
  }
  return `${parentPath}[${safeProp}]`;
}

export function formatArrayItemPath(parentPath: string): string {
  return `${parentPath}[0]`;
}

/**
 * Normalizes a parsed specification into a typed, versioned internal schema contract.
 * Preserves properties, required/optional/null distinctions, enums, arrays, and warning notices.
 */
export function normalizeSpecification(
  parsed: ParsedSpecResult,
  specId = "spec-default"
): NormalizedSchema {
  const flatFields: Record<string, NormalizedField> = {};
  const schemaWarnings: string[] = [...(parsed.warnings || [])];
  let maxDepth = 0;

  const rootSchema = parsed.rootSchema;
  const rootType = mapJsonType(rootSchema.type as string | string[] | undefined);

  function walk(
    schemaObj: Record<string, unknown>,
    currentPath: string,
    fieldName: string,
    isRequired: boolean,
    parentPath: string | null,
    depth: number
  ): NormalizedField {
    if (depth > maxDepth) {
      maxDepth = depth;
    }

    const type = mapJsonType(schemaObj.type as string | string[] | undefined);
    const format = typeof schemaObj.format === "string" ? schemaObj.format : null;
    const nullable =
      Boolean(schemaObj.nullable) ||
      (Array.isArray(schemaObj.type) && schemaObj.type.includes("null")) ||
      type === "null";

    const enumValues = Array.isArray(schemaObj.enum)
      ? schemaObj.enum.map(String)
      : null;

    // Treat descriptions strictly as untrusted metadata
    let description: string | null = null;
    if (typeof schemaObj.description === "string") {
      description = Array.from(schemaObj.description)
        .filter((ch) => {
          const code = ch.charCodeAt(0);
          return (code >= 32 && code < 127) || code > 159;
        })
        .join("")
        .slice(0, 300)
        .trim();
    }

    const defaultValue = schemaObj.default;
    const fieldWarnings: string[] = [];

    if (schemaObj.oneOf) {
      fieldWarnings.push("Field contains 'oneOf' union. Evaluated with primary schema branch.");
    }
    if (schemaObj.anyOf) {
      fieldWarnings.push("Field contains 'anyOf' union. Evaluated with primary schema branch.");
    }

    const field: NormalizedField = {
      path: currentPath,
      name: fieldName,
      type,
      format,
      required: isRequired,
      nullable,
      enum: enumValues,
      description,
      defaultValue,
      parentPath,
      warnings: fieldWarnings.length > 0 ? fieldWarnings : undefined,
    };

    flatFields[currentPath] = field;

    // Process nested object properties
    if (schemaObj.properties && typeof schemaObj.properties === "object") {
      const props = schemaObj.properties as Record<string, unknown>;
      const requiredList = Array.isArray(schemaObj.required)
        ? (schemaObj.required as string[])
        : [];
      field.children = [];

      for (const [propName, propSchema] of Object.entries(props)) {
        if (propSchema && typeof propSchema === "object") {
          const propPath = formatPropertyPath(currentPath, propName);
          const childRequired = requiredList.includes(propName);
          const childField = walk(
            propSchema as Record<string, unknown>,
            propPath,
            propName,
            childRequired,
            currentPath,
            depth + 1
          );
          field.children.push(childField);
        }
      }
    }

    // Process array items
    if (schemaObj.items && typeof schemaObj.items === "object") {
      const itemSchema = schemaObj.items as Record<string, unknown>;
      const itemPath = formatArrayItemPath(currentPath);
      const childField = walk(
        itemSchema,
        itemPath,
        "[0]",
        true,
        currentPath,
        depth + 1
      );
      field.children = [childField];
    }

    return field;
  }

  // Walk root properties
  const rootFields: NormalizedField[] = [];
  if (rootSchema.properties && typeof rootSchema.properties === "object") {
    const props = rootSchema.properties as Record<string, unknown>;
    const requiredList = Array.isArray(rootSchema.required)
      ? (rootSchema.required as string[])
      : [];

    for (const [propName, propSchema] of Object.entries(props)) {
      if (propSchema && typeof propSchema === "object") {
        const propPath = formatPropertyPath("$", propName);
        const isRequired = requiredList.includes(propName);
        const field = walk(
          propSchema as Record<string, unknown>,
          propPath,
          propName,
          isRequired,
          "$",
          1
        );
        rootFields.push(field);
      }
    }
  } else {
    // Scalar or Array root
    const rootField = walk(rootSchema, "$", "root", true, null, 0);
    rootFields.push(rootField);
  }

  return {
    specId,
    title: parsed.title,
    version: parsed.version,
    rootType,
    fields: rootFields,
    flatFields,
    availableSchemas: parsed.availableSchemas,
    selectedSchema: parsed.selectedSchema,
    warnings: schemaWarnings,
    metadata: {
      format: parsed.format,
      fieldCount: Object.keys(flatFields).length,
      maxDepth,
      isInferred: parsed.isInferred,
    },
  };
}

export function mapJsonType(rawType?: string | string[]): FieldType {
  if (Array.isArray(rawType)) {
    const nonNull = rawType.find((t) => t !== "null");
    return mapSingleType(nonNull);
  }
  return mapSingleType(rawType);
}

function mapSingleType(type?: string): FieldType {
  if (!type) return "any";
  switch (type.toLowerCase()) {
    case "string":
      return "string";
    case "integer":
      return "integer";
    case "number":
    case "float":
    case "double":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    case "array":
      return "array";
    case "null":
      return "null";
    default:
      return "any";
  }
}
