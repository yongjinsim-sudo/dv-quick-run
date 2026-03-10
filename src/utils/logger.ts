import * as vscode from "vscode";

export enum LogLevel {
  Error = 0,
  Warn = 1,
  Info = 2,
  Debug = 3
}

function getConfiguredLogLevel(): LogLevel {
  const cfg = vscode.workspace.getConfiguration("dvQuickRun");
  const level = cfg.get<string>("logLevel") ?? "info";

  switch (level.toLowerCase()) {
    case "debug":
      return LogLevel.Debug;
    case "info":
      return LogLevel.Info;
    case "warn":
      return LogLevel.Warn;
    case "error":
      return LogLevel.Error;
    default:
      return LogLevel.Info;
  }
}

export function log(
  output: vscode.OutputChannel,
  level: LogLevel,
  message: string
) {
  if (level <= getConfiguredLogLevel()) {
    output.appendLine(message);
  }
}

export function logDebug(output: vscode.OutputChannel, msg: string) {
  log(output, LogLevel.Debug, msg);
}

export function logInfo(output: vscode.OutputChannel, msg: string) {
  log(output, LogLevel.Info, msg);
}

export function logWarn(output: vscode.OutputChannel, msg: string) {
  log(output, LogLevel.Warn, msg);
}

export function logError(output: vscode.OutputChannel, msg: string) {
  log(output, LogLevel.Error, msg);
}