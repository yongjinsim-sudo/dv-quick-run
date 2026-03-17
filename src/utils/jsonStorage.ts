import * as fs from "fs";
import * as path from "path";

export function readJsonFileSync<T>(filePath: string): T | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return undefined;
    }

    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeJsonFileSync(filePath: string, value: unknown): void {
  ensureDirectorySync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function ensureDirectorySync(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.promises.rm(filePath, { force: true });
  } catch {
    // ignore
  }
}

export async function deleteDirectoryIfExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function listJsonBaseNames(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    return fs.readdirSync(dirPath)
      .filter((name: string) => name.toLowerCase().endsWith(".json"))
      .map((name: string) => name.slice(0, -5))
      .sort();
  } catch {
    return [];
  }
}

export function getFileSizeSync(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

export function getDirectorySizeSync(dirPath: string): number {
  try {
    if (!fs.existsSync(dirPath)) {
      return 0;
    }

    let total = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const entryPath = path.join(dirPath, entry.name);
      total += entry.isDirectory() ? getDirectorySizeSync(entryPath) : getFileSizeSync(entryPath);
    }

    return total;
  } catch {
    return 0;
  }
}
