import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { addQueryToHistory } from "../../../utils/queryHistory.js";
import { logError, logInfo } from "../../../utils/logger.js";
import { ParsedRecord } from "./generateQueryFromJson/generateQueryFromJsonTypes.js";
import {
  readJsonFromEditor,
  tryParseDataverseRecord,
  tryParseEntitySetFromContext
} from "./generateQueryFromJson/generateQueryFromJsonParser.js";

import {
  buildGetPath,
  buildGetPathWithSelect,
  buildFilterPathById,
  buildFilterPathByIdWithSelect,
  buildFullUrl,
  buildCurlGet
} from "./generateQueryFromJson/generateQueryFromJsonQueryBuilder.js";

async function openQueryInEditor(path: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: `/${path}`,
    language: "plaintext"
  });

  await vscode.window.showTextDocument(doc, { preview: false });
}

async function openQueryThenExplain(path: string): Promise<void> {
  await openQueryInEditor(path);
  await vscode.commands.executeCommand("dvQuickRun.explainQuery");
}

type Choice =
  | { kind: "copy"; value: string }
  | { kind: "copyCurl"; value: string }
  | { kind: "addToHistory"; value: string }
  | { kind: "addAndRun"; value: string }
  | { kind: "openEditor"; value: string }
  | { kind: "openAndExplain"; value: string }
  | { kind: "cancel" };

