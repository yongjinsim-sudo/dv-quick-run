export type ConfigInspection = {
  section: string;
  defaultValue?: unknown;
  globalValue?: unknown;
  workspaceValue?: unknown;
  workspaceFolderValue?: unknown;
};

export type ConfigMigrationWrite = {
  section: string;
  value: unknown;
};

export type ConfigMigrationPlan = {
  writes: ConfigMigrationWrite[];
  skipped: string[];
};

function hasExplicitValue(inspection: ConfigInspection): boolean {
  return typeof inspection.globalValue !== "undefined"
    || typeof inspection.workspaceValue !== "undefined"
    || typeof inspection.workspaceFolderValue !== "undefined";
}

function cloneSupportedDefaultValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return [...value];
  }

  return undefined;
}

export function buildConfigMigrationPlan(
  inspections: ConfigInspection[]
): ConfigMigrationPlan {
  const writes: ConfigMigrationWrite[] = [];
  const skipped: string[] = [];

  for (const inspection of inspections) {
    if (hasExplicitValue(inspection)) {
      skipped.push(inspection.section);
      continue;
    }

    const defaultValue = cloneSupportedDefaultValue(inspection.defaultValue);

    if (typeof defaultValue === "undefined") {
      skipped.push(inspection.section);
      continue;
    }

    writes.push({
      section: inspection.section,
      value: defaultValue
    });
  }

  return {
    writes,
    skipped
  };
}
