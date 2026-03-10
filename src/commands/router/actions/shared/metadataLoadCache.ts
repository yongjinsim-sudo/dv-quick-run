type Factory<T> = () => Promise<T>;

let entityDefsMemory: unknown[] | undefined;
let entityDefsInFlight: Promise<unknown[]> | undefined;

const fieldsMemory = new Map<string, unknown[]>();
const fieldsInFlight = new Map<string, Promise<unknown[]>>();

const navigationMemory = new Map<string, unknown[]>();
const navigationInFlight = new Map<string, Promise<unknown[]>>();

const choiceMemory = new Map<string, unknown[]>();
const choiceInFlight = new Map<string, Promise<unknown[]>>();

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
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

export function getEntityDefsMemory<T>(): T[] | undefined {
  return entityDefsMemory as T[] | undefined;
}

export function setEntityDefsMemory<T>(value: T[]): void {
  entityDefsMemory = value as unknown[];
}

export async function getOrCreateEntityDefsInFlight<T>(
  factory: Factory<T[]>
): Promise<T[]> {
  if (entityDefsInFlight) {
    return entityDefsInFlight as Promise<T[]>;
  }

  entityDefsInFlight = factory().finally(() => {
    entityDefsInFlight = undefined;
  }) as Promise<unknown[]>;

  return entityDefsInFlight as Promise<T[]>;
}

export function getFieldsMemory<T>(logicalName: string): T[] | undefined {
  return fieldsMemory.get(normalizeKey(logicalName)) as T[] | undefined;
}

export function setFieldsMemory<T>(logicalName: string, value: T[]): void {
  fieldsMemory.set(normalizeKey(logicalName), value as unknown[]);
}

export async function getOrCreateFieldsInFlight<T>(
  logicalName: string,
  factory: Factory<T[]>
): Promise<T[]> {
  return getOrCreateInFlight(
    fieldsInFlight as Map<string, Promise<T[]>>,
    normalizeKey(logicalName),
    factory
  );
}

export function getNavigationMemory<T>(logicalName: string): T[] | undefined {
  return navigationMemory.get(normalizeKey(logicalName)) as T[] | undefined;
}

export function setNavigationMemory<T>(logicalName: string, value: T[]): void {
  navigationMemory.set(normalizeKey(logicalName), value as unknown[]);
}

export async function getOrCreateNavigationInFlight<T>(
  logicalName: string,
  factory: Factory<T[]>
): Promise<T[]> {
  return getOrCreateInFlight(
    navigationInFlight as Map<string, Promise<T[]>>,
    normalizeKey(logicalName),
    factory
  );
}

export function getChoiceMemory<T>(logicalName: string): T[] | undefined {
  return choiceMemory.get(normalizeKey(logicalName)) as T[] | undefined;
}

export function setChoiceMemory<T>(logicalName: string, value: T[]): void {
  choiceMemory.set(normalizeKey(logicalName), value as unknown[]);
}

export async function getOrCreateChoiceInFlight<T>(
  logicalName: string,
  factory: Factory<T[]>
): Promise<T[]> {
  return getOrCreateInFlight(
    choiceInFlight as Map<string, Promise<T[]>>,
    normalizeKey(logicalName),
    factory
  );
}

export function clearMetadataSessionCache(): void {
  entityDefsMemory = undefined;
  entityDefsInFlight = undefined;

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
    entityDefsLoaded: !!entityDefsMemory,
    fieldsLogicalNames: Array.from(fieldsMemory.keys()).sort(),
    navigationLogicalNames: Array.from(navigationMemory.keys()).sort(),
    choiceLogicalNames: Array.from(choiceMemory.keys()).sort()
  };
}