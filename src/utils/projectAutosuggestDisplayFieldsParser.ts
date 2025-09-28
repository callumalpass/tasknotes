export interface DisplayFieldToken {
	property: string;
	showName: boolean;
	displayName?: string;
	// Optional searchable flag: when true, this token participates in + search
	searchable?: boolean;
}

function splitPipesRespectingEscapes(s: string): string[] {
	const parts: string[] = [];
	let cur = "";
	let i = 0;
	while (i < s.length) {
		const ch = s[i];
		if (ch === "\\") {
			if (i + 1 < s.length) {
				cur += s[i + 1];
				i += 2;
				continue;
			}
		}
		if (ch === "|") {
			parts.push(cur.trim());
			cur = "";
			i++;
			continue;
		}
		cur += ch;
		i++;
	}
	parts.push(cur.trim());
	return parts.filter((p) => p.length > 0);
}

function unescapeValue(v: string): string {
	return v.replace(/\\\|/g, "|").replace(/\\\)/g, ")");
}

export function parseDisplayFieldsRow(input: string): DisplayFieldToken[] {
	const tokens: DisplayFieldToken[] = [];
	if (!input) return tokens;

	const regex = /\{([^}]*)\}/g;
	let match: RegExpExecArray | null;
	let lastIndex = 0;
	while ((match = regex.exec(input)) !== null) {
		const between = input.slice(lastIndex, match.index);
		if (between.length > 0) tokens.push({ property: `literal:${between}`, showName: false });
		lastIndex = regex.lastIndex;

		const inner = match[1].trim();
		if (!inner) continue;
		const parts = splitPipesRespectingEscapes(inner);
		if (parts.length === 0) continue;

		let property = parts[0];
		if (!property) throw new Error("Missing property name in token");

		const token: DisplayFieldToken = { property, showName: false };
		for (let i = 1; i < parts.length; i++) {
			const flag = parts[i];
			if (flag === "n") token.showName = true;
			else if (flag.startsWith("n(") && flag.endsWith(")")) {
				token.showName = true;
				token.displayName = unescapeValue(flag.slice(2, -1));
			} else if (flag === "s") {
				(token as any).searchable = true;
			}
		}
		tokens.push(token);
	}
	const trailing = input.slice(lastIndex);
	if (trailing.length > 0) tokens.push({ property: `literal:${trailing}`, showName: false });
	return tokens;
}

export function serializeDisplayFieldsRow(tokens: DisplayFieldToken[]): string {
	const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\)/g, "\\)");
	return tokens
		.map((t) => {
			if (t.property.startsWith("literal:")) return t.property.slice(8);
			const flags: string[] = [];
			if (t.showName && t.displayName) flags.push(`n(${esc(t.displayName)})`);
			else if (t.showName) flags.push("n");
			if ((t as any).searchable) flags.push("s");
			return `{${t.property}${flags.length ? "|" + flags.join("|") : ""}}`;
		})
		.join("");
}
