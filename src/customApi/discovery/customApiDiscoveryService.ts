import type { CommandContext } from "../../commands/context/commandContext.js";
import { getCustomApiTypeMetadata } from "../metadata/customApiMetadataEnrichment.js";
import type { DataverseClient } from "../../services/dataverseClient.js";
import type {
  CustomApiBindingKind,
  CustomApiBoundTargetKind,
  CustomApiDefinition,
  CustomApiOperationKind,
  CustomApiRequestParameter,
  CustomApiResponseProperty
} from "../models/customApiTypes.js";

type DataverseListResponse<T> = {
  value?: T[];
};

type CustomApiRecord = Record<string, unknown> & {
  customapiid?: string;
  uniquename?: string;
  name?: string;
  displayname?: string;
  description?: string;
  isfunction?: boolean;
  bindingtype?: number;
  boundentitylogicalname?: string;
  executeprivilegename?: string;
  allowedcustomprocessingsteptype?: number;
  isprivate?: boolean;
};

type CustomApiRequestParameterRecord = Record<string, unknown> & {
  customapirequestparameterid?: string;
  uniquename?: string;
  name?: string;
  displayname?: string;
  type?: number | string;
  isoptional?: boolean;
  logicalentityname?: string;
  _customapiid_value?: string;
};

type CustomApiResponsePropertyRecord = Record<string, unknown> & {
  customapiresponsepropertyid?: string;
  uniquename?: string;
  name?: string;
  displayname?: string;
  type?: number | string;
  _customapiid_value?: string;
};

const CUSTOM_API_QUERY = "/customapis?$select=customapiid,uniquename,name,displayname,description,isfunction,bindingtype,boundentitylogicalname,executeprivilegename,allowedcustomprocessingsteptype,isprivate&$orderby=uniquename asc";
const CUSTOM_API_REQUEST_PARAMETER_QUERY = "/customapirequestparameters?$select=customapirequestparameterid,uniquename,name,displayname,type,isoptional,logicalentityname,_customapiid_value&$orderby=uniquename asc";
const CUSTOM_API_RESPONSE_PROPERTY_QUERY = "/customapiresponseproperties?$select=customapiresponsepropertyid,uniquename,name,displayname,type,_customapiid_value&$orderby=uniquename asc";

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean"
    ? value
    : undefined;
}

function normalizeOperationKind(record: CustomApiRecord): CustomApiOperationKind {
  return record.isfunction === true ? "Function" : "Action";
}

function normalizeBindingKind(record: CustomApiRecord): CustomApiBindingKind {
  const boundEntityLogicalName = toText(record.boundentitylogicalname);
  if (boundEntityLogicalName) {
    return "Bound";
  }

  if (record.bindingtype === 0) {
    return "Unbound";
  }

  if (typeof record.bindingtype === "number") {
    return record.bindingtype > 0 ? "Bound" : "Unbound";
  }

  return "Unknown";
}


function normalizeBoundTargetKind(record: CustomApiRecord): CustomApiBoundTargetKind {
  if (record.bindingtype === 0) {
    return "none";
  }

  if (record.bindingtype === 1) {
    return "entity";
  }

  if (record.bindingtype === 2) {
    return "collection";
  }

  if (toText(record.boundentitylogicalname)) {
    return "entity";
  }

  if (typeof record.bindingtype === "number" && record.bindingtype > 0) {
    return "unknown";
  }

  return normalizeBindingKind(record) === "Bound" ? "unknown" : "none";
}

function describeBoundTargetKind(
  targetKind: CustomApiBoundTargetKind,
  boundEntityLogicalName: string | undefined
): Pick<CustomApiDefinition, "boundTargetLabel" | "boundTargetReason"> {
  if (targetKind === "entity") {
    return {
      boundTargetLabel: "Entity-bound",
      boundTargetReason: boundEntityLogicalName
        ? `This operation is bound to the ${boundEntityLogicalName} table and requires an explicit target row before execution.`
        : "This operation is bound to a single table row and requires explicit target context before execution."
    };
  }

  if (targetKind === "collection") {
    return {
      boundTargetLabel: "Collection-bound",
      boundTargetReason: boundEntityLogicalName
        ? `This operation is bound to the ${boundEntityLogicalName} collection. Collection-bound execution can run when OData route metadata and supported payload parameters are available.`
        : "This operation is bound to a collection. Collection-bound execution can run when OData route metadata and supported payload parameters are available."
    };
  }

  if (targetKind === "unknown") {
    return {
      boundTargetLabel: "Bound target unknown",
      boundTargetReason: "This operation is marked as bound, but DV Quick Run could not classify whether the target is a row or collection from Custom API metadata."
    };
  }

  return {
    boundTargetLabel: "Unbound",
    boundTargetReason: "This operation is not bound to a specific Dataverse row or collection."
  };
}

function normalizeParameterType(value: unknown): string | undefined {
  if (typeof value === "number") {
    return String(value);
  }

  return toText(value);
}

function mapRequestParameter(record: CustomApiRequestParameterRecord): CustomApiRequestParameter {
  const type = normalizeParameterType(record.type);
  const typeMetadata = getCustomApiTypeMetadata(type);

  return {
    id: toText(record.customapirequestparameterid),
    uniqueName: toText(record.uniquename) ?? toText(record.name) ?? "(unnamed parameter)",
    displayName: toText(record.displayname) ?? toText(record.name),
    logicalName: toText(record.name),
    type,
    typeLabel: typeMetadata.label,
    typeCategory: typeMetadata.category,
    typeDescription: typeMetadata.description,
    executionSupport: typeMetadata.executionSupport,
    executionSupportLabel: typeMetadata.supportLabel,
    executionSupportReason: typeMetadata.supportReason,
    isOptional: toBoolean(record.isoptional),
    logicalEntityName: toText(record.logicalentityname)
  };
}

