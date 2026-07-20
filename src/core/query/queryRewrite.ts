function splitTopLevel(input: string, delimiter: string): string[] {
  const output: string[] = [];
  let current = "";
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === "'") {
      if (quoted && input[index + 1] === "'") {
        current += "''";
        index++;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && char === "(") {
      depth++;
    } else if (!quoted && char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (!quoted && depth === 0 && char === delimiter) {
      output.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  output.push(current);
  return output;
}

function splitSource(source: string): { prefix: string; query: string; fragment: string } {
  const fragmentIndex = source.indexOf("#");
  const fragment = fragmentIndex >= 0 ? source.slice(fragmentIndex) : "";
  const withoutFragment = fragmentIndex >= 0 ? source.slice(0, fragmentIndex) : source;
  const queryIndex = withoutFragment.indexOf("?");
  return queryIndex >= 0
    ? { prefix: withoutFragment.slice(0, queryIndex), query: withoutFragment.slice(queryIndex + 1), fragment }
    : { prefix: withoutFragment, query: "", fragment };
}

function mutateOption(source: string, optionName: string, update: (value: string | undefined) => string | undefined): string {
  const parts = splitSource(source);
  const params = parts.query ? splitTopLevel(parts.query, "&") : [];
  const normalizedOption = optionName.toLowerCase();
  let changed = false;
  const next = params.flatMap((param) => {
    const index = param.indexOf("=");
    const key = (index >= 0 ? param.slice(0, index) : param).trim();
    if (key.toLowerCase() !== normalizedOption || changed) {
      return [param];
    }
    changed = true;
    const value = index >= 0 ? param.slice(index + 1) : "";
    const updated = update(value);
    return updated === undefined ? [] : [`${key}=${updated}`];
  });
  if (!changed) {
    const updated = update(undefined);
    if (updated !== undefined) {
      next.push(`${optionName}=${updated}`);
    }
  }
  return `${parts.prefix}${next.length ? `?${next.join("&")}` : ""}${parts.fragment}`;
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function addSelectField(source: string, field: string): string {
  return mutateOption(source, "$select", (current) =>
    dedupe([...(current ? splitTopLevel(current, ",") : []), field]).join(",")
  );
}

export function replaceSelectField(source: string, currentField: string, replacement: string): string {
  return mutateOption(source, "$select", (current) => {
    if (!current) {
      return replacement;
    }
    const fields = splitTopLevel(current, ",").map((field) =>
      field.trim().toLowerCase() === currentField.trim().toLowerCase() ? replacement : field.trim()
    );
    return dedupe(fields).join(",");
  });
}

export function addExpand(source: string, navigationProperty: string, nestedSelect?: readonly string[]): string {
  const expression = nestedSelect?.length
    ? `${navigationProperty}($select=${dedupe(nestedSelect).join(",")})`
    : navigationProperty;
  return mutateOption(source, "$expand", (current) =>
    dedupe([...(current ? splitTopLevel(current, ",") : []), expression]).join(",")
  );
}

export function replaceExpandNavigation(
  source: string,
  currentNavigation: string,
  replacementNavigation: string,
  nestedSelect?: readonly string[]
): string {
  return mutateOption(source, "$expand", (current) => {
    if (!current) {
      return replacementNavigation;
    }
    return splitTopLevel(current, ",").map((expand) => {
      const trimmed = expand.trim();
      const open = trimmed.indexOf("(");
      const navigation = (open >= 0 ? trimmed.slice(0, open) : trimmed).trim();
      const suffix = open >= 0
        ? trimmed.slice(open)
        : nestedSelect?.length
          ? `($select=${dedupe(nestedSelect).join(",")})`
          : "";
      return navigation.toLowerCase() === currentNavigation.trim().toLowerCase()
        ? `${replacementNavigation}${suffix}`
        : trimmed;
    }).join(",");
  });
}

export function replaceFilterField(source: string, currentField: string, replacement: string): string {
  return mutateOption(source, "$filter", (current) => {
    if (!current) {
      return current;
    }
    const escaped = currentField.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return current.replace(new RegExp(`\\b${escaped}\\b`, "gi"), replacement);
  });
}
