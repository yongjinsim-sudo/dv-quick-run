import type { CommandContext } from "../../commands/context/commandContext.js";
import { getEntitySetNameByLogicalName } from "../../commands/router/actions/shared/metadataAccess.js";
import { logInfo } from "../../utils/logger.js";

export interface PreparedFetchXmlQuery {
    logicalEntityName: string;
    entitySetName: string;
    encodedFetchXml: string;
    requestPath: string;
}

export function extractFetchXmlRootEntityName(fetchXml: string): string | undefined {
    const match = fetchXml.match(/<entity\s+[^>]*name\s*=\s*["']([^"']+)["']/i);
    return match?.[1];
}

export async function prepareFetchXmlQuery(
    fetchXml: string,
    ctx: CommandContext
): Promise<PreparedFetchXmlQuery> {
    const logicalEntityName = extractFetchXmlRootEntityName(fetchXml);

    if (!logicalEntityName) {
        throw new Error("Could not determine FetchXML root entity name.");
    }

    const entitySetName = await getEntitySetNameByLogicalName(logicalEntityName, ctx);

    if (!entitySetName) {
        throw new Error(`Could not resolve entity set name for '${logicalEntityName}'.`);
    }
    
    const params = new URLSearchParams({
        fetchXml
    });

    const requestPath = `/${entitySetName}?${params.toString()}`;

    return {
        logicalEntityName,
        entitySetName,
        encodedFetchXml: params.get("fetchXml") ?? "",
        requestPath
    };
}