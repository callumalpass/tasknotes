import { stringifyUnknown } from "../utils/stringUtils";

export type BasesExportColumn = {
	id: string;
	label: string;
};

export type BasesExportEntry = {
	file?: {
		path?: string;
	};
};

export type BasesExportDataAdapter<TEntry extends BasesExportEntry> = {
	getVisiblePropertyIds(): readonly string[];
	getPropertyDisplayName(propertyId: string): string;
	getPropertyValue(entry: TEntry, propertyId: string): unknown;
};

export type BasesExportTable = {
	columns: BasesExportColumn[];
	rows: string[][];
};

export function buildBasesExportTable<TEntry extends BasesExportEntry>(
	entries: readonly TEntry[],
	dataAdapter: BasesExportDataAdapter<TEntry>
): BasesExportTable {
	const columns = buildBasesExportColumns(dataAdapter);
	const rows = entries.map((entry) =>
		columns.map((column) => {
			if (column.id === "file") {
				return entry.file?.path ?? "";
			}

			return formatBasesExportValue(dataAdapter.getPropertyValue(entry, column.id));
		})
	);

	return { columns, rows };
}

export function buildBasesExportColumns<TEntry extends BasesExportEntry>(
	dataAdapter: BasesExportDataAdapter<TEntry>
): BasesExportColumn[] {
	const propertyIds = dataAdapter.getVisiblePropertyIds();
	return [
		{ id: "file", label: "File" },
		...propertyIds.map((propertyId) => ({
			id: propertyId,
			label: dataAdapter.getPropertyDisplayName(propertyId) || propertyId,
		})),
	];
}

export function formatBasesExportValue(value: unknown): string {
	return stringifyUnknown(value).replace(/\r?\n/g, " ");
}

export function formatBasesExportAsTsv(table: BasesExportTable): string {
	return [table.columns.map((column) => escapeTsvCell(column.label)), ...table.rows]
		.map((row) => row.map(escapeTsvCell).join("\t"))
		.join("\n");
}

export function formatBasesExportAsCsv(table: BasesExportTable): string {
	return [table.columns.map((column) => column.label), ...table.rows]
		.map((row) => row.map(escapeCsvCell).join(","))
		.join("\n");
}

export function buildBasesExportFileName(configName: unknown, viewType?: string): string {
	const configNameText = stringifyUnknown(configName);
	const baseName = configNameText || viewType || "tasknotes-bases-export";
	return `${sanitizeBasesExportFileName(baseName)}.csv`;
}

function escapeTsvCell(value: string): string {
	return value.replace(/\t/g, " ");
}

function escapeCsvCell(value: string): string {
	if (!/[",\r\n]/.test(value)) {
		return value;
	}
	return `"${value.replace(/"/g, '""')}"`;
}

function sanitizeBasesExportFileName(name: string): string {
	const sanitized = name
		.trim()
		.replace(/[\\/:*?"<>|]+/g, "-")
		.replace(/\s+/g, "-")
		.replace(/^-+|-+$/g, "");
	return sanitized || "tasknotes-bases-export";
}
