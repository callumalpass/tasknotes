/** An explicitly reviewed data boundary, NOT a translation escape hatch.
 * Use only for identifiers, real/example paths, syntax and proper product names
 * that must remain verbatim in editable fields. The source guard requires the
 * specific technical reason at every call. Never use for human UI sentences.
 */
export function uiData<Value extends string>(value: Value, reason: string): Value {
	if (!reason.trim()) throw new Error("A verbatim UI-data boundary requires its technical reason");
	return value;
}