async function pickRecordFromArray(
  arr: any[],
  fallbackEntitySetName?: string
): Promise<any | undefined> {
  const items = arr
    .slice(0, 200)
    .map((x, idx) => {
      const rec = tryParseDataverseRecord(x, fallbackEntitySetName);
      const label = rec
        ? `${rec.entitySetName}(${rec.id})`
        : `Record ${idx + 1}`;
      const detail = rec
        ? `Fields: ${rec.selectFields.length}${rec.primaryIdField ? ` | PK: ${rec.primaryIdField}` : ""}`
        : "Unrecognized record";

      return {
        label,
        detail,
        raw: x
      };
    });

  const picked = await vscode.window.showQuickPick(items, {
    title: "DV Quick Run: Pick record from JSON array",
    placeHolder: "Select a record to generate a query for",
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked?.raw;
}

function buildPrimaryPicks(
  rec: ParsedRecord,
  baseUrl: string
): Array<{ label: string; description?: string; choice: Choice }> {
  const rawPath = buildGetPath(rec);
  const selectPath = buildGetPathWithSelect(rec);
  const filterPath = buildFilterPathById(rec);
  const filterSelectPath = buildFilterPathByIdWithSelect(rec);

  const rawFull = buildFullUrl(baseUrl, rawPath);
  const selectFull = buildFullUrl(baseUrl, selectPath);

  const rawCurl = buildCurlGet(rawFull);
  const selectCurl = buildCurlGet(selectFull);

  return [
    {
      label: "✨ Open GET with $select in editor",
      description: `/${selectPath}`,
      choice: { kind: "openEditor", value: selectPath }
    },
    {
      label: "✨ Open GET with $select and Explain",
      description: `/${selectPath}`,
      choice: { kind: "openAndExplain", value: selectPath }
    },
    {
      label: "▶️ Add GET with $select to history + Run GET",
      description: selectPath,
      choice: { kind: "addAndRun", value: selectPath }
    },

    {
      label: "📋 Copy direct GET path",
      description: `/${rawPath}`,
      choice: { kind: "copy", value: rawPath }
    },
    {
      label: "📋 Copy GET path with $select",
      description: `/${selectPath}`,
      choice: { kind: "copy", value: selectPath }
    },
    {
      label: "📋 Copy filter query by ID",
      description: `/${filterPath}`,
      choice: { kind: "copy", value: filterPath }
    },
    {
      label: "📋 Copy filter query by ID with $select",
      description: `/${filterSelectPath}`,
      choice: { kind: "copy", value: filterSelectPath }
    },

    {
      label: "📋 Copy direct GET full URL",
      description: rawFull,
      choice: { kind: "copy", value: rawFull }
    },
    {
      label: "📋 Copy GET with $select full URL",
      description: selectFull,
      choice: { kind: "copy", value: selectFull }
    },

    {
      label: "📋 Copy direct GET as curl",
      description: rawFull,
      choice: { kind: "copyCurl", value: rawCurl }
    },
    {
      label: "📋 Copy GET with $select as curl",
      description: selectFull,
      choice: { kind: "copyCurl", value: selectCurl }
    },

    {
      label: "🕘 Add direct GET to history",
      description: rawPath,
      choice: { kind: "addToHistory", value: rawPath }
    },
    {
      label: "🕘 Add GET with $select to history",
      description: selectPath,
      choice: { kind: "addToHistory", value: selectPath }
    },

    {
      label: "📝 Open direct GET in editor",
      description: `/${rawPath}`,
      choice: { kind: "openEditor", value: rawPath }
    },
    {
      label: "📝 Open filter query by ID in editor",
      description: `/${filterPath}`,
      choice: { kind: "openEditor", value: filterPath }
    },

    {
      label: "❌ Cancel",
      choice: { kind: "cancel" }
    }
  ];
}

export async function runGenerateQueryFromJsonAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const payload = readJsonFromEditor();
    if (!payload) {
      vscode.window.showErrorMessage("DV Quick Run: Could not parse JSON from selection or document.");
      return;
    }

    const root = payload.json;
    let recordObj: any = root;
    const fallbackEntitySetName = tryParseEntitySetFromContext(root);

    if (Array.isArray(root)) {
      if (root.length === 0) {
        vscode.window.showErrorMessage("DV Quick Run: JSON array is empty.");
        return;
      }

      const picked = await pickRecordFromArray(root, fallbackEntitySetName);
      if (!picked) {return;}
      recordObj = picked;
    } else if (root && typeof root === "object" && Array.isArray((root as any).value)) {
      const arr: any[] = (root as any).value;
      if (arr.length === 0) {
        vscode.window.showErrorMessage("DV Quick Run: JSON contains an empty 'value' array.");
        return;
      }

      const picked = await pickRecordFromArray(arr, fallbackEntitySetName);
      if (!picked) {return;}
      recordObj = picked;
    }

    const rec: ParsedRecord | undefined = tryParseDataverseRecord(recordObj, fallbackEntitySetName);
    if (!rec) {
      vscode.window.showErrorMessage(
        "DV Quick Run: Could not infer entity set + id. Expected @odata.id or @odata.context + GUID primary key field."
      );
      return;
    }

    const baseUrl = await ctx.getBaseUrl();

    logInfo(ctx.output,`Generate Query From JSON: used=${payload.used} source=${rec.source}`);
    logInfo(ctx.output,`EntitySet: ${rec.entitySetName}`);
    logInfo(ctx.output,`Id: ${rec.id}`);
    if (rec.primaryIdField) {
      logInfo(ctx.output,`PrimaryIdField: ${rec.primaryIdField}`);
    }
    logInfo(ctx.output,`Direct GET: /${buildGetPath(rec)}`);
    logInfo(ctx.output,`Direct GET + $select: /${buildGetPathWithSelect(rec)}`);
    logInfo(ctx.output,`Filter by ID: /${buildFilterPathById(rec)}`);

    const picks = buildPrimaryPicks(rec, baseUrl);

    const chosen = await vscode.window.showQuickPick(picks, {
      title: "DV Quick Run: Generate Query From JSON",
      placeHolder: "Choose what to do with the generated query",
      ignoreFocusOut: true,
      matchOnDescription: true
    });

    const choice = chosen?.choice;
    if (!choice || choice.kind === "cancel") {return;}

    if (choice.kind === "openEditor") {
      await openQueryInEditor(choice.value);
      return;
    }

    if (choice.kind === "openAndExplain") {
      await openQueryThenExplain(choice.value);
      return;
    }

    if (choice.kind === "copyCurl") {
      await vscode.env.clipboard.writeText(choice.value);
      vscode.window.showInformationMessage("DV Quick Run: curl copied to clipboard.");
      return;
    }

    if (choice.kind === "copy") {
      await vscode.env.clipboard.writeText(choice.value);
      vscode.window.showInformationMessage("DV Quick Run: Copied to clipboard.");
      return;
    }

    await addQueryToHistory(ctx.ext, choice.value);

    if (choice.kind === "addAndRun") {
      await vscode.commands.executeCommand("dvQuickRun.runGet");
    } else {
      vscode.window.showInformationMessage("DV Quick Run: Added query to history.");
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Generate Query From JSON failed. Check Output.");
  }
}