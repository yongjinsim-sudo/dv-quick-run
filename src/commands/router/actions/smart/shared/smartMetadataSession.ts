import type { CommandContext } from "../../../../context/commandContext.js";
import type { DataverseClient } from "../../../../../services/dataverseClient.js";
import { loadEntityDefs } from "../../shared/metadataAccess.js";
import type { EntityDef } from "../../../../../utils/entitySetCache.js";
import type { SmartField } from "../../smartGet/smartGetTypes.js";
import { loadFields } from "../../shared/metadataAccess.js";
import { toSelectableFields } from "../../shared/selectableFields.js";
import { buildLookupSelectToken } from "../../../../../metadata/metadataModel.js";

function selectTokenForField(logicalName: string, attributeType?: string): string | undefined {
  return buildLookupSelectToken(logicalName, attributeType);
}

export class SmartMetadataSession {
  private entityDefsPromise?: Promise<EntityDef[]>;
  private entityByLogicalName = new Map<string, EntityDef>();
  private entityByEntitySetName = new Map<string, EntityDef>();
  private smartFieldsByLogicalName = new Map<string, Promise<SmartField[]>>();

  constructor(
    private readonly ctx: CommandContext,
    private readonly client: DataverseClient,
    private readonly token: string
  ) {}

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  async getEntityDefs(): Promise<EntityDef[]> {
    if (!this.entityDefsPromise) {
      this.entityDefsPromise = (async () => {
        const defs = await loadEntityDefs(this.ctx, this.client, this.token);

        for (const def of defs) {
          this.entityByLogicalName.set(this.normalize(def.logicalName), def);
          this.entityByEntitySetName.set(this.normalize(def.entitySetName), def);
        }

        return defs;
      })();
    }

    return this.entityDefsPromise;
  }

  async getEntityByLogicalName(logicalName: string): Promise<EntityDef | undefined> {
    const key = this.normalize(logicalName);

    const cached = this.entityByLogicalName.get(key);
    if (cached) {
      return cached;
    }

    await this.getEntityDefs();
    return this.entityByLogicalName.get(key);
  }

  async getEntityByEntitySetName(entitySetName: string): Promise<EntityDef | undefined> {
    const key = this.normalize(entitySetName);

    const cached = this.entityByEntitySetName.get(key);
    if (cached) {
      return cached;
    }

    await this.getEntityDefs();
    return this.entityByEntitySetName.get(key);
  }

  async getSmartFields(logicalName: string): Promise<SmartField[]> {
    const key = this.normalize(logicalName);
    const existing = this.smartFieldsByLogicalName.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const fields = await loadFields(this.ctx, this.client, this.token, logicalName);

      return toSelectableFields(fields).map((f) => ({
        logicalName: f.logicalName,
        attributeType: f.attributeType,
        isValidForRead: f.isValidForRead,
        selectToken: f.selectToken ?? selectTokenForField(f.logicalName, f.attributeType)
      }));
    })();

    this.smartFieldsByLogicalName.set(key, promise);
    return promise;
  }
}