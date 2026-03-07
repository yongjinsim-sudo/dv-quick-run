function trimOuterParens(input: string): string {
  let text = input.trim();

  while (text.startsWith("(") && text.endsWith(")")) {
    let depth = 0;
    let valid = true;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "(") {depth++;}
      if (ch === ")") {depth--;}
      if (depth === 0 && i < text.length - 1) {
        valid = false;
        break;
      }
    }

    if (!valid) {break;}
    text = text.slice(1, -1).trim();
  }

  return text;
}

function splitTopLevelLogical(input: string, keyword: "and" | "or"): string[] {
  const parts: string[] = [];
  const text = input.trim();

  let current = "";
  let depth = 0;
  let inSingleQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === "'") {
      if (inSingleQuote && text[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote) {
      if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth = Math.max(0, depth - 1);
      }

      const probe = text.slice(i).toLowerCase();
      const token = ` ${keyword} `;
      if (depth === 0 && probe.startsWith(token)) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = "";
        i += token.length - 1;
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function narrateLeaf(input: string): string {
  const text = trimOuterParens(input);

  let m = /^contains\((.+?),\s*'(.+)'\)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} contains "${m[2]}"`;
  }

  m = /^startswith\((.+?),\s*'(.+)'\)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} starts with "${m[2]}"`;
  }

  m = /^endswith\((.+?),\s*'(.+)'\)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} ends with "${m[2]}"`;
  }

  m = /^(.+?)\s+eq\s+(.+)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} equals ${m[2].trim()}`;
  }

  m = /^(.+?)\s+ne\s+(.+)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} does not equal ${m[2].trim()}`;
  }

  m = /^(.+?)\s+gt\s+(.+)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} is greater than ${m[2].trim()}`;
  }

  m = /^(.+?)\s+ge\s+(.+)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} is greater than or equal to ${m[2].trim()}`;
  }

  m = /^(.+?)\s+lt\s+(.+)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} is less than ${m[2].trim()}`;
  }

  m = /^(.+?)\s+le\s+(.+)$/i.exec(text);
  if (m) {
    return `${m[1].trim()} is less than or equal to ${m[2].trim()}`;
  }

  m = /^not\s+(.+)$/i.exec(text);
  if (m) {
    return `NOT (${narrateExpression(m[1])})`;
  }

  return text;
}

export function narrateExpression(input: string): string {
  const text = trimOuterParens(input);

  const orParts = splitTopLevelLogical(text, "or");
  if (orParts.length > 1) {
    return orParts.map((p) => narrateExpression(p)).join(" OR ");
  }

  const andParts = splitTopLevelLogical(text, "and");
  if (andParts.length > 1) {
    return andParts.map((p) => narrateExpression(p)).join(" AND ");
  }

  return narrateLeaf(text);
}