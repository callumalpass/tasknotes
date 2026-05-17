import type { App } from "obsidian";
import type { BasesDataItem } from "./helpers";

type MetadataTypeManagerSource = {
	metadataTypeManager?: {
		properties?: Record<string, { type?: string; widget?: string }>;
	};
};

type BasesFormula = {
	getValue?: (data: unknown) => unknown;
};

type BasesFormulaWithGetter = {
	getValue: (data: unknown) => unknown;
};

type BasesFormulaContext = Record<string, BasesFormula>;

type BasesFormulaData = {
	frontmatter?: Record<string, unknown>;
	formulaResults?: {
		cachedFormulaOutputs?: Record<string, unknown>;
	};
};

const OBSIDIAN_LIST_PROPERTY_TYPES = new Set(["multitext", "tags", "aliases"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function isObsidianListProperty(app: App, propertyName: string): boolean {
	const propertyType = getObsidianPropertyType(app, propertyName);
	return typeof propertyType === "string" && OBSIDIAN_LIST_PROPERTY_TYPES.has(propertyType);
}

export function getObsidianPropertyType(app: App, propertyName: string): string | null {
	const metadataTypeManager = (app as unknown as MetadataTypeManagerSource).metadataTypeManager;
	const propertyInfo = metadataTypeManager?.properties?.[propertyName.toLowerCase()];
	const propertyType = propertyInfo?.type ?? propertyInfo?.widget;
	return typeof propertyType === "string" ? propertyType : null;
}

export function getBasesFormulaContext(data: unknown): BasesFormulaContext | undefined {
	if (!isRecord(data) || !isRecord(data.ctx) || !isRecord(data.ctx.formulas)) {
		return undefined;
	}

	return data.ctx.formulas as BasesFormulaContext;
}

export function getBasesFormulaData(item: BasesDataItem): BasesFormulaData | undefined {
	return isRecord(item.basesData) ? item.basesData : undefined;
}

export function hasFormulaGetter(
	formula: BasesFormula | undefined
): formula is BasesFormulaWithGetter {
	return typeof formula?.getValue === "function";
}

export function evaluateBasesFormula(
	formula: BasesFormulaWithGetter,
	baseData: BasesFormulaData,
	taskProperties: Record<string, unknown>
): unknown {
	const originalFrontmatter = baseData.frontmatter;

	if (originalFrontmatter && Object.keys(taskProperties).length > 0) {
		baseData.frontmatter = {
			...originalFrontmatter,
			...taskProperties,
		};

		try {
			return formula.getValue(baseData);
		} finally {
			baseData.frontmatter = originalFrontmatter;
		}
	}

	return formula.getValue(baseData);
}

export function appendCachedFormulaOutputs(
	props: Record<string, unknown>,
	item: BasesDataItem
): void {
	const formulaOutputs = getBasesFormulaData(item)?.formulaResults?.cachedFormulaOutputs;
	if (!formulaOutputs || typeof formulaOutputs !== "object") {
		return;
	}

	for (const [formulaName, value] of Object.entries(formulaOutputs)) {
		props[`formula.${formulaName}`] = value;
	}
}
