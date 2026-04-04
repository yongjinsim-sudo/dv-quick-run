import type { QueryDoctorCapabilityProfile } from "../../../../../product/capabilities/capabilityTypes.js";
import type { ParsedDataverseQuery } from "../../explain/explainQueryTypes.js";
import type { ValidationIssue } from "../queryExplain/queryValidation.js";
import type { FieldDef } from "../../../../../services/entityFieldMetadataService.js";
import type { DiagnosticFinding } from "./diagnosticTypes.js";

export interface DiagnosticContext {
  parsed: ParsedDataverseQuery;
  validationIssues?: ValidationIssue[];
  entityLogicalName?: string;
  loadFieldsForEntity?: (logicalName: string) => Promise<FieldDef[]>;
}

export type DiagnosticRule = (
  context: DiagnosticContext,
  capabilities: QueryDoctorCapabilityProfile
) => DiagnosticFinding[] | Promise<DiagnosticFinding[]>;
