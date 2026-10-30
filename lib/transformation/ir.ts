import { FieldType } from "../specs/types";

export type IROperation =
  | "copy"
  | "rename"
  | "readNested"
  | "constructObject"
  | "typeConversion"
  | "default"
  | "lookup"
  | "reject";

export const ALLOWED_CONVERSIONS = [
  "string-to-string",
  "integer-to-string",
  "string-to-integer",
  "number-to-string",
  "string-to-number",
  "boolean-to-string",
  "string-to-boolean",
  "isoDate-to-timestamp",
  "date-to-string",
  "string-to-date",
] as const;

export type AllowedConversion = typeof ALLOWED_CONVERSIONS[number];

export type TransformationStep = {
  stepId: string;
  operation: IROperation;
  sourcePath: string | null;
  targetPath: string;
  sourceType?: FieldType;
  targetType: FieldType;
  conversionType?: AllowedConversion;
  defaultValue?: unknown;
  lookupTable?: Record<string, string>;
  policyOnMissing: "fail" | "useDefault" | "omit";
  rationale?: string;
};

export type TransformationPlan = {
  planId: string;
  version: string;
  mappingSetId: string;
  sourceSpecId: string;
  targetSpecId: string;
  compiledAt: string;
  approvedMappingCount: number;
  steps: TransformationStep[];
};
