import type { CommandContext } from "../../commands/context/commandContext.js";
import { loadChoiceMetadata, loadEntityDefs, loadFields, loadNavigationProperties } from "../../commands/router/actions/shared/metadataAccess.js";
import type { DataverseClient } from "../../services/dataverseClient.js";
import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";
import type { NavPropertyDef } from "../../services/entityRelationshipMetadataService.js";
import type { EntityDef } from "../../utils/entitySetCache.js";
import { buildHoverFieldContext, getCachedHoverFieldContext, setCachedHoverFieldContext, type HoverFieldContext } from "../hoverFieldContextCache.js";
import { normalizeWord } from "./hoverCommon.js";

export type HoverConnectionContext = {
  baseUrl: string;
  scope: string;
  token: string;
  client: DataverseClient;
};

export function findEntityByEntitySetName(defs: EntityDef[], entitySetName: string): EntityDef | undefined {
  const target = entitySetName.trim().toLowerCase();
  return defs.find((d) => d.entitySetName.trim().toLowerCase() === target);
}

export class HoverRequestContext {
  private connectionPromise?: Promise<HoverConnectionContext>;
  private entityDefsPromise?: Promise<EntityDef[]>;
  private fieldContextPromises = new Map<string, Promise<HoverFieldContext>>();
  private navigationPromises = new Map<string, Promise<NavPropertyDef[]>>();
  private choicePromises = new Map<string, Promise<ChoiceMetadataDef[]>>();
  private entityBySetPromises = new Map<string, Promise<EntityDef | undefined>>();

  constructor(private readonly ctx: CommandContext) {}

  async getConnection(): Promise<HoverConnectionContext> {
    if (!this.connectionPromise) {
      this.connectionPromise = (async () => {
        const baseUrl = await this.ctx.getBaseUrl();
        const scope = this.ctx.getScope();
        const token = await this.ctx.getToken(scope);
        const client = this.ctx.getClient();

        return { baseUrl, scope, token, client };
      })();
    }

    return this.connectionPromise;
  }

  async getEntityDefs(): Promise<EntityDef[]> {
    if (!this.entityDefsPromise) {
      this.entityDefsPromise = (async () => {
        const connection = await this.getConnection();
        return loadEntityDefs(this.ctx, connection.client, connection.token, {
          silent: true,
          suppressOutput: true
        });
      })();
    }

    return this.entityDefsPromise;
  }

  async getEntityByEntitySetName(entitySetName: string): Promise<EntityDef | undefined> {
    const key = normalizeWord(entitySetName);
    const existing = this.entityBySetPromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const defs = await this.getEntityDefs();
      return findEntityByEntitySetName(defs, entitySetName);
    })();

    this.entityBySetPromises.set(key, promise);
    return promise;
  }

  async getFieldContext(logicalName: string): Promise<HoverFieldContext> {
    const cached = getCachedHoverFieldContext(logicalName);
    if (cached) {
      return cached;
    }

    const key = normalizeWord(logicalName);
    const existing = this.fieldContextPromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const connection = await this.getConnection();
      const fields = await loadFields(this.ctx, connection.client, connection.token, logicalName, {
        silent: true,
        suppressOutput: true
      });

      const context = buildHoverFieldContext(fields as FieldDef[]);
      setCachedHoverFieldContext(logicalName, context);
      return context;
    })();

    this.fieldContextPromises.set(key, promise);
    return promise;
  }

  async getNavigationProperties(logicalName: string): Promise<NavPropertyDef[]> {
    const key = normalizeWord(logicalName);
    const existing = this.navigationPromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const connection = await this.getConnection();
      return loadNavigationProperties(this.ctx, connection.client, connection.token, logicalName, {
        silent: true,
        suppressOutput: true
      }) as Promise<NavPropertyDef[]>;
    })();

    this.navigationPromises.set(key, promise);
    return promise;
  }

  async getChoiceMetadata(logicalName: string): Promise<ChoiceMetadataDef[]> {
    const key = normalizeWord(logicalName);
    const existing = this.choicePromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const connection = await this.getConnection();
      return loadChoiceMetadata(this.ctx, connection.client, connection.token, logicalName, {
        silent: true,
        suppressOutput: true
      });
    })();

    this.choicePromises.set(key, promise);
    return promise;
  }

  async getEntityByLogicalName(logicalName: string): Promise<EntityDef | undefined> {
    const target = normalizeWord(logicalName);
    const defs = await this.getEntityDefs();

    return defs.find((d) => normalizeWord(d.logicalName) === target);
  }

}

