export const fakeSecrets = {
  bearer: "DVQR_TEST_BEARER_SECRET_7fa3c9",
  clientSecret: "DVQR_TEST_CLIENT_SECRET_42e8b1",
  connectionString: "DVQR_TEST_CONNECTION_STRING_982bd0",
  apiKey: "DVQR_TEST_API_KEY_36c1ad"
} as const;

export const providerErrorFixtures = [
  new Error(`Authorization: Bearer ${fakeSecrets.bearer}`),
  new Error(`ClientSecret=${fakeSecrets.clientSecret}`),
  new Error(`ApiKey=${fakeSecrets.apiKey}`),
  new Error(`ConnectionString=${fakeSecrets.connectionString}`),
  new Error(`HTTP 500 provider failure; Authorization: Bearer ${fakeSecrets.bearer}; ClientSecret=${fakeSecrets.clientSecret}`),
  {
    message: `Fallback transport failed with ApiKey=${fakeSecrets.apiKey}`,
    nested: { stderr: `Shared diagnostic ${fakeSecrets.connectionString}` }
  }
] as const;
