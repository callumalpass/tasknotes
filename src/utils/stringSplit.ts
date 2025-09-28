/**
 * Split a comma-separated string while preserving commas inside wikilinks [[...]]
 * and quoted segments ('...' or "...").
 *
 * Examples:
 *  - "John, Mary" -> ["John", "Mary"]
 *  - "[[Health, Fitness & Mindset]]" -> ["[[Health, Fitness & Mindset]]"]
 *  - "[[Wellbeing|Health, Fitness & Mindset]], Notes" -> ["[[Wellbeing|Health, Fitness & Mindset]]", "Notes"]
 *  - '"Focus, Deep Work", Notes' -> ['"Focus, Deep Work"', 'Notes']
 */
export function splitListPreservingLinksAndQuotes(input: string): string[] {
	if (input == null) return [];
	const out: string[] = [];
	let buf = "";
	let inLink = 0; // tracks [[ ... ]] depth
	let inQuote: '"' | "'" | null = null;

	for (let i = 0; i < input.length; i++) {
		const c = input[i];
		const next = input[i + 1];

		// Enter/exit wikilink [[...]]
		if (!inQuote && c === "[" && next === "[") {
			inLink++;
			buf += "[[";
			i++;
			continue;
		}
		if (!inQuote && c === "]" && next === "]" && inLink > 0) {
			inLink--;
			buf += "]]";
			i++;
			continue;
		}

		// Enter/exit quotes (only when not inside wikilink)
		if (!inLink && (c === '"' || c === "'")) {
			if (inQuote === null) inQuote = c as '"' | "'";
			else if (inQuote === c) inQuote = null;
			buf += c;
			continue;
		}

		// Top-level comma = separator
		if (c === "," && inLink === 0 && inQuote === null) {
			const token = buf.trim();
			if (token) out.push(token);
			buf = "";
			continue;
		}

		buf += c;
	}

	const last = buf.trim();
	if (last) out.push(last);
	return out;
}

export default splitListPreservingLinksAndQuotes;
