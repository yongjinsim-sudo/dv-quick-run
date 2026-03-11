export function toEnvironmentCachePrefix(environmentName: string): string {
  return environmentName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}