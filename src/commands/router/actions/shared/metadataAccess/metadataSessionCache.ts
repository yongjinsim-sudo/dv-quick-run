type Factory<T> = () => Promise<T>;

const entityDefsMemory = new Map<string, unknown[]>();
const entityDefsInFlight = new Map<string, Promise<unknown[]>>();

const fieldsMemory = new Map<string, unknown[]>();
const fieldsInFlight = new Map<string, Promise<unknown[]>>();

const navigationMemory = new Map<string, unknown[]>();
const navigationInFlight = new Map<string, Promise<unknown[]>>();

const choiceMemory = new Map<string, unknown[]>();
const choiceInFlight = new Map<string, Promise<unknown[]>>();

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function scopedKey(value: string, environmentName?: string): string {
  const environment = normalizeKey(environmentName ?? "");
  const key = normalizeKey(value);
  return environment ? `${environment}::${key}` : key;
}

async function getOrCreateInFlight<T>(
  map: Map<string, Promise<T>>,
  key: string,
  factory: Factory<T>
): Promise<T> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const promise = factory().finally(() => {
    map.delete(key);
  });

  map.set(key, promise);
  return promise;
}

export function getEntityDefsMemory<T>(environmentName?: string): T[] | undefined {
  return entityDefsMemory.get(scopedKey("entity-definitions", environmentName)) as T[] | undefined;
}

export function setEntityDefsMemory<T>(value: T[], environmentName?: string): void {
  entityDefsMemory.set(scopedKey("entity-definitions", environmentName), value as unknown[]);
}

export async function getOrCreateEntityDefsInFlight<T>(
  factory: Factory<T[]>,
  environmentName?: string
): Promise<T[]> {
  const key = scopedKey("entity-definitions", environmentName);
  const existing = entityDefsInFlight.get(key);
  if (existing) {
    return existing as Promise<T[]>;
  }

  const promise = factory().finally(() => {
    entityDefsInFlight.delete(key);
  }) as Promise<unknown[]>;
  entityDefsInFlight.set(key, promise);

  return promise as Promise<T[]>;
}

export function getFieldsMemory<T>(logicalName: string, environmentName?: string): T[] | undefined {
  return fieldsMemory.get(scopedKey(logicalName, environmentName)) as T[] | undefined;
}

export function setFieldsMemory<T>(logicalName: string, value: T[], environmentName?: string): void {
  fieldsMemory.set(scopedKey(logicalName, environmentName), value as unknown[]);
}

export async function getOrCreateFieldsInFlight<T>(
  logicalName: string,
  factory: Factory<T[]>,
  environmentName?: string
): Promise<T[]> {
  return getOrCreateInFlight(
    fieldsInFlight as Map<string, Promise<T[]>>,
    scopedKey(logicalName, environmentName),
    factory
  );
}

export function getNavigationMemory<T>(logicalName: string, environmentName?: string): T[] | undefined {
  return navigationMemory.get(scopedKey(logicalName, environmentName)) as T[] | undefined;
}

export function setNavigationMemory<T>(logicalName: string, value: T[], environmentName?: string): void {
  navigationMemory.set(scopedKey(logicalName, environmentName), value as unknown[]);
}

export async function getOrCreateNavigationInFlight<T>(
  logicalName: string,
  factory: Factory<T[]>,
  environmentName?: string
): Promise<T[]> {
  return getOrCreateInFlight(
    navigationInFlight as Map<string, Promise<T[]>>,
    scopedKey(logicalName, environmentName),
    factory
  );
}

export function getChoiceMemory<T>(logicalName: string, environmentName?: string): T[] | undefined {
  return choiceMemory.get(scopedKey(logicalName, environmentName)) as T[] | undefined;
}

export function setChoiceMemory<T>(logicalName: string, value: T[], environmentName?: string): void {
  choiceMemory.set(scopedKey(logicalName, environmentName), value as unknown[]);
}

export async function getOrCreateChoiceInFlight<T>(
  logicalName: string,
  factory: Factory<T[]>,
  environmentName?: string
): Promise<T[]> {
  return getOrCreateInFlight(
    choiceInFlight as Map<string, Promise<T[]>>,
    scopedKey(logicalName, environmentName),
    factory
  );
}

export function clearMetadataSessionCache(): void {
  entityDefsMemory.clear();
  entityDefsInFlight.clear();

  fieldsMemory.clear();
  fieldsInFlight.clear();

  navigationMemory.clear();
  navigationInFlight.clear();

  choiceMemory.clear();
  choiceInFlight.clear();
}

export function getMetadataSessionCacheDiagnostics(): {
  entityDefsLoaded: boolean;
  fieldsLogicalNames: string[];
  navigationLogicalNames: string[];
  choiceLogicalNames: string[];
} {
  return {
    entityDefsLoaded: entityDefsMemory.size > 0,
    fieldsLogicalNames: Array.from(fieldsMemory.keys()).sort(),
    navigationLogicalNames: Array.from(navigationMemory.keys()).sort(),
    choiceLogicalNames: Array.from(choiceMemory.keys()).sort()
  };
}
