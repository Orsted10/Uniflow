export type FieldType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "null"
  | "any";

export type NormalizedField = {
  path: string; // e.g. '$["id"]', '$["customer"]["name"]', '$["items"][0]'
  name: string;
  type: FieldType;
  format?: string | null;
  required: boolean;
  nullable: boolean;
  enum?: string[] | null;
  description?: string | null; // Treated as untrusted metadata
  defaultValue?: unknown;
  children?: NormalizedField[];
  parentPath?: string | null;
  warnings?: string[];
};

export type NormalizedSchema = {
  specId?: string;
  title: string;
  version: string;
  rootType: FieldType;
  fields: NormalizedField[];
  flatFields: Record<string, NormalizedField>;
  availableSchemas?: string[];
  selectedSchema?: string;
  warnings: string[];
  metadata: {
    format: "openapi+json" | "json-schema" | "sample+json";
    fieldCount: number;
    maxDepth: number;
    isInferred?: boolean;
    schemaHash?: string;
    originalFilename?: string;
  };
};

export type DiffCategory =
  | "exact_match"
  | "renamed"
  | "type_conflict"
  | "missing_required"
  | "optional_to_required"
  | "nullability_conflict"
  | "enum_mismatch"
  | "shape_mismatch"
  | "unsupported_keyword";

export type DiffItem = {
  id: string;
  category: DiffCategory;
  severity: "info" | "warning" | "error";
  sourcePath?: string | null;
  targetPath: string;
  sourceType?: FieldType | null;
  targetType: FieldType;
  targetRequired: boolean;
  message: string;
  candidateSourcePath?: string | null;
  suggestedAction?: string;
  facts?: {
    sourceEnum?: string[] | null;
    targetEnum?: string[] | null;
    sourceNullable?: boolean;
    targetNullable?: boolean;
  };
};

export type StructuralDiff = {
  summary: {
    totalTargetFields: number;
    exactMatches: number;
    renamedCandidates: number;
    typeConflicts: number;
    missingRequired: number;
    optionalToRequired: number;
    enumMismatches: number;
    shapeMismatches: number;
    unsupportedWarnings: number;
  };
  items: DiffItem[];
};
