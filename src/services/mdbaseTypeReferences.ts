import YAML from "yaml";

/** Rewrite only mdbase type identity slots, never arbitrary matching strings.
 * Used by upgrade planning before a provider is retired. Preserves the note body
 * and YAML comments, and leaves byte-identical documents untouched.
 */
export function remapMdbaseTypeReferences(
	markdown: string,
	renames: ReadonlyMap<string, string>,
	explicitKeys: readonly string[],
	definition: boolean
): string {
	const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(markdown);
	if (!match) return markdown;
	const document = YAML.parseDocument(match[2]);
	if (document.errors.length) throw new Error("Cannot inspect malformed type references");
	let changed = false;
	const rewrite = (path: string[]) => {
		const node = document.getIn(path, true);
		const scalar = (item: unknown) => {
			if (YAML.isScalar(item) && typeof item.value === "string") {
				const target = renames.get(item.value);
				if (target !== undefined && target !== item.value) {
					item.value = target;
					changed = true;
				}
			}
		};
		if (YAML.isSeq(node)) node.items.forEach(scalar);
		else scalar(node);
	};
	if (definition) {
		// Do not treat a definition's domain schema or match rules as membership.
		rewrite(["extends"]);
		const links = document.getIn(["collection", "links"], true);
		if (YAML.isMap(links)) {
			for (const pair of links.items) {
				if (YAML.isScalar(pair.key) && typeof pair.key.value === "string") {
					rewrite(["collection", "links", pair.key.value, "target_type"]);
				}
			}
		}
	} else {
		for (const key of explicitKeys) rewrite([key]);
	}
	if (!changed) return markdown;
	return match[1] + document.toString({ lineWidth: 0 }).trimEnd() + match[3] + markdown.slice(match[0].length);
}
