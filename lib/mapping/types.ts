import { FieldType } from "../specs/types";

export type MappingStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "edited"
  | "needs_confirmation";

export type InformationLossDeclaration = {
  kind: "precision" | "truncation" | "timezone" | "enum_fallback" | "null_default";
  description: string;
  mitigation?: string;
  approved: boolean;
};

export type ProposedTransformation = {
  operation:
    | "copy"
    | "rename"
    | "readNested"
    | "constructObject"
    | "typeConversion"
    | "default"
    | "lookup"
    | "reject";
  sourceType?: FieldType;
  targetType?: FieldType;
  conversionType?: string; // e.g. "integer-to-string", "string-to-integer", "number-to-string"
  lookupTable?: Record<string, string>;
  defaultValue?: unknown;
  policyOnMissing?: "fail" | "useDefault" | "omit";
};

export const ALLOWED_OPERATIONS = [
  "copy",
  "rename",
  "readNested",
  "constructObject",
  "typeConversion",
  "default",
  "lookup",
] as const;

export type AllowedOperation = (typeof ALLOWED_OPERATIONS)[number];

export const SUPPORTED_CONVERSIONS = [
  "integer-to-string",
  "string-to-integer",
  "number-to-string",
  "string-to-number",
  "boolean-to-string",
  "string-to-boolean",
  "isoDate-to-timestamp",
] as const;

export type CandidateMapping = {
  id: string;
  mappingSetId?: string;
  sourcePath: string | null;
  targetPath: string;
  status: MappingStatus;
  semanticStatus: "verified" | "ambiguous" | "unverified" | "needs_confirmation";
  transformation: ProposedTransformation;
  rationale: string;
  uncertaintyScore: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  uncertaintyExplanation: string;
  unresolvedQuestions?: string[];
  provider?: "groq" | "deterministic" | "manual";
  modelUsed?: string;
  informationLoss: InformationLossDeclaration[];
  decisionHistory: Array<{
    action: MappingStatus;
    timestamp: string;
    actor: string;
    note?: string;
  }>;
};
