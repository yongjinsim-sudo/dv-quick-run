export interface LemonSqueezyRuntimeConfig {
  pathfinderVariantIds: string[];
  pathfinderVariantIdSource: "environment" | "default";
}

// Lemon Squeezy license activation/validation endpoints do not require the
// private Store API key. Marketplace builds must never depend on local secret
// files or embed a Lemon Squeezy API key.
//
// Variant IDs are not secrets. They are used only to recognise early-supporter
// purchases and display the local Pathfinder badge. Keep known Pathfinder
// variant IDs here so Marketplace installs work without operator-local files.
const defaultPathfinderVariantIds = [
  "1792313",
  "1792555"
];

function normalizeCsv(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export async function resolveLemonSqueezyRuntimeConfig(): Promise<LemonSqueezyRuntimeConfig> {
  const environmentVariantIds = normalizeCsv(process.env.DVQR_LEMONSQUEEZY_PATHFINDER_VARIANT_IDS);

  if (environmentVariantIds.length > 0) {
    return {
      pathfinderVariantIds: environmentVariantIds,
      pathfinderVariantIdSource: "environment"
    };
  }

  return {
    pathfinderVariantIds: defaultPathfinderVariantIds,
    pathfinderVariantIdSource: "default"
  };
}
