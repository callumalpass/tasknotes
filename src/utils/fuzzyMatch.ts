export function scoreMultiword(q: string, text: string): number {
	if (!q || !text) return 0;
	const tokens = q.toLowerCase().split(" ").filter(Boolean);
	const hay = text.toLowerCase();
	let pos = 0;
	let score = 0;
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		const idx = hay.indexOf(t, pos);
		if (idx === -1) return 0; // must include all tokens
		// earlier matches score higher
		score += Math.max(0, 100 - idx);
		// small bonus if token is a prefix at its match point
		if (hay.startsWith(t, idx)) score += 10;
		// contiguity bonus: if this token starts right after previous
		if (i > 0 && idx === pos) score += 5;
		pos = idx + t.length;
	}
	return score;
}