function mapResponseProperty(record: CustomApiResponsePropertyRecord): CustomApiResponseProperty {
  const type = normalizeParameterType(record.type);
  const typeMetadata = getCustomApiTypeMetadata(type);

  return {
    id: toText(record.customapiresponsepropertyid),
    uniqueName: toText(record.uniquename) ?? toText(record.name) ?? "(unnamed response property)",
    displayName: toText(record.displayname) ?? toText(record.name),
    logicalName: toText(record.name),
    type,
    typeLabel: typeMetadata.label,
    typeCategory: typeMetadata.category,
    typeDescription: typeMetadata.description
  };
}

function groupByCustomApiId<T extends { _customapiid_value?: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  items.forEach((item) => {
    const customApiId = toText(item._customapiid_value);
    if (!customApiId) {
      return;
    }

    const existing = grouped.get(customApiId) ?? [];
    existing.push(item);
    grouped.set(customApiId, existing);
  });

  return grouped;
}

function buildExecutionReadiness(
  mappedRequestParameters: CustomApiRequestParameter[]
): Pick<CustomApiDefinition, "previewReadyParameterCount" | "inspectOnlyParameterCount" | "executionReadiness" | "executionReadinessLabel" | "executionReadinessReason"> {
  const inspectOnlyParameterCount = mappedRequestParameters.filter((parameter) => parameter.executionSupport !== "preview-ready").length;
  const previewReadyParameterCount = mappedRequestParameters.length - inspectOnlyParameterCount;

  if (mappedRequestParameters.length === 0 || inspectOnlyParameterCount === 0) {
    return {
      previewReadyParameterCount,
      inspectOnlyParameterCount,
      executionReadiness: "preview-ready",
      executionReadinessLabel: "Preview-ready",
      executionReadinessReason: "All discovered parameters use simple types supported by the preview foundation."
    };
  }

  if (previewReadyParameterCount > 0) {
    return {
      previewReadyParameterCount,
      inspectOnlyParameterCount,
      executionReadiness: "partial",
      executionReadinessLabel: "Partially preview-ready",
      executionReadinessReason: "Some parameters use complex types that need additional payload support before execution preview."
    };
  }

  return {
    previewReadyParameterCount,
    inspectOnlyParameterCount,
    executionReadiness: "inspect-only",
    executionReadinessLabel: "Inspect only",
    executionReadinessReason: "The discovered parameters use complex or unknown types that need manual inspection before execution preview."
  };
}

function mapDefinition(
  record: CustomApiRecord,
  requestParameters: CustomApiRequestParameterRecord[],
  responseProperties: CustomApiResponsePropertyRecord[]
): CustomApiDefinition {
  const id = toText(record.customapiid) ?? "";
  const mappedRequestParameters = requestParameters.map(mapRequestParameter);
  const mappedResponseProperties = responseProperties.map(mapResponseProperty);
  const boundEntityLogicalName = toText(record.boundentitylogicalname);
  const boundTargetKind = normalizeBoundTargetKind(record);

  return {
    id,
    uniqueName: toText(record.uniquename) ?? toText(record.name) ?? "(unnamed Custom API)",
    displayName: toText(record.displayname) ?? toText(record.name),
    description: toText(record.description),
    operationKind: normalizeOperationKind(record),
    bindingKind: normalizeBindingKind(record),
    bindingType: toNumber(record.bindingtype),
    boundTargetKind,
    ...describeBoundTargetKind(boundTargetKind, boundEntityLogicalName),
    boundEntityLogicalName,
    executePrivilegeName: toText(record.executeprivilegename),
    allowedCustomProcessingStepType: toNumber(record.allowedcustomprocessingsteptype),
    isPrivate: toBoolean(record.isprivate),
    requestParameters: mappedRequestParameters,
    responseProperties: mappedResponseProperties,
    ...buildExecutionReadiness(mappedRequestParameters)
  };
}

export class CustomApiDiscoveryService {
  constructor(
    private readonly ctx: CommandContext,
    private readonly client: DataverseClient,
    private readonly token: string
  ) {}

  async discoverCustomApis(): Promise<CustomApiDefinition[]> {
    const [customApiResult, requestParameterResult, responsePropertyResult] = await Promise.all([
      this.client.get(CUSTOM_API_QUERY, this.token),
      this.client.get(CUSTOM_API_REQUEST_PARAMETER_QUERY, this.token),
      this.client.get(CUSTOM_API_RESPONSE_PROPERTY_QUERY, this.token)
    ]) as [
      DataverseListResponse<CustomApiRecord>,
      DataverseListResponse<CustomApiRequestParameterRecord>,
      DataverseListResponse<CustomApiResponsePropertyRecord>
    ];

    const apiRecords: CustomApiRecord[] = customApiResult.value ?? [];
    const requestParametersByApiId = groupByCustomApiId(requestParameterResult.value ?? []);
    const responsePropertiesByApiId = groupByCustomApiId(responsePropertyResult.value ?? []);

    this.ctx.output.appendLine(`DV Quick Run: Discovered ${apiRecords.length} Custom API definitions.`);

    return apiRecords.map((record) => {
      const id = toText(record.customapiid) ?? "";
      return mapDefinition(
        record,
        requestParametersByApiId.get(id) ?? [],
        responsePropertiesByApiId.get(id) ?? []
      );
    });
  }
}
