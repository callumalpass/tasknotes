import type { DisplayFieldToken, TaskCardDisplayFieldsConfig } from '../types';

/** Split a string by '|' while respecting escapes (\|) */
function splitPipesRespectingEscapes(s: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      // escape next char
      if (i + 1 < s.length) {
        cur += s[i + 1];
        i += 2;
        continue;
      }
    }
    if (ch === '|') {
      parts.push(cur.trim());
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  parts.push(cur.trim());
  return parts.filter(p => p.length > 0);
}

function unescapeValue(v: string): string {
  // unescape \| and \)
  return v.replace(/\\\|/g, '|').replace(/\\\)/g, ')');
}

export function parseDisplayFieldsRow(input: string): DisplayFieldToken[] {
  const tokens: DisplayFieldToken[] = [];
  if (!input) return tokens;

  const regex = /\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = regex.exec(input)) !== null) {
    // Capture any literal text between tokens (including spaces/punctuation)
    const between = input.slice(lastIndex, match.index);
    if (between.length > 0) {
      tokens.push({ property: `literal:${between}`, showName: false });
    }
    lastIndex = regex.lastIndex;

    const inner = match[1].trim();
    if (!inner) continue;
    const parts = splitPipesRespectingEscapes(inner);
    if (parts.length === 0) continue;
    let property = parts[0];
    if (!property) throw new Error('Missing property name in token');
    // Back-compat: allow 'user:<key>' but normalize to plain '<key>' for layout
    if (typeof property === 'string' && property.startsWith('user:')) {
      property = property.slice(5);
    }

    const token: DisplayFieldToken = { property, showName: false };
    for (let i = 1; i < parts.length; i++) {
      const flag = parts[i];
      if (flag === 'n') {
        token.showName = true;
      } else if (flag.startsWith('n(') && flag.endsWith(')')) {
        // New syntax: n(Name) both enables label and overrides it
        token.showName = true;
        const v = flag.slice(2, -1);
        token.displayName = unescapeValue(v);
      } else if (flag === 'e') token.inlineEditable = true; // post-MVP
      else if (flag.startsWith('d(') && flag.endsWith(')')) {
        // Back-compat: still accept d(Name) but prefer n(Name) going forward
        const v = flag.slice(2, -1);
        token.displayName = unescapeValue(v);
      } else if (flag.startsWith('f(') && flag.endsWith(')')) {
        const v = flag.slice(2, -1);
        token.format = unescapeValue(v);
      } else {
        // Unknown flags are ignored (forward compatible)
      }
    }
    tokens.push(token);
  }
  // Capture any trailing literal text after the last token
  const trailing = input.slice(lastIndex);
  if (trailing.length > 0) {
    tokens.push({ property: `literal:${trailing}`, showName: false });
  }
  return tokens;
}

export function serializeDisplayFieldsRow(tokens: DisplayFieldToken[]): string {
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\)/g, '\\)');
  return tokens
    .map(t => {
      if (typeof t.property === 'string' && t.property.startsWith('literal:')) {
        return t.property.slice(8);
      }
      const flags: string[] = [];
      if (t.showName && t.displayName) flags.push(`n(${esc(t.displayName)})`);
      else if (t.showName) flags.push('n');
      // Do not emit d() anymore; keep serializer output normalized to n(...) form
      if (t.inlineEditable) flags.push('e');
      if (t.format) flags.push(`f(${esc(t.format)})`);
      return `{${t.property}${flags.length ? '|' + flags.join('|') : ''}}`;
    })
    .join('');
}

export function parseDisplayFieldsConfig(rows2to4: string[]): TaskCardDisplayFieldsConfig {
  const rows = rows2to4.map(r => parseDisplayFieldsRow(r)) as [DisplayFieldToken[], DisplayFieldToken[], DisplayFieldToken[]];
  return { version: 1, row1FixedTitle: true, rows };
}

export function serializeDisplayFieldsConfig(cfg: TaskCardDisplayFieldsConfig): string[] {
  return cfg.rows.map(r => serializeDisplayFieldsRow(r));
}

