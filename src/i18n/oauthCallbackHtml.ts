/** Fixed callback-page structure; translated copy is always escaped as text. */
export function oauthCallbackHtml(title: string, description = "", locale = "en"): string {
	const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
	const escape = (value: string): string => value.replace(/[&<>"']/g, character => entities[character]);
	return `<!doctype html><html lang="${escape(locale)}"><head><meta charset="utf-8"><title>${escape(title)}</title></head><body>${description ? `<p>${escape(description)}</p>` : ""}</body></html>`;
}
