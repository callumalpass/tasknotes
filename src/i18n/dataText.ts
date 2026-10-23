/** An explicitly reviewed data boundary, NOT a translation escape hatch.
 * Use only for identifiers, real/example paths, syntax and proper product names
 * that must remain verbatim, or user-authored vault/Bases data at its display
 * boundary. The source guard requires the specific reason at every call.
 * Never wrap a generic renderer, app-owned label or human UI sentence.
 */
export function uiData<const Value>(value: Value, reason: string): Value {
	if (!reason.trim()) throw new Error("A verbatim UI-data boundary requires its technical reason");
	return value;
}
