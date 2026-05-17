export function isNoteFileOrFormulaProperty(prop: string): boolean {
	return prop.startsWith("note.") || prop.startsWith("file.") || prop.startsWith("formula.");
}
