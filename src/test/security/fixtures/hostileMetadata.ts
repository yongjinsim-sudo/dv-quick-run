import { hostileTextFixtures } from "./hostileText.js";

export interface HostileMetadataFixture {
  id: string;
  logicalName: string;
  displayName: string;
  description: string;
}

export const hostileMetadataFixtures: readonly HostileMetadataFixture[] = hostileTextFixtures.slice(0, 8).map((fixture, index) => ({
  id: `metadata-${fixture.id}`,
  logicalName: `dvqr_test_${index}`,
  displayName: `Security Fixture ${index}`,
  description: fixture.value
}));
