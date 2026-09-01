function getWikilinkDisplayText(linkText: string): string {
	const display = linkText.includes("|")
		? linkText.split("|").pop() || linkText
		: linkText;
	return display.split("/").pop()?.replace(/\.md$/i, "") || display;
}

export function sanitizeLinkAliasText(alias: string): string {
	let sanitized = alias;
	for (let pass = 0; pass < 4; pass++) {
		const previous = sanitized;
		sanitized = sanitized.replace(/\[\[([^[\]]+)\]\]/g, (_match, inner) =>
			getWikilinkDisplayText(String(inner)).trim()
		);
		sanitized = sanitized.replace(
			/\[([^\]]+)\]\((<[^>]+>|[^)]+)\)/g,
			(_match, label) => String(label).trim()
		);
		if (sanitized === previous) break;
	}

	return sanitized.replace(/\s+/g, " ").trim();
}

export function sanitizeGeneratedLinkAlias(linkText: string): string {
	if (linkText.startsWith("[[") && linkText.endsWith("]]")) {
		const inner = linkText.slice(2, -2);
		const aliasSeparator = inner.indexOf("|");
		if (aliasSeparator === -1) {
			return linkText;
		}

		const target = inner.slice(0, aliasSeparator);
		const alias = inner.slice(aliasSeparator + 1);
		const sanitizedAlias = sanitizeLinkAliasText(alias);

		return sanitizedAlias ? `[[${target}|${sanitizedAlias}]]` : `[[${target}]]`;
	}

	if (linkText.startsWith("[") && linkText.endsWith(")")) {
		const aliasSeparator = linkText.lastIndexOf("](");
		if (aliasSeparator <= 0) {
			return linkText;
		}

		const alias = linkText.slice(1, aliasSeparator);
		const destination = linkText.slice(aliasSeparator + 2, -1);
		const sanitizedAlias = sanitizeLinkAliasText(alias);

		return sanitizedAlias ? `[${sanitizedAlias}](${destination})` : linkText;
	}

	return linkText;
}
