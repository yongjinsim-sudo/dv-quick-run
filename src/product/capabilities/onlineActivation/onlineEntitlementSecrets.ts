import type * as vscode from "vscode";

export const onlineLicenseKeySecretKey = "dvQuickRun.onlineLicenseKey";

export async function storeOnlineLicenseKey(secrets: vscode.SecretStorage, licenseKey: string): Promise<void> {
  await secrets.store(onlineLicenseKeySecretKey, licenseKey);
}

export async function readOnlineLicenseKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
  const value = await secrets.get(onlineLicenseKeySecretKey);

  return value !== undefined && value.trim().length > 0 ? value : undefined;
}

export async function clearOnlineLicenseKey(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(onlineLicenseKeySecretKey);
}
